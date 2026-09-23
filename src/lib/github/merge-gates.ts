import { rest } from './client';
import type { MergeGate } from '../domain/types';

interface RestBranch {
  protection?: {
    required_status_checks?: {
      contexts?: string[];
      checks?: { context: string }[];
    } | null;
  };
}

interface RestRule {
  type: string;
  parameters?: { required_status_checks?: { context: string }[] };
}

/**
 * Required checks come from two places: classic branch protection, and
 * rulesets. Both are readable with plain read access — unlike
 * `/branches/{branch}/protection`, which needs admin. The rules endpoint is
 * GHE 3.9+, so an older server answers 404 there and the gate is marked
 * partial rather than reported as having nothing required.
 */
export async function fetchMergeGate(repo: string, branch: string): Promise<MergeGate> {
  const encoded = encodeURIComponent(branch);
  const [classic, rules] = await Promise.allSettled([
    rest<RestBranch>(`/repos/${repo}/branches/${encoded}`),
    rest<RestRule[]>(`/repos/${repo}/rules/branches/${encoded}`),
  ]);

  const required = new Set<string>();
  if (classic.status === 'fulfilled') {
    const checks = classic.value.protection?.required_status_checks;
    for (const context of checks?.contexts ?? []) required.add(context);
    for (const check of checks?.checks ?? []) required.add(check.context);
  }
  if (rules.status === 'fulfilled') {
    for (const rule of rules.value) {
      if (rule.type !== 'required_status_checks') continue;
      for (const check of rule.parameters?.required_status_checks ?? [])
        required.add(check.context);
    }
  }

  const read = [classic, rules].filter((result) => result.status === 'fulfilled').length;
  return {
    repo,
    branch,
    requiredChecks: [...required],
    readable: read === 2 ? 'full' : read === 1 ? 'partial' : 'none',
  };
}
