---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-06-19
oat_generated: false
---

# Discovery: consensus-rubric-guidance

> **Discovery revalidation in progress.** This artifact began as a placeholder
> seeded from the `consensus-evaluate` work. On 2026-06-18, the code-facing
> assumptions were rechecked against the current source and the project state was
> repaired to quick mode. The remaining open questions are product decisions to
> confirm before generating a quick implementation plan.

## Initial Request

While performing the final independent review of the `consensus-evaluate`
project, the user raised two improvements for the consensus skills:

1. **Best-practice conformance.** Align both consensus skills (`refine` and
   `evaluate`) to the `create-agnostic-skill` template's best practices, and
   keep them **consistent across both skills** (sibling parity).
2. **Guided rubric creation.** The `evaluate` skill currently hard-requires a
   `--rubric <path>` and offers no help authoring one — users must already know
   what a good rubric looks like. The skill should ship **example rubric
   reference file(s)** and be able to **collaboratively construct a rubric**
   with the user from a discussion of their goals, then run the evaluation.

## Background / Why Now

- Surfaced during `reviews/archived/.../final-review` of `consensus-evaluate`
  (that project is at `pr_open`, final review passed).
- Tracked as a **separate follow-up OAT project** (its own project identity,
  `--no-set-active` so it is not opened), shipped **inside the `concensus-evaluate`
  branch/PR** rather than on its own branch.
- **Intended pickup path:** the `concensus-evaluate` PR (carrying this placeholder)
  merges to `main`; the project is then picked up from a **new worktree created
  off `main`**, where discovery is revalidated and the work planned/implemented.

## Clarifying Questions (seeded earlier)

### Question 1: Which best-practice elements to apply to both skills?

**Q:** Which `create-agnostic-skill` best practices should be added to BOTH
`refine` and `evaluate`?
**A:** All four offered: `## When NOT to Use`, `## Examples` (Basic Usage +
Conversational), `## Success Criteria`, and frontmatter fixes (add
`argument-hint`; promote `version` to top-level while keeping the `metadata`
block).
**Decision:** Apply all four to both skills for sibling parity.

### Question 2: Which example rubrics ship bundled in `evaluate`?

**Q:** Which example rubrics should be bundled in the evaluate skill's
references?
**A:** All four: a general-purpose annotated template, code review, technical
writing / docs, and design / architecture doc.
**Decision:** Ship all four under the skill's `references/` (bundled so they
travel with the installed skill).

### Question 3: How should the guided rubric flow be implemented?

**Q:** Should guided creation modify the deterministic wrapper, or be
host-model-driven?
**A (provisional, user agreed):** Host-model-driven. The SKILL.md instructs the
agent to hold the collaborative discussion, draft a rubric, write it to a file,
then invoke the **existing** wrapper with `--rubric <that file>`.
**Decision:** Keep the deterministic runtime dependency-free (DR-002); no change
to `src/consensus/evaluate/consensus-evaluate.ts` is expected to be required.
The wrapper continues to hard-require `--rubric` for the raw-CLI path.

### Question 4: How should this work land?

**Q:** Given `consensus-evaluate` is at `pr_open` with a passed final review,
how should this land?
**A (revised):** Track as a separate follow-up OAT project, but keep the
placeholder on the `concensus-evaluate` working branch (not a separate branch).
**Decision:** This project. Placeholder committed on the working branch now;
revalidate discovery, then plan + implement as a later pass.

## Trigger-Model Finding (context for design)

Investigated how the skills are triggered today (no decision required, but
informs the guided-flow design):

- **No installed shell command.** `package.json` has no `bin`; plugin manifests
  declare no `commands`. There is no `consensus evaluate` binary.
- **Two trigger paths exist:** (1) skill/model invocation through an AI agent
  (Claude Code / Cursor / Codex) — the primary path; (2) the wrapper as a raw
  Node CLI (`node ./scripts/consensus-evaluate.mjs <artifact> --rubric <file>`)
  for users who already have a rubric.
- **Implication:** Guided rubric creation is inherently collaborative, so it
  lives on the agent path (host-model-driven in SKILL.md). The raw-CLI path
  stays as the deterministic "I already have a rubric" entry point.

## Revalidation Findings (2026-06-18)

- **Rubric parsing is intentionally loose.** `extractRubricCriteria` reads only
  level-2 through level-6 headings and `-`/`*` bullets, dedupes matches, and caps
  the initial criteria list at 12. It does not interpret weights, numeric
  scales, or pass/fail markers structurally. The cap is silent, so example
  rubrics must keep the load-bearing criteria at 12 or fewer.
- **The raw wrapper still hard-requires `--rubric`.** Missing `--rubric <path>`
  throws before evaluation starts. Guided creation therefore belongs in
  host-model SKILL.md instructions unless a later design explicitly changes the
  runtime contract.
- **Topical sections match the existing skill style.** Both consensus skills use
  topical invocation sections rather than literal Step-N workflow sections, so
  best-practice additions should preserve that style while adding the missing
  guidance.
- **`metadata.version` is the validator-backed version field today.** The repo
  validator checks `metadata.version`; a new top-level `version` field would be
  compatibility/documentation surface unless validation semantics are also
  changed.
- **`argument-hint` is already recognized by transcript sanitization.** Adding
  it to skill frontmatter is consistent with the local tooling surface and does
  not require generated runtime edits.

## Current Scope (two workstreams)

**W1 — Best-practice conformance (both skills):**

- Add `## When NOT to Use`, `## Examples` (Basic + Conversational), and
  `## Success Criteria` to `refine/SKILL.md` and `evaluate/SKILL.md`.
