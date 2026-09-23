import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Client from './client';
import { GitHubError, rest } from './client';
import { fetchMergeGate } from './merge-gates';

vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof Client>()),
  rest: vi.fn(),
}));

const restMock = vi.mocked(rest);

function serve(answers: Record<string, unknown>) {
  restMock.mockImplementation(((path: string) =>
    path in answers
      ? Promise.resolve(answers[path])
      : Promise.reject(new GitHubError(`GET ${path} failed: Not Found`, 404))) as typeof rest);
}

beforeEach(() => {
  restMock.mockReset();
});

describe('fetchMergeGate', () => {
  it('merges classic protection and rulesets, without duplicates', async () => {
    serve({
      '/repos/acme/api/branches/main': {
        protection: {
          required_status_checks: { contexts: ['build', 'lint'], checks: [{ context: 'build' }] },
        },
      },
      '/repos/acme/api/rules/branches/main': [
        { type: 'pull_request' },
        {
          type: 'required_status_checks',
          parameters: {
            required_status_checks: [{ context: 'test (node 20)' }, { context: 'lint' }],
          },
        },
      ],
    });

    expect(await fetchMergeGate('acme/api', 'main')).toEqual({
      repo: 'acme/api',
      branch: 'main',
      requiredChecks: ['build', 'lint', 'test (node 20)'],
      readable: 'full',
    });
  });

  it('marks the gate partial when rulesets are unavailable, as on GHE before 3.9', async () => {
    serve({
      '/repos/acme/api/branches/main': {
        protection: { required_status_checks: { contexts: ['build'] } },
      },
    });
    const gate = await fetchMergeGate('acme/api', 'main');
    expect(gate.readable).toBe('partial');
    expect(gate.requiredChecks).toEqual(['build']);
  });

  it('says it could not read the gate rather than claiming nothing is required', async () => {
    serve({});
    expect(await fetchMergeGate('acme/api', 'main')).toMatchObject({
      requiredChecks: [],
      readable: 'none',
    });
  });

  it('encodes branch names that contain slashes', async () => {
    serve({});
    await fetchMergeGate('acme/api', 'release/2026');
    expect(restMock).toHaveBeenCalledWith('/repos/acme/api/branches/release%2F2026');
  });
});
