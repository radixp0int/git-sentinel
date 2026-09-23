import { describe, expect, it } from 'vitest';
import {
  approxCronIntervalMs,
  classify,
  medianGapMs,
  sortByUrgency,
  triageAll,
  triageLabel,
  type Triaged,
} from './triage';
import {
  DAY,
  HOUR,
  MINUTE,
  NOW,
  failure,
  gate,
  runs,
  withFailures,
  workflow,
} from '../../test/fixtures';

describe('approxCronIntervalMs', () => {
  it.each([
    ['*/15 * * * *', 15 * MINUTE],
    ['0 */6 * * *', 6 * HOUR],
    ['0 3 * * *', DAY],
    ['0 6 * * 1', 7 * DAY],
    ['0 0 */2 * *', 2 * DAY],
  ])('reads %s as roughly %d ms', (cron, expected) => {
    expect(approxCronIntervalMs(cron)).toBe(expected);
  });

  it('gives up on an expression it cannot read', () => {
    expect(approxCronIntervalMs('@daily')).toBeNull();
  });
});

describe('medianGapMs', () => {
  it('needs at least three runs to call anything a cadence', () => {
    expect(medianGapMs(runs('SS'))).toBeNull();
  });

  it('takes the median, so one long gap does not skew it', () => {
    const list = runs('SSSS', HOUR);
    list[3] = { ...list[3], createdAt: new Date(NOW.getTime() - 30 * HOUR).toISOString() };
    expect(medianGapMs(list)).toBe(HOUR);
  });
});

describe('classify', () => {
  it('treats a workflow GitHub disabled for inactivity as stale', () => {
    const triage = classify(workflow({ state: 'disabled_inactivity' }), NOW);
    expect(triage.state).toBe('stale');
    expect(triage.reason).toMatch(/60 days/);
  });

  it('reports unknown when there are no runs', () => {
    expect(classify(workflow({ runs: [] }), NOW).state).toBe('unknown');
  });

  it('marks a daily schedule stale once runs stop starting, even if the last one was green', () => {
    const wf = workflow({ cron: '0 3 * * *', runs: runs('SSSS', DAY, 3 * DAY) });
    const triage = classify(wf, NOW);
    expect(triage.state).toBe('stale');
    expect(triage.days).toBe(3);
    expect(triage.reason).toMatch(/3 runs never started/);
  });

  it('catches a push-triggered workflow that went quiet, using the observed cadence', () => {
    const wf = workflow({ runs: runs('SSSS', HOUR, 5 * HOUR) });
    expect(classify(wf, NOW).state).toBe('stale');
  });

  it('reports a recent failure streak as failing, naming the last green commit', () => {
    const wf = workflow({ runs: runs('FFSS', HOUR) });
    const triage = classify(wf, NOW);
    expect(triage.state).toBe('failing');
    expect(triage.consecutiveFailures).toBe(2);
    expect(triage.reason).toContain('last green sha0002');
  });

  it('escalates a failure nobody has fixed for days to silent', () => {
    const wf = workflow({ cron: '0 3 * * *', runs: runs('FFFFS', DAY, HOUR) });
    const triage = classify(wf, NOW);
    expect(triage.state).toBe('silent');
    expect(triage.days).toBe(3);
  });

  it('dates the break from the oldest failure even when a run in progress heads the list', () => {
    const list = runs('RFFS', HOUR);
    const triage = classify(workflow({ runs: list }), NOW);
    expect(triage.consecutiveFailures).toBe(2);
    expect(triage.since?.toISOString()).toBe(list[2].createdAt);
  });

  it('calls a workflow flaky when it passes now but failed too often in the window', () => {
    const wf = workflow({ runs: runs('SFSSFSSFSS', HOUR) });
    const triage = classify(wf, NOW);
    expect(triage.state).toBe('flaky');
    expect(triage.failRate).toBeCloseTo(0.3);
  });

  it('calls a workflow healthy when it is green and on schedule', () => {
    expect(classify(workflow({ runs: runs('SSSSS', HOUR) }), NOW).state).toBe('healthy');
  });
});

describe('triageLabel', () => {
  it('says nothing for a healthy workflow', () => {
    expect(triageLabel(classify(workflow({ runs: runs('SSSS') }), NOW))).toBeNull();
  });

  it('puts the flaky rate in the chip', () => {
    expect(triageLabel(classify(workflow({ runs: runs('SFSSFSSFSS') }), NOW))).toBe('FLAKY 30%');
  });
});

const item = (
  state: Triaged['triage']['state'],
  days: number,
  blocking: string[] = [],
): Triaged => ({
  workflow: workflow(),
  triage: { state, days, since: null, consecutiveFailures: 0, failRate: 0, reason: '' },
  blockingChecks: blocking,
});

describe('sortByUrgency', () => {
  it('puts merge blockers first, then severity, then longest wrong', () => {
    const sorted = sortByUrgency([
      item('healthy', 0),
      item('failing', 1),
      item('silent', 4),
      item('silent', 9),
      item('failing', 0, ['build']),
    ]);
    expect(
      sorted.map((i) => `${i.triage.state}:${i.triage.days}:${i.blockingChecks.length}`),
    ).toEqual(['failing:0:1', 'silent:9:0', 'silent:4:0', 'failing:1:0', 'healthy:0:0']);
  });
});

describe('triageAll', () => {
  it('flags the workflows whose failing job is a required check in their repository', () => {
    const blocking = workflow({
      repo: 'acme/api',
      runs: withFailures(runs('FS'), [failure('build', 'Compile')]),
    });
    const elsewhere = workflow({
      repo: 'acme/web',
      runs: withFailures(runs('FS'), [failure('build', 'Compile')]),
    });
    const result = triageAll([elsewhere, blocking], [gate({ repo: 'acme/api' })], NOW);
    expect(result[0].workflow).toBe(blocking);
    expect(result[0].blockingChecks).toEqual(['build']);
    expect(result[1].blockingChecks).toEqual([]);
  });
});
