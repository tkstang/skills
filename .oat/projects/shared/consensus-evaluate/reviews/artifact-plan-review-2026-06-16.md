---
oat_generated: true
oat_generated_at: 2026-06-16
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-evaluate
---

# Artifact Review: plan

**Reviewed:** 2026-06-16
**Scope:** plan (quick mode) — readiness for `oat-project-implement`
**Workflow mode:** quick
**Artifacts read:** `plan.md` (under review), `discovery.md` (upstream, required), `design.md` (supporting context)
**Files reviewed:** plan.md (primary)

## Summary

The plan is well-structured, internally coherent in its own terms, faithfully follows
`design.md`, and has clean TDD/verify/commit scaffolding with stable monotonic task IDs and
no template placeholders. However, the plan (and the design it inherits) is built entirely on
a TypeScript-first generated-runtime substrate — `src/consensus/`, `scripts/build-generated.mjs`,
`pnpm run build`/`build:check`/`type-check`, Vitest, and the PR #14 `importRewrites` mechanism
(DR-020/DR-021) — **none of which exists in the current repository tree**. Refine still ships
hand-authored `.mjs` files; there is no `src/`, no build pipeline, no `vitest`/`typescript`/`esbuild`
dependency, and the cited decision records do not exist. As written, essentially every task's
files, verify commands, and "modify existing X" steps reference infrastructure that has not
landed, so the plan is not implementable against this tree without a large undeclared
prerequisite. This is the dominant finding; the rest are minor.

## Findings

### Critical

