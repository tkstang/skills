---
oat_generated: true
oat_generated_at: 2026-07-23T02:21:20Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/cursor-collaboration-reliability
oat_gate_headless: true
oat_gate_run_id: fa8ceaad-8dfd-4d50-9ff7-f4e9a88c2471
oat_gate_target: cursor-gpt-5-6-sol-max
oat_gate_runtime: cursor
oat_invocation_model: gpt-5.6-sol-max
oat_invocation_reasoning_effort: provider-default
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-07-23T02:21:20Z
**Scope:** `plan.md` completeness, internal consistency, implementation readiness,
and alignment with the spec-driven upstream artifacts
**Files reviewed:** 5 (`plan.md`, `spec.md`, `design.md`, `discovery.md`,
`implementation.md`)
**Commits:** none — artifact review
**Gate route:** inline (runtime `cursor`; branch-local CLI root validated)
**Project dispatch audit:** Dispatch: scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol-high effort_axis=not-applicable dispatch_policy=high dispatch_ceiling=gpt-5.6-sol-high target=oat-reviewer-gpt-5-6-sol-high

## Summary

The plan has a complete 33-task inventory, stable task IDs, explicit requirement
coverage, and generally sound phase ordering. It is not implementation-ready:
five Important findings leave the review state invalid, split the P0
reserve/write/commit contract across tasks that cannot satisfy it as written,
and leave live evidence, privacy, and shipped collaboration guidance without
safe executable gates.

Findings: 0 critical, 5 important, 2 medium, 0 minor

## Findings

### Critical

None

### Important

- **The plan pre-claims a passing review without an artifact**
  (`plan.md:730`)
  - Issue: The only plan-review row is already `passed`, dated 2026-07-22, and
    has `-` for its artifact even though no plan review artifact exists. This
    contradicts the table's own definition that `passed` means the latest
    review has no unresolved Critical, Important, or Medium findings
    (`plan.md:743`) and can falsely satisfy workflow routing before this gate's
    result is received.
  - Fix: Preserve the placeholder row but restore it to `pending` with `-` for
    date and artifact. Keep this gate run as a separate append-ordered
    `received` event bound to its actual artifact, then let
    `oat-project-review-receive` determine the eventual pass state.

- **The delivery-CAS integration task omits the code that owns stdout**
  (`plan.md:322`)
  - Issue: p03-t04 promises to reserve before output and commit only after
    successful output, but its file scope contains only `observe.ts`, types,
    and tests. The one-shot CLI writes stdout in
    `src/transcript/session-observer/session-observer.ts`, while watch writes
    stdout in `src/transcript/session-observer/lib/watch.ts`; those callers are
    deferred to p03-t07 and p03-t06. The current library returns a digest before
    either caller writes it, so p03-t04 cannot independently deliver the
    reserve/write/commit guarantee it claims.
  - Fix: Define p03-t04 as an explicit two-phase reservation/finalization API
    that returns an uncommitted delivery handle, and assign commit/abandon after
    awaited stdout to p03-t06 and p03-t07 with failure-injection tests.
    Alternatively, include both output-owning callers and their tests in the
    integration task so the task is independently green.
  - Requirement: FR6

- **The live acceptance task has no safe executable harness for its matrix**
  (`plan.md:553`)
  - Issue: p05-t02 lists `whoami`, locate, pinned catch-up/watch, lifecycle
    outcomes, malformed repair, shrink, replacement, restart, and replay, but
    its only concrete verification command is `probe-local.mjs`. That helper
    currently performs discovery and one unpinned `review`; it does not execute
    the listed stateful/lifecycle matrix. The task also places destructive
    continuity scenarios "on an available controlled Cursor session" without
    requiring a disposable transcript copy, which risks mutating a provider
    transcript contrary to the read-only authority boundary.
  - Fix: Add a finite probe harness or exact command sequence for every claimed
    acceptance row. Keep real Cursor transcripts read-only; run malformed,
    repair, shrink, replacement, and replay scenarios only against a synthetic
    or copied transcript in a temporary store. Record expected versus actual
    structural outcomes and fail the row when a command was not run.
  - Requirement: FR4, FR7, FR9, NFR1, NFR6

- **Privacy validation runs before the tasks that add live evidence**
  (`plan.md:538`)
  - Issue: p05-t01 runs the plan's only sensitive-evidence scan, but p05-t02,
    p05-t03, and all Phase 6 probes subsequently modify
    `runtime-cursor.md`. Their verification steps and the final release gate do
    not repeat a privacy check. This is especially risky because the prescribed
    probe currently prints raw session IDs and absolute transcript paths. The
    single regex also checks only `/Users/` plus a few token shapes, so it is
    not a sufficient final gate for NFR2's no-prose, no-raw-ID, no-personal-path
    contract.
  - Fix: Add a repeatable evidence-redaction validator after every live probe
    task and to p05-t06/p06-t04. Cover all durable evidence, fixtures, and
    changed docs; detect cross-platform absolute paths, raw identity/lease
    values, credentials, and transcript prose canaries. Keep the early scan as
    a baseline, not the only gate.
  - Requirement: NFR2, NFR6

