---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-21
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ['p01', 'p02'] # pause after scaffold (before mass migration) and after migration (before slimming README)
oat_plan_parallel_groups: [] # fully sequential — see ## Parallelism
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: docs-ia

> Execute this plan using `oat-project-implement` — sequential by default, parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Stand up a **Fumadocs** docs site as the repo's most complete resource
and migrate the dense reference content out of `README.md` into a navigable
two-trunk IA (User Guide + Engineering), leaving the README a lean getting-started
entry point (basics + install matrix + links into the site), without regressing
the bl-d85f install-matrix tag-time gate.

**Architecture:** Two-trunk audience-split IA under `docs/` (`user-guide/` +
`engineering/`), each with its own `index.md`. User Guide groups subjects in
folders (`consensus/`, `skills/`) with an overview + deeper per-item pages;
Engineering has `architecture/`, `repository-layout.md`, and an agent-grade
`contributing/` split into `development/` + `documentation/`. See `design.md` for
the full target IA and the source→destination map. Page-level mapping is done by
`oat docs analyze`/`apply`, curated against that IA.

**Tech Stack:** Fumadocs (Next.js/React/TypeScript), Markdown/MDX content, the
`oat docs` CLI (`init` / `analyze` / `apply` / `generate-index`), pnpm.

**Commit Convention:** `{type}({scope}): {description}` — docs/site content uses
`docs(pNN-tNN): …`; scaffold/bookkeeping uses `chore(pNN-tNN): …`.

## Planning Checklist

- [x] Confirmed HiLL checkpoints with user (operator-run scaffold is a hard gate; pause after p01 + p02)
- [x] Set `oat_plan_hill_phases` in frontmatter (`['p01', 'p02']`)
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter (`[]` — sequential, see below)

---

## Parallelism

**Fully sequential (`oat_plan_parallel_groups: []`).** A dependency conclusion,
not a quick-mode default:

- **p01 → p02:** content cannot be migrated into a docs app that does not exist
  yet. Phase 2 reads the scaffolded app structure (`documentation.root` in
  `.oat/config.json`) written by Phase 1.
- **p02 → p03:** the README may not be slimmed until every block being removed
  has a confirmed home in the site (the no-info-loss gate).
- **Write-set overlap:** Phases 1–2 both write the docs app dir; Phase 3 rewrites
  `README.md` only after Phase 2's mapping is resolved.

No file-disjoint, order-independent phase pair exists, so no worktree
parallelism is declared. (Within Phase 2 the per-trunk authoring tasks are
file-disjoint, but they share the generate-index step in p02-t07 and are small,
so they stay sequential in one worktree rather than fanning out.)

---

## Phase 1: Scaffold the Fumadocs app (operator-run + agent verify)

### Task p01-t01: Pre-stage inputs and scaffold via `/oat-docs-bootstrap` — **[OPERATOR ACTION]**

**Files:**

- Create: docs app directory (target dir resolved at scaffold; e.g. `docs/` or `documentation/`)
- Modify: `.oat/config.json` (CLI writes the `documentation` section)
- Modify: root `AGENTS.md` (CLI/skill may upsert a `## Documentation` section)

**Step 1: Agent pre-stages bootstrap inputs:**

- `framework`: **fumadocs** (decided)
- **site display title**: a real title (NOT the `docs-ia` worktree basename — the project is `skills`); operator confirms
- `target dir`: `docs/` (single-package default; `documentation/` is the gizmo/stoa convention) — operator confirms
- `description`: one-line site description
- `lint`: `none` · `format`: `oxfmt` (bootstrap defaults; confirm)

**Step 2: OPERATOR runs the skill.** `/oat-docs-bootstrap` is `disable-model-invocation` — the agent **cannot** auto-invoke it. The agent prompts the operator to run it, then waits.

**Step 3: Verify scaffold landed.**

Run: `cat .oat/config.json` → confirm a `documentation` section (`tooling: fumadocs`, a `root` path); confirm the app directory exists.
Expected: `documentation.root` set and directory present.

