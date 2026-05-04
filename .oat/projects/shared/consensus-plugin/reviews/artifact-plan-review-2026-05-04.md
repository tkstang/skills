---
oat_generated: true
oat_generated_at: 2026-05-04
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-plugin
---

# Artifact Review: plan

**Reviewed:** 2026-05-04
**Scope:** plan.md (full)
**Files reviewed:** 3 (plan.md primary; spec.md + design.md as alignment baselines)
**Commits:** N/A (artifact review)

## Summary

The plan is in solid shape: every FR/NFR in the spec's Requirement Index resolves to declared tasks; phase shape mirrors design's four implementation phases; v0.1 non-goals are honored (no skills 2–6, no parallel-revision/synthesized modes, no harmonization, no Codex public submission, no cursor-as-peer); paths consistently target `plugins/consensus/skills/consensus-refine/...` (no drift back to repo-root `skills/`); the 3-layer skill (`SKILL.md` + `consensus-refine.mjs` wrapper + `consensus-loop.mjs` loop) is correctly decomposed; `--agency` is exposed; tasks are stable-IDed `pNN-tNN`, each with file targets, RED/GREEN/REFACTOR/VERIFY/COMMIT structure, verification commands, and `{type}(pNN-tNN): ...` commit examples; the 30-task rollup matches phase math.

The gaps are around carried-forward Open Questions and a couple of design-stated risk mitigations that didn't get task hooks: paseo CLI version-range pinning + preflight version check (R8 mitigation), explicit skill-path-syntax verification for `.codex-plugin/plugin.json` (Open Question a), Cursor-via-custom-ACP README docs (Open Question b), and per-provider paseo permission profile verification (Open Question d). One minor drift: plan p01-t06 hedges on `AGENTS.md ↔ CLAUDE.md` symlink that design pinned. None of these block plan-as-source-of-truth, but they should be closed before implementation starts so `oat-project-implement` doesn't have to invent verification scope on the fly.

## Findings

### Critical

None.

### Important

- **Paseo version-range pinning + preflight version check missing** (`plan.md:483-515` p02-t06; `plan.md:228-264` p01-t06; `plan.md:971-1005` p04-t05)
  - Issue: design.md R8 mitigation (`design.md:957-961`) explicitly requires (a) "version check at preflight with warning if outside tested range" and (b) "pin paseo to a tested version range in README install instructions." Plan p02-t06's `preflightPaseo(options)` is described in terms of `paseo provider ls --json` shape and remediation messages, but neither the test (Step 1) nor the implementation (Step 2) calls out a paseo `--version` check or a tested-range constant. README/install tasks (p01-t06, p04-t05) don't mention pinning the paseo version range.
  - Fix: in p02-t06, add a Step 1 assertion that `preflightPaseo` invokes `paseo --version` (or equivalent), parses it, and emits a structured warning when outside a `MIN_PASEO_VERSION..MAX_TESTED_PASEO_VERSION` constant range. In p01-t06 (or p04-t05), add an acceptance criterion that README's Paseo install section names the tested paseo version range. Source the range from design R8 + Open Question "Paseo CLI surface evolution."
  - Requirement: R8 mitigation; spec NFR6 (preflight); spec FR10 (install docs accuracy).

- **Open Question (a): skill-path-syntax verification for `.codex-plugin/plugin.json` not tasked** (`plan.md:121-155` p01-t03)
  - Issue: design.md Open Questions (`design.md:872-873`) carry forward "Skill path syntax inside `.codex-plugin/plugin.json` — relative-to-plugin-root vs. relative-to-`skills/` is undocumented. Resolve by testing both forms in implementation." Plan p01-t03 Step 3 unconditionally commits to plugin-root-relative ("Keep all skill paths plugin-root-relative. Do not use `../` traversal.") without a step that verifies the Codex runtime actually accepts this form. If Codex's plugin.json wants `./consensus-refine` (relative to `skills/`), the plan's commitment quietly bakes in a broken manifest.
  - Fix: in p01-t03, add a verification sub-step (or a follow-up Phase 4 polish task) that loads the Codex manifest through whatever Codex tooling is available (`codex plugin marketplace add` against a local clone, or its validator), or — failing that — add a CHANGELOG/RELEASING note that Codex install must be smoke-tested at p04-t08 before tagging v0.1. Either way, the plan needs to either resolve the open question or explicitly land it as a manual smoke step.
  - Requirement: design Open Question (a); FR1 acceptance criterion ("Plugin manifest skill paths inside `plugins/consensus/.{provider}-plugin/plugin.json` use plugin-root-relative `./skills/...` references" — currently unverified).

