---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-07-07
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ["p01"] # pause after spike for the required go/no-go decision
oat_auto_review_at_hill_checkpoints: true
oat_plan_parallel_groups: [] # fully sequential; see ## Parallelism
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: share-consensus-scripts

> Execute this plan using `oat-project-implement`.

**Goal:** Decide, with provider-layout evidence, whether Consensus can share
generated runtime output at the plugin level; on go, migrate
`consensus-loop.mjs` to a single plugin-local generated output and close
`BL-260620-share-consensus-generated`; on no-go, keep duplication and close the
item with concrete evidence.

**Architecture:** Canonical TypeScript source remains under `src/`. The build
script remains the only source of truth for committed generated `.mjs` outputs.
The proposed runtime sharing point is plugin-local:
`plugins/consensus/scripts/consensus-loop.mjs`, imported by skill wrappers
through plugin-root-relative paths.

**Tech Stack:** Node 22+, pnpm, TypeScript, esbuild, Vitest, OAT file-backed PJM.

**Commit Convention:** `{type}({scope}): {description}`.

## Planning Checklist

- [x] Confirmed HiLL checkpoints with user or source artifacts
- [x] Set `oat_plan_hill_phases` in frontmatter (`["p01"]`)
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter (`[]`)

## No-Go Handling

Phase 1 is the evidence phase. After p01 completes, implementation must pause
for the configured go/no-go checkpoint.

- **Go:** execute p02 and p03 as written.
- **No-go:** do not execute p02 migration tasks. Record the blocker in the
  spike artifact, then run the existing outcome-aware p03 closeout tasks to keep
  duplicated generated outputs, update docs if needed, close the backlog item,
  delete the consumed handoff, and run the relevant validation gates. Append
  additional no-go tasks only if implementation discovers cleanup not already
  covered by p03.

## Parallelism

This plan is intentionally sequential. Phase 1 determines whether Phase 2 is
valid at all. Phase 2 modifies the central generated-output mapping, generated
runtime files, wrapper imports, generated-output drift tests, and skill versions;
splitting that work across worktrees would create fragile merge and drift-guard
coordination. Phase 3 depends on the final go/no-go outcome and the exact files
changed by Phase 2. Therefore `oat_plan_parallel_groups` remains `[]`.

## Phase 1: Provider Layout Spike And Go/No-Go Evidence

### Task p01-t01: Prepare Spike Evidence Artifact

**Files:**

- Create: `.oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`

**Steps:**

1. Create the spike evidence artifact with sections for Claude Code, Codex,
   Cursor Agent, Copilot, standalone recovery, and recommendation.
2. Record the commands or command-discovery steps that will be used for each
   provider. Start from `plugins/consensus/README.md`, `RELEASING.md`, and live
   CLI help instead of assuming older docs are current.
3. Include an evidence table for each provider with: command used, installed or
   local-load plugin root, whether `plugins/consensus/scripts/` is preserved
   beside `skills/`, wrapper import path tested, status, and notes.

**Verify:**

```bash
test -f .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md
rg -n "Claude Code|Codex|Cursor Agent|Copilot|standalone recovery|Go/no-go" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md
```

**Commit:**

```bash
git add .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md .oat/projects/shared/share-consensus-scripts/implementation.md
git commit -m "test(consensus): prepare plugin layout spike evidence"
```

---

### Task p01-t02: Run Provider Layout Checks

**Files:**

- Modify: `.oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`

**Steps:**

1. For Claude Code, verify the local marketplace install or plugin load path and
   inspect the installed plugin tree. Record the exact commands and whether
   `plugins/consensus/scripts/` is available from a skill wrapper's relative
   path.
2. For Codex, verify the configured marketplace or local plugin install path and
   inspect the installed plugin tree. If a local marketplace already points to a
   different checkout, record that state and use the least disruptive verified
   path.
3. For Cursor Agent, verify the local `--plugin-dir` load shape and whether the
   plugin root is preserved during execution.
