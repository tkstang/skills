---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-07-22
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ["p06"]
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: spec-driven
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: cursor-collaboration-reliability

> Execute this plan using `oat-project-implement`. Tasks are sequential because the phases share transcript schemas, generated outputs, observer state, collaboration leases, and release artifacts.

**Goal:** Make Cursor observation content-first and continuity-safe while keeping automatic collaboration completion terminal-only, exact-identity-bound, bounded, and honestly evidence-gated.

**Architecture:** Add one streaming Cursor frame reader and turn analyzer beneath Session Observer, then layer an isolated Cursor state v2 store, exact identity and continuity checks, digest/status/watch projections, and collaboration-private completion cursors over those primitives. Preserve Claude Code, Codex, and Export Session Transcript compatibility, and treat stronger wake paths as conditional evidence work rather than a ship blocker.

**Tech Stack:** Node.js 22+, TypeScript, dependency-free Node standard-library runtime code, authored ESM for collaboration hooks, Vitest, generated `.mjs` runtime outputs, Fumadocs, pnpm, and OAT lifecycle tooling.

**Commit Convention:** `{type}({task-id}): {description}` — for example, `feat(p03-t04): reserve cursor delivery before output`.

## Planning Checklist

- [x] Defer HiLL checkpoint confirmation to `oat-project-implement`.
- [x] Evaluated phases for parallelism opportunities.
- [x] Kept execution sequential because phases share generated/core/collaboration/docs/version files.
- [x] Left `oat_plan_parallel_groups` empty.

## Parallelism

`oat_plan_parallel_groups: []` is intentional. Phase 1 freezes shared frame and analysis contracts; Phase 2 owns identity and state; Phase 3 consumes both across broad observer surfaces; Phase 4 consumes the resulting completion projection and changes shared envelope parsing; Phases 5 and 6 depend on the shipped behavior and live evidence. Splitting these phases across worktrees would overlap source types, generated outputs, skill metadata, evidence references, or docs.

## Phase 1: Streaming Cursor Transcript Foundation

### Task p01-t01: Record the measured baseline and fixture contract

**Requirements:** FR4, FR9, NFR2, NFR5, NFR6

**Files:**

- Create: `tests/transcript-core/cursor-fixtures.test.ts`
- Create or extend: `tests/session-observer/fixtures/cursor/framed-*.jsonl`
- Modify: `tests/session-observer/fixtures/README.md`
- Modify: `skills/session-observer-collab/references/runtime-cursor.md`

**Steps:**

1. Before parser implementation, record the measured Cursor store/version/path/record/identity baseline and the exact post-implementation probe plan in `runtime-cursor.md`; label unavailable or unsupported rows honestly and retain no prose or raw identity values.
2. Add redacted fixtures for blank lines, closed frames, malformed middle frames, unterminated tails, repair, append growth, and prefix replacement.
3. Add passing fixture-contract tests for JSONL byte preservation, redaction, expected structural labels, and scenario inventory; defer scanner behavior assertions to p01-t02.
4. Document the intended zero-based physical frame index, blocker/tail scenarios, and prefix-repair cases without asserting unimplemented runtime behavior.
5. Format: do not JSON-format JSONL fixtures; run `pnpm exec oxfmt --write tests/transcript-core/cursor-fixtures.test.ts tests/session-observer/fixtures/README.md skills/session-observer-collab/references/runtime-cursor.md`.
6. Verify GREEN: `pnpm exec vitest run tests/transcript-core/cursor-fixtures.test.ts`; verify the baseline contains provider/version/shape/action/label fields and no personal absolute path, raw session/lease value, credential, or transcript prose.
7. Commit: `test(p01-t01): record cursor baseline and frame contract`.

### Task p01-t02: Implement the streaming Cursor frame reader

**Requirements:** FR4, NFR2, NFR5

**Files:**

- Create: `src/transcript/core/cursor-frames.ts`
- Create: `tests/transcript-core/cursor-frames.test.ts`
- Modify: `scripts/build-generated.mjs`
- Modify: `tests/tooling/generated-output-sync.test.ts`
- Generate: `skills/session-observer/scripts/lib/cursor-frames.mjs`
- Generate: `skills/export-session-transcript/scripts/lib/cursor-frames.mjs`

**Steps:**

1. Add scanner behavior tests for physical frame indexes, byte boundaries, safe prefix hashes, device/inode metadata, blocking summaries, repair, append, and replacement; observe them fail before implementation.
2. Implement `scanCursorTranscript()` with streaming Node `fs`/`crypto` APIs and released-per-frame callbacks.
3. Keep malformed/partial input fail-closed, snapshot `verifiedPrefixSha256` exactly at `verifyPrefixBytes`, and permit later bytes without changing the verified prefix.
4. Add the frame-reader mappings, import rewrites, and mapping assertions for both shipped runtime trees; refactor hashing without retaining a transcript-sized record array.
5. Format: `pnpm exec oxfmt --write src/transcript/core/cursor-frames.ts tests/transcript-core/cursor-frames.test.ts scripts/build-generated.mjs tests/tooling/generated-output-sync.test.ts`.
6. Run `pnpm run build`; never hand-edit generated outputs.
7. Verify GREEN: `pnpm exec vitest run tests/transcript-core/cursor-frames.test.ts tests/tooling/generated-output-sync.test.ts && pnpm run type-check && pnpm run build:check`.
8. Commit: `feat(p01-t02): add streaming cursor frame reader`.

### Task p01-t03: Establish the shared control-classification seam

**Requirements:** FR2, FR3, NFR3, NFR4

**Files:**

- Modify: `src/transcript/core/runtimes.ts`
- Generate: `skills/session-observer/scripts/lib/runtimes.mjs`
- Generate: `skills/export-session-transcript/scripts/lib/runtimes.mjs`
- Modify: `tests/transcript-core/runtimes.test.ts`
- Modify: `tests/session-observer/fixtures/cursor/*.jsonl`

**Steps:**

1. Add focused automatic-envelope and no-op/ack classifier tests in `runtimes.test.ts`, observe them fail, then promote the existing parser and rules into dependency-free canonical core exports; do not import authored collaboration modules into canonical TypeScript.
2. Keep analyzer-specific structural-turn assertions deferred to p01-t04 so this task finishes green on the shared seam alone.
3. Keep the existing terminal-only `normalizeCursor()` projection byte-for-byte compatible in behavior.
4. Define the analyzer identity input in core as the structural exact identity contract that the Phase 2 resolver will satisfy, avoiding a core-to-observer import.
5. Format: `pnpm exec oxfmt --write src/transcript/core/runtimes.ts tests/transcript-core/runtimes.test.ts`.
6. Run `pnpm run build`; never hand-edit the two generated runtime copies.
7. Verify GREEN and synchronization: `pnpm exec vitest run tests/transcript-core/runtimes.test.ts && pnpm run build:check`.
8. Commit: `refactor(p01-t03): expose cursor control classifiers`.

### Task p01-t04: Implement the Cursor turn analyzer

**Requirements:** FR2, FR3, NFR2, NFR3, NFR5

**Files:**

