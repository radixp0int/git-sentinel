import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rest } from './client';
import { fetchFleet } from './workflows';
import { FAILURE_SAMPLE } from '../domain/failures';
import { HOUR, ago } from '../../test/fixtures';

vi.mock('./client', () => ({ rest: vi.fn(), graphql: vi.fn() }));

const restMock = vi.mocked(rest);

const restRun = (id: number, conclusion: string | null, attempt = 1, hoursAgo = 0) => ({
  id,
  status: conclusion ? 'completed' : 'in_progress',
  conclusion,
  created_at: ago(hoursAgo * HOUR),
  updated_at: ago(hoursAgo * HOUR),
  head_sha: `${id}`.padEnd(40, '0'),
  event: 'push',
  html_url: `https://github.test/runs/${id}`,
  run_attempt: attempt,
});

const brokenBuild = [
  {
    name: 'build',
    conclusion: 'failure',
    steps: [
      { name: 'Set up job', number: 1, conclusion: 'success' },
      { name: 'Compile', number: 2, conclusion: 'failure' },
      { name: 'Upload', number: 3, conclusion: 'skipped' },
    ],
  },
  { name: 'lint', conclusion: 'success', steps: [] },
];

/** A one-repo, one-workflow GitHub, answering by path. */
function serve(
  runs: ReturnType<typeof restRun>[],
  jobs: (runId: number) => unknown = () => ({ jobs: brokenBuild }),
) {
  const route = (path: string): unknown => {
    if (path === '/repos/acme/api') return { default_branch: 'main' };
    if (path === '/repos/acme/api/actions/workflows') {
      return {
        workflows: [{ id: 7, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' }],
      };
    }
    if (path.startsWith('/repos/acme/api/actions/workflows/7/runs')) return { workflow_runs: runs };
    if (path.startsWith('/repos/acme/api/contents/')) throw new Error('no workflow file');
    const job = /\/actions\/runs\/(\d+)\/attempts\/\d+\/jobs/.exec(path);
    if (job) return jobs(Number(job[1]));
    if (path === '/repos/acme/api/branches/main') {
      return { protection: { required_status_checks: { contexts: ['build'] } } };
    }
    if (path === '/repos/acme/api/rules/branches/main') return [];
    throw new Error(`unexpected request: ${path}`);
  };
  restMock.mockImplementation(((path: string) => {
    try {
      return Promise.resolve(route(path));
    } catch (error) {
      return Promise.reject(error);
    }
  }) as typeof rest);
}

const jobCalls = () =>
  restMock.mock.calls.filter(([path]) => /\/attempts\/\d+\/jobs/.test(path)).map(([path]) => path);

beforeEach(() => {
  restMock.mockReset();
});

describe('fetchFleet', () => {
  it('looks up where it broke for the newest runs of the failure streak only', async () => {
    serve([
      restRun(101, 'failure'),
      restRun(102, 'failure', 1, 1),
      restRun(103, 'failure', 1, 2),
      restRun(104, 'failure', 1, 3),
      restRun(105, 'success', 1, 4),
    ]);

    const { workflows } = await fetchFleet(['acme/api']);
    const [wf] = workflows;

    expect(jobCalls()).toHaveLength(FAILURE_SAMPLE);
    expect(wf.runs[0].failure).toEqual({
      jobs: ['build'],
      step: { job: 'build', step: 'Compile', number: 2, of: 3 },
    });
    expect(wf.runs[3].failure).toBeUndefined();
    expect(wf.runs[4].failure).toBeUndefined();
  });

  it('never fetches the same attempt twice, but does fetch a re-run', async () => {
    serve([restRun(201, 'failure'), restRun(202, 'success', 1, 1)]);
    await fetchFleet(['acme/api']);
    await fetchFleet(['acme/api']);
    expect(jobCalls()).toHaveLength(1);

    serve([restRun(201, 'failure', 2), restRun(202, 'success', 1, 1)]);
    await fetchFleet(['acme/api']);
    expect(jobCalls()).toEqual([
      '/repos/acme/api/actions/runs/201/attempts/1/jobs?per_page=100',
      '/repos/acme/api/actions/runs/201/attempts/2/jobs?per_page=100',
    ]);
  });

  it('keeps the workflow when the jobs lookup fails', async () => {
    serve([restRun(301, 'failure'), restRun(302, 'success', 1, 1)], () => {
      throw new Error('502');
    });
    const { workflows } = await fetchFleet(['acme/api']);
    expect(workflows).toHaveLength(1);
    expect(workflows[0].runs[0].conclusion).toBe('failure');
    expect(workflows[0].runs[0].failure).toBeUndefined();
  });

  it('returns each repository’s merge gate alongside its workflows', async () => {
    serve([restRun(401, 'success')]);
    const { gates } = await fetchFleet(['acme/api']);
    expect(gates).toEqual([
      { repo: 'acme/api', branch: 'main', requiredChecks: ['build'], readable: 'full' },
    ]);
  });
});
