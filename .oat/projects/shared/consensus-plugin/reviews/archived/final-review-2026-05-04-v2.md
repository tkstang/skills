---
oat_generated: true
oat_review_type: code
oat_review_scope: final
oat_review_invocation: auto
oat_review_generated_at: 2026-05-04T11:59:01-0500
oat_project: .oat/projects/shared/consensus-plugin
verdict: fail
critical_count: 1
important_count: 1
medium_count: 0
minor_count: 0
---

# Code Review: final

**Reviewed:** 2026-05-04
**Scope:** Final lifecycle re-review of the full implementation diff `ca7fa11ced8ee1176c4f230aa7d76789b3d625d7..HEAD`
**Files reviewed:** 84
**Commits:** 70 (`ca7fa11..b1b8ad2`)

## Summary

The p05 work closed three of the prior final findings: release validation is version-aware, artifact frontmatter now includes the design-listed machine metadata, and `RELEASING.md` has fresh 122-test evidence while still blocking public v0.1 tagging until manual provider-runtime checks are complete. OAT routing is also in the expected state: all 37 tasks are complete, p05 passed, the final review row is still `fixes_completed`, and project state has no current task while awaiting final re-review.

The prior Critical resume finding is only partially closed. Completed section text is preserved when the current input still has the same sections, but resume still lets the current input file determine which sections exist; if the input shape changes, artifact sections can be silently dropped. I also found one Important edge case where minimal-agency artifacts can falsely fail resume hash validation.

Artifacts available and used: `discovery.md`, `spec.md`, `design.md`, `plan.md`, `implementation.md`, `state.md`, prior final review `reviews/archived/final-review-2026-05-04.md`, and phase reviews `p01-review-2026-05-04-v2.md`, `p02-fix-tasks-review-2026-05-04.md`, `p03-review-2026-05-04-v3.md`, `p04-review-2026-05-04-v2.md`, `p05-review-2026-05-04.md`.

## Findings

### Critical

- **Resume still allows the current input file to drop artifact sections** (`plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:1576`)
  - Issue: `parseDeliberationArtifactForResume` returns the canonical resume sections from the artifact (`plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:1338`), but `runSequential` always reads and parses the current input file first (`plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:1576`) and then iterates `parsedSections` (`plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:1606`). Resume sections are only copied when they match a current input section by id or index (`plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:1614`). If the current input file has lost a section, that artifact section is omitted from the resumed output and the wrapper can report `converged`.
  - Evidence: I reproduced this with a two-section artifact where `Intro` was completed and `Details` was in impasse. After editing the source input down to only `Intro` and resuming with `--resume`, the resumed artifact contained only `Intro`, dropped `Details`, and returned `status: "converged"` with `sections: ["Intro"]`.
  - Fix: When `--resume` is present, build the run section list from `resumeState.sections` rather than from the current input file. Treat input/resume section inventory mismatches as either non-fatal source drift for already-known sections or a fail-closed error requiring an explicit restart/skip option. Only use current input text for an explicit corrupt-section skip/restart path, and add a regression where a resumed artifact preserves all original sections after the source input removes or renames headings.
  - Requirement: FR6 (artifact-as-state resume), FR5 (canonical artifact state), p05-t01

### Important

- **Minimal-agency resume validation recomputes hashes with the wrong normalization** (`plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:314`)
  - Issue: The loop records and terminal status use strict bytewise hashing for `--agency minimal` (`plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs:70`, `plugins/consensus/skills/consensus-refine/scripts/consensus-loop.mjs:830`). Resume validation recomputes `resumedArtifactHash` with plain `hashArtifact(resumedArtifact)` (`plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:314`) before comparing it to the stored final hash (`plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:400`). A valid minimal-agency artifact containing trailing spaces or EOF differences is therefore reported as corrupt even though its canonical `final_output` is intact.
  - Evidence: A targeted probe generated a minimal-agency artifact from text with trailing spaces and two ACCEPT verdicts, then immediately parsed it for resume. Parsing failed with `RESUME_HASH_MISMATCH`: the stored strict hash and default normalized recomputation differed.
  - Fix: Recompute resume hashes with the same agency-aware hash options used by the loop, preferably by exporting/shared-using `hashOptionsForAgency` or by adding a small shared helper. Pass `resolution.agency` into `collectResumeValidationErrors`, normalize legacy artifacts explicitly, and add a regression for `--agency minimal` resume with trailing whitespace.
  - Requirement: FR6 / agency semantics in design Component B

### Medium

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** `.oat/projects/shared/consensus-plugin/discovery.md`, `spec.md`, `design.md`, `plan.md`, `implementation.md`, `state.md`, the prior final review, p01-p05 review artifacts, and the full code diff `ca7fa11..HEAD`.

