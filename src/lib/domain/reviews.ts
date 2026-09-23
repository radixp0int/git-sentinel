import type {
  PullRequest,
  Reviewer,
  ReviewRequest,
  ReviewRequestEvent,
  ReviewState,
} from './types';

const DAY = 86_400_000;

/** How long this pull request has been waiting on you, in whole days. */
export function waitingDays(pr: PullRequest, now: Date = new Date()): number {
  const since = new Date(pr.reviewRequestedAt ?? pr.createdAt).getTime();
  return Math.floor((now.getTime() - since) / DAY);
}

/** "new today" rather than "0d waiting", which reads like a bug. */
export const waitingLabel = (days: number) => (days < 1 ? 'new today' : `${days}d waiting`);

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

export const sameReviewer = (a: Reviewer, b: Reviewer) =>
  a.kind === 'user'
    ? b.kind === 'user' && a.login === b.login
    : b.kind === 'team' && a.slug === b.slug;

/** Oldest first, for anything stamped with an ISO time. */
export const byTime = (a: { at: string }, b: { at: string }) => Date.parse(a.at) - Date.parse(b.at);

/** The newest request of this reviewer. Asking again resets the clock. */
export function latestRequest(
  events: ReviewRequestEvent[],
  reviewer: Reviewer,
): ReviewRequest | null {
  const asked = events.filter((event) => sameReviewer(event.reviewer, reviewer)).toSorted(byTime);
  const last = asked.at(-1);
  return last ? { at: last.at, via: reviewer, reRequested: asked.length > 1 } : null;
}

/** Of these reviewers' newest requests, the one that has waited longest. */
export function oldestOutstanding(
  events: ReviewRequestEvent[],
  reviewers: Reviewer[],
): ReviewRequest | null {
  const requests = reviewers.flatMap((reviewer) => latestRequest(events, reviewer) ?? []);
  return requests.toSorted(byTime)[0] ?? null;
}

/**
 * The request that put this pull request in your queue.
 *
 * A direct request wins. Otherwise you are in the queue through a team, but
 * finding out which team would cost a membership query per team, so we take
 * the longest-waiting pending team request: at worst that overstates the wait,
 * and it never hides one.
 */
export function findYourRequest(
  events: ReviewRequestEvent[],
  pending: Reviewer[],
  viewer: string,
): ReviewRequest | null {
  const you: Reviewer = { kind: 'user', login: viewer };
  const teams = pending.filter((reviewer) => reviewer.kind === 'team');
  if (pending.some((reviewer) => sameReviewer(reviewer, you)) || teams.length === 0) {
    return latestRequest(events, you);
  }
  return oldestOutstanding(events, teams);
}

export interface RouteCount {
  /** Null when the timeline did not say how the request arrived. */
  via: Reviewer | null;
  count: number;
}

/** How requests reach you, busiest route first. */
export function requestRoutes(pullRequests: PullRequest[]): RouteCount[] {
  const routes: RouteCount[] = [];
  for (const pr of pullRequests) {
    const via = pr.requestedVia;
    const route = routes.find((r) =>
      r.via === null || via === null ? r.via === via : sameReviewer(r.via, via),
    );
    if (route) route.count++;
    else routes.push({ via, count: 1 });
  }
  return routes.toSorted((a, b) => b.count - a.count);
}
