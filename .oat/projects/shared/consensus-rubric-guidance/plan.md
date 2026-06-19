---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-19
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ["p03"]
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: consensus-rubric-guidance

> Execute this plan using `oat-project-implement`.

**Goal:** Align the consensus `refine` and `evaluate` skills with current skill
authoring conventions while adding guided rubric creation support to `evaluate`.

**Architecture:** Documentation and validation-first change. Runtime wrappers
remain deterministic and dependency-free; only validator/tooling tests change
when making top-level `version` meaningful.

**Tech Stack:** Node.js 22+, TypeScript source with generated shipped `.mjs`
outputs, Node test, Vitest, and repository validation scripts.

**Commit Convention:** `{type}({scope}): {description}`.

## Planning Checklist

- [x] Confirmed quick-mode straight-to-plan path with user
- [x] Set dispatch ceiling in project state: maximum (Codex `xhigh`, Claude `opus`)
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter

---

## Parallelism

This plan is intentionally sequential. Phase 1 changes frontmatter validation and
the skill frontmatter source of truth. Phase 2 then edits the same skill files
and adds rubric references that depend on those frontmatter semantics. Phase 3
is the repository-level guard pass after all docs and validation changes land.
Parallel worktrees would collide on `plugins/consensus/skills/*/SKILL.md`,
`tests/docs-presence.test.mjs`, and validation expectations, so
`oat_plan_parallel_groups` remains `[]`.

---

## Phase 1: Frontmatter Contract and Validator Support

### Task p01-t01: Teach validation about promoted skill versions

**Files:**

- Modify: `scripts/validate.mjs`
- Modify: `tests/validate-script.test.mjs`

**Goal:**

Make top-level `version` a real validator-backed field while retaining
`metadata.version` compatibility during the transition.

**Implementation notes:**

- Add a small helper in `scripts/validate.mjs` that resolves the effective skill
  version from top-level `version` when present, otherwise from
  `metadata.version`.
- Validate that the effective version is semver.
- When both fields exist, require them to match so the transition does not create
  dual-source drift.
- Keep existing required frontmatter fields unchanged.
- Keep metadata-only frontmatter passing after this task so the repository stays
  green before `p01-t02` adds top-level `version` to the consensus skills.
- Extend `tests/validate-script.test.mjs` with temp-repository cases for:
  - top-level `version` plus matching `metadata.version` passes;
  - metadata-only legacy frontmatter still passes;
  - mismatched top-level and metadata versions fails;
  - malformed top-level version fails with a clear message.

**Verification:**

```bash
node --test tests/validate-script.test.mjs
pnpm run validate
```

**Commit:**

```bash
git add scripts/validate.mjs tests/validate-script.test.mjs
git commit -m "test(validate): support promoted skill version"
```

---

### Task p01-t02: Promote consensus skill frontmatter consistently

**Files:**

- Modify: `plugins/consensus/skills/refine/SKILL.md`
- Modify: `plugins/consensus/skills/evaluate/SKILL.md`
- Modify: `tests/skill-frontmatter.test.mjs`

**Goal:**

Apply the shared frontmatter contract to both consensus skills.

**Implementation notes:**

- Add top-level `version: '0.1.0'` to both skills.
- Keep `metadata.version: '0.1.0'` for compatibility.
- Add useful `argument-hint` values to both skills:
  - `refine`: include the input artifact and optional goal shape.
  - `evaluate`: include the artifact and optional `--rubric` path shape.
- Update `tests/skill-frontmatter.test.mjs` so it covers both `refine` and
  `evaluate`, asserts matching top-level and metadata versions, and checks the
  new `argument-hint` field.

**Verification:**

```bash
node --test tests/skill-frontmatter.test.mjs
pnpm run validate
```

**Commit:**

```bash
git add plugins/consensus/skills/refine/SKILL.md plugins/consensus/skills/evaluate/SKILL.md tests/skill-frontmatter.test.mjs
git commit -m "docs(consensus): promote skill frontmatter versions"
```

---

## Phase 2: Consensus Skill Guidance and Rubric References

### Task p02-t01: Add best-practice guidance sections to both skills

**Files:**

- Modify: `plugins/consensus/skills/refine/SKILL.md`
- Modify: `plugins/consensus/skills/evaluate/SKILL.md`
- Modify: `tests/docs-presence.test.mjs`

**Goal:**

Bring both consensus skills up to the shared authoring pattern without forcing
them into Step-N workflow structure.

