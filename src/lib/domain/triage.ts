import { failureStreak } from './failures';
import { failingRequiredChecks, gateFor } from './merge-gates';
import type { MergeGate, Triage, Workflow, WorkflowRun } from './types';
import { TRIAGE_ORDER } from './types';

/** A failure older than this has outlived anyone's memory of seeing it go red. */
export const SILENT_AFTER_DAYS = 3;
/** Fail rate above this over the sampled window counts as flaky. */
export const FLAKY_THRESHOLD = 0.2;
/** Missing this many expected runs in a row means the schedule has stopped firing. */
export const STALE_MISSED_WINDOWS = 2;
/** How many recent runs we look at when judging flakiness. */
export const WINDOW = 10;

const DAY = 86_400_000;

const daysBetween = (a: Date, b: Date) => Math.floor(Math.abs(a.getTime() - b.getTime()) / DAY);

/**
 * Rough cadence of a cron expression, in ms.
 *
 * Deliberately approximate: we only need to know whether a run is overdue by a
 * wide margin, not the exact next fire time. Anything we cannot read falls back
 * to the observed gap between runs.
 */
function everyN(field: string): number | null {
  const m = /^\*\/(\d+)$/.exec(field);
  return m ? Number(m[1]) : null;
}

export function approxCronIntervalMs(cron: string): number | null {
  const [min, hour, dom, , dow] = cron.trim().split(/\s+/);
  if (!min || !hour) return null;

  if (min === '*') return 60_000;
  const perMin = everyN(min);
  if (perMin) return perMin * 60_000;

  if (hour === '*') return 3_600_000;
  const perHour = everyN(hour);
  if (perHour) return perHour * 3_600_000;

  if (dow && dow !== '*') return 7 * DAY;
  const perDay = dom ? everyN(dom) : null;
  if (perDay) return perDay * DAY;

  return DAY;
}

/** Median gap between consecutive runs — our fallback cadence for anything without a cron. */
export function medianGapMs(runs: WorkflowRun[]): number | null {
  if (runs.length < 3) return null;
  const gaps: number[] = [];
  for (let i = 0; i < runs.length - 1; i++) {
    gaps.push(
      new Date(runs[i].createdAt).getTime() - new Date(runs[i + 1].createdAt).getTime(),
    );
  }
  const sorted = gaps.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || null;
}

export function expectedIntervalMs(wf: Workflow): number | null {
  const fromCron = wf.cron ? approxCronIntervalMs(wf.cron) : null;
  return fromCron ?? medianGapMs(wf.runs);
}

/**
 * Classify a workflow into the bucket the dashboard sorts by.
 *
 * Order of checks matters. Staleness is tested before failure because a workflow
 * that stopped running has no red run to find — its last recorded run is often
 * green, which is exactly how a broken schedule hides in a pass/fail grid.
 */
export function classify(wf: Workflow, now: Date = new Date()): Triage {
  const empty: Triage = {
    state: 'unknown',
    since: null,
    days: 0,
    consecutiveFailures: 0,
    failRate: 0,
    reason: 'No runs recorded yet.',
  };

  if (wf.state !== 'active') {
    return {
      ...empty,
      state: 'stale',
      reason:
        wf.state === 'disabled_inactivity'
          ? 'Disabled by GitHub after 60 days without activity.'
          : 'Disabled manually.',
    };
  }

  if (wf.runs.length === 0) return empty;

  const runs = wf.runs;
  const last = runs[0];
  const lastAt = new Date(last.createdAt);

  // 1. Has it stopped running altogether?
  const interval = expectedIntervalMs(wf);
  if (interval) {
    const overdueBy = now.getTime() - lastAt.getTime();
    if (overdueBy > interval * STALE_MISSED_WINDOWS) {
      const missed = Math.floor(overdueBy / interval);
      return {
        state: 'stale',
        since: lastAt,
        days: daysBetween(now, lastAt),
        consecutiveFailures: 0,
        failRate: 0,
        reason: `Expected roughly every ${humanInterval(interval)}; ${missed} runs never started.`,
      };
    }
  }

  // 2. Is it failing, and for how long?
  const streak = failureStreak(runs);
  const consecutiveFailures = streak.length;

  if (consecutiveFailures > 0) {
    const lastGreen = runs.find((r) => r.conclusion === 'success');
    const brokeAt = new Date(streak[consecutiveFailures - 1].createdAt);
    const days = daysBetween(now, brokeAt);
    const silent = days >= SILENT_AFTER_DAYS;
    return {
      state: silent ? 'silent' : 'failing',
      since: brokeAt,
      days,
      consecutiveFailures,
      failRate: consecutiveFailures / Math.min(runs.length, WINDOW),
      reason: silent
        ? `${consecutiveFailures} consecutive failures over ${days} days${
            wf.alertRuleCount === 0 ? ', and no alert rule covers this repository' : ''
          }.`
        : `${consecutiveFailures} consecutive failures${
            lastGreen ? `, last green ${lastGreen.headSha.slice(0, 7)}` : ''
          }.`,
    };
  }

  // 3. Passing now, but how reliably?
  const window = runs.slice(0, WINDOW).filter((r) => r.conclusion !== 'running');
  const failures = window.filter((r) => r.conclusion === 'failure').length;
  const failRate = window.length ? failures / window.length : 0;

  if (failRate > FLAKY_THRESHOLD) {
    return {
      state: 'flaky',
      since: null,
      days: 0,
      consecutiveFailures: 0,
      failRate,
      reason: `${failures} of the last ${window.length} runs failed, then passed on retry.`,
    };
  }

  return {
    state: 'healthy',
    since: null,
    days: 0,
    consecutiveFailures: 0,
    failRate,
    reason: 'Green across the sampled window.',
  };
}

