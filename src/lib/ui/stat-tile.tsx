import type { ReactNode } from 'react';
import { TONE, type Tone } from './tone';
import { Dot } from './dot';

/**
 * A count with a label and a line of context.
 *
 * `emphasis` fills the tile with its tone instead of just colouring the label —
 * reserved for counts that should pull the eye before anything else on the page.
 */
export function StatTile({
  label,
  value,
  note,
  tone = 'neutral',
  emphasis = false,
  icon,
}: {
  label: string;
  value: number;
  note: ReactNode;
  tone?: Tone;
  emphasis?: boolean;
  icon?: ReactNode;
}) {
  const vars = TONE[tone];

  return (
    <div
      className="tile"
      style={emphasis ? { background: vars.surface, borderColor: vars.line } : undefined}
    >
      <div className="tile-label" style={emphasis ? { color: vars.fg } : undefined}>
        {icon ?? <Dot tone={tone} small />}
        {label}
      </div>
      <div className="tile-value" style={emphasis ? { color: vars.fg } : undefined}>
        {value}
      </div>
      <div className="tile-note" style={emphasis ? { color: vars.body } : undefined}>
        {note}
      </div>
    </div>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="tiles">{children}</div>;
}
