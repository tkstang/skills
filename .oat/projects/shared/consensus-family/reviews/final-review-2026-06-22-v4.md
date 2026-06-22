---
oat_generated: true
oat_generated_at: 2026-06-22
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-family
---

# Code Review: final

**Reviewed:** 2026-06-22
**Scope:** Independent second-opinion final code review for `62c26a2..HEAD` (consensus creation family: `independent_draft` loop-core cold-start + `consensus-create` / `consensus-decide` / `consensus-plan`)
**Files reviewed:** 94 changed files (focused source review of `src/consensus/{core,create,decide,plan,refine,evaluate}`, generated `.mjs`, schemas, manifests, docs, smoke, tests)
**Commits:** 60 (`62c26a2..HEAD`)

## Summary

This is an independent re-verification done from source — I did not assume the prior Codex passes (final v1–v3) were correct. The implementation cleanly delivers FR1–FR6 and NFR1–NFR5. `independent_draft` is a round-1-only cold-start in the loop core, threaded into both prompt builders, recorded in the resolution block, and proven across all three iteration modes by skill-independent loop tests; refine/evaluate keep deliberate `shared_input`-only guards with semantic (not "not yet supported") wording. The three new wrappers ship full anatomy, default to the correct v3 settings, frame all user input as untrusted, and reuse the DR-024 verdict seam and schemas unchanged. The decide dissent-surfacing contract (the project's most semantically load-bearing behavior) is implemented robustly: dissent is re-rendered from the synthesizer's structured `unresolved_disagreements[]` after stripping any LLM-generated dissent section, and a dedicated integration test proves it surfaces verbatim at minimal agency. All five repository gates pass. I found no Critical, Important, or Medium findings — only two Minor artifact-drift notes where lifecycle artifacts lag the (defensible) shipped implementation.

## Findings

### Critical

None

### Important

None

### Medium

None

### Minor

- **`implementation.md` references a `create-prompts.ts` file that does not exist** (`implementation.md:188`, Phase 2 "Key files touched")
  - Issue: The Phase 2 summary lists `src/consensus/create/create-prompts.ts` as a touched file, but the create prompt profile lives entirely in `src/consensus/create/consensus-create.ts` (`buildCreatePromptProfile`, `src/consensus/create/consensus-create.ts:641`). No separate prompt module was created. This is stale lifecycle-artifact wording, not a code defect — the shipped layout (single wrapper file) is defensible and matches decide/plan.
  - Suggestion: Update the `implementation.md` Phase 2 "Key files touched" bullet to reference `src/consensus/create/consensus-create.ts` instead of the non-existent `create-prompts.ts`. No code change.

- **`plan.md` p02-t01/p02-t02 task titles/file lists describe a parser+loader/prompt-profile split that the implementation consolidated** (`plan.md:336-429` vs `implementation.md:210-219`)
  - Issue: The plan's p02-t01 ("Add Create Wrapper Argument Model") and p02-t02 ("Implement Create Input Loading and Prompt Profile") imply staged files, and implementation.md's p02-t01 title ("Add Create CLI Argument Parser and Input Loader") already diverges from the plan title. The actual delivery folds parsing, loading, prompt profile, and run into one file. This is benign plan-vs-implementation drift; the shipped result satisfies FR4 and is internally consistent. Behavior, tests, and gates are unaffected.
  - Suggestion: No action required for merge. If desired during closeout, note the consolidation in the `## Deviations from Plan / Design` table for traceability. No code change.

## Spec/Design Alignment

**Evidence sources used:** `discovery.md` (referenced), `spec.md`, `design.md`, `plan.md`, `implementation.md`, archived reviews (`final-review-2026-06-22-v3.md`, `p01..p04` archived reviews), plus direct reads of `src/consensus/core/consensus-loop.ts`, `src/consensus/{create,decide,plan,refine,evaluate}/*.ts`, generated `.mjs`, schemas, manifests, smoke script, and the new test files.

### Requirements Coverage

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| FR1 | implemented | `ColdStartMode` widened to `'shared_input' \| 'independent_draft'` (`consensus-loop.ts:22`); loop parser accepts both via `COLD_START_MODES` and rejects unknown (`consensus-loop.ts:1676-1679`), replacing the old hard rejection. New wrappers accept both; refine/evaluate keep `shared_input`-only guards with semantic wording (`consensus-refine.ts:2407-2417`, `consensus-evaluate.ts:335-348`). Round-1 framing selects the brief vs revise wording by `coldStart` (`framingLinesForColdStart`/`roundOneTaskForColdStart`, `consensus-loop.ts:1783-1847`). |
| FR2 | implemented | Round-1 framing coherent in all three modes: parallel modes draft independently from the brief with `previous revision = none` (`consensus-loop.ts:1863-1869`, `executeParallelRound` passes `coldStart`, line 2409); alternating degenerate path = turn 1 drafts, turn 2 revises peer A (`roundOneTaskForColdStart` alternating branches, `consensus-loop.ts:1827-1841`). Loop-level skill-independent tests cover round-1 prompt shape and round-1→convergence for each mode with `cold_start` recorded (`tests/consensus/core/independent-draft-loop.test.ts`, `independent-draft-prompts.test.ts`). |
| FR3 | implemented | Effective `cold_start` recorded in the status/resolution block (`resultStatus`, `consensus-loop.ts:2124`). `--cold-start` parsed and validated in core and each new wrapper; create defaults `independent_draft` (`consensus-create.ts:234,902`), decide `independent_draft`+`minimal` (`consensus-decide.ts:201`), plan `independent_draft`+`moderate` (`consensus-plan.ts:206,203`). refine/evaluate reject `independent_draft`. |
| FR4 | implemented | `consensus-create`: brief inline/file (exactly-one, `validateBriefSources`, `consensus-create.ts:204-222`) + optional template; defaults `independent_draft`/`parallel_synthesized`/`maximum` (`consensus-create.ts:231-234`); whole-artifact (empty initial artifact, `createInitialArtifact()` returns `''`, line 999; round-1 omits draft seed, line 554-556). Full anatomy: SKILL.md (versions in sync), schemas, `references/examples/artifact-brief.md`, operator-qa, generated `.mjs` (banner present), manifest + README + CHANGELOG entries, tests. |
| FR5 | implemented | `consensus-decide`: `--options` path; defaults `independent_draft`/`parallel_synthesized`/`minimal`. Required headings rendered (`## Recommendation/Reasoning/Alternatives` + canonical `## Dissent / Unresolved Disagreement`). **Dissent surfacing is correct**: `unresolvedDisagreements()` collects structured synthesis disagreements (`consensus-decide.ts:1127-1139`), `removeGeneratedDissentSection()` strips any LLM-emitted dissent (line 1148-1170), and the canonical dissent section is always appended (line 1206-1208). Integration test proves the synthesizer's `unresolved_disagreements[]` surfaces verbatim at minimal agency without editorial collapse (`tests/consensus/decide/provider-cli-integration.test.ts:68,105`). |
| FR6 | implemented | `consensus-plan`: required `--goal` (non-empty, `consensus-plan.ts:286,305-306`) + optional inline `--constraints`; defaults `independent_draft`/`parallel_synthesized`/`moderate`. Markdown headings (Steps/Dependencies/Risks) via prompt framing; full anatomy + tests; smoke asserts headings, resolution block, `cold_start: independent_draft`. |
| NFR1 | implemented | No runtime dependency changes; `package.json`/`pnpm-lock.yaml` not touched for runtime deps in scope. New runtime uses Node stdlib only; generated `.mjs` carry the `// GENERATED` banner and run install-free. |
| NFR2 | implemented | `pnpm run build:check` reports all 11 consensus generated outputs in sync (no hand edits). Each new skill `version` == `metadata.version` == `0.1.0`. Registered in `SKILL_FILES` (`scripts/bump-version.mjs:21-23`), `build-generated.mjs` mappings, and both test allowlists (`skill-frontmatter.test.ts` skillPaths + name allowlist; `versioning.test.ts` skillFiles). |
| NFR3 | implemented | DR-024 seam reused unchanged — no `src/consensus/provider-cli/` source changes in scope. Verdict/synthesis schemas byte-identical to refine's across all three new skills (`diff -q` clean). Family enforces the `verdict` enum itself: `validateVerdictShape` looks up the verdict value in the per-mode branch table and rejects out-of-enum values (`consensus-loop.ts:886-896`), which the subset JSON-schema validator does not do. `verdict_source`/audit trail recorded via `providerAuditFields` (line 1546). |
| NFR4 | implemented | 1 MiB cap (`INPUT_SIZE_CAP_BYTES`, enforced at file-stat and post-read in each wrapper) + path confinement (`confineRead`/`confineWrite` with `realpath`) for all file-backed inputs. All user input framed as untrusted: create `<CREATE_BRIEF>`/`<CREATE_TEMPLATE>` (line 594-613), decide `<DECISION_OPTIONS>`, plan `<PLAN_GOAL>`/`<PLAN_CONSTRAINTS>` (line 725-739). The plan-fix hardening is verified: user-controlled `--goal` is no longer interpolated raw — it travels via `PLAN_GOAL_HEADER` + a delimited, HTML-encoded block (`consensus-plan.ts:827,711-718`). create/decide interpolate only a fixed `DEFAULT_*_GOAL` constant (`consensus-create.ts:136`, `consensus-decide.ts:45`), so no injection surface there. |
| NFR5 | implemented | All five gates pass (see Verification Commands): `build:check`, `type-check`, `test` (856 passed / 1 skipped gated-live-e2e), `validate`, `smoke`. |

### Extra Work (not in declared requirements)

None of concern. Incidental, in-scope-appropriate changes were observed and are correct: `.oxfmtrc.json` / `.oxlintrc.json` generated-output lint/format exclusions for the new `.mjs` paths (required by the generated-output drift guard), and provider manifest `description`/`shortDescription`/`longDescription` updates for discoverability (the `0.1.0` pin is correctly NOT bumped). Both are documented in the implementation.md Deviations table.

## Verification Commands

Run these to verify the implementation (all executed during this review against `62c26a2..HEAD`):

```bash
pnpm run build:check   # PASS — all 11 consensus generated outputs (incl. create/decide/plan loop + wrapper) in sync
pnpm run type-check    # PASS — no TypeScript errors
pnpm run test          # PASS — 84 files passed / 1 skipped; 856 tests passed / 1 skipped (gated live e2e)
pnpm run validate      # PASS — structure/manifest/docs invariants
pnpm run smoke         # PASS — mocked create/decide/plan family flow (cold_start, deliberation log, resolution, dissent heading, plan headings)
```

Targeted re-checks also run clean during review:

```bash
git diff --check 62c26a2..HEAD                       # no whitespace errors
diff -q plugins/consensus/skills/refine/schemas/*.schema.json plugins/consensus/skills/{create,decide,plan}/schemas/*.schema.json  # schemas byte-identical
```

## Recommended Next Step

No Critical/Important/Medium findings — the branch is merge-ready. The two Minor findings are stale lifecycle-artifact wording (defensible shipped implementation) and do not block merge. Optionally run the `oat-project-review-receive` skill to record the two Minor artifact-alignment notes (update `implementation.md` Phase 2 file list; optionally note the create file-consolidation in the Deviations table), or fold them into `oat-project-complete` closeout. Otherwise, proceed to merge.
