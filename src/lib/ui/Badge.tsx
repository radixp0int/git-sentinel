import type { ReactNode } from 'react';
import { TONE, type Tone } from './tone';

/**
 * A small status word. Replaces the five hand-rolled pill styles that were
 * scattered across the screens; pass a tone rather than colours.
 */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { fg, bg } = TONE[tone];
  return (
    <span className="chip" style={{ color: fg, background: bg }}>
      {children}
    </span>
  );
}
