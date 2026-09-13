---
oat_generated: true
oat_generated_at: 2026-08-31
oat_source_head_sha: ae313c5bb6e54d521b4b00d0f44993b8fdf72ecc
oat_source_main_merge_base_sha: 467efe57bcb5e40b2cfb09c77507aa50e4c1cc44
oat_index_type: full
---

# skills

## Overview

This repository ships dependency-free agent skills and the Consensus plugin across
Codex, Claude Code, and Cursor provider surfaces. Canonical authored content lives
under `skills/`, `plugins/`, and `src/`; provider mirrors and generated runtime
modules are derived artifacts. The documentation site is the complete user and
engineering reference, while `.oat/` contains project-lifecycle and repository
management records.

## Quick Orientation

- Runtime: Node.js 22 or newer.
- Package manager: pnpm, pinned by `packageManager` in `package.json`.
- Tests: Vitest through `pnpm run test` or `pnpm run test:vitest`.
- Required repository gates: `pnpm run build:check`, `npm run validate`, and
  `npm run smoke`.
- Canonical generated-runtime source: `src/`, mapped by
  `scripts/build-generated.mjs` into committed `.mjs` files under public skills
  and plugins.
- Public standalone skills: canonical directories under `skills/`; provider
  mirrors under `.agents/skills`, `.claude/skills`, and `.cursor/skills` are sync
  outputs, not editing surfaces.

## Architecture at a Glance

The codebase has three primary product surfaces:

1. Standalone skills package instructions, dependency-free runtimes, and tests.
2. The Consensus plugin coordinates provider CLIs through a structured execution
   and transcript-observation pipeline.
3. Shared transcript infrastructure discovers sessions, extracts provider records,
   normalizes entries, sanitizes content, and renders safe derived output for
   session-observer and export-session-transcript.

Provider CLI subprocesses are the intentional external execution boundary. Runtime
code otherwise uses Node standard-library APIs. Generated output must be changed at
its TypeScript source and rebuilt; files carrying a generated banner must never be
hand-edited.

## Key Entry Points

- `documentation/docs/index.md` — product documentation root.
- `documentation/docs/user-guide/skills/index.md` — standalone-skill catalog.
- `documentation/docs/engineering/architecture/index.md` — system architecture.
- `src/consensus/provider-cli/cli.ts` — provider execution abstraction.
- `src/transcript/core/` — shared transcript discovery and normalization.
- `src/transcript/export-session/` — privacy-safe export and sanitization.
- `skills/session-observer/` — public session inspection skill and generated runtime.
- `skills/export-session-transcript/` — public transcript export skill and generated runtime.
- `scripts/build-generated.mjs` — canonical-to-runtime generation map.
- `scripts/validate.mjs` — repository structure and manifest validation.
- `.oat/repo/pjm/backlog/index.md` — local product backlog.

## Where to Add Code

- New public standalone skill: `skills/<skill-name>/SKILL.md`, with any canonical
  runtime implementation under `src/` and a generated mapping in
  `scripts/build-generated.mjs`.
- Shared transcript behavior: `src/transcript/core/`, with focused tests under
  `tests/transcript-core/` and consumer tests under the relevant skill suite.
- User documentation: `documentation/docs/user-guide/`; update the directory
  `meta.json` and regenerate `documentation/index.md`.
- Repository validation: `tests/repo/`, `tests/tooling/`, and `scripts/validate.mjs`.

## Non-Negotiable Conventions

- Keep shipped runtime dependency-free.
- Bump the skill version for every change beneath a canonical skill directory;
  keep top-level `version` and `metadata.version` equal.
- Do not edit provider mirrors or generated `.mjs` output by hand.
- Use structured argv arrays for subprocesses and avoid shell interpolation.
- Treat transcript content as sensitive: sanitize before rendering or export and
  avoid recording secrets in diagnostics.
- Preserve unrelated user changes and keep Git, publishing, and provider-store
  mutations explicit.

## Testing Strategy

Vitest suites are organized by feature and repository contract. Unit tests cover
provider parsing, transcript discovery, sanitization, rendering, and state logic;
repository tests guard public skill inventories, release versioning, generated
output sync, documentation navigation, and internal/public visibility. Mocked smoke
tests validate the Consensus wrapper end to end. Live-provider tests are opt-in and
spend real quota.

For a new standalone runtime skill, add focused unit and CLI tests, extend public
inventory and release-version fixtures, run the relevant suites while iterating,
then run the full build, validation, test, and smoke gates before closeout.

## Important Risks

- Transcript discovery differs materially across providers and may include caches,
  archived stores, and unstable metadata shapes.
- Session recency is evidence, not proof that an active writer has stopped.
- Provider CLI help and resume/fork contracts can drift independently of this repo.
- Generated source and committed runtime output can silently diverge if the build
  mapping or static-tool exclusions are incomplete.
- Synced provider mirrors can look canonical; editing them directly creates drift.
- Full-suite and provider-backed tests can be resource-intensive, so a timeout is
  not equivalent to a pass.

## Detailed Knowledge Map

- [stack.md](stack.md) — languages, runtime, dependencies, and configuration.
- [architecture.md](architecture.md) — layers, data flow, abstractions, and errors.
- [structure.md](structure.md) — directory purposes and code placement.
- [integrations.md](integrations.md) — provider CLIs, storage, CI, and external boundaries.
- [testing.md](testing.md) — suites, fixtures, mocking, and verification patterns.
- [conventions.md](conventions.md) — naming, imports, functions, logging, and module design.
- [concerns.md](concerns.md) — security, fragility, scaling limits, debt, and coverage gaps.
