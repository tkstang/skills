---
title: 'Hooks and safety'
description: 'Git hooks in this repo: install on pnpm install, pre-commit lint-staged (oxlint/oxfmt over staged files), skill version-bump enforcement, and the lint/format exclusions for generated, synced, and agent-instruction files.'
---

# Hooks and safety

## Git hooks

Hooks install automatically on `pnpm install`. Manage them with:

```bash
pnpm hooks:status
pnpm hooks:disable-all
```

Bypass a single commit with `git commit --no-verify`. Set `GIT_HOOKS=0` to skip
hook setup entirely (CI/Docker).

### Where each gate runs

The checks are six independent triggers, not a pipeline: no CI job declares `needs`, the pull-request-only jobs run in parallel with `validate`, and the docs deployment and live-provider workflows are separate.

```mermaid
flowchart TB
  subgraph commit["git commit"]
    direction TB
    C1["pre-commit: lint-staged"]
    C2["pre-commit: oat status"]
    C3["commit-msg: commitlint"]
    C1 --> C2 --> C3
  end
  subgraph push["git push"]
    direction TB
    P1["validate"]
    P2["build:check"]
    P3["type-check"]
    P4["validate:skill-versions"]
    P5["validate:internal-flags"]
    P6["No tests, no smoke"]
    P1 --> P2 --> P3 --> P4 --> P5 --> P6
  end
  subgraph pr["pull_request"]
    direction TB
    V["validate job"]
    J1["skill-versions"]
    J2["internal-flags"]
    J3["commitlint"]
    J4["lint: changed files only"]
    J5["Docs CI, documentation paths"]
    V --- J1
    V --- J2
    V --- J3
    V --- J4
    V --- J5
  end
  subgraph main["push to main"]
    direction TB
    M1["validate job only"]
    M2["Deploy Docs workflow"]
    M1 --- M2
  end
  subgraph dispatch["workflow_dispatch"]
    direction TB
    D1["Live E2E, dispatch-only"]
    D2["Deploy Docs, also dispatchable"]
    D1 --- D2
  end
  subgraph tag["tag consensus-v* / session-v*"]
    direction TB
    T1["build, then diff generated outputs"]
    T2["type-check, build:check, test"]
    T3["validate, smoke"]
    T4["Verify selected plugin version"]
    T1 --> T2 --> T3 --> T4
  end

  C3 ~~~ M1
  P6 ~~~ D1
  J5 ~~~ T1
```

_Mermaid updated 2026-09-16_

Scope of each trigger:

- These are independent triggers, not a pipeline. No job declares `needs:` in the [Validate workflow](https://github.com/tkstang/skills/blob/main/.github/workflows/validate.yml), so its four PR-only jobs run in parallel with `validate`, not downstream of it.
- The `validate` job itself runs on both `pull_request` and pushes to `main`.
- The pre-push hook runs validate, build:check, type-check and the two gates, and deliberately skips the test suite and smoke to stay fast.
- `oat status --scope project --hook` in pre-commit is non-blocking.
- Docs CI is PR-only and path-scoped.
- Deploy Docs is an independent workflow, **also** dispatchable on top of its push-to-`main` trigger. Live Provider E2E is the dispatch-**only** workflow, and nothing invokes it.
- The [Release workflow](https://github.com/tkstang/skills/blob/main/.github/workflows/release.yml) fires on `consensus-v*` / `session-v*` tags. It builds, asserts generated outputs are committed, reruns the static suite, and verifies the tag against the already-written manifests.

## Pre-commit: lint-staged

The `pre-commit` hook runs `lint-staged` over staged files only. JavaScript,
TypeScript, JSON, and Markdown are formatted with **oxfmt**; JavaScript and
TypeScript are also linted with **oxlint**. Config: `.oxlintrc.json`,
`.oxfmtrc.json`, and `.lintstagedrc.mjs`.

Adoption is **incremental**: the `pre-commit` hook runs `lint-staged` over staged
files only, and CI lints/format-checks only the files a PR changes. The repo has
not yet been formatted wholesale; a one-time repo-wide `oxfmt` is a planned
follow-up. Until then, do not run `pnpm format` across the whole tree in unrelated
PRs.

## Pre-push: skill version-bump enforcement

The pre-push hook runs `validate`, `build:check`, `type-check`, skill-version
validation, and internal-flag validation. Tests and smoke are intentionally
left to the full local check set and CI, not duplicated in this fast hook.

Changed skills must bump their version. Any change under a canonical skill
directory (`src/skills/<name>/`) requires that skill's quoted
`metadata.version` to increase. This is enforced by
`scripts/validate-skill-versions.ts`:

```bash
pnpm run validate:skill-versions -- --base-ref <ref>
```

It is wired into the PR-only `skill-versions` CI job and the local `pre-push`
hook. Shared roots, generated outputs, plugin-shared areas, and rename history
can affect more than the directly edited path; see the
[version-impact table](conventions.md#skill-version-bump-on-edit).

The same check also requires a changelog entry: when a canonical skill version or
a plugin release version changes, `CHANGELOG.md` must gain at least one new line
inside its `## [Unreleased]` section, so a version bump can never ship without
release notes. A release PR that moves the Unreleased entries under a new
`## [x.y.z] - date` heading satisfies the check through that new heading.

## Pre-push: OAT tooling internal-flag enforcement

The OAT tooling skills mirrored under `.agents/skills/**` must stay hidden from
`npx skills` discovery — the CLI honors `metadata.internal: true` in frontmatter
to drop a skill from normal discovery (it reappears only under
`INSTALL_INTERNAL_SKILLS=1`). Because those files are regenerated by
`oat tools update` / `oat sync`, the flag is re-applied by an idempotent script and
guarded by a gate rather than hand-edited:

- After refreshing tooling, re-stamp the flag: `pnpm tsx scripts/apply-internal-flags.ts`,
  then `oat sync`. The script is idempotent and skips the symlinked
  `session-observer` mirror (a canonical standalone skill that must stay publicly
  discoverable).
- The detector `scripts/validate-internal-flags.ts`:

  ```bash
  pnpm run validate:internal-flags
  ```

  is wired into the PR-only `internal-flags` CI job and the local `pre-push` hook,
  so a missing flag cannot merge to `main`. If it fails, run the apply script and
  re-commit the stamped files.

Do not add this flag to canonical or generated product skill payloads under
`src/skills/`, `skills/`, or `plugins/*/skills/`; those are intended public
entries. See DR-260627 for the rationale.

## Lint/format exclusions

Never lint/format generated, OAT-synced, or agent-instruction files: generated
installation outputs from `scripts/build-generated.ts`, `.agents/**`,
`.claude/rules/**`, `.cursor/rules/**`, and `AGENTS.md` / `CLAUDE.md` at every
level.

Format exclusions must stay in sync across `.oxfmtrc.json`, `.lintstagedrc.mjs`,
and the CI `oxfmt --check` step in `.github/workflows/validate.yml`; generated
`.mjs` lint exclusions must also stay in sync across `.oxlintrc.json`,
`.lintstagedrc.mjs`, and the CI `oxlint` step.

oxlint/oxfmt are **dev tooling** — they do not touch what shipped skills run.