4. For Copilot, verify the current plugin/install surface from live CLI help or
   primary provider documentation. If no supported local plugin load exists,
   record the blocker with source evidence instead of guessing.
5. Verify the PR #38 standalone recovery path still works or remains actionable:
   a standalone single-skill install must either find the plugin-local CLI or
   fall back to the documented `~/.consensus/consensus.mjs` recovery path with
   the shared actionable error.

**Verify:**

```bash
rg -n "Claude Code.*(pass|fail|blocked)|Codex.*(pass|fail|blocked)|Cursor Agent.*(pass|fail|blocked)|Copilot.*(pass|fail|blocked)|standalone recovery.*(pass|fail|blocked)" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md
```

**Commit:**

```bash
git add .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md .oat/projects/shared/share-consensus-scripts/implementation.md
git commit -m "test(consensus): record provider plugin layout evidence"
```

---

### Task p01-t03: Record Go/No-Go Recommendation

**Files:**

- Modify: `.oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`
- Modify: `.oat/projects/shared/share-consensus-scripts/implementation.md`

**Steps:**

1. Summarize whether all required providers preserve a plugin root that supports
   plugin-local shared scripts.
2. State the recommendation clearly as `go` or `no-go`.
3. For `go`, list any provider caveats that implementation must preserve in docs
   or tests.
4. For `no-go`, list the blockers and the evidence needed to close the backlog
   item while keeping duplicated generated output.
5. Stop after this task for the configured HiLL checkpoint before executing
   Phase 2.

**Verify:**

```bash
rg -n "Recommendation: (go|no-go)|Required checkpoint" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md
```

**Commit:**

```bash
git add .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md .oat/projects/shared/share-consensus-scripts/implementation.md
git commit -m "test(consensus): record plugin layout go-no-go"
```

---

## Phase 2: Shared Runtime Build Migration (Go Path Only)

### Task p02-t01: Update Generated-Output Mapping And Import Rewrites

**Files:**

- Modify: `scripts/build-generated.mjs`
- Modify: `.oxfmtrc.json`
- Modify: `.oxlintrc.json`

**Steps:**

1. Replace the five per-skill `consensus-loop.mjs` build outputs with one shared
   mapping for `src/consensus/core/consensus-loop.ts` to
   `plugins/consensus/scripts/consensus-loop.mjs`.
2. Update the `importRewrites` for `consensus-refine`, `consensus-evaluate`,
   `consensus-create`, `consensus-decide`, and `consensus-plan` so
   `../core/consensus-loop.js` rewrites to the literal plugin-root-relative
   target `../../../scripts/consensus-loop.mjs` from each wrapper output.
3. Update static generated-output mirrors in `.oxfmtrc.json` and
   `.oxlintrc.json`: add `plugins/consensus/scripts/consensus-loop.mjs` and
   prune the five stale per-skill `consensus-loop.mjs` entries.
4. Leave `.lintstagedrc.mjs` unchanged unless verification proves otherwise; it
   derives generated paths from `scripts/build-generated.mjs --list-outputs`.
   CI generated-output guards also derive from `--list-outputs` and should
   auto-adapt with the mapping.
5. Keep `consensus-config.mjs` duplication unchanged unless Phase 1 evidence and
   the operator explicitly broaden the scope.

**Verify:**

```bash
node scripts/build-generated.mjs --list-outputs | rg '^plugins/consensus/scripts/consensus-loop\.mjs$'
! node scripts/build-generated.mjs --list-outputs | rg 'plugins/consensus/skills/.*/scripts/consensus-loop\.mjs'
rg -n '\.\./\.\./\.\./scripts/consensus-loop\.mjs' scripts/build-generated.mjs
rg -n 'plugins/consensus/scripts/consensus-loop\.mjs' .oxfmtrc.json .oxlintrc.json
! rg -n 'plugins/consensus/skills/.*/scripts/consensus-loop\.mjs' .oxfmtrc.json .oxlintrc.json
```

**Commit:**

```bash
git add scripts/build-generated.mjs .oxfmtrc.json .oxlintrc.json .oat/projects/shared/share-consensus-scripts/implementation.md
git commit -m "build(consensus): share generated loop output at plugin root"
```

