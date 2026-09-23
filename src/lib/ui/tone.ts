import type { Conclusion, OwnPullRequestState, TriageState } from '../domain/types';

/**
 * Every coloured thing in the app resolves to one of these.
 *
 * Colour carries meaning here and nothing else: a tone is never chosen for
 * looks. Adding a sixth tone means adding a sixth meaning, so think before
 * you do.
 */
export type Tone = 'pass' | 'fail' | 'stale' | 'flaky' | 'running' | 'neutral';

export interface ToneVars {
  /** Text on a panel background. */
  fg: string;
  /** Chip and surface fill. */
  bg: string;
  /** Border for surfaces using this tone. */
  line: string;
  /** Full-strength dot or bar. */
  solid: string;
  /** Secondary body text inside a toned surface. */
  body: string;
  /** Panel fill when a whole surface takes this tone. */
  surface: string;
}

export const TONE: Record<Tone, ToneVars> = {
  pass: {
    fg: 'var(--pass-text)',
    bg: 'var(--pass-bg)',
    line: 'var(--pass-line)',
    solid: 'var(--pass)',
    body: 'var(--text-faint)',
    surface: 'var(--pass-bg)',
  },
  fail: {
    fg: 'var(--fail-text)',
    bg: 'var(--fail-chip)',
    line: 'var(--fail-line)',
    solid: 'var(--fail)',
    body: 'var(--fail-body)',
    surface: 'var(--fail-bg)',
  },
  stale: {
    fg: 'var(--stale-text)',
    bg: 'var(--stale-chip)',
    line: 'var(--stale-line)',
    solid: 'var(--stale)',
    body: 'var(--stale-body)',
    surface: 'var(--stale-bg)',
  },
  flaky: {
    fg: 'var(--flaky-text)',
    bg: 'var(--flaky-chip)',
    line: 'var(--line-strong)',
    solid: 'var(--flaky)',
    body: 'var(--text-faint)',
    surface: 'var(--panel)',
  },
  running: {
    fg: 'var(--running)',
    bg: 'var(--raised)',
    line: 'var(--line-strong)',
    solid: 'var(--running)',
    body: 'var(--text-faint)',
    surface: 'var(--panel)',
  },
  neutral: {
    fg: 'var(--text-dim)',
    bg: 'var(--raised)',
    line: 'var(--line-strong)',
    solid: '#4a515c',
    body: 'var(--text-faint)',
    surface: 'var(--panel)',
  },
};

/** Which tone a triage state wears. A presentation decision, not a domain one. */
export const STATE_TONE: Record<TriageState, Tone> = {
  silent: 'fail',
  failing: 'fail',
  stale: 'stale',
  flaky: 'flaky',
  healthy: 'pass',
  unknown: 'neutral',
};

export const CONCLUSION_TONE: Record<Conclusion, Tone> = {
  success: 'pass',
  failure: 'fail',
  running: 'running',
  cancelled: 'neutral',
  missing: 'neutral',
};

/**
 * How loudly to shout about something that has been waiting.
 *
 * The same thresholds the triage rules use, so a PR waiting nine days and a
 * workflow broken nine days look equally urgent.
 */
export function ageTone(days: number): Tone {
  if (days >= 7) return 'fail';
  if (days >= 3) return 'stale';
  return 'neutral';
}

/**
 * Your own pull request: red when it cannot move until you fix it, amber when
 * a reviewer is waiting on you, green when all that is left is merging. A pull
 * request waiting on reviewers gets louder with age, like any other wait.
 */
export function ownPullRequestTone(state: OwnPullRequestState, days: number): Tone {
  switch (state) {
    case 'checks-failing':
      return 'fail';
    case 'changes-requested':
      return 'stale';
    case 'approved':
      return 'pass';
    case 'awaiting-review':
      return ageTone(days);
  }
}
