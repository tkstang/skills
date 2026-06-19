---
oat_generated: true
oat_generated_at: 2026-06-18
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/v01-release-verification
---

# Code Review: final

**Reviewed:** 2026-06-18
**Scope:** final (d1bb916eef45a270d15c9f22ad1fbb5374f9e362..HEAD) — v0.1 release verification + packaging
**Files reviewed:** 19 (4 code-bearing: `scripts/bump-version.mjs`, `.github/workflows/release.yml`, `tests/release-versioning.test.ts`, `tests/readme-scope.test.ts`; remainder docs/release-notes/OAT artifacts)
**Commits:** 8 (d1bb916..HEAD), 5 in-scope content commits

## Summary

This is a release-verification + packaging project (quick mode); the deliverable is evidence-backed release gates and accurate documentation, not runtime feature code. The diff stayed cleanly within scope: no new consensus skills, no test-organization cleanup, and no hand-edited generated `// GENERATED` runtime files (only the hand-authored tooling script `scripts/bump-version.mjs` changed among `.mjs` files). All claimed automated gates reproduce green independently, public-discovery claims remain correctly gated as unverified, and stale v0.2 / 2026-05-04 / npm-era claims were genuinely removed. No release-blocking findings.

## Findings

### Critical

None

### Important

None

### Minor

- **`validate.mjs` does not enforce cross-file version equality — `--check-tag` is the sole equality guard** (`scripts/validate.mjs:190`, `.github/workflows/release.yml:39`)
  - Issue: `validateSkillFrontmatter` only checks that `metadata.version` is valid semver, not that all provider manifests, marketplace entries, and both skill files share the same version. The only equality gate is `node scripts/bump-version.mjs --check-tag "$GITHUB_REF_NAME"`, which runs last in the release workflow. This is defensible (tag-time is the right place to assert tag/manifest equality), so no change is required — but it is worth noting that a manual single-file version edit on a non-tag branch would pass `pnpm run validate` and only be caught at tag push. Day-to-day this is the intended posture; recording it so it is not mistaken for a gap.
  - Suggestion: Optional hardening only — if pre-tag drift detection is ever desired, add a `bumpVersion`-equality assertion to `validate.mjs`. Not needed for v0.1.

