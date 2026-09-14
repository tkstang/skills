---
title: 'Conventions'
description: 'Repository conventions: canonical skill owners, generated distributions, dependency-free runtime, metadata.version bumps, and worktree checks.'
---

# Conventions

## Shipped skills run with no install step

Keep runtime plugin code dependency-free and use Node standard library APIs unless
a future project explicitly changes that contract. This applies to **shipped**
skills/plugins, which must run with no install step; provider CLI subprocesses are
the only external execution boundary.

## Dev tooling may take dependencies

**Developer tooling** (git hooks, commit linting, future formatters) may take
dependencies. Developer dependencies use **pnpm** (`packageManager` is pinned in
`package.json`; `pnpm-lock.yaml` is committed). Install with `pnpm install`; CI
runs `pnpm install --frozen-lockfile`. Never add runtime dependencies to shipped
skills.

## Canonical skill ownership and generated distributions

Every product skill is authored under `src/skills/<canonical-name>/`, including
its instruction file, resources, runtime source, and skill-owned tests.
`src/distributions.ts` declares which owners produce standalone output and which
plugins expose them under local names. Prompt-only skills need no empty runtime
or build manifest.

Run `pnpm run build` to regenerate complete committed installation units under
`plugins/` and `skills/`, and use `pnpm run build:check` or
`tests/tooling/generated-output-sync.test.ts` to catch inventory, content, and
mode drift. `pnpm run sync:transcript-core` is a compatibility wrapper around
the same build. Never hand-edit generated instructions, resources, schemas, or
`.mjs` outputs.

Shared runtime imports are materialized into every installation unit that needs
them. A genuine workflow dependency is declared separately, checked before use,
and never auto-installed.

## Skill version-bump-on-edit

When you ship a behavior or content change to a skill, bump the quoted stable
SemVer at `metadata.version` in its canonical `src/skills/<name>/SKILL.md`.
That is the sole authored skill version; top-level `version` is rejected. Every
generated form inherits it. Plugin release versions are independent.

Changed skills must bump their version. Any change under a canonical skill
directory (`src/skills/<name>/`) — `SKILL.md`, runtime source, tests,
references/assets, or build declaration — requires that skill's
`metadata.version` to increase. This is enforced by
`scripts/validate-skill-versions.ts`
(run `pnpm run validate:skill-versions -- --base-ref <ref>`), wired into the
PR-only `skill-versions` CI job and the local `pre-push` hook. Only
`skills/`, `plugins/*/skills/`, `.agents/skills/`, `.claude/skills/`, and
`.cursor/skills/` are generated payloads or mirrors; never treat them as
canonical sources.

The guard also attributes changes through declared source roots and generated
outputs. This fan-out is deliberately conservative rather than an exact
per-import graph:

| Changed surface                                                     | Version impact                                                                                                                         |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/skills/<owner>/`, including tests, resources, and `build.json` | Bump that canonical owner's `metadata.version`.                                                                                        |
| A declared shared or allowed source root                            | Bump every declaration that lists that root. For example, a `src/shared/transcript/` change affects each declared transcript consumer. |
| A declared generated output                                         | Bump its canonical owner; never fix the output directly.                                                                               |
| Plugin-shared `scripts/`, `agents/`, or `references/` output        | Conservatively bump every owner distributed through that plugin.                                                                       |
| Provider or marketplace release metadata only                       | Follow that plugin's independent release version; it does not by itself rewrite member skill versions.                                 |
| Clean-break rename                                                  | The current owner is compared with the historical owner mapping; no legacy payload is emitted.                                         |

Always pass an explicit resolvable base to the validation command. Missing or
shallow history fails closed instead of fetching or silently skipping the
comparison.

## Worktrees

After `git worktree add`, run `pnpm run worktree:init` in the new worktree to copy
local-only files (env, `.oat/config.local.json`, local/archived projects, MCP
configs), sync OAT local paths, install dependencies, and refresh provider views.

Run `pnpm run worktree:validate` for a full pre-merge check: it asserts a clean
tree, runs `test` + `validate` + `smoke`, and re-asserts cleanliness (catching
generated-file drift).