**Step 4: Commit** (only if the bootstrap skill left the app uncommitted):

```bash
git add <app-dir> .oat/config.json AGENTS.md
git commit -m "chore(p01-t01): scaffold fumadocs docs app via oat-docs-bootstrap"
```

---

### Task p01-t02: Verify build green and record the framework decision

**Files:**

- Modify: `.oat/projects/shared/docs-ia/implementation.md` (record "build verified green" + the Fumadocs framework-decision note; the durable DR lands in `decision-record.md` at closeout in p03-t03)

**Step 1: Resolve the app dir** from `.oat/config.json` (`documentation.root`).

**Step 2: Install + build.**

Run: `APP_DIR=$(node -e "console.log(require('./.oat/config.json').documentation.root)") && (cd "$APP_DIR" && pnpm install && pnpm run build)`
Expected: build completes with no errors; a generated `index.md` is present (its `## Contents` may be trivial pre-migration — the full nav-contract check lives in p02-t07).

**Step 3: Confirm the generated nav contract exists.**

Run: confirm `$APP_DIR/index.md` exists, begins with the autogenerated banner, and contains a `## Contents` nested list.
Expected: present.

**Step 4: Verify** repo invariants still pass.

Run: `pnpm run validate`
Expected: validation passes.

**Step 5: Record + commit.** Note the build-verified result and the Fumadocs decision in `implementation.md`, then:

```bash
git add .oat/projects/shared/docs-ia/implementation.md
git commit -m "chore(p01-t02): verify fumadocs build green; record framework decision"
```

> **HiLL pause after p01** — operator confirms scaffold + green build before mass migration.

---

## Phase 2: Migrate README content into the two-trunk IA

> **App-dir resolution (all p02/p03 tasks):** `$APP_DIR` does not persist across
> shells. Every task that references `$APP_DIR` must re-resolve it first:
> `APP_DIR=$(node -e "console.log(require('./.oat/config.json').documentation.root)")`.
>
> All p02 authoring tasks: migrate prose from source (see `design.md`
> source→destination map), keep install commands verbatim, and after each task
> rebuild (`(cd "$APP_DIR" && pnpm run build)`) to confirm the pages render.

### Task p02-t01: Analyze + curate structure against the target IA

**Files:**

- Create: `<app-dir>/docs/` page tree (proposed; written in later tasks)
- Modify: `.oat/projects/shared/docs-ia/implementation.md` (record the no-info-loss mapping)

**Step 1:** Run `oat docs analyze`.

**Step 2:** Curate the proposal against the target IA in `design.md` (two trunks; subject folders; split contributing). This is curation, not from-scratch design.

**Step 3:** Build the **no-info-loss map** as a concrete table in `implementation.md` with columns `README block (heading/anchor) | destination page | migrated?`, one row per top-level README heading (baseline = `design.md` source→destination table). This table is what p03-t01 Step 3 checks mechanically before the README is slimmed — so it must be row-checkable, not prose. Confirm no orphans.

**Step 4: Verify** the curated structure covers all README sections.
Expected: 1:1 mapping — no README block without a destination.

**Step 5: Commit.**

```bash
git add .oat/projects/shared/docs-ia/implementation.md
git commit -m "docs(p02-t01): analyze + curate docs IA; record no-info-loss mapping"
```

---

### Task p02-t02: User Guide — overview, installation, consensus folder

**Files:**

- Create: `<app-dir>/docs/index.md` (overview landing); `<app-dir>/docs/user-guide/{index,installation}.md`
- Create: `<app-dir>/docs/user-guide/meta.json` (trunk-root nav order: `installation` before `consensus`/`skills`)
- Create: `<app-dir>/docs/user-guide/consensus/{index,refine,evaluate,configuration}.md` + `meta.json`

