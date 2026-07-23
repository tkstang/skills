---
title: 'Conventions'
description: 'Repository conventions: shipped skills run with no install step, dev tooling may take pnpm dependencies, generated-runtime discipline, skill version-bump-on-edit, and worktree init/validate.'
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

## Generated-runtime discipline

Generated runtime outputs come from canonical TypeScript source under `src/`. Edit
the canonical TypeScript source, run `pnpm run build` to regenerate committed
`.mjs` runtime output under `plugins/` and `skills/`, and use
`pnpm run build:check` or `tests/tooling/generated-output-sync.test.ts` to catch
drift. `pnpm run sync:transcript-core` is a compatibility wrapper around the same
generated-output build. Never hand-edit generated `.mjs` outputs with a
`// GENERATED` banner.

## Skill version-bump-on-edit

When you ship a behavior or content change to a shipped skill, bump that skill's
`version`. Keep the top-level `version` and `metadata.version` in sync — the
skills validator (`scripts/validate.mjs`) requires them to match when both are
present. The release version-bump tooling derives the skill list from disk via
`scripts/lib/discover-skills.mjs` (shared with the validators), so new skills are
picked up automatically — no manual list to maintain. Do not hand-edit one field
and leave the other stale.

Changed skills must bump their version. Any change under a canonical skill
directory (`skills/<name>/` or `plugins/*/skills/<name>/`) — `SKILL.md`,
`scripts/`, `references/`, or generated output — requires that skill's `SKILL.md`
version to increase. This is enforced by `scripts/validate-skill-versions.mjs`
(run `pnpm run validate:skill-versions -- --base-ref <ref>`), wired into the
PR-only `skill-versions` CI job and the local `pre-push` hook. Only
`.agents/skills/`, `.claude/skills/`, and `.cursor/skills/` are synced mirrors;
never treat them as canonical sources.

## Worktrees

After `git worktree add`, run `pnpm run worktree:init` in the new worktree to copy
local-only files (env, `.oat/config.local.json`, local/archived projects, MCP
configs), sync OAT local paths, install dependencies, and refresh provider views.

Run `pnpm run worktree:validate` for a full pre-merge check: it asserts a clean
tree, runs `test` + `validate` + `smoke`, and re-asserts cleanliness (catching
generated-file drift).
