---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-make-consensus-records
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Make consensus loop state writes atomic so a crash cannot corrupt a resumable session

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

`records.json` (the consensus loop's resumable deliberation history) and the loop status file are written atomically (temp file + rename) instead of in-place. Today a process kill mid-`writeFile` — on the hot path of every peer/synthesis turn — leaves truncated JSON, and the next resume throws in `readExistingRecords` with no recovery path, permanently losing the session. After this plan, a crash at any moment leaves either the previous or the new complete file, and resume always finds parseable state.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (correctness lane), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Verified evidence (read live at planning time):
  - `src/consensus/core/consensus-loop.ts:1226-1229` — `flush()` inside `createRecordsWriter` does `await writeFile(recordsPath, JSON.stringify(records, null, 2) + '\n')` followed by `syncFileIfAvailable(recordsPath)`; fsync-after-write does not protect against a kill *during* the write (file already truncated/partial).
  - `src/consensus/core/consensus-loop.ts:~670-681` — `readExistingRecords` rethrows any parse/read error except `ENOENT`, so a partial file makes resume impossible.
  - `src/consensus/core/consensus-loop.ts:~1287-1288` — `writeLoopStatus` uses the same direct-`writeFile` pattern (source-lane claim, spot-verify at execution).
  - Proven in-repo atomic pattern to copy: `src/transcript/session-observer/lib/state.ts:226-256` and `watch-state.ts:142-172` (write `${path}.tmp`, fsync, `rename`).

## Drift check

```bash
git diff --stat 8309623..HEAD -- src/consensus/core/consensus-loop.ts tests/consensus/core/
```

If `consensus-loop.ts` changed, re-locate `createRecordsWriter`/`flush` and `writeLoopStatus` and confirm they still write in place. A material mismatch is a STOP condition.

## Repository conventions

- Build: `pnpm run build` → regenerates committed `.mjs` outputs
- Typecheck: `pnpm run type-check` → clean
- Test: `pnpm test` → all suites pass
- Generated-output sync: `pnpm run build:check` → clean
- Skill-version gate: `consensus-loop.ts` generates into `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` and `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs` (see `scripts/build-generated.mjs`) — **bump the `refine` and `evaluate` skills' `SKILL.md` versions** (top-level `version` and `metadata.version` in sync), then confirm with `pnpm run validate:skill-versions -- --base-ref main`.
- Commits: Conventional Commits (e.g. `fix(consensus): write records and status atomically`). Do not push or open a PR unless instructed.

## Scope

### In scope

- `src/consensus/core/consensus-loop.ts`: an atomic-write helper plus its use in `createRecordsWriter().flush()` and `writeLoopStatus`.
- Tests under `tests/consensus/core/` for the atomic behavior.
- Regenerated `.mjs` outputs and the required skill version bumps.

### Out of scope

- A last-good-backup / corrupt-file fallback in `readExistingRecords` — deliberate follow-up; atomicity alone removes the corruption window.
- Any other `writeFile` call sites in the repo (session-observer state has its own plan).
- Changing the records schema or flush frequency.

## Current state

- `createRecordsWriter(recordsPath, options)` loads existing records via `readExistingRecords`, then exposes `append()` which mutates the array and calls `flush()` — a full-file rewrite per turn.
- `syncFileIfAvailable` already exists in `consensus-loop.ts` and tolerates filesystems without fsync — reuse it for the temp file before rename.
- The generated copies of this file must never be hand-edited; all changes flow through `pnpm run build`.

## Implementation steps

### 1. Add an atomic write helper in `consensus-loop.ts`

Add `async function atomicWriteFile(targetPath: string, data: string)` that writes to `${targetPath}.${process.pid}.tmp` in the same directory, calls `syncFileIfAvailable` on the temp file, then `rename(tmp, targetPath)`; on failure, best-effort `unlink` the temp file and rethrow. Mirror the shape of `writeState` in `src/transcript/session-observer/lib/state.ts:226-256` (same-directory temp is what makes `rename` atomic on POSIX).

**Verify:** `pnpm run type-check` → clean.

### 2. Use it in `flush()` and `writeLoopStatus`

Replace the direct `writeFile` in `createRecordsWriter().flush()` (line ~1226) and in `writeLoopStatus` (line ~1287) with `atomicWriteFile`. Preserve the exact serialized content (`JSON.stringify(..., null, 2) + '\n'`).

**Verify:** `pnpm test -- tests/consensus/core/` → existing records/status tests still pass (byte-identical output).

### 3. Add atomicity tests

In the existing records-writer test file under `tests/consensus/core/` (find via `grep -rl createRecordsWriter tests/consensus/core/`), add: (a) after `flush`, no `*.tmp` file remains beside `records.json`; (b) a rename-failure simulation (e.g. pre-create the target as a directory, or point at a removed parent) rejects and leaves the previous `records.json` intact and parseable; (c) `writeLoopStatus` same no-tmp-residue assertion.

**Verify:** `pnpm test -- tests/consensus/core/` → new cases pass.

### 4. Regenerate, bump skill versions, run the contract

Bump `plugins/consensus/skills/refine/SKILL.md` and `plugins/consensus/skills/evaluate/SKILL.md` versions (patch), keeping top-level and `metadata.version` in sync. Then:

```bash
pnpm run build && pnpm run build:check && pnpm test && npm run validate && pnpm run validate:skill-versions -- --base-ref main
```

**Verify:** all exit 0; `git status --short` shows only the canonical source, tests, SKILL.md bumps, and regenerated outputs.

## Test plan

- New cases in the `tests/consensus/core/` records-writer suite (structural pattern: existing tests there, real temp dirs, no mocks).
- Regression proven: in-place truncation window is gone; a failed write can no longer destroy the previous good file.
- Focused: `pnpm test -- tests/consensus/core/` → pass.
- Full: `pnpm test` → no regressions (refine/evaluate integration suites re-exercise flush through real subprocess flows).

## Done criteria

- [ ] `flush()` and `writeLoopStatus` write via temp+rename with no behavior change in content.
- [ ] Tests prove no tmp residue and previous-file survival on failed writes.
- [ ] `refine` and `evaluate` SKILL.md versions bumped; `validate:skill-versions` passes against `main`.
- [ ] Full contract (`build`, `build:check`, `test`, `validate`) passes; `git status --short` clean of unexplained files.

## STOP conditions

- Live `flush`/`writeLoopStatus` no longer match the evidence (drift).
- Existing tests depend on observing the in-place write mid-flight (would indicate an intentional streaming contract — report).
- The rename approach fails on a supported platform path (e.g. tests reveal cross-device temp placement) — report rather than falling back to in-place writes.
- Any verification gate fails twice after one bounded correction.

## Review focus

- Temp file must be created in the same directory as the target (rename atomicity).
- Confirm serialized bytes are unchanged (only the write mechanics change).
- Deferred intentionally: corrupt-file fallback/backup in `readExistingRecords`, and the same treatment for any other consensus-side write sites — note as follow-up if spotted during implementation.
