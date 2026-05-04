---
oat_generated: true
oat_review_type: code
oat_review_scope: final
oat_review_invocation: auto
oat_review_generated_at: 2026-05-04T11:22:31-0500
oat_project: .oat/projects/shared/consensus-plugin
verdict: fail
critical_count: 1
important_count: 1
medium_count: 0
minor_count: 2
---

# Code Review: final

**Reviewed:** 2026-05-04
**Scope:** Final lifecycle review of the full implementation diff `ca7fa11ced8ee1176c4f230aa7d76789b3d625d7..HEAD`
**Files reviewed:** 82
**Commits:** 63 (`ca7fa11..f77cc50`)

## Summary

The implementation covers the main v0.1 surfaces: plugin packaging, structural validation, sequential and host-mediated parallel consensus flows, resume/corruption handling, install assist, documentation, and mocked smoke coverage. Local verification passes, and the release-readiness docs correctly block public v0.1 tagging until manual provider-runtime install/permission checks are complete.

I found one Critical resume-state bug and one Important release-tooling hazard. The resume bug violates the FR6 artifact-as-state contract by allowing already-converged sections to be replaced by the current input file during resume; the release hazard causes the release workflow to reject patch/future manifest versions after the provided bump tool updates them.

Artifacts available and used: `discovery.md`, `spec.md`, `design.md`, `plan.md`, `implementation.md`, `state.md`, and phase reviews `p01-review-2026-05-04-v2.md`, `p02-fix-tasks-review-2026-05-04.md`, `p03-review-2026-05-04-v3.md`, `p04-review-2026-05-04-v2.md`.

## Findings

### Critical

- **Resume can overwrite completed artifact state with the current input file** (`plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:1589`)
  - Issue: Resume reconstruction only recovers section text from the last `proposed_artifact` in turn records (`normalizeResumeSection` sets `resumedArtifact` from `lastProposedArtifact` at line 295). For a section that converged via ACCEPT/ACCEPT without a REVISE, `resumedArtifact` is `null`; `runSequential` then falls back to `section.markdown` from the current input file at line 1589 and writes that as the completed section output at lines 1624-1635. This violates FR6's artifact-as-state requirement and can silently change already-converged sections if the input file has changed since the original run.
  - Evidence: I reproduced this in a temp directory: first run produced a stable completed section with `Old stable text.` and an impasse section; after editing the input file to `CHANGED INPUT SHOULD NOT BE RESUME STATE.` and resuming from the artifact, the new artifact contained the changed input and no longer contained the original completed section text.
  - Fix: Persist each section's final output in the canonical resume state, or add a canonical per-section output block, and parse that as the resume source for every section. Validate the parsed text hash against `final_artifact_hash`; do not fall back to current input for resume sections except an explicit "restart/skip corrupt section" path. Add a regression where an ACCEPT-only completed section is preserved after the source input changes.
  - Requirement: FR6 (P0), FR5 (resume-readable canonical artifact state)

### Important

- **Release validation rejects versions produced by the bump tool** (`scripts/validate.mjs:253`)
  - Issue: `scripts/bump-version.mjs` can update provider and marketplace manifests to a patch or future version, but `scripts/validate.mjs` hardcodes provider manifest validation to `0.1.0` at lines 253-255. The release workflow runs `npm run validate` before `node scripts/bump-version.mjs --check-tag "$GITHUB_REF_NAME"` (`.github/workflows/release.yml:19-21`), so a legitimate `v0.1.1` patch tag or future release fails validation before tag-version consistency is checked.
  - Evidence: In an archived temp copy, `node scripts/bump-version.mjs 0.1.1` updated 6 files, then `node scripts/validate.mjs` failed with provider manifest errors: each provider version "should be 0.1.0".
  - Fix: Remove hardcoded release versions from `validate.mjs`. Validate that provider manifest versions are valid semver and mutually consistent, and let `bump-version --check-tag` enforce the tag-specific expected version. Either update skill `metadata.version` in `bump-version.mjs` or define it as an independent skill-body version and stop validating it against a fixed plugin release. Add a regression that bumps a temp repo to `0.1.1`, runs validation successfully, and then checks `v0.1.1`.
  - Requirement: FR8 / p04-t06 release workflow support

### Medium

None

### Minor

