import type { ReactNode } from 'react';
import { WarningIcon } from './icons';
import { TONE, type Tone } from './tone';

export function Banner({
  tone = 'neutral',
  icon = true,
  children,
}: {
  tone?: Tone;
  icon?: boolean;
  children: ReactNode;
}) {
  const vars = TONE[tone];
  const plain = tone === 'neutral';

  return (
    <div
      className="banner"
      style={{
        background: plain ? 'var(--panel)' : vars.surface,
        border: `1px solid ${plain ? 'var(--line-strong)' : vars.line}`,
        color: plain ? 'var(--text-faint)' : vars.fg,
      }}
    >
      {icon && <WarningIcon color={plain ? 'var(--text-faint)' : vars.solid} />}
      <span>{children}</span>
    </div>
  );
}
