import { graphql } from './client';
import { describeOwnPullRequest } from '../domain/own-pull-requests';
import { findYourRequest } from '../domain/reviews';
import type {
  ChecksState,
  OwnPullRequest,
  OwnPullRequestFacts,
  PullRequest,
  Reviewer,
  ReviewRequestEvent,
  ReviewState,
  SubmittedReview,
} from '../domain/types';

const REVIEWER = `requestedReviewer { kind: __typename ... on User { login } ... on Team { slug } }`;

/**
 * Review requests come from the timeline because the pull request itself only
 * knows who is pending, not since when. `last: 20` is plenty — a pull request
 * re-requested more often than that has bigger problems than our clock.
 */
const REQUEST_FIELDS = `
  reviewRequests(first: 10) { totalCount nodes { ${REVIEWER} } }
  timelineItems(itemTypes: [REVIEW_REQUESTED_EVENT], last: 20) {
    nodes { ... on ReviewRequestedEvent { createdAt ${REVIEWER} } }
  }`;

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
  viewer { login }
  search(query: $q, type: ISSUE, first: 50) {
    nodes {
      ... on PullRequest {
        number title url createdAt updatedAt additions deletions changedFiles
        author { login }
        repository { nameWithOwner }
        reviewDecision
        ${REQUEST_FIELDS}
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

/** Drafts are left out: nobody is waiting on a draft, you included. */
const OWN_QUERY = `
query OwnPullRequests($q: String!) {
  search(query: $q, type: ISSUE, first: 50) {
    nodes {
      ... on PullRequest {
        number title url createdAt
        repository { nameWithOwner }
        reviewDecision
        ${REQUEST_FIELDS}
        latestReviews(first: 20) { nodes { state submittedAt author { login } } }
        commits(last: 1) {
          nodes {
            commit {
              committedDate
              statusCheckRollup {
                state
                contexts(first: 50) {
                  nodes {
                    kind: __typename
                    ... on CheckRun { name conclusion }
                    ... on StatusContext { context state }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const OWN_SEARCH = 'is:open is:pr author:@me archived:false draft:false';

type GqlReviewer = { kind: string; login?: string; slug?: string } | null;

interface GqlRequests {
  reviewRequests: { totalCount: number; nodes: { requestedReviewer: GqlReviewer }[] };
  timelineItems: { nodes: ({ createdAt: string; requestedReviewer: GqlReviewer } | null)[] };
}

interface GqlPullRequest extends GqlRequests {
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
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] };
}

type GqlContext =
  | { kind: 'CheckRun'; name: string; conclusion: string | null }
  | { kind: 'StatusContext'; context: string; state: string };

interface GqlOwnPullRequest extends GqlRequests {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  repository: { nameWithOwner: string };
  reviewDecision: string | null;
  latestReviews: {
    nodes: { state: string; submittedAt: string | null; author: { login: string } | null }[];
  };
  commits: {
    nodes: {
      commit: {
        committedDate: string;
        statusCheckRollup: { state: string; contexts: { nodes: GqlContext[] } } | null;
      };
    }[];
  };
}

function toReviewer(raw: GqlReviewer): Reviewer | null {
  if (raw?.kind === 'User' && raw.login) return { kind: 'user', login: raw.login };
  if (raw?.kind === 'Team' && raw.slug) return { kind: 'team', slug: raw.slug };
  // Bots and mannequins can be requested too; they are nobody's queue.
  return null;
}

function toRequests(pr: GqlRequests): { pending: Reviewer[]; events: ReviewRequestEvent[] } {
  return {
    pending: pr.reviewRequests.nodes.flatMap((node) => toReviewer(node.requestedReviewer) ?? []),
    events: pr.timelineItems.nodes.flatMap((node) => {
      const reviewer = node && toReviewer(node.requestedReviewer);
      return node && reviewer ? [{ at: node.createdAt, reviewer }] : [];
    }),
  };
}

function toChecksState(state: string | undefined): ChecksState {
  switch (state) {
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

function toPullRequest(pr: GqlPullRequest, requested: ReviewState, viewer: string): PullRequest {
  const checks = toChecksState(pr.commits.nodes[0]?.commit.statusCheckRollup?.state);
  const { pending, events } = toRequests(pr);
  const request = findYourRequest(events, pending, viewer);
  return {
    number: pr.number,
    title: pr.title,
    repo: pr.repository.nameWithOwner,
    author: pr.author?.login ?? 'unknown',
    htmlUrl: pr.url,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    // No request event means the timeline was trimmed or the request came
    // before the event existed; PR age is then the closest honest proxy.
    reviewRequestedAt: request?.at ?? pr.createdAt,
    requestedVia: request?.via ?? null,
    reRequested: request?.reRequested ?? false,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    checksState: checks,
    reviewerCount: pr.reviewRequests.totalCount,
    // A PR awaiting your review with red checks is not yet yours to read.
    state: requested === 'waiting' && checks === 'failure' ? 'parked' : requested,
  };
}

const FAILED_CHECK = new Set(['FAILURE', 'TIMED_OUT', 'STARTUP_FAILURE', 'ERROR']);

function failingCheck(contexts: GqlContext[]): string | null {
  for (const context of contexts) {
    if (context.kind === 'CheckRun' && FAILED_CHECK.has(context.conclusion ?? '')) {
      return context.name;
    }
    if (context.kind === 'StatusContext' && FAILED_CHECK.has(context.state)) {
      return context.context;
    }
  }
  return null;
}

const REVIEW_DECISIONS = new Set(['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED']);
const REVIEW_STATES = new Set([
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
  'DISMISSED',
  'PENDING',
]);

function toOwnFacts(pr: GqlOwnPullRequest): OwnPullRequestFacts {
  const head = pr.commits.nodes[0]?.commit;
  const rollup = head?.statusCheckRollup;
  const { pending, events } = toRequests(pr);
  return {
    number: pr.number,
    title: pr.title,
    repo: pr.repository.nameWithOwner,
    htmlUrl: pr.url,
    createdAt: pr.createdAt,
    headCommittedAt: head?.committedDate ?? null,
    checksState: toChecksState(rollup?.state),
    failingCheck: rollup ? failingCheck(rollup.contexts.nodes) : null,
    reviewDecision: REVIEW_DECISIONS.has(pr.reviewDecision ?? '')
      ? (pr.reviewDecision as OwnPullRequestFacts['reviewDecision'])
      : null,
    reviews: pr.latestReviews.nodes.flatMap((review) =>
      review.submittedAt && review.author && REVIEW_STATES.has(review.state)
        ? [
            {
              author: review.author.login,
              state: review.state as SubmittedReview['state'],
              at: review.submittedAt,
            },
          ]
        : [],
    ),
    pending,
    requestEvents: events,
  };
}

export async function fetchReviewQueue(): Promise<PullRequest[]> {
  const results = await Promise.all(
    QUERIES.map(async ({ state, q }) => {
      const data = await graphql<{
        viewer: { login: string };
        search: { nodes: GqlPullRequest[] };
      }>(REVIEW_QUERY, { q });
      return data.search.nodes.map((pr) => toPullRequest(pr, state, data.viewer.login));
    }),
  );
  return results.flat();
}

export async function fetchOwnPullRequests(): Promise<OwnPullRequest[]> {
  const data = await graphql<{ search: { nodes: GqlOwnPullRequest[] } }>(OWN_QUERY, {
    q: OWN_SEARCH,
  });
  return data.search.nodes.map((pr) => describeOwnPullRequest(toOwnFacts(pr)));
}
