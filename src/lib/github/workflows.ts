import { rest } from './client';
import type { Conclusion, Workflow, WorkflowRun } from '../domain/types';

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
}

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

function toRun(run: RestRun): WorkflowRun {
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

export async function fetchWorkflows(repo: string, runsPerWorkflow = 14): Promise<Workflow[]> {
  const [repoMeta, list] = await Promise.all([
    rest<{ default_branch: string }>(`/repos/${repo}`),
    rest<{ workflows: RestWorkflow[] }>(`/repos/${repo}/actions/workflows`),
  ]);

  return Promise.all(
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
        runs: runs.workflow_runs.map(toRun),
        alertRuleCount: 0,
      } satisfies Workflow;
    }),
  );
}

export async function fetchFleet(repos: string[]): Promise<Workflow[]> {
  const results = await Promise.all(repos.map((repo) => fetchWorkflows(repo)));
  return results.flat();
}
