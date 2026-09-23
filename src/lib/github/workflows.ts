import { rest } from './client';
import { fetchMergeGate } from './merge-gates';
import { FAILURE_SAMPLE, failureStreak } from '../domain/failures';
import type { Conclusion, MergeGate, RunFailure, Workflow, WorkflowRun } from '../domain/types';

interface RestWorkflow {
  id: number;
  name: string;
  path: string;
  state: Workflow['state'];
}

interface RestRun {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  head_sha: string;
  event: string;
  html_url: string;
  run_attempt: number;
}

interface RestJob {
  name: string;
  conclusion: string | null;
  steps?: { name: string; number: number; conclusion: string | null }[];
}

const failed = (conclusion: string | null) =>
  conclusion === 'failure' || conclusion === 'timed_out';

function toConclusion(run: RestRun): Conclusion {
  if (run.status === 'in_progress' || run.status === 'queued') return 'running';
  switch (run.conclusion) {
    case 'success':
      return 'success';
    case 'failure':
    case 'timed_out':
      return 'failure';
    default:
      return 'cancelled';
  }
}

function toRun(run: RestRun, failure?: RunFailure): WorkflowRun {
  const started = new Date(run.created_at).getTime();
  const ended = new Date(run.updated_at).getTime();
  return {
    id: run.id,
    conclusion: toConclusion(run),
    createdAt: run.created_at,
    durationMs: ended > started ? ended - started : null,
    headSha: run.head_sha,
    event: run.event,
    htmlUrl: run.html_url,
    failure,
  };
}

/**
 * The schedule lives in the workflow YAML, not in the API's workflow object, so
 * we read the file and pull the first cron out of it. Without this we cannot
 * tell "never scheduled" from "schedule stopped firing" — which is the whole
 * reason the stale bucket exists.
 */
async function fetchCron(repo: string, path: string): Promise<string | null> {
  try {
    const file = await rest<{ content: string; encoding: string }>(
      `/repos/${repo}/contents/${encodeURIComponent(path)}`,
    );
    if (file.encoding !== 'base64') return null;
    const yaml = atob(file.content.replace(/\n/g, ''));
    return /cron:\s*['"]?([^'"\n]+)['"]?/.exec(yaml)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

function toFailure(jobs: RestJob[]): RunFailure {
  const failedJobs = jobs.filter((job) => failed(job.conclusion));
  const first = failedJobs[0];
  const steps = first?.steps ?? [];
  const step = steps.find((s) => failed(s.conclusion));
  return {
    jobs: failedJobs.map((job) => job.name),
    step:
      first && step
        ? { job: first.name, step: step.name, number: step.number, of: steps.length }
        : null,
  };
}

/**
 * A finished attempt's jobs never change, so each is fetched once for the life
 * of the page. Keyed by attempt because a re-run reuses the run id. Without
 * this a failing workflow would cost FAILURE_SAMPLE requests on every poll.
 */
const failureCache = new Map<string, RunFailure>();

async function fetchRunFailure(repo: string, run: RestRun): Promise<RunFailure | undefined> {
  const key = `${repo}#${run.id}#${run.run_attempt}`;
  const cached = failureCache.get(key);
  if (cached) return cached;
  try {
    const { jobs } = await rest<{ jobs: RestJob[] }>(
      `/repos/${repo}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
    );
    const failure = toFailure(jobs);
    failureCache.set(key, failure);
    return failure;
  } catch {
    // Not knowing where a run broke is no reason to lose the whole workflow.
    return undefined;
  }
}

/** Maps runs, looking up where it broke for the newest few runs of the current failure streak. */
async function toRuns(repo: string, raw: RestRun[]): Promise<WorkflowRun[]> {
  const runs = raw.map((run) => toRun(run));
  const sample = new Set(
    failureStreak(runs)
      .slice(0, FAILURE_SAMPLE)
      .map((run) => run.id),
  );
  return Promise.all(
    raw.map(async (run, i) =>
      sample.has(run.id) ? toRun(run, await fetchRunFailure(repo, run)) : runs[i],
    ),
  );
}

async function fetchRepo(
  repo: string,
  runsPerWorkflow: number,
): Promise<{ workflows: Workflow[]; gate: MergeGate }> {
  const [repoMeta, list] = await Promise.all([
    rest<{ default_branch: string }>(`/repos/${repo}`),
    rest<{ workflows: RestWorkflow[] }>(`/repos/${repo}/actions/workflows`),
  ]);

  const [workflows, gate] = await Promise.all([
    Promise.all(
      list.workflows.map(async (wf) => {
        const [runs, cron] = await Promise.all([
          rest<{ workflow_runs: RestRun[] }>(
            `/repos/${repo}/actions/workflows/${wf.id}/runs?per_page=${runsPerWorkflow}`,
          ),
          fetchCron(repo, wf.path),
        ]);

        return {
          id: wf.id,
          name: wf.name,
          path: wf.path,
          repo,
          state: wf.state,
          cron,
          defaultBranch: repoMeta.default_branch,
          runs: await toRuns(repo, runs.workflow_runs),
          alertRuleCount: 0,
        } satisfies Workflow;
      }),
    ),
    fetchMergeGate(repo, repoMeta.default_branch),
  ]);

  return { workflows, gate };
}

export interface Fleet {
  workflows: Workflow[];
  gates: MergeGate[];
}

export async function fetchFleet(repos: string[], runsPerWorkflow = 14): Promise<Fleet> {
  const results = await Promise.all(repos.map((repo) => fetchRepo(repo, runsPerWorkflow)));
  return {
    workflows: results.flatMap((result) => result.workflows),
    gates: results.map((result) => result.gate),
  };
}
