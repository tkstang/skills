---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-07-24
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ['p06']
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

## Phase 7: Configured Exit-Gate Remediation

### Task p07-t01: Bind selected Cursor success bytes through collaboration CAS

**Requirements:** FR3, FR4, FR8, NFR1, NFR6

**Files:**

- Modify: `skills/session-observer-collab/scripts/hooks/cursor-stop.mjs`
- Modify: `skills/session-observer-collab/scripts/hooks/codex-stop.mjs`
- Create or modify: `skills/session-observer-collab/scripts/lib/{selected-prefix helper}.mjs`
- Modify if the trusted snapshot rides the selection contract: `skills/session-observer-collab/scripts/lib/completion-selection.{mjs,d.ts}`
- Modify if a helper is added: `skills/session-observer-collab/scripts/lib/codex-install.mjs`
- Modify: `tests/session-observer-collab/{cursor-hook,codex-hook,completion,codex-install}.test.ts`
- Modify when behavior wording needs alignment: `documentation/docs/user-guide/skills/session-observer-collab.md`
- Modify: `skills/session-observer-collab/SKILL.md`

**Steps:**

1. Add RED shipped-runtime hook regressions for both Cursor-owner and Codex-owner routes that rewrite a selected `success` terminal to `aborted`, `error`, `cancelled`, and `unknown` between observation and lease CAS; prove current behavior can emit a wake, spend continuation budget, and advance state from a stale selection.
2. Carry a trusted selected-prefix byte boundary, hash, device, and inode from the observation scan into the selected completion result. Share bounded prefix re-read verification between both hooks and use that same verified snapshot as the proposed lease checkpoint.
3. Fail closed on any identity or selected-prefix mismatch: emit no wake, spend no continuation/loop budget, and advance neither private cursor nor checkpoint. Preserve the unchanged-success path and existing owner/lease/CAS semantics.
4. If a new authored helper is introduced, add it to the Codex install bundle and extend installed-bundle coverage.
5. Bump session-observer-collab from 1.0.9 to 1.0.10 with top-level and metadata versions synchronized. Format only changed non-generated files with `pnpm exec oxfmt --write <changed paths>`.
6. Verify GREEN: `pnpm exec vitest run tests/session-observer-collab/cursor-hook.test.ts tests/session-observer-collab/codex-hook.test.ts tests/session-observer-collab/completion.test.ts tests/session-observer-collab/codex-install.test.ts`; run the collaboration aggregate, validation, smoke, version enforcement, and any changed documentation checks.
7. Dogfood the changed collaboration skill through the repository procedure, verify provider mirrors, and run `oat sync --scope user`.
8. Commit: `fix(p07-t01): bind cursor success selection through cas`.

### Task p07-t02: Confirm bounded stability prefixes during transcript growth

**Requirements:** FR2, FR7, NFR6

**Files:**

- Modify: `src/transcript/session-observer/lib/observe.ts`
- Modify only if the state API must expose the exact boundary: `src/transcript/session-observer/lib/cursor-state.ts`
- Modify: `tests/session-observer/{observe,watch,cursor-state}.test.ts`
- Generate: `skills/session-observer/scripts/lib/observe.mjs`
- Generate only if canonical state changes: `skills/session-observer/scripts/lib/cursor-state.mjs`
- Modify: `skills/session-observer/SKILL.md`

**Steps:**

1. Add RED one-shot and foreground-watch regressions that append substantive frame B during frame A's confirmation interval, plus continuous growth through `max-pending-sec`; prove the current implementation restarts the candidate through B and can starve A.
2. Confirm the original observation's exact boundary and entry keys against the second scan's `verifiedPrefixSha256`, rather than checkpointing the second scan's later safe boundary.
3. Build and reserve the continuity checkpoint through the digest's verified `nextIndex` even when the file has later safe bytes. Deliver A at its confirmed boundary and retain B/later growth as the next candidate or buffered suffix without replay or loss.
4. Preserve replacement/shrink failure, delivery CAS, max-pending, partial-tail, and ownership semantics.
5. Edit canonical TypeScript only, run `pnpm run build`, and never hand-edit generated runtime output. Bump session-observer from 1.0.11 to 1.0.12 with both version fields synchronized.
6. Format canonical/test/metadata files with `pnpm exec oxfmt --write <changed non-generated paths>`.
7. Verify GREEN: `pnpm exec vitest run tests/session-observer/observe.test.ts tests/session-observer/watch.test.ts tests/session-observer/cursor-state.test.ts && pnpm run type-check && pnpm run build:check`; run the full observer aggregate, validation, and smoke.
8. Dogfood session-observer 1.0.12 byte-identically, verify provider mirrors, run `oat sync --scope user`, and commit: `fix(p07-t02): confirm bounded cursor stability prefix`.

### Task p07-t03: Select a completed prefix before a pending Cursor turn

**Requirements:** FR3, FR8, NFR6

**Files:**

- Modify: `skills/session-observer-collab/scripts/lib/completion-selection.mjs`
- Modify if the selection/checkpoint type changes: `skills/session-observer-collab/scripts/lib/completion-selection.d.ts`
- Modify: `tests/session-observer-collab/{completion,cursor-hook,codex-hook}.test.ts`
- Modify: `skills/session-observer-collab/SKILL.md`

**Steps:**