### Requirements Coverage

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| FR1 | implemented | Repo scaffold, plugin package, provider manifests, marketplace manifests, skill frontmatter, and validation are present. |
| FR2 | implemented | Alternating loop and wrapper are implemented with mocked end-to-end coverage. |
| FR3 | implemented | Hash convergence, double ACCEPT, max-rounds, explicit impasse, and oscillation handling are present. |
| FR4 | implemented | Heading/marker section parsing, sequential default, host-mediated prepare/fan-in, ordered fan-in, and section error aggregation are present. |
| FR5 | partial | Artifact canonical section output exists, but resumed runs can still omit artifact sections when current input section inventory changes. |
| FR6 | partial / critical gap | Resume is not fully artifact-authoritative, and minimal-agency resume can falsely fail hash validation. |
| FR7 | implemented with documented release blockers | Install docs exist; public tagging is explicitly blocked until manual provider checks pass. |
| FR8 | implemented | Validation, CI, smoke testing, and version-aware release checks pass. |
| FR9 | implemented | Peer parsing and Paseo provider inventory preflight are implemented without OS executable probing. |
| FR10 | implemented | Install assist is opt-in, prompts before hardcoded npm install, verifies `paseo --version`, and does not retry. |
| NFR1 | implemented with FR6 caveat | Artifact readability and audit trail are present; resume authority gaps are tracked under FR6. |
| NFR2 | documented / not gated | Wall-clock and cost are tracked as non-gating v0.1 criteria. |
| NFR3 | implemented with release blockers | Additive frontmatter and manifest separation are documented; provider tolerance remains a pre-tag check. |
| NFR4 | implemented | Plugin manifests do not reference `.oat/` or require OAT-installed skills. |
| NFR5 | implemented | README is honest about v0.1 scope, deferred features, Codex Git/local path, and skills.sh posture. |
| NFR6 | implemented with release blockers | Host-mediated dispatch and Codex fail-closed behavior are documented; manual runtime permission checks remain blocked before tag. |

### Prior Final Findings

| Prior finding | Status | Notes |
| --- | --- | --- |
| Resume can overwrite completed artifact state with current input file | partial / still Critical | Completed section text is preserved for matching sections, but current input still controls section inventory and can drop artifact sections. |
| Release validation rejects versions produced by the bump tool | closed | `validate.mjs` now accepts semver-consistent provider versions, and `bump-version --check-tag` enforces tag consistency. |
| Artifact frontmatter narrower than design-listed metadata | closed | Frontmatter now includes iteration, cold start, peers, turn/round totals, wall-clock/cost fields, input path, and run id. |
| Release readiness evidence stale test count | closed | `RELEASING.md` records 122 tests and keeps provider-runtime checks blocked before tag. |

### OAT Artifact Routing

- `implementation.md` has `oat_current_task_id: null` and `37/37` tasks completed.
- `plan.md` records p01-p05 as passed and the final code row as `fixes_completed`.
- `state.md` has `oat_current_task: null`, implementation still `in_progress`, and text saying final review fixes are complete while awaiting final re-review.
- `oat project status --project-path .oat/projects/shared/consensus-plugin --json` reports total 37, completed 37, currentTaskId null, p05 passed, and recommended next skill `oat-project-review-provide`.

### Extra Work (not in declared requirements)

None significant. OAT review artifacts and bookkeeping are in-scope lifecycle outputs.

## Verification Commands

Reviewer ran:

```bash
git diff --name-status ca7fa11ced8ee1176c4f230aa7d76789b3d625d7..HEAD
git diff --check ca7fa11ced8ee1176c4f230aa7d76789b3d625d7..HEAD
npm test
node scripts/validate.mjs
node scripts/smoke-test.mjs
node scripts/bump-version.mjs --check-tag v0.1.0
node --test tests/resume-parse.test.mjs tests/sequential-wrapper.test.mjs tests/release-versioning.test.mjs tests/validate-script.test.mjs
oat project status --project-path .oat/projects/shared/consensus-plugin --json
```

Results:

- `git diff --check ca7fa11..HEAD`: passed.
- `npm test`: passed, 122 tests.
- `node scripts/validate.mjs`: passed.
- `node scripts/smoke-test.mjs`: passed.
- `node scripts/bump-version.mjs --check-tag v0.1.0`: passed.
- Targeted p05 regression tests: passed, 17 tests.
- OAT status: 37/37 tasks complete, `currentTaskId: null`, p05 passed, final still awaiting re-review.

Targeted probes:

```bash
# Resume section-inventory probe: generated two sections, removed one from current input, then resumed.
node --input-type=module <section-inventory-resume-probe>

# Minimal-agency hash probe: generated a minimal-agency artifact with trailing spaces, then parsed it for resume.
node --input-type=module <minimal-agency-resume-hash-probe>
```

Results:

- Section-inventory probe failed the artifact-as-state expectation: the resumed artifact omitted the original `Details` section and reported `status: "converged"`.
- Minimal-agency hash probe failed resume parsing with `RESUME_HASH_MISMATCH` on an otherwise intact artifact.

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert these findings into plan tasks.
