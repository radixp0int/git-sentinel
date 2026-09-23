import { describe, expect, it } from 'vitest';
import { blockedRepos, failingRequiredChecks, gateNote, summarizeGates } from './merge-gates';
import type { RunFailure } from './types';
import { gate, runs, withFailures, workflow } from '../../test/fixtures';

const jobsFailed = (...jobs: string[]): RunFailure => ({ jobs, step: null });

const redBuild = (repo: string) =>
  workflow({ repo, runs: withFailures(runs('F'), [jobsFailed('build')]) });

describe('failingRequiredChecks', () => {
  it('returns the failing jobs that the branch requires', () => {
    const wf = workflow({ runs: withFailures(runs('FS'), [jobsFailed('build', 'docs')]) });
    expect(failingRequiredChecks(wf, gate({ requiredChecks: ['build', 'lint'] }))).toEqual([
      'build',
    ]);
  });

  it('matches matrix job names exactly as Actions reports them', () => {
    const wf = workflow({ runs: withFailures(runs('F'), [jobsFailed('test (node 20)')]) });
    expect(failingRequiredChecks(wf, gate({ requiredChecks: ['test (node 20)'] }))).toEqual([
      'test (node 20)',
    ]);
  });

  it('blocks nothing when the workflow is green, unfetched, or ungated', () => {
    const green = workflow({ runs: withFailures(runs('SF'), [undefined, jobsFailed('build')]) });
    const unfetched = workflow({ runs: runs('FS') });
    const failing = workflow({ runs: withFailures(runs('F'), [jobsFailed('build')]) });

    expect(failingRequiredChecks(green, gate())).toEqual([]);
    expect(failingRequiredChecks(unfetched, gate())).toEqual([]);
    expect(failingRequiredChecks(failing, undefined)).toEqual([]);
  });
});

describe('summarizeGates', () => {
  it('lists blocked repositories first and unreadable ones last, without duplicate checks', () => {
    const summaries = summarizeGates(
      [
        gate({ repo: 'acme/dark', readable: 'none', requiredChecks: [] }),
        gate({ repo: 'acme/web' }),
        gate({ repo: 'acme/api' }),
      ],
      [redBuild('acme/api'), redBuild('acme/api')],
    );

    expect(summaries.map((s) => s.gate.repo)).toEqual(['acme/api', 'acme/web', 'acme/dark']);
    expect(summaries[0].failing).toEqual(['build']);
    expect(blockedRepos(summaries)).toEqual(['acme/api']);
  });
});

describe('gateNote', () => {
  it.each([
    [{ gate: gate({ readable: 'none' }), failing: [] }, "couldn't read"],
    [{ gate: gate({ requiredChecks: ['a', 'b', 'c'] }), failing: ['a'] }, '1 of 3 red'],
    [{ gate: gate({ requiredChecks: ['a', 'b'] }), failing: [] }, '2 required · none failing'],
    [{ gate: gate({ requiredChecks: [] }), failing: [] }, 'nothing required'],
  ])('describes %o as "%s"', (summary, expected) => {
    expect(gateNote(summary)).toBe(expected);
  });
});
