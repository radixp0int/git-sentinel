import type { PullRequest, ReviewState } from './types';

const DAY = 86_400_000;

/** How long this pull request has been waiting on you, in whole days. */
export function waitingDays(pr: PullRequest, now: Date = new Date()): number {
  const since = new Date(pr.reviewRequestedAt ?? pr.createdAt).getTime();
  return Math.floor((now.getTime() - since) / DAY);
}

/** Longest wait first — the same rule the fleet view applies to failures. */
export const byLongestWait = (a: PullRequest, b: PullRequest) => waitingDays(b) - waitingDays(a);

export interface ReviewGroups {
  waiting: PullRequest[];
  parked: PullRequest[];
  blocked: PullRequest[];
  approved: PullRequest[];
}

const GROUP_STATE: Record<keyof ReviewGroups, ReviewState> = {
  waiting: 'waiting',
  parked: 'parked',
  blocked: 'blocked-on-them',
  approved: 'approved-unmerged',
};

export function groupReviews(pullRequests: PullRequest[]): ReviewGroups {
  const groups = {} as ReviewGroups;
  for (const [key, state] of Object.entries(GROUP_STATE) as [keyof ReviewGroups, ReviewState][]) {
    groups[key] = pullRequests.filter((pr) => pr.state === state).toSorted(byLongestWait);
  }
  return groups;
}

/**
 * A pull request nobody else can review is a single point of failure — it stays
 * blocked for as long as you are away.
 */
export const isSoleReviewer = (pr: PullRequest) => pr.reviewerCount <= 1;
