---
oat_template: false
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-09-16
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_auto_review_at_hill_checkpoints: false # lite: no checkpoints
oat_plan_source: lite
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Lite Plan: session-observer-rearm

**Goal:** Determine the exact-pin re-arm guarantees for legacy Claude/Codex observers, preserve a portable reproduction, fix only a demonstrated bounded defect, and publish guidance that separates persisted consumption, stdout completion, and observing-agent delivery.

## Summary

Use the existing virtual-clock and transcript helpers to exercise two watcher lifetimes around a known renderable peer message. Cover clean signal shutdown, normal max-runtime expiry, filtered-only ranges, appends during startup, and competing consumers. If those supported shutdown paths retain and emit the message, preserve the result as regression coverage and explain why raw-index gaps can represent filtered activity rather than lost conversation. Separately characterize the known legacy boundary where `observeCatchUp()` persists `nextIndex` before the caller writes stdout; do not claim that synthetic stdout capture proves delivery into Claude Code or Codex.

If a failing case is confined to the current watcher/observer boundary and can be repaired without weakening competing-consumer safety, fix it test-first. If safe resolution requires legacy delivery reservations, compare-and-set checkpoints, or harness receipts, keep that redesign out of this task, leave the backlog item open, and report the evidence for operator direction.

## Decisions

- **Content shape:** `both` — the work changes operator-facing re-arm guidance and crosses watcher, observation, persisted-state, stdout, and harness-delivery boundaries.
- Treat `catch-up-then-watch` as the supported re-arm command; plain `watch` intentionally consumes an unread baseline and emits a `baseline-gap` warning rather than rendering it.
- Test clean termination mechanisms independently: SIGTERM requests orderly stop without forced flush; max-runtime performs a final poll/flush before exit.
- Record raw `fromIndex`/`nextIndex`, rendered ranges/content, persisted `lastRecordIndex`, and captured stdout separately. Synthetic tests stop at stdout and make no live harness-delivery claim.
- Do not add speculative signal handlers, blanket raw-gap alarms, or unsafe rollback of shared legacy state. A broader acknowledgment/checkpoint redesign requires a separate decision.
- Close and archive `BL-260916-session-observer-re-armed` only if the bounded evidence and shipping guidance satisfy every acceptance criterion; otherwise retain it as open with precise remaining work.
- **Lite fit:** The evidence, regression matrix, guidance, generated payloads, and conditional backlog disposition form one sequential implementation sitting; the broader legacy acknowledgment/CAS redesign is an explicit stop boundary, not an unresolved decision inside this plan.
- **Approval:** Approved from the user's explicit request to use `oat-project-lite` to handle the ticket; the single approval control returned no replacement selection, so the original instruction remains authoritative.
- **Dispatch and gates:** Project dispatch uses the managed `high` ceiling requested by the user's Sol instruction. The configured lite plan gate and implementation final-code gate remain enabled; no project override, phase gate, or HiLL checkpoint was added.

## Product Behavior

1. **Exact-pin clean re-arm** — A renderable peer message appended while the watcher is stopped is emitted once by the next `catch-up-then-watch`, after either clean SIGTERM shutdown or normal max-runtime expiry.
2. **Honest range accounting** — Tool/reasoning-only records may advance the persisted raw index while producing no rendered delta; the next renderable message remains observable and its digest exposes raw and rendered ranges distinctly.
3. **Startup and contention safety** — A message appended during re-arm startup is not silently baselined away. In the deterministic contender-first interleaving, a second live watcher for the same exact target is rejected and restores the shared offset before the owner polls; the owner-polls-between-advance-and-restore interleaving is characterized separately under the existing acknowledgment/CAS limitation.
4. **Bounded delivery claim** — Documentation describes verified persisted-state and stdout behavior, identifies the legacy pre-stdout checkpoint window, and states that delivery into the observing agent needs live harness evidence.
5. **Portable evidence** — Tests and the canonical Claude Code runtime reference contain sanitized evidence that does not depend on local transcript paths, session IDs, or the ignored collaboration log.

## Technical Design

- **Current operation:** `runWatchLoop()` establishes each legacy target through `observeCatchUp()`. `catch-up-then-watch` emits that result before taking the new signature/baseline, while ordinary `watch` warns about a consumed baseline gap. `observeCatchUp()` currently writes legacy `lastRecordIndex = digest.range.nextIndex` before returning the digest to the caller; `writeStdoutChunk()` can confirm only stream-write completion, not observing-agent receipt. Cursor's separate delivery reservation/commit path is not shared by legacy Claude/Codex.
- **Proposed changes:** Extend `src/skills/session-observer/src/watch.test.ts` with deterministic two-lifetime fixtures covering the ticket matrix and explicit state/stdout/range assertions. Add or refine focused observation/integration coverage only where required to preserve a demonstrated boundary. Modify `watch.ts`, `observe.ts`, or `state.ts` only if a failing regression has a bounded concurrency-safe repair. Reconcile `src/skills/session-observer-collab/references/runtime-claude-code.md` and its contract test with the verified procedure and limitations; bump affected canonical skill versions and regenerate declared distributions.
- **Data flow:** Transcript append → `observeCatchUp()` selects the exact pin and builds a digest from persisted `lastRecordIndex` → legacy state advances to raw `nextIndex` → watcher renders/writes stdout → the external Monitor or host may deliver those bytes to an agent. Tests can observe the first four boundaries; the final harness hop remains unverified without a live provider run.

