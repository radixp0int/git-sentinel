import { describe, expect, it } from 'vitest';
import {
  commonFailurePoints,
  failurePoint,
  failureStreak,
  isConsistent,
  stepLabel,
} from './failures';
import { failure, runs, withFailures, workflow } from '../../test/fixtures';

describe('failureStreak', () => {
  it('steps over running and cancelled runs and stops at the first success', () => {
    const list = runs('RFCFSF');
    expect(failureStreak(list).map((run) => run.id)).toEqual([list[1].id, list[3].id]);
  });

  it('is empty when the newest finished run passed', () => {
    expect(failureStreak(runs('SFF'))).toEqual([]);
  });
});

describe('failurePoint', () => {
  it('is null when no failing run has step information', () => {
    expect(failurePoint(workflow({ runs: runs('FFS') }))).toBeNull();
  });

  it('recognises the same step failing on every sampled run', () => {
    const step = failure('reconcile', 'Compare ledger totals', 4, 7);
    const point = failurePoint(workflow({ runs: withFailures(runs('FFFS'), [step, step, step]) }));
    expect(point).not.toBeNull();
    expect(point?.sameStep).toBe(3);
    expect(point?.sampled).toBe(3);
    expect(point?.steps).toHaveLength(1);
    expect(point && isConsistent(point)).toBe(true);
    expect(point && stepLabel(point.latest)).toBe('reconcile › Compare ledger totals');
  });

  it('lists each distinct failing step, newest first, when they vary', () => {
    const point = failurePoint(
      workflow({
        runs: withFailures(runs('FFFS'), [
          failure('e2e', 'Set up job'),
          failure('e2e', 'npm ci'),
          failure('e2e', 'Set up job'),
        ]),
      }),
    );
    expect(point?.steps.map((step) => step.step)).toEqual(['Set up job', 'npm ci']);
    expect(point?.sameStep).toBe(2);
    expect(point && isConsistent(point)).toBe(false);
  });

  it('does not call a single sample consistent', () => {
    const point = failurePoint(workflow({ runs: withFailures(runs('FS'), [failure('a', 'b')]) }));
    expect(point?.sampled).toBe(1);
    expect(point && isConsistent(point)).toBe(false);
  });

  it('ignores failures from before the last green run', () => {
    const list = withFailures(runs('SF'), [undefined, failure('old', 'step')]);
    expect(failurePoint(workflow({ runs: list }))).toBeNull();
  });
});

const failsAtSetup = (repo: string, job: string) =>
  workflow({ repo, runs: withFailures(runs('FS'), [failure(job, 'Set up job')]) });

describe('commonFailurePoints', () => {
  it('groups workflows by failing step name across repositories, most shared first', () => {
    const a = failsAtSetup('acme/web', 'e2e');
    const b = failsAtSetup('acme/auth', 'build');
    const c = workflow({
      repo: 'acme/api',
      runs: withFailures(runs('FS'), [failure('db', 'Migrate')]),
    });
    const healthy = workflow({ runs: runs('SS') });

    const shared = commonFailurePoints([c, a, healthy, b]);
    expect(shared.map((item) => [item.step, item.workflows.length])).toEqual([
      ['Set up job', 2],
      ['Migrate', 1],
    ]);
  });
});
