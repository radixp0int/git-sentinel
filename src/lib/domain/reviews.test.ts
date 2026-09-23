import { describe, expect, it } from 'vitest';
import {
  findYourRequest,
  groupReviews,
  requestRoutes,
  sameReviewer,
  waitingDays,
  waitingLabel,
} from './reviews';
import type { Reviewer, ReviewRequestEvent } from './types';
import { DAY, HOUR, NOW, ago, pullRequest } from '../../test/fixtures';

const you: Reviewer = { kind: 'user', login: 'you' };
const platform: Reviewer = { kind: 'team', slug: 'platform' };
const payments: Reviewer = { kind: 'team', slug: 'payments' };
const event = (reviewer: Reviewer, msAgo: number): ReviewRequestEvent => ({
  at: ago(msAgo),
  reviewer,
});

describe('sameReviewer', () => {
  it('tells a person from a team of the same name', () => {
    expect(sameReviewer({ kind: 'user', login: 'x' }, { kind: 'user', login: 'x' })).toBe(true);
    expect(sameReviewer({ kind: 'user', login: 'x' }, { kind: 'team', slug: 'x' })).toBe(false);
  });
});

describe('findYourRequest', () => {
  it('uses the newest direct request and notices it was a repeat', () => {
    const request = findYourRequest(
      [event(you, 9 * DAY), event(platform, 8 * DAY), event(you, 2 * DAY)],
      [you, platform],
      'you',
    );
    expect(request).toEqual({ at: ago(2 * DAY), via: you, reRequested: true });
  });

  it('falls back to the longest-waiting pending team when you were not asked by name', () => {
    const request = findYourRequest(
      [event(platform, 6 * DAY), event(payments, 3 * DAY), event(platform, 1 * DAY)],
      [platform, payments],
      'you',
    );
    expect(request).toEqual({ at: ago(3 * DAY), via: payments, reRequested: false });
  });

  it('ignores requests made of other people', () => {
    const other: Reviewer = { kind: 'user', login: 'someone-else' };
    expect(findYourRequest([event(other, DAY)], [other], 'you')).toBeNull();
  });

  it('is null when the timeline has nothing for you', () => {
    expect(findYourRequest([], [platform], 'you')).toBeNull();
  });
});

describe('waitingDays', () => {
  it('counts from the request, not from when the pull request was opened', () => {
    const pr = pullRequest({ createdAt: ago(26 * DAY), reviewRequestedAt: ago(3 * HOUR) });
    expect(waitingDays(pr, NOW)).toBe(0);
    expect(waitingLabel(waitingDays(pr, NOW))).toBe('new today');
  });

  it('labels a real wait in days', () => {
    expect(waitingLabel(4)).toBe('4d waiting');
  });
});

describe('groupReviews', () => {
  it('buckets by state and puts the longest wait first', () => {
    const recent = pullRequest({ reviewRequestedAt: ago(DAY) });
    const old = pullRequest({ reviewRequestedAt: ago(9 * DAY) });
    const parked = pullRequest({ state: 'parked' });
    const groups = groupReviews([recent, parked, old]);
    expect(groups.waiting).toEqual([old, recent]);
    expect(groups.parked).toEqual([parked]);
    expect(groups.blocked).toEqual([]);
  });
});

describe('requestRoutes', () => {
  it('counts how requests reached you, busiest route first', () => {
    const routes = requestRoutes([
      pullRequest({ requestedVia: platform }),
      pullRequest({ requestedVia: you }),
      pullRequest({ requestedVia: platform }),
      pullRequest({ requestedVia: null }),
    ]);
    expect(routes).toEqual([
      { via: platform, count: 2 },
      { via: you, count: 1 },
      { via: null, count: 1 },
    ]);
  });
});
