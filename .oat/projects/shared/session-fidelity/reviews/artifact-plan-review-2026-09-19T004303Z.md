---
oat_generated: true
oat_generated_at: 2026-09-19T00:43:03Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/session-fidelity
oat_gate_headless: true
oat_gate_run_id: a40ecbf5-e651-4bdc-8667-4d9d92eece59
oat_gate_target: claude-fable-skip-permissions
oat_gate_runtime: claude
oat_invocation_model: fable
oat_invocation_reasoning_effort: provider-default
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-09-19T00:43:03Z
**Scope:** `plan.md` at `40d0405e` reviewed as the quick-mode pre-implementation bundle against `discovery.md` and `design.md` (workflow mode: `quick`; `implementation.md` read for ledger and prior-disposition consistency)
**Files reviewed:** 2 in declared scope (`plan.md`, `discovery.md`), plus `design.md` and `implementation.md` as available upstream/ledger context
**Commits:** n/a (artifact review; no git range)

**Dispatch audit:** `Dispatch: scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:opus effort_axis=not-applicable dispatch_policy=high dispatch_ceiling=opus target=opus`
**Gate route:** `inline` (runtime=claude; validated `cliRoot` equals `OAT_GATE_CLI_ROOT`). Headless gate mode selected the inline route, which overrides tier selection. The resolver-selected target above is the configured managed reviewer target, not an observed runtime identity; the gate's configured invocation is recorded in frontmatter. Runtime identity is `not-reported`.
**Dispatch Profile advisory:** applied. The plan has no `## Dispatch Profile` section, which is normal and is not a finding.

## Summary

This is the re-gate of the corrected plan. All seven dispositions from the first gate review (`reviews/archived/artifact-plan-review-2026-09-19T003400Z.md`) are verified in the artifact: p03-t01 now owns activity-mode presentation rules with matching assertions; branch transitions have single-shot owners (p00-t01 for `IDENTITY_BASE`, the root pre-step in p02-t01 for `ACTIVITY_BASE`, bound to the reviewed identity tip with p01-t04 as a required ancestor); the two rejections (keep p01-t04 atomic; keep the out-of-repo temporary formatter config) carry stated rationale that is consistent with repository instructions; and the three Minor wording fixes landed. The plan remains canonically well-formed: 7 phases / 18 tasks with stable monotonic IDs, per-task Files/Implement/Format/Verify/Commit blocks, an eight-column `## Reviews` ledger with every prior row preserved, `## Implementation Complete`, `## References`, and a justified `oat_plan_parallel_groups: []`. Pre-review frontmatter (`oat_ready_for: null`, `oat_template: true`, absent `oat_plan_hill_phases`) matches the quick-start interruption-safe contract.

Every existing source, test, doc, fixture-root, canary and backlog path named in the plan exists; every `pnpm run` script named in a Verify line is defined in `package.json`; referenced commits `c970c876`, `3e16dd9c`, `56e6b07f` are in history. One Medium coverage gap remains: the design's native tool-category lookup has a file but no described behavior or assertion in any task. Three Minor precision issues follow. No Critical or Important findings.

Findings: 0 critical, 0 important, 1 medium, 3 minor

## Findings

### Critical

None

### Important

None

### Medium

- **Native tool-category classification has a file but no assigned behavior or test** (`.oat/projects/shared/session-fidelity/plan.md:161-169`)
  - Issue: `design.md:99` requires "a small native-name lookup to classify shell/read/write/edit/grep/glob/search/fetch/task/ask/MCP/other while preserving exact names", with unknown tools kept generic; `design.md:174` lists "unknown MCP names" as a shared test; the backlog brief (`BL-260916-session-fidelity-opt.md:22`) names "categories" as part of the activity view; discovery's complexity reductions explicitly say "Keep native categories" (`discovery.md:91`), and `design.md:141` puts `kind/category` in the extracted-event model. In the plan, p02-t03 lists `classify.ts` under Files, but its title ("classify ownership") and its entire Implement paragraph describe only inherited/owned/unknown ownership attribution. `grep -n -i "categor" plan.md` matches only p02-t04's prohibition on per-category omission tables; no task describes the category lookup, its closed category set, the unknown/MCP fallback, or an assertion for it. An implementer following the plan literally would write `classify.ts` as an ownership classifier and ship events without the required category field, and the p02 phase review would have no plan text to hold it against.
  - Fix: Extend p02-t03 Implement with one sentence, e.g.: "In `classify.ts`, also add the small native-name lookup assigning shell/read/write/edit/grep/glob/search/fetch/task/ask/MCP/other categories while preserving exact native names; unknown and unrecognized MCP names keep the generic category. Do not add derived command/path/URL enrichments or a grouped tool index." Add "category lookup including unknown MCP names" to its Verify assertions (either in `correlate.test.ts` or a colocated `classify.test.ts` added to Files and the vitest command). No new task or task-count change is needed.
  - Requirement: design §Classification and projection; discovery Success Criterion 2 ("typed extraction, classification, correlation"); backlog brief summary.

