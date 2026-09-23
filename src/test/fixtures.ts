import type {
  Conclusion,
  MergeGate,
  OwnPullRequestFacts,
  PullRequest,
  RunFailure,
  Workflow,
  WorkflowRun,
} from '../lib/domain/types';

/** Every test runs at this instant, so relative times are stable. */
export const NOW = new Date('2026-09-23T12:00:00Z');

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

let nextId = 1;

const CODES: Record<string, Conclusion> = {
  S: 'success',
  F: 'failure',
  R: 'running',
  C: 'cancelled',
};

/**
 * Runs from a code string, newest first: "RFFS" is running now, then two
 * failures, then a success, each `stepMs` apart.
 */
export function runs(codes: string, stepMs = HOUR, firstAgoMs = 0): WorkflowRun[] {
  return [...codes].map((code, i) => ({
    id: nextId++,
    conclusion: CODES[code],
    createdAt: ago(firstAgoMs + i * stepMs),
    durationMs: 60_000,
    headSha: `sha${String(i).padStart(4, '0')}abcdef`,
    event: 'push',
    htmlUrl: `https://example.test/runs/${i}`,
  }));
}

export const failure = (job: string, step: string, number = 1, of = 5): RunFailure => ({
  jobs: [job],
  step: { job, step, number, of },
});

/** Attach failures to the newest runs, in order; `undefined` leaves a run as it is. */
export const withFailures = (
  list: WorkflowRun[],
  failures: (RunFailure | undefined)[],
): WorkflowRun[] => list.map((run, i) => (failures[i] ? { ...run, failure: failures[i] } : run));

export function workflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: nextId++,
    name: 'CI',
    path: '.github/workflows/ci.yml',
    repo: 'acme/api',
    state: 'active',
    cron: null,
    defaultBranch: 'main',
    runs: runs('SSSS'),
    alertRuleCount: 1,
    ...overrides,
  };
}

export function gate(overrides: Partial<MergeGate> = {}): MergeGate {
  return {
    repo: 'acme/api',
    branch: 'main',
    requiredChecks: ['build'],
    readable: 'full',
    ...overrides,
  };
}

export function pullRequest(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: nextId++,
    title: 'A change',
    repo: 'acme/api',
    author: 'someone',
    htmlUrl: '#',
    createdAt: ago(10 * DAY),
    updatedAt: ago(DAY),
    reviewRequestedAt: ago(2 * DAY),
    requestedVia: null,
    reRequested: false,
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    checksState: 'success',
    reviewerCount: 2,
    state: 'waiting',
    ...overrides,
  };
}

export function ownFacts(overrides: Partial<OwnPullRequestFacts> = {}): OwnPullRequestFacts {
  return {
    number: nextId++,
    title: 'My change',
    repo: 'acme/api',
    htmlUrl: '#',
    createdAt: ago(10 * DAY),
    headCommittedAt: ago(5 * DAY),
    checksState: 'success',
    failingCheck: null,
    reviewDecision: 'REVIEW_REQUIRED',
    reviews: [],
    pending: [],
    requestEvents: [],
    ...overrides,
  };
}