1. Convert the valid terminal-success-prefix plus pending-turn rejection fixture into a RED acceptance regression, and add Cursor-owner and Codex-owner hook cases proving the completed prefix is currently missed with an `observer-invalid` diagnostic.
2. Accept a complete, unsliced terminal-successful prefix followed only by a structurally valid `stability-wait` suffix. Select and checkpoint through the completed terminal frame while leaving the later open turn unread.
3. Continue to reject malformed, partial, tail-sliced, discontinuous, or otherwise unaccounted ranges. Reuse p07-t01's trusted selected-prefix/checkpoint seam so relaxing suffix validation does not reopen the stale-success race.
4. Verify GREEN across completion selection and both hook owners, including no duplicate wake and correct private cursor/continuation accounting.
5. Bump session-observer-collab from 1.0.10 to 1.0.11 with top-level and metadata versions synchronized. Format changed authored/test/metadata files with `pnpm exec oxfmt --write <changed paths>`.
6. Run `pnpm exec vitest run tests/session-observer-collab/completion.test.ts tests/session-observer-collab/cursor-hook.test.ts tests/session-observer-collab/codex-hook.test.ts`, the collaboration aggregate, validation, smoke, and skill-version enforcement.
7. Dogfood the changed collaboration skill, verify provider mirrors, run `oat sync --scope user`, and commit: `fix(p07-t03): select completed cursor prefix before pending turn`.

### Task p07-t04: Make exit-gate bookkeeping evidence-safe and rerun release gates

**Requirements:** FR9, NFR2, NFR6

**Files:**

- Modify: `scripts/validate-cursor-evidence.mjs`
- Modify: `tests/tooling/cursor-evidence-validation.test.ts`
- Modify through OAT closeout bookkeeping: `.oat/projects/shared/cursor-collaboration-reliability/{state.md,project-log.md}`
- Modify if privacy policy needs public clarification outside shipped skill trees: `documentation/docs/engineering/{relevant page}.md`

**Steps:**

1. Preserve a RED end-to-end fixture for accepted configured-gate bookkeeping and the live current-branch failure. Distinguish typed gate IDs, git SHAs, and structural fingerprints from transcript session/lease identities while continuing to reject real raw identities, credentials, transcript prose, and `/Users/...` paths.
2. Keep result receipts, stderr, and exit codes in ignored local OAT state. After terminal receipt/receive reconciliation, replace transient system-temp marker paths in tracked state with a repo-neutral logical marker reference while retaining run/artifact correlation; never rewrite append-only project-log history.
3. Narrow validator policy structurally rather than globally allowlisting long hexadecimal strings. Add tests that safe typed gate/SHA/fingerprint fields pass and the corresponding unsafe identity/path fixtures still fail.
4. If the configured gate rerun recreates an unavoidable tracked machine-local path, stop and escalate the durable writer defect to the upstream OAT repository; do not claim repository-local remediation is complete.
5. Format changed source/tests/docs with the repository's file-scoped `pnpm exec oxfmt --write <changed paths>` command.
6. Verify GREEN: `pnpm exec vitest run tests/tooling/cursor-evidence-validation.test.ts && node scripts/validate-cursor-evidence.mjs --base-ref 8c006a5abd8e2e5e97cfa1f26d81cc82ac15b773`.
7. Run the complete final matrix: build, type-check, build-check, full tests, validate, smoke, 34-file evidence validation, internal flags, changed-file lint/format, documentation format/build, skill-version enforcement, provider dogfood/sync, privacy, and probe-residue cleanup. Confirm session-observer 1.0.12 and session-observer-collab 1.0.11 are synchronized.
8. Commit: `fix(p07-t04): make gate bookkeeping evidence safe`.

## Phase 8: Terminal Exit-Gate Findings

The second configured gate attempt retained 13 active findings. This phase is
sequential because observer delivery, stability, identity, digest, collaboration,
evidence, and release bookkeeping share generated outputs and final verification.
The configured gate has exhausted its two-attempt remediation allowance; these
tasks are queued for explicit recovery authorization and do not authorize a
third gate launch.

### Task p08-t01: (review) Await native stdout delivery before checkpoint commit

**Task Scope:** Moderate
**Requirements:** FR6, NFR1

**Files:**

- Modify: `src/transcript/session-observer/session-observer.ts`
- Modify: `src/transcript/session-observer/lib/watch.ts`
- Modify: `tests/session-observer/{integration,watch}.test.ts`
- Generate: `skills/session-observer/scripts/{session-observer.mjs,lib/watch.mjs}`
- Modify: `skills/session-observer/SKILL.md`

**Steps:**

1. Add RED one-shot and watch regressions using boolean-returning native-style sinks with delayed callbacks and asynchronous errors; prove the current path can commit before delivery completes.
2. Make the production stdout adapter and watch sink contract await callback-confirmed completion and fail closed on pending-write errors before committing a reservation.
3. Preserve custom async sink compatibility, delivery CAS ownership, and retry semantics; rebuild canonical TypeScript outputs and bump the changed skill version.
4. Verify focused integration/watch tests, type-check, generated parity, validation, smoke, version enforcement, and dogfood synchronization.
5. Commit: `fix(p08-t01): await cursor stdout delivery`.

### Task p08-t02: (review) Advance beyond delivered same-turn stability candidates

**Task Scope:** Moderate
**Requirements:** FR2, FR6

**Files:**

- Modify: `src/transcript/session-observer/lib/observe.ts`
- Modify if state representation changes: `src/transcript/session-observer/lib/cursor-state.ts`
- Modify: `tests/session-observer/{observe,watch,cursor-state}.test.ts`
- Generate: `skills/session-observer/scripts/lib/{observe,cursor-state}.mjs`
- Modify: `skills/session-observer/SKILL.md`

**Steps:**

1. Add RED repeated-scan cases that deliver candidate A, append B in the same open turn, and prove B remains stranded behind the committed boundary.
2. Never reinstall a candidate whose entry keys are already committed; after confirming the old boundary, derive and persist the next safe suffix candidate.
3. Preserve p07 bounded-prefix behavior, exact-once reservation, partial-tail handling, replacement failure, and watch progress; rebuild generated outputs and bump the skill version.
4. Verify focused observe/watch/state tests plus the Session Observer aggregate, type-check, build-check, validation, smoke, dogfood, and user sync.
5. Commit: `fix(p08-t02): advance delivered stability candidate`.

### Task p08-t03: (review) Enforce watch runtime budgets through stability waits

**Task Scope:** Moderate
**Requirements:** FR7, NFR5

**Files:**

