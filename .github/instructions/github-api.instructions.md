---
applyTo: "src/lib/github/**/*.ts"
---

# GitHub API layer

The only place that talks to GitHub, and the only place that knows GitHub's
response shapes.

## Transport

Every call goes through `rest()` or `graphql()` in `client.ts`, which hit the
`/gh` proxy defined in `vite.config.ts`. Never call `api.github.com` or a
GitHub Enterprise host directly from this layer — the token lives on the server
side and client code has no credential to send.

Do not read `GITHUB_TOKEN` here. It is intentionally not exposed to the bundle.

## Mapping

Convert to domain types before returning. Nothing outside this folder should see
`workflow_runs`, `nameWithOwner`, `statusCheckRollup`, or a raw snake_case
field. Keep the `Rest*` and `Gql*` interfaces local to the file that uses them.

Where the API cannot answer something, say so in a comment rather than
inventing precision — `reviewRequestedAt` falls back to PR creation time
because GitHub does not expose when the review was requested, and that is
written down at the assignment.

## Queries

Use `user-review-requested:@me`, not `review-requested:@me`. The former includes
pull requests routed through a team, which on Enterprise is most of them.

Fetch each PR's `statusCheckRollup` in the same GraphQL query as the PR list.
That rollup is what lets a PR with red checks be *parked* rather than shown as
actionable; fetching it per-PR over REST would multiply requests by the size of
the queue.

## Rate limits

Search is 30 requests/minute, separate from the 5,000/hour REST pool. Prefer one
GraphQL search over N REST calls when adding anything that spans repositories.

A repository costs roughly `4 + 2n` requests: repo metadata, the workflow list,
two for the merge gate, and runs plus the workflow file per workflow. Before
adding another per-workflow call, consider whether it can be batched or derived
from what is already fetched.

Jobs are looked up only for the newest `FAILURE_SAMPLE` runs of a workflow's
current failure streak, through the per-attempt endpoint, and cached by
`repo#run#attempt` for the life of the page — a finished attempt never changes,
so a failing workflow costs its lookups once, not on every poll.

Review requests come from `timelineItems(REVIEW_REQUESTED_EVENT)` inside the
existing searches, so the request time costs nothing extra. Your own pull
requests are one more search (`author:@me draft:false`).

## Enterprise Server

`GITHUB_API_BASE` ends in `/api/v3` for GHE, and the GraphQL endpoint is derived
from it in `vite.config.ts`. Two version floors worth remembering:
`user-review-requested` needs GHE 3.4+, `statusCheckRollup` needs 3.2+. Guard
new API surface the same way rather than assuming github.com behaviour.

Required checks are read from `GET /repos/{repo}/branches/{branch}` (classic
protection, read access) and `GET /repos/{repo}/rules/branches/{branch}`
(rulesets, GHE 3.9+). Either can fail; the gate is then `partial` or `none`,
and the UI says so rather than reporting nothing required. Do not switch to
`/branches/{branch}/protection` — it needs admin.