### Minor

- **p01-t01 and p02-t01 change a bundled shared module without a build step** (`.oat/projects/shared/session-fidelity/plan.md:93`, `:145`)
  - Issue: Both tasks edit `src/shared/transcript/runtimes.ts`, which is bundled into the observer, exporter, fork and collab distributions. The execution contract says to include owned generated outputs "in the same task commit when they change" (`plan.md:57`), but outputs only change when `pnpm run build` runs, and these two Verify lines omit it while every consumer task includes it. Literal execution leaves `build:check` stale after p01-t01 (until p01-t02) and across all of p02 (until p03-t01), and attributes the regenerated bundles for the reader/identity change to a later, unrelated task commit. The local `pre-commit` hook does not catch this (`build:check` runs only in `pre-push`).
  - Suggestion: Add `pnpm run build` and `pnpm run build:check` to the p01-t01 and p02-t01 Verify lines, with generated outputs included in those commits when they differ.

- **Version fan-out guidance understates what the validator enforces** (`.oat/projects/shared/session-fidelity/plan.md:57`, `:125`, `:289`)
  - Issue: The plan says to determine shared-runtime fan-out "from actual bundle diffs" / "transitive generated changes". `scripts/validate-skill-versions.ts:185-203` marks an owner affected when any changed file sits under its declaration's `allowedSourceRoots`, independent of bundle content. `src/shared/transcript` is declared by `session-observer`, `session-observer-collab`, `session-export-transcript` and `session-fork-to-destination` (`src/distributions.ts:161`, `:205`, `:231`, `:252`). In the activity layer, new files under `src/shared/transcript/activity/` and `fixtures/` therefore require bumps and changelog entries for all four owners even where a bundle (for example fork or collab) is byte-identical. The named `validate:skill-versions` check will fail loudly and the fix is mechanical, so this is a precision issue, not a gap.
  - Suggestion: In the execution contract, state that the validator's source-root rule is authoritative: any change under `src/shared/transcript/**` requires a version bump and Unreleased changelog entry for every owner declaring that root, in addition to owners whose bundles change.

- **`--all --include-activity` exposure is not named in the exporter task** (`.oat/projects/shared/session-fidelity/plan.md:233-237`)
  - Issue: `design.md:133` requires that `--all --include-activity` make the broader exposure explicit in each generated artifact, with default filenames/semantics unchanged and the header identifying activity exports and reporting rendered bytes, preview caps, the 64 MiB limit and omitted counts. p04-t01 covers labelling and p02-t04 covers the size/omission header, but neither mentions the `--all` combination or asserts it; p04-t01's Verify checks only "counts/previews and no observer state mutation".
  - Suggestion: Add to p04-t01 Implement "`--all --include-activity` labels every generated artifact as an activity export; default filenames and `--all` semantics are unchanged", and add a matching CLI assertion to its Verify line.

## Requirements/Design Alignment

**Evidence sources used:** `plan.md` (artifact under review, at `40d0405e`), `discovery.md` (quick-mode upstream contract), `design.md` (present; lightweight design), `implementation.md` (ledger and first-gate dispositions), `reviews/archived/artifact-plan-review-2026-09-19T003400Z.md` (prior gate findings), `.oat/repo/pjm/backlog/items/BL-260916-session-fidelity-opt.md` (originating brief), repository file tree, `package.json` scripts, `vitest.config.ts`, `.oxfmtrc.json`, `tools/git-hooks/`, `scripts/validate-skill-versions.ts`, `src/distributions.ts`, `~/.agents/skills/oat-project-quick-start/SKILL.md` and `oat-project-plan-writing/SKILL.md` (pre-review frontmatter and `oat_plan_hill_phases` contract), git history.

### Prior Gate Finding Verification

| Prior finding                                | Disposition             | Verified                                                                                                                                                              |
| -------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 observer presentation rules unassigned    | resolve_in_artifact     | Yes — `plan.md:205`, `:209` (marker suppression, operator Q/A, ask-user caveats, invocation-derived counts, conversation-only limits, assertions)                     |
| M2 branch creation lacks single-shot owner   | resolve_in_artifact     | Yes — `plan.md:73` (`IDENTITY_BASE`), `:141`/`:145` (`ACTIVITY_BASE` = reviewed identity tip; p01-t04 ancestor check); open-ended "only when starting" clause removed |
| M3 split p01-t04                             | rejected_with_rationale | Accepted — rationale stated in `plan.md:125` and `implementation.md`; helper, consumers, versions, changelog and generated output stay one atomic behavior change     |
| M4 temporary formatter config                | rejected_with_rationale | Accepted — `plan.md:55` now places the config outside the repository, scopes it to exact authored project paths, and excludes generated OAT indexes/dashboards/views  |
| m1 undefined "four deferred sidecar classes" | resolve_in_artifact     | Yes — `plan.md:301` names deferred external-output and child-trajectory sidecar reads                                                                                 |
| m2 stale draft prose / singular correction   | resolve_in_artifact     | Yes — `plan.md:19`, `:23`                                                                                                                                             |
| m3 guidance inside Commit field              | resolve_in_artifact     | Yes — `plan.md:233`, `:245`; Commit fields are message-only                                                                                                           |

