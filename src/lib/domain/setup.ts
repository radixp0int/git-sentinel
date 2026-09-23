/** What the /gh proxy says about the token it holds. */
export type TokenStatus = 'ok' | 'missing' | 'rejected' | 'unreachable';

/**
 * Why the dashboard is showing sample data. Each needs a different fix, so the
 * setup dialog explains each one separately rather than listing every step.
 */
export type SetupProblem =
  /** GITHUB_TOKEN is not set on the dev server. */
  | 'no-token'
  /** GitHub answered 401: expired, revoked, or from another server. */
  | 'token-rejected'
  /** No proxy answered — a static build, `vite preview`, or a bad GITHUB_API_BASE. */
  | 'unreachable'
  /** The token works but VITE_GITHUB_REPOS is empty. */
  | 'no-repos';

const TOKEN_PROBLEM: Record<Exclude<TokenStatus, 'ok'>, SetupProblem> = {
  missing: 'no-token',
  rejected: 'token-rejected',
  unreachable: 'unreachable',
};

/** The first thing standing between the dashboard and live data, if anything. */
export function setupProblem(token: TokenStatus, repoCount: number): SetupProblem | null {
  if (token !== 'ok') return TOKEN_PROBLEM[token];
  return repoCount === 0 ? 'no-repos' : null;
}

/**
 * Prompt once per problem. Dismissing "no token" should not also silence
 * "token rejected" later: that is new information, and it is the one that
 * sends people looking for why nothing loads.
 */
export const shouldPromptSetup = (problem: SetupProblem | null, dismissed: string | null) =>
  problem !== null && problem !== dismissed;