- **Open Question (d): per-provider paseo permission profile not explicitly verified** (`plan.md:121-155` p01-t03; `plan.md:483-515` p02-t06; `plan.md:727-760` p03-t03)
  - Issue: design Open Question (`design.md:875`) carries "Paseo invocation permission profile per provider — what permission scopes does each provider require to invoke `paseo` as a subprocess? Verify per-provider declarations at implementation." Plan p01-t03 writes the three plugin manifests but doesn't include a verification step that each provider's manifest grants the required Bash/exec scope for paseo. Plan p03-t03 documents host responsibilities but is parallel-mode-specific. spec NFR6 says "the skill documents required host-runtime permissions (Bash/exec to invoke `paseo`) per provider in its `SKILL.md` and the per-provider plugin manifests."
  - Fix: extend p01-t03 (or add a small p04 polish task) with an explicit assertion that each provider manifest declares the Bash/exec permission shape paseo needs, and that SKILL.md frontmatter `allowed-tools` (Claude additive) matches. Equivalently, add a row to p04-t08 release-readiness checklist for "permissions verified per provider."
  - Requirement: NFR6; design Open Question (d).

### Medium

- **Open Question (b): Cursor-via-custom-ACP not documented in README** (`plan.md:971-1005` p04-t05)
  - Issue: design Open Question (`design.md:873`): "Cursor-via-custom-ACP — how to document this as an opt-in path in README's 'Advanced Configuration' section." spec FR9 mentions "cursor-as-peer is opt-in only via custom ACP provider configured by the user and visible to paseo's provider inventory." Plan p04-t05 acceptance criteria (`plan.md:982-985`) mention install matrix, Permissions, Limitations, no telemetry, prompt-injection limitation, deferred features — but not an "Advanced Configuration" / cursor-via-custom-ACP section.
  - Fix: in p04-t05's RED test, add an assertion that README contains an "Advanced Configuration" section documenting custom ACP providers (specifically calling out cursor-as-peer as opt-in), or explicitly defer it as v0.2 in CHANGELOG and remove the FR9-implied promise from spec. Pick one — the spec currently advertises the path, so v0.1 should land at least a stub.
  - Requirement: spec FR9 acceptance criteria; design Open Question (b).

- **Subprocess output cap not pinned to design's 10 MB ceiling** (`plan.md:414-447` p02-t04)
  - Issue: design §Performance Considerations (`design.md:657`) and §Security (`design.md:598`) both pin paseo subprocess stdout/stderr cap at 10 MB. Plan p02-t04 RED test says "enforces stdout/stderr caps" without naming the cap value, and the GREEN step says nothing about a constant. This is the kind of magic number that drifts in implementation.
  - Fix: in p02-t04 Step 1, name the constant (`SUBPROCESS_OUTPUT_CAP_BYTES = 10 * 1024 * 1024`) and have the test assert behavior at the boundary (e.g., 10 MB + 1 byte triggers kill-and-reject). Reference design §Performance.
  - Requirement: design §Performance / §Security.

- **Cost reporting fields (`approximate_cost_usd`, `cost_source`) lack explicit task coverage** (`plan.md:380-412` p02-t03; `plan.md:346-378` p02-t02)
  - Issue: design §4.3 loop-status schema requires `approximate_cost_usd: number|null` + `cost_source: enum["paseo","estimated","unavailable"]`, and design §Performance §Cost reporting describes the 3-tier derivation. Plan p02-t02 (verdict schema) and p02-t03 (records/status) don't call out cost-field assertions. spec FR5 acceptance criteria include "approximate cost" in the Resolution block.
  - Fix: in p02-t03 RED test, add an assertion that `writeLoopStatus` produces the three cost-source branches correctly when paseo's `--json` output (a) includes usage, (b) includes only token counts, (c) is missing both. In p02-t09 (sequential orchestration) RED, add an assertion that the Resolution block contains the cost line.
  - Requirement: spec FR5; design §4.3.

