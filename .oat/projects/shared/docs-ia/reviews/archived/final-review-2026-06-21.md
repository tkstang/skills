---
oat_generated: true
oat_generated_at: 2026-06-21
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/docs-ia
---

# Code Review: final

**Reviewed:** 2026-06-21
**Scope:** Final code review of `fe86fc66680d3965569de88145d7911a08e5eff9..HEAD`
**Files reviewed:** 66
**Commits:** 15

## Summary

The docs site implementation is broadly aligned with the quick-mode goal: the Fumadocs app builds as a static export, the two-trunk IA exists, the README is slimmed, and the GitHub Pages workflow matches the expected nested-docs shape. The branch is not ready to merge because the full Vitest suite still asserts the old README-as-canonical-docs contract, and a changed TSX file fails the repo formatter check.

## Findings

### Critical

- **Full test suite still asserts the pre-migration README contract** (`tests/repo/docs-presence.test.ts:31`)
  - Issue: `pnpm test` fails 5 tests because `tests/repo/docs-presence.test.ts` and `tests/repo/readme-scope.test.ts` still require dense README sections that this project intentionally moved into `documentation/docs/`. The moved content exists in the new site, for example install details at `documentation/docs/user-guide/installation.md:17`, permissions at `documentation/docs/user-guide/consensus/configuration.md:74`, limitations at `documentation/docs/user-guide/consensus/index.md:65`, generated-runtime details at `documentation/docs/engineering/architecture/generated-runtime.md:6`, and iteration flags at `documentation/docs/user-guide/consensus/refine.md:30`. As written, CI will fail even though the product behavior is the planned README relocation.
  - Fix: Update the README-oriented repo tests to assert the new source of truth: keep only the intentionally retained README entry-point/install-matrix checks on `README.md`, and move the detailed permissions, limitations, generated-runtime, provider-readiness, and iteration-mode assertions to the corresponding docs pages. Then rerun `pnpm test`.
  - Requirement: README slim/no-info-loss migration and repo invariant verification.

### Important

- **Changed-file formatter check fails on the docs app layout** (`documentation/app/layout.tsx:11`)
  - Issue: Changed-file `oxfmt --check` reports `documentation/app/layout.tsx` as unformatted. This is not pre-existing repo-wide formatter debt; the failing file is introduced by this branch and would be caught by changed-file formatting gates.
  - Fix: Format `documentation/app/layout.tsx` with the repo formatter and rerun the changed-file `oxfmt --check` gate.

### Medium

None

### Minor

- **OAT project artifacts still contain pre-implementation placeholders and stale status text** (`.oat/projects/shared/docs-ia/state.md:49`)
  - Issue: The implementation itself is complete, but lifecycle artifacts still contain stale or placeholder content: `state.md` says the implementation artifact is "initialized" and the next milestone is to run `oat-project-implement` (`state.md:49`, `state.md:65`), while `implementation.md` still has placeholder phase summary/log/final-summary sections (`implementation.md:55`, `implementation.md:161`, `implementation.md:209`). This is artifact drift, not a docs-app code defect, but it can mislead PR generation and future project resume.
  - Suggestion: During receive-review/closeout, align `state.md` and `implementation.md` with the actual completed implementation and verification results.

## Requirements/Design Alignment

**Evidence sources used:** `.oat/projects/shared/docs-ia/discovery.md`, `.oat/projects/shared/docs-ia/design.md`, `.oat/projects/shared/docs-ia/plan.md`, `.oat/projects/shared/docs-ia/implementation.md`, `.oat/projects/shared/docs-ia/migration-map.md`, changed files in `fe86fc66680d3965569de88145d7911a08e5eff9..HEAD`, and the generated static export under `documentation/out/`.

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| Scaffold a Fumadocs docs app under the repo's Node/pnpm toolchain | implemented | `documentation/` builds successfully with Next/Fumadocs. |
| Migrate dense README content into a two-trunk User Guide + Engineering IA with no information loss | implemented | Page tree and migration map are present; moved content is covered by docs pages. |
| Slim README to an entry point while preserving the install matrix | partial | README shape matches the plan, but tests still enforce the old dense README contract. |
| Re-verify install/provider readiness without changing install commands | environment-limited | Provider inventory command succeeds; preflight returns `ok: true` and `usable: false` because Cursor reports local keychain auth required, which is already documented as environment state. |
| Add GitHub Pages deployment for the static docs export | implemented | `NEXT_PUBLIC_BASE_PATH=/skills pnpm run build` generates 28 HTML files, `_next` assets, and `documentation/out/api/search`; no unprefixed absolute `/...` links were found in exported HTML. |
| Keep repo validation/build invariants green | partial | `validate`, `build:check`, `type-check`, `smoke`, docs build, docs markdown format, changed-file oxlint, and `git diff --check` pass; `pnpm test` and changed-file `oxfmt --check` fail. |

### Extra Work (not in declared requirements)

- Phase 4 GitHub Pages deployment workflow was added mid-implementation at operator request and is recorded in the plan.

## Verification Commands

```bash
cd documentation && NEXT_PUBLIC_BASE_PATH=/skills pnpm run build
pnpm run validate
pnpm run build:check
pnpm run type-check
pnpm run smoke
cd documentation && pnpm run docs:format:check
pnpm test
git diff --check fe86fc66680d3965569de88145d7911a08e5eff9..HEAD
git diff --name-only fe86fc66680d3965569de88145d7911a08e5eff9..HEAD | rg '^(README\.md|documentation/.*\.(md|tsx|ts|js|mjs|json|css)$)' | xargs pnpm exec oxfmt --check
git diff --name-only fe86fc66680d3965569de88145d7911a08e5eff9..HEAD | rg '^documentation/.*\.(ts|tsx|js|mjs)$' | xargs pnpm exec oxlint
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json
```

Observed results:

- Passed: docs static build with `/skills`, `pnpm run validate`, `pnpm run build:check`, `pnpm run type-check`, `pnpm run smoke`, docs markdown format check, changed-file oxlint, `git diff --check`, provider inventory.
- Failed: `pnpm test` (5 failures in README-oriented tests), changed-file `oxfmt --check` (`documentation/app/layout.tsx`).
- Environment-limited: provider preflight returned `ok: true`, `usable: false` because Cursor reported `auth_required` from a locked macOS keychain.

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