- **The documentation task omits a shipped skill that contains stale index guidance**
  (`plan.md:584`)
  - Issue: p05-t04 says to remove stale record-index-only Cursor guidance, but
    its file list includes only the Session Observer skill and docs-site pages.
    `skills/session-observer-collab/SKILL.md` currently instructs agents to use
    exact zero-based record indices for raw evidence, while this project moves
    Cursor collaboration to an explicit frame-index contract. p05-t05 lists
    that skill only for a version bump, not behavioral alignment.
  - Fix: Add `skills/session-observer-collab/SKILL.md` to p05-t04 and update its
    raw-evidence, completion, and capability language to dispatch by digest
    schema/index base. Verify the skill and `runtime-cursor.md` agree before the
    version bump and provider sync.
  - Requirement: FR8, NFR3

### Medium

- **Eight formatting steps contain non-executable placeholders**
  (`plan.md:518`)
  - Issue: p04-t06, p05-t02 through p05-t04, p05-t06, and p06-t01 through
    p06-t03 use commands such as
    `pnpm exec oxfmt --write <changed-file-list>`. These are not concrete
    write/fix invocations, so an implementer cannot run the governing task's
    command as written and must reconstruct exclusions for generated,
    provider-mirror, fixture, and instruction files.
  - Fix: Replace each placeholder with either explicit known paths or one
    executable changed-file collection command that applies the repository's
    documented exclusions and passes the resulting array to oxfmt. Give the
    canonical skill files in p05-t05 an explicit formatting disposition too.

- **The measured baseline is recorded only after the parser and observer are built**
  (`plan.md:524`)
  - Issue: The design's Phase 1 explicitly records the initial store/version
    support matrix and probe plan (`design.md:1655`) so framing and analyzer
    work is grounded in a named measured baseline. The plan delays the first
    capability matrix to Phase 5, after Phases 1–4 have encoded record,
    identity, and lifecycle assumptions. Eventual acceptance remains covered,
    but this sequencing removes the design's early evidence checkpoint.
  - Fix: Move the initial matrix/probe-plan work into Phase 1 before parser
    implementation, or add a small Phase 1 baseline task and retain p05-t01 as
    the post-implementation refresh. Unsupported/unavailable rows remain valid.
  - Requirement: FR9, NFR6

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** `plan.md` (artifact under review), `spec.md`
(requirements and requirement index), `design.md` (architecture, data models,
test mapping, implementation phases), `discovery.md` (validated boundaries),
and `implementation.md` (current scaffold/workflow context).

### Requirements Coverage

| Requirement | Status  | Notes |
| ----------- | ------- | ----- |
| FR1         | covered | Exact identity resolver and stateful integration tasks are explicit. |
| FR2         | covered | Framing, analysis, stability, digest, watch, and live acceptance are mapped. |
| FR3         | covered | Terminal reconciliation and completion eligibility have unit/integration coverage. |
| FR4         | partial | Automated continuity coverage is strong; the live acceptance harness is unsafe/underspecified (I3). |
| FR5         | covered | Independent status facets and CLI/watch projection tasks are explicit. |
| FR6         | partial | State/CAS primitives are covered, but output-commit ownership is not executable as scoped (I2). |
| FR7         | partial | Foreground-watch tests are extensive; live acceptance lacks a runnable matrix (I3). |
| FR8         | partial | Completion/lease/envelope work is mapped; shipped collab guidance is omitted from alignment (I5). |
| FR9         | partial | Matrix and probes exist, but the baseline is late and the probe contract is incomplete (I3, M2). |
| FR10        | covered | Conditional wake evaluation preserves an acceptable non-claim outcome. |
| NFR1        | partial | Runtime design is fail-closed; live destructive continuity probes need a disposable boundary (I3). |
| NFR2        | partial | Structural-only evidence is stated, but no final post-probe privacy gate exists (I4). |
| NFR3        | partial | Runtime compatibility is mapped; canonical collaboration instructions would remain stale (I5). |
| NFR4        | covered | Canonical/generated build, dependency, version, and provider-sync gates are present. |
| NFR5        | covered | Streaming, stat-only polling, finite waits, and aggregate gates are represented. |
| NFR6        | partial | Live commands, privacy verification, early baseline evidence, and formatter commands need executable gates (I3, I4, M1, M2). |

### Extra Work (not in declared requirements)

None. The isolated Cursor state, digest/lease/envelope versioning, provider
dogfooding, backlog closeout, and conditional wake phase all trace to the
specification or repository contracts.

## Verification Commands

Run these after revising the plan:

```bash
# No plan review may be pre-marked passed without a bound artifact.
rg -n '\| plan\s+\| artifact \| passed\s+\|.*\| -\s+\|' \
  .oat/projects/shared/cursor-collaboration-reliability/plan.md

# No formatter placeholder should remain.
rg -n 'oxfmt --write <' \
  .oat/projects/shared/cursor-collaboration-reliability/plan.md

# Recheck the affected plan and upstream artifact structure.
git diff --check -- \
  .oat/projects/shared/cursor-collaboration-reliability/plan.md \
  .oat/projects/shared/cursor-collaboration-reliability/spec.md
pnpm run validate
```

The two `rg` commands should return no matches.

## Recommended Next Step

Run `oat-project-review-receive` to convert the five Important and two Medium
findings into plan-fix tasks. Do not begin implementation until the invalid
pass row and the P0 delivery/evidence boundaries are corrected and re-reviewed.