- **Example output filename retains hyphenated mode spelling** (`plugins/consensus/skills/refine/references/operator-qa.md:115`)
  - Issue: `--output tmp/arch-parallel-revision.consensus.md` still uses the hyphenated `parallel-revision` form. This is a sample output path, not a mode-name claim or `--iteration` value, so it is not an accuracy defect. All actual mode-name references (prose, `--iteration` values, cost-disclosure tables, CHANGELOG, README) were correctly converted to the underscore form `parallel_revision` / `parallel_synthesized`.
  - Suggestion: Optionally rename the example file to `arch_parallel_revision...` for cosmetic consistency. Non-blocking.

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md`, `plan.md`, `implementation.md`, `summary.md` (quick mode — no `spec.md`/`design.md`, which is expected and not a gap). Design alignment is not applicable (no design artifact for this mode).

### Requirements Coverage (discovery.md Success Criteria)

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| Automated verification passes/failures recorded with command evidence (`build`, `type-check`, `build:check`, `test`, `validate`, `smoke`) | implemented | Independently reproduced: `validate` -> `validation passed`; `build:check` -> all outputs `in sync`; targeted vitest 10/10. `implementation.md` records full suite green (572 tests). |
| `RELEASING.md` current and evidence-backed (reused vs. rerun separated) | implemented | Checklist/readiness snapshot refreshed to 2026-06-19; PR #9 evidence marked `reused`; per-provider status table accurate to recorded findings. |
| README install matrix + provider QA accurate for both shipped skills | implemented | README/plugin README note local marketplace name-collision behavior; `evaluate` and `refine` operator-qa both refreshed with v0.1 preflight posture. |
| CHANGELOG/version/tag readiness accurate, incl. `bump-version.mjs` checks | implemented | `--check-tag v0.1.0` reproduced -> `tag v0.1.0 matches manifest version 0.1.0`. `bump-version.mjs` and tests now cover both skill files. CHANGELOG v0.1 notes corrected (modes de-versioned from v0.2, evidence dated 2026-06-19). |
| Release-blocking issues explicit as backlog/project tracking or checklist blocker | implemented | Blockers explicit in `RELEASING.md`, `current-state.md`, `roadmap.md`, backlog item, and `summary.md`: interactive permission prompts, Cursor keychain/provider error, post-tag skills.sh indexing. |
| PR body summarizes verified/reused/remaining work | implemented | `summary.md` cleanly separates Verified Now / Reused / Remaining Before Tag / Remaining After Tag. |
| Public marketplace / Plugin Directory / skills.sh discovery kept gated until live verification | implemented | All four surfaces explicitly hedged ("not yet release claims", "do not claim skills.sh availability until indexing is verified after publication"); Agent Skills source listing labeled as not a substitute for post-tag indexing. |

### Code Correctness (4 code-bearing files)

| File | Assessment |
| ---- | ---------- |
| `scripts/bump-version.mjs` | Correct. `consensus-evaluate/SKILL.md` added to `SKILL_FILES`; both bump (`replaceSkillMetadataVersion`) and check (`skillMetadataVersion`) iterate the same list, so update and verify stay symmetric. Skill-version regex tolerates single- or double-quoted values; verified against the live single-quoted `'0.1.0'` skill metadata — `--check-tag` passes. No off-by-one or missing-path. `--check-tag` enumerates marketplace `plugins[index]` with `Object.hasOwn` guard so absent version fields are correctly skipped. |
| `.github/workflows/release.yml` | Correct ordering and gating. `pnpm/action-setup@v4` precedes `setup-node@v4` (`cache: pnpm`) — required order. Gates run install -> capture generated paths -> build -> verify generated outputs committed (`git diff --exit-code`) -> type-check -> build:check -> test -> validate -> smoke -> `--check-tag $GITHUB_REF_NAME`. Each step fails the job on non-zero exit; no step would pass silently. The generated-output committed-check reads paths from `build-generated.mjs --list-outputs` into a bash array and diffs exactly those, so a drifted-but-uncommitted runtime fails the tag. Replaces the prior weak `npm test` + `npm run validate` pair. |
| `tests/release-versioning.test.ts` | Strong, non-tautological. `bumpVersion` test asserts both skill files reach `0.2.0-beta.1` in a temp root (behavioral, not pinned to live version); malformed-semver test asserts no file is mutated before rejection; bumped-patch test runs full `validateRepository` + `checkTagVersion`. `skillFiles` array correctly extended to both skills. |
| `tests/readme-scope.test.ts` | Correct. Hyphen->underscore mode-name assertions now pin the actual shipped CLI spelling (`parallel_revision`/`parallel_synthesized`); CHANGELOG test re-scoped from v0.2 to v0.1 wording while still asserting escalation, v1 schema, and `--iteration`. Assertions remain meaningful regex pins, not presence-of-anything. |

### Extra Work (not in declared requirements)

None. Every changed file maps to a plan task (p01-t01 through p03-t02). The two code edits beyond pure docs (release.yml parity, bump-version dual-skill coverage) are explicitly authorized by discovery Key Decision 4 ("If a release blocker requires code, record it explicitly") and recorded in `implementation.md` p02-t02.

### Artifact Alignment (quick mode)

`implementation.md` frontmatter is `oat_status: in_progress` / `oat_current_task_id: null` while the body and `plan.md`/`summary.md` report all 6 tasks complete. This is stale frontmatter, not a code or evidence defect; the deliverables themselves are complete and the Progress table reads 6/6. Recommend flipping `implementation.md` frontmatter to `oat_status: complete` at closeout. No code change implied.

## Verification Commands

Run these to reproduce the recorded gates (all reproduced green during this review except the full suite, which is recorded green in `implementation.md`):

```bash
node scripts/bump-version.mjs --check-tag v0.1.0
git diff --check d1bb916eef45a270d15c9f22ad1fbb5374f9e362..HEAD
pnpm exec vitest run tests/release-versioning.test.ts tests/readme-scope.test.ts
pnpm run validate
pnpm run build:check
pnpm run test
pnpm run smoke
```

## Tag-Readiness Verdict

**Safe to tag v0.1.0 from this checkout once the recorded pre-tag provider gates are cleared.** The code/docs/workflow changes are correct and the automated tag-consistency guard passes. The release is NOT yet unconditionally taggable because three pre-tag blockers remain, and the project correctly documents them rather than overclaiming:

1. Interactive provider permission-prompt smokes (Claude Code, Codex) — recorded as `partial`/before-tag, not done.
2. Cursor locked-keychain / Paseo provider `error` — must be resolved or explicitly release-noted as an unsupported path before tag.
3. Post-tag skills.sh / public-directory discovery — correctly deferred to after tag and gated against public claims.

Given the scope is verification + packaging (not "push the tag"), this work fully satisfies its mandate: gates are reproduced, blockers are explicit, and no premature public claims were made. Tagging itself is the human's call once 1-2 are green.

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
