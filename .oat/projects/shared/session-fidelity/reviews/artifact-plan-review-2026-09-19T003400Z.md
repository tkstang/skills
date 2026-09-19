---
oat_generated: true
oat_generated_at: 2026-09-19T00:34:00Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/session-fidelity
oat_gate_run_id: ddd86035-011c-447a-bfac-9ac6191a89fe
oat_gate_target: cursor-fable-5-1-high
oat_gate_runtime: cursor
oat_invocation_model: claude-fable-5-1-high
oat_invocation_reasoning_effort: unknown
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-09-19T00:34:00Z
**Scope:** `plan.md` reviewed as the quick-start pre-implementation bundle against `discovery.md` and `design.md` (workflow mode: `quick`; `implementation.md` read for ledger consistency)
**Files reviewed:** 3
**Commits:** n/a (artifact review; no git range)

**Dispatch audit:** `Dispatch: scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol-high effort_axis=not-applicable dispatch_policy=high dispatch_ceiling=gpt-5.6-sol-high target=oat-reviewer-gpt-5-6-sol-high`
**Gate route:** `inline` (runtime=cursor; validated `cliRoot` matches `OAT_GATE_CLI_ROOT`). Headless gate mode selected the inline route; the resolver-selected Cursor variant above is recorded as the configured managed target, not as an observed runtime identity. Runtime identity is `not-reported`.

## Summary

The plan is canonically well-formed: 7 phases / 18 tasks with stable monotonic IDs, per-task Files/Implement/Format/Verify/Commit blocks, a widened `## Reviews` ledger with all prior rows preserved, `## Implementation Complete`, `## References`, and a `## Parallelism` section justifying `oat_plan_parallel_groups: []`. Every referenced source/test/doc path that is claimed to exist does exist, every `pnpm run` script named in verification is present in `package.json`, `pnpm --dir documentation build` resolves, and the referenced commits (`c970c876`, `56e6b07f`, `3e16dd9c`) are in history. Design components (identity/cursor binding, Claude provenance, detailed reader, extractors/correlation, projection, observer, exporter, Cursor settlement, docs/acceptance) each map to at least one task, and budgets in p02-t04 match the design table exactly.

Four Medium issues should be addressed before implementation begins: the observer activity-mode presentation rules from the design are not assigned to any task; the stacked-branch transitions between layers are not owned by a single-shot task; p01-t04 bundles a cross-owner behavioral change with layer finalization; and the plan invents a temp-config formatter workaround for `.oat/**` that contradicts the repository's ignore configuration and the hygiene contract's skip fallback. Three Minor wording/placement issues follow. No Critical or Important findings.

Findings: 0 critical, 0 important, 4 medium, 3 minor

## Findings

### Critical

None

### Important

None

### Medium

- **Observer activity-mode presentation rules are unassigned** (`.oat/projects/shared/session-fidelity/plan.md:204`)
  - Issue: `design.md:119` requires that in activity mode the observer suppress duplicate legacy tool-call/result markers while preserving ordinary messages and operator Q/A, keep the ask-user human/automatic caveats, derive counts from extracted invocations (not rendered markers), and apply conversation tail limits / `--max-turns` / `--max-bytes` independently before attaching activity (`design.md:117`). The design Testing Strategy (`design.md:176`) lists "activity with tools/debug without duplicate markers" and "ask-user attribution" as consumer tests. Backlog Stage 2 also requires "ask-user handling and its human/auto caveat preserved". p03-t01's Implement covers flag parsing, single read reuse, optional activity object, range selection, default-output preservation, and extraction-failure degradation, but none of these presentation rules; no other task claims them (`rg -n "duplicate legacy|ask-user|max-turns" plan.md` matches only the Claude-provenance text in p01-t04). An implementer following the plan literally could ship `--include-activity --include-tools` with duplicated evidence and no caveat coverage.
  - Fix: Extend p03-t01 Implement with: "In activity mode suppress the legacy tool-call/result markers while preserving ordinary messages and operator questions/answers; retain ask-user human/automatic caveats; report counts from extracted invocations; apply existing conversation tail limits and `--max-turns`/`--max-bytes` to conversation only, before attaching activity." Add matching assertions to its Verify line (`digest.test.ts`/`cli.test.ts`: no duplicate markers with `--include-tools --include-activity`; ask-user caveat retained).
  - Requirement: discovery Key Decision 1 and 3; Success Criterion 4; backlog Stage 2/3.

