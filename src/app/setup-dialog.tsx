import type { ReactNode } from 'react';
import { Dialog } from '../lib/ui';
import type { SetupProblem } from '../lib/domain';

const TOKEN_DOCS =
  'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens';

const Code = ({ children }: { children: ReactNode }) => <code className="mono">{children}</code>;

const ENV_FILE = `GITHUB_TOKEN=ghp_your_token_here
VITE_GITHUB_REPOS=your-org/api,your-org/web
VITE_GITHUB_ORG=your-org

# GitHub Enterprise Server only:
# GITHUB_API_BASE=https://github.example.com/api/v3`;

const RESTART = (
  <li>
    Restart the dev server: stop it and run <Code>npm run dev</Code> again. Vite reads{' '}
    <Code>.env.local</Code> only at start-up.
  </li>
);

const SCOPES = (
  <>
    A classic token needs <Code>repo</Code>, <Code>read:org</Code> and <Code>workflow</Code>. If
    your organization uses SSO, authorize the token for it as well.
  </>
);

function Steps({ problem }: { problem: SetupProblem }) {
  switch (problem) {
    case 'no-token':
      return (
        <>
          <p>
            You are looking at sample data. To see your own workflows and reviews, give the dev
            server a GitHub token. It takes about two minutes.
          </p>
          <ol className="dialog-steps">
            <li>
              Create a personal access token on GitHub. {SCOPES}{' '}
              <a href={TOKEN_DOCS} target="_blank" rel="noreferrer">
                How to create a token
              </a>
            </li>
            <li>
              Copy <Code>.env.example</Code> to <Code>.env.local</Code> in the project root and fill
              it in:
              <pre className="dialog-code">{ENV_FILE}</pre>
            </li>
            {RESTART}
          </ol>
        </>
      );
    case 'token-rejected':
      return (
        <>
          <p>
            <Code>GITHUB_TOKEN</Code> is set, but GitHub refused it (401). The dashboard is showing
            sample data until that is fixed.
          </p>
          <ol className="dialog-steps">
            <li>Check the token has not expired or been revoked, and copy it again if unsure.</li>
            <li>{SCOPES}</li>
            <li>
              On Enterprise Server, check <Code>GITHUB_API_BASE</Code> points at the server that
              issued the token.
            </li>
            {RESTART}
          </ol>
        </>
      );
    case 'unreachable':
      return (
        <>
          <p>
            The dashboard could not reach its <Code>/gh</Code> proxy, so it is showing sample data.
          </p>
          <ol className="dialog-steps">
            <li>
              Run it with <Code>npm run dev</Code>. The proxy that holds the token lives in the dev
              server; a production build or <Code>vite preview</Code> has none.
            </li>
            <li>
              Check <Code>GITHUB_API_BASE</Code> in <Code>.env.local</Code>, if you set it, and that
              this machine can reach it.
            </li>
            {RESTART}
          </ol>
        </>
      );
    case 'no-repos':
      return (
        <>
          <p>The token works. Now tell the dashboard which repositories to watch.</p>
          <ol className="dialog-steps">
            <li>
              In <Code>.env.local</Code>, list them as <Code>owner/repo</Code>, comma-separated:
              <pre className="dialog-code">VITE_GITHUB_REPOS=your-org/api,your-org/web</pre>
            </li>
            {RESTART}
          </ol>
        </>
      );
  }
}

const TITLE: Record<SetupProblem, string> = {
  'no-token': 'Connect to GitHub',
  'token-rejected': 'GitHub rejected the token',
  unreachable: 'Cannot reach the GitHub proxy',
  'no-repos': 'Choose repositories to watch',
};

export function SetupDialog({
  problem,
  open,
  onClose,
}: {
  problem: SetupProblem | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!problem) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={TITLE[problem]}
      footer={
        <>
          <a className="btn" href={TOKEN_DOCS} target="_blank" rel="noreferrer">
            GitHub token docs
          </a>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Continue with sample data
          </button>
        </>
      }
    >
      <Steps problem={problem} />
      <p className="dialog-note">
        The token stays on the dev server. Never paste it into this page or give it a{' '}
        <Code>VITE_</Code> prefix: either puts it where any script in the browser can read it.
      </p>
    </Dialog>
  );
}
