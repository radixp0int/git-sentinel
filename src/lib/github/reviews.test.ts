import { beforeEach, describe, expect, it, vi } from 'vitest';
import { graphql } from './client';
import { fetchOwnPullRequests, fetchReviewQueue } from './reviews';
import { DAY, ago } from '../../test/fixtures';

vi.mock('./client', () => ({ rest: vi.fn(), graphql: vi.fn() }));

const graphqlMock = vi.mocked(graphql);

const team = (slug: string) => ({ kind: 'Team', slug });
const user = (login: string) => ({ kind: 'User', login });

function queuePr(overrides: Record<string, unknown> = {}) {
  return {
    number: 7,
    title: 'Add retries',
    url: 'https://github.test/acme/api/pull/7',
    createdAt: ago(21 * DAY),
    updatedAt: ago(DAY),
    additions: 5,
    deletions: 1,
    changedFiles: 1,
    author: { login: 'sam' },
    repository: { nameWithOwner: 'acme/api' },
    reviewDecision: 'REVIEW_REQUIRED',
    reviewRequests: { totalCount: 1, nodes: [{ requestedReviewer: team('platform') }] },
    timelineItems: {
      nodes: [
        { createdAt: ago(4 * DAY), requestedReviewer: team('platform') },
        { createdAt: ago(3 * DAY), requestedReviewer: { kind: 'Bot' } },
        {},
      ],
    },
    commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
    ...overrides,
  };
}

/** Answer the waiting bucket with `waiting`, every other bucket with nothing. */
function serveQueue(waiting: unknown[]) {
  graphqlMock.mockImplementation(((_query: string, variables: { q: string }) =>
    Promise.resolve({
      viewer: { login: 'you' },
      search: { nodes: variables.q.includes('user-review-requested') ? waiting : [] },
    })) as typeof graphql);
}

beforeEach(() => {
  graphqlMock.mockReset();
});

describe('fetchReviewQueue', () => {
  it('dates the wait from the team request, not from when the pull request opened', async () => {
    serveQueue([queuePr()]);
    const [pr] = await fetchReviewQueue();
    expect(pr.reviewRequestedAt).toBe(ago(4 * DAY));
    expect(pr.requestedVia).toEqual({ kind: 'team', slug: 'platform' });
    expect(pr.state).toBe('waiting');
  });

  it('falls back to the pull request age when the timeline has no request, and parks red checks', async () => {
    serveQueue([
      queuePr({
        timelineItems: { nodes: [] },
        commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
      }),
    ]);
    const [pr] = await fetchReviewQueue();
    expect(pr.reviewRequestedAt).toBe(ago(21 * DAY));
    expect(pr.requestedVia).toBeNull();
    expect(pr.state).toBe('parked');
  });

  it('prefers a direct request of the viewer over a team request', async () => {
    serveQueue([
      queuePr({
        reviewRequests: {
          totalCount: 2,
          nodes: [{ requestedReviewer: team('platform') }, { requestedReviewer: user('you') }],
        },
        timelineItems: {
          nodes: [
            { createdAt: ago(6 * DAY), requestedReviewer: team('platform') },
            { createdAt: ago(2 * DAY), requestedReviewer: user('you') },
          ],
        },
      }),
    ]);
    const [pr] = await fetchReviewQueue();
    expect(pr.reviewRequestedAt).toBe(ago(2 * DAY));
    expect(pr.requestedVia).toEqual({ kind: 'user', login: 'you' });
  });
});

describe('fetchOwnPullRequests', () => {
  it('names the failing check and makes it your move', async () => {
    graphqlMock.mockResolvedValue({
      search: {
        nodes: [
          {
            number: 61,
            title: 'Batch fetches',
            url: 'https://github.test/acme/api/pull/61',
            createdAt: ago(2 * DAY),
            repository: { nameWithOwner: 'acme/api' },
            reviewDecision: 'REVIEW_REQUIRED',
            reviewRequests: { totalCount: 1, nodes: [{ requestedReviewer: team('platform') }] },
            timelineItems: {
              nodes: [{ createdAt: ago(DAY), requestedReviewer: team('platform') }],
            },
            latestReviews: { nodes: [] },
            commits: {
              nodes: [
                {
                  commit: {
                    committedDate: ago(DAY),
                    statusCheckRollup: {
                      state: 'FAILURE',
                      contexts: {
                        nodes: [
                          { kind: 'CheckRun', name: 'lint', conclusion: 'SUCCESS' },
                          { kind: 'CheckRun', name: 'typecheck', conclusion: 'FAILURE' },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });

    const [pr] = await fetchOwnPullRequests();
    expect(graphqlMock.mock.calls[0][1]).toEqual({
      q: 'is:open is:pr author:@me archived:false draft:false',
    });
    expect(pr.state).toBe('checks-failing');
    expect(pr.failingCheck).toBe('typecheck');
    expect(pr.pending).toEqual([{ kind: 'team', slug: 'platform' }]);
  });
});
