---
oat_generated: true
oat_generated_at: 2026-09-16T20:47:20Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/session-observer-rearm
oat_gate_headless: true
oat_gate_run_id: 6e485c5f-811e-45bd-b529-637f18677b01
oat_gate_target: claude-fable-skip-permissions
oat_gate_runtime: claude
oat_invocation_model: fable
oat_invocation_reasoning_effort: provider-default
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-09-16T20:47:20Z
**Scope:** `artifact plan` — lite-mode `plan.md` for `session-observer-rearm` (gate-originated exit-gate review)
**Files reviewed:** 1 (`plan.md`; `implementation.md` and `state.md` read for context)
**Commits:** none (artifact review has no git range; plan at `00ec4225`)

**Workflow mode:** lite. Discovery, spec, design, and import reference are absent by design. The requirements contract is `plan.md` Summary, Decisions, Assumptions, Out of Scope, Validation Criteria, plus Product Behavior and Technical Design (recorded content shape: `both`).

**Dispatch audit:** `Dispatch: scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:opus effort_axis=not-applicable dispatch_policy=high dispatch_ceiling=opus target=opus`
Gate route: inline (runtime=claude, cliRoot=/Users/tstang/Library/pnpm/store/v11/links/@open-agent-toolkit/cli/0.2.77/d9bcf1efab193b3f50b4a9c1dd921b1d2a818293c9e44f3789f0f41ed09b7842/node_modules). Runtime identity: not-reported (no independent observation). The configured gate exec-target model (`fable`) is recorded from the gate prompt, not from self-identification.

**Reconnaissance:** not-attempted (narrow single-artifact review stays inline).

## Summary

The plan is complete, internally consistent, and its Technical Design claims were verified against `watch.ts`, `observe.ts`, and the existing test harness: `observeCatchUp()` persists `lastRecordIndex = nextIndex` before returning (`observe.ts:1495-1500`, `markReadIfNeeded`), `catch-up-then-watch` emits before taking the signature (`watch.ts:1231-1236`), plain `watch` emits `baseline-gap` (`watch.ts:1226-1228`), SIGTERM sets `stopRequested` without a flush (`watch.ts:1620-1623`), max-runtime runs `flushPendingBeforeMaxRuntime` (`watch.ts:1569-1581`), and a duplicate target restores the consumed baseline (`watch.ts:1163-1171`). All referenced scripts, flags, paths, and generated outputs exist. No blocking findings.

Three Medium findings concern executability and evidence honesty: a format step that fails on `.oat/` paths, a documented clean-stop path (`watch-ctl stop`) not covered by the SIGTERM-only evidence, and an unspecified deterministic mechanism for the SIGTERM lifetime that conflicts with the plan's virtual-clock claim. Four Minor findings cover ledger cell hygiene, a competing-consumer interleaving to pin down, PJM close-out completeness, and an ambiguous SKILL.md edit scope.

Findings: 0 critical, 0 important, 3 medium, 4 minor

## Findings

### Critical

None

### Important

None

### Medium

- **t03 format step targets ignored `.oat/` paths and exits nonzero** (`.oat/projects/shared/session-observer-rearm/plan.md:198`)
  - Issue: `pnpm exec oxfmt --write .oat/repo/pjm/backlog/completed.md .oat/repo/pjm/backlog/archived/BL-...md` runs against paths listed in `.oxfmtrc.json` `ignorePatterns` (`.oat/**`). Verified: `pnpm exec oxfmt --check .oat/repo/pjm/backlog/completed.md` exits 2 with "All matched files may have been excluded by ignore rules", and `.lintstagedrc.mjs` documents that passing only ignored files makes oxfmt fail. An implementer following Step 3 literally hits a failing command.
  - Fix: Replace the Step 3 command with the repository rule ("do not format `.oat/` artifacts; run `git diff --check` on changed backlog files") or drop the oxfmt invocation for these paths.

