---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-17
oat_generated: false
---

# Discovery: consensus-rubric-guidance

> ⚠️ **INCOMPLETE — PLACEHOLDER DISCOVERY.** This artifact was seeded from a
> live conversation during the `consensus-evaluate` work, **before** a real
> discovery pass. It captures intent and provisional decisions so the work is
> not lost, but it has **not** been validated end-to-end. **Re-run / revalidate
> discovery (`oat-project-discover` or quick-start discovery) before planning.**
> Treat every decision below as provisional until reconfirmed. In particular,
> re-verify the rubric format/schema, the guided-flow trigger model, and the
> frontmatter `version` promotion against the skills-validation suite.
>
> This placeholder lives on the `concensus-evaluate` working branch (the
> `evaluate` skill is present here), tracked as a separate follow-up OAT project
> that has not been opened/activated.

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

## Clarifying Questions (answered in conversation — confirm in revalidation)

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

## Provisional Scope (two workstreams)

**W1 — Best-practice conformance (both skills):**

- Add `## When NOT to Use`, `## Examples` (Basic + Conversational), and
  `## Success Criteria` to `refine/SKILL.md` and `evaluate/SKILL.md`.
- Frontmatter: add `argument-hint`; promote `version` to top-level (retain the
  `metadata` block / author).
- Preserve sibling parity and the existing topical-section style where it is
  more appropriate than rigid "Step N" naming (the skills are contract/reference
  skills, not linear workflows).

**W2 — Guided rubric creation (evaluate only):**

- Bundle four reference rubrics under `evaluate/references/` (general-purpose
  annotated template, code review, technical writing/docs, design/architecture).
- Add host-model-driven SKILL.md guidance: collaboratively elicit goals →
  select/adapt an example rubric → draft a rubric file → invoke the wrapper with
  `--rubric`.

## Key Decisions (provisional)

1. **Implementation seam:** Host-model-driven guided flow; deterministic runtime
   unchanged and dependency-free (DR-002).
2. **Sibling parity:** Conformance changes applied to both skills together to
   avoid divergence (current strongest local norm is refine↔evaluate symmetry).
3. **Bundled, not repo-root, references:** Example rubrics ship inside the
   skill's `references/` so they resolve wherever the skill is installed.
4. **Mode:** Quick.

## Constraints

- **DR-002:** Paseo is the only sanctioned external boundary; shipped consensus
  code stays dependency-free Node stdlib.
- **Generated output is not source:** Any runtime `.mjs` comes from canonical TS
  under `src/consensus/`; regenerate via `pnpm run build`, verify with
  `pnpm run build:check`. Do not hand-edit generated `.mjs`.
- **Path safety:** Any file the guided flow writes must go through the
  confinement helpers (`confineWrite` / `resolveOutputPath` / `resolveRunDir`)
  and respect the 1 MiB input cap.
- **Branch reality:** This placeholder lives on the `concensus-evaluate` working
  branch, where the `evaluate` skill is already present, so implementation can
  build on it directly once discovery is revalidated.
- **Lint/format exclusions:** Agent-instruction and generated files stay out of
  oxlint/oxfmt; don't format the whole tree.

## Success Criteria (provisional)

- Both skills carry `## When NOT to Use`, `## Examples` (both styles),
  `## Success Criteria`, `argument-hint`, and top-level `version`, consistently.
- `evaluate/references/` ships the four example rubrics, bundled.
- `evaluate/SKILL.md` documents a guided rubric-creation flow that produces a
  rubric file and runs the wrapper; the raw-CLI `--rubric` path still works.
- Skills-validation / build / validate / smoke suites pass; no runtime deps
  added; no generated `.mjs` hand-edited.

## Out of Scope (provisional)

- Changing the deterministic wrapper's evaluation logic or output contract
  (unless design proves a change is required).
- Making the wrapper itself interactive, or adding a standalone `bin`/CLI
  command for guided creation.
- New iteration modes or scoring engines.
- Bundling example rubrics into `refine` (rubrics are an evaluate concept).

## Open Questions (resolve in revalidation / design)

- **Rubric format:** What structure should the bundled rubrics and the
  guided-flow output use (criteria, weights, scoring scale, pass/fail vs graded)?
  Does the wrapper already parse rubric structure (note `extractRubricCriteria`
  in the source) in a way the examples must match?
- **Guided trigger:** Should the flow auto-offer when `--rubric` is absent, or
  only on explicit "help me build a rubric" intent? How does it interact with
  the wrapper's hard `--rubric` requirement?
- **Where the drafted rubric is written:** alongside the artifact, in a run-dir,
  or a user-chosen path — and how confinement applies.
- **Frontmatter `version` promotion:** Does promoting `version` to top-level
  (while keeping `metadata.version`) conflict with any schema/validation, the
  generated-output build, or `pnpm oat:validate-skills`? Verify before relying on
  it.
- **"Step N" vs topical sections:** Confirm the template's intent is satisfied
  by topical sections for these contract-style skills, or whether reviewers want
  literal Step naming.

## Assumptions (to validate)

- The evaluate skill layout
  (`plugins/consensus/skills/evaluate/{SKILL.md,references/,schemas/}`) on this
  branch is the basis for the work.
- Host-model-driven guidance is sufficient for "collaborative rubric creation"
  without new runtime code.
- Other providers safely ignore the added Claude-specific frontmatter fields.

## Risks

- **Sibling drift:** Applying conformance unevenly to refine vs evaluate.
  - Likelihood: Medium · Impact: Medium · Mitigation: change both together; add
    a parity check if cheap.
- **Validation surprises:** `version` promotion / `argument-hint` tripping the
  skills-validation or generated-output suites.
  - Likelihood: Low/Medium · Impact: Low · Mitigation: run `pnpm test`,
    `pnpm run validate`, and skills validation early in implementation.

## Next Steps

**Do not plan yet.** After the `concensus-evaluate` PR merges to `main`:

1. Create a new worktree off `main` and open this project there.
2. Revalidate this discovery (`oat-project-discover` or quick-start discovery) —
   confirm decisions, resolve the Open Questions, and clear the placeholder
   banner.
3. Then proceed to `plan.md` (quick mode → straight to plan), or produce a
   lightweight `design.md` first if the rubric-format question warrants it.