**Step 1:** Apply + curate. Map: intro → `docs/index.md` + `user-guide/index.md`; "Local Git Repository Install" + "Prerequisites" → `user-guide/installation.md`; consensus overview + Limitations → `consensus/index.md`; refine usage/examples/arguments/modes/resume/escalation → `consensus/refine.md`; evaluate usage/rubric flow/dissent → `consensus/evaluate.md`; Permissions + Advanced Configuration → `consensus/configuration.md`.

**Step 2:** Consensus pages are the **canonical rich user home**; do **not** edit `plugins/consensus/README.md` (decision B). Cross-link to it where helpful. Keep install commands verbatim.

**Step 3:** Author `user-guide/meta.json` so the trunk orders pages intentionally (don't rely on alphabetical). Mirror the gizmo/stoa `meta.json` shape.

**Step 4: Verify** build green; pages present in nav.

```bash
git add "$APP_DIR/docs/index.md" "$APP_DIR/docs/user-guide/index.md" "$APP_DIR/docs/user-guide/installation.md" "$APP_DIR/docs/user-guide/meta.json" "$APP_DIR/docs/user-guide/consensus"
git commit -m "docs(p02-t02): migrate User Guide overview/installation/consensus"
```

---

### Task p02-t03: User Guide — skills folder

**Files:**

- Create: `<app-dir>/docs/user-guide/skills/{index,session-observer,export-session-transcript}.md` + `meta.json`

**Step 1:** Apply + curate. `skills/index.md` = what standalone skills are available; `session-observer.md` = usage/examples/watch mode/arguments/permissions/limitations; `export-session-transcript.md` = usage/examples/modes/flags/sanitization. Source from the README session-observer + export-transcript slices and each skill's `SKILL.md`.

**Step 2: Verify** build green; skills pages in nav.

```bash
git add "$APP_DIR/docs/user-guide/skills"
git commit -m "docs(p02-t03): migrate User Guide skills folder"
```

---

### Task p02-t04: Engineering — architecture + repository layout

**Files:**

- Create: `<app-dir>/docs/engineering/index.md`
- Create: `<app-dir>/docs/engineering/meta.json` (trunk-root nav order: `architecture` → `repository-layout` → `contributing` → `decisions`)
- Create: `<app-dir>/docs/engineering/architecture/{index,transcript-core,generated-runtime}.md` + `meta.json`
- Create: `<app-dir>/docs/engineering/repository-layout.md`

**Step 1:** Map: "Shared transcript-core" → `architecture/transcript-core.md`; "Generated runtime outputs" → `architecture/generated-runtime.md`; "Repository Layout" (+ consensus package structure) → `repository-layout.md` (the **canonical structural reference**).

**Step 2:** Do **not** edit `plugins/consensus/README.md` (decision B) — describe the package structure in `repository-layout.md` instead.

**Step 3:** Do **not** create an Engineering → Consensus internals page (future fill).

**Step 4: Verify** build green; engineering tree in nav.

```bash
git add "$APP_DIR/docs/engineering/index.md" "$APP_DIR/docs/engineering/meta.json" "$APP_DIR/docs/engineering/architecture" "$APP_DIR/docs/engineering/repository-layout.md"
git commit -m "docs(p02-t04): migrate Engineering architecture + repository-layout"
```

---

### Task p02-t05: Engineering — contributing/development

**Files:**

- Create: `<app-dir>/docs/engineering/contributing/index.md` (routes to development + documentation)
- Create: `<app-dir>/docs/engineering/contributing/development/{index,conventions,commit-conventions,hooks-and-safety}.md` + `meta.json`

**Step 1:** Map: "Development" + `CONTRIBUTING.md` → `development/index.md` (workflow + verification commands: type-check/test/build:check/validate/smoke); root `CLAUDE.md` "Repository Conventions" → `conventions.md` (Node-stdlib / dependency-free shipped code, generated-output discipline, pnpm dev deps); `CLAUDE.md` "Commits" → `commit-conventions.md`; hooks/lint-staged/skill version-bump enforcement → `hooks-and-safety.md`.

**Step 2:** Write for agents — concrete commands and contracts over prose. (`writing-skills.md` is **deferred**, per decision.)

**Step 3: Verify** build green.

```bash
git add "$APP_DIR/docs/engineering/contributing/index.md" "$APP_DIR/docs/engineering/contributing/development"
git commit -m "docs(p02-t05): add Engineering contributing/development"
```

---

### Task p02-t06: Engineering — contributing/documentation (authored fresh)

**Files:**

- Create: `<app-dir>/docs/engineering/contributing/documentation/{index,authoring,markdown-features,review-checklist}.md` + `meta.json`

**Step 1:** Author fresh (not migrated — approved scope expansion). Adapt from the reference sites and the `oat-docs-authoring` skill: `index.md` = docs authoring contract overview; `authoring.md` = navigation/index contract + local docs workflow + generated-index discipline; `markdown-features.md` = the supported markdown/MDX breakdown (frontmatter, callouts, tabs, Mermaid, code blocks) **matched to what this Fumadocs scaffold actually renders**; `review-checklist.md` = docs-change review checklist.

**Step 2:** Verify `markdown-features.md` claims against the real scaffold (do not document features the app does not render).

**Step 3: Verify** build green.

```bash
git add "$APP_DIR/docs/engineering/contributing/documentation"
git commit -m "docs(p02-t06): add agent-grade contributing/documentation"
```

---

### Task p02-t07: Define decisions slot, regenerate nav, verify contract

**Files:**

- Create: `<app-dir>/docs/engineering/decisions.md` (future slot — pointer only, no fabricated body)
- Modify: `<app-dir>/index.md` (regenerated)

**Step 1:** Add the `decisions.md` slot (lean: a one-line pointer to where DR rationale lives; do not fabricate content).

**Step 2:** Regenerate the index.

Run: `oat docs generate-index --docs-dir "$APP_DIR/docs" --output "$APP_DIR/index.md"` (or the scaffolded `docs:generate-index` script).
Expected: `index.md` regenerated with the autogenerated banner.

**Step 3: Verify the nav/index contract.** Generated `## Contents` nested list matches the full page tree (every page reachable; no dangling entries); links `.md`-suffixed (FP-16). Confirm the two trunks order **User Guide before Engineering** — if `oat docs generate-index` derives trunk order from a top-level `docs/meta.json`, add one; if it orders alphabetically regardless, note that as an accepted constraint. Confirm no post-build drift.

Run: `(cd "$APP_DIR" && pnpm run build)` then `git status` (no index drift); `pnpm run validate`.
Expected: build green; no drift; validation passes.

**Step 4: Commit.**

```bash
git add "$APP_DIR/docs/engineering/decisions.md" "$APP_DIR/index.md"
git commit -m "docs(p02-t07): define decisions slot; regenerate + verify nav contract"
```

> **HiLL pause after p02** — operator confirms migration completeness + no-info-loss before the README is slimmed.

---

## Phase 3: Slim the README, preserve the install matrix, close out

### Task p03-t01: Slim `README.md` to a getting-started entry point

**Files:**

- Modify: `README.md`

**Step 1:** Reduce the README to a **getting-started entry point**: what the project is, **enough basic info to get started** (the install matrix + a minimal first-run pointer), and **prominent links into the docs site** for full detail. The site is the complete resource; the README links out rather than duplicating depth.

**Step 2:** Remove the dense reference sections now living in the site (What Ships Here detail, Usage, Permissions, Advanced Configuration, Limitations, Shared transcript-core, Generated runtime outputs, Repository Layout, Development). Keep the **install matrix** (tag-time gate).

**Step 3: Verify no information loss.** Walk the p02-t01 mapping table in `implementation.md`: every row's destination page exists on disk and its `migrated?` column is yes; every README→site link resolves.
Expected: zero orphaned content; all links valid.

**Step 4: Commit.**

```bash
git add README.md
git commit -m "docs(p03-t01): slim README to getting-started entry point + site links"
```

---

### Task p03-t02: Re-verify the install matrix + repo invariants (do not regress bl-d85f)

**Files:**

- Modify: `README.md` (only if a matrix discrepancy is found against live CLIs)

**Step 1:** Re-verify the install matrix against live provider CLIs per `RELEASING.md`.

Run:
```bash
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json
# spot-check the documented provider plugin install commands resolve as written
```
Expected: provider inventory/preflight healthy; documented install commands accurate (no regression of the bl-d85f gate).

**Step 2:** Run repo invariants.

Run: `pnpm run validate` (and `pnpm run build:check` if any generated runtime output was touched — it should not have been)
Expected: validation passes; no generated-output drift.

**Step 3: Commit** (only if a correction was needed):

```bash
git add README.md
git commit -m "docs(p03-t02): re-verify install matrix against live provider CLIs"
```

---

### Task p03-t03: Closeout bookkeeping + decision record

**Files:**

- Modify: `.oat/repo/reference/backlog/items/stand-up-documentation-site-slim-readme.md` (bl-ecaa status)
- Modify: `.oat/repo/reference/backlog/completed.md`
- Modify: `.oat/repo/reference/current-state.md` (note the docs site + its location)
- Modify: `.oat/repo/reference/roadmap.md`
- Modify: `.oat/repo/reference/decision-record.md` (record the Fumadocs framework decision as a DR)

**Step 1:** Update bl-ecaa status (→ closed/done) + `completed.md`; reflect the shipped docs site in `current-state.md` (capabilities + site location); re-sequence `roadmap.md` (docs IA done; family now documents into the site).

**Step 2:** Record the **Fumadocs** framework choice in `decision-record.md` as a new DR (context: Node/pnpm toolchain consistency, primary CLI path, reader UX; alternative considered: MkDocs/Python).

> This bookkeeping may also be driven by `oat-project-document` / `oat-pjm-update-repo-reference` at completion; ensure these surfaces end up updated either way.

**Step 3: Verify.**

Run: `oat backlog regenerate-index` (if item status changed) and `pnpm run validate`
Expected: backlog index regenerated; validation passes.

**Step 4: Commit.**

```bash
git add .oat/repo/reference
git commit -m "docs(p03-t03): close out bl-ecaa; record Fumadocs DR; refresh reference"
```

---

## Phase 4: Docs deployment CI (GitHub Pages)

> Added mid-implementation at operator request — model a GitHub Pages docs-deploy
> on `open-agent-toolkit`'s `deploy-docs.yml`. Independent of the README slim
> (touches `.github/workflows/` + reads the built `documentation/out`), so it can
> land before or after p03-t02; the closeout (p03-t03) runs last and reflects it.

### Task p04-t01: Add the GitHub Pages docs-deploy workflow

**Files:**

- Create: `.github/workflows/deploy-docs.yml`

**Step 1:** Author the workflow adapted for this repo's nested-standalone shape (OAT is a monorepo; we differ): trigger on `workflow_dispatch` + push to `main` under `documentation/**`; `pages: write` / `id-token: write` perms; `concurrency: pages`; `pnpm/action-setup@v4` + `actions/setup-node@v4` (node 22, `cache: pnpm`, `cache-dependency-path: documentation/pnpm-lock.yaml`); `pnpm install --frozen-lockfile` + `pnpm build` **in `documentation/`**; build env `NEXT_PUBLIC_BASE_PATH: /skills` (project Pages subpath); `configure-pages` → `upload-pages-artifact` (path `documentation/out`) → `deploy-pages`.

**Step 2: Verify** the static export is deploy-ready (the app already sets `output: 'export'` via `createDocsConfig`).

Run: `cd documentation && NEXT_PUBLIC_BASE_PATH=/skills pnpm build` → confirm `documentation/out/` has `index.html`, all route `index.html` files, and assets prefixed `/skills/_next/...`.
Expected: 28 html files; basePath applied.

**Step 3: [OPERATOR ACTION]** Enable GitHub Pages: repo **Settings → Pages → Source: "GitHub Actions"**. The workflow can't enable Pages itself; first deploy needs this once. (Also confirm `/skills` basePath vs a custom apex domain.)

**Step 4: Commit.**

```bash
git add .github/workflows/deploy-docs.yml
git commit -m "ci(p04-t01): add GitHub Pages docs-deploy workflow"
```

---

## Phase 5: Final-review fixes (Codex)

> Added by `oat-project-review-receive` from `reviews/archived/final-review-2026-06-21.md`
> (scope `final`, code). Both tasks executed + verified immediately.

### Task p05-t01: (review) Re-point repo tests to the migrated docs source of truth — **done** (f4c2abc)

`tests/repo/{readme-scope,docs-presence}.test.ts` asserted the pre-migration dense README (permissions/limitations/iteration-modes/generated-runtime/provider-readiness), so `pnpm test` failed 5 tests. Rewrote to assert README's install-matrix entry point + the docs site (`documentation/docs/`) for migrated detail. **Verify:** `pnpm test` → 737 pass. ✓

### Task p05-t02: (review) Format `documentation/app/layout.tsx` — **done** (f4c2abc)

oxfmt-dirty docs-app layout. Formatted. **Verify:** changed-file `oxfmt --check` clean. ✓ (Our CI oxfmt only checks `*.{mjs,js,json,md}`; this was hygiene + reviewer alignment, not a hard gate failure.)

---

## Reviews

{Track reviews here after running the oat-project-review-provide and oat-project-review-receive skills.}

{Keep both code + artifact rows below. Add additional code rows as needed, but do not delete `spec`/`design`.}

| Scope  | Type     | Status  | Date | Artifact |
| ------ | -------- | ------- | ---- | -------- |
| p01    | code     | pending | -    | -        |
| p02    | code     | pending | -    | -        |
| p03    | code     | pending | -    | -        |
| p04    | code     | pending | -    | -        |
| p05    | code     | passed   | 2026-06-21 | review fixes (C1/I1) verified green |
| final  | code     | passed   | 2026-06-21 | reviews/archived/final-review-2026-06-21.md; C1/I1 fixed, `pnpm test` 737 green |
| spec   | artifact | n/a     | -    | quick mode — no spec |
| design | artifact | pending | -    | -        |
| plan   | artifact | passed  | 2026-06-21 | structured review (in-memory); I1/I2 + M1/M2/m1/m3 applied |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

**Meaning:**

- `received`: review artifact exists (not yet converted into fix tasks)
- `fixes_added`: fix tasks were added to the plan (work queued)
- `fixes_completed`: fix tasks implemented, awaiting re-review
- `passed`: re-review run and recorded as passing (no Critical/Important)

---

## Implementation Complete

**Summary:**

- Phase 1: 2 tasks — scaffold the Fumadocs app (operator-run) + verify build green
- Phase 2: 7 tasks — migrate README content into the deeper two-trunk IA (user-guide consensus/ + skills/ folders; engineering architecture + repository-layout + split contributing) + regenerate nav
- Phase 3: 3 tasks — slim README, re-verify install matrix, close out + DR
- Phase 4: 1 task — GitHub Pages docs-deploy workflow (added at operator request)
- Phase 5: 2 tasks — final-review fixes (C1 repo tests → docs source of truth; I1 format layout.tsx)

**Total: 15 tasks**

Ready for code review and merge.

---

## References

- Design: `design.md` (target IA + source→destination map)
- Spec: N/A (quick mode)
- Discovery: `discovery.md`
- Backlog item: `.oat/repo/reference/backlog/items/stand-up-documentation-site-slim-readme.md` (bl-ecaa)
- Install-matrix gate: `RELEASING.md`
- Scaffold skill: `.agents/skills/oat-docs-bootstrap/SKILL.md`
- IA references: `gizmo-slack-app`, `stoa`, `open-agent-toolkit` Fumadocs docs (see `design.md`)
