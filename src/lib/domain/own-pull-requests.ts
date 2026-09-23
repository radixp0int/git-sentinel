import { relativeTime } from './format';
import { byTime, oldestOutstanding, waitingLabel } from './reviews';
import type {
  OwnPullRequest,
  OwnPullRequestFacts,
  OwnPullRequestState,
  SubmittedReview,
} from './types';

const DAY = 86_400_000;

/**
 * Decide whose move one of your pull requests is waiting on.
 *
 * Checks come first because a red pull request is parked in every reviewer's
 * queue: nothing else about it moves until it is green. A change request
 * counts only until you push again — after that it is the reviewer's turn.
 */
export function describeOwnPullRequest(facts: OwnPullRequestFacts): OwnPullRequest {
  const reviews = facts.reviews.filter((review) => review.state !== 'PENDING');
  const approvals = reviews.filter((review) => review.state === 'APPROVED').toSorted(byTime);
  const changes = reviews
    .filter((review) => review.state === 'CHANGES_REQUESTED')
    .toSorted(byTime)
    .at(-1);
  // Commit date is the nearest thing to a push time GraphQL exposes. A rebase
  // that keeps old commit dates reads as "not pushed since", which errs towards
  // telling you it is your move.
  const pushedAfter = (review: SubmittedReview) =>
    facts.headCommittedAt !== null && Date.parse(facts.headCommittedAt) > Date.parse(review.at);
  const request = oldestOutstanding(facts.requestEvents, facts.pending);

  const reviewedBy = new Set(reviews.map((review) => review.author));
  const stillPending = facts.pending.filter(
    (reviewer) => reviewer.kind === 'team' || !reviewedBy.has(reviewer.login),
  );

  const base = {
    number: facts.number,
    title: facts.title,
    repo: facts.repo,
    htmlUrl: facts.htmlUrl,
    createdAt: facts.createdAt,
    checksState: facts.checksState,
    failingCheck: facts.failingCheck,
    changesRequestedBy: null,
    approvedBy: approvals.map((review) => review.author),
    pending: facts.pending,
    reviewed: reviewedBy.size,
    reviewers: reviewedBy.size + stillPending.length,
    reRequested: request?.reRequested ?? false,
  };

  if (facts.checksState === 'failure') {
    // When the checks turned red is not exposed; the head commit is when they last ran.
    return { ...base, state: 'checks-failing', since: facts.headCommittedAt ?? facts.createdAt };
  }

  if (changes && facts.reviewDecision !== 'APPROVED' && !pushedAfter(changes)) {
    return {
      ...base,
      state: 'changes-requested',
      since: changes.at,
      changesRequestedBy: changes.author,
    };
  }

  const approved =
    facts.reviewDecision === 'APPROVED' ||
    (facts.reviewDecision === null && approvals.length > 0 && !changes && !request);
  if (approved) {
    return { ...base, state: 'approved', since: approvals.at(-1)?.at ?? facts.createdAt };
  }

  return {
    ...base,
    state: 'awaiting-review',
    since: request?.at ?? facts.headCommittedAt ?? facts.createdAt,
  };
}

export const isYourMove = (state: OwnPullRequestState) => state !== 'awaiting-review';

/** Whole days the pull request has been in its current state. */
export function stateDays(pr: OwnPullRequest, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(pr.since)) / DAY));
}

export interface OwnPullRequestGroups {
  yourMove: OwnPullRequest[];
  waiting: OwnPullRequest[];
}

/** Your move first, then theirs; each longest-waiting first. */
export function groupOwnPullRequests(pullRequests: OwnPullRequest[]): OwnPullRequestGroups {
  const oldestFirst = pullRequests.toSorted((a, b) => Date.parse(a.since) - Date.parse(b.since));
  return {
    yourMove: oldestFirst.filter((pr) => isYourMove(pr.state)),
    waiting: oldestFirst.filter((pr) => !isYourMove(pr.state)),
  };
}

/** Short label for the status chip. */
export function ownPullRequestLabel(pr: OwnPullRequest, now: Date = new Date()): string {
  const days = stateDays(pr, now);
  switch (pr.state) {
    case 'checks-failing':
      return 'CHECKS FAILING';
    case 'changes-requested':
      return 'CHANGES REQUESTED';
    case 'approved':
      return days > 0 ? `APPROVED · ${days}d UNMERGED` : 'APPROVED';
    case 'awaiting-review':
      return waitingLabel(days);
  }
}

/** When the current state began, in words that say what the date means. */
export function ownPullRequestSince(pr: OwnPullRequest, now: Date = new Date()): string {
  const ago = relativeTime(pr.since, now);
  switch (pr.state) {
    case 'checks-failing':
      return `last commit ${ago}`;
    case 'changes-requested':
      return `asked ${ago}`;
    case 'approved':
      return `approved ${ago}`;
    case 'awaiting-review':
      return `requested ${ago}`;
  }
}
