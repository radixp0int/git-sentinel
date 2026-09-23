import { TONE, type Tone } from './tone';

export function Dot({ tone, small = false }: { tone: Tone; small?: boolean }) {
  return (
    <span
      className={`dot${small ? ' dot-sm' : ''}`}
      style={{ background: TONE[tone].solid }}
    />
  );
}
