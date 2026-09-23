# Git Sentinel

A dashboard for GitHub Actions health and review load across 10+ repositories.
React 19, TypeScript, Vite. No component library, no CSS framework.

## What the project is for

A red/green grid does not catch the failure that actually hurts: a workflow that
**stops running** has no red run to show, so its last recorded run is usually
green. Everything here sorts by *how long something has been wrong*, and
"stale" is a first-class state alongside "failing".

Keep that idea intact. A change that reorders the fleet view alphabetically, or
that collapses `stale` into `failing`, defeats the point of the tool.

The one thing ranked above age is a red **required check**: it stops every pull
request in its repository, so the fleet view puts merge blockers first.

## File names

Lowercase kebab-case, components included. `status-strip.tsx` exports
`StatusStrip`; `use-dashboard-data.ts` exports `useDashboardData`. The file name
and the export name are independent — do not rename exports to match files.

Enforced by `unicorn/filename-case` in `.oxlintrc.json`. macOS and Windows treat
`Card.tsx` and `card.tsx` as one file while Git treats them as two, so a
case-only rename can land in the index twice and break Linux and CI.

## Layers

Dependencies point one way: `app` → `screens` → `lib/ui` and `lib/domain`.

- `src/lib/domain/` — pure logic. No React, no `fetch`, no DOM. Triage rules,
  review grouping, formatting.
- `src/lib/ui/` — presentational components. Must not import from `screens/`,
  `app/`, or `lib/github/`.
- `src/lib/github/` — API access only. Map GitHub's response shapes onto domain
  types at this boundary; nothing above this layer sees a raw API response.
- `src/lib/hooks/` — React state and effects joining the two.
- `src/screens/` — composition only. A screen growing its own logic is a signal
  that the logic belongs in `domain/`.
- `src/app/` — shell and chrome.

`import/no-cycle` is an error. Import from the barrels (`../lib/ui`,
`../lib/domain`), not from individual files across layers.

## Colour

Colour carries meaning and never decoration. Components take a `Tone`
(`pass | fail | stale | flaky | running | neutral`) from `src/lib/ui/tone.ts`.
Never write a hex value or a `var(--...)` colour inside a component — add or
reuse a tone instead. Adding a tone means adding a meaning, so it is rare.

## Secrets

`GITHUB_TOKEN` deliberately has no `VITE_` prefix. That prefix inlines a value
into the client bundle where any script on the page can read it. The token is
read in `vite.config.ts` and attached server-side by the `/gh` proxy.

Never move a credential into a `VITE_`-prefixed variable, and never call
`api.github.com` directly from client code — go through `/gh`.

## Style

- Functional components, no classes. Hooks at the top level only.
- `type` imports use `import type`.
- Prefer non-mutating array methods: `toSorted`, `toReversed` (lib is ES2023).
- Explain *why* in comments, not *what*. The thresholds in `triage.ts` are
  judgement calls and are commented as such; plain restatements of the code are
  not wanted.
- Real `<button>`, `<a href>`, `<label>`. Never `onClick` on a `div`. Icon-only
  controls need `aria-label`.
- Empty states say what being empty means — an empty review queue is good news
  and should read like it.

## Tests

Vitest, colocated as `*.test.ts` beside the file under test. Shared factories
live in `src/test/fixtures.ts`; every test runs at its fixed `NOW` so relative
times are stable. Domain tests call the functions directly; GitHub-layer tests
mock `./client` and assert on the mapping and on which requests are made — the
request count is part of the behaviour, given the rate limits.

## Before you finish

```bash
npm run lint       # oxlint; warnings are failures
npm run typecheck  # tsc -b
npm test           # vitest run
```

Both run on pre-commit via husky and lint-staged. If a lint rule is wrong for
this codebase, turn it off in `.oxlintrc.json` and record the reason in the
README rather than scattering inline suppressions.

