import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkToken } from './client';

const reply = (status: number, body: unknown) =>
  vi.fn(() =>
    Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
    ),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkToken', () => {
  it('accepts a token when GitHub returns its rate-limit document', async () => {
    vi.stubGlobal('fetch', reply(200, { resources: { core: { remaining: 4999 } } }));
    expect(await checkToken()).toBe('ok');
  });

  it('reads the proxy’s own 501 as no token configured', async () => {
    vi.stubGlobal('fetch', reply(501, { error: 'GITHUB_TOKEN is not set. See README.' }));
    expect(await checkToken()).toBe('missing');
  });

  it('reads 401 as GitHub rejecting the token', async () => {
    vi.stubGlobal('fetch', reply(401, { message: 'Bad credentials' }));
    expect(await checkToken()).toBe('rejected');
  });

  it('does not mistake a static host’s index.html for GitHub', async () => {
    vi.stubGlobal('fetch', reply(200, '<!doctype html><title>Sentinel</title>'));
    expect(await checkToken()).toBe('unreachable');
  });

  it('treats a network failure as unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    expect(await checkToken()).toBe('unreachable');
  });
});