- Modify: `src/transcript/session-observer/lib/{watch,observe}.ts`
- Modify: `tests/session-observer/{watch,observe}.test.ts`
- Generate: `skills/session-observer/scripts/lib/{watch,observe}.mjs`
- Modify: `skills/session-observer/SKILL.md`

**Steps:**

1. Add a RED 60 ms runtime / 1,000 ms stability-wait case and bounded flush/baseline variants.
2. Thread remaining-time budgets through observation and flush operations, cap every sleep, and avoid starting work that cannot fit.
3. Preserve normal stability confirmation and max-pending behavior; rebuild generated output and bump the skill version.
4. Verify focused timing tests with deterministic tolerances, the observer aggregate, build/type/build-check, validation, smoke, dogfood, and sync.
5. Commit: `fix(p08-t03): bound cursor watch stability waits`.

### Task p08-t04: (review) Require canonical transcript identity before exact ownership

**Task Scope:** Moderate
**Requirements:** FR1, NFR1

**Files:**

- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Generate: `skills/session-observer/scripts/lib/locate.mjs`
- Modify: `skills/session-observer/SKILL.md`

**Steps:**

1. Add RED missing-path, disappearance, and symlink-swap cases that currently reach exact identity through lexical fallback.
2. Treat required realpath or containment failure as diagnostic/ambiguous and prohibit exact state ownership without a canonical existing transcript.
3. Preserve supported-root and cwd matching diagnostics; rebuild generated output and bump the skill version.
4. Verify locate/CLI/state coverage, build/type/build-check, validation, smoke, dogfood, and sync.
5. Commit: `fix(p08-t04): require canonical cursor identity`.

### Task p08-t05: (review) Reject unsupported top-level assistant content

**Task Scope:** Moderate
**Requirements:** FR2, FR3, FR9

**Files:**

- Modify: `src/transcript/core/cursor-analysis.ts`
- Modify: `tests/transcript-core/cursor-analysis.test.ts`
- Generate: `skills/session-observer/scripts/lib/cursor-analysis.mjs`
- Generate: `skills/export-session-transcript/scripts/lib/cursor-analysis.mjs`
- Modify: `skills/{session-observer,export-session-transcript}/SKILL.md`

**Steps:**

1. Add RED unsupported top-level `content` and missing/non-object `message` fixtures proving they become substantive terminal output.
2. Classify unmeasured shapes as unsupported unless separately evidence-gated; retain measured nested `message.content` behavior and terminal failure handling.
3. Rebuild both generated runtime trees, bump both changed skills, and preserve Export compatibility.
4. Verify analyzer/runtime/Export tests, build/type/build-check, validation, smoke, version enforcement, dogfood, and sync.
5. Commit: `fix(p08-t05): reject unsupported cursor content`.

### Task p08-t06: (review) Bound Cursor digests by structural turn identity

**Task Scope:** Moderate
**Requirements:** FR7, NFR5

**Files:**

- Modify: `src/transcript/session-observer/lib/digest.ts`
- Modify: `tests/session-observer/digest.test.ts`
- Generate: `skills/session-observer/scripts/lib/digest.mjs`
- Modify: `skills/session-observer/SKILL.md`

**Steps:**

1. Add a RED Cursor v2 digest with two distinct `turnId` values and `maxTurns: 1`.
2. Group Cursor entries by structural turn identity while retaining role grouping for runtimes without that identity.
3. Preserve max-message, byte-budget, slicing, and non-Cursor behavior; rebuild generated output and bump the skill version.
4. Verify digest/observe/integration tests, build/type/build-check, validation, smoke, dogfood, and sync.
5. Commit: `fix(p08-t06): bound cursor digest turns`.

### Task p08-t07: (review) Claim substantive completion before safe no-op suffixes

**Task Scope:** Moderate
**Requirements:** FR8

**Files:**

- Modify: `skills/session-observer-collab/scripts/lib/{selected-prefix,runtime-adapter,completion-selection}.mjs`
- Modify if contracts change: `skills/session-observer-collab/scripts/lib/{completion-selection,runtime-adapter}.d.ts`
- Modify: `skills/session-observer-collab/scripts/hooks/{cursor-stop,codex-stop}.mjs`
- Modify: `tests/session-observer-collab/{completion,cursor-hook,codex-hook}.test.ts`
- Modify: `skills/session-observer-collab/SKILL.md`

**Steps:**

1. Add RED cases for a substantive success followed by closed no-op, automatic acknowledgement, and metadata-only suffixes through both owner routes.
2. Bind the verified checkpoint and adapter claim to the selector's chosen completion boundary rather than the full safe digest boundary.
3. Retain full-suffix structural accounting and p07 terminal-rewrite/inode protections; bump and dogfood the collaboration skill.
4. Verify completion and both hook suites, installed-bundle coverage, validation, smoke, version enforcement, and sync.
5. Commit: `fix(p08-t07): claim completion before noop suffix`.

### Task p08-t08: (review) Synchronize collaboration ambient declarations

**Task Scope:** Minor
**Requirements:** NFR3, NFR6

**Files:**

- Modify: `skills/session-observer-collab/scripts/mjs-modules.d.ts`
- Modify: `tests/session-observer-collab/ambient-types.ts`
- Modify if generation is adopted: `scripts/build-generated.mjs`
- Modify: `skills/session-observer-collab/SKILL.md`

**Steps:**

1. Extend the ambient consumer test to exercise `indexBase`, `selectedPrefix`, and `peerContinuity`, and observe the current compile failures.
2. Synchronize or generate the wildcard ambient surface from the specific declarations without weakening runtime types.
3. Bump the collaboration skill version and verify the ambient compile, collaboration aggregate, type-check, validation, version enforcement, dogfood, and sync.
4. Commit: `fix(p08-t08): sync collaboration ambient types`.

### Task p08-t09: (review) Enforce a hard acceptance-probe process timeout

**Task Scope:** Moderate
**Requirements:** FR9, NFR5, NFR6

**Files:**