- Create: `src/transcript/core/cursor-analysis.ts`
- Create: `tests/transcript-core/cursor-analysis.test.ts`
- Modify: `scripts/build-generated.mjs`
- Modify: `tests/tooling/generated-output-sync.test.ts`
- Generate: `skills/session-observer/scripts/lib/cursor-analysis.mjs`
- Generate: `skills/export-session-transcript/scripts/lib/cursor-analysis.mjs`

**Steps:**

1. Add analyzer tests for structural turn ranges, multiple assistant blocks, human/tool indexes, terminal states, entry-key identity scoping, automatic-control input, acknowledgements, no-op text, diagnostics, and unsupported shapes; observe them fail before implementation.
2. Implement `createCursorTurnAccumulator()` over framed callbacks with stable turn IDs, source-ordered content records, classifications, lifecycle, and recovery pointers.
3. Keep the factory boundary-oriented and emit structural candidates only; later observer integration supplies persisted `openTurn` context and two-scan confirmation.
4. Add analyzer mappings, import rewrites, and mapping assertions for both shipped runtime trees.
5. Format: `pnpm exec oxfmt --write src/transcript/core/cursor-analysis.ts tests/transcript-core/cursor-analysis.test.ts scripts/build-generated.mjs tests/tooling/generated-output-sync.test.ts`.
6. Run `pnpm run build`; never hand-edit generated outputs.
7. Verify GREEN: `pnpm exec vitest run tests/transcript-core/cursor-analysis.test.ts tests/transcript-core/runtimes.test.ts tests/tooling/generated-output-sync.test.ts && pnpm run type-check && pnpm run build:check`.
8. Commit: `feat(p01-t04): add cursor turn analyzer`.

### Task p01-t05: Verify combined runtime and Export compatibility

**Requirements:** NFR3, NFR4

**Files:**

- Modify: `tests/tooling/generated-output-sync.test.ts`
- Modify: `tests/transcript-core/runtimes.test.ts`
- Modify: `tests/export-session-transcript/cli.test.ts`

**Steps:**

1. Assert that both framed modules have explicit generated mappings and correct `.js` to `.mjs` rewrites in both runtime trees.
2. Add regression coverage showing Session Observer can consume the generated modules while Export Session Transcript retains its existing terminal-only Cursor projection.
3. Format: `pnpm exec oxfmt --write tests/tooling/generated-output-sync.test.ts tests/transcript-core/runtimes.test.ts tests/export-session-transcript/cli.test.ts`.
4. Verify: `pnpm exec vitest run tests/tooling/generated-output-sync.test.ts tests/transcript-core/runtimes.test.ts tests/export-session-transcript/cli.test.ts && pnpm run build:check && pnpm run type-check`.
5. Commit: `test(p01-t05): verify cursor core runtime compatibility`.

## Phase 2: Exact Identity, Continuity, and Cursor State v2

### Task p02-t01: Resolve exact Cursor identity

**Requirements:** FR1, NFR1, NFR3

**Files:**

- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Generate: `skills/session-observer/scripts/lib/locate.mjs`

**Steps:**

1. Add RED cases for direct/store/harness/fallback evidence, duplicate candidates, symlink-equivalent cwd, path escape, explicit pin mismatch, and candidate changes after pinning.
2. Implement `resolveCursorIdentity()` using canonical cwd/transcript paths and exact session evidence; fallback-only or ambiguous evidence remains diagnostic and cannot own state.
3. Reuse existing rank/path canonicalization helpers and preserve non-Cursor candidate behavior.
4. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/locate.ts src/transcript/session-observer/lib/types.ts tests/session-observer/locate.test.ts`.
5. Run `pnpm run build`; never hand-edit the generated locate module.
6. Verify: `pnpm exec vitest run tests/session-observer/locate.test.ts && pnpm run type-check && pnpm run build:check`.
7. Commit: `feat(p02-t01): resolve exact cursor transcript identity`.

### Task p02-t02: Add the isolated Cursor state v2 store

**Requirements:** FR4, FR6, NFR2, NFR3

**Files:**

- Create: `src/transcript/session-observer/lib/cursor-state.ts`
- Create: `tests/session-observer/cursor-state.test.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `scripts/build-generated.mjs`
- Generate: `skills/session-observer/scripts/lib/cursor-state.mjs`

**Steps:**

1. Add RED schema/permission/lock/corruption tests for owner-only `cursor-state.json`, observation and completion projections, open-turn context, candidate checkpoints, and delivery reservations.
2. Implement schema v2 load/write/lock primitives under a Cursor-only lock; leave legacy `state.json` and its Claude/Codex code unchanged.
3. Add the canonical-to-generated mapping for `cursor-state.ts`, then run `pnpm run build`.
4. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/cursor-state.ts src/transcript/session-observer/lib/types.ts tests/session-observer/cursor-state.test.ts scripts/build-generated.mjs`.
5. Verify: `pnpm exec vitest run tests/session-observer/cursor-state.test.ts tests/session-observer/state.test.ts && pnpm run build:check && pnpm run type-check`.
6. Commit: `feat(p02-t02): add isolated cursor state v2 store`.

### Task p02-t03: Make legacy Cursor state migration recoverable

**Requirements:** FR4, FR6, NFR3

**Files:**

- Modify: `src/transcript/session-observer/lib/cursor-state.ts`
- Modify: `src/transcript/session-observer/lib/state.ts`
- Modify: `tests/session-observer/cursor-state.test.ts`
- Modify: `tests/session-observer/state.test.ts`
- Generate: `skills/session-observer/scripts/lib/{cursor-state,state}.mjs`

**Steps:**

1. Add injected-failure tests for every ordering boundary between the two independently locked stores.
2. Implement a durable marker/backup protocol that never silently interprets record indexes as frame indexes and can resume after either write succeeds alone.
3. Compose get/reset/clear helpers so non-Cursor state remains available while legacy Cursor entries require explicit replay/reset.
4. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/cursor-state.ts src/transcript/session-observer/lib/state.ts tests/session-observer/cursor-state.test.ts tests/session-observer/state.test.ts`.
5. Run `pnpm run build`; never hand-edit generated state modules.
6. Verify: `pnpm exec vitest run tests/session-observer/cursor-state.test.ts tests/session-observer/state.test.ts && pnpm run build:check`.
7. Commit: `feat(p02-t03): add crash-safe cursor state migration`.

### Task p02-t04: Enforce transcript continuity

**Requirements:** FR4, FR6, NFR1, NFR5

**Files:**

- Modify: `src/transcript/session-observer/lib/cursor-state.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/session-observer/cursor-state.test.ts`
- Generate: `skills/session-observer/scripts/lib/cursor-state.mjs`

**Steps:**

