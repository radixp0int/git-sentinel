import { describe, expect, it } from 'vitest';
import {
  describeOwnPullRequest,
  groupOwnPullRequests,
  isYourMove,
  ownPullRequestLabel,
  ownPullRequestSince,
  stateDays,
} from './own-pull-requests';
import type { Reviewer } from './types';
import { DAY, NOW, ago, ownFacts } from '../../test/fixtures';

const alex: Reviewer = { kind: 'user', login: 'alex' };
const team: Reviewer = { kind: 'team', slug: 'platform' };

describe('describeOwnPullRequest', () => {
  it('puts red checks first, even on an approved pull request', () => {
    const pr = describeOwnPullRequest(
      ownFacts({
        checksState: 'failure',
        failingCheck: 'typecheck',
        headCommittedAt: ago(DAY),
        reviewDecision: 'APPROVED',
        reviews: [{ author: 'alex', state: 'APPROVED', at: ago(2 * DAY) }],
      }),
    );
    expect(pr.state).toBe('checks-failing');
    expect(pr.failingCheck).toBe('typecheck');
    expect(pr.since).toBe(ago(DAY));
  });

  it('is your move after a change request you have not pushed past', () => {
    const pr = describeOwnPullRequest(
      ownFacts({
        headCommittedAt: ago(4 * DAY),
        reviewDecision: 'CHANGES_REQUESTED',
        reviews: [{ author: 'alex', state: 'CHANGES_REQUESTED', at: ago(2 * DAY) }],
      }),
    );
    expect(pr.state).toBe('changes-requested');
    expect(pr.changesRequestedBy).toBe('alex');
    expect(pr.since).toBe(ago(2 * DAY));
  });

  it('hands the move back to reviewers once you push after their change request', () => {
    const pr = describeOwnPullRequest(
      ownFacts({
        headCommittedAt: ago(1 * DAY),
        reviewDecision: 'CHANGES_REQUESTED',
        reviews: [{ author: 'alex', state: 'CHANGES_REQUESTED', at: ago(3 * DAY) }],
        pending: [alex],
        requestEvents: [
          { at: ago(8 * DAY), reviewer: alex },
          { at: ago(1 * DAY), reviewer: alex },
        ],
      }),
    );
    expect(pr.state).toBe('awaiting-review');
    expect(pr.since).toBe(ago(DAY));
    expect(pr.reRequested).toBe(true);
    // alex reviewed before and is pending again: one reviewer, not two.
    expect([pr.reviewed, pr.reviewers]).toEqual([1, 1]);
  });

  it('dates an approval from the most recent sign-off', () => {
    const pr = describeOwnPullRequest(
      ownFacts({
        reviewDecision: 'APPROVED',
        reviews: [
          { author: 'alex', state: 'APPROVED', at: ago(6 * DAY) },
          { author: 'sam', state: 'APPROVED', at: ago(5 * DAY) },
        ],
      }),
    );
    expect(pr.state).toBe('approved');
    expect(pr.since).toBe(ago(5 * DAY));
    expect(pr.approvedBy).toEqual(['alex', 'sam']);
  });

  it('treats approvals as approved when the repo has no review requirement and nobody is pending', () => {
    const pr = describeOwnPullRequest(
      ownFacts({
        reviewDecision: null,
        reviews: [{ author: 'alex', state: 'APPROVED', at: ago(DAY) }],
      }),
    );
    expect(pr.state).toBe('approved');
  });

  it('waits on reviewers from the oldest outstanding request', () => {
    const pr = describeOwnPullRequest(
      ownFacts({
        pending: [alex, team],
        requestEvents: [
          { at: ago(2 * DAY), reviewer: alex },
          { at: ago(6 * DAY), reviewer: team },
        ],
      }),
    );
    expect(pr.state).toBe('awaiting-review');
    expect(pr.since).toBe(ago(6 * DAY));
    expect([pr.reviewed, pr.reviewers]).toEqual([0, 2]);
  });

  it('ignores reviews still in draft', () => {
    const pr = describeOwnPullRequest(
      ownFacts({ reviews: [{ author: 'alex', state: 'PENDING', at: ago(DAY) }] }),
    );
    expect(pr.state).toBe('awaiting-review');
    expect(pr.reviewed).toBe(0);
  });
});

describe('groupOwnPullRequests', () => {
  it('splits your move from theirs, each oldest first', () => {
    const waitingOld = describeOwnPullRequest(
      ownFacts({
        title: 'waiting old',
        pending: [team],
        requestEvents: [{ at: ago(6 * DAY), reviewer: team }],
      }),
    );
    const waitingNew = describeOwnPullRequest(
      ownFacts({
        title: 'waiting new',
        pending: [team],
        requestEvents: [{ at: ago(DAY), reviewer: team }],
      }),
    );
    const red = describeOwnPullRequest(
      ownFacts({ title: 'red', checksState: 'failure', headCommittedAt: ago(DAY) }),
    );
    const approved = describeOwnPullRequest(
      ownFacts({
        title: 'approved',
        reviewDecision: 'APPROVED',
        reviews: [{ author: 'alex', state: 'APPROVED', at: ago(5 * DAY) }],
      }),
    );

    const groups = groupOwnPullRequests([waitingNew, red, waitingOld, approved]);
    expect(groups.yourMove.map((pr) => pr.title)).toEqual(['approved', 'red']);
    expect(groups.waiting.map((pr) => pr.title)).toEqual(['waiting old', 'waiting new']);
    expect(isYourMove('awaiting-review')).toBe(false);
  });
});

describe('labels', () => {
  it('describes each state in the chip and the time column', () => {
    const approved = describeOwnPullRequest(
      ownFacts({
        reviewDecision: 'APPROVED',
        reviews: [{ author: 'alex', state: 'APPROVED', at: ago(5 * DAY) }],
      }),
    );
    expect(stateDays(approved, NOW)).toBe(5);
    expect(ownPullRequestLabel(approved, NOW)).toBe('APPROVED · 5d UNMERGED');
    expect(ownPullRequestSince(approved, NOW)).toBe('approved 5d ago');

    const waiting = describeOwnPullRequest(
      ownFacts({ pending: [team], requestEvents: [{ at: ago(DAY / 2), reviewer: team }] }),
    );
    expect(ownPullRequestLabel(waiting, NOW)).toBe('new today');
    expect(ownPullRequestSince(waiting, NOW)).toBe('requested 12h ago');

    const changes = describeOwnPullRequest(
      ownFacts({ reviews: [{ author: 'alex', state: 'CHANGES_REQUESTED', at: ago(2 * DAY) }] }),
    );
    expect(ownPullRequestLabel(changes, NOW)).toBe('CHANGES REQUESTED');
    expect(ownPullRequestSince(changes, NOW)).toBe('asked 2d ago');
  });
});
