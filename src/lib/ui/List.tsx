import type { ReactNode } from 'react';

export function List({ children }: { children: ReactNode }) {
  return <div className="list">{children}</div>;
}

export function ListRow({ children }: { children: ReactNode }) {
  return <div className="list-row">{children}</div>;
}

export function ListHead({ children }: { children: ReactNode }) {
  return <div className="list-head">{children}</div>;
}

/** Fixed-width cell, right-aligned. Every table column in the app is one of these. */
export function Cell({
  width,
  align = 'right',
  muted = false,
  mono = false,
  children,
}: {
  width: number;
  align?: 'left' | 'right';
  muted?: boolean;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={mono ? 'mono' : undefined}
      style={{
        flexShrink: 0,
        width,
        textAlign: align,
        fontSize: 11.5,
        color: muted ? 'var(--text-faint)' : 'var(--text-dim)',
      }}
    >
      {children}
    </span>
  );
}

/**
 * Empty states say what being empty means, never just "no results" — an empty
 * review queue is good news and should read like it.
 */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