---

### Task p02-t02: Update Drift And Layout Regression Tests

**Files:**

- Modify: `tests/tooling/generated-output-sync.test.ts`
- Create or modify: focused test fixture(s) under `tests/` if needed for plugin-root layout simulation

**Steps:**

1. Update generated-output mapping assertions to expect the shared loop output
   and no per-skill loop outputs.
2. Add or update a regression test that simulates the installed plugin-root
   layout and proves wrapper imports resolve the shared loop from the plugin root.
3. Keep tests scoped to generated-output and plugin-root layout behavior; do not
   exercise live providers in unit tests.
4. Do not claim the full generated-output drift guard is green in this task.
   Phase 2's mapping, static mirrors, test updates, and regenerated outputs are
   coupled; the first full-green drift checkpoint is p02-t04 after p02-t03
   regenerates committed outputs.

**Verify:**

```bash
rg -n "shared plugin loop|plugin-root.*loop|consensus/scripts/consensus-loop" tests/tooling/generated-output-sync.test.ts
pnpm exec vitest run tests/tooling/generated-output-sync.test.ts -t "declares source to generated-output mappings|shared plugin loop|plugin-root"
```

**Commit:**

```bash
git add tests .oat/projects/shared/share-consensus-scripts/implementation.md
git commit -m "test(consensus): cover shared plugin loop layout"
```

---

### Task p02-t03: Regenerate Outputs, Remove Duplicates, And Bump Skill Versions

**Files:**

- Modify: generated consensus wrapper outputs under `plugins/consensus/skills/*/scripts/`
- Create: `plugins/consensus/scripts/consensus-loop.mjs`
- Delete: per-skill `plugins/consensus/skills/{create,decide,evaluate,plan,refine}/scripts/consensus-loop.mjs`
- Modify: `plugins/consensus/skills/{create,decide,evaluate,plan,refine}/SKILL.md`
- Modify: `scripts/bump-version.mjs` only if the coverage check shows a missing changed skill

**Steps:**

1. Run `pnpm run build`.
2. Confirm the generated wrapper imports point at the shared plugin-local loop.
3. Remove stale per-skill loop outputs from tracked files.
4. Bump the five changed consensus skill versions, keeping top-level `version`
   and `metadata.version` in sync.
5. Confirm release version-bump tooling still covers the changed skills; if it
   does not, update `scripts/bump-version.mjs` in this task before committing.

**Verify:**

```bash
pnpm run build:check
BASE_REF=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)
pnpm run validate:skill-versions --base-ref "$BASE_REF"
```

**Commit:**

```bash
git add scripts plugins/consensus tests .oat/projects/shared/share-consensus-scripts/implementation.md
git commit -m "chore(consensus): regenerate shared loop runtime outputs"
```

---

### Task p02-t04: Run Focused Runtime Smoke For Shared Imports

**Files:**

- Modify: `.oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md`
- Modify: `.oat/projects/shared/share-consensus-scripts/implementation.md`

**Steps:**

1. Run a focused local smoke that proves the generated wrappers can load with
   the shared loop path in the repository plugin layout.
2. If Phase 1 found provider-specific caveats, run the cheapest safe smoke for
   those installed or local-load layouts without making unverified release
   claims.
3. Record the command, result, and any caveat in the spike evidence artifact.

**Verify:**

```bash
pnpm run build:check
pnpm exec vitest run tests/tooling/generated-output-sync.test.ts
rg -n "Shared import smoke.*pass" .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md
```

**Commit:**

```bash
git add .oat/projects/shared/share-consensus-scripts/references/plugin-layout-spike.md .oat/projects/shared/share-consensus-scripts/implementation.md
git commit -m "test(consensus): verify shared loop import smoke"
```

---

## Phase 3: Documentation, PJM Closeout, And Final Verification

### Task p03-t01: Update Documentation For Runtime Layout

**Files:**