- Modify: `scripts/probe-cursor-acceptance.mjs`
- Modify: `tests/tooling/cursor-acceptance-probe.test.ts`

**Steps:**

1. Add a RED real-child case that ignores `SIGTERM` and keeps descendants alive.
2. Implement bounded TERM-to-KILL escalation, process-group termination where supported, and a finite resolution deadline.
3. Preserve structured timeout evidence and cleanup safety; verify real termination, normal exit, and platform fallback behavior.
4. Run focused probe tests, validation, smoke, changed-file lint/format, privacy checks, and residue checks.
5. Commit: `fix(p08-t09): hard bound cursor acceptance probe`.

### Task p08-t10: (review) Require provider version evidence for live promotion

**Task Scope:** Minor
**Requirements:** FR9, NFR6

**Files:**

- Modify: `scripts/probe-cursor-wake-surfaces.mjs`
- Modify: `tests/tooling/cursor-wake-probe.test.ts`
- Modify if claims change: `skills/session-observer-collab/references/runtime-cursor.md`

**Steps:**

1. Add a RED result with successful callback/cleanup but unavailable provider version that currently promotes to `live-validated`.
2. Require a passed provider-version row for live promotion; otherwise downgrade the aggregate result and labels to unavailable.
3. Verify promotion taxonomy, sanitized evidence, docs/reference consistency, validation, smoke, and evidence scanning.
4. Commit: `fix(p08-t10): require version for cursor live evidence`.

### Task p08-t11: (review) Verify pre-existing provider state remains unchanged

**Task Scope:** Moderate
**Requirements:** FR9, NFR2, NFR6

**Files:**

- Modify: `scripts/probe-cursor-wake-surfaces.mjs`
- Modify: `tests/tooling/cursor-wake-probe.test.ts`
- Modify if the narrower claim is selected: `skills/session-observer-collab/references/runtime-cursor.md`

**Steps:**

1. Add a RED probe fixture that mutates content within a pre-existing provider entry while preserving directory names.
2. Fingerprint relevant pre-existing entries before and after the probe, or narrow the claim explicitly to newly created artifact removal; fail cleanup evidence on unexplained mutation.
3. Preserve exact ownership and fail-closed cleanup for newly created artifacts.
4. Verify focused probe tests, live-mode cleanup fixtures, evidence validation, privacy, residue, validation, and smoke.
5. Commit: `fix(p08-t11): verify cursor probe preserves provider state`.

### Task p08-t12: (review) Keep active and terminal gate bookkeeping evidence-safe

**Task Scope:** Moderate
**Requirements:** FR9, NFR2, NFR6

**Files:**

- Modify: `scripts/validate-cursor-evidence.mjs`
- Modify: `tests/tooling/cursor-evidence-validation.test.ts`
- Modify through OAT bookkeeping: `.oat/projects/shared/cursor-collaboration-reliability/{state,implementation,project-log}.md`

**Steps:**

1. Preserve RED accepted-launch and prose-fingerprint fixtures reproducing the two current raw-identity failures.
2. Use approved typed fields for fingerprints and repo-neutral `system-temp:` marker references after terminal reconciliation while retaining exact local evidence outside tracked state.
3. Keep structural exceptions file- and field-qualified; continue rejecting raw session/lease IDs, personal paths, credentials, transcript prose, and arbitrary opaque values.
4. Verify focused validator tests and the live merge-base evidence scan before the final release matrix.
5. Commit: `fix(p08-t12): keep gate evidence bookkeeping safe`.

### Task p08-t13: (review) Reconcile Cursor current-state summary

**Task Scope:** Minor
**Requirements:** FR9, NFR6

**Files:**

- Modify: `.oat/repo/pjm/current-state.md`
- Modify if generated rollups change: `.oat/repo/pjm/{backlog/index.md,backlog/completed.md}`
- Modify as required by prior tasks: shipped skill versions, user/provider mirrors, and generated outputs

**Steps:**

1. Refresh the current-state date/headline to match the recorded buffered-manual posture, closed Cursor backlog items, and remaining v2 follow-ups without changing the evidence-backed body.
2. Reconcile every changed skill version, generated output, dogfood install, and provider view after p08-t01 through p08-t12.
3. Verify the current-state claim against the evidence-backed body, closed backlog items, provider-version evidence, generated parity, provider sync, privacy, and residue checks.
4. Commit: `chore(p08-t13): reconcile cursor release state`.

### Task p08-t14: Stabilize acceptance-probe readiness and run final gates

**Task Scope:** Moderate
**Requirements:** FR9, NFR2, NFR6

**Files:**

- Modify: `tests/tooling/cursor-acceptance-probe.test.ts`
- Modify only if the readiness handshake exposes a production defect: `scripts/probe-cursor-acceptance.mjs`

**Steps:**

1. Reproduce the load-sensitive regression where the SIGTERM-resistant child can receive TERM before installing its handler.
2. Add an explicit child-readiness handshake before starting the timeout assertion; keep the production TERM-to-KILL contract and finite process budget unchanged.
3. Verify the acceptance-probe suite repeatedly and as part of the combined focused gate groups that exposed the race.
4. Run the complete focused commands from the gate artifact plus build, type-check, build-check, full tests, validate, smoke, live evidence scan, skill-version/internal-flag gates, docs format/build, changed-file lint/format, provider sync, privacy, and residue checks.
5. Confirm no generated drift, machine-local tracked marker, untyped fingerprint prose, unsupported provider claim, orphan probe process, or provider residue remains.
6. Commit: `test(p08-t14): stabilize acceptance probe readiness`.

### Task p08-t15: (review) Bound exact Cursor identity indexing

**Task Scope:** Moderate
**Requirements:** FR1, NFR5

**Files:**

- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify if a shared path-only helper is required: `src/transcript/core/runtimes.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Modify if the shared helper changes: `tests/transcript-core/runtimes.test.ts`
- Regenerate: `skills/session-observer/scripts/lib/locate.mjs`
- Modify: `skills/session-observer/SKILL.md`

**Steps:**

1. Add RED fixtures with many transcripts and a large transcript body proving exact Cursor identity resolution currently reads accumulated bodies without an aggregate bound.
2. Derive Cursor session IDs from canonical transcript paths without reading transcript content.
3. Bound or cache duplicate-session indexing across project directories with finite entry/time budgets and a fail-visible diagnostic when the budget is exceeded.
4. Verify exact canonical identity, duplicate-session ambiguity, containment, large-body no-read behavior, finite-budget failure, generated parity, full observer/core compatibility, privacy, and provider dogfood sync.
5. Commit: `fix(p08-t15): bound cursor identity indexing`.

### Task p08-t16: (review) Bound aggregate provider-state preservation scans

**Task Scope:** Moderate
**Requirements:** FR9, NFR5, NFR6

**Files:**

- Modify: `scripts/probe-cursor-wake-surfaces.mjs`
- Modify: `tests/tooling/cursor-wake-probe.test.ts`
- Modify if evidence wording changes: `skills/session-observer-collab/references/runtime-cursor.md`

**Steps:**

1. Add a RED provider-state fixture with enough individually valid entries to exceed a shared aggregate budget.
2. Apply shared aggregate entry, byte, and elapsed-time budgets across both provider roots and the post-run preservation check.
3. Fail visibly before provider launch when the pre-run budget is exceeded, and fail visibly during cleanup verification without masking provider-state uncertainty.
4. Verify focused wake-probe tests, live-mode cleanup, finite process/runtime behavior, evidence labels, privacy, residue, validation, smoke, and the complete final release matrix.
5. Commit: `fix(p08-t16): bound provider state scan`.

### Task p08-t17: (review) Preserve exact cleanup under budget exhaustion

**Task Scope:** Moderate
**Requirements:** FR9, NFR2, NFR5, NFR6

**Files:**

- Modify: `scripts/probe-cursor-wake-surfaces.mjs`
- Modify: `tests/tooling/cursor-wake-probe.test.ts`

**Steps:**

1. Add RED cross-root cases where post-run entry, byte, or elapsed-time exhaustion occurs after an exactly owned artifact has been discovered.
2. Preserve partial exact discoveries or separate the bounded preservation scan from exact cleanup discovery so a later-root failure cannot replace known artifacts with an empty set.
3. Remove every exactly proven new artifact under a separate finite aggregate cleanup budget while returning a visible preservation diagnostic and `preExistingPreserved: false`.
4. Verify the exact artifacts are absent after every exhaustion case, then run focused wake-probe, live cleanup, privacy, residue, validation, smoke, and full release tests.
5. Commit: `fix(p08-t17): preserve bounded provider cleanup`.

### Task p08-t18: (review) Record canonical Phase 8 task completion

**Task Scope:** Minor
**Requirements:** NFR6

**Files:**

- Modify: `.oat/projects/shared/cursor-collaboration-reliability/implementation.md`

**Steps:**

1. Inspect the canonical completed-task section shape used by Phases 1 through 7.
2. Add canonical task sections for `p08-t01` through `p08-t18`, with status, commit, and concise outcome data, while preserving the existing Phase 8 summary and review history.
3. Run `oat project status --project-path .oat/projects/shared/cursor-collaboration-reliability --json` and require Phase 8 and project totals to recognize all 18 tasks as complete.
4. Verify plan and implementation totals are 58/58 with no review-history loss; root owns final `state.md` bookkeeping after the task commit.
5. Commit: `chore(p08-t18): record canonical phase 8 completion`.

### Task p08-t19: (review) Bound provider directory enumeration

**Task Scope:** Moderate
**Requirements:** NFR5

**Files:**

- Modify: `scripts/probe-cursor-wake-surfaces.mjs`
- Modify: `tests/tooling/cursor-wake-probe.test.ts`

**Steps:**

1. Add RED oversized provider-root and nested-directory fixtures proving eager `readdir()` materializes names before aggregate limits apply.
2. Replace eager root, fingerprint-tree, artifact-inspection, and post-run name listings with `opendir()` or equivalently capped iteration.
3. Consume the shared entry and elapsed-time budget before retaining or queueing each name, and keep queued-name memory within that same finite aggregate bound.
4. Verify oversized scans stop at the configured limit without materializing complete listings while exact cleanup remains fail-closed and finite.
5. Run focused wake-probe, live cleanup, full suite, build/type/generated, validation, smoke, evidence/privacy, docs, provider, residue, and orphan-process gates.
6. Commit: `fix(p08-t19): bound provider directory iteration`.

### Task p08-t20: (review) Reconcile canonical 60-task closeout

**Task Scope:** Minor
**Requirements:** NFR6

**Files:**

- Modify: `.oat/projects/shared/cursor-collaboration-reliability/plan.md`
- Modify: `.oat/projects/shared/cursor-collaboration-reliability/implementation.md`
- Modify: `.oat/projects/shared/cursor-collaboration-reliability/state.md`

**Steps:**

1. Update the plan closeout summary to Phase 8 at 20 tasks and total completion at 60.
2. Replace the `p08-t18` commit placeholder with `40b2022`, add canonical completed sections for `p08-t19` and `p08-t20`, and preserve all review history.
3. Clear any stale current task and record the current bookkeeping basis consistently in `state.md`.
4. Read back `plan.md`, `implementation.md`, `state.md`, and `oat project status --project-path .oat/projects/shared/cursor-collaboration-reliability --json`; require Phase 8 20/20, project 60/60, no current task, and no blocker.
5. Commit: `chore(p08-t20): reconcile canonical project closeout`.

### Task p08-t21: (review) Finalize the implementation handoff narrative

**Task Scope:** Minor
**Requirements:** NFR6

**Files:**

- Modify: `.oat/projects/shared/cursor-collaboration-reliability/plan.md`
- Modify: `.oat/projects/shared/cursor-collaboration-reliability/implementation.md`
- Modify: `.oat/projects/shared/cursor-collaboration-reliability/state.md`

**Steps:**

1. Mark the Phase 8 journal section complete and update all plan/overview totals to Phase 8 21/21 and project 61/61.
2. Update `## Test Results` and `## Final Summary (for PR/docs)` through `p08-t21`, including 1,528 passed, 1 skipped, bounded provider iteration, exact cleanup, and canonical closeout.
3. Restore state history to chronological review, receive, and fix order while preserving durable task SHAs and a null current task.
4. Add a canonical completed `p08-t21` section; root will replace its unavoidable self-reference marker with the exact task SHA in the next bookkeeping commit.
5. Read back all three artifacts and live OAT status; require Phase 8 21/21, project 61/61, current null, no blockers, and no stale 1,515/16-task closeout claim.
6. Commit: `chore(p08-t21): finalize implementation handoff`.

