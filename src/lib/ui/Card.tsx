import type { ReactNode } from 'react';

export function Card({
  title,
  aside,
  children,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card">
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <h3 className="card-title">{title}</h3>
          {aside && <span style={{ marginLeft: 'auto' }}>{aside}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export function CardNote({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: '0 0 12px',
        fontSize: 11.5,
        lineHeight: 1.55,
        color: 'var(--text-faint)',
      }}
    >
      {children}
    </p>
  );
}

export function SectionHead({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="section">{title}</h2>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <SectionHead title={title} hint={hint} />
      {children}
    </section>
  );
}
