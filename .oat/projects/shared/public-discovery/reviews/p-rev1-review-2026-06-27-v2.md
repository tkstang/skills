---
oat_generated: true
oat_generated_at: 2026-06-27
oat_review_scope: p-rev1
oat_review_type: code
oat_review_invocation: manual
oat_project: /Users/tstang/Code/feat-public-discovery/.oat/projects/shared/public-discovery
---

# Code Review: p-rev1

**Reviewed:** 2026-06-27
**Scope:** Phase p-rev1 - Category 3 in-repo internal-flag tooling and tracking artifacts
**Files reviewed:** 75 changed files (range `a930783..a6a81eb`)
**Commits reviewed:** 11 commits (`f2473c3` through `a6a81eb`)

## Summary

The p-rev1 implementation mostly matches the revised category-3 direction: it
adds an idempotent internal-flag apply script, a detector, fixture coverage, CI
and pre-push enforcement, runbook text, stamped `.agents/skills/**` mirrors, and
artifact realignment that makes the upstream handoff optional. The functional
and repository gates are otherwise healthy: `validate:internal-flags`,
targeted Vitest, `build:check`, `validate`, `validate:skill-versions`, full
Vitest, lint, and smoke all passed.

This review does not pass yet because the current branch fails the CI
`type-check` step. The new TypeScript tests import declaration-free `.mjs`
script helpers without the established `@ts-expect-error` suppression or a
declaration file, so `tsc --noEmit` exits 2.

## Findings

### Critical

None

### Important

- **I1: New p-rev1 tests break the repository type-check gate**
  (`tests/scripts/apply-internal-flags.test.ts:14`,
  `tests/scripts/apply-internal-flags.test.ts:15`,
  `tests/scripts/validate-internal-flags.test.ts:9`,
  `.github/workflows/validate.yml:35`)
  - Issue: the new TypeScript tests import declaration-free `.mjs` scripts:
    `../../scripts/apply-internal-flags.mjs`,
    `../../scripts/lib/skill-frontmatter.mjs`, and
    `../../scripts/validate-internal-flags.mjs`. This repo's `tsconfig.json`
    includes `tests/**/*.ts` with strict checking and does not allow JS module
    declarations implicitly, so `pnpm run type-check` fails with TS7016 for all
    three imports.
  - Impact: the PR would fail the main `validate` GitHub Actions job before
    merge, because that job runs `pnpm run type-check` after build.
  - Evidence: `pnpm run type-check` exited 2 with:
    `Could not find a declaration file for module '../../scripts/apply-internal-flags.mjs'`;
    the same TS7016 error is reported for `skill-frontmatter.mjs` and
    `validate-internal-flags.mjs`.
  - Suggested fix: follow the existing test pattern for declaration-free `.mjs`
    imports by adding targeted `// @ts-expect-error ...` comments above these
    imports, or add real declarations for the new script helper exports. Re-run
    `pnpm run type-check` after the fix.

### Medium

None

### Minor

- **M1: `internal:` detection is not depth-scoped under `metadata:`**
  (`scripts/lib/skill-frontmatter.mjs:97`)
  - Issue: `frontmatterHasInternal` treats any indented `internal:` line inside
    the `metadata:` block as `metadata.internal`, regardless of nesting depth.
    A future skill with a deeper nested key such as
    `metadata:\n  visibility:\n    internal: true` could be treated as already
    flagged even though the public-discovery CLI likely expects the direct
    `metadata.internal` field.
  - Impact: no live defect in the current tree. The 57 real `.agents/skills`
    files have flat metadata, and `validate:internal-flags` confirms the direct
    flag is present today. This is a robustness note and can be deferred.
  - Suggested fix: if hardened later, only accept an `internal:` key at the
    detected child indent depth for the `metadata:` block.

## Requirements Alignment

| Requirement | Status | Notes |
| --- | --- | --- |
| prev1-t01 - idempotent apply script | implemented | Shared frontmatter helper and `apply-internal-flags.mjs` preserve existing frontmatter/body and skip symlinked skill directories. |
| prev1-t02 - detector and package script | implemented with CI blocker | Detector behavior is covered and passes, but the new test imports must be made type-check-safe. |
| prev1-t03 - stamp mirrors and verify discovery drop | implemented | 57 real `.agents/skills/**/SKILL.md` files are flagged; symlinked `session-observer` is the only unflagged `.agents` entry and is intentionally skipped. |
| prev1-t04 - CI and pre-push enforcement | implemented | PR-scoped `internal-flags` job and `tools/git-hooks/pre-push` line are present. Main CI still fails earlier at `type-check` until I1 is fixed. |
| prev1-t05 - AGENTS.md runbook | implemented | Runbook is in the hand-maintained section. `CLAUDE.md` is a symlink to `AGENTS.md`, so the same guidance is visible there. |
| prev1-t06 - realign artifacts and downgrade handoff | implemented | Discovery/design/backlog/handoff now describe the in-repo solution and keep upstream work as optional future cleanup. |

## Verification

Commands run during this review:

```bash
pnpm run validate:internal-flags
pnpm exec vitest run tests/scripts/apply-internal-flags.test.ts tests/scripts/validate-internal-flags.test.ts tests/repo/package-metadata.test.ts
pnpm run build:check
pnpm run validate:skill-versions --base-ref origin/main
pnpm run validate
pnpm test
pnpm run lint
pnpm run smoke
```

All commands above passed. `pnpm run lint` emitted only pre-existing
`no-shadow` warnings and exited 0.

Failing command:

```bash
pnpm run type-check
```

Result: failed with TS7016 errors for the new `.mjs` imports listed in I1.

## Recommended Next Step

Run `oat-project-review-receive` for this artifact, convert I1 into a small
fix task, then re-run p-rev1 review after `pnpm run type-check` passes. M1 can
be deferred unless you want to harden the frontmatter helper in the same pass.