### Requirements Coverage

| Requirement                                                                                                       | Status      | Notes                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| Discovery SC (added scope): native Codex parent/child pins; source-bound state; schema documentation              | implemented | p01-t01/t02/t03; docs layer committed as `c970c876`                                                          |
| Discovery SC1: detailed read with physical line/byte + diagnostics; `readRecords()` compatible                    | implemented | p02-t01 (LF-only, U+2028/9, CRLF, partial tail, byte-for-byte legacy comparison)                             |
| Discovery SC2: typed extraction, classification, correlation, pure projection preserving pointers before budgets  | partial     | Extraction/correlation/projection in p02-t02–t05; native tool-category classification unassigned (Medium)    |
| Discovery SC3: Claude/Codex calls/results, exact names/IDs, carriers, honest outcomes, function/custom/web-search | implemented | p02-t02, p02-t03                                                                                             |
| Discovery SC4: flag on both consumers; unchanged identity/checkpoints; default output and sanitization intact     | implemented | p03-t01/t02, p04-t01/t02                                                                                     |
| Discovery SC5: Cursor frame identity; settled-only stateful delivery; pending calls stateless; separate tests     | implemented | p05-t01, p05-t02                                                                                             |
| Discovery SC6: fixture coverage (late/unmatched, repeated, malformed, Unicode, later failures, ask-user, Cursor)  | implemented | p02-t01/t03/t04/t05, p03-t01, p04-t02, p05-t01                                                               |
| Discovery SC7: activity exports labelled sensitive/debug; no publish-safe claim                                   | implemented | p04-t01, p04-t02; `--all` combination not named (Minor)                                                      |
| Discovery SC8: SKILL.md, guides, distributions, version fan-out, changelog; repo gates                            | implemented | p01-t04, p06-t01, p06-t02; fan-out wording imprecise (Minor)                                                 |
| Design §Native identity and saved cursor binding                                                                  | implemented | p01-t01/t02/t03 incl. cache revalidation, ambiguity, watcher error event, lease fail-closed, no state schema |
| Design §Native Claude conversation provenance                                                                     | implemented | p01-t04                                                                                                      |
| Design §Budget policy (32 KiB/80, 128 KiB/1024, 64 MiB export, 2 KiB previews, 256 B late-call context)           | implemented | p02-t04 values match the design table                                                                        |
| Design §Error Handling (`ACTIVITY_EXTRACTION_ERROR`, whole-pass degradation, fail-closed identity)                | implemented | p02-t02, p03-t01                                                                                             |
| Design §Review and delivery sequence (three-layer `gh stack`)                                                     | implemented | p00-t01 and the root pre-step in p02-t01                                                                     |
| Quick-start plan contract (stable IDs, verification + commit per task, required sections, row preservation)       | implemented | 18 tasks match the `implementation.md` ledger and `## Implementation Complete` totals                        |
| Discovery Out of Scope (no daemon/MCP/sidecar reads/new tuning flags/JSON export)                                 | implemented | Repeated explicit prohibitions in p02-t04, p04-t01, p05-t02                                                  |

### Extra Work (not in declared requirements)

None. The `gh stack` arrangement (p00-t01) and the out-of-repo temporary formatter config are user-selected or previously dispositioned; neither is new machinery in this revision.

## Verification Commands

```bash
# Medium: category lookup assigned and asserted in p02-t03
rg -n -i "categor|native-name lookup|unknown MCP" .oat/projects/shared/session-fidelity/plan.md

# Minor 1: build steps on the two shared-runtime tasks
rg -n "^\*\*Verify:\*\*" .oat/projects/shared/session-fidelity/plan.md | rg -n "runtimes.test.ts"

# Minor 2: validator source-root rule stated
rg -n "allowedSourceRoots|source-root|every owner declaring" .oat/projects/shared/session-fidelity/plan.md

# Minor 3: --all combination named in p04-t01
rg -n -- "--all" .oat/projects/shared/session-fidelity/plan.md
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks. No blocking findings at the `important` threshold; the one Medium is a single-sentence plan-artifact correction to p02-t03 that should land before `oat-project-implement` reaches p02.