1. Add RED mutations for append, repair, shrink, same-path inode replacement, canonical-path rotation, prefix mismatch, missing stat identity, and explicit reset/replay.
2. Implement `validateCursorContinuity()` using canonical identity, required device/inode, exact prior prefix snapshot, byte/frame checkpoints, and structured recovery codes.
3. Confirm blocked continuity cannot advance either projection or erase evidence.
4. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/cursor-state.ts src/transcript/session-observer/lib/types.ts tests/session-observer/cursor-state.test.ts`.
5. Run `pnpm run build`; never hand-edit the generated Cursor state module.
6. Verify: `pnpm exec vitest run tests/session-observer/cursor-state.test.ts tests/transcript-core/cursor-frames.test.ts && pnpm run build:check`.
7. Commit: `feat(p02-t04): enforce cursor transcript continuity`.

### Task p02-t05: Add stability checkpoints and delivery CAS

**Requirements:** FR2, FR3, FR6, NFR2, NFR3, NFR5

**Files:**

- Modify: `src/transcript/session-observer/lib/cursor-state.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/session-observer/cursor-state.test.ts`
- Generate: `skills/session-observer/scripts/lib/cursor-state.mjs`

**Steps:**

1. Add RED tests for prefix-only two-scan confirmation, growth after a candidate boundary, candidate replacement, restart with `openTurn`, owner conflicts, stale reservation, crash-before-output, crash-after-output, and delivery-uncertain recovery.
2. Implement candidate timing/checkpoints plus reserve, commit, abandon, and replay-safe CAS operations without persisting prose or hashes of prose.
3. Store sufficient structural `openTurn` context so mid-turn restart does not need a full transcript reread and does not mis-group the turn.
4. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/cursor-state.ts src/transcript/session-observer/lib/types.ts tests/session-observer/cursor-state.test.ts`.
5. Verify: `pnpm exec vitest run tests/session-observer/cursor-state.test.ts && pnpm run type-check && pnpm run build && pnpm run build:check`.
6. Commit: `feat(p02-t05): add cursor stability and delivery CAS`.

### Task p02-t06: (review) Publish lock contenders atomically

**Requirements:** FR4, FR6, NFR3

**Files:**

- Modify: `src/transcript/session-observer/lib/state.ts`
- Modify: `src/transcript/session-observer/lib/cursor-state.ts`
- Modify: `tests/session-observer/state.test.ts`
- Modify: `tests/session-observer/cursor-state.test.ts`
- Generate: `skills/session-observer/scripts/lib/{state,cursor-state}.mjs`

**Steps:**

1. Add failing subprocess and injected-error coverage for process death or write/sync failure between contender creation and durable publication for the legacy-state, Cursor-state, and transition-lock queues.
2. Publish only complete, durably written owner tokens into the ordered queue, using a private owner file plus an atomic publication step; clean up abandoned private files without weakening fail-closed treatment of invalid legacy main locks.
3. Preserve FIFO acquisition, exact-owner release, valid dead-owner recovery, live legacy empty-lock protection, and the existing state/migration contracts.
4. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/state.ts src/transcript/session-observer/lib/cursor-state.ts tests/session-observer/state.test.ts tests/session-observer/cursor-state.test.ts`.
5. Run `pnpm run build`; never hand-edit generated state modules.
6. Verify: `pnpm exec vitest run tests/session-observer/state.test.ts tests/session-observer/cursor-state.test.ts && pnpm run type-check && pnpm run build:check`.
7. Commit: `fix(p02-t06): publish lock contenders atomically`.

### Task p02-t07: (review) Keep ancestor cwd aliases diagnostic-only

**Requirements:** FR1, NFR1

**Files:**

- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Generate: `skills/session-observer/scripts/lib/locate.mjs`

**Steps:**

1. Add failing identity-matrix cases for leaf and ancestor-component symlink aliases, canonical/raw duplicates, explicit pins, and alias-only transcripts.
2. Compare normalized supplied cwd spelling with the resolved canonical cwd so every distinct raw-derived encoding is diagnostic-only, regardless of which path component introduces the alias.
3. Preserve exact canonical candidates, cross-slug duplicate rejection, classification caching, and non-Cursor locate behavior.
4. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/locate.ts tests/session-observer/locate.test.ts`.
5. Run `pnpm run build`; never hand-edit the generated locate module.
6. Verify: `pnpm exec vitest run tests/session-observer/locate.test.ts && pnpm run type-check && pnpm run build:check`.
7. Commit: `fix(p02-t07): keep raw cwd aliases diagnostic-only`.

### Task p02-t08: (review) Align Cursor v2 recovery guidance

**Requirements:** FR4, NFR3

**Files:**

- Modify: `skills/session-observer/SKILL.md`

**Steps:**

1. Replace the generic offset-zeroing language with runtime-specific behavior: Cursor session reset deletes state for replay, while non-Cursor reset retains its record-offset contract.
2. Document fail-closed corrupt/schema handling, the destructive whole-Cursor-store reset command, sibling-session loss, and the generic recursive-delete fallback as an explicitly secondary destructive escape hatch.
3. Bump the skill's top-level `version` and `metadata.version` together and confirm release version tooling still covers `session-observer`.
4. Format: `pnpm exec oxfmt --write skills/session-observer/SKILL.md`.
5. Verify: `npm run validate && pnpm run validate:skill-versions -- --base-ref origin/main`.
6. Commit: `docs(p02-t08): align cursor recovery guidance`.

## Phase 3: Digest v2, Observation, Foreground Watch, and CLI

### Task p03-t01: Define Cursor digest v2 types and fixture contracts

**Requirements:** FR2, FR3, FR5, FR6, NFR2, NFR3

**Files:**

- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/session-observer/digest.test.ts`

**Steps:**

1. Add the discriminated digest v2 types for frame ranges, accounting, projection labels, availability, lifecycle, recovery pointers, and blocking frames while preserving v1 record-index types as the Claude/Codex branch.
2. Add passing fixture-shape and serialization-characterization tests that exercise only the new data contract; defer `buildDigest` behavior assertions to p03-t02.
3. Assert fixture accounting is internally balanced and JSON/event metadata remains structural-only.
4. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/types.ts tests/session-observer/digest.test.ts`.
5. Verify GREEN: `pnpm exec vitest run tests/session-observer/digest.test.ts && pnpm run type-check`.
6. Commit: `test(p03-t01): define cursor digest v2 contract`.

### Task p03-t02: Build Cursor digest and status projections

**Requirements:** FR2, FR3, FR5, FR6, NFR2, NFR3, NFR5

**Files:**

- Modify: `src/transcript/session-observer/lib/digest.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/session-observer/digest.test.ts`
- Generate: `skills/session-observer/scripts/lib/digest.mjs`

**Steps:**