function humanInterval(ms: number): string {
  if (ms >= 7 * DAY) return 'week';
  if (ms >= DAY) return 'day';
  if (ms >= 3_600_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 60_000)}m`;
}

export interface Triaged {
  workflow: Workflow;
  triage: Triage;
  /** Required checks this workflow is failing. Non-empty: nothing in its repository can merge. */
  blockingChecks: string[];
}

/**
 * Merge blockers first, then severity, then longest-wrong first.
 *
 * A red required check outranks even a silent failure: it stops every pull
 * request in the repository, so the cost grows with each person it blocks.
 */
export function sortByUrgency(items: Triaged[]): Triaged[] {
  return items.toSorted((a, b) => {
    const blocking = Number(b.blockingChecks.length > 0) - Number(a.blockingChecks.length > 0);
    if (blocking !== 0) return blocking;
    const rank = TRIAGE_ORDER.indexOf(a.triage.state) - TRIAGE_ORDER.indexOf(b.triage.state);
    if (rank !== 0) return rank;
    return b.triage.days - a.triage.days;
  });
}

export function triageAll(workflows: Workflow[], gates: MergeGate[] = [], now?: Date): Triaged[] {
  return sortByUrgency(
    workflows.map((workflow) => ({
      workflow,
      triage: classify(workflow, now),
      blockingChecks: failingRequiredChecks(workflow, gateFor(gates, workflow.repo)),
    })),
  );
}

export function countByState(items: Triaged[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const state of TRIAGE_ORDER) counts[state] = 0;
  for (const item of items) counts[item.triage.state]++;
  return counts;
}

export const needsAttention = (item: Triaged) =>
  item.triage.state !== 'healthy' && item.triage.state !== 'unknown';

/**
 * Short label for the status chip. Returns null for states that need no chip —
 * a healthy workflow says nothing, which is the point.
 */
export function triageLabel(triage: Triage): string | null {
  switch (triage.state) {
    case 'silent':
      return `SILENT ${triage.days}d`;
    case 'failing':
      return triage.days > 0 ? `FAILING ${triage.days}d` : 'FAILING';
    case 'stale':
      return triage.days > 0 ? `STALE ${triage.days}d` : 'STALE';
    case 'flaky':
      return `FLAKY ${Math.round(triage.failRate * 100)}%`;
    case 'unknown':
      return 'NO RUNS';
    default:
      return null;
  }
}

/** Share of sampled runs that finished green, as a whole percentage. */
export function greenRate(workflows: Workflow[]): number {
  const runs = workflows.flatMap((wf) => wf.runs).filter((run) => run.conclusion !== 'running');
  if (runs.length === 0) return 100;
  const green = runs.filter((run) => run.conclusion === 'success').length;
  return Math.round((green / runs.length) * 100);
}

/** Repositories where a failure would reach nobody. */
export function uncoveredRepos(workflows: Workflow[]): string[] {
  return [...new Set(workflows.filter((wf) => wf.alertRuleCount === 0).map((wf) => wf.repo))];
}

export const distinctRepos = (workflows: Workflow[]) =>
  new Set(workflows.map((wf) => wf.repo)).size;