- **Artifact frontmatter remains narrower than the design-listed metadata** (`plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs:847`)
  - Issue: `renderArtifactFrontmatter` emits a useful subset, but omits design 4.5 frontmatter fields such as `iteration`, `cold_start`, `peers`, turn/round totals, wall-clock/cost fields, input path, and run id. Most of this appears in the commented `consensus-resolution` block, so this is not blocking by itself.
  - Suggestion: Either expand the frontmatter to match design 4.5 or revise the design to make the commented canonical resolution block the authoritative machine-readable state.

- **Release readiness evidence has a stale test count** (`RELEASING.md:25`)
  - Issue: The readiness table records `117 tests passed locally`, but the current `npm test` run reports 118 passing tests.
  - Suggestion: Update the readiness snapshot after fixing the blocking findings so the release evidence matches the final verification run.

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md`, `spec.md`, `design.md`, `plan.md`, `implementation.md`, `state.md`, the full code diff `ca7fa11..HEAD`, and phase review artifacts for p01-p04.

### Requirements Coverage

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| FR1 | implemented | Repo scaffold, plugin package, provider manifests, marketplace manifests, skill frontmatter, and structural validation are present. |
| FR2 | implemented | Alternating loop and wrapper are implemented with mocked end-to-end coverage. |
| FR3 | implemented | Hash convergence, double ACCEPT, max-rounds, explicit impasse, and oscillation detection are covered. |
| FR4 | implemented | Heading/marker section parsing, sequential default, prepare/fan-in parallel path, ordered fan-in, and partial section failure handling are implemented. |
| FR5 | partial | User-facing artifact shape is implemented, but canonical resume state does not preserve final section text for ACCEPT-only completed sections. |
| FR6 | partial / critical gap | Impasse and user intervention flows exist, but resume does not treat the artifact as authoritative for completed sections. |
| FR7 | implemented with documented release blockers | Install commands and provider docs are present; `RELEASING.md` explicitly blocks public tagging until manual provider-runtime checks pass. |
| FR8 | partial / important gap | CI validation exists and passes for 0.1.0, but release validation fails after supported version bumps. |
| FR9 | implemented | Peer parsing and Paseo provider inventory preflight are implemented without OS executable probing. |
| FR10 | implemented | Install assist is opt-in, prompts before hardcoded npm install, verifies `paseo --version`, and does not retry. |
| NFR1 | implemented | Artifact readability structure is present; resume canonical-state gap is tracked under FR5/FR6. |
| NFR2 | documented / not gated | Cost and wall-clock are tracked as non-gating v0.1 release criteria. |
| NFR3 | implemented with release blockers | Additive frontmatter and provider manifest separation are documented; provider runtime tolerance remains a pre-tag manual check. |
| NFR4 | implemented | Plugin manifests do not reference `.oat/` or OAT-installed skills. |
| NFR5 | implemented | README is honest about v0.1 scope, deferred features, Codex Git/local path, and skills.sh listing posture. |
| NFR6 | implemented with release blockers | SKILL.md documents host-mediated dispatch and Codex fail-closed authorization; manual runtime permission checks remain blocked before tag. |

### Extra Work (not in declared requirements)

None significant. Review artifacts and OAT bookkeeping are in-scope lifecycle outputs.

## Deferred Findings Ledger

- p02 Minor: Artifact frontmatter omitted some design-listed metadata. Still present as Minor above; acceptable only if the design is updated or the frontmatter is expanded before relying on it as the primary machine contract.
- p04 release-readiness blockers: Manual provider-runtime install/permission checks remain intentionally blocked before public v0.1 tagging. This is acceptable because `README.md`, `CHANGELOG.md`, and `RELEASING.md` avoid unsupported public-release claims.

## Verification Commands

Reviewer ran:

```bash
git diff --check ca7fa11ced8ee1176c4f230aa7d76789b3d625d7..HEAD
npm test
npm run validate
npm run smoke
```

Results:

- `git diff --check ca7fa11..HEAD`: passed.
- `npm test`: passed, 118 tests.
- `npm run validate`: passed.
- `npm run smoke`: passed.

Targeted probes:

```bash
# Resume artifact-state probe: reproduced completed-section drift after changing input before resume.
node --input-type=module <temp reproduction script>

# Release version probe: reproduced validation failure after bumping temp repo manifests to 0.1.1.
git archive HEAD | tar -x -C "$tmp"
(cd "$tmp" && node scripts/bump-version.mjs 0.1.1)
(cd "$tmp" && node scripts/validate.mjs)
```

Results:

- Resume probe failed the artifact-as-state expectation: `leakedChangedInput: true`, `preservedOld: false`.
- Release version probe failed validation after bump: provider manifests were rejected for not being `0.1.0`.

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert these findings into plan tasks.