- **Documented re-arm clean stop is `watch-ctl stop`, but the evidence matrix covers only SIGTERM** (`.oat/projects/shared/session-observer-rearm/plan.md:31`, `:41`, `:147`)
  - Issue: The guidance t02 will ship (`runtime-claude-code.md:135-136`) instructs operators to stop via `watch-ctl stop` (control directive) before re-arming, while Product Behavior 1 and t01 prove only SIGTERM and max-runtime. Both control-stop (`watch.ts:1607-1610`) and signal (`watch.ts:1620-1623`) set `stopRequested` and break before `emitReadyPending`, so equivalence is plausible, but the plan neither exercises it nor states it. The reconciled guidance would then claim a verified procedure whose exact path was not run.
  - Fix: Add a third clean-stop lifetime using `writeControlDirective({ directive: 'stop' })` (`watch-state.ts:913`) in the same two-lifetime fixture, or add an explicit assertion/rationale line in t01 and the t02 guidance stating that control-stop and SIGTERM share the `stopRequested` path and the SIGTERM evidence transfers.

- **SIGTERM lifetime mechanism unspecified; conflicts with the virtual-clock claim** (`.oat/projects/shared/session-observer-rearm/plan.md:71`, `:102`, `:106`)
  - Issue: "Why proportionate" says both lifetimes use the virtual clock and injected stdout, but in-process `runWatchLoop` cannot receive a deterministic SIGTERM without emitting a signal on the vitest worker. The only existing deterministic SIGTERM pattern spawns the CLI and uses `waitFor` on `watch.json.active` (`watch.test.ts:3034-3090`), which cannot use `deps.now`/`deps.sleep`/`deps.writeStdout`. Validation Criterion 1 requires captured `fromIndex`/`nextIndex`, persisted state, digest content, and stdout evidence for the SIGTERM case, so the plan must say which channels supply that evidence in the subprocess form.
  - Fix: State per lifetime: max-runtime and the negative stdout-failure control run in-process with the virtual clock and a rejecting `writeStdout` dep (`writeStdoutChunk` awaits promise/callback results, `watch.ts:283-304`); the SIGTERM lifetime spawns the CLI with `--json`, waits on `watch.json.active`, sends SIGTERM, and takes range/state evidence from the JSON stdout events and `STATE_DIR` files. Keep the "no timing sleeps" constraint by using `waitFor` predicates, not fixed delays.

### Minor

- **Plan review ledger row carries non-canonical cells** (`.oat/projects/shared/session-observer-rearm/plan.md:222`)
  - Issue: The structured plan-review row records Artifact `plan.md`, Reviewed Head `working-tree@46f49d3`, Invocation `oat-reviewer-gpt-5-6-sol-high (retry 1)`, and Gate Target `managed high`. The ledger's typed columns expect `-` for Reviewed Head, Invocation, and Gate Target on non-code rows and a `reviews/` artifact path (or `-`) in Artifact. The lifecycle narrowing lookup only matches `Type=code` rows, so impact is limited, but the row is malformed for readers keyed by header name.
  - Suggestion: Keep the row (never delete); set the three typed cells to `-`, set Artifact to `-`, and move the reviewer identity/retry note into `state.md` progress or the handoff.

- **Competing-consumer case should pin the interleaving it asserts** (`.oat/projects/shared/session-observer-rearm/plan.md:43`, `:106`)
  - Issue: `restoreConsumedBaseline` (`watch.ts:790-804`) rolls the shared offset back after the contender's `observeCatchUp` has already advanced it; it is not atomic with the owner's `emitPending` read (`watch.ts:1415-1470`). If the owner polls between those two writes it sees zero new records, and the restored range is only re-read on the next append. The plan's "rejected without consuming the first watcher's unread content" is true for the contender-rejected-before-owner-polls interleaving only.
  - Suggestion: Specify that the deterministic test asserts the contender-first interleaving and records the other interleaving as characterization under the existing CAS stop boundary, not as a defect to fix.

- **t03 omits PJM close-out step 5 and the atomic archive command** (`.oat/projects/shared/session-observer-rearm/plan.md:189`, `:193`)
  - Issue: `.oat/repo/pjm/AGENTS.md:36-37` requires refreshing `current-state.md` and the curated overview when a completion changes the operating picture; the task lists steps 1-4 only. `oat backlog archive <id>` performs steps 1-4 atomically and avoids the partial-close-out drift the AGENTS file warns about.
  - Suggestion: Add the step-5 check to Step 1 and prefer `oat backlog archive BL-260916-session-observer-re-armed` over the manual sequence, keeping `oat pjm doctor --json` as the proof.

