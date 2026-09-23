import { CONCLUSION_TONE, TONE } from './tone';
import type { Conclusion, WorkflowRun } from '../domain/types';

/**
 * Run history, oldest on the left.
 *
 * Slots with no run are drawn as empty placeholders rather than dropped, so a
 * workflow that has stopped running reads as a strip trailing off into nothing
 * instead of a short strip of green.
 */
export function StatusStrip({
  runs,
  slots = 14,
  small = false,
}: {
  runs: WorkflowRun[];
  slots?: number;
  small?: boolean;
}) {
  const recent = runs.slice(0, slots);
  const missing: Conclusion[] = Array.from(
    { length: Math.max(0, slots - recent.length) },
    () => 'missing',
  );
  const bars: Conclusion[] = [...missing, ...recent.map((run) => run.conclusion).toReversed()];

  return (
    <div className={`strip${small ? ' strip-sm' : ''}`} aria-label={`Last ${slots} runs`}>
      {bars.map((conclusion, i) => (
        <span
          key={i}
          className="strip-bar"
          style={{
            background:
              conclusion === 'missing'
                ? 'var(--line)'
                : TONE[CONCLUSION_TONE[conclusion]].solid,
          }}
        />
      ))}
    </div>
  );
}