## Assumptions

- The user's supplied brief is the completed critical interview and authorizes synthetic fixtures, canonical source/tests/docs, generated payload refresh, PJM closeout when warranted, and local commits.
- `origin/main` at `49b4baf3` is the requested base; the visible `observer-rearm` worktree is isolated from the planning worktree.
- SIGTERM means the watcher's installed handler runs and the process exits normally; SIGKILL, host crash, broken pipes, and harness cancellation are separate failure classes.
- A test-injected stdout sink is evidence of attempted/completed process output only, not proof that Claude Code Monitor or another observing agent received it.
- Existing shared legacy offsets allow warnings and serialized writes but do not provide per-consumer acknowledgments or a compare-and-set delivery checkpoint.

## Out of Scope

- Activity-view or `--include-activity` work, messaging, N>2/per-observer redesign, Consensus cleanup, or unrelated observer features.
- Live Claude/Codex/Monitor calls, live harness acceptance, user-level installs, global sync, and changes to active peer watchers.
- A wholesale legacy delivery reservation/acknowledgment protocol unless the regression exposes a small concurrency-safe repair inside the current contract.
- Treating the observed Monitor duration as a universal harness guarantee.
- Pushing, publishing a PR, merging, or modifying Astra/Fable's planning worktree.

## Validation Criteria

- [ ] Exact `codex:<session-id>` restart tests prove a known renderable message is emitted after clean SIGTERM, `watch-ctl stop`, and normal max-runtime stop, with captured `fromIndex`/`nextIndex`, persisted state, digest content, and stdout evidence — Check: `pnpm run test:vitest src/skills/session-observer/src/watch.test.ts`
- [ ] A deterministic negative control injects legacy stdout failure after persisted consumption, restarts the exact pin, and proves whether replay occurs; filtered-only advancement, startup appends, and same-target competing-consumer behavior are covered separately without timing sleeps — Check: `pnpm run test:vitest src/skills/session-observer/src/watch.test.ts src/skills/session-observer/src/observe.test.ts src/skills/session-observer/src/integration.test.ts`
- [ ] Canonical Claude Code guidance states the bounded re-arm procedure, corrects the duration claim, and distinguishes process output from live agent delivery — Check: `pnpm run test:vitest src/skills/session-observer-collab/src/runtime-claude-code-reference.test.ts`
- [ ] Affected skill versions are bumped and generated standalone/plugin payloads match canonical sources — Check: `pnpm run validate:skill-versions -- --base-ref origin/main && pnpm run build:check`
- [ ] Normal repository gates pass without live-provider execution — Check: `pnpm run premerge`
- [ ] The backlog item is archived only if all acceptance criteria are met; PJM invariants remain valid either way — Check: `oat pjm doctor --json`

## Parallelism

This plan has one phase and executes sequentially.

## Phase 1: Diagnose, Prove, and Reconcile Observer Re-arm

### Task p01-t01: Reproduce exact-pin re-arm boundaries

**Files:**

- Modify: `src/skills/session-observer/src/watch.test.ts`
- Modify if required by a demonstrated bounded defect: `src/skills/session-observer/src/lib/watch.ts`
- Modify if required by a demonstrated bounded defect: `src/skills/session-observer/src/lib/observe.ts`
- Modify if required by a demonstrated bounded defect: `src/skills/session-observer/src/lib/state.ts`
- Modify if needed for checkpoint characterization: `src/skills/session-observer/src/observe.test.ts`
- Modify if needed for process-level failure characterization: `src/skills/session-observer/src/integration.test.ts`
- Modify version only: `src/skills/session-observer/SKILL.md`
- Modify version only: `src/skills/session-observer-collab/SKILL.md`
- Regenerate: declared `skills/` and `plugins/consensus/skills/` outputs for both affected owners

**Implementation and Proof Strategy:**

