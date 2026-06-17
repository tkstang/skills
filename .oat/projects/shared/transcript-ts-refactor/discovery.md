---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-06-17
oat_generated: false
---

# Discovery: transcript-ts-refactor

## Initial Request

Continue the TypeScript/Vitest migration after PR #14 merged the
consensus-refine TypeScript migration. This project migrates shared
transcript-core and export-session-transcript to the post-PR #14 generated
runtime pattern:

- canonical TypeScript source lives under `src/`
- committed generated `.mjs` output remains under the shipped skill paths
- `scripts/build-generated.mjs --check` catches generated-output drift
- import rewrites apply only to emitted module specifiers
- shipped skills remain dependency-free and runnable from committed `.mjs`
  files

The work starts from latest `main`; this worktree was verified at commit
`1095718`, matching `origin/main` and `FETCH_HEAD`, after fetching
`origin main`.

## Request Classification

Well-understood. The source/distribution split and build-time import rewrite
mechanism are already established by PR #14. The main remaining planning choice
is how to handle the legacy transcript-core sync script without leaving a
second source of truth.

## Chosen Direction

Use the PR #14 generated-runtime mechanism for all in-scope transcript outputs.
Move transcript-core and export-session-transcript canonical sources into
`src/transcript/`, extend `scripts/build-generated.mjs` with the new mappings,
and generate the existing shipped `.mjs` files in place.

Preserve `pnpm run sync:transcript-core` as a compatibility wrapper around the
new generated-output mechanism rather than keeping the old
`shared/transcript-core/runtimes.mjs` source path. This keeps existing operator
muscle memory working while avoiding a second generation path.

## Options Considered

### Retire `sync-transcript-core` entirely

This would remove the old command and force every transcript-core update
through `pnpm run build` / `pnpm run build:check`.

**Tradeoff:** It is clean, but it breaks existing docs, habits, and any local
automation that still invokes `pnpm run sync:transcript-core`.

### Preserve `sync-transcript-core` as a compatibility wrapper

The command remains, but it delegates to `scripts/build-generated.mjs`, passing
through `--check` when present.

**Chosen:** Yes. This honors the preference to avoid a second generation path
while minimizing disruption.

## Key Decisions

1. **Transcript-core source:** Move the canonical source from
   `shared/transcript-core/runtimes.mjs` to
   `src/transcript/core/runtimes.ts`.
2. **Transcript-core outputs:** Generate committed runtime copies to both
   existing consumers:
   `skills/session-observer/scripts/lib/runtimes.mjs` and
   `skills/export-session-transcript/scripts/lib/runtimes.mjs`.
3. **Export source:** Move export-session-transcript canonical source to
   `src/transcript/export-session/export-session-transcript.ts` and
   `src/transcript/export-session/sanitize.ts`.
4. **Export outputs:** Keep shipped generated output at
   `skills/export-session-transcript/scripts/export-session-transcript.mjs`
   and `skills/export-session-transcript/scripts/lib/sanitize.mjs`.
5. **Import rewrites:** TypeScript source may import canonical source
   specifiers such as `../core/runtimes.js` and `./sanitize.js`; generated
   shipped output must import local runtime files such as
   `./lib/runtimes.mjs` and `./lib/sanitize.mjs`.
6. **Tests:** Migrate only in-scope transcript-core and export-session tests to
   Vitest `.test.ts`, while keeping export CLI tests pointed at the generated
   shipped `.mjs` entrypoint.

## Constraints

- Do not migrate session-observer implementation modules in this project.
- Do not migrate session-observer tests except for changes required to keep
  the generated transcript-core copy green.
- Do not remove the Node test runner; unrelated `.test.mjs` suites remain.
- Do not implement consensus-evaluate.
- Do not add runtime dependencies to shipped skills.
- Do not hand-edit generated `.mjs` outputs except through the build command.
- Keep runtime plugin and standalone skill code dependency-free; TypeScript,
  Vitest, and esbuild remain developer tooling only.
- Preserve export-session CLI behavior and exit codes.

## Success Criteria

- Transcript-core has canonical TypeScript source under `src/transcript/core/`.
- Export-session-transcript has canonical TypeScript source under
  `src/transcript/export-session/`.
- Generated `.mjs` outputs are committed and carry the
  `scripts/build-generated.mjs` generated banner.
- `pnpm run build:check` catches drift for transcript-core and export-session
  generated outputs.
- Export-session CLI behavior and exit codes are unchanged.
- Session-observer continues to work with its generated transcript-core copy.
- `shared/transcript-core/runtimes.mjs` is not left as a second source of truth;
  the old shared docs are removed or replaced with a pointer.
- Relevant docs, AGENTS guidance, repo reference docs, and decision records no
  longer describe the old sync contract as canonical.

## Out of Scope

- Migrating session-observer implementation modules to TypeScript.
- Migrating session-observer test suites to Vitest.
- Retiring the Node test runner globally.
- Implementing consensus-evaluate.
- Adding runtime dependencies or requiring users to install packages before
  running shipped skills.

## Verification Required

Final implementation verification must run:

- `pnpm run build`
- `pnpm run type-check`
- `pnpm run build:check`
- `pnpm run test`
- `pnpm run validate`
- `pnpm run smoke`

## Risks

- **Import path regression:** Generated export-session output could import
  canonical `src/` paths instead of shipped local `.mjs` files.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Use explicit `importRewrites` mappings and add generated
    import-path tests.
- **Second source of truth:** Keeping `sync-transcript-core` unchanged would
  preserve `shared/transcript-core/runtimes.mjs` as canonical.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Convert the script to a wrapper and update docs/reference
    material.
- **CLI behavior drift:** TypeScript migration could accidentally change
  output naming, session selection, sanitization, or exit codes.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Keep CLI tests pointed at the generated `.mjs` entrypoint
    and migrate those tests with behavior parity.

## Next Steps

Generate the quick-mode implementation plan and execute it with
`oat-project-implement`.
