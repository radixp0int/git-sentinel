---
applyTo: "src/lib/domain/**/*.ts"
---

# Domain layer

Pure logic. This layer must stay free of React, `fetch`, the DOM, and anything
Vite-specific — it is the part that could be lifted into a CLI or a scheduled
job that sends alerts without a browser open, which is the planned next step.

- Export plain functions. No hooks, no components, no module-level mutable
  state.
- Take `now: Date = new Date()` as a parameter wherever time matters, rather
  than reading the clock inside. Every classification function does this so it
  can be tested at a fixed instant.
- Thresholds are named exported constants (`SILENT_AFTER_DAYS`,
  `FLAKY_THRESHOLD`, `STALE_MISSED_WINDOWS`, `WINDOW`), never inline numbers.
  They are judgement calls and people will want to tune them.
- Use non-mutating array methods (`toSorted`, `toReversed`). Callers pass arrays
  they still own.

## Triage ordering

`TRIAGE_ORDER` in `types.ts` is the severity ranking, and `silent` sits above
`failing` on purpose: a failure nobody has looked at for weeks is worse than one
that broke an hour ago. Sorting is severity first, then longest-wrong first.

Staleness is checked **before** failure in `classify()`. Do not reorder those
checks — a workflow whose schedule stopped firing usually has a green last run,
so testing for failure first would classify it as healthy.

## Cadence

`expectedIntervalMs` prefers the workflow's `cron` and falls back to the median
gap between past runs. The fallback is the important half: it catches
push-triggered workflows that have gone quiet, which no cron parse would.

`approxCronIntervalMs` is deliberately approximate. It only needs to know
whether a run is overdue by a wide margin. Do not replace it with a full cron
parser unless something genuinely needs the next fire time.