- **Layer branch creation is not owned by a single-shot task** (`.oat/projects/shared/session-fidelity/plan.md:72`, `:135`)
  - Issue: p00-t01 says "Add identity, then activity only when starting those phases", which makes p00-t01 a task that must be revisited at two later boundaries even though the ledger and commit contract treat it as completed once (`implementation.md:38`). The activity-branch creation and `ACTIVITY_BASE` recording exist only as a Phase 2 header note ("Establish a fresh `ACTIVITY_BASE` before this layer", `plan.md:135`), not in any task's Implement/Verify, so `oat-project-implement`'s task-driven execution has no owner for it. Because history is linear and layer boundaries coincide with task commits, this is recoverable retroactively (`git branch <activity> <p01-t04 sha>`) without history rewriting, so it is not blocking — but the plan's own "Root owns Git operations" rule means an unowned step is likely to be skipped.
  - Fix: Scope p00-t01 to the bottom layer plus the identity branch (p01 starts immediately after), and record `IDENTITY_BASE` there. Add an explicit root-owned step to p02-t01's Implement (or a small `p02-t00`-style pre-step inside p02-t01) that creates the activity branch from the verified p01-t04 commit, registers it with `gh stack`, records `ACTIVITY_BASE` in `implementation.md`, and verifies the identity-layer diff. Remove the open-ended "only when starting those phases" clause from p00-t01.

- **p01-t04 bundles a cross-owner behavioral change with layer finalization** (`.oat/projects/shared/session-fidelity/plan.md:121-131`)
  - Issue: One task touches `runtimes.ts`, the observer classifier/digest/CLI, exporter sanitizer, fork-to-destination preview, collab completion-selection (+ `.d.mts`), every affected canonical `SKILL.md` version, generated distributions, `CHANGELOG.md`, the user guide, observer references, and collab recovery guidance, then runs the full `type-check`/`build:check`/`test`/`validate`/`smoke`/`validate:skill-versions` suite — all under a single `fix(p01-t04)` commit. The provenance helper plus its consumer audit is a coherent unit, but folding version fan-out, changelog, docs, and whole-layer acceptance into the same task weakens atomicity (plan-writing invariant: bounded file scope per task) and makes the p01 phase review harder to attribute.
  - Fix: Split into `p01-t04` (shared provenance helper + consumer audit + fixtures + focused tests + the generated outputs of the touched owners) and `p01-t05` (identity-layer finalization: shared-runtime version fan-out from actual bundle diffs, `CHANGELOG.md` Unreleased entry, docs, and the full gate suite with `--base-ref "$IDENTITY_BASE"`). Update `## Implementation Complete` (p01: 5 tasks; total 19) and the `implementation.md` ledger to match.

- **Temp-config formatter workaround contradicts repo ignore policy and the hygiene fallback** (`.oat/projects/shared/session-fidelity/plan.md:55`)
  - Issue: The task execution contract instructs implementers to copy `.oxfmtrc.json`, strip only the `.oat/**` ignore, and run `pnpm exec oxfmt --write --config <temporary-config>` on project artifacts. `.oxfmtrc.json` (`ignorePatterns` line `".oat/**"`) deliberately excludes that tree; the repository's documented write command (`pnpm format` → `oxfmt --write .`, file-scoped via `pnpm exec oxfmt --write <paths>`) therefore skips `.oat/**` by design. The hygiene contract quoted in the plan's own governing skills says to use the repository's documented command and, if none applies, "warn once … skipping" — not to synthesize an override config. The workaround also creates a transient config file inside the repo that can be committed by mistake, and reformatting OAT-owned artifacts (`plan.md` `## Reviews` table, generated indexes) risks fighting the OAT generators the same way `AGENTS.md` warns about for the root instruction file. `oxfmt --config` exists, so the approach is technically executable; the concern is necessity and risk, not feasibility.
  - Fix: Replace the sentence with: "OAT artifacts under `.oat/**` are excluded by `.oxfmtrc.json`; do not format them with an override config. Format only authored `src/`, `documentation/`, `CHANGELOG.md`, and root-manifest paths changed by the task." If the user wants `.oat/projects/**` formatted, land that as a repo-level `.oxfmtrc.json` change in its own commit rather than a per-task temp config.