- Frontmatter: add `argument-hint`; promote `version` to top-level while
  retaining the `metadata` block / author, and update validation so the promoted
  field is meaningful rather than decorative.
- Preserve sibling parity and the existing topical-section style where it is
  more appropriate than rigid "Step N" naming (the skills are contract/reference
  skills, not linear workflows).

**W2 — Guided rubric creation (evaluate only):**

- Bundle four reference rubrics under `evaluate/references/` (general-purpose
  annotated template, code review, technical writing/docs, design/architecture).
- Add host-model-driven SKILL.md guidance: collaboratively elicit goals →
  select/adapt an example rubric → draft a rubric file → invoke the wrapper with
  `--rubric`.

## Key Decisions

1. **Implementation seam:** Host-model-driven guided flow; deterministic runtime
   unchanged and dependency-free (DR-002).
2. **Sibling parity:** Conformance changes applied to both skills together to
   avoid divergence (current strongest local norm is refine↔evaluate symmetry).
3. **Bundled, not repo-root, references:** Example rubrics ship inside the
   skill's `references/` so they resolve wherever the skill is installed.
4. **Rubric authoring convention:** Use parser-aligned rich prose. Headings and
   bullets are the machine-visible criteria; optional weights, scales, examples,
   or pass/fail notes are peer-facing guidance. Keep each bundled rubric to 12 or
   fewer load-bearing criteria because the wrapper silently ignores later
   criteria.
5. **Guided trigger:** The agent path offers rubric creation both when the user
   explicitly asks for rubric help and when the user asks to evaluate without a
   rubric. The raw wrapper still hard-requires `--rubric`.
6. **Drafted rubric location:** The host-model flow writes rubric drafts only to
   a user-approved workspace path, with a sensible default near the evaluated
   artifact or run directory. The deterministic wrapper does not become
   interactive.
7. **Frontmatter version:** Add top-level `version` and update validation to
   recognize it so the best-practice field is backed by tooling. Retain
   `metadata.version` during the compatibility transition.
8. **Mode:** Quick.

## Constraints

- **DR-002:** Paseo is the only sanctioned external boundary; shipped consensus
  code stays dependency-free Node stdlib.
- **Generated output is not source:** Any runtime `.mjs` comes from canonical TS
  under `src/consensus/`; regenerate via `pnpm run build`, verify with
  `pnpm run build:check`. Do not hand-edit generated `.mjs`.
- **Path safety:** Runtime output paths must continue to use the confinement
  helpers (`confineWrite` / `resolveOutputPath` / `resolveRunDir`) and respect
  the 1 MiB input cap. Host-model rubric drafts should be written only to a
  user-approved path within the active workspace unless the user explicitly asks
  otherwise.
- **Rubric criteria cap:** Bundled examples and generated rubric drafts must keep
  their load-bearing criteria at 12 or fewer, because the current wrapper derives
  initial evaluation sections from the first 12 distinct headings/bullets.
- **Branch reality:** This placeholder lives on the `concensus-evaluate` working
  branch, where the `evaluate` skill is already present, so implementation can
  build on it directly once discovery is revalidated.
- **Lint/format exclusions:** Agent-instruction and generated files stay out of
  oxlint/oxfmt; don't format the whole tree.

## Success Criteria

- Both skills carry `## When NOT to Use`, `## Examples` (both styles),
  `## Success Criteria`, `argument-hint`, and top-level `version`, consistently;
  validation recognizes the promoted version field while preserving compatibility
  with existing `metadata.version`.
- `evaluate/references/` ships the four example rubrics, bundled, with no more
  than 12 load-bearing criteria per rubric.
- `evaluate/SKILL.md` documents a guided rubric-creation flow that produces a
  rubric file in a user-approved workspace path and runs the wrapper; the raw-CLI
  `--rubric` path still works.
- Skills-validation / build / validate / smoke suites pass; no runtime deps
  added; no generated `.mjs` hand-edited.

## Out of Scope

- Changing the deterministic wrapper's evaluation logic or output contract
  (unless design proves a change is required).
- Making the wrapper itself interactive, or adding a standalone `bin`/CLI
  command for guided creation.
- New iteration modes or scoring engines.
- Bundling example rubrics into `refine` (rubrics are an evaluate concept).

## Open Questions

No discovery questions are currently blocking planning. The next workflow
decision is whether this quick project should go straight to an implementation
plan or produce a lightweight design note first.

## Assumptions (to validate)

- The evaluate skill layout
  (`plugins/consensus/skills/evaluate/{SKILL.md,references/,schemas/}`) on this
  branch is the basis for the work.
- Host-model-driven guidance is sufficient for "collaborative rubric creation"
  without new runtime code.
- Other providers safely ignore the added frontmatter fields, or validation
  changes identify any provider-specific compatibility work before release.

## Risks

- **Sibling drift:** Applying conformance unevenly to refine vs evaluate.
  - Likelihood: Medium · Impact: Medium · Mitigation: change both together; add
    a parity check if cheap.
- **Validation surprises:** `version` promotion / `argument-hint` tripping the
  skills-validation or generated-output suites.
  - Likelihood: Low/Medium · Impact: Low · Mitigation: update validator tests
    with the version change, then run `pnpm test`, `pnpm run validate`, and
    skills validation early in implementation.

## Next Steps

**Discovery decisions are captured.** Before generating the quick implementation
plan:

1. Choose straight-to-plan or lightweight design first.
2. Mark discovery complete and ready for quick planning.
3. Replace the scaffolded `plan.md` with concrete implementation tasks, or add a
   lightweight design note first only if the rubric authoring convention needs
   more structure.
