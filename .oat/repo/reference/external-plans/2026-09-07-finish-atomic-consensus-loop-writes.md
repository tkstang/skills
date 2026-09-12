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
updated: '2026-09-11T13:15:47.721Z'
oat_external_plan_reverified_commit: f5395a35
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

- Node >=22; pnpm 10.13.1 (`packageManager`). Conventional Commits; publication requires separate authority.
- Reuse `atomicWriteFile` in `src/consensus/core/loop-records.ts:68`, currently private. Export it from that internal module and import it directly into `consensus-loop.ts`; no public facade re-export is needed. Do not use the same-named helper in `src/consensus/shared/cli-helpers.ts`, which lacks fsync and has different confinement semantics.
- Run `pnpm run build` after canonical TypeScript changes and bump every affected skill version.
- Verify with `pnpm run build:check`, `pnpm run validate:skill-versions -- --base-ref <ref>`, focused tests, and the full suite.

## Scope

### In scope

- The two named functions in `src/consensus/core/consensus-loop.ts`.
- The minimal internal export in `src/consensus/core/loop-records.ts`.
- Focused crash/failure tests in `tests/consensus/core/loop-records.test.ts` using the public `runConsensusLoop` entry point.
- Generated outputs and required skill version bumps.

### Out of scope

- Other write sites in refine, configuration, panel, or provider CLI.
- Schema, formatting, flush frequency, backup, or recovery-policy changes.

## Implementation steps

### 1. Route both writes through the existing helper

Export the existing records-layer helper and import it directly. Replace the two direct writes while preserving directory creation, exact content, temp-file fsync before rename, and the existing return flow. Remove the now-redundant target-file sync at these two sites only. Do not claim parent-directory fsync or stronger power-loss durability than the existing helper supplies.

**Verify:** `pnpm exec vitest run tests/consensus/core/loop-records.test.ts` passes.

### 2. Add failure-path coverage for both call sites

Use `runConsensusLoop` with deterministic stub peers and `initialRecords` (entry at `consensus-loop.ts:761-773`); do not export the two private call sites for testing. Extend the existing `vi.mock('node:fs/promises')` rename spy to fail only for the intended destination, allowing unrelated status/records renames through.

For section output, pre-create a known-good output file and drive the loop to a terminal artifact write. For seeded records, pre-create exactly `[]\n` and provide nonempty `initialRecords`: a nonempty existing record array returns early and does **not** exercise the seed write. Assert target bytes survive rename failure, the original injected error is propagated, and no temp residue remains. Separately assert missing-file success, fixed-time seed serialization, and unchanged no-op behavior for existing nonempty records and empty seeds.

**Verify:** `pnpm exec vitest run tests/consensus/core/loop-records.test.ts` passes; destination-specific failure cases fail against the pre-change implementation.

### 3. Regenerate and validate consumers

Run the build, apply required skill version bumps, and confirm generated copies match canonical source.

**Verify:** `pnpm run build:check && pnpm run validate:skill-versions -- --base-ref origin/main` succeeds.

## Done criteria

- [ ] Both named writes are atomic with bytes unchanged.
- [ ] Success, residue cleanup, and previous-file survival are tested for both sites.
- [ ] `pnpm run build:check`, `pnpm run validate`, and `pnpm test` pass.
- [ ] `pnpm run premerge` passes, including type-check and smoke as required by the source acceptance criteria. Check only changed authored TS with `pnpm exec oxlint <changed-authored-ts>` and `pnpm exec oxfmt --check <changed-authored-ts>`; exclude generated files and instruction files. Stop on baseline failures rather than fixing unrelated source.
- [ ] Only explained source, test, generated, and version files are changed.

## STOP conditions

- The existing helper cannot preserve current bytes or directory semantics.
- A failure test cannot isolate the rename boundary without changing production APIs broadly.
- The change expands to unrelated write sites or recovery design.

## Review focus

Check durability ordering, original-error preservation, cleanup behavior, exact serialization, and complete generated consumer version bumps.
