# Sentinel

A dashboard for watching GitHub Actions and review load across a fleet of repositories.

Built around one observation: a red/green grid does not catch the failure that
actually hurts. A workflow that **stops running** has no red run to show — its last
recorded run is usually green. So Sentinel sorts by *how long something has been
wrong* and treats "stale" as its own state, separate from "failing".

## Running it

```bash
npm install && npm run dev
```

Opens on <http://localhost:5273> with sample data.

To point it at real repositories, copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

| Variable | Notes |
| --- | --- |
| `GITHUB_TOKEN` | Read server-side only. Needs `repo`, `read:org`, and `workflow`. |
| `GITHUB_API_BASE` | `https://api.github.com`, or `https://your-ghe-host/api/v3` for Enterprise Server. |
| `VITE_GITHUB_REPOS` | Comma-separated `owner/repo` list. |
| `VITE_GITHUB_ORG` | Display name in the top rail. |

Restart the dev server after editing `.env.local`.

### Why the token has no `VITE_` prefix

Anything prefixed `VITE_` is inlined into the client bundle and readable by whatever
runs on the page. `GITHUB_TOKEN` is read by a dev-server middleware in
[`vite.config.ts`](vite.config.ts) that proxies `/gh/*` to GitHub with the
`Authorization` header attached. The browser never holds the credential.

**This matters if you deploy it.** `npm run build` produces static assets with no
proxy behind them, so a deployed copy has nothing to attach the token. Put the same
forwarding in front of the built assets before hosting this anywhere.

## Triage rules

All of it lives in [`src/lib/domain/triage.ts`](src/lib/domain/triage.ts) as pure functions, so the
thresholds are one edit away and the logic is testable without the API.

| State | Rule | Constant |
| --- | --- | --- |
| `silent` | Failing 3+ days. Ranked above everything but merge blockers. | `SILENT_AFTER_DAYS` |
| `stale` | No run in 2+ expected windows, or workflow disabled. | `STALE_MISSED_WINDOWS` |
| `failing` | Failing, but recently. | — |
| `flaky` | Passing now, but >20% of the window failed. | `FLAKY_THRESHOLD` |
| `healthy` | Green across the window. | `WINDOW` |

Cadence comes from the workflow's `cron:` when it has one, otherwise from the median
gap between its past runs — which also catches push-triggered workflows that have
gone quiet.

### Where it breaks

For a failing workflow, the jobs of the newest three runs in its failure streak
(`FAILURE_SAMPLE`) are looked up to find the failing step. The same step every
time points at the code; a different step each time points at something shared —
a runner, a registry, a secret — and the *Common failure points* card groups
failing steps across the fleet to make that visible. A finished attempt's jobs
never change, so each is fetched once and cached.

### Merge gates

Each repository's required checks are read from branch protection and, on GHE
3.9+, rulesets. A workflow whose failing job is a required check is badged
**BLOCKS MERGES** and sorted to the top: nothing in that repository can merge
until it is green. If the rules cannot be read the card says so rather than
claiming nothing is required.

## Reviews

One GraphQL search per bucket, including each PR's check rollup so PRs whose checks
are red get *parked* rather than shown as actionable.

The wait is counted from when your review was **requested**, read from the PR's
timeline, not from when the PR was opened — a PR opened a month ago and assigned
to you this morning is new work. When you were asked through a team, the card
shows which. If several of your teams are pending, the longest-waiting request is
used: finding your actual team would cost a membership query per team.

### Your open pull requests

One more search (`author:@me`, drafts excluded) splits your own PRs by whose move
it is: red checks, an unanswered change request, or an approval waiting to be
merged are yours; everything else is waiting on reviewers, oldest first.

The queue uses `user-review-requested:@me` rather than `review-requested:@me`, because
the former includes PRs routed to you through a team — on Enterprise, usually most of
them.

Two version floors to check on GHE Server: `user-review-requested` needs 3.4+, and
`statusCheckRollup` needs 3.2+.

## Layout

Everything reusable lives under `src/lib/`. Screens compose it; they own no
styling or logic of their own.

```
src/
  lib/
    ui/          Presentational components. Nothing here imports a screen.
      tone.ts    The colour system — see below
    domain/      types, triage, reviews, format. Pure, no React, no fetch.
    github/      client (transport) + workflows + reviews
    hooks/       use-dashboard-data — loading, polling, sample-data fallback
    mock/        Sample fleet
  screens/       Fleet, Reviews
  app/           App shell and top rail
  styles/        tokens.css (palette and type), app.css
```

### Tone

`lib/ui/tone.ts` is the one place colour is decided. A component takes a
`Tone` (`pass | fail | stale | flaky | running | neutral`), never a hex or a CSS
variable, and the tone map resolves it to text, chip, border, surface and solid
values.

Triage states and check conclusions each map to a tone, so a workflow broken
nine days and a pull request waiting nine days render identically loud without
either screen knowing about the other.

Adding a sixth tone means adding a sixth *meaning*. Colour is never decorative
here.

## Conventions

File names are **lowercase kebab-case**, components included:
`status-strip.tsx` exports `StatusStrip`. Enforced by
`unicorn/filename-case` in `.oxlintrc.json`, so a PascalCase file fails the
pre-commit hook rather than merely being frowned at.

The reason is case-insensitive filesystems: macOS and Windows treat `Card.tsx`
and `card.tsx` as the same file while Git does not, so a casual case-only
rename lands in the index as two files and breaks Linux and CI. Staying
lowercase avoids the class of problem.

The rest of the conventions — layer boundaries, the colour rule, and where
secrets may not go — live in
[.github/copilot-instructions.md](.github/copilot-instructions.md), with
folder-scoped rules in `.github/instructions/`. That is the single source of
truth for both Copilot and Claude Code; `CLAUDE.md` only points at it.

## Tooling

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on :5273 |
| `npm run lint` | oxlint, warnings are failures |
| `npm run lint:fix` | oxlint with autofix |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watching |
| `npm run build` | Typecheck then bundle |

A husky `pre-commit` hook runs lint-staged (`oxlint --fix --deny-warnings` on
staged `.ts`/`.tsx`) followed by a full typecheck.

Three lint rules are switched off in `.oxlintrc.json`, each for a reason:

- `react/react-in-jsx-scope` — obsolete under the modern JSX transform.
- `import/no-unassigned-import` — CSS side-effect imports are how Vite works.
- `react/no-array-index-key` — the only index keys are fixed positional slots
  (status bars, metadata separators) with no stable id to use instead.

## Not built yet

- **Alerting.** The dashboard is a backstop; it only helps when you look at it. The
  rules screen is designed but not implemented, and sending anywhere (Slack, email)
  needs a process that runs without a browser open.
- Run detail view — failure logs and re-run. The failing step is shown; the log is not.
- The compact always-on panel.