**Implementation notes:**

- Add `## When NOT to Use`, `## Examples`, and `## Success Criteria` to both
  skills.
- Preserve each skill's existing topical style and operational contracts.
- For `refine`, examples should cover a basic one-shot refinement and a
  conversational host-model invocation.
- For `evaluate`, examples should cover a basic explicit-rubric invocation and a
  conversational evaluation request.
- Update docs-presence coverage to assert both skills expose the new sections.
- Preserve existing `tests/docs-presence.test.mjs` heading and token assertions;
  only add coverage for the new sections.

**Verification:**

```bash
node --test tests/docs-presence.test.mjs
pnpm run validate
```

**Commit:**

```bash
git add plugins/consensus/skills/refine/SKILL.md plugins/consensus/skills/evaluate/SKILL.md tests/docs-presence.test.mjs
git commit -m "docs(consensus): add skill usage guidance"
```

---

### Task p02-t02: Add guided rubric creation guidance to evaluate

**Files:**

- Modify: `plugins/consensus/skills/evaluate/SKILL.md`
- Modify: `tests/docs-presence.test.mjs`

**Goal:**

Document the host-model guided path for users who want evaluation but do not yet
have a rubric.

**Implementation notes:**

- Add a topical section such as `## Guided Rubric Creation`.
- Trigger the guided path when:
  - the user explicitly asks for help creating a rubric; or
  - the user asks to evaluate an artifact but provides no rubric.
- Keep the raw wrapper contract unchanged: `node ./scripts/consensus-evaluate.mjs <artifact.md> --rubric <rubric.md>`.
- Instruct the host model to elicit goals, select or adapt an example rubric,
  write the draft only to a user-approved workspace path, and then invoke the
  wrapper with `--rubric`.
- Document that headings and bullets are the machine-visible criteria and the
  wrapper silently keeps only the first 12 distinct criteria; weights/scales are
  peer-facing guidance unless runtime parsing changes in a later project.
- Update tests to assert the new section mentions no-rubric evaluation, user
  approved paths, and the 12-criteria cap.

**Verification:**

```bash
node --test tests/docs-presence.test.mjs
pnpm run validate
```

**Commit:**

```bash
git add plugins/consensus/skills/evaluate/SKILL.md tests/docs-presence.test.mjs
git commit -m "docs(evaluate): add guided rubric creation flow"
```

---

### Task p02-t03: Ship evaluate rubric examples

**Files:**

- Create: `plugins/consensus/skills/evaluate/references/examples/general-purpose.md`
- Create: `plugins/consensus/skills/evaluate/references/examples/code-review.md`
- Create: `plugins/consensus/skills/evaluate/references/examples/technical-writing.md`
- Create: `plugins/consensus/skills/evaluate/references/examples/design-architecture.md`
- Modify: `plugins/consensus/skills/evaluate/SKILL.md`
- Modify: `tests/docs-presence.test.mjs`
- Modify: `tests/repo-layout.test.mjs`

**Goal:**

Bundle four reusable rubric examples with the evaluate skill so guided creation
has concrete local references.

**Implementation notes:**

- Place examples under `evaluate/references/examples/`, mirroring refine's
  `references/examples/` layout.
- Keep every example at 12 or fewer load-bearing heading/bullet criteria.
- Make weights, scoring scales, pass/fail notes, and examples clearly
  peer-facing guidance rather than machine-parsed structure.
- Link the examples from `evaluate/SKILL.md`.
- Add tests that assert the example directory and all four files exist and that
  evaluate documentation points to them.
- Keep test ownership split cleanly: directory existence belongs in
  `tests/repo-layout.test.mjs`; example file/link/content assertions belong in
  `tests/docs-presence.test.mjs`.

**Verification:**

```bash
node --test tests/docs-presence.test.mjs tests/repo-layout.test.mjs
pnpm run validate
```

**Commit:**

```bash
git add plugins/consensus/skills/evaluate/references/examples plugins/consensus/skills/evaluate/SKILL.md tests/docs-presence.test.mjs tests/repo-layout.test.mjs
git commit -m "docs(evaluate): add bundled rubric examples"
```

---

## Phase 3: Repository Guardrails and Final Verification

### Task p03-t01: Keep release/version tooling aligned with promoted versions

**Files:**

- Modify: `scripts/bump-version.mjs`
- Modify: `tests/release-versioning.test.mjs`

**Goal:**

