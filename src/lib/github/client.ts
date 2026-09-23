/**
 * Transport for every GitHub call.
 *
 * All requests go through the dev server's /gh proxy, which attaches the token.
 * See vite.config.ts — the browser never holds a credential.
 */

const REST = '/gh/rest';
const GRAPHQL = '/gh/graphql';

export class GitHubError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

export async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${REST}${path}`);
  if (!res.ok) throw new GitHubError(`GET ${path} failed: ${res.statusText}`, res.status);
  return res.json() as Promise<T>;
}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new GitHubError(`GraphQL failed: ${res.statusText}`, res.status);

  const body = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (body.errors?.length) {
    throw new GitHubError(body.errors.map((e) => e.message).join('; '), 200);
  }
  return body.data;
}

/** True when the proxy has a token to work with. */
export async function isConfigured(): Promise<boolean> {
  try {
    const res = await fetch(`${REST}/rate_limit`);
    return res.ok;
  } catch {
    return false;
  }
}