- **Strategy:** Characterization-first, followed by a focused regression or bounded fix.
- **Observable risk:** A renderable peer message appended across watcher termination/restart is consumed in persisted state without appearing in the re-armed watcher's stdout, or startup/contention behavior makes the test falsely pass.
- **Why proportionate:** The max-runtime, control-stop, startup, contention, and negative controls use the existing virtual clock, injected stdout, transcript, state, and control-directive helpers. The SIGTERM lifetime uses the existing spawned-CLI pattern, waits on observable `watch.json.active`, sends SIGTERM, and reads JSON stdout plus `STATE_DIR` files. No fixed-delay sleep decides success, and explicit boundary assertions prevent raw-index movement from being mistaken for rendered content or agent delivery.

**Step 1: Implement**

Add reusable deterministic fixture helpers only where they reduce duplication. First preserve three two-lifetime reproductions using an exact `codex:<session-id>` pin and a known assistant message appended while stopped: (a) spawn the CLI with JSON output, wait for `watch.json.active`, send SIGTERM, and read range/state evidence from stdout plus `STATE_DIR`; (b) issue `writeControlDirective({ directive: 'stop' })` through the deterministic control seam; and (c) expire through virtual max-runtime. Add a negative control that injects a rejecting or incomplete legacy stdout sink after `observeCatchUp()` advances state, asserts the write failure and persisted `lastRecordIndex`, restarts the exact pin, and records whether the digest replays; this characterizes the broader acknowledgment/CAS stop boundary rather than authorizing speculative rollback. Add separate cases for filtered-only records and an append during re-arm startup. For competing consumers, pin the contender-first interleaving in which rejection restores the shared offset before the owner polls, and characterize the owner-polls-between-advance-and-restore interleaving under the same broader stop boundary. Assert raw ranges, rendered ranges/content, saved offset, stdout chunks, and single-consumer ownership independently. If a supported clean path loses content, fix the smallest safe watcher/observer boundary and keep the pre-fix test. Bump both affected skill versions, run the canonical build, and include generated observer/collaboration payloads in this independently valid commit.

**Step 2: Prove**

Run: `pnpm run test:vitest src/skills/session-observer/src/watch.test.ts src/skills/session-observer/src/observe.test.ts src/skills/session-observer/src/integration.test.ts && pnpm run validate:skill-versions -- --base-ref origin/main && pnpm run build:check`
Expected: All deterministic cases pass; removing catch-up-first emission/startup reconciliation or the negative stdout-failure control makes the corresponding regression fail. Affected versions and generated payloads are current. Output evidence proves only persistence and stdout boundaries.

**Step 3: Refactor and format**

Keep helpers colocated, avoid timing sleeps, and run `pnpm exec oxfmt --write src/skills/session-observer/src/watch.test.ts src/skills/session-observer/src/observe.test.ts src/skills/session-observer/src/integration.test.ts src/skills/session-observer/src/lib/watch.ts src/skills/session-observer/src/lib/observe.ts src/skills/session-observer/src/lib/state.ts src/skills/session-observer/SKILL.md src/skills/session-observer-collab/SKILL.md` on files actually changed, then run `pnpm run build`; do not format generated outputs separately.

**Step 4: Verify**

Run: `pnpm run type-check && pnpm run test:vitest src/skills/session-observer/src/watch.test.ts src/skills/session-observer/src/observe.test.ts src/skills/session-observer/src/integration.test.ts && pnpm run build:check && pnpm run validate:skill-versions -- --base-ref origin/main`
Expected: No errors; the evidence explicitly separates persisted consumption, stdout emission, and unverified harness delivery, and the commit satisfies version/generated-output invariants.

**Step 5: Commit**

```bash
git add src/skills/session-observer src/skills/session-observer-collab/SKILL.md skills/session-observer skills/session-observer-collab plugins/consensus/skills/observer plugins/consensus/skills/observer-collab
git commit -m "test(session-observer): cover exact-pin re-arm boundaries"
```

---

### Task p01-t02: Reconcile Monitor guidance and generated payloads

**Files:**

- Modify: `src/skills/session-observer-collab/references/runtime-claude-code.md`
- Modify: `src/skills/session-observer-collab/src/runtime-claude-code-reference.test.ts`
- Regenerate: declared `skills/` and `plugins/consensus/skills/` outputs for the affected owners

**Implementation and Proof Strategy:**

- **Strategy:** Implementation followed by focused contract regression and generated-output checks.
- **Observable risk:** Operators re-arm with plain `watch`, interpret filtered raw ranges as lost messages, assume an observed duration is universal, or treat synthetic stdout evidence as live Monitor delivery.
- **Why proportionate:** The existing reference contract test fails if the critical procedure or limitation language is removed, while the canonical build and version gates prove authored-to-generated parity without touching global installs.

**Step 1: Implement**

Replace the stale re-arm section with the verified exact-pin `catch-up-then-watch` sequence, range/state interpretation, clean-stop behavior, and explicit pre-stdout/harness-delivery limits. Reword the observed Monitor duration as session-specific evidence rather than a cap. Update the focused contract test and run the canonical build; the required affected-skill version bumps were already committed with p01-t01 so this task remains independently valid.

