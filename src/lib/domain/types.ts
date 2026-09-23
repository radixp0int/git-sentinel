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
  /**
   * Where the run broke. Only looked up for runs in a workflow's current
   * failure streak, so `undefined` means "not fetched", not "no failure".
   */
  failure?: RunFailure;
}

/** A step inside a job, as the jobs API numbers it (1-based). */
export interface FailedStep {
  job: string;
  step: string;
  number: number;
  /** How many steps the job has, for "step 4 of 7". */
  of: number;
}

export interface RunFailure {
  /** Every job that failed, by the name it reports as a check. */
  jobs: string[];
  /** The first failing step of the first failing job, when GitHub says which. */
  step: FailedStep | null;
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

/** Who a review was asked of. Team requests are how most reviews reach people on Enterprise. */
export type Reviewer = { kind: 'user'; login: string } | { kind: 'team'; slug: string };

export interface ReviewRequestEvent {
  /** ISO 8601. */
  at: string;
  reviewer: Reviewer;
}

export interface ReviewRequest {
  at: string;
  via: Reviewer;
  /** The same reviewer was asked more than once, usually after new commits. */
  reRequested: boolean;
}

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
  /** How the request reached you. Null when the timeline did not say. */
  requestedVia: Reviewer | null;
  reRequested: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  checksState: 'success' | 'failure' | 'pending' | 'none';
  reviewerCount: number;
  state: ReviewState;
}

export type ChecksState = PullRequest['checksState'];

/**
 * Your own open pull request, by whose move it is.
 *
 * The first three are yours to act on; `awaiting-review` is the only state in
 * which the pull request is waiting on somebody else.
 */
export type OwnPullRequestState =
  /** A check is red. Reviewers park it, so nobody will look until it is green. */
  | 'checks-failing'
  /** A reviewer asked for changes and you have not pushed since. */
  | 'changes-requested'
  /** Signed off and still open. */
  | 'approved'
  | 'awaiting-review';

export interface SubmittedReview {
  author: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  /** ISO 8601. */
  at: string;
}

/** Everything the API tells us about one of your pull requests, before we decide its state. */
export interface OwnPullRequestFacts {
  number: number;
  title: string;
  repo: string;
  htmlUrl: string;
  createdAt: string;
  /** Commit date of the head commit — the nearest thing to "last push" GitHub exposes. */
  headCommittedAt: string | null;
  checksState: ChecksState;
  failingCheck: string | null;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  /** Each reviewer's latest review. */
  reviews: SubmittedReview[];
  /** Requests still outstanding. */
  pending: Reviewer[];
  requestEvents: ReviewRequestEvent[];
}

export interface OwnPullRequest {
  number: number;
  title: string;
  repo: string;
  htmlUrl: string;
  createdAt: string;
  state: OwnPullRequestState;
  /** When the current state began, as near as the API lets us tell. */
  since: string;
  checksState: ChecksState;
  failingCheck: string | null;
  /** Who asked for changes, when that is the state. */
  changesRequestedBy: string | null;
  approvedBy: string[];
  pending: Reviewer[];
  /** People who have left a review, out of everyone involved. */
  reviewed: number;
  reviewers: number;
  reRequested: boolean;
}

/** The required status checks on a repository's default branch. */
export interface MergeGate {
  repo: string;
  branch: string;
  /** Check names that must pass before anything merges. */
  requiredChecks: string[];
  /**
   * `partial` when branch protection was readable but rulesets were not —
   * rulesets need GHE 3.9+, so an older server can hide some required checks.
   */
  readable: 'full' | 'partial' | 'none';
}
