---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: backlog-review
oat_external_plan_sources:
  - .oat/repo/pjm/backlog/reviews/backlog-and-roadmap-review.md
  - .oat/repo/pjm/backlog/items/BL-260723-make-remaining-consensus-loop.md
oat_external_plan_commit: f5395a35
oat_backlog_items:
  - BL-260723-make-remaining-consensus-loop
oat_issue_url: null
created: '2026-09-08T00:16:29Z'
---

# Finish atomic writes for consensus section output and seeded records

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`. Execute it directly, or import it with `oat-project-import-plan <this-file>`.

## Outcome

`writeSectionOutput` and `seedRecordsFile` use the existing atomic temp-write/fsync/rename behavior so interruption cannot truncate an established section or seeded records file. Serialized bytes and public behavior remain unchanged.

## Source and live evidence

- Planned at `f5395a35` on 2026-09-07.
- `src/consensus/core/consensus-loop.ts:250-257` writes terminal section output in place.
- `src/consensus/core/consensus-loop.ts:300-320` writes seeded records in place.
- `tests/consensus/core/loop-records.test.ts:153-200` demonstrates no-temp-residue and previous-file-survival coverage for the existing atomic records writer.
- `2026-07-17-atomic-consensus-records-writes.md` explicitly excluded other `writeFile` sites, so this is a follow-up rather than a duplicate.

## Drift check

```bash
git diff --stat f5395a35..HEAD -- src/consensus/core/consensus-loop.ts src/consensus/core/loop-records.ts tests/consensus/core
```

## Repository conventions

- Reuse the canonical atomic helper; do not create a subtly different local implementation.
- Run `pnpm run build` after canonical TypeScript changes and bump every affected skill version.
- Verify with `pnpm run build:check`, `pnpm run validate:skill-versions -- --base-ref <ref>`, focused tests, and the full suite.

## Scope

### In scope

- The two named functions in `src/consensus/core/consensus-loop.ts`.
- Focused crash/failure tests under `tests/consensus/core/`.
- Generated outputs and required skill version bumps.

### Out of scope

- Other write sites in refine, configuration, panel, or provider CLI.
- Schema, formatting, flush frequency, backup, or recovery-policy changes.

## Implementation steps

### 1. Route both writes through the existing helper

Replace the direct writes while preserving directory creation, exact content, fsync/rename semantics, and the existing return flow. Remove redundant fsync only when the shared helper already guarantees it.

**Verify:** `pnpm exec vitest run tests/consensus/core/loop-records.test.ts` passes.

### 2. Add failure-path coverage for both call sites

Prove success leaves no temporary residue. Inject rename failure after seeding/section output already contains known-good data; assert the original file remains byte-identical and the temporary file is cleaned up.

**Verify:** focused tests fail against the pre-change implementation and pass after the change.

### 3. Regenerate and validate consumers

Run the build, apply required skill version bumps, and confirm generated copies match canonical source.

**Verify:** `pnpm run build:check && pnpm run validate:skill-versions -- --base-ref origin/main` succeeds.

## Done criteria

- [ ] Both named writes are atomic with bytes unchanged.
- [ ] Success, residue cleanup, and previous-file survival are tested for both sites.
- [ ] `pnpm run build:check`, `pnpm run validate`, and `pnpm test` pass.
- [ ] Only explained source, test, generated, and version files are changed.

## STOP conditions

- The existing helper cannot preserve current bytes or directory semantics.
- A failure test cannot isolate the rename boundary without changing production APIs broadly.
- The change expands to unrelated write sites or recovery design.

## Review focus

Check durability ordering, original-error preservation, cleanup behavior, exact serialization, and complete generated consumer version bumps.