- **Plan assumes a TypeScript/generated-runtime substrate (PR #13/#14) that does not exist in this repo** (`plan.md:22`, `plan.md:38`, `plan.md:120`, `plan.md:165`, `plan.md:250`)
  - Issue: The Architecture statement and every phase reference a canonical `src/consensus/`
    TypeScript tree, `scripts/build-generated.mjs`, generated `.mjs` outputs, and the PR #14
    parser-based `importRewrites` rewrite (`../core/consensus-loop.js` → `./consensus-loop.mjs`).
    Verified against the tree:
    - There is **no `src/` directory** (`src/consensus/core/consensus-loop.ts` does not exist —
      p01-t01 *modifies* it).
    - There is **no `scripts/build-generated.mjs`** (`scripts/` contains only bump-version,
      install-paseo, smoke-test, sync-transcript-core, validate, worktree).
    - `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` and `consensus-refine.mjs`
      are **hand-authored** (no generated banner), not committed build outputs.
    - There is **no `tsconfig`** and **no `src` build at all**.
  - Impact: p01-t01/p02-t01/p02-t02 say "modify `src/consensus/...consensus-loop.ts`" / "import
    via `../core/consensus-loop.js`" against files and a wrapper convention that do not exist.
    `oat-project-implement` would either fail immediately or silently invent the entire
    substrate as undeclared scope.
  - Fix: Decide which is true and align the artifacts:
    (a) If PR #13/#14 are genuine prerequisites that must merge first, add an explicit
    dependency/prerequisite note at the top of the plan ("Blocked on PR #13/#14 landing the
    `src/consensus` generated-runtime substrate") and set `oat_blockers` accordingly — do not
    leave `oat_ready_for: oat-project-implement` with empty blockers; OR
    (b) If this plan must stand alone on the current tree, rewrite Phase 1 to first *establish*
    the substrate (introduce `src/consensus/core/consensus-loop.ts` from the existing
    hand-authored `.mjs`, add `scripts/build-generated.mjs`, add TS/Vitest tooling) as real,
    sized tasks rather than treating it as pre-existing; OR
    (c) Drop the TypeScript-first framing and plan `consensus-evaluate` as hand-authored `.mjs`
    mirroring how refine actually ships today.
  - Requirement: Discovery "thin wrapper, reuse the engine, don't fork it"; this is an
    upstream-design-vs-tree mismatch, see Important findings for the artifact-alignment angle.

- **Verify commands reference npm scripts and a test runner that are not installed** (`plan.md:48`, `plan.md:64`, `plan.md:131`, `plan.md:147`, `plan.md:388`, `plan.md:393`)
  - Issue: Tasks run `pnpm exec vitest run ...`, `pnpm run type-check`, `pnpm run build`,
    `pnpm run build:check`. Verified against `package.json`: `vitest`, `typescript`, and
    `esbuild` are **all absent** from dependencies/devDependencies, and `package.json` scripts
    are only: `sync:transcript-core, test, validate, smoke, worktree:init, worktree:validate,
    lint, lint:fix, format, format:check, hooks, hooks:status, hooks:enable-all,
    hooks:disable-all, prepare`. There is **no `build`, `build:check`, or `type-check` script**.
  - Impact: Every Phase-1/2/3 verify step that calls vitest, type-check, build, or build:check
    will fail with "missing script" / "command not found", so the plan's stated verification is
    not runnable. Existing tests in the repo use `node --test` (e.g. `tests/repo-layout.test.mjs`),
    which the plan only uses in a few places.
  - Fix: Either add the tooling-bootstrap tasks (install vitest/typescript/esbuild as **dev**
    deps — allowed per repo convention — and add the `build`/`build:check`/`type-check`/test
    scripts) before any task that invokes them, or change verify commands to the runner that
    actually exists (`node --test`) and the gates that actually exist (`npm test`,
    `npm run validate`, `npm run smoke`). Discovery's Success Criteria only mandate
    `npm test` / `npm run validate` / `npm run smoke`, which DO exist.

- **`tests/generated-output-sync.test.mjs` is marked "Modify" but does not exist** (`plan.md:121`, `plan.md:128`, `plan.md:131`, `plan.md:250`, `plan.md:259`)
  - Issue: p01-t03 and p02-t03 list `tests/generated-output-sync.test.mjs` under "Modify" and
    say "Extend generated-output tests". Verified: this file does **not** exist in `tests/`
    (present: `docs-presence.test.mjs`, `package-metadata.test.mjs`, `repo-layout.test.mjs`,
    plus `transcript-core/` and `export-session-transcript/`). The generated-output drift guard
    the plan/design lean on has not been created.
  - Impact: "Extend an existing test" is impossible; the task would have to author the entire
    generated-output guard from scratch, which is materially larger than the task describes.
  - Fix: Change to "Create" and scope the work to building the generated-output guard (which only
    makes sense if the build substrate from the first Critical finding is also established), or
    remove it if the hand-authored approach (option c above) is chosen.

### Important

- **Cited decision records DR-020 and DR-021 do not exist** (`plan.md:463`, `design.md:217`, `design.md:317`, `design.md:366`)
  - Issue: The plan's References and several task bodies treat DR-020 (generated-runtime
    substrate) and DR-021 (parser-based `importRewrites`) as authoritative, landed decisions.
    Verified: `.oat/repo/reference/decision-record.md` contains **DR-002** but **no DR-020 or
    DR-021** (grep finds only `DR-002`). The plan rests its central "mirror PR #14 / DR-021"
    rewrite convention on a decision record that is not in the repo.
  - Impact: The implementer cannot consult the cited authority; the rewrite contract
    (`../core/consensus-loop.js` → `./consensus-loop.mjs`) has no recorded source of truth here.
  - Fix: This is upstream artifact drift. Either land DR-020/DR-021 (and PR #13/#14) before this
    plan executes and re-point references, or, if the substrate is being introduced *by* this
    work, record the decisions as part of this project and stop citing them as pre-existing.

- **Upstream artifact-alignment: discovery and design themselves disagree, and the plan silently follows design** (`discovery.md:43-58`, `discovery.md:89-94`, `design.md:33-39`, `design.md:316-319`)
  - Issue: Discovery's chosen direction (Approach A, Key Decision #1) is to promote the engine to
    a canonical `shared/consensus-core/` with a `sync:consensus-core` npm script and a drift guard,
    mirroring `shared/transcript-core/`. Design then **overrides** this ("should extend that
    generated-runtime contract rather than introduce a parallel `shared/consensus-core/` sync path";
    "Do not add `sync:consensus-core`") based on PR #13/#14. The plan follows design. That override
    is defensible *if* PR #13/#14 exist — but they do not in this tree, so neither the discovery
    path nor the design path matches reality.
  - Impact: The plan is faithful to `design.md`, so this is not a plan-vs-design drift per se; it
    is a discovery↔design↔tree three-way mismatch that makes the plan's foundation ambiguous.
  - Fix: Reconcile the upstream artifacts against the actual tree before implementation. If the
    generated-runtime substrate is real (post-merge), annotate discovery's superseded Approach A.
    If not, the design's "PR #14 settled this" premise is stale and must be corrected; the plan
    should then be regenerated from the corrected design.

- **`oat_ready_for: oat-project-implement` with empty `oat_blockers` overstates readiness** (`plan.md:2-8`)
  - Issue: Frontmatter declares the plan complete and ready to implement with no blockers, but the
    plan is not executable against the current tree (Critical findings). The "run sequentially"
    rationale and task structure are sound, but readiness is asserted on an absent substrate.
  - Fix: Until the substrate question (first Critical) is resolved, set `oat_blockers` to name the
    PR #13/#14 / tooling dependency, or downgrade `oat_ready_for` until the prerequisite tasks are
    added to the plan.

### Medium

- **`pnpm run build:check` referenced before any task creates a `build:check` script** (`plan.md:147`, `plan.md:277`, `plan.md:388`)
  - Issue: Even granting the substrate, the plan never includes a task that *adds* the `build`,
    `build:check`, or `type-check` package scripts; it assumes they already exist from PR #13.
    Cross-task consistency breaks the moment the substrate is assumed-present rather than created.
  - Fix: If the substrate is a prerequisite, state that explicitly. If it is in-scope, add a task
    that introduces the scripts and tooling and order it first.

- **Phase ordering / "run sequentially" rationale is sound but assumes shared surfaces that don't yet exist** (`plan.md:28-30`)
  - Issue: The sequential rationale ("phases all touch `scripts/build-generated.mjs`, generated
    runtime outputs, validation guards") is internally reasonable, but two of the three named
    shared surfaces (`scripts/build-generated.mjs`, generated runtime outputs) are not present.
    The rationale is correct *conditional on* the substrate landing.
  - Fix: No change to the ordering itself (sequential is the right call); just ensure the shared
    surfaces it names are real once the substrate finding is resolved.

### Minor

- **p03-t02 backlog ID inconsistency in wording** (`plan.md:356`)
  - Issue: Step says "Mark bl-5174 delivered" — verified the backlog item `add-consensus-evaluate-skill.md`
    is indeed `id: bl-5174`, so this is correct. No action; noted only because the design referenced
    the same item without the ID and a reader might expect a mismatch. Accurate as written.
  - Suggestion: None required.

- **Module-specifier rewrite convention is internally coherent** (`plan.md:22`, `plan.md:257`, `plan.md:268`)
  - Issue: The canonical `.ts` → generated `.mjs` mapping and the `../core/consensus-loop.js` →
    `./consensus-loop.mjs` rewrite are stated consistently across the Architecture block, p01-t03,
    and p02-t03, and match `design.md`. The convention is coherent; its only problem is that the
    mechanism it mirrors (PR #14 `rewriteImportSpecifiers`) does not exist in-tree (see Critical/Important).
  - Suggestion: Keep the convention; it is the substrate, not the convention, that needs to land.

- **No dangling template placeholders; task IDs monotonic; Reviews table well-formed** (`plan.md:32-441`)
  - Issue: No `{...}` stubs, no contradictory frontmatter within the plan's own model, task IDs
    `p01-t01..p03-t03` are monotonic per phase, the Reviews table preserves all rows, and
    Implementation Complete + References sections are present. These are correct.
  - Suggestion: None.

## Spec/Design Alignment

**Evidence sources used:** `discovery.md` (required upstream, quick mode), `design.md` (supporting),
current repo tree / `package.json` / `decision-record.md` (ground truth). `spec.md` intentionally
absent (quick mode) — not flagged.

### Requirements Coverage

| Requirement (discovery/design intent) | Plan mapping | Status | Notes |
| --- | --- | --- | --- |
| Thin evaluate wrapper reusing the loop (not forking) | p01-t01 seam, p02-t01/t02 wrapper | covered (design-faithful) | Faithful to design; but built on absent `src/consensus` substrate |
| Narrow prompt-profile seam, refine behavior-identical | p01-t01 | covered | Default-preserving asserted; refine regression test implied, not an explicit task |
| Evaluation semantics in wrapper, untrusted-content framing | p02-t01 | covered | Prompt-builder framing well specified |
| v3 defaults (shared_input / parallel_revision / minimal), overridable; reject independent_draft | p02-t01 | covered | Matches discovery Key Decision #5 |
| Free-form markdown output; reuse verdict-parallel; dissent in deliberation log | p02-t02 | covered | Matches design Output contract; CONVERGED/IMPASSE surfaces specified |
| Schema parity (copy refine schemas, drift-checked) | p01-t02 | covered | refine schemas confirmed present; parity test plausible |
| Generated loop + wrapper runtime via build-generated | p01-t03, p02-t03 | BLOCKED | `scripts/build-generated.mjs` and `src/consensus` absent; `generated-output-sync.test.mjs` absent |
| Plugin manifests / SKILL.md / READMEs shipped, not deferred | p03-t01, p03-t02 | covered | README "deferred" refs confirmed at README.md:129 and plugins README:139 |
| Repo reference + bl-5174 delivered | p03-t02 | covered | Backlog item bl-5174 confirmed present |
| Final gates: npm test / validate / smoke | p03-t03 | partially blocked | `npm test`/`validate`/`smoke` exist; but task also runs absent `build`/`build:check`/`type-check` |
| consensus-core drift guard (discovery KD #1) | — | superseded by design | Discovery wanted `sync:consensus-core`; design dropped it (PR #13/#14) — see Important #2 |

### Extra Work (not in declared requirements)

- **Tooling/substrate bootstrap is required but undeclared.** The plan implicitly assumes a
  pre-existing TypeScript + esbuild + Vitest + `scripts/build-generated.mjs` substrate. Standing
  this up is substantial work that appears in no task. This is the inverse of scope creep: a large
  undeclared prerequisite rather than gratuitous extra scope. It must be either declared as an
  external dependency or added as explicit Phase-1 tasks.

## Verification Commands

Run these to reproduce the substrate findings:

```bash
# No src/ tree, no build pipeline
ls -d src 2>/dev/null || echo "NO src/"
ls scripts/build-generated.mjs 2>/dev/null || echo "NO build-generated.mjs"

# Tooling absent from package.json
node -e "const p=require('./package.json'); const d={...p.dependencies,...p.devDependencies}; console.log('vitest',d.vitest||'ABSENT','typescript',d.typescript||'ABSENT','esbuild',d.esbuild||'ABSENT')"
node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts).join(' '))"  # no build / build:check / type-check

# Drift-guard test the plan says to 'Modify' does not exist
ls tests/generated-output-sync.test.mjs 2>/dev/null || echo "MISSING generated-output-sync.test.mjs"

# Cited decision records absent
grep -n "DR-020\|DR-021" .oat/repo/reference/decision-record.md || echo "DR-020/DR-021 ABSENT"

# Refine .mjs are hand-authored (no generated banner)
grep -ni "GENERATED\|do not edit" plugins/consensus/skills/refine/scripts/consensus-loop.mjs || echo "no generated banner -> hand-authored"

# These DO exist (confirming the accurate parts)
grep -n "deferred" README.md plugins/consensus/README.md
grep -n "bl-5174" .oat/repo/reference/backlog/items/add-consensus-evaluate-skill.md
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert these findings into plan tasks. The pivotal
decision the receive step must force is the substrate question (Critical #1): treat PR #13/#14 as a
hard prerequisite and block the plan, OR add explicit substrate-bootstrap tasks to Phase 1, OR
re-plan against the hand-authored `.mjs` reality of the current tree. Discovery's design questions
remain sound; the gap is between the assumed TypeScript build substrate and the actual repository.
