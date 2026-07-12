---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-07-12
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: [p06]
oat_auto_review_at_hill_checkpoints: true
oat_plan_parallel_groups:
  - [p04, p05]
oat_phase_review_gate:
  enabled: true
  phases: [p06]
  review_type: code
  exit_nonzero_on: important
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: false
---

# Implementation Plan: session-observer-collab

> Execute this plan using `oat-project-implement`.

**Goal:** Harden the base Session Observer from real collaboration failures and ship a compositional N=2 collaboration skill with honest, bounded wake behavior across Claude Code, Codex, Cursor, and generic fallbacks.

**Architecture:** Canonical TypeScript owns transcript/runtime semantics and generates the shipped base observer bundle. A dependency-free sibling skill owns runtime-neutral collaboration policy, a versioned lease/control surface, and thin harness adapters that consume normalized base-observer output.

**Tech Stack:** Node.js 22+, TypeScript, dependency-free ESM runtime scripts, Vitest, generated-runtime build pipeline, Markdown/MDX skills and documentation, OAT file-backed PJM.

**Commit Convention:** `type(pNN-tNN): description`

## Planning Checklist

- [x] Discovery grounded in the authoritative handoff packet
- [x] Lightweight design drafted and self-reviewed
- [x] Canonical source and generated-output boundaries identified
- [x] Phases evaluated for dependency and write-set parallelism
- [x] Stable task IDs, scoped verification, and atomic commits assigned
- [x] Project dispatch policy resolved
- [x] Optional Phase gate review setting resolved
- [x] Plan artifact review recorded

## Parallelism

Phases p01 through p03 are sequential: normalized completion/provenance must exist before watch behavior and collaboration leases can safely depend on it. After p03 fixes the shared protocol and control interfaces, p04 and p05 may run concurrently in isolated worktrees because their canonical write sets are disjoint: p04 owns only Codex adapter/reference/tests, while p05 owns Cursor and Claude adapter/reference/tests. Phase p06 merges and validates both lanes, updates shared documentation/release surfaces, and therefore runs after the parallel group.

```yaml
oat_plan_parallel_groups:
  - [p04, p05]
```

Do not run generated builds concurrently. The p04/p05 workers verify their scoped source/tests; p06 owns the serialized repository build and full integration gates after merge.

## Phase 1: Normalize collaboration-bearing transcript semantics

### Task p01-t01: Render queued Claude input exactly once

**Files:**