- **`AGENTS.md ↔ CLAUDE.md` symlink hedge contradicts pinned design** (`plan.md:228-264` p01-t06, Step 2 at lines 247-250)
  - Issue: design Component D (`design.md:244`) shows `AGENTS.md ↔ CLAUDE.md (symlink)` as the pinned shape. Plan p01-t06 Step 2 says "Create `CLAUDE.md` as a symlink or exact companion to `AGENTS.md` only if supported cleanly by the local repo; otherwise document why it is intentionally a normal file." The "exact companion" hedge invites two divergent files; the docs-presence test (Step 1) doesn't assert the symlink relationship.
  - Fix: drop the hedge and commit to the symlink; or, if cross-platform-checkout concerns are real, escalate that as a design amendment before implementation rather than letting the plan absorb it. If symlink stays, p01-t06 RED should assert `lstat(CLAUDE.md).isSymbolicLink()` and that `realpath(CLAUDE.md) === realpath(AGENTS.md)`.
  - Requirement: design Component D pinned shape.

### Minor

- **`oat_phase_status: complete` in frontmatter is set before any review** (`plan.md:8`)
  - Issue: frontmatter declares `oat_phase_status: complete` while the Reviews table shows the plan itself never having been reviewed (and `spec` row is `pending`). This is a self-asserted-complete signal that the plan-review flow is meant to validate.
  - Suggestion: leave as-is if this matches OAT convention for "draft complete, ready for review"; otherwise consider `oat_phase_status: in_review` until this artifact-plan-review lands.

- **Plan does not register itself in the Reviews table** (`plan.md:1119-1127`)
  - Issue: the Reviews table has rows for `spec` (pending) and `design` (`fixes_completed`) artifact reviews but no row for `plan`. After this review lands, `oat-project-review-receive` should add a `plan` row pointing to `reviews/artifact-plan-review-2026-05-04.md`.
  - Suggestion: add a placeholder `| plan | artifact | pending | - | - |` row now, or rely on review-receive to insert it. Non-blocking.

- **Phase 2 has 10 tasks; Phase 4 has 8** (`plan.md:1140-1149`)
  - Issue: not a defect — just observing that p02 is the heaviest phase by task count. If implementation HiLL boundaries default to per-phase, p02 may want a mid-phase HiLL split. Out of scope for this review (the plan correctly defers HiLL to `oat-project-implement`), but worth noting.
  - Suggestion: when running `oat-project-implement`, consider whether p02-t05 (CLI assembly) or p02-t06 (wrapper bootstrap) deserves a HiLL boundary inside the phase rather than only at p02→p03.

