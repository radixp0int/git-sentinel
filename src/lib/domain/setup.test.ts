import { describe, expect, it } from 'vitest';
import { setupProblem, shouldPromptSetup } from './setup';

describe('setupProblem', () => {
  it.each([
    ['missing', 3, 'no-token'],
    ['rejected', 3, 'token-rejected'],
    ['unreachable', 3, 'unreachable'],
    ['ok', 0, 'no-repos'],
    ['ok', 3, null],
  ] as const)('token %s with %d repos is %s', (token, repos, expected) => {
    expect(setupProblem(token, repos)).toBe(expected);
  });

  it('reports the token before the repo list, since it has to be fixed first', () => {
    expect(setupProblem('missing', 0)).toBe('no-token');
  });
});

describe('shouldPromptSetup', () => {
  it('prompts the first time a problem is seen', () => {
    expect(shouldPromptSetup('no-token', null)).toBe(true);
  });

  it('stays quiet once that problem was dismissed', () => {
    expect(shouldPromptSetup('no-token', 'no-token')).toBe(false);
  });

  it('prompts again for a different problem than the one dismissed', () => {
    expect(shouldPromptSetup('token-rejected', 'no-token')).toBe(true);
  });

  it('never prompts when setup is complete', () => {
    expect(shouldPromptSetup(null, null)).toBe(false);
  });
});
