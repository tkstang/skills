---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-19
oat_current_task_id: p03-t01
oat_generated: false
---

# Implementation: test-organization-cleanup

**Started:** 2026-06-19
**Last Updated:** 2026-06-19

> This document is used to resume interrupted implementation sessions.
>
> Conventions:
>
> - `oat_current_task_id` always points at the next plan task to do.
> - When all plan tasks are complete, set `oat_current_task_id: null`.
> - Reviews are tracked in `plan.md` under `## Reviews`.
> - Keep phase/task statuses consistent with the Progress Overview table.

## Progress Overview

| Phase   | Status      | Tasks | Completed |
| ------- | ----------- | ----- | --------- |
| Phase 1 | complete    | 3     | 3/3       |
| Phase 2 | complete    | 3     | 3/3       |
| Phase 3 | in_progress | 3     | 0/3       |

**Total:** 6/9 tasks completed

---

## Phase 1: Shared Test Helpers

**Status:** complete
**Started:** 2026-06-19

### Phase Summary

- **Outcome:** Extracted a small shared test-helper surface and adopted it across
  a representative subset of consensus, transcript, and tooling suites, removing
  duplicated subprocess/env/path/JSON setup without changing assertions or
  runtime behavior.
- **Key files:** `tests/helpers/process.mjs` (+`process.d.mts`) extended with
  `repoRoot`, `fixtureBin`, `sampleInput`, `makeStubEnv`, `readJson`;
  `tests/helpers/consensus.ts` created with `extractJsonBlock`; adopted in
  `tests/consensus-loop-cli.test.ts`, `tests/parallel-integration.test.ts`,
  `tests/sequential-wrapper.test.ts`, `tests/validate-script.test.ts`,
  `tests/release-versioning.test.ts`, `tests/event-payload-inventory.test.ts`,
  `tests/paseo-invocation.test.ts`.
- **Verification:** targeted Vitest runs, full suite 572/572, `type-check` clean,
  no generated `.mjs` touched, no-node-test-runner guard passing.
- **Notable decisions:** `readJson`/`extractJsonBlock` return `any` (not
  `unknown`) to avoid caller type-guard rewrites (out of scope). `captureStdout`
  JSONL event capturer and domain-specific `spawnCli` helpers in
  session-observer/export-session-transcript left local (different shape/timeouts,
  no cross-domain reuse) — adopting them would not reduce real duplication.
- **Review (p01):** PASS — 0 Critical, 0 Important, 2 Minor (inline env in
  sequential-wrapper:148 not migrated to `makeStubEnv`; note that
  session-observer/export-transcript helper adoption was intentionally skipped
  because those suites use `fileURLToPath`-based paths). Artifact:
  `reviews/p01-review-2026-06-18.md`.

### Task p01-t01: Inventory repeated setup and define helper boundaries

**Status:** completed
**Commit:** 39318b5

### Task p01-t02: Adopt helpers in high-duplication consensus tests

**Status:** completed
**Commit:** 9ccf713

### Task p01-t03: Adopt helpers in transcript and repo-tooling tests

**Status:** completed
**Commit:** abcdc1f

---

## Phase 2: Domain Directory Organization

**Status:** complete
**Started:** 2026-06-19

### Phase Summary

- **Outcome:** Reorganized the flat `tests/` tree into domain directories with no
  change in test count (572) or runtime behavior. Consensus tests grouped under
  `tests/consensus/{core,refine,evaluate}/` with generated-entrypoint tests kept
  visibly separate at `tests/consensus/`; repo policy/invariant tests under
  `tests/repo/`, release/versioning under `tests/release/`, build/tooling guards
  under `tests/tooling/`.
- **Key files:** 27 consensus suites moved (git mv) into core/refine/evaluate;
  12 suites moved into repo/release/tooling; relative imports updated for new
  depth (`../../../` under the 3-level consensus subdirs, `../../` elsewhere);
  `tests/repo/docs-presence.test.ts` path assertion updated to
  `tests/tooling/generated-output-sync.test.ts`; `tests/AGENTS.md` rewritten with
  a domain layout table; stale path references fixed in root `AGENTS.md`,
  `README.md`, and `CLAUDE.md`.
- **Verification:** `pnpm exec vitest run tests/consensus` (259), `tests/repo
  tests/release tests/tooling` (55), full `pnpm run test` 572/572, `pnpm run
  validate` green, `pnpm run build:check` confirmed no generated `.mjs` drift.
  `no-node-test-runner.test.ts` still scans the whole tree.
- **Notable decisions / deltas:** `repo-layout.test.ts` renamed to
  `tests/repo/layout.test.ts` (domain prefix redundant under the domain dir);
  `generated-output-sync.test.ts` placed in `tests/tooling/` as a build guard;
  `docs-presence.test.ts` path assertion update is within p02-t02 scope (plan
  step 2: update tests that enumerate the test tree).
- **Review (p02):** PASS — 0 Critical, 0 Important, 1 Minor (Phase 2 summary
  placeholder — resolved by this entry). Artifact:
  `reviews/p02-review-2026-06-18.md`.

### Task p02-t01: Move consensus core/refine/evaluate tests into domain directories

**Status:** completed
**Commit:** 80119ac

### Task p02-t02: Move repo policy, manifest, docs, release, and tooling tests into clear directories

**Status:** completed
**Commit:** aa80f01

### Task p02-t03: Update test guidance for the new structure

**Status:** completed
**Commit:** 9a02d50

---

## Phase 3: Oversized Suite Splits And Final Guard Checks

**Status:** in_progress
**Started:** 2026-06-19

### Phase Summary

_Fill when phase is complete._

### Task p03-t01: Split oversized consensus suites only where it improves navigation

**Status:** pending
**Commit:** -

---

### Task p03-t02: Split oversized transcript suites only where low risk

**Status:** pending
**Commit:** -

---

### Task p03-t03: Run final validation and update project tracking

**Status:** pending
**Commit:** -

---

## Orchestration Runs

### Run 1 — 2026-06-19

**Branch:** test-followups
**Tier:** 1
**Policy:** merge-strategy=merge, retry-limit=2
**Phases:** 2 executed so far, 2 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p01   | DONE        | pass   | 0/2            | merged      |
| p02   | DONE        | pass   | 0/2            | merged      |

#### Parallel Groups

- None — fully sequential plan (`oat_plan_parallel_groups: []`).

#### Dispatch Notes

- Dispatch: p01 implementation + review on Claude Code, model=sonnet (ceiling), effort not-applicable. No escalation needed.
- Dispatch: p02 implementation + review on Claude Code, model=sonnet (ceiling), effort not-applicable. No escalation needed.

#### Outstanding Items

- None. Two Minor p01 review findings recorded in the Phase 1 summary; non-blocking.

#### Artifact / Design Deltas

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p01-t01..t03 | plan.md helper tasks | shared helpers reduce duplication | `readJson`/`extractJsonBlock` typed `any` not `unknown`; session-observer/export-transcript suites intentionally not migrated | avoid caller type-guard rewrites (out of scope) and those suites use `fileURLToPath` paths with no real cross-domain reuse | implementation | none — accepted, documented in Phase 1 summary |
| p02-t01..t03 | plan.md move tasks | move tests into domain dirs | `repo-layout.test.ts` → `tests/repo/layout.test.ts`; `generated-output-sync.test.ts` → `tests/tooling/`; `docs-presence` path assertion updated | domain prefix redundant under domain dir; file is a build guard not consensus; assertion update required by the move (p02-t02 step 2) | implementation | none — accepted, documented in Phase 2 summary |