Ensure release tooling keeps top-level skill `version` and `metadata.version` in
sync after the validator starts recognizing the promoted field.

**Implementation notes:**

- Update skill-version read/write helpers in `scripts/bump-version.mjs` so they
  update top-level `version` when present and still update `metadata.version`.
- Add `plugins/consensus/skills/evaluate/SKILL.md` to the production
  `SKILL_FILES` list. Today release tooling only tracks
  `plugins/consensus/skills/refine/SKILL.md`, so evaluate must be added before
  the new evaluate frontmatter can be kept in sync.
- Add top-level `version` read/replace logic; the current release helpers only
  read and write the nested `metadata.version` field. Treat a present top-level
  `version` as authoritative while keeping `metadata.version` synchronized,
  mirroring the validator rule from `p01-t01`.
- Make tag consistency checks report both fields clearly when either drifts.
- Extend release-versioning tests so a version bump updates both skill version
  locations.
- Update `tests/release-versioning.test.mjs` so its local `skillFiles` fixture
  list and `tempReleaseRoot()` copy both `refine/SKILL.md` and
  `evaluate/SKILL.md`; otherwise the test temp repo will not contain every file
  that production `SKILL_FILES` reads.

**Verification:**

```bash
node --test tests/release-versioning.test.mjs
pnpm run validate
```

**Commit:**

```bash
git add scripts/bump-version.mjs tests/release-versioning.test.mjs
git commit -m "test(release): sync promoted skill versions"
```

---

### Task p03-t02: Run generated-output and repository verification gates

**Files:**

- Modify: `plugins/consensus/skills/refine/SKILL.md` if final polish is needed
- Modify: `plugins/consensus/skills/evaluate/SKILL.md` if final polish is needed
- Modify: `tests/docs-presence.test.mjs` or related tests only if verification
  exposes an artifact mismatch

**Goal:**

Confirm the full project still satisfies generated-output, validation, and smoke
contracts before handoff.

**Implementation notes:**

- Do not hand-edit generated `.mjs` files.
- Run build verification even though this project should not change canonical TS
  runtime source; this guards against accidental generated-output drift.
- If `pnpm run build:check` reports generated drift, inspect the drift before
  deciding whether a build is legitimate.
- If a first-pass test failure resembles the known transient
  `session-observer` integration race, rerun once before treating it as caused
  by this branch.

**Verification:**

```bash
pnpm run build:check
pnpm run test
pnpm run validate
pnpm run smoke
```

**Commit:**

```bash
git status --short
git add plugins/consensus/skills/refine/SKILL.md plugins/consensus/skills/evaluate/SKILL.md tests/docs-presence.test.mjs tests/repo-layout.test.mjs scripts/validate.mjs scripts/bump-version.mjs tests/validate-script.test.mjs tests/release-versioning.test.mjs tests/skill-frontmatter.test.mjs
git diff --cached --quiet || git commit -m "chore(consensus): verify rubric guidance updates"
```

---

## Reviews

| Scope | Type     | Status  | Date | Artifact |
| ----- | -------- | ------- | ---- | -------- |
| p01   | code     | passed  | 2026-06-19 | reviews/archived/p01-review-2026-06-19.md |
| p02   | code     | passed  | 2026-06-19 | reviews/archived/p02-review-2026-06-19.md |
| p03   | code     | passed  | 2026-06-19 | reviews/archived/final-review-2026-06-19.md |
| final | code     | passed  | 2026-06-19 | reviews/archived/final-review-2026-06-19.md |
| spec  | artifact | passed  | 2026-06-19 | N/A (quick mode; no spec artifact) |
| design | artifact | passed  | 2026-06-19 | N/A (quick mode; no design artifact) |
| plan  | artifact | passed | 2026-06-19 | reviews/archived/artifact-plan-review-2026-06-19.md |

**Status values:** `pending` -> `received` -> `fixes_added` -> `fixes_completed` -> `passed`

---

## Implementation Complete

**Summary:**

- Phase 1: 2 tasks - validator-backed promoted skill versions and consensus
  frontmatter parity.
- Phase 2: 3 tasks - shared guidance sections, guided rubric creation, and
  bundled evaluate rubric examples.
- Phase 3: 2 tasks - release/version tooling alignment and final verification
  gates.

**Total:** 7 tasks

Ready for implementation after the plan artifact re-review passes.

---

## References

- Discovery: `discovery.md`
- Design: N/A (quick mode, straight-to-plan selected)
- Spec: N/A (quick mode)
