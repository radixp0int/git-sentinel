import { failureStreak } from './failures';
import type { MergeGate, Workflow } from './types';

export const gateFor = (gates: MergeGate[], repo: string) =>
  gates.find((gate) => gate.repo === repo);

/**
 * Required checks this workflow is failing right now. Each one stops every pull
 * request in the repository from merging.
 *
 * Actions reports each job as a check named after the job, matrix suffix
 * included ("test (node 20)"), and that is the name branch protection lists —
 * so the failing job names are compared with the required names directly.
 */
export function failingRequiredChecks(wf: Workflow, gate: MergeGate | undefined): string[] {
  const latest = failureStreak(wf.runs)[0];
  if (!gate || !latest?.failure) return [];
  const required = new Set(gate.requiredChecks);
  return latest.failure.jobs.filter((job) => required.has(job));
}

export interface GateSummary {
  gate: MergeGate;
  /** Required checks currently red, across every workflow in the repository. */
  failing: string[];
}

const RANK: Record<MergeGate['readable'], number> = { full: 0, partial: 0, none: 1 };

/** Blocked repositories first, unreadable ones last. */
export function summarizeGates(gates: MergeGate[], workflows: Workflow[]): GateSummary[] {
  return gates
    .map((gate) => ({
      gate,
      failing: [
        ...new Set(
          workflows
            .filter((wf) => wf.repo === gate.repo)
            .flatMap((wf) => failingRequiredChecks(wf, gate)),
        ),
      ],
    }))
    .toSorted(
      (a, b) =>
        b.failing.length - a.failing.length || RANK[a.gate.readable] - RANK[b.gate.readable],
    );
}

export const blockedRepos = (summaries: GateSummary[]) =>
  summaries.filter((summary) => summary.failing.length > 0).map((summary) => summary.gate.repo);

/** One line on a repository's gate: what is red, or why we cannot say. */
export function gateNote({ gate, failing }: GateSummary): string {
  if (gate.readable === 'none') return "couldn't read";
  const required = gate.requiredChecks.length;
  if (failing.length > 0) return `${failing.length} of ${required} red`;
  return required === 0 ? 'nothing required' : `${required} required · none failing`;
}