### Minor

- **Undefined reference: "the four deferred sidecar classes"** (`.oat/projects/shared/session-fidelity/plan.md:301`)
  - Issue: p06-t02 asks the implementer to offer backlog capture for "the four deferred sidecar classes", but no project artifact enumerates four classes (`rg -n -i "sidecar" discovery.md design.md references/collaboration-summary.md` yields only generic "no sidecar reads in v1" statements). The implementer cannot write an accurate backlog item from this.
  - Suggestion: Name them inline (e.g., Claude `persistedOutputPath` external results, Claude child-agent trajectories, Codex `SubAgentActivity` child threads, Cursor agent-tools/child files — or whatever the intended set is), or point to the discovery `## Deferred Ideas` bullet and update that bullet to list them.

- **Prose that will go stale on handoff, and a singular/plural drift** (`.oat/projects/shared/session-fidelity/plan.md:19`, `:22`, `:41`)
  - Issue: The blockquote "This is a draft, not an implementation-ready handoff" will contradict `oat_ready_for: oat-project-implement` / `oat_template: false` once quick-start Step 3.7 flips the frontmatter, and nothing in the plan or quick-start contract updates that sentence. Separately, the Architecture line says default behavior is intact "except the explicitly authorized identity correction" (singular) while `## Resolved provenance and fixture scope` states there are two intentional default-output changes (Codex identity and Claude provenance), and p03-t01 says "identity/provenance".
  - Suggestion: Reword line 19 to a state-neutral instruction ("Execute with `oat-project-implement` once the `## Reviews` plan row is `passed` and frontmatter readiness is set") and change line 22 to "except the explicitly authorized identity and Claude-provenance corrections".

- **Implementation guidance placed inside a Commit field** (`.oat/projects/shared/session-fidelity/plan.md:251`)
  - Issue: p04-t02's `**Commit:**` line carries the message and then a substantive instruction ("Implement the core sanitization regression in p04-t01 alongside the feature; this task adds only remaining adversarial coverage…"). Tooling and reviewers that read the Commit field as the message alone will miss it, and it belongs to p04-t01's scope definition as much as p04-t02's.
  - Suggestion: Move the sentence into p04-t02's Implement paragraph and add "including the core sanitization regression that p04-t02 later extends" to p04-t01's Implement.

## Requirements/Design Alignment

