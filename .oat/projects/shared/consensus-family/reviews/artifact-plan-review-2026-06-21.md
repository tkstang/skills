---
oat_generated: true
oat_generated_at: 2026-06-21
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-family
---

# Artifact Review: plan

**Reviewed:** 2026-06-21
**Scope:** Drafted implementation plan for the `consensus-family` spec-driven project
**Files reviewed:** 3 artifacts (plan/spec/design) + ~12 source/test/tooling files verified against disk
**Commits:** N/A (artifact review)

## Summary

The plan is strong, implementation-ready, and faithfully derived from spec.md and
design.md. Phasing matches the required sequence (P0 gate FR1-3 → P0 create FR4 →
P1 decide → P1 plan FR5-6 as separate PRs), every spec-referenced task ID exists,
build/version discipline is correct (canonical TS → `pnpm build` → never hand-edit
generated `.mjs`, version+metadata bumps, SKILL_FILES registration), and the test
strategy (loop-level cold-start tests, per-wrapper integration, structural-contract
e2e) is well-mapped. No Critical findings. The most material gap is that two
test-enforced documentation surfaces — `CHANGELOG.md` (an enforced invariant) and
the provider plugin-manifest descriptions (spec FR4 explicitly requires "manifest +
README entries") — are never touched by any task. Remaining findings are minor
coverage/wording items.

## Findings

### Critical

None.

### Important

- **`CHANGELOG.md` is an enforced invariant but no task updates it** (`plan.md` — Phases 2-4 docs tasks: `plan.md:520-558`, `plan.md:749-787`, `plan.md:978-1017`)
  - Issue: `tests/repo/readme-scope.test.ts:77-98` asserts CHANGELOG content (iteration-mode work, release-scope rules), and `tests/repo/docs-presence.test.ts` lists `CHANGELOG.md` as a required doc. Shipping three new skills is exactly the change that belongs under an `## [Unreleased]` / `### Added` CHANGELOG entry per the repo release convention ("Keep plugin-facing documentation accurate to source code and manifests"). The current CHANGELOG only documents up to v0.1.0 (`CHANGELOG.md:1-37`) with `consensus-create/decide/plan` framed as future work in README. No plan task lists `CHANGELOG.md` in its Files or adds a CHANGELOG assertion in the RED step. The existing readme-scope CHANGELOG tests will still pass (they only check the already-present v0.1 text), so this gap will not be caught by a failing test — it is silent documentation drift.
  - Fix: Add `CHANGELOG.md` to the Files list of the documentation tasks (at minimum `p02-t05` to introduce a `## [Unreleased]` block when create ships, then extend it in `p03-t05` and `p04-t05`), and add a RED-step assertion that the CHANGELOG records the create/decide/plan family. Alternatively, if CHANGELOG curation is deliberately deferred to release/`oat-project-complete`, state that explicitly in the plan so it is not silently dropped.
  - Requirement: FR4 ("manifest + README entries"), NFR5 (gates), repo release convention.

- **Provider plugin manifests are never updated, but spec FR4 requires "manifest ... entries" and the manifest description is stale** (`plan.md` — `p02-t04:468-516`, `p03-t04:697-745`, `p04-t04:926-974`)
  - Issue: spec.md FR4 acceptance criteria (`spec.md:90`) require each new skill to ship "manifest + README entries," and the repo convention requires keeping "plugin-facing documentation accurate to source code and manifests." The three provider manifests (`plugins/consensus/.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`) carry `"description": "Consensus refine and evaluate skills for multi-peer deliberation."` — which becomes inaccurate once create/decide/plan ship. The plan's skill-anatomy tasks never list any `plugin.json` in their Files. I verified that skill *discovery* is directory-based (`./skills/`) and `tests/repo/plugin-manifests.test.ts` does NOT assert the description content, so this will not fail a gate — but it is exactly the stale-doc drift the repo convention forbids, and FR4 names the manifest explicitly. Note `docs-presence.test.ts` already asserts each manifest contains `refine` and `evaluate` (string match), so a JSON `description` that names the full family would also satisfy that.
  - Fix: Add the three `plugin.json` files to `p02-t04`'s Files (update the `description` to cover the create family; decide whether to broaden it once or per phase). Confirm whether `version` (currently pinned to `0.1.0` and test-asserted at `plugin-manifests.test.ts:31`) should bump — if so, that is a release-checklist decision worth an explicit note; if not, leave it. Do not change the test's `0.1.0` pin without a deliberate release decision.

### Medium

- **New-skill SKILL.md required-section structure is under-specified relative to enforced doc tests** (`plan.md` — `p02-t04:468-516`, `p03-t04`, `p04-t04`)
  - Issue: `tests/repo/docs-presence.test.ts` is prescriptive about SKILL.md structure for shipped skills — it requires `## When NOT to Use`, `## Examples`, `## Success Criteria`, an invocation section (e.g. `## Evaluation Invocation`), `## Output Contract`, and a matching `name:` frontmatter, plus `operator-qa.md` content assertions (`consensus-evaluate.mjs`, `--rubric`, `Unresolved dissent`). `tests/repo/skill-frontmatter.test.ts:35` hardcodes `expect(['refine','evaluate']).toContain(name)` and the parametrized list at `skill-frontmatter.test.ts:13` is `[refine, evaluate]`. The plan's anatomy tasks correctly modify `skill-frontmatter.test.ts` and `docs-presence.test.ts`, but describe the SKILL.md only as "portable/versioned frontmatter" — they do not enumerate the required sections or the need to extend the `['refine','evaluate']` allowlist and the parametrized `skillPaths` array. An implementer following the task literally could ship a SKILL.md that misses a required section and only discover it when extending the test.
  - Fix: In each `pNN-t04` task, name the required SKILL.md sections to author (When NOT to Use / Examples / Success Criteria / Output Contract / a per-skill invocation heading) and call out that `skill-frontmatter.test.ts` must add the new name to both the `['refine','evaluate']` allowlist and the `skillPaths` parametrization. This is guidance precision, not a structural defect.

- **Spec Requirement Index omits `p01-t02`; the plan task itself is correct (artifact drift in spec, not a plan defect)** (`spec.md:193-194`, `plan.md:88-131`)
  - Issue: The spec's backfilled "Planned Tasks" column references 20 task IDs; all exist in the plan. The reverse check found one plan task absent from the spec index: `p01-t02` (Thread Cold Start Into Prompt Builders). Per design.md Component A (`design.md:72` "thread the cold-start into the round-1 prompt builders ... This is the main new wiring") this task is load-bearing for FR1/FR2 — I verified against `src/consensus/core/consensus-loop.ts` that `TurnPromptInput` (`:273`) and `ParallelTurnPromptInput` (`:249`) currently lack a `coldStart` field, so this wiring step is genuinely required. The gap is in the spec's index column, not the plan.
  - Fix: This is artifact drift in spec.md, not a plan change. When convenient, add `p01-t02` to the FR1 (and FR2) rows of the spec Requirement Index so the mapping is complete. No plan edit required.

### Minor

- **Discovery's closeout/DR-promotion success criterion has no covering task** (`discovery.md:92`, `plan.md:978-1017`)
  - Issue: discovery Success Criteria require promoting durable decisions to `decision-record.md` (cold-start strategy, whole-artifact sectioning, alternating degenerate semantics, decide/plan markdown contract) and updating the four backlog items + `completed.md`/`current-state.md`/`roadmap.md` at completion. No plan task covers this. This is normally handled by `oat-project-complete` rather than implementation, so omission is defensible — but it is a named success criterion.
  - Suggestion: Either add a brief closeout note to the plan stating DR promotion + backlog/roadmap updates are deferred to `oat-project-complete`, or add a final bookkeeping task. Low risk either way.

- **`p01-t06` only lists `bump-version.mjs` indirectly via version bumps; SKILL_FILES is already correct for refine/evaluate** (`plan.md:276-315`)
  - Issue: `p01-t06` bumps `refine`/`evaluate` versions but does not list `scripts/bump-version.mjs` in its Files (the new-skill tasks do, at `:480`, `:709`, `:938`). I verified `SKILL_FILES` already contains refine and evaluate (`scripts/bump-version.mjs:18-20`), so no edit is needed there for Phase 1 — the omission is correct. Flagging only to confirm it was a deliberate, accurate scoping rather than an oversight.
  - Suggestion: No change required; this is a confirmation, not a defect.

- **Design phasing groups decide+plan into one phase; the plan splits them into Phase 3 and Phase 4 (defensible, but note the divergence)** (`design.md:262-268`, `plan.md:562-1017`)
  - Issue: design.md "Implementation Phases" lists three phases (Phase 3 = decide + plan, "parallelizable, separate PRs"). The plan uses four phases (Phase 3 = decide, Phase 4 = plan). This better encodes the "separate PRs" intent and per-skill gate sets, and matches spec sequencing (FR5 then FR6). The divergence is an improvement, not a defect.
  - Suggestion: Optionally note in design.md that the plan realizes design Phase 3 as two plan phases. No plan change needed.

## Spec/Design Alignment

**Evidence sources used:** spec.md, design.md, discovery.md (upstream); plan.md (under review); verified against `src/consensus/core/consensus-loop.ts`, `src/consensus/refine/consensus-refine.ts`, `src/consensus/evaluate/consensus-evaluate.ts`, `scripts/build-generated.mjs`, `scripts/bump-version.mjs`, schema files, and `tests/repo/*`, `tests/release/*`, `tests/tooling/*`.

Design-decision conformance (all confirmed present in the plan):
- Round-1-only loop-core cold-start: `p01-t01`/`p01-t03` (type+parser widening, round-1 framing only). Confirmed code currently closes `ColdStartMode` to `shared_input` and hard-rejects `independent_draft` (`consensus-loop.ts:22,1669`).
- Brief reuses the artifact channel: `p01-t03` Step 2 ("Use the existing artifact channel; change only the round-1 wording").
- refine/evaluate stay `shared_input`-only; loop core + new wrappers accept both: `p01-t05` (guards) + `p02-t01`/`p03-t01`/`p04-t01` (new wrappers accept both). Confirmed existing guards use "not yet supported" messaging (`consensus-refine.ts:2409`, `consensus-evaluate.ts:338`) which `p01-t05` correctly rewords to a semantic restriction, and that existing tests assert `/not yet supported/` (`refine/wrapper-options.test.ts:85`, `evaluate/wrapper.test.ts:94`) — `p01-t05` updates those.
- decide surfaces unresolved_disagreements at minimal agency: `p03-t02`/`p03-t03`.
- Markdown-by-prompt for decide/plan (no machine schema): `p03-t02` Step 2 / `p04-t02` Step 2 ("no new machine schema", "markdown-by-prompt framing only").
- Family enforces verdict enum / reuses DR-024 seam + verdict-parallel/synthesis schemas (not reopened): `p02-t04`/`p03-t04`/`p04-t04` copy schemas; schemas confirmed byte-identical across refine/evaluate.
- Build/version discipline: canonical TS, `pnpm build`, never hand-edit generated `.mjs`, version+metadata bump, SKILL_FILES registration, full gate set — all present and accurate.

### Requirements Coverage

| Requirement | Status      | Notes                                                                                                          |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| FR1         | implemented | p01-t01/t02/t03/t04/t05; t02 (prompt-builder threading) is the load-bearing wiring spec index omits           |
| FR2         | implemented | p01-t03/t04 cover all 3 modes incl. alternating degenerate path                                                |
| FR3         | implemented | p01-t01/t04/t05 + per-wrapper t01s; cold_start recording + --cold-start config                                 |
| FR4         | partial     | create wrapper/anatomy/docs/smoke covered (p02-t01..t05); manifest entry + CHANGELOG not covered (see Important)|
| FR5         | implemented | p03-t01..t05; minimal-agency dissent surfacing explicit                                                        |
| FR6         | implemented | p04-t01..t05; moderate agency, required headings                                                               |
| NFR1        | implemented | stdlib-only reaffirmed in p02-t01 Step 3 / p02-t02; validate gate                                              |
| NFR2        | implemented | p01-t06/p02-t04/p03-t04/p04-t04/p04-t05; build:check + skill-version validators                                |
| NFR3        | implemented | DR-024 seam reuse, schema copy, enum enforcement in integration tasks                                          |
| NFR4        | implemented | untrusted-data framing + 1 MiB cap + path confinement in p01-t03/p02-t02/p03-t02/p04-t02                       |
| NFR5        | implemented | full gate set run in p02-t05/p03-t05/p04-t05 (build:check, type-check, test, validate, validate:skill-versions, smoke) |

FR4 is marked partial only for the manifest-description + CHANGELOG documentation gaps (Important findings); the core create skill, anatomy, tests, docs (README), and smoke coverage are fully planned.

### Extra Work (not in declared requirements)

None. Every task maps to a requirement or to required build/version/test/doc plumbing. No deferred/out-of-scope work is smuggled in: I verified the plan explicitly excludes outline-first sectioning (`p04-t03` Step 3 "do not add outline-first or sectioning machinery"), machine schemas (`p03-t02`/`p04-t02` "no new machine schema"), and hard `require_submission` (absent), and keeps `consensus-research` out of scope (`p04-t05` Step 3).

## Verification Commands

These reproduce the checks behind the findings (no implementation exists yet, so these confirm the current invariants the plan must satisfy):

```bash
# Confirm CHANGELOG + plugin manifests are test-touched / required
grep -n "CHANGELOG" tests/repo/docs-presence.test.ts tests/repo/readme-scope.test.ts
grep -rn "description" plugins/consensus/.claude-plugin/plugin.json plugins/consensus/.codex-plugin/plugin.json plugins/consensus/.cursor-plugin/plugin.json

# Confirm skill-frontmatter allowlist + version pin the new tasks must extend
grep -n "refine.*evaluate\|0\.1\.0\|skillPaths" tests/repo/skill-frontmatter.test.ts

# Confirm task-ID coverage between plan and spec
grep -oE "p0[1-4]-t0[0-9]" .oat/projects/shared/consensus-family/plan.md | sort -u
grep -oE "p0[1-4]-t0[0-9]" .oat/projects/shared/consensus-family/spec.md | sort -u

# Confirm current loop-core state matches plan assumptions
grep -n "ColdStartMode\|coldStart\|not yet supported" src/consensus/core/consensus-loop.ts

# Once implemented, the plan's own gate set:
pnpm run build:check && pnpm run type-check && pnpm run test && pnpm run validate && pnpm run validate:skill-versions -- --base-ref main && pnpm run smoke
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert these findings into plan tasks
(primarily: add `CHANGELOG.md` and the three `plugin.json` manifests to the
documentation tasks, and tighten the SKILL.md section guidance in the skill-anatomy
tasks). The Medium spec-index drift (`p01-t02`) and the closeout/DR-promotion note
are low-risk and can be folded in opportunistically.