- **t01 SKILL.md edits are listed as `Modify` but only version bumps are described** (`.oat/projects/shared/session-observer-rearm/plan.md:94-95`, `:106`)
  - Issue: Both `SKILL.md` files appear under Files, but Step 1 mentions only "bump both affected skill versions". Product Behavior 4 guidance lands in t02's reference doc, so it is unclear whether any operator-facing SKILL.md content changes are intended in t01.
  - Suggestion: Annotate the two entries as "version-only" or state the intended content change.

## Requirements/Design Alignment

**Evidence sources used:** `plan.md` (Summary, Decisions, Product Behavior, Technical Design, Assumptions, Out of Scope, Validation Criteria, tasks), `implementation.md`, `state.md`; backlog item `BL-260916-session-observer-re-armed`; source `watch.ts`, `observe.ts`, `state.ts`, `watch-state.ts`; tests `watch.test.ts`, `integration.test.ts`, `runtime-claude-code-reference.test.ts`; `package.json` scripts; `.oxfmtrc.json`; `.lintstagedrc.mjs`; `scripts/validate-skill-versions.ts`; `src/distributions.ts`; `.oat/repo/pjm/AGENTS.md`.

### Requirements Coverage

| Requirement                                   | Status      | Notes                                                                                                                          |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| PB1 Exact-pin clean re-arm                    | implemented | t01 two-lifetime fixtures; see Medium findings 2 and 3 on control-stop coverage and SIGTERM mechanism                          |
| PB2 Honest range accounting                   | implemented | t01 filtered-only case; `quietEmpty` + `rendered.count === 0` path at `watch.ts:1476-1478`                                     |
| PB3 Startup and contention safety             | implemented | t01 startup-append and competing-consumer cases; see Minor finding 2                                                           |
| PB4 Bounded delivery claim                    | implemented | t02 reference doc + contract test                                                                                              |
| PB5 Portable evidence                         | implemented | t01/t02 sanitized fixtures; no local paths required                                                                            |
| VC1 restart tests (SIGTERM + max-runtime)     | implemented | t01; command verified (`test:vitest` forwards file args to `vitest run`)                                                       |
| VC2 negative control + separate cases         | implemented | t01; injected stdout failure precedent exists (`integration.test.ts:79-108`); `writeStdoutChunk` propagates rejections         |
| VC3 canonical guidance                        | implemented | t02; existing contract test asserts wording that will change (`30-minute ceiling`), plan includes updating it                 |
| VC4 versions + generated payloads             | implemented | t01/t02; `--base-ref` flag verified (`validate-skill-versions.ts:445`); `origin/main` is `49b4baf3` as assumed                 |
| VC5 premerge gates                            | implemented | t03; `premerge` script exists                                                                                                  |
| VC6 conditional backlog disposition           | partial     | t03 covers steps 1-4; see Minor finding 3 (step 5, atomic archive)                                                             |
| Backlog AC (ticket)                           | implemented | All five acceptance criteria map to t01/t02/t03                                                                                |
| Dispatch Profile ceiling advisory             | n/a         | No `## Dispatch Profile` section; omission is normal                                                                           |
| Canonical plan format                         | implemented | Frontmatter, Reviews, Implementation Complete, References present; task IDs `p01-t01..t03` monotonic; single sequential phase |

### Extra Work (not in declared requirements)

None

## Verification Commands

Run these to verify the fixes:

```bash
# Medium 1: the replaced t03 format step must not invoke oxfmt on .oat/ paths
grep -n "oxfmt --write .oat" .oat/projects/shared/session-observer-rearm/plan.md || echo "ok: no oxfmt on .oat paths"

# Medium 2/3: plan names control-stop coverage (or explicit equivalence) and the per-lifetime mechanism
grep -n -i "control-stop\|watch-ctl stop\|writeControlDirective" .oat/projects/shared/session-observer-rearm/plan.md
grep -n -i "spawn\|waitFor\|watch.json.active" .oat/projects/shared/session-observer-rearm/plan.md

# Minor 1: ledger row cells are typed
awk -F'|' '/^\| plan +\| artifact/ {print}' .oat/projects/shared/session-observer-rearm/plan.md

# Existing plan check commands still resolve
pnpm run validate:skill-versions -- --base-ref origin/main
pnpm run build:check
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