1. Add `buildDigest` behavior tests for frame accounting, observation/completion projection, lifecycle, recovery, and blocking states; observe them fail before implementation.
2. Add a Cursor branch that consumes framed analysis and state checkpoints without routing through compact record indexes.
3. Project observation separately from confirmed completion; terminal success selects the final substantive entry, non-success suppresses unread prose, and pending content remains review-only.
4. Render independent activity/content/lifecycle/health facets and recovery pointers while preserving existing v1 markdown/JSON output.
5. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/digest.ts src/transcript/session-observer/lib/types.ts tests/session-observer/digest.test.ts`.
6. Run `pnpm run build`; never hand-edit the generated digest module.
7. Verify GREEN: `pnpm exec vitest run tests/session-observer/digest.test.ts tests/transcript-core/runtimes.test.ts && pnpm run type-check && pnpm run build:check`.
8. Commit: `feat(p03-t02): add cursor digest v2 projections`.

### Task p03-t03: Characterize observation output ownership

**Requirements:** FR1, FR2, FR3, FR4, FR6, NFR1, NFR3

**Files:**

- Modify: `tests/session-observer/observe.test.ts`
- Modify: `tests/session-observer/integration.test.ts`

**Steps:**

1. Add passing characterization tests for current non-Cursor catch-up/review behavior and identify the CLI/watch stdout ownership seams used by the next task.
2. Add reusable Cursor fixture builders and failure-injection helpers without asserting behavior that the current implementation does not provide.
3. Verify existing state mutation/output ordering explicitly so p03-t04 can replace it without changing non-Cursor behavior.
4. Format: `pnpm exec oxfmt --write tests/session-observer/observe.test.ts tests/session-observer/integration.test.ts`.
5. Verify GREEN: `pnpm exec vitest run tests/session-observer/observe.test.ts tests/session-observer/integration.test.ts`.
6. Commit: `test(p03-t03): define cursor catch-up delivery contract`.

### Task p03-t04: Integrate Cursor observation and delivery CAS

**Requirements:** FR1, FR2, FR3, FR4, FR5, FR6, NFR1, NFR2, NFR5

**Files:**

- Modify: `src/transcript/session-observer/lib/observe.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/session-observer/observe.test.ts`
- Modify: `tests/session-observer/integration.test.ts`
- Generate: `skills/session-observer/scripts/lib/observe.mjs`

**Steps:**

1. Add Cursor behavior tests for exact pinned identity, continuity block/no mutation, one bounded confirmation, pending delivery, success/failure reconciliation, owner conflict, crash-window replay keys, and delivery-handle finalization; observe them fail before implementation.
2. Route Cursor through exact identity, framed scan/analyzer, continuity, digest v2, and Cursor-state reservation APIs.
3. Make one-shot review/catch-up perform at most one bounded confirmation scan; return pending honestly when the prefix is not yet stable.
4. Reserve before rendering and return an explicit uncommitted delivery handle whose `commit`/`abandon` finalizer must be called by the stdout-owning CLI or watch loop; `observe.ts` never claims output success itself.
5. Surface delivery-uncertain state instead of silently advancing after an ambiguous caller/output failure, and test handle ownership, double-finalization, and stale-owner rejection at the library boundary.
6. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/observe.ts src/transcript/session-observer/lib/types.ts tests/session-observer/observe.test.ts tests/session-observer/integration.test.ts`.
7. Run `pnpm run build`; never hand-edit the generated observe module.
8. Verify GREEN: `pnpm exec vitest run tests/session-observer/observe.test.ts tests/session-observer/integration.test.ts && pnpm run type-check && pnpm run build:check`.
9. Commit: `feat(p03-t04): integrate cursor observation delivery`.

### Task p03-t05: Extend durable watch targets for Cursor

**Requirements:** FR4, FR5, FR7, NFR1, NFR3

**Files:**

- Modify: `src/transcript/session-observer/lib/watch-state.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/session-observer/watch-state.test.ts`
- Generate: `skills/session-observer/scripts/lib/watch-state.mjs`

**Steps:**

