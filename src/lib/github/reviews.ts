import { graphql } from './client';
import type { PullRequest, ReviewState } from '../domain/types';

/**
 * One request per bucket, each returning the PRs plus their check rollup.
 *
 * `user-review-requested:@me` rather than `review-requested:@me` — the former
 * includes pull requests routed to you through a team, which on Enterprise is
 * most of them. The rollup is what lets us park PRs whose checks are red
 * instead of showing them as actionable.
 */
const REVIEW_QUERY = `
query ReviewQueue($q: String!) {
  search(query: $q, type: ISSUE, first: 50) {
    nodes {
      ... on PullRequest {
        number title url createdAt updatedAt additions deletions changedFiles
        author { login }
        repository { nameWithOwner }
        reviewDecision
        reviewRequests(first: 10) { totalCount }
        commits(last: 1) {
          nodes { commit { statusCheckRollup { state } } }
        }
      }
    }
  }
}`;

const QUERIES: { state: ReviewState; q: string }[] = [
  { state: 'waiting', q: 'is:open is:pr user-review-requested:@me archived:false' },
  {
    state: 'blocked-on-them',
    q: 'is:open is:pr reviewed-by:@me review:changes_requested archived:false',
  },
  {
    state: 'approved-unmerged',
    q: 'is:open is:pr reviewed-by:@me review:approved archived:false',
  },
];

interface GqlPullRequest {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  author: { login: string } | null;
  repository: { nameWithOwner: string };
  reviewDecision: string | null;
  reviewRequests: { totalCount: number };
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] };
}

function checksState(pr: GqlPullRequest): PullRequest['checksState'] {
  switch (pr.commits.nodes[0]?.commit.statusCheckRollup?.state) {
    case 'SUCCESS':
      return 'success';
    case 'FAILURE':
    case 'ERROR':
      return 'failure';
    case 'PENDING':
    case 'EXPECTED':
      return 'pending';
    default:
      return 'none';
  }
}

function toPullRequest(pr: GqlPullRequest, requested: ReviewState): PullRequest {
  const checks = checksState(pr);
  return {
    number: pr.number,
    title: pr.title,
    repo: pr.repository.nameWithOwner,
    author: pr.author?.login ?? 'unknown',
    htmlUrl: pr.url,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    // The API does not expose when the request was made; PR age is the closest
    // honest proxy, and it is what the queue is sorted by.
    reviewRequestedAt: pr.createdAt,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    checksState: checks,
    reviewerCount: pr.reviewRequests.totalCount,
    // A PR awaiting your review with red checks is not yet yours to read.
    state: requested === 'waiting' && checks === 'failure' ? 'parked' : requested,
  };
}

export async function fetchReviewQueue(): Promise<PullRequest[]> {
  const results = await Promise.all(
    QUERIES.map(async ({ state, q }) => {
      const data = await graphql<{ search: { nodes: GqlPullRequest[] } }>(REVIEW_QUERY, { q });
      return data.search.nodes.map((pr) => toPullRequest(pr, state));
    }),
  );
  return results.flat();
}