- Modify: `src/transcript/core/runtimes.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `src/transcript/session-observer/lib/digest.ts`
- Modify: `tests/session-observer/digest.test.ts`
- Add/modify: `tests/session-observer/fixtures/claude-code/*`

**Implementation:** Add failing fixtures for `queue-operation` enqueue/remove records and `queued_command` attachments, then normalize/dedupe them into one `User (queued mid-turn)` entry in review, catch-up, and watch-compatible digest output. Preserve existing output for transcripts without queued input.

**Verify:** `pnpm exec vitest run tests/session-observer/digest.test.ts`

**Commit:** `feat(p01-t01): render queued Claude input`

### Task p01-t02: Classify synthetic wakes as automatic control input

**Files:**

- Modify: `src/transcript/core/runtimes.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `src/transcript/session-observer/lib/digest.ts`
- Modify: `tests/session-observer/digest.test.ts`
- Add/modify: runtime fixtures under `tests/session-observer/fixtures/`

**Implementation:** Define and detect the machine-readable `session_observer_wake` envelope. Preserve its automatic/runtime/lease/pin/range provenance, render it as `Hook/control (automatic)` in markdown/JSON, and expose a non-human origin that collaboration logic can exclude from authority and recursive triggers.

**Verify:** `pnpm exec vitest run tests/session-observer/digest.test.ts`

**Commit:** `feat(p01-t02): classify automatic wake envelopes`

### Task p01-t03: Buffer Cursor activity through terminal completion

**Files:**

- Modify: `src/transcript/core/runtimes.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/transcript-core/runtimes.test.ts`
- Modify: `tests/session-observer/digest.test.ts`
- Add/modify: `tests/session-observer/fixtures/cursor/*`

**Implementation:** Buffer Cursor planning/fragments/tool activity until the top-level `turn_ended`. Emit one completed final response on success; emit a terminal diagnostic without provisional substantive content for aborted, error, and cancelled turns. Keep debug-only activity available without changing ordinary peer-position semantics.

**Verify:** `pnpm exec vitest run tests/transcript-core/runtimes.test.ts tests/session-observer/digest.test.ts`

**Commit:** `feat(p01-t03): buffer Cursor turns to completion`

### Task p01-t04: Guarantee recoverable user-message content

**Files:**

- Modify: `src/transcript/core/runtimes.ts`
- Modify: `src/transcript/session-observer/lib/digest.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/session-observer/digest.test.ts`

**Implementation:** Exempt user content from silent truncation. If a safety cap remains necessary, add transcript path plus exact zero-based record index to the normalized/digest recovery metadata and both renderers. Verify ordinary large-digest tail slicing remains backward compatible.

**Verify:** `pnpm exec vitest run tests/session-observer/digest.test.ts`

**Commit:** `fix(p01-t04): preserve recoverable user messages`

## Phase 2: Harden identity and watch behavior

### Task p02-t01: Add fail-closed `whoami`

**Files:**

- Modify: `src/transcript/session-observer/session-observer.ts`
- Modify: `src/transcript/session-observer/lib/observe.ts`
- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/session-observer/cli.test.ts`
- Modify: `tests/session-observer/locate.test.ts`

**Implementation:** Add `whoami [--json]` with ordered resolution from explicit self identity, harness signals, then unambiguous newest same-cwd self-runtime transcript. Return runtime/session/transcript/source; return non-zero with candidates when ambiguous instead of selecting by recency.

**Verify:** `pnpm exec vitest run tests/session-observer/locate.test.ts && pnpm run type-check`

The generated-bundle CLI assertions for `whoami` run in p02-t05 after the canonical build. This task must not generate or commit shipped `.mjs` outputs.

**Commit:** `feat(p02-t01): add fail-closed self identity`

### Task p02-t02: Suppress empty watch deltas without losing offsets

**Files:**

- Modify: `src/transcript/session-observer/session-observer.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `src/transcript/session-observer/lib/watch.ts`
- Modify: `tests/session-observer/watch.test.ts`
- Modify: `tests/session-observer/cli.test.ts`

**Implementation:** Add `--quiet-empty` to watch and catch-up-then-watch. Metadata-only growth advances the high-water mark but emits no stdout delta; substantive deltas and enabled heartbeats retain current behavior.

**Verify:** `pnpm exec vitest run tests/session-observer/watch.test.ts && pnpm run type-check`

Generated-bundle CLI flag assertions run in p02-t05 after the canonical build.

**Commit:** `feat(p02-t02): suppress empty watch deltas`

### Task p02-t03: Detect standalone-watch baseline gaps

**Files:**

- Modify: `src/transcript/session-observer/session-observer.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `src/transcript/session-observer/lib/watch.ts`
- Modify: `tests/session-observer/watch.test.ts`
- Modify: `tests/session-observer/cli.test.ts`

**Implementation:** Compare a standalone watch baseline with a prior stored target offset. Emit a stable warning event naming the skipped range, or refuse under `--strict-baseline`. Do not warn for first-ever watch or catch-up-then-watch.

**Verify:** `pnpm exec vitest run tests/session-observer/watch.test.ts && pnpm run type-check`

Generated-bundle CLI flag assertions run in p02-t05 after the canonical build.

**Commit:** `feat(p02-t03): guard unread watch baselines`

### Task p02-t04: Warn about newer same-cwd sessions

**Files:**

- Modify: `src/transcript/session-observer/lib/watch.ts`
- Modify: `src/transcript/session-observer/lib/locate.ts`
- Modify: `src/transcript/session-observer/lib/types.ts`
- Modify: `tests/session-observer/watch.test.ts`

**Implementation:** During each poll window, check for a newer same-cwd candidate for the watched runtime. Emit a deduplicated neutral `newer-session-candidate` event with identity evidence; never auto-switch or claim supersession.

**Verify:** `pnpm exec vitest run tests/session-observer/watch.test.ts`

**Commit:** `feat(p02-t04): warn on newer peer sessions`

### Task p02-t05: Regenerate and document the base observer surface

**Files:**

- Modify: `skills/session-observer/SKILL.md`
- Modify: `skills/export-session-transcript/SKILL.md` (version bump required by its shared generated runtime change)
- Generated: `skills/session-observer/scripts/**/*.mjs`
- Generated: `skills/export-session-transcript/scripts/lib/runtimes.mjs` (shared canonical runtime output from p01)
- Modify as needed: `scripts/build-generated.mjs`
- Modify as needed: `scripts/bump-version.mjs`
- Modify: relevant generated-output/release tests

**Implementation:** Document new commands/events and the rule that a filtered digest is not evidence of absence. Bump the base skill version consistently, ensure release tooling tracks it, run the canonical build, and commit all generated outputs together. Never hand-edit generated `.mjs` files.

**Verify:** `pnpm run build && pnpm run build:check && pnpm exec vitest run tests/session-observer/cli.test.ts tests/session-observer/locate.test.ts tests/session-observer/watch.test.ts tests/tooling/generated-output-sync.test.ts tests/release/skill-version-bumps.test.ts`

**Commit:** `feat(p02-t05): publish observer collaboration primitives`

## Phase 3: Establish the collaboration protocol and control plane

### Task p03-t01: Scaffold the canonical sibling skill

**Files:**

- Create: `skills/session-observer-collab/SKILL.md`
- Create: `skills/session-observer-collab/references/runtime-claude-code.md`
- Create: `skills/session-observer-collab/references/runtime-codex.md`
- Create: `skills/session-observer-collab/references/runtime-cursor.md`
- Create: `skills/session-observer-collab/scripts/`
- Modify: `tests/repo/layout.test.ts`
- Modify/add: standalone skill metadata/layout tests

**Implementation:** Create a versioned, public standalone skill at the canonical `skills/` path with dependency-free Node 22 compatibility. Add load-one-runtime-reference routing and placeholder-free protocol/reference shells; do not author in generated provider mirrors or use harness magic filenames.

**Verify:** `pnpm exec vitest run tests/repo/layout.test.ts tests/repo/skill-frontmatter.test.ts && pnpm run validate`

**Commit:** `feat(p03-t01): scaffold session observer collaboration skill`

### Task p03-t02: Author the runtime-neutral N=2 protocol

**Files:**

- Modify: `skills/session-observer-collab/SKILL.md`
- Add: protocol-focused repository tests as needed

**Implementation:** Encode exact-identity arming, catch-up-then-watch, capability probing/disclosure, user/peer addressing, cross-session direction versus local authorization, automatic-control provenance, no-op and empty-delta suppression, pause triggers, consensus freshness/correction, bounded raw-record verification with secret redaction, stateless third-observer limits, shared-worktree serialization, log format, and closeout. Include the validated mid-run onboarding pattern as a self-contained kickoff brief carrying exact peer pins, stateless-read-only constraints, bounded tasks, authority/no-op conventions, and the shared log format; use the transferred `cursor-kickoff.md` as evidence/template. Reference base CLI one-liners without duplicating its mechanics.

**Verify:** `pnpm run validate && pnpm exec vitest run tests/repo/layout.test.ts`

**Commit:** `feat(p03-t02): define mutual observation protocol`

### Task p03-t03: Implement versioned lease state and control operations

**Files:**

- Create: `skills/session-observer-collab/scripts/collab-control.mjs`
- Create: `skills/session-observer-collab/scripts/lib/*.mjs`
- Create: `tests/session-observer-collab/control.test.ts`
- Create: sanitized fixtures under `tests/session-observer-collab/fixtures/`

**Implementation:** Add idempotent install/status/arm/disarm/prune, per-session XDG leases, owner-only permissions, version/schema migration, atomic writes, compare-and-swap cursor/count semantics, explicit armed/waiting/idle/triggered/disarmed states, bounded expiry/caps, and ownership-safe pruning. Define a runtime adapter interface so p04 and p05 never edit shared control files.

**Verify:** `pnpm exec vitest run tests/session-observer-collab/control.test.ts`

**Commit:** `feat(p03-t03): add collaboration lease controls`

### Task p03-t04: Normalize substantive completion and continuation selection

**Files:**

- Create/modify: `skills/session-observer-collab/scripts/lib/*.mjs`
- Create: `tests/session-observer-collab/completion.test.ts`

**Implementation:** Consume base observer JSON/provenance rather than duplicating raw transcript parsers. Select the latest completed substantive peer turn, return an exact contiguous range, advance to `completedRecord + 1`, and suppress empty, metadata-only, replayed automatic, and `[no-op]` activity without spending budget. Preserve short genuine feedback.

**Verify:** `pnpm exec vitest run tests/session-observer-collab/completion.test.ts`

**Commit:** `feat(p03-t04): select bounded peer continuations`

## Phase 4: Implement and validate the Codex lifecycle adapter

### Task p04-t01: Implement the thin Codex Stop hook

**Files:**

- Create: `skills/session-observer-collab/scripts/hooks/codex-stop.mjs`
- Create: `tests/session-observer-collab/codex-hook.test.ts`
- Use as oracle only: project `references/prototypes/codex/*`

**Implementation:** Validate the acting session/worktree/transcript and one lease, enter bounded waiting, invoke shared completed-turn selection, atomically claim cursor/count, and emit the harness continuation decision containing `session_observer_wake`. Preserve unrelated hooks and treat malformed/expired/mismatched state as fail-closed no-op/diagnostic behavior.

**Verify:** `pnpm exec vitest run tests/session-observer-collab/codex-hook.test.ts`

**Commit:** `feat(p04-t01): add bounded Codex continuation hook`

### Task p04-t02: Complete Codex install, trust, and lifecycle operations

**Files:**

- Modify: `skills/session-observer-collab/references/runtime-codex.md`
- Add/modify: Codex-specific adapter registration files under the skill
- Modify: `tests/session-observer-collab/control.test.ts`
- Modify: `tests/session-observer-collab/codex-hook.test.ts`

**Implementation:** Cover exact-command trust, `/hooks` approval/effective-execution proof, static hook coexistence, five-second default wait, opt-in longer waits with steering warning, one-shot/recurring bounds, timeout-to-idle truthfulness, restart behavior, deterministic disarm, safe prune, and explicit uninstall. Do not infer enablement from an absent `enabled` field.

**Verify:** `pnpm exec vitest run tests/session-observer-collab/control.test.ts tests/session-observer-collab/codex-hook.test.ts`

**Commit:** `feat(p04-t02): complete Codex collaboration lifecycle`

### Task p04-t03: Run the Codex acceptance harness

**Files:**

- Modify: `skills/session-observer-collab/references/runtime-codex.md` only for measured corrections
- Add: sanitized test evidence/fixtures when durable and repository-appropriate

**Implementation:** Exercise exact trust breadcrumb, one substantive trigger, exact range/cursor, recurring two-continuation flow, finite caps/expiry, waiting/idle states, no-op suppression, queued user input/steering, hook coexistence, stale-worktree pruning, and disarm. Record live-harness evidence against the acceptance matrix without committing live session state; the Verify command below covers only the automated subset and must not be treated as proof that live harness rows passed.

**Verify:** `pnpm exec vitest run tests/session-observer-collab/codex-hook.test.ts tests/session-observer-collab/control.test.ts`

**Commit:** `test(p04-t03): verify Codex collaboration lifecycle`

## Phase 5: Implement Cursor and Claude harness adapters

### Task p05-t01: Implement the Cursor Stop-hook adapter

**Files:**

- Create: `skills/session-observer-collab/scripts/hooks/cursor-stop.mjs`
- Create: `tests/session-observer-collab/cursor-hook.test.ts`

**Implementation:** Validate Cursor Stop input and terminal success, use shared completed-turn selection, enforce independent `loop_limit` and lease bounds, and return only a synthetic `followup_message` wake envelope. Late output cannot wake an idle session; error/abort/cancel and provisional turns cannot become peer positions.

**Verify:** `pnpm exec vitest run tests/session-observer-collab/cursor-hook.test.ts`

**Commit:** `feat(p05-t01): add Cursor continuation hook`

### Task p05-t02: Document and probe Cursor lifecycle behavior

**Files:**

- Modify: `skills/session-observer-collab/references/runtime-cursor.md`
- Modify: `tests/session-observer-collab/cursor-hook.test.ts`
- Add: sanitized Cursor fixtures/evidence when appropriate

**Implementation:** Cover conversation/session identity, `turn_ended` ordering, observed-side stateless review, success/non-success statuses, loop count, input during wait, restart/resume, synthetic and no-op suppression, absent tool-result payloads, scheduled-poll fallback, and stronger-tier probes. Label lifecycle continuation documented-but-unvalidated unless live arm → peer post → followup generation → disarm succeeds.

**Verify:** `pnpm exec vitest run tests/session-observer-collab/cursor-hook.test.ts tests/transcript-core/runtimes.test.ts`

**Commit:** `docs(p05-t02): define measured Cursor collaboration support`

### Task p05-t03: Author and verify the Claude Code Monitor recipe

**Files:**

- Modify: `skills/session-observer-collab/references/runtime-claude-code.md`
- Add: protocol/reference validation tests as needed

**Implementation:** Probe Monitor availability, run a pinned quiet-empty/no-heartbeat watch when present, define event-wake disclosure, verify substantive notifications, same-session client restart resilience, clean stop, and scheduled/manual fallback. Keep Monitor harness-native but optional by capability probe. Record live Monitor evidence against the acceptance matrix; the Verify command below covers the automated/documentation subset and is not proof of a passing live harness row.

**Verify:** `pnpm run validate && pnpm exec vitest run tests/session-observer/watch.test.ts`

**Commit:** `docs(p05-t03): add Claude Monitor collaboration recipe`

## Phase 6: Integrate, document, and close the evidence loop

### Task p06-t01: Integrate skill distribution and release invariants

**Files:**

- Modify: `scripts/validate.mjs`
- Modify: `scripts/bump-version.mjs`
- Modify: `tests/repo/layout.test.ts`
- Modify: `tests/release/skill-version-bumps.test.ts`
- Modify/add: collaboration skill structure tests

**Implementation:** Register the new standalone skill in required layout/release tooling, validate metadata/version consistency and dependency-free scripts, preserve public discovery semantics, and ensure provider mirrors remain generated. Bump every changed skill version exactly once relative to `origin/main`.

**Verify:** `pnpm exec vitest run tests/repo/layout.test.ts tests/release/skill-version-bumps.test.ts && pnpm run validate && node scripts/validate-skill-versions.mjs --base-ref origin/main`

**Commit:** `build(p06-t01): register collaboration skill distribution`

### Task p06-t02: Publish user and engineering documentation

**Files:**

- Modify: `documentation/docs/user-guide/skills/index.md`
- Modify: `documentation/docs/user-guide/skills/meta.json`
- Create: `documentation/docs/user-guide/skills/session-observer-collab.md`
- Modify: `documentation/docs/user-guide/skills/session-observer.md`
- Modify as needed: `documentation/docs/engineering/repository-layout.md`
- Modify as needed: `documentation/docs/engineering/architecture/generated-runtime.md`
- Modify: docs-presence/navigation tests

**Implementation:** Document installation, N=2 topology, honest wake tiers, runtime loading, authority, closeout, new base flags, generated-source boundary, and validated-versus-documented provider status. Keep README as an entry point and avoid stale marketplace/provider claims.

**Verify:** `pnpm exec vitest run tests/repo/docs-presence.test.ts tests/repo/readme-scope.test.ts && pnpm run validate`

**Commit:** `docs(p06-t02): document session observer collaboration`

### Task p06-t03: Record all intentional v2 deferrals

**Files:**

- Create: `.oat/repo/pjm/backlog/items/BL-*.md`
- Modify: `.oat/repo/pjm/backlog/index.md`
- Modify as needed: `.oat/repo/pjm/current-state.md` and roadmap narrative

**Implementation:** Create clear file-backed backlog items for deferred per-observer offsets/N>2 mesh, stronger Cursor wake surfaces, Cursor transcript-store/slug coverage, and optional idle-session application integrations. Consolidate only when acceptance criteria remain independently verifiable. Do not close the existing shared-log or direct-messaging initiatives.

**Verify:** `oat backlog regenerate-index && git diff --check && pnpm run validate`

**Commit:** `chore(p06-t03): capture collaboration v2 follow-ups`

### Task p06-t04: Run the full acceptance and sanitization matrix

**Files:**

- Modify: tests/fixtures/docs only for findings discovered by the matrix
- Audit: project `references/` and shipped skill examples for secrets/live state

**Implementation:** Run every automated acceptance row; execute available Claude/Codex/Cursor live probes; preserve unvalidated labels for unavailable/failed probes; verify no live leases, secrets, or credentials ship; reconcile the historical `.session-observer/` source-packet wording with the project-local reference path; and get a peer final review of the current handoff.

**Verify:** `pnpm run build && pnpm run build:check && pnpm run type-check && pnpm test && pnpm run validate && node scripts/validate-skill-versions.mjs --base-ref origin/main && pnpm run smoke`

**Commit:** `test(p06-t04): close collaboration acceptance matrix`

### Task p06-t05: Verify clean closeout and installation handoff

**Files:**

- Modify: project implementation/review artifacts and durable docs only if needed

**Implementation:** Final freshness poll, resolve peer findings, finalize bounded evidence logs, stop watchers/Monitor/pollers, disarm and prune leases, ask whether static hooks should remain, verify destination artifacts, and confirm backlog IDs in the handoff. After merge—or during explicitly authorized local dogfooding—refresh the canonical user-level skill and provider symlinks, then run `oat sync --scope user`.

**Verify:** `pnpm run worktree:validate` from a clean worktree, plus `oat sync --scope user` only at the repository-approved installation boundary.

**Commit:** `chore(p06-t05): finalize collaboration handoff`

## Reviews

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | passed  | 2026-07-12 | managed review after fix iteration 2/2 |
| p02    | code     | passed  | 2026-07-12 | managed review after fix iteration 2/2 |
| p03    | code     | fixes_added | 2026-07-12 | blocked after review fix limit 2/2 |
| p04    | code     | pending | -    | -        |
| p05    | code     | pending | -    | -        |
| p06    | code     | pending | -    | -        |
| final  | code     | pending | -    | -        |
| spec   | artifact | pending | -    | N/A (quick mode) |
| design | artifact | passed  | 2026-07-12 | inline co-author review |
| plan   | artifact | passed  | 2026-07-12 | managed structured review (clean) |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

Human co-author artifact review passed on 2026-07-12 with no Critical or Important findings; three Minor findings were resolved directly in the design/plan. The independent managed plan review then identified two Important readiness-bookkeeping issues; both were fixed, and the target-preserving re-review returned clean with no remaining findings.

The configured cross-runtime quick-start gate was explicitly skipped by user direction after its first non-JSON run produced no eligibility envelope. That artifact was archived unconsumed and does not replace the clean managed plan-review disposition above.

## Implementation Complete

**Summary:**

- Phase 1: 4 tasks — normalize queued input, automatic control provenance, Cursor completion, and user recovery
- Phase 2: 5 tasks — add identity and watch safeguards, regenerate and document the base skill
- Phase 3: 4 tasks — establish the sibling skill, protocol, lease controls, and completion selection
- Phase 4: 3 tasks — implement and validate Codex lifecycle continuation
- Phase 5: 3 tasks — implement Cursor continuation and document Cursor/Claude harness behavior
- Phase 6: 5 tasks — integrate distribution/docs/PJM, run the full matrix, and close out safely

**Total: 24 tasks across 6 phases**

Ready for implementation via `oat-project-implement`.

## References

- [Discovery](discovery.md)
- [Lightweight design](design.md)
- [Authoritative implementation brief](references/prompt.md)
- [Packet manifest](references/README.md)
- [Acceptance matrix](references/acceptance-matrix.md)
- [Codex lifecycle contract](references/codex-stop-hook-setup.md)
- [Cursor lifecycle contract](references/cursor-stop-hook-setup.md)
- [Closeout runbook](references/closeout-runbook.md)