- Modify: `documentation/docs/engineering/architecture/generated-runtime.md`
- Modify: `documentation/docs/user-guide/installation.md` if install/runtime claims change
- Modify: `plugins/consensus/README.md` or `RELEASING.md` only if source claims become stale

**Steps:**

1. Read `documentation/AGENTS.md` before editing docs.
2. Update the generated-runtime engineering page to describe the shared
   plugin-local loop output and the plugin install/local-load runtime contract.
3. Keep marketplace and skills.sh claims limited to verified evidence.
4. If navigation changes are needed, update authored `## Contents` links and
   regenerate the docs index; otherwise do not churn generated docs artifacts.

**Verify:**

```bash
rg -n "plugins/consensus/scripts/consensus-loop\.mjs|plugin-local" documentation/docs/engineering/architecture/generated-runtime.md
pnpm run validate
```

**Commit:**

```bash
git add documentation plugins/consensus/README.md RELEASING.md .oat/projects/shared/share-consensus-scripts/implementation.md
git commit -m "docs(consensus): document shared generated runtime layout"
```

---

### Task p03-t02: Close Backlog Item And Remove Consumed Handoff

**Files:**

- Move: `.oat/repo/pjm/backlog/items/BL-260620-share-consensus-generated.md` to `.oat/repo/pjm/backlog/archived/BL-260620-share-consensus-generated.md`
- Modify: `.oat/repo/pjm/backlog/completed.md`
- Modify: `.oat/repo/pjm/backlog/index.md`
- Modify: `.oat/repo/pjm/current-state.md` if the operating picture changes
- Delete: `.oat/repo/pjm/handoffs/BL-260620-share-consensus-generated.md`

**Steps:**

1. Set the backlog item status to `closed` and update its `updated` timestamp.
   If Phase 1 ended no-go, close with the documented no-go rationale instead of
   claiming the migration shipped.
2. Add a newest-first entry to `backlog/completed.md`.
3. Move the item to `backlog/archived/`.
4. Run `oat backlog regenerate-index`.
5. Refresh `current-state.md` and the curated overview if this item changes
   priority sequencing.
6. Remove the consumed handoff file in the same commit.

**Verify:**

```bash
test ! -e .oat/repo/pjm/backlog/items/BL-260620-share-consensus-generated.md
test ! -e .oat/repo/pjm/handoffs/BL-260620-share-consensus-generated.md
test -e .oat/repo/pjm/backlog/archived/BL-260620-share-consensus-generated.md
rg -n "BL-260620-share-consensus-generated" .oat/repo/pjm/backlog/completed.md .oat/repo/pjm/backlog/index.md
```

**Commit:**

```bash
git add .oat/repo/pjm .oat/projects/shared/share-consensus-scripts/implementation.md
git commit -m "chore(pjm): close shared consensus generated runtime item"
```

---

### Task p03-t03: Run Full Validation And Record Final Evidence

**Files:**

- Modify: `.oat/projects/shared/share-consensus-scripts/implementation.md`
- Modify: `.oat/projects/shared/share-consensus-scripts/plan.md` if review status or no-go task adjustments are needed

**Steps:**

1. Run the required final gates.
2. Record the commands and pass/fail results in `implementation.md`.
3. Fix any generated-output drift or validation failure before PR handoff.

**Verify:**

```bash
pnpm test
pnpm run build:check
npm run validate
npm run smoke
pnpm run worktree:validate
```

**Commit:**

```bash
git add .oat/projects/shared/share-consensus-scripts/implementation.md .oat/projects/shared/share-consensus-scripts/plan.md
git commit -m "chore(oat): record shared generated runtime verification"
```

---

### Task p03-t04: (review) Expand Shared-Loop Schema Parity Coverage

**Files:**

- Modify: `tests/consensus/evaluate/schema-parity.test.ts`

**Step 1: Understand the issue**

Review finding `M1`: the shared loop now resolves verdict and synthesis schemas
through the plugin-root runtime path, but the existing parity guard only
compares `evaluate` schemas against `refine`. `create`, `decide`, and `plan`
schema copies could drift silently from the runtime schemas.

