import type { FailedStep, Workflow, WorkflowRun } from './types';

/**
 * How many runs of a failure streak we look up jobs for. Each one costs a REST
 * request, and three is enough to tell "the same step every time" from "a
 * different step each time".
 */
export const FAILURE_SAMPLE = 3;

/**
 * The runs in a workflow's current failure streak, newest first.
 *
 * Running and cancelled runs are stepped over rather than ending the streak: a
 * re-run in progress, or one somebody cancelled, says nothing about whether the
 * workflow is fixed.
 */
export function failureStreak(runs: WorkflowRun[]): WorkflowRun[] {
  const streak: WorkflowRun[] = [];
  for (const run of runs) {
    if (run.conclusion === 'failure') streak.push(run);
    else if (run.conclusion !== 'running' && run.conclusion !== 'cancelled') break;
  }
  return streak;
}

/** "reconcile › Compare ledger totals" */
export const stepLabel = (step: FailedStep) => `${step.job} › ${step.step}`;

const sameStep = (a: FailedStep, b: FailedStep) => a.job === b.job && a.step === b.step;

export interface FailurePoint {
  /** Where the newest failure broke. */
  latest: FailedStep;
  /** Sampled failures that broke at the same step as the newest one. */
  sameStep: number;
  /** Failures in the streak whose failing step we know. */
  sampled: number;
  /** Distinct failing steps across the sample, newest first. */
  steps: FailedStep[];
  /** The sampled runs with the step each broke at, newest first. */
  runs: { run: WorkflowRun; step: FailedStep }[];
}

/**
 * Where a failing workflow breaks.
 *
 * The same step on every run points at the code; a different step each time
 * points at something shared underneath it — a runner, a registry, a secret.
 */
export function failurePoint(wf: Workflow): FailurePoint | null {
  const runs = failureStreak(wf.runs).flatMap((run) =>
    run.failure?.step ? [{ run, step: run.failure.step }] : [],
  );
  const latest = runs[0]?.step;
  if (!latest) return null;

  const steps: FailedStep[] = [];
  for (const { step } of runs) {
    if (!steps.some((seen) => sameStep(seen, step))) steps.push(step);
  }

  return {
    latest,
    sameStep: runs.filter(({ step }) => sameStep(step, latest)).length,
    sampled: runs.length,
    steps,
    runs,
  };
}

/** Every sampled failure broke at one step. One sample proves nothing either way. */
export const isConsistent = (point: FailurePoint) =>
  point.sampled > 1 && point.sameStep === point.sampled;

export interface SharedFailure {
  /** Step name alone: "Set up job" means the same thing whatever the job is called. */
  step: string;
  workflows: Workflow[];
}

/** Failing steps across the fleet, most widely shared first. */
export function commonFailurePoints(workflows: Workflow[]): SharedFailure[] {
  const byStep = new Map<string, Workflow[]>();
  for (const wf of workflows) {
    const names = new Set(failurePoint(wf)?.steps.map((step) => step.step));
    for (const name of names) byStep.set(name, [...(byStep.get(name) ?? []), wf]);
  }
  return [...byStep]
    .map(([step, affected]) => ({ step, workflows: affected }))
    .toSorted((a, b) => b.workflows.length - a.workflows.length || a.step.localeCompare(b.step));
}