1. Add RED tests for frame-index targets, canonical path, device/inode, safe prefix, pending candidate deadline, ownership, migration, and blocked/repaired target transitions.
2. Extend watch target serialization without reinterpreting v1 record-index targets.
3. Keep owner-only permissions and lock/CAS behavior.
4. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/watch-state.ts src/transcript/session-observer/lib/types.ts tests/session-observer/watch-state.test.ts`.
5. Run `pnpm run build`; never hand-edit the generated watch-state module.
6. Verify: `pnpm exec vitest run tests/session-observer/watch-state.test.ts && pnpm run build:check`.
7. Commit: `feat(p03-t05): persist cursor watch targets`.

### Task p03-t06: Add bounded Cursor foreground watch behavior

**Requirements:** FR2, FR3, FR4, FR5, FR6, FR7, NFR1, NFR2, NFR5

**Files:**

- Modify: `src/transcript/session-observer/lib/watch.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/session-observer/watch.test.ts`
- Generate: `skills/session-observer/scripts/lib/watch.mjs`

**Steps:**

1. Add RED cases for metadata change, scheduled stability confirmation without a second metadata change, debounce, heartbeat, repair, block, reservation conflict, startup duplicate race, cleanup, and unchanged-poll bounds.
2. Add Cursor to the applicable watch runtime set and drive scans from file identity/prefix plus candidate deadlines, not mtime/size alone.
3. Report independent facets; blocked continuity is not healthy, pending content is not completed, and baseline delivery uses the same reservation contract with no state restore.
4. Make the watch loop await stdout, then commit the delivery handle only on success; abandon or mark delivery-uncertain on injected synchronous/async write failure without advancing either cursor.
5. Format: `pnpm exec oxfmt --write src/transcript/session-observer/lib/watch.ts src/transcript/session-observer/lib/types.ts tests/session-observer/watch.test.ts`.
6. Run `pnpm run build`; never hand-edit the generated watch module.
7. Verify: `pnpm exec vitest run tests/session-observer/watch.test.ts tests/session-observer/watch-state.test.ts && pnpm run type-check && pnpm run build:check`.
8. Commit: `feat(p03-t06): watch cursor transcripts safely`.

### Task p03-t07: Compose Cursor CLI state and output semantics

**Requirements:** FR4, FR5, FR6, FR7, NFR1, NFR2, NFR3

**Files:**

- Modify: `src/transcript/session-observer/session-observer.ts`
- Modify: `tests/session-observer/cli.test.ts`
- Modify: `tests/session-observer/cli-session-override.test.ts`
- Generate: `skills/session-observer/scripts/session-observer.mjs`

**Steps:**

1. Add RED CLI coverage for digest v2 markdown/JSON, state get/reset/clear across both stores, legacy marker, blocked and delivery-uncertain exits, replay, pinned review/catch-up, and watch status.
2. Route Cursor `review --mark-read` through the uncommitted delivery handle; await stdout, commit only on success, and abandon or mark delivery-uncertain under injected write failures. Never directly write a legacy record offset.
3. Preserve v1 flags/output and keep prose out of state/event logs; assert CLI output failure leaves observation and completion cursors unchanged.
4. Format: `pnpm exec oxfmt --write src/transcript/session-observer/session-observer.ts tests/session-observer/cli.test.ts tests/session-observer/cli-session-override.test.ts`.
5. Verify: `pnpm exec vitest run tests/session-observer/cli.test.ts tests/session-observer/cli-session-override.test.ts tests/session-observer/integration.test.ts && pnpm run build && pnpm run build:check`.
6. Commit: `feat(p03-t07): expose cursor state and status in cli`.

## Phase 4: Collaboration Compatibility and Completion Safety

### Task p04-t01: Dispatch completion selection by digest schema

**Requirements:** FR8, NFR3

**Files:**

- Modify: `skills/session-observer-collab/scripts/lib/completion-selection.mjs`
- Modify: `skills/session-observer-collab/scripts/lib/completion-selection.d.ts`
- Modify: `tests/session-observer-collab/completion.test.ts`

**Steps:**

1. Add RED v1-record and v2-frame fixtures, projection/index-base routing, and sliced/incomplete rejection.
2. Implement explicit schema/projection dispatch; v2 completion accepts only the confirmed-completion projection.
3. Preserve legacy v1 selection behavior.
4. Format: `pnpm exec oxfmt --write skills/session-observer-collab/scripts/lib/completion-selection.mjs skills/session-observer-collab/scripts/lib/completion-selection.d.ts tests/session-observer-collab/completion.test.ts`.
5. Verify: `pnpm exec vitest run tests/session-observer-collab/completion.test.ts`.
6. Commit: `feat(p04-t01): route completion by digest schema`.

### Task p04-t02: Migrate collaboration leases to schema v6

**Requirements:** FR8, NFR1, NFR2, NFR3

**Files:**

- Modify: `skills/session-observer-collab/scripts/lib/lease-state.mjs`
- Modify: `skills/session-observer-collab/scripts/lib/lease-state.d.ts`
- Modify: `skills/session-observer-collab/scripts/collab-control.mjs`
- Modify: `tests/session-observer-collab/control.test.ts`

**Steps:**

1. Add RED validation/migration cases for canonical peer transcript path, index base, private continuity checkpoint, supported-store containment, symlink escape, v5 non-Cursor preservation, and v5 Cursor explicit re-arm.
2. At arm time, realpath-canonicalize the supported Cursor store and peer transcript, require the peer path to remain contained by that store, and persist only the canonical path in lease v6.
3. Implement lease v6 validation and CLI status/arm/disarm composition without a cross-runtime state cursor.
4. Keep lease state owner-only and structural.
5. Format: `pnpm exec oxfmt --write skills/session-observer-collab/scripts/lib/lease-state.mjs skills/session-observer-collab/scripts/lib/lease-state.d.ts skills/session-observer-collab/scripts/collab-control.mjs tests/session-observer-collab/control.test.ts`.
6. Verify: `pnpm exec vitest run tests/session-observer-collab/control.test.ts`.
7. Commit: `feat(p04-t02): migrate collaboration leases to v6`.

### Task p04-t03: Bind collaboration CAS to private continuity

**Requirements:** FR8, NFR1, NFR2

**Files:**

- Modify: `skills/session-observer-collab/scripts/lib/runtime-adapter.mjs`
- Modify: `skills/session-observer-collab/scripts/lib/runtime-adapter.d.ts`
- Modify: `tests/session-observer-collab/cursor-hook.test.ts`
- Modify: `tests/session-observer-collab/codex-hook.test.ts`

**Steps:**

1. Add RED exact-path/device/inode/prefix mismatch, stored-path substitution, and use-time symlink escape tests that leave the trigger, private cursor, and lease unchanged.
2. Before every completion read, realpath-canonicalize the supported Cursor store and leased transcript again, require store containment, and compare the result with the arm-time canonical path.
3. Thread private continuity through both collaboration CAS routes and preserve owner/peer/session/cwd validation.
4. Do not reuse the observer projection cursor.
5. Format: `pnpm exec oxfmt --write skills/session-observer-collab/scripts/lib/runtime-adapter.mjs skills/session-observer-collab/scripts/lib/runtime-adapter.d.ts tests/session-observer-collab/cursor-hook.test.ts tests/session-observer-collab/codex-hook.test.ts`.
6. Verify: `pnpm exec vitest run tests/session-observer-collab/cursor-hook.test.ts tests/session-observer-collab/codex-hook.test.ts`.
7. Commit: `feat(p04-t03): bind collaboration cursor to continuity`.

### Task p04-t04: Consume Cursor confirmed-completion frames

**Requirements:** FR3, FR4, FR8, NFR1, NFR2

**Files:**

- Modify: `skills/session-observer-collab/scripts/hooks/cursor-stop.mjs`
- Modify: `skills/session-observer-collab/scripts/hooks/cursor-stop.d.ts`
- Modify: `tests/session-observer-collab/cursor-hook.test.ts`

**Steps:**

1. Add RED pending/non-success/malformed/shrink/replacement/no-op/cap/idle/late-output cases over frame ranges.
2. Replace legacy record-index digest consumption with Cursor v2 confirmed-completion selection and lease-private continuity.
3. Advance private cursor/checkpoint only in the successful lease CAS; keep failure output structural.
4. Format: `pnpm exec oxfmt --write skills/session-observer-collab/scripts/hooks/cursor-stop.mjs skills/session-observer-collab/scripts/hooks/cursor-stop.d.ts tests/session-observer-collab/cursor-hook.test.ts`.
5. Verify: `pnpm exec vitest run tests/session-observer-collab/cursor-hook.test.ts tests/session-observer-collab/completion.test.ts`.
6. Commit: `feat(p04-t04): consume cursor completion frames safely`.

### Task p04-t05: Version the wake envelope contract

**Requirements:** FR8, NFR3

**Files:**

- Modify: `skills/session-observer-collab/scripts/hooks/cursor-stop.mjs`
- Modify: `skills/session-observer-collab/scripts/hooks/codex-stop.mjs`
- Modify: `src/transcript/core/runtimes.ts`
- Modify: `tests/session-observer-collab/wake-envelope-contract.test.ts`
- Modify: `tests/transcript-core/runtimes.test.ts`
- Generate: `skills/session-observer/scripts/lib/runtimes.mjs`
- Generate: `skills/export-session-transcript/scripts/lib/runtimes.mjs`

**Steps:**

1. Add RED v2 envelope attributes (`schema_version`, `index_base`), legacy v1 compatibility, and malformed/missing-attribute fail-closed cases.
2. Emit v2 from updated producers and parse both contracts in the shared automatic-control parser.
3. Preserve advisory automatic provenance and producer-side lease CAS as the authority boundary.
4. Format: `pnpm exec oxfmt --write skills/session-observer-collab/scripts/hooks/cursor-stop.mjs skills/session-observer-collab/scripts/hooks/codex-stop.mjs src/transcript/core/runtimes.ts tests/session-observer-collab/wake-envelope-contract.test.ts tests/transcript-core/runtimes.test.ts`.
5. Verify: `pnpm exec vitest run tests/session-observer-collab/wake-envelope-contract.test.ts tests/transcript-core/runtimes.test.ts && pnpm run build && pnpm run build:check`.
6. Commit: `feat(p04-t05): version collaboration wake envelopes`.

### Task p04-t06: Run the collaboration safety regression matrix

**Requirements:** FR8, NFR1, NFR2, NFR3, NFR5

**Files:**

- Modify as required by failures: `tests/session-observer-collab/*.test.ts`
- Modify as required by failures: `skills/session-observer-collab/scripts/**/*.mjs`

**Steps:**

1. Add any missing regression cases for pending content, terminal failure, synthetic/no-op/metadata-only turns, caps, expiry, stale CAS, duplicate event, restart, disarm, and legacy non-Cursor paths.
2. Fix only regressions exposed by the matrix; do not turn live Cursor continuation into an automated-support claim.
3. Format changed non-generated authored/test files through the repository exclusions: `pnpm exec lint-staged --diff origin/main --diff-filter ACMR`.
4. Verify: `pnpm exec vitest run tests/session-observer-collab && pnpm run smoke && pnpm run type-check`.
5. Commit: `test(p04-t06): cover collaboration completion safety`.

## Phase 5: Acceptance Evidence, Documentation, and Release Readiness

### Task p05-t01: Record the baseline capability matrix

**Requirements:** FR9, NFR2, NFR6

**Files:**

- Modify: `skills/session-observer-collab/references/runtime-cursor.md`
- Create: `scripts/validate-cursor-evidence.mjs`
- Create: `tests/tooling/cursor-evidence-validation.test.ts`

**Steps:**

1. Refresh the sanitized host/provider/version/store/path-shape/identity/action/outcome fields for the measured agent-transcript baseline established in p01-t01.
2. Label fixture-only rows `automated-only` and unprobed provider behavior `documented-but-unvalidated`; retain failure/unavailable as valid evidence outcomes.
3. Store no transcript prose, raw session IDs, absolute personal paths, or credentials.
4. Implement a repeatable validator over durable Cursor evidence, fixtures, and changed docs that detects POSIX/Windows personal absolute paths, raw session/lease/identity values, credential shapes, and transcript-prose canaries while allowing documented redacted examples.
5. Format: `pnpm exec oxfmt --write skills/session-observer-collab/references/runtime-cursor.md scripts/validate-cursor-evidence.mjs tests/tooling/cursor-evidence-validation.test.ts`.
6. Verify: `pnpm exec vitest run tests/tooling/cursor-evidence-validation.test.ts && node scripts/validate-cursor-evidence.mjs && pnpm run validate`.
7. Commit: `test(p05-t01): validate cursor capability evidence`.

### Task p05-t02: Run observed-side live Cursor acceptance

**Requirements:** FR2, FR3, FR4, FR5, FR6, FR7, FR9, NFR2, NFR5, NFR6

**Files:**

- Modify: `skills/session-observer-collab/references/runtime-cursor.md`
- Create: `scripts/probe-cursor-acceptance.mjs`
- Create: `tests/tooling/cursor-acceptance-probe.test.ts`
- Modify only if the probe exposes a defect: canonical source/tests from Phases 1-3
- Generate if canonical TypeScript changes: every mapped output reported by `scripts/build-generated.mjs`

**Steps:**

1. Add a finite JSON-emitting harness that runs `whoami`, exact `locate`, pinned `catch-up`, and bounded `catch-up-then-watch` against an available controlled Cursor session, recording each expected/actual structural row and failing any row whose command was not run.
2. If Cursor is unavailable, record `unavailable` and retain `documented-but-unvalidated`; do not fabricate evidence or block automated core completion.
3. Keep real provider transcripts strictly read-only. Copy sanitized structural fixtures into a temporary store for second-scan stability, success/abort/error/cancel, malformed/partial repair, shrink/replacement, restart, and reset/replay scenarios; never mutate a live provider transcript.
4. Capture only structural/redacted commands, versions, actions, and outcomes. Fix reproducible correctness defects with a targeted test before code; when canonical TypeScript changes, run `pnpm run build`, include every affected generated output in this task, and require `pnpm run build:check` before commit.
5. Format changed non-generated source/docs/test files through the repository exclusions: `pnpm exec lint-staged --diff origin/main --diff-filter ACMR`.
6. Verify: `pnpm exec vitest run tests/tooling/cursor-acceptance-probe.test.ts && node scripts/probe-cursor-acceptance.mjs --runtime cursor --cwd "$PWD" --json && node scripts/validate-cursor-evidence.mjs` plus focused tests for any defect fixed and, after canonical TypeScript fixes, `pnpm run build:check`.
7. Commit: `test(p05-t02): record cursor observation acceptance`.

### Task p05-t03: Probe the bounded collaboration lifecycle

**Requirements:** FR8, FR9, FR10, NFR1, NFR2, NFR6

**Files:**

- Modify: `skills/session-observer-collab/references/runtime-cursor.md`
- Modify only if the probe exposes a defect: collaboration source/tests from Phase 4

**Steps:**

1. Only after observed-side acceptance passes, arm an exact lease, invoke the actual provider Stop event, inspect structural status, and disarm/prune.
2. Verify terminal success, terminal failure, pending/no-op suppression, exact range, lease CAS, and cleanup without widening authority.
3. Treat unavailable or failed live continuation as a valid `documented-but-unvalidated` result and keep buffered-manual fallback.
4. Format changed non-generated authored/docs/test files through the repository exclusions: `pnpm exec lint-staged --diff origin/main --diff-filter ACMR`.
5. Verify focused collaboration tests plus the sanitized command sequence recorded in `runtime-cursor.md`, then run `node scripts/validate-cursor-evidence.mjs`.
6. Commit: `test(p05-t03): record cursor collaboration acceptance`.

### Task p05-t04: Author shipped behavior documentation through OAT

**Requirements:** FR5, FR7, FR8, FR9, NFR3, NFR6

**Files:**

- Modify through `oat-project-document`: `documentation/docs/user-guide/skills/session-observer.md`
- Modify through `oat-project-document`: `documentation/docs/user-guide/skills/session-observer-collab.md`
- Modify through `oat-project-document`: `documentation/docs/engineering/architecture/transcript-core.md`
- Modify through `oat-project-document`: `documentation/docs/engineering/architecture/generated-runtime.md`
- Modify: `skills/session-observer/{SKILL.md,references/watch-design.md,references/transcript-formats.md}`
- Modify: `skills/session-observer-collab/SKILL.md`

**Steps:**

1. Invoke `oat-project-document` and follow `documentation/AGENTS.md`; update existing pages rather than creating a new navigation branch.
2. Document content-first observation, terminal-only completion, exact identity, continuity/recovery, state v2, status facets, envelope/lease versions, generated-module topology, and honest support labels.
3. Remove stale record-index-only Cursor guidance from both shipped skills; make collaboration raw-evidence and completion instructions dispatch explicitly by digest schema and index base while preserving non-Cursor behavior.
4. Format changed non-generated skill/docs files through the repository exclusions: `pnpm exec lint-staged --diff origin/main --diff-filter ACMR`.
5. Verify: `pnpm --dir documentation run docs:format:check && pnpm --dir documentation run build && node scripts/validate-cursor-evidence.mjs && pnpm run validate`; confirm both skills and `runtime-cursor.md` agree on schema/index semantics.
6. Commit: `docs(p05-t04): document cursor reliability contracts`.

### Task p05-t05: Bump changed skill versions and dogfood providers

**Requirements:** NFR3, NFR4, NFR6

**Files:**

- Modify: `skills/session-observer/SKILL.md`
- Modify: `skills/export-session-transcript/SKILL.md`
- Modify: `skills/session-observer-collab/SKILL.md`
- Refresh generated/provider mirrors through repository commands

**Steps:**

1. Bump top-level and metadata versions for all three changed canonical skills; do not invoke the release-wide bump script without a chosen release version.
2. Format the canonical skill files before any provider sync: `pnpm exec oxfmt --write skills/session-observer/SKILL.md skills/export-session-transcript/SKILL.md skills/session-observer-collab/SKILL.md`; generated outputs and provider mirrors remain excluded.
3. Run `pnpm run build`, then verify mappings and skill versions against `origin/main`.
4. For each changed standalone skill, copy/link the current branch version into its canonical user install at `~/.agents/skills/<name>/`, verify its version/content, and verify any `~/.claude/skills/<name>` or `~/.cursor/skills/<name>` entry resolves to that canonical copy before running `oat sync --scope user`.
5. Check `oat status --scope all --json`, refresh repository views with `oat sync --scope all`, and confirm dogfooding is exercising the branch version rather than a stale main install.
6. Do not claim a Cursor skill mirror when the provider exposes only agents/rules; record actual provider status.
7. Verify: `pnpm run build:check && pnpm run validate:skill-versions -- --base-ref origin/main && oat status --scope all --json`.
8. Commit: `chore(p05-t05): version and sync cursor reliability skills`.

### Task p05-t06: Run pre-wake gates and close satisfied baseline backlog items

**Requirements:** FR9, NFR3, NFR4, NFR5, NFR6

**Files:**

- Modify if acceptance criteria are satisfied: `.oat/repo/pjm/backlog/index.md`
- Modify if acceptance criteria are satisfied: `.oat/repo/pjm/backlog/completed.md`
- Move if satisfied: `.oat/repo/pjm/backlog/items/BL-260713-cursor-transcript-store.md` to `.oat/repo/pjm/backlog/archived/`
- Modify if the operating picture changes: `.oat/repo/pjm/current-state.md`
- Modify only for verified failures: exact source/test/docs files implicated by a gate

**Steps:**

1. Re-read the transcript-store item and close it only if its acceptance criteria are satisfied; leave stronger-wake disposition to Phase 6.
2. If closing it, set terminal `status: closed` and `updated`, prepend the required entry to `backlog/completed.md`, `git mv` the item into `backlog/archived/`, run `oat backlog regenerate-index`, and update `current-state.md` plus the curated index overview when the operating picture changed. Complete every lifecycle step or none.
3. Enumerate changed files with `git diff --name-only --diff-filter=ACMR origin/main...HEAD`, then run the exact changed-file oxlint and oxfmt-check pipelines from `.github/workflows/validate.yml`, including its `.oat`/generated/provider/instruction exclusions; do not substitute the whole-repository lint/format shortcuts.
4. Run generated/runtime/type/test/validation/smoke/docs gates and confirm a clean generated tree. Fix failures narrowly with focused tests, then repeat the failed and aggregate gates.
5. Format changed non-generated files through the repository exclusions: `pnpm exec lint-staged --diff origin/main --diff-filter ACMR`.
6. Verify: changed-file oxlint/oxfmt checks, then `node scripts/validate-cursor-evidence.mjs && pnpm run build && pnpm run type-check && pnpm run build:check && pnpm run test && pnpm run validate && pnpm run smoke && pnpm --dir documentation run docs:format:check && pnpm --dir documentation run build && pnpm run validate:skill-versions -- --base-ref origin/main && oat status --scope all --json`.
7. Commit: `chore(p05-t06): verify baseline cursor reliability release gates`.

## Phase 6: Conditional Stronger Wake Evaluation

### Task p06-t01: Measure same-parent Stop callback delivery

**Requirements:** FR10, NFR1, NFR2, NFR6

**Files:**

- Modify: `skills/session-observer-collab/references/runtime-cursor.md`
- Modify only when supported and verified: bounded collaboration hook/tests

**Steps:**

1. Probe whether the real Cursor Stop surface can deliver a v2 envelope into the same parent conversation with exact identity and one-consumer semantics.
2. Record success, failure, or unavailable structurally; do not add an executor or broaden hook authority to force success.
3. Implement only the strongest already-available bounded tier proven by the probe, with focused tests and disarm/restart recovery.
4. Format changed non-generated authored/reference/test files through the repository exclusions: `pnpm exec lint-staged --diff origin/main --diff-filter ACMR`.
5. Verify the recorded live command, `pnpm exec vitest run tests/session-observer-collab`, and `node scripts/validate-cursor-evidence.mjs`.
6. Commit: `test(p06-t01): evaluate cursor stop callback delivery`.

### Task p06-t02: Evaluate managed callback surfaces in order

**Requirements:** FR10, NFR1, NFR5, NFR6

**Files:**

- Modify: `skills/session-observer-collab/references/runtime-cursor.md`
- Modify only when an effective surface exists: collaboration control/hook/tests

**Steps:**

1. If same-parent Stop delivery is insufficient, evaluate existing managed local/subagent callback capability; only then evaluate a scheduled callback surface that already exists.
2. Verify callback effectiveness, exact ownership, bounded polling, interruption/restart, duplicate suppression, and cleanup before implementing any adapter.
3. Never introduce a background LLM, scheduler, daemon, credential, or external service solely to satisfy this task; `unavailable` is valid.
4. Format changed non-generated authored/reference/test files through the repository exclusions: `pnpm exec lint-staged --diff origin/main --diff-filter ACMR`.
5. Verify focused tests for any implemented adapter plus the sanitized live evidence record, then run `node scripts/validate-cursor-evidence.mjs`.
6. Commit: `test(p06-t02): evaluate managed cursor wake surfaces`.

### Task p06-t03: Finalize wake-tier and fallback claims

**Requirements:** FR9, FR10, NFR2, NFR3, NFR6

**Files:**

- Modify: `skills/session-observer-collab/references/runtime-cursor.md`
- Modify through `oat-project-document` if claims changed: `documentation/docs/user-guide/skills/session-observer-collab.md`

**Steps:**

1. Select the highest evidence-backed tier: same-parent callback, managed callback, or buffered-manual fallback.
2. Align provider/reference/docs labels to that evidence; do not imply marketplace/provider support beyond the verified path.
3. Record whether the stronger-wake backlog acceptance criteria are met; defer any terminal backlog mutation to p06-t04 so the full lifecycle and release closeout remain atomic.
4. Format changed non-generated files through the repository exclusions: `pnpm exec lint-staged --diff origin/main --diff-filter ACMR`.
5. Verify: `node scripts/validate-cursor-evidence.mjs && pnpm run validate && pnpm --dir documentation run docs:format:check && pnpm --dir documentation run build && pnpm run smoke`.
6. Commit: `docs(p06-t03): finalize cursor wake evidence tier`.

### Task p06-t04: Reconcile versions, providers, backlog, and final release gates

**Requirements:** FR9, NFR3, NFR4, NFR5, NFR6

**Files:**

- Modify when Phase 6 changed a shipped skill: `skills/{session-observer,export-session-transcript,session-observer-collab}/SKILL.md`
- Refresh when canonical TypeScript changed: generated runtime outputs declared by `scripts/build-generated.mjs`
- Refresh when a shipped skill changed: user/provider mirrors through the repository dogfood procedure
- Modify if stronger-wake criteria are satisfied: `.oat/repo/pjm/backlog/{completed.md,index.md}` and `.oat/repo/pjm/current-state.md`
- Move if satisfied: `.oat/repo/pjm/backlog/items/BL-260713-stronger-cursor-collaboration.md` to `.oat/repo/pjm/backlog/archived/`

**Steps:**

1. Diff Phase 6 against its start. If any canonical skill directory changed, bump every affected skill's top-level and metadata version; if canonical TypeScript changed, run `pnpm run build` and include all generated outputs in this task.
2. If canonical skill metadata changed, format the canonical files before sync: `pnpm exec oxfmt --write skills/session-observer/SKILL.md skills/export-session-transcript/SKILL.md skills/session-observer-collab/SKILL.md`; never directly format generated outputs or provider mirrors.
3. If a shipped standalone skill changed, repeat the branch dogfood copy/link verification and `oat sync --scope user`; refresh repository views with `oat sync --scope all`, verify actual provider paths/versions, and retain the post-merge reconciliation note.
4. If the stronger-wake item is satisfied, set terminal status/date, prepend `backlog/completed.md`, `git mv` it to `backlog/archived/`, run `oat backlog regenerate-index`, and conditionally refresh `current-state.md` and the curated overview. Otherwise keep it open with the evidence-backed next step.
5. Enumerate changed files with `git diff --name-only --diff-filter=ACMR origin/main...HEAD` and run the exact changed-file oxlint/oxfmt-check pipelines from `.github/workflows/validate.yml`; never run whole-repository lint/format checks.
6. Verify the final tree: `node scripts/validate-cursor-evidence.mjs && pnpm run build && pnpm run type-check && pnpm run build:check && pnpm run test && pnpm run validate && pnpm run smoke && pnpm --dir documentation run docs:format:check && pnpm --dir documentation run build && pnpm run validate:skill-versions -- --base-ref origin/main && oat status --scope all --json`.
7. Confirm no generated drift, stale changed-skill versions, partial backlog closeout, or branch-only provider mirror remains unexplained.
8. Commit: `chore(p06-t04): complete final cursor reliability release gates`.

## Reviews

| Scope  | Type     | Status          | Date       | Artifact                                                                  |
| ------ | -------- | --------------- | ---------- | ------------------------------------------------------------------------- |
| p01    | code     | pending         | -          | -                                                                         |
| p02    | code     | pending         | -          | -                                                                         |
| final  | code     | pending         | -          | -                                                                         |
| spec   | artifact | pending         | -          | -                                                                         |
| design | artifact | fixes_completed | 2026-07-20 | reviews/archived/artifact-design-review-2026-07-20T233233Z.md            |
| plan   | artifact | pending         | -          | -                                                                         |
| plan   | artifact | fixes_completed | 2026-07-22 | reviews/artifact-plan-review-2026-07-23T022120Z.md                        |
| p03    | code     | pending         | -          | -                                                                         |
| p04    | code     | pending         | -          | -                                                                         |
| p05    | code     | pending         | -          | -                                                                         |
| p06    | code     | pending         | -          | -                                                                         |
| p01    | code     | fixes_completed | 2026-07-22 | reviews/p01-review-2026-07-23T035505Z.md                                  |
| p01    | code     | passed          | 2026-07-22 | reviews/p01-review-2026-07-23T040650Z.md                                  |
| plan   | artifact | fixes_completed | 2026-07-22 | reviews/artifact-plan-review-2026-07-23T023750Z.md                        |
| plan   | artifact | passed          | 2026-07-22 | reviews/archived/artifact-plan-review-2026-07-23T025554Z.md               |
| p02    | code     | fixes_completed | 2026-07-23 | reviews/p02-review-2026-07-23T045715Z.md                                  |
| p02    | code     | fixes_completed | 2026-07-23 | reviews/p02-review-2026-07-23T051820Z.md                                  |
| p02    | code     | fixes_completed | 2026-07-23 | reviews/p02-review-2026-07-23T054702Z.md                                  |
| p02    | code     | fixes_completed | 2026-07-23 | reviews/archived/p02-review-2026-07-23T114732Z.md                         |
| p02    | code     | passed          | 2026-07-23 | reviews/p02-review-2026-07-23T164415Z.md                                  |
| p03    | code     | fixes_completed | 2026-07-23 | reviews/p03-review-2026-07-23T211458Z.md                                  |
| p03    | code     | passed          | 2026-07-23 | reviews/p03-review-2026-07-23T214213Z.md                                  |
| p04    | code     | fixes_completed | 2026-07-23 | reviews/p04-review-2026-07-23T224300Z.md                                  |
| p04    | code     | passed          | 2026-07-23 | reviews/p04-review-2026-07-23T230346Z.md                                  |
| p05    | code     | fixes_completed | 2026-07-24 | reviews/p05-review-2026-07-24T001656Z.md                                  |
| p05    | code     | passed          | 2026-07-24 | reviews/p05-review-2026-07-24T004530Z.md                                  |
| p06    | code     | fixes_completed | 2026-07-24 | reviews/p06-review-2026-07-24T012320Z.md                                  |
| p06    | code     | fixes_completed | 2026-07-24 | reviews/p06-review-2026-07-24T015318Z.md                                  |
| p06    | code     | passed          | 2026-07-24 | reviews/p06-review-2026-07-24T023404Z.md                                  |
| final  | code     | fixes_completed | 2026-07-24 | reviews/final-review-2026-07-24T025100Z.md                                |
| final  | code     | fixes_completed | 2026-07-24 | reviews/final-review-2026-07-24T031130Z.md                                |
| final  | code     | passed          | 2026-07-24 | reviews/final-review-2026-07-24T032809Z.md                                |
| final  | code     | received        | 2026-07-24 | reviews/final-review-2026-07-24T034752Z.md                                |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

**Meaning:**

- `received`: review artifact exists but findings have not yet been converted into fixes.
- `fixes_added`: review findings have stable plan tasks.
- `fixes_completed`: fixes are implemented and awaiting re-review.
- `passed`: the latest review has no unresolved Critical, Important, or Medium findings; any accepted deferral is recorded through the review-receive workflow.

## Implementation Complete

**Summary:**

- Phase 1: 5 tasks — streaming framing, analysis, shared classification, and generated core outputs.
- Phase 2: 8 tasks — exact identity, isolated state v2, crash-safe migration, continuity, delivery CAS, atomic lock publication, raw-alias containment, and recovery guidance.
- Phase 3: 7 tasks — digest v2, observation, foreground watch, status, and CLI composition.
- Phase 4: 6 tasks — completion schema routing, lease v6, private continuity, Cursor hook, and envelope v2.
- Phase 5: 6 tasks — live evidence, documentation, versions/provider dogfood, release gates, and backlog lifecycle.
- Phase 6: 4 tasks — conditional wake-surface measurement, evidence-backed fallback selection, and final release reconciliation.

**Total: 36 tasks**

Ready for code review and merge after all tasks and review rows pass.

## References

- Design: `design.md`
- Specification: `spec.md`
- Discovery: `discovery.md`
- Implementation journal: `implementation.md`
- Cursor evidence: `skills/session-observer-collab/references/runtime-cursor.md`
- Repository knowledge: `.oat/repo/knowledge/project-index.md`
- Backlog: `.oat/repo/pjm/backlog/items/BL-260713-cursor-transcript-store.md`, `.oat/repo/pjm/backlog/items/BL-260713-stronger-cursor-collaboration.md`