**Step 2: Implement fix**

Expand the parity test to iterate every loop-using skill schema directory
(`create`, `decide`, `evaluate`, `plan`, and `refine`) against the canonical
schema set.

**Step 3: Verify**

Run:

```bash
pnpm exec vitest run tests/consensus/evaluate/schema-parity.test.ts
pnpm run build:check
```

Expected: schema parity passes for every loop-using consensus skill and
generated outputs remain in sync.

**Step 4: Commit**

```bash
git add tests/consensus/evaluate/schema-parity.test.ts .oat/projects/shared/share-consensus-scripts/implementation.md
git commit -m "test(p03-t04): cover shared schema parity"
```

---

### Task p03-t05: (review) Refresh Roadmap Header Snapshot

**Files:**

- Modify: `.oat/repo/pjm/roadmap.md`

**Step 1: Understand the issue**

Review finding `m1`: the roadmap body correctly records
`BL-260620-share-consensus-generated` as done, but the top `Last updated`
sentence still advertises the previous 2026-07-05 snapshot.

**Step 2: Implement fix**

Update the roadmap header to 2026-07-07 and mention the shared generated runtime
closeout while preserving the prior neutral-panel/config-defaults context as
older status.

**Step 3: Verify**

Run:

```bash
rg -n "2026-07-07|shared generated runtime|BL-260620-share-consensus-generated" .oat/repo/pjm/roadmap.md
```

Expected: the header timestamp and body both reflect the completed shared
generated runtime closeout.

**Step 4: Commit**

```bash
git add .oat/repo/pjm/roadmap.md .oat/projects/shared/share-consensus-scripts/implementation.md
git commit -m "docs(p03-t05): refresh roadmap closeout header"
```

---

## Reviews

| Scope  | Type     | Status  | Date       | Artifact |
| ------ | -------- | ------- | ---------- | -------- |
| p01    | code     | passed | 2026-07-07 | reviews/archived/p01-review-2026-07-07.md |
| p02    | code     | passed | 2026-07-07 | reviews/archived/p02-review-2026-07-07.md |
| p03    | code     | passed | 2026-07-07 | reviews/archived/p03-review-2026-07-07-v2.md |
| final  | code     | fixes_added | 2026-07-07 | reviews/archived/final-review-2026-07-07.md |
| spec   | artifact | passed  | 2026-07-07 | N/A (quick mode; no spec artifact) |
| design | artifact | passed  | 2026-07-07 | N/A (quick mode; no design artifact) |
| plan   | artifact | fixes_completed | 2026-07-07 | reviews/archived/artifact-plan-review-2026-07-06.md |
| plan   | artifact | passed | 2026-07-07 | reviews/archived/artifact-plan-review-2026-07-06-r2.md |

**Status values:** `pending` -> `received` -> `fixes_added` ->
`fixes_completed` -> `passed`

## Implementation Complete

**Summary:**

- Phase 1: 3 tasks - provider layout spike, standalone recovery check, and
  go/no-go recommendation.
- Phase 2: 4 tasks - shared runtime build migration, drift/layout tests,
  generated output regeneration, and focused shared-import smoke.
- Phase 3: 5 tasks - docs update, PJM closeout, full validation evidence, and
  final-review follow-up fixes.

**Total: 12 tasks**

Ready for `oat-project-implement`.

## References

- Discovery: `discovery.md`
- Handoff:
  `.oat/repo/pjm/handoffs/BL-260620-share-consensus-generated.md`
- Backlog item:
  `.oat/repo/pjm/backlog/items/BL-260620-share-consensus-generated.md`
- Generated-output build mapping: `scripts/build-generated.mjs`
- Generated-output drift guard: `tests/tooling/generated-output-sync.test.ts`
- Decisions:
  `.oat/repo/reference/decisions/DR-260615-canonical-typescript-sources.md`,
  `.oat/repo/reference/decisions/DR-260616-build-time-import-rewrites.md`,
  `.oat/repo/reference/decisions/DR-260627-keep-consensus-skills.md`