**Evidence sources used:** `plan.md` (artifact under review), `discovery.md` (quick-mode upstream contract), `design.md` (present; lightweight design), `implementation.md` (ledger consistency), `.oat/repo/pjm/backlog/items/BL-260916-session-fidelity-opt.md` (originating brief), repository file tree, `package.json` scripts, `.oxfmtrc.json`, `documentation/package.json`, git history, `~/.agents/skills/oat-project-quick-start/SKILL.md` (pre-review frontmatter contract, confirming `oat_template: true` is the expected pre-handoff state).

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| Discovery SC (added scope): native Codex parent/child pins select one source; source-bound state refuses wrong-file reuse; schema documentation | implemented | p01-t01/t02/t03; docs layer already committed as `c970c876` (verified in history) |
| Discovery SC1 / Backlog Stage 1: detailed read with physical line/byte + diagnostics; `readRecords()` compatible; shared `activity/` module | implemented | p02-t01 (reader, LF-only, U+2028/9, CRLF), p02-t02–t04 (module layout matches design §Architecture) |
| Discovery SC2: typed extraction/classification/correlation/pure projection preserving pointers before budgets | implemented | p02-t02 (raw carriers retained), p02-t03 (`classify.ts`), p02-t04 (projector), p02-t05 (integration) |
| Discovery SC3 / Backlog Stage 2: Codex function/custom/web-search coverage, independent `call_id`, ask-user caveat preserved | partial | Carriers and `item_completed` evidence in p02-t02; exact-ID-only pairing in p02-t03. Ask-user caveat retention in the activity path is not assigned (Medium finding 1) |
| Discovery SC4 / Backlog Stage 3: flag on both consumers; review/catch-up/watch unchanged identity/checkpoints; separate envelope; sanitization intact | partial | p03-t01/t02, p04-t01/t02 cover threading, activity-only deltas, sanitizer protection. Duplicate-marker suppression and independent conversation limits unassigned (Medium finding 1) |
| Discovery SC5 / Backlog Stage 4: Cursor identity from frame analysis; settled-only stateful delivery; pending calls in stateless review/export; observer v2 and exporter tested separately | implemented | p05-t01 (positional identity, pending-lifecycle), p05-t02 (terminal checkpoints, exactly-once, collab gating) |
| Discovery SC6: fixtures cover late/unmatched results, repeated calls, malformed JSONL, large outputs, Unicode offsets, later failures, ask-user attribution, Cursor lifecycle | partial | Covered across p02-t01/t03/t04, p04-t02, p05-t01 except ask-user attribution (see above) |
| Discovery SC7 / Backlog: activity exports labelled activity/debug, not publish-safe; unsupported surfaces explicit | implemented | p04-t01 ("Label activity/debug content and coverage"), p04-t02 ("Do not describe opt-in output as publish-safe") |
| Discovery SC8 / Backlog Docs: SKILL.md, user guides, generated distributions, version fan-out, changelog agree with tested behavior; repo gates pass | implemented | p01-t04 (identity layer), p06-t01 (activity layer), p06-t02 (acceptance) |
| Design §Native Claude conversation provenance (user-authorized default-output change) | implemented | p01-t04 covers helper, consumer audit, runtime-notification origin, collab semantics, fixtures |
| Design §Budget policy (32 KiB/80, 128 KiB/1024, 64 MiB export, 2 KiB previews, 256 B late-call context) | implemented | p02-t04 values match design table exactly |
| Design §Error Handling (`ACTIVITY_EXTRACTION_ERROR`, whole-pass failure → unavailable report, fail-closed identity) | implemented | p02-t02, p03-t01 |
| Design §Review and delivery sequence (three-layer `gh stack`, bookkeeping travels with layer) | partial | p00-t01 registers the bottom layer; identity/activity branch creation lacks a single-shot owner (Medium finding 2) |
| Quick-start plan contract: stable IDs, per-task verification + commit, `## Reviews`/`## Implementation Complete`/`## References`, row preservation, `## Parallelism` | implemented | All present; Reviews ledger widened to 8 columns with placeholders preserved; task count (18) matches ledger |
| Discovery Out of Scope (no daemon/warehouse/MCP, no sidecar reads, no new public tuning flags) | implemented | Plan repeatedly forbids sidecar reads, range-selection CLI, JSON export mode, new state schema |

### Extra Work (not in declared requirements)

- p00-t01 local `gh stack` arrangement — user-selected delivery mechanism recorded in discovery Key Decision 11 and design §Review and delivery sequence; in scope by direction, not scope creep.
- Temp-config formatting workaround for `.oat/**` (Medium finding 4) — machinery not requested by any upstream artifact.

## Verification Commands

Run these after the plan is revised to confirm the findings are addressed:

```bash
# Medium 1: presentation rules assigned to p03-t01
rg -n "duplicate legacy|ask-user|max-turns|max-bytes" .oat/projects/shared/session-fidelity/plan.md

# Medium 2: activity-branch creation owned by a task (not only a phase header)
rg -n "ACTIVITY_BASE|IDENTITY_BASE|gh stack" .oat/projects/shared/session-fidelity/plan.md

# Medium 3: p01 task split reflected in ledger and totals
rg -n "^### Task p01-t0[0-9]|Planned total|p01: " .oat/projects/shared/session-fidelity/plan.md .oat/projects/shared/session-fidelity/implementation.md

# Medium 4: temp-config workaround removed
rg -n "temporary-config|temporary copy of" .oat/projects/shared/session-fidelity/plan.md   # expect no matches

# Minor 1: sidecar classes enumerated
rg -n -i "sidecar" .oat/projects/shared/session-fidelity/plan.md .oat/projects/shared/session-fidelity/discovery.md

# Minor 2/3: stale prose and Commit-field guidance
rg -n "not an implementation-ready handoff|except the explicitly authorized identity correction\b" .oat/projects/shared/session-fidelity/plan.md   # expect no matches
rg -n "^\*\*Commit:\*\* \`test\(p04-t02\)" .oat/projects/shared/session-fidelity/plan.md
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks. No blocking findings at the `important` threshold; the four Medium findings are plan-artifact corrections that should land before `oat-project-implement` starts p00.
