# Git Sentinel

**The project conventions live in [.github/copilot-instructions.md](.github/copilot-instructions.md).
Read that file first and treat it as binding.** It is the single source of truth
for this repository: file naming, layer boundaries, the colour rule, and the
rule against `VITE_`-prefixed secrets.

This repository is worked on from GitHub Copilot as well as Claude Code, and the
Copilot workspace does not read `CLAUDE.md`. Keeping the conventions in one file
that both tools see is the only way they stay true. So:

- Changing a convention means editing `.github/copilot-instructions.md`, not
  this file.
- Do not copy its content here. A second copy is a second thing to go stale.

Folder-scoped rules live in `.github/instructions/*.instructions.md` and apply
to the paths named in each file's `applyTo` frontmatter:

| File | Applies to |
| --- | --- |
| `domain.instructions.md` | `src/lib/domain/**` |
| `ui.instructions.md` | `src/lib/ui/**` |
| `github-api.instructions.md` | `src/lib/github/**` |

Read the one that covers the files you are about to touch. Copilot loads these
automatically from the path glob; nothing loads them for you here.

## Checks

```bash
npm run lint       # oxlint; warnings are failures
npm run typecheck  # tsc -b
```

Run both before reporting work as done. They also run on pre-commit via husky
and lint-staged, so skipping them only moves the failure later.