- **`raw_paseo_response` field in turn record schema not tested explicitly** (`plan.md:380-412` p02-t03)
  - Issue: design §4.2 turn-record schema includes optional `raw_paseo_response` — useful for debugging but not asserted anywhere in plan tasks. Low risk if treated as "additional optional fields tolerated."
  - Suggestion: add a one-line assertion in p02-t03 RED that `raw_paseo_response`, when present, is preserved verbatim (or that JSON-array write-through doesn't strip optional fields).

## Spec/Design Alignment

**Evidence sources used:** `plan.md` (under review), `spec.md` Requirement Index + Non-Goals + Constraints, `design.md` Implementation Phases + Component Design + Testing Strategy + Open Questions + Risks. Discovery and prior design review treated as historical context.

### Requirements Coverage

| Requirement | Status      | Notes |
| ----------- | ----------- | ----- |
| FR1 (repo scaffold + manifests + frontmatter) | implemented | p01-t02..t05, p01-t07 cover layout, manifests, marketplace, SKILL.md, validator. |
| FR2 (alternating-mode deliberation) | implemented | p02-t04 paseo invocation, p02-t05 alternating loop CLI, p02-t09 sequential orchestration. |
| FR3 (hash-based convergence) | implemented | p02-t01 normalization/hash/oscillation, p02-t02 verdict schema, p02-t05 CLI termination paths. |
| FR4 (sections + sequential default + parallel) | implemented | p02-t07 parser, p02-t09 sequential, p03-t01 prepare, p03-t02 fan-in, p03-t05 integration. |
| FR5 (deliberation artifact format) | partial | p02-t09 + p04-t01 cover most; cost-line in Resolution block not explicitly asserted (see Medium finding). |
| FR6 (impasse handling + user surfacing) | implemented | p02-t05 CLI impasse paths, p02-t10 error handling, p03-t04 parallel section errors, p04-t03 user intervention. |
| FR7 (cross-provider install paths) | partial | p01-t03/t04/t05/t06 + p04-t05/t07/t08 cover docs and smoke; per-provider paseo permission profile (Open Question d) not explicitly verified (see Important finding). |
| FR8 (CI validation pipeline) | implemented | p01-t01 (test harness), p01-t07 (validator + workflows), p04-t07 (smoke). |
| FR9 (configurable peers) | partial | p02-t06 covers peer parsing/preflight; cursor-via-custom-ACP README documentation (Open Question b) missing (see Medium finding). |
| FR10 (paseo install assist) | implemented | p04-t04 install script + p04-t05 README. |
| NFR1 (publishable audit trail) | implemented | p02-t09 renders sanitized prose, p04-t05 readability sweep. |
| NFR2 (wall-clock + cost budget) | implemented | p02-t05/t09, p03-t05, p04-t07/t08; non-gating per spec. |
| NFR3 (cross-provider portability via additive frontmatter) | implemented | p01-t03/t04/t05/t07, p04-t05. |
| NFR4 (OAT/plugin separation) | implemented | p01-t02/t03/t04/t07; layout keeps `.oat/`/`.agents/` outside plugin path. |
| NFR5 (honest README about scope) | implemented | p01-t06 baseline, p04-t05 completion. |
| NFR6 (provider-runtime subagent permission handling) | partial | p02-t06 preflight, p03-t01/t03/t05 covered; per-provider permission verification weak (see Important finding on Open Question d); paseo version-range mitigation also weak (see Important finding R8). |

Open Questions traceability:

| Open Question | Plan handling |
| ------------- | ------------- |
| (a) Codex skill-path syntax | Silently committed to plugin-root-relative without verification step (Important). |
| (b) Cursor-via-custom-ACP README | Not present in p04-t05 (Medium). |
| (c) Future shared consensus-loop refactor | Correctly deferred (loop vendored under skill). |
| (d) Per-provider paseo permission profile | Not explicitly verified (Important). |
| (e) Summary-context sequential mode (v0.2) | Correctly deferred. |
| (f) Paseo CLI surface evolution + version range | Preflight present but no version-range pin or check (Important, R8). |

### Extra Work (not in declared requirements)

None observed. Plan stays inside v0.1 scope. Tasks all map to FR/NFR or design phases. `tests/` at repo root, `scripts/bump-version.mjs`, `scripts/install-paseo.mjs`, `scripts/smoke-test.mjs`, `scripts/validate.mjs`, and CI workflows are all design-prescribed (`design.md:243-251`).

## Verification Commands

To verify the plan after fixes are applied:

```bash
# Confirm all FR/NFR ↔ task references in spec.md still resolve in plan.md
rg -n "p0[1-4]-t[0-9]+" /Users/thomas.stang/Code/skills/.oat/projects/shared/consensus-plugin/spec.md \
  | sort -u

# Confirm every Requirement Index task ID is declared in plan.md
rg -n "^### Task p0[1-4]-t[0-9]+" /Users/thomas.stang/Code/skills/.oat/projects/shared/consensus-plugin/plan.md

# Confirm no path drift (no repo-root `skills/consensus-refine` references)
rg -n "(^|[^/])skills/consensus-refine" /Users/thomas.stang/Code/skills/.oat/projects/shared/consensus-plugin/plan.md \
  | rg -v "plugins/consensus/skills/consensus-refine"

# Confirm Non-Goals untouched (no skills 2-6, no harmonization, no parallel-revision/synthesized)
rg -n "consensus-(create|evaluate|decide|plan|research)|harmoniz|parallel-revision|parallel-synthesized" \
  /Users/thomas.stang/Code/skills/.oat/projects/shared/consensus-plugin/plan.md

# Confirm 30 tasks total
rg -c "^### Task p0" /Users/thomas.stang/Code/skills/.oat/projects/shared/consensus-plugin/plan.md
# Expect: 30

# After Important fixes, confirm version-check + cursor-ACP + permission-profile coverage
rg -n "paseo.*--version|MIN_PASEO_VERSION|tested.*version range|Advanced Configuration|cursor-via-custom-ACP|permission profile" \
  /Users/thomas.stang/Code/skills/.oat/projects/shared/consensus-plugin/plan.md
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert these findings into plan tasks. Findings are concentrated in three Important items (paseo version-range, Codex skill-path-syntax verification, per-provider paseo permission profile) plus four Medium items; no Critical findings, so the plan as-written is structurally sound and the gaps can be closed as refinements rather than restructuring.
