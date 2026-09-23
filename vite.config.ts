import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

interface Upstream {
  rest: string;
  graphql: string;
  token: string | undefined;
}

function resolveUpstream(env: Record<string, string>): Upstream {
  const rest = (env.GITHUB_API_BASE || 'https://api.github.com').replace(/\/$/, '');
  const graphql = rest.endsWith('/api/v3')
    ? `${rest.slice(0, -'/api/v3'.length)}/api/graphql`
    : `${rest}/graphql`;
  return { rest, graphql, token: env.GITHUB_TOKEN };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

async function forward(req: IncomingMessage, res: ServerResponse, upstream: Upstream) {
  if (!upstream.token) {
    send(res, 501, { error: 'GITHUB_TOKEN is not set. See README.' });
    return;
  }

  const path = req.url || '/';
  const target = path.startsWith('/graphql')
    ? upstream.graphql
    : `${upstream.rest}${path.replace(/^\/rest/, '')}`;

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  const response = await fetch(target, {
    method: req.method,
    headers: {
      authorization: `Bearer ${upstream.token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'git-sentinel',
    },
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
  });

  res.statusCode = response.status;
  res.setHeader('content-type', response.headers.get('content-type') || 'application/json');
  // Surface rate-limit headers so the client can back off.
  for (const header of ['x-ratelimit-remaining', 'x-ratelimit-reset']) {
    const value = response.headers.get(header);
    if (value) res.setHeader(header, value);
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}

/**
 * Proxies GitHub API calls through the dev server so the token never reaches
 * the browser bundle. A VITE_-prefixed token would be inlined into the client
 * JS and readable by anything running on the page, so the token here is read
 * from GITHUB_TOKEN (no VITE_ prefix) and attached on the server side.
 *
 * Shipping this beyond localhost means putting the same forwarding in front of
 * the built assets — the browser never talks to GitHub directly.
 */
function githubProxy(env: Record<string, string>): Plugin {
  const upstream = resolveUpstream(env);

  return {
    name: 'git-sentinel:github-proxy',
    configureServer(server: ViteDevServer) {
      // The handler stays synchronous so a rejected promise cannot escape as an
      // unhandled rejection and take the dev server down.
      server.middlewares.use('/gh', (req, res) => {
        forward(req, res, upstream).catch((error: unknown) => {
          if (!res.headersSent) send(res, 502, { error: String(error) });
          else res.end();
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), githubProxy(env)],
    server: { port: 5273 },
  };
});
