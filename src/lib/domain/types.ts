export type Conclusion =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'running'
  /** No run happened in a window where one was expected. Never returned by the API — we infer it. */
  | 'missing';

export interface WorkflowRun {
  id: number;
  conclusion: Conclusion;
  /** ISO 8601, as GitHub returns it. */
  createdAt: string;
  durationMs: number | null;
  headSha: string;
  event: string;
  htmlUrl: string;
}

export interface Workflow {
  id: number;
  /** Display name from the workflow file, e.g. "Deploy to production". */
  name: string;
  /** e.g. ".github/workflows/deploy-prod.yml" */
  path: string;
  /** "owner/repo" */
  repo: string;
  state: 'active' | 'disabled_manually' | 'disabled_inactivity';
  /** First schedule expression in the workflow, if it has one. */
  cron: string | null;
  defaultBranch: string;
  /** Newest first. */
  runs: WorkflowRun[];
  /** How many alert rules cover this workflow's repo. Zero means failures reach nobody. */
  alertRuleCount: number;
}

/**
 * Severity order matters: the fleet view sorts by this, then by how long
 * the workflow has been in the state. "silent" outranks "failing" because a
 * failure nobody has seen for weeks is worse than one that broke an hour ago.
 */
export const TRIAGE_ORDER = ['silent', 'stale', 'failing', 'flaky', 'unknown', 'healthy'] as const;

export type TriageState = (typeof TRIAGE_ORDER)[number];

export interface Triage {
  state: TriageState;
  /** When the workflow entered this state, if we can tell. */
  since: Date | null;
  /** Whole days it has been wrong. 0 for healthy. */
  days: number;
  consecutiveFailures: number;
  /** Failures / total over the sampled window, 0..1 */
  failRate: number;
  /** One sentence for the UI. */
  reason: string;
}

export type ReviewState =
  /** Requested from you, checks green — genuinely actionable. */
  | 'waiting'
  /** Requested from you, but checks are red. Reviewing now means reviewing twice. */
  | 'parked'
  /** You requested changes and the author has not pushed since. */
  | 'blocked-on-them'
  /** Approved and still not merged. */
  | 'approved-unmerged';

export interface PullRequest {
  number: number;
  title: string;
  repo: string;
  author: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  /** When your review was requested. Drives the queue order. */
  reviewRequestedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  checksState: 'success' | 'failure' | 'pending' | 'none';
  reviewerCount: number;
  state: ReviewState;
}