### Task p08-t22: (gate review) Establish Cursor lease continuity at arm

**Task Scope:** Moderate
**Requirements:** FR8, NFR1

**Files:**

- Modify: `skills/session-observer-collab/scripts/collab-control.mjs`
- Modify: `skills/session-observer-collab/scripts/lib/lease-state.mjs`
- Modify: `skills/session-observer-collab/scripts/lib/runtime-adapter.mjs`
- Modify as required: `skills/session-observer-collab/scripts/lib/selected-prefix.mjs`
- Modify: `tests/session-observer-collab/control.test.ts`
- Modify: `tests/session-observer-collab/cursor-hook.test.ts`

**Steps:**

1. Add RED public-arm tests for peer-session/path mismatch, a requested cursor beyond the safe prefix, and same-path shrink, rewrite, or inode replacement before the first hook.
2. Resolve and validate the Cursor peer session/path during `arm`, scan through the requested safe boundary, and atomically persist a non-null device/inode/prefix checkpoint even for cursor zero.
3. Require the checkpoint for schema-v6 Cursor leases; make legacy null-checkpoint Cursor leases require explicit re-arm.
4. Preserve exact ownership and generated/install compatibility across both owner routes.
5. Run focused control/hook, collaboration aggregate, full suite, validation, smoke, privacy, version, and provider gates.
6. Commit: `fix(p08-t22): establish cursor lease continuity at arm`.

### Task p08-t23: (gate review) Recheck deadlines immediately before wake claims

**Task Scope:** Moderate
**Requirements:** FR8, NFR1, NFR5

**Files:**

- Modify: `skills/session-observer-collab/scripts/hooks/cursor-stop.mjs`
- Modify: `skills/session-observer-collab/scripts/hooks/codex-stop.mjs`
- Modify as required: `skills/session-observer-collab/scripts/lib/lease-state.mjs`
- Modify: `tests/session-observer-collab/cursor-hook.test.ts`
- Modify: `tests/session-observer-collab/codex-hook.test.ts`

**Steps:**

1. Add RED Cursor-owner and Codex-owner tests where observation or pre-CAS verification crosses the wait deadline and lease expiry.
2. Refresh the clock after every awaited observation/update and immediately before trigger CAS.
3. Reject at or beyond either deadline using the fresh value; assert no wake, no budget spend, and an idle or expired lease.
4. Verify contention, private continuity, completion selection, both owner routes, full collaboration, and full-suite behavior.
5. Commit: `fix(p08-t23): recheck wake authorization deadlines`.

### Task p08-t24: (gate review) Bound pinned and generic Cursor discovery

**Task Scope:** Moderate
**Requirements:** FR1, NFR5

**Files:**

- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify as required: `src/transcript/core/runtimes.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Generate: `skills/session-observer/scripts/lib/locate.mjs`
- Generate if shared runtime changes: shipped runtime mirrors
- Modify if required: `skills/session-observer/SKILL.md`

**Steps:**

1. Add RED public locate and pinned-observe regressions with many large sibling transcripts present before discovery; prove unrelated bodies are not read.
2. Resolve an explicit Cursor session pin through bounded canonical path metadata before classifying unrelated candidates.
3. Stream and aggregate-bound generic candidate enumeration, retaining and classifying only the bounded set needed for ranking.
4. Preserve exact identity ambiguity, cwd containment, generated parity, observer/export compatibility, versioning, and provider dogfood.
5. Commit: `fix(p08-t24): bound cursor transcript discovery`.

### Task p08-t25: (gate review) Fail closed on incomplete identity indexes

**Task Scope:** Moderate
**Requirements:** FR1, NFR1

**Files:**

- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Generate: `skills/session-observer/scripts/lib/locate.mjs`

**Steps:**

1. Add RED root, project, and session traversal-failure regressions, including an unreadable subtree hiding a duplicate identity.
2. Continue only for explicitly benign store-shape absence such as permitted `ENOENT`.
3. Return a fail-visible incomplete-index reason for permission, iteration, and unexpected I/O failures and include it in the hard-failure set.
4. Verify identity remains non-exact under incomplete enumeration while ordinary exact, duplicate, and budget cases stay green.
5. Commit: `fix(p08-t25): fail closed on incomplete identity index`.

### Task p08-t26: (gate review) Make watch runtime coverage deterministic

**Task Scope:** Minor
**Requirements:** NFR6

**Files:**

- Modify: `tests/session-observer/watch.test.ts`
- Modify only if required for injection: `src/transcript/session-observer/lib/watch.ts`
- Generate only if canonical runtime changes: `skills/session-observer/scripts/lib/watch.mjs`

**Steps:**

1. Replace the scheduler-sensitive real-wall-clock `<400 ms` assertion with the existing injectable or virtual clock.
2. Assert requested waits, deadline exhaustion, state transitions, and the bounded functional outcome without a host-scheduling threshold.
3. Run the focused watch suite repeatedly and under the complete full-suite load that exposed the 513 ms failure.
4. Run build/type/generated, validation, smoke, evidence/privacy, docs, version/provider, residue, and final release gates.
5. Commit: `test(p08-t26): make watch runtime test deterministic`.

### Task p08-t27: Reconcile collaboration trigger update types

**Task Scope:** Minor
**Requirements:** NFR3, NFR4, NFR6

**Files:**

- Modify: `skills/session-observer-collab/scripts/mjs-modules.d.ts`
- Modify: `tests/session-observer-collab/ambient-types.ts`
- Modify: `skills/session-observer-collab/SKILL.md`

**Steps:**

1. Extend the ambient consumer to pass `peerContinuity` through `compareAndSwapTrigger` and reproduce the aggregate type-check errors.
2. Synchronize the wildcard ambient trigger-update type with the canonical `LeaseUpdate` contract without weakening other fields.
3. Bump the collaboration skill version and verify ambient compile, aggregate type-check, collaboration tests, validation, version enforcement, and project sync.
4. Commit: `fix(p08-t27): sync collaboration trigger types`.

### Task p08-t28: Reconcile bounded live evidence and dogfood

**Task Scope:** Moderate
**Requirements:** FR9, FR10, NFR2, NFR5, NFR6

**Files:**

- Modify: `scripts/probe-cursor-wake-surfaces.mjs`
- Modify: `tests/tooling/cursor-wake-probe.test.ts`
- Modify: `skills/session-observer-collab/references/runtime-cursor.md`
- Modify: `skills/session-observer-collab/SKILL.md`
- Modify through root bookkeeping: project implementation and state artifacts

**Steps:**

1. Add coverage proving a pre-launch provider snapshot budget failure exposes its exact finite entry, byte, or elapsed-time diagnostic while retaining `safety-failed`, no provider launch, exact workspace cleanup, and zero residue.
2. Preserve the finite provider-state bounds; do not enlarge or bypass them to accommodate the current multi-gigabyte provider roots.
3. Record the current rerun as unavailable because the bounded pre-snapshot failed safely, without rewriting the earlier historical callback-delivery measurement or promoting any stronger wake tier.
4. Refresh the branch dogfood installs for `session-observer` and `session-observer-collab`, verify Claude and Cursor mirror policy, and run `oat sync --scope user`.
5. Run type-check, build/generated parity, all tests, validation, smoke, evidence/privacy, flags, skill versions, docs, project/provider sync, live acceptance, both bounded wake modes, residue, and orphan-process checks.
6. Add canonical completed sections for `p08-t22` through `p08-t28` and reconcile live OAT status to Phase 8 28/28 and project 68/68.
7. Commit: `chore(p08-t28): reconcile bounded cursor release gates`.

### Task p08-t29: Refresh wake authorization inside the trigger CAS

**Task Scope:** Moderate
**Requirements:** FR8, NFR1, NFR5

**Files:**

- Modify: `skills/session-observer-collab/scripts/lib/runtime-adapter.mjs`
- Modify as required: both owner hook call sites and collaboration tests
- Modify: `skills/session-observer-collab/SKILL.md`

**Steps:**

1. Carry a clock callback through final trigger validation and evaluate authorization under the lease lock immediately before mutation.
2. Add Cursor-owner and Codex-owner regressions that cross the wait deadline and lease expiry during final validation or lock contention.
3. Assert no wake, cursor advancement, or continuation spend and the exact idle/expired diagnostic.
4. Bump the collaboration skill version and run focused, type, build, validation, and version gates.
5. Commit: `fix(p08-t29): refresh wake authorization under lock`.

### Task p08-t30: Bound generic Cursor discovery

**Task Scope:** Moderate
**Requirements:** FR1, NFR5

**Files:**

- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify: `tests/session-observer/locate.test.ts`
- Regenerate the shipped Session Observer runtime
- Modify: `skills/session-observer/SKILL.md`

**Steps:**

1. Apply aggregate entry, elapsed-time, byte, and retained-candidate bounds before retaining names or reading bodies in generic unpinned discovery.
2. Classify only the bounded candidate set needed for ranking and fail visibly when exact discovery cannot be completed within the budget.
3. Add a public unpinned discovery/locate regression with many large transcripts proving bounded reads, retention, and diagnostic behavior.
4. Bump the Session Observer skill version and run focused, type, build/generated, validation, evidence, and version gates.
5. Commit: `fix(p08-t30): bound generic cursor discovery`.

### Task p08-t31: Reconcile the final implementation handoff

**Task Scope:** Minor
**Requirements:** NFR6

**Files:**

- Modify through root bookkeeping: project implementation and state artifacts

**Steps:**

1. Update the Phase 8 test row and final summary through `p08-t30`.
2. Record 31/31 Phase 8 tasks, 71/71 project tasks, the current full-suite matrix, and bounded unavailable wake evidence.
3. Preserve the historical review and configured-gate narrative.
4. Commit: `chore(p08-t31): reconcile final cursor handoff`.

### Task p08-t32: Correct ambient collaboration clock declarations

**Task Scope:** Minor
**Requirements:** NFR3, NFR6

**Files:**

- Modify: `skills/session-observer-collab/scripts/mjs-modules.d.ts`
- Modify: `tests/session-observer-collab/ambient-types.ts`
- Modify: `skills/session-observer-collab/SKILL.md`

**Steps:**

1. Restore `arm()` to its scalar `now?: number` runtime contract.
2. Apply the number-or-clock callback union to `compareAndSwapTrigger()`.
3. Add ambient compile assertions accepting the CAS callback and rejecting an `arm()` callback.
4. Bump the collaboration skill version and run ambient, aggregate type, validation, and version gates.
5. Commit: `fix(p08-t32): correct ambient clock declarations`.

## Reviews

| Scope  | Type     | Status          | Date       | Artifact                                                      |
| ------ | -------- | --------------- | ---------- | ------------------------------------------------------------- |
| p01    | code     | pending         | -          | -                                                             |
| p02    | code     | pending         | -          | -                                                             |
| final  | code     | pending         | -          | -                                                             |
| spec   | artifact | pending         | -          | -                                                             |
| design | artifact | fixes_completed | 2026-07-20 | reviews/archived/artifact-design-review-2026-07-20T233233Z.md |
| plan   | artifact | pending         | -          | -                                                             |
| plan   | artifact | fixes_completed | 2026-07-22 | reviews/artifact-plan-review-2026-07-23T022120Z.md            |
| p03    | code     | pending         | -          | -                                                             |
| p04    | code     | pending         | -          | -                                                             |
| p05    | code     | pending         | -          | -                                                             |
| p06    | code     | pending         | -          | -                                                             |
| p01    | code     | fixes_completed | 2026-07-22 | reviews/p01-review-2026-07-23T035505Z.md                      |
| p01    | code     | passed          | 2026-07-22 | reviews/p01-review-2026-07-23T040650Z.md                      |
| plan   | artifact | fixes_completed | 2026-07-22 | reviews/artifact-plan-review-2026-07-23T023750Z.md            |
| plan   | artifact | passed          | 2026-07-22 | reviews/archived/artifact-plan-review-2026-07-23T025554Z.md   |
| p02    | code     | fixes_completed | 2026-07-23 | reviews/p02-review-2026-07-23T045715Z.md                      |
| p02    | code     | fixes_completed | 2026-07-23 | reviews/p02-review-2026-07-23T051820Z.md                      |
| p02    | code     | fixes_completed | 2026-07-23 | reviews/p02-review-2026-07-23T054702Z.md                      |
| p02    | code     | fixes_completed | 2026-07-23 | reviews/archived/p02-review-2026-07-23T114732Z.md             |
| p02    | code     | passed          | 2026-07-23 | reviews/p02-review-2026-07-23T164415Z.md                      |
| p03    | code     | fixes_completed | 2026-07-23 | reviews/p03-review-2026-07-23T211458Z.md                      |
| p03    | code     | passed          | 2026-07-23 | reviews/p03-review-2026-07-23T214213Z.md                      |
| p04    | code     | fixes_completed | 2026-07-23 | reviews/p04-review-2026-07-23T224300Z.md                      |
| p04    | code     | passed          | 2026-07-23 | reviews/p04-review-2026-07-23T230346Z.md                      |
| p05    | code     | fixes_completed | 2026-07-24 | reviews/p05-review-2026-07-24T001656Z.md                      |
| p05    | code     | passed          | 2026-07-24 | reviews/p05-review-2026-07-24T004530Z.md                      |
| p06    | code     | fixes_completed | 2026-07-24 | reviews/p06-review-2026-07-24T012320Z.md                      |
| p06    | code     | fixes_completed | 2026-07-24 | reviews/p06-review-2026-07-24T015318Z.md                      |
| p06    | code     | passed          | 2026-07-24 | reviews/p06-review-2026-07-24T023404Z.md                      |
| final  | code     | fixes_completed | 2026-07-24 | reviews/final-review-2026-07-24T025100Z.md                    |
| final  | code     | fixes_completed | 2026-07-24 | reviews/final-review-2026-07-24T031130Z.md                    |
| final  | code     | passed          | 2026-07-24 | reviews/final-review-2026-07-24T032809Z.md                    |
| final  | code     | fixes_completed | 2026-07-24 | reviews/archived/final-review-2026-07-24T034752Z.md           |
| p07    | code     | passed          | 2026-07-24 | reviews/p07-review-2026-07-24T050736Z.md                      |
| final  | code     | passed          | 2026-07-24 | reviews/final-review-2026-07-24T051704Z.md                    |
| final  | code     | fixes_added     | 2026-07-24 | reviews/archived/final-review-2026-07-24T055647Z.md           |
| p08    | code     | passed          | 2026-07-24 | reviews/p08-review-2026-07-24T125308Z.md                      |
| final  | code     | fixes_completed | 2026-07-24 | reviews/archived/final-review-2026-07-24T130507Z.md           |
| final  | code     | fixes_completed | 2026-07-24 | reviews/archived/final-review-2026-07-24T133133Z.md           |
| final  | code     | fixes_completed | 2026-07-24 | reviews/archived/final-review-2026-07-24T135210Z.md           |
| final  | code     | fixes_completed | 2026-07-24 | reviews/archived/final-review-2026-07-24T141209Z.md           |
| final  | code     | passed          | 2026-07-24 | reviews/final-review-2026-07-24T142453Z.md                    |
| final  | code     | fixes_completed | 2026-07-24 | reviews/archived/final-review-2026-07-24T144744Z.md           |
| p08    | code     | fixes_completed | 2026-07-24 | reviews/archived/p08-review-2026-07-24T161117Z.md             |
| p08    | code     | fixes_completed | 2026-07-24 | reviews/archived/p08-review-2026-07-24T163113Z.md             |

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
- Phase 7: 4 tasks — selected-prefix CAS binding, bounded stability growth, completed-prefix selection, and evidence-safe gate bookkeeping.
- Phase 8: 32 tasks — delivery completion, stability progress, runtime bounds, canonical identity, structural content/turns, completion suffixes, type parity, probe safety, evidence hygiene, bounded identity/provider-state scans and directory iteration, exact cleanup preservation, canonical records, under-lock authorization deadlines, fully bounded generic discovery, fail-closed indexing, deterministic watch coverage, ambient clock declaration parity, live evidence/dogfood reconciliation, and final handoff.

**Total: 72 tasks**

Ready for code review and merge after all 72 tasks and review rows pass.

## References

- Design: `design.md`
- Specification: `spec.md`
- Discovery: `discovery.md`
- Implementation journal: `implementation.md`
- Cursor evidence: `skills/session-observer-collab/references/runtime-cursor.md`
- Repository knowledge: `.oat/repo/knowledge/project-index.md`
- Backlog: `.oat/repo/pjm/backlog/items/BL-260713-cursor-transcript-store.md`, `.oat/repo/pjm/backlog/items/BL-260713-stronger-cursor-collaboration.md`
