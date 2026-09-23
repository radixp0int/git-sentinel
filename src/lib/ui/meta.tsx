import { Children, type ReactNode } from 'react';

/**
 * The dotted metadata line under a row title. Children are separated
 * automatically so callers stop hand-writing separator spans.
 */
export function Meta({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <div className="meta">
      {items.map((item, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span className="meta-sep">·</span>}
          {item}
        </span>
      ))}
    </div>
  );
}

/** "payments-api / deploy-prod.yml" — the app's primary identifier for a workflow. */
export function WorkflowName({ repo, file }: { repo: string; file: string }) {
  return (
    <>
      <span className="name-repo">{repo}</span>
      <span className="meta-sep">/</span>
      <span className="name-wf">{file}</span>
    </>
  );
}

/** "billing-svc #77" */
export function PullRequestRef({ repo, number }: { repo: string; number: number }) {
  return (
    <span className="mono">
      {repo} #{number}
    </span>
  );
}

export function Avatar({ login }: { login: string }) {
  const initials = login
    .split(/[.\-_]/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span className="avatar" title={login}>
      {initials}
    </span>
  );
}

export function DiffStat({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <span className="mono">
      <span style={{ color: 'var(--pass-text)' }}>+{additions}</span>{' '}
      <span style={{ color: 'var(--fail-text)' }}>−{deletions}</span>
    </span>
  );
}