**Step 2: Prove**

Run: `pnpm run test:vitest src/skills/session-observer-collab/src/runtime-claude-code-reference.test.ts && pnpm run validate:skill-versions -- --base-ref origin/main && pnpm run build:check`
Expected: The procedure/limitation assertions, version impact, and all declared generated payloads pass; removing the bounded re-arm guidance fails the contract test.

**Step 3: Refactor and format**

Run `pnpm exec oxfmt --write src/skills/session-observer-collab/references/runtime-claude-code.md src/skills/session-observer-collab/src/runtime-claude-code-reference.test.ts` before `pnpm run build`; do not format generated outputs separately.

**Step 4: Verify**

Run: `pnpm run build && pnpm run build:check && pnpm run validate && pnpm run validate:skill-versions -- --base-ref origin/main`
Expected: No errors and only declared generated output changes.

**Step 5: Commit**

```bash
git add src/skills/session-observer src/skills/session-observer-collab skills/session-observer skills/session-observer-collab plugins/consensus/skills/observer plugins/consensus/skills/observer-collab
git commit -m "docs(session-observer): clarify re-arm delivery bounds"
```

---

### Task p01-t03: Run premerge gates and disposition the backlog item

**Files:**

- Modify when acceptance is satisfied: `.oat/repo/pjm/backlog/completed.md`
- Move when acceptance is satisfied: `.oat/repo/pjm/backlog/items/BL-260916-session-observer-re-armed.md` to `.oat/repo/pjm/backlog/archived/BL-260916-session-observer-re-armed.md`
- Regenerate when acceptance is satisfied: `.oat/repo/pjm/backlog/index.md`
- Otherwise modify: `.oat/repo/pjm/backlog/items/BL-260916-session-observer-re-armed.md` only if precise remaining work must be recorded

**Implementation and Proof Strategy:**

- **Strategy:** Full static/build/test gates followed by conditional PJM closeout.
- **Observable risk:** The bounded result is declared complete despite unmet acceptance, stale generated payloads, a versioning miss, or a regression elsewhere in the repository.
- **Why proportionate:** The repository's aggregate premerge command covers build, type-check, complete generated parity, full Vitest, structural validation, and smoke; PJM doctor detects partial or invalid closeout state.

**Step 1: Implement**

Run the normal premerge gates and review the final evidence against every ticket acceptance criterion. If all are satisfied, run `oat backlog archive BL-260916-session-observer-re-armed` for the atomic status/completed-entry/archive/index transition, then check whether the completion changes the operating picture and refresh `current-state.md` plus the curated backlog overview only when warranted. If the broader acknowledgment/harness boundary leaves an acceptance criterion unmet, keep the item open and record only precise remaining work supported by the evidence.

**Step 2: Prove**

Run: `pnpm run premerge && oat pjm doctor --json`
Expected: All non-live gates pass; the backlog is either fully archived with a completed entry or remains consistently open, never partially closed.

**Step 3: Refactor and format**

The repository formatter excludes `.oat/**`; do not invoke it on PJM artifacts. Run `git diff --check -- .oat/repo/pjm/backlog .oat/repo/pjm/current-state.md` after the bounded closeout edits instead, and do not hand-format the generated backlog index.

**Step 4: Verify**

Run: `git diff --check && pnpm run build:check && oat pjm doctor --json`
Expected: No errors, generated payloads remain fresh, and backlog lifecycle invariants hold.

**Step 5: Commit**

```bash
git add .oat/repo/pjm/backlog
git commit -m "chore(pjm): disposition observer re-arm investigation"
```

---

## Reviews

| Scope  | Type     | Status  | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| ------ | -------- | ------- | ---- | -------- | ------------- | ---------- | ----------- |
| p01    | code     | fixes_completed | 2026-09-16 | reviews/archived/p01-review-2026-09-16T212106Z.md | 7399f07125a15cfbaec6fb397906497898b6c693 | manual | - |
| final  | code     | pending | -    | -        | -             | -          | -           |
| spec   | artifact | pending | -    | -        | -             | -          | -           |
| design | artifact | pending | -    | -        | -             | -          | -           |
| plan   | artifact | passed  | 2026-09-16 | - | - | - | - |
| plan   | artifact | passed | 2026-09-16 | reviews/archived/artifact-plan-review-2026-09-16T204720Z.md | - | - | - |

## Implementation Complete

**Summary:**

- Phase 1: 3 tasks — deterministic diagnosis, bounded guidance/generated payloads, and verified backlog disposition.

**Total: 3 tasks**

Ready for final code review and local closeout after implementation.

## References

- Backlog item: `.oat/repo/pjm/backlog/archived/BL-260916-session-observer-re-armed.md`
- Canonical Claude Code runtime reference: `src/skills/session-observer-collab/references/runtime-claude-code.md`
