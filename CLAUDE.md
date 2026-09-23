# Git Sentinel — project conventions

## File names

**All file names are lowercase kebab-case.** No exceptions for React components.

```
src/lib/ui/status-strip.tsx     not StatusStrip.tsx
src/lib/hooks/use-dashboard-data.ts   not useDashboardData.ts
src/screens/fleet.tsx           not Fleet.tsx
```

The file name and the export name are separate things: `status-strip.tsx`
exports `StatusStrip`, and `use-dashboard-data.ts` exports `useDashboardData`.
Components and hooks keep their usual PascalCase and camelCase identifiers.

This is enforced, not just documented — `unicorn/filename-case` is set to
`kebabCase` in `.oxlintrc.json` and `npm run lint` treats warnings as failures,
so a PascalCase file fails the pre-commit hook.

The reason is macOS and Windows: their filesystems are case-insensitive but Git
is not, so a `Card.tsx` → `card.tsx` rename made casually on a Mac lands in the
index as two files and breaks the build for everyone on Linux and in CI. Staying
lowercase means the question never comes up.

Applies to directories too (`src/lib/ui/`, not `src/lib/UI/`).

## Where code goes

- `src/lib/domain/` — pure logic. No React, no `fetch`, no DOM. Triage rules,
  review grouping, formatting.
- `src/lib/ui/` — presentational components. Never imports from `screens/` or
  `app/`.
- `src/lib/github/` — API access only. Maps GitHub's shapes onto domain types at
  the boundary so nothing above this layer sees a raw API response.
- `src/lib/hooks/` — React state and effects that tie the two together.
- `src/screens/` — composition only. A screen that grows its own logic means
  that logic belongs in `domain/`.
- `src/app/` — shell and chrome.

## Colour

Colour carries meaning and never decoration. Components take a `Tone`
(`pass | fail | stale | flaky | running | neutral`) from `src/lib/ui/tone.ts`,
never a hex value or a CSS variable. Adding a tone means adding a meaning.

## Secrets

`GITHUB_TOKEN` has no `VITE_` prefix on purpose — that prefix inlines a value
into the client bundle. Anything secret is read in `vite.config.ts` and attached
server-side. Never move a credential into a `VITE_`-prefixed variable.

## Checks

`npm run lint` (warnings are failures) and `npm run typecheck` both run on
pre-commit via husky and lint-staged. If a lint rule is wrong for this codebase,
turn it off in `.oxlintrc.json` with a reason in the README rather than
scattering inline suppressions.
