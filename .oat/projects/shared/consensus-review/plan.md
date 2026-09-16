---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-16
oat_phase: plan
oat_phase_status: in_progress
oat_plan_parallel_groups: []
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: true
---

# Implementation Plan: Consensus Review

> Planning draft. Not implementation-ready until dispatch policy, review posture, artifact review, and the configured quick-start exit gate are resolved.

**Goal:** Ship one bounded, read-only reviewer invocation as standalone `consensus-review` and plugin `review`, with host-owned provenance, external persistent state, and an OAT-compatible Markdown artifact.

**Architecture:** Review owns scope, selection policy, deep validation, drift detection, and rendering. It reuses the dependency-free provider runner without importing the command dispatcher or convergence loop into its standalone closure. Host writes stay outside the reviewed worktree until an explicit final export.

**Tech stack:** Node >=22, TypeScript, Node standard library, esbuild distribution tooling, colocated Vitest tests. No shipped runtime packages or OAT dependency.

**Commit convention:** One bounded commit per task, using the message given below. Include required canonical versions and regenerated outputs with the task that changes their inputs.

## Planning Checklist

- [x] Reconcile approved product decisions and Fable's four source-backed corrections.
- [x] Preserve existing review rows; no explicit phase-review setting was present in the scaffold.
- [x] Evaluate adjacent phase dependencies and generated write sets.
- [x] Set sequential phase groups from that analysis.
- [x] Select project dispatch ceiling: High, explicitly chosen by the user; effective reusable ladder is complete.
- [ ] Confirm independent phase-gate and lifecycle-gate posture.
- [ ] Complete plan artifact review and configured quick-start exit gate.
- [ ] Confirm HiLL checkpoints when implementation starts; intentionally not selected during planning.

## Execution Boundaries

- Implementation starts in a separate **visible Codex project worktree**, not a hidden manual worktree. Transfer this committed planning bundle and verify the exact branch/base before editing source. The kickoff handoff remains authoritative for this boundary.
- Planning baseline is `08f59459`. PR #86 (runtime maintenance) is still open at this check. Before p01-t01, inspect its current disposition: if merged, reconcile the implementation branch to that merged source with user work preserved; if not, use the existing loop-free runner directly and do not duplicate the separate helper extraction. Do not assume `cli-helpers-core.ts` exists on this branch.
- Read `src/AGENTS.md` before source/tests, the generated-runtime architecture page before build tooling, and `documentation/AGENTS.md` plus the applicable authoring skill before public docs.
- New Review skill starts with quoted `metadata.version: '1.0.0'`. Every subsequent canonical edit must obey the repository's version gate against the selected base; shared-runtime changes can require version bumps for transitive consumers. Recheck against current main before handoff, and regenerate outputs rather than editing them. Plugin release version is independent.
- Ordinary verification uses deterministic provider fixtures. No live/paid provider call, global install, release, push, PR publication, or merge is authorized by this plan. Configured OAT planning/review gates are a separate workflow authority, not product live acceptance.
- File names below are intended owned modules. A justified split/merge may be recorded as a plan deviation, but preserve stable task IDs, concrete verification, and the import boundary.
- Every task: format authored files only, build when distribution inputs change, inspect the scoped diff, run `git diff --check`, stage exact paths, and commit. Never stage a peer's unrelated edits.

## Formatting and Version Discipline

The documented formatter is oxfmt. Use the file-scoped write form `pnpm exec oxfmt --write <explicit authored paths>` supplied by each task. Do not run the repository-wide `pnpm format`. Generated payloads, synced tooling, AGENTS files, and `.oat/**` are excluded: do not force-format them. OAT artifacts use manual Markdown checks and `git diff --check`. Use `pnpm exec oxlint <explicit changed authored TS/JS paths>` for changed-code lint.

Whenever a task changes source/build inputs, run `pnpm run build`, `pnpm run build:check`, and `pnpm run type-check` in addition to its focused tests. Include generated inventories/manifests and version changes in that task's exact staging list. A check command is not a substitute for formatting.

## Parallelism

`oat_plan_parallel_groups: []` is intentional after evaluating every adjacent pair:

- p01 → p02: packaging must prove the runner closure before transport changes; both touch runtime wiring and generated outputs.
- p02 → p03: selection consumes the fixed explicit-host interface and scope/state consumes the external capture contract.
- p03 → p04: orchestration and semantic validation depend on concrete scope/state/config types; shared Review owner and outputs overlap.
- p04 → p05: docs and independent receipt need the actual command/renderer; final verification consumes all prior behavior.

Phase workers therefore execute sequentially. Bounded read-only evidence checks may run alongside implementation, but cannot become competing writers or substitutes for root review.

## Phase 1: Prove both installation units (2 tasks)

### Task p01-t01: Declare a bundled walking skeleton

**Files:** Create `src/skills/consensus-review/SKILL.md`, `build.json`, `src/cli.ts`, `src/runner.ts`, and `schemas/review.schema.json`. Modify `src/distributions.ts`, `scripts/build-generated.ts` only if ownership requires it, `.oxfmtrc.json`, `.oxlintrc.json`, and relevant layout/packaging fixtures.

**Build:** First add failing distribution/inventory assertions. Declare standalone `skills/consensus-review` and plugin `plugins/consensus/skills/review`. The skeleton imports the actual provider-runner closure through a narrow facade, not the generic dispatcher. Provide help/explicit unimplemented-review behavior; do not advertise completed review support. Bundle assets without loop/OAT/runtime-package dependencies.

**Verify:** `pnpm run test:vitest tests/tooling/generated-output-sync.test.ts tests/tooling/skill-packaging.test.ts`; build/freshness/type-check. Inspect the bundle for actual runner inclusion rather than a tree-shaken unused import.

**Format:** `pnpm exec oxfmt --write src/skills/consensus-review/SKILL.md src/skills/consensus-review/build.json src/skills/consensus-review/src/cli.ts src/skills/consensus-review/src/runner.ts src/skills/consensus-review/schemas/review.schema.json src/distributions.ts scripts/build-generated.ts .oxfmtrc.json .oxlintrc.json tests/tooling/generated-output-sync.test.ts tests/tooling/skill-packaging.test.ts` (only paths actually changed).

**Commit:** `feat(p01-t01): declare bundled review installation units`.

### Task p01-t02: Exercise the runner outside the checkout

**Files:** Extend `tests/tooling/skill-packaging.test.ts`; add Review runner fixtures/tests under `src/skills/consensus-review/src/runner.test.ts` as needed.

**Build:** Copy each generated installation unit to an isolated temporary directory with no source checkout, node_modules, or OAT available. Exercise the real bundled facade through a fake provider executable and verify the response, schema/resource resolution, and supported Node execution. Do not use a production flag solely to expose testing internals. Assert no sibling generated-skill imports and no missing dynamic runtime resources.

**Verify:** `pnpm run test:vitest tests/tooling/skill-packaging.test.ts src/skills/consensus-review/src/runner.test.ts`; build/freshness/type-check. Both forms must pass before p02 begins. If plugin-root CLI sharing prevents independent installation, resolve its explicit installation-unit contract here rather than postponing.

**Format:** `pnpm exec oxfmt --write tests/tooling/skill-packaging.test.ts src/skills/consensus-review/src/runner.test.ts`.

**Commit:** `test(p01-t02): prove isolated review runner packaging`.

## Phase 2: Close provider transport and host-guard gaps (2 tasks)

### Task p02-t01: Bound both file-capture readers

**Files:** `src/plugins/consensus/provider-cli/subprocess.ts`, `structured-output.ts`, their colocated tests; create a small shared bounded-reader module/test only if it removes duplication.

**Build:** Add failures for oversize last-message and submit-sidecar files, growth during read, exact-limit input, missing files, and read errors. Use bounded reads before whole-buffer allocation, enforcing the cap despite stat/read races. Preserve existing valid-capture behavior and report overflow distinctly. Do not alter retry/fallback policy.

**Verify:** `pnpm run test:vitest src/plugins/consensus/provider-cli/subprocess.test.ts src/plugins/consensus/provider-cli/structured-output.test.ts src/plugins/consensus/provider-cli/submit-capture.test.ts`; build/freshness/type-check and impacted version validation.

**Format:** `pnpm exec oxfmt --write src/plugins/consensus/provider-cli/subprocess.ts src/plugins/consensus/provider-cli/subprocess.test.ts src/plugins/consensus/provider-cli/structured-output.ts src/plugins/consensus/provider-cli/structured-output.test.ts`; explicitly include any new bounded-reader files.

**Commit:** `fix(p02-t01): bound provider file capture reads`.

### Task p02-t02: Add no-sidecar transport and one host context

**Files:** `src/plugins/consensus/provider-cli/{types,args,commands,structured-output,invocation}.ts`, affected colocated tests; Review `src/runner.ts` and `runner.test.ts`.

**Build:** Add opt-in no-submit-sidecar behavior while preserving defaults for every existing caller. Gate all six sidecar lifecycle sites. Review uses Claude provider validation and Codex prompt-only, plus deep validation later. Permit a host-selected external Codex last-message path with safe exclusive creation/cleanup semantics. Resolve host runtime/inherited depth once; pass identical explicit context to scoped preflight and dispatch with max depth one. Reject unknown/contradictory hosts and depth exhaustion. Read-only tuples remain provider-specific; Cursor review is unsupported.

**Verify:** `pnpm run test:vitest src/plugins/consensus/provider-cli/args.test.ts src/plugins/consensus/provider-cli/commands.test.ts src/plugins/consensus/provider-cli/structured-output.test.ts src/plugins/consensus/provider-cli/invocation.test.ts src/plugins/consensus/provider-cli/host-guard.test.ts src/skills/consensus-review/src/runner.test.ts`. Assert zero sidecar creation/read/cleanup/injection and unchanged ordinary run behavior. Build/freshness/type-check.

**Format:** `pnpm exec oxfmt --write` with the exact changed files from the Files list, including their tests; never generated copies.

**Commit:** `feat(p02-t02): add read-only review transport boundary`.

## Phase 3: Capture bounded scope, external state, and reviewer choice (3 tasks)

### Task p03-t01: Implement scope and immutable evidence capture

**Files:** Create Review `src/scope.ts`, `src/scope.test.ts`, `src/limits.ts`, `src/limits.test.ts`.

**Build:** Test then implement every selector in design.md: staged, unstaged, merge-base-to-current-worktree, committed endpoint range, explicit files/untracked, repository document, and external materialized artifact. Capture refs/index/blobs, exact diff/content hashes, authoritative source versions, and verbatim request. Disable external diff/textconv, pass Git argv safely, handle unborn HEAD/deletion/rename, reject merges/binary/submodule/symlink escapes and ambiguous selectors. External artifacts use anchors, not fake repository paths. Centralize all design limits; oversize input fails rather than truncating. No automatic scope expansion.

**Verify:** `pnpm run test:vitest src/skills/consensus-review/src/scope.test.ts src/skills/consensus-review/src/limits.test.ts`; include temp-Git integration fixtures and boundary values. Build/freshness/type-check.

**Format:** `pnpm exec oxfmt --write src/skills/consensus-review/src/scope.ts src/skills/consensus-review/src/scope.test.ts src/skills/consensus-review/src/limits.ts src/skills/consensus-review/src/limits.test.ts`.

**Commit:** `feat(p03-t01): capture bounded review scopes and versions`.

### Task p03-t02: Implement external run state and drift snapshots

**Files:** Create Review `src/state.ts`, `state.test.ts`, `drift.ts`, `drift.test.ts`.

**Build:** Resolve absolute XDG state root or home fallback, hash canonical worktree path with SHA-256, preserve sibling-worktree separation, and exclusively create private run storage. Reject state paths resolving inside the reviewed worktree, including symlink ancestors. Keep every host/provider capture external. Snapshot bounded HEAD/index/tracked/nonignored-untracked state before and after, including failure paths. Revalidate captured scope immediately before dispatch. Record coverage honestly; fail when its budget cannot be met. Preserve drift without reverting user edits. Final explicit export follows comparison and refuses collisions/input aliases. No cleanup TTL.

**Verify:** `pnpm run test:vitest src/skills/consensus-review/src/state.test.ts src/skills/consensus-review/src/drift.test.ts`; test races, exclusive writes, after-scan errors, ignored/external coverage disclosure, and partial output failures. Build/freshness/type-check.

**Format:** `pnpm exec oxfmt --write src/skills/consensus-review/src/state.ts src/skills/consensus-review/src/state.test.ts src/skills/consensus-review/src/drift.ts src/skills/consensus-review/src/drift.test.ts`.

**Commit:** `feat(p03-t02): persist external review state and detect drift`.

### Task p03-t03: Add ordered reviewer defaults and selection

**Files:** `src/plugins/consensus/config/consensus-config.ts` and test; `src/plugins/consensus/provider-cli/config-commands.test.ts` and command code if needed; create Review `src/selection.ts`, `selection.test.ts`.

**Build:** Add typed strict `defaults.reviewers` parsing/show/set/clear/source reporting. Lists replace by invocation > project > user > built-in; nonempty, unique providers, opaque model/native effort. Built-ins Claude then Codex excluding host. Explicit reviewer pins choice, provider-only discards saved model, model/effort flags require reviewer, duplicate model sources fail. Preflight ordered candidates only, record skips, never fall back after dispatch. Unsupported automatic candidates skip; explicit ones fail. Same-provider flag requires pinned reviewer and host-skill-obtained user consent. Do not infer different-family diversity from runtime alone.

**Verify:** `pnpm run test:vitest src/plugins/consensus/config/consensus-config.test.ts src/plugins/consensus/provider-cli/config-commands.test.ts src/skills/consensus-review/src/selection.test.ts`; assert exact preflight order and no provider call for usage/depth/selection errors. Build/freshness/type-check.

**Format:** `pnpm exec oxfmt --write src/plugins/consensus/config/consensus-config.ts src/plugins/consensus/config/consensus-config.test.ts src/plugins/consensus/provider-cli/config-commands.test.ts src/skills/consensus-review/src/selection.ts src/skills/consensus-review/src/selection.test.ts`; include actual command-code edits explicitly.

**Commit:** `feat(p03-t03): resolve ordered reviewer preferences`.

## Phase 4: Validate, orchestrate, and render one review (3 tasks)

### Task p04-t01: Own the deep schema and provenance contract

**Files:** Review `schemas/review.schema.json`; create `src/types.ts`, `validation.ts`, `validation.test.ts`, `provenance.ts`, `provenance.test.ts`.

**Build:** Implement dependency-free nested/enum/key/string/array/finite confidence validation and host aggregate checks. Keep schema, types, and fixtures synchronized. Enforce scope-token echo, verdict consistency, complete path/anchor/version/line semantics, and no peer overwrite of host evidence. Reject escaping paths and symlink ancestors; validate historical/deleted lines against captured versions. Author attribution tracks scope, evidence source, partial/unknown coverage; trailers are declared, current host is not automatically author, self-report is not independently observed identity. Achieved diversity remains unknown when evidence is insufficient.

**Verify:** `pnpm run test:vitest src/skills/consensus-review/src/validation.test.ts src/skills/consensus-review/src/provenance.test.ts`; include adversarial nesting, duplicate basenames, source-version bounds, unknown/mixed authors, and hostile links. Build/freshness/type-check.

**Format:** `pnpm exec oxfmt --write src/skills/consensus-review/schemas/review.schema.json src/skills/consensus-review/src/types.ts src/skills/consensus-review/src/validation.ts src/skills/consensus-review/src/validation.test.ts src/skills/consensus-review/src/provenance.ts src/skills/consensus-review/src/provenance.test.ts`.

**Commit:** `feat(p04-t01): validate review findings and author provenance`.

### Task p04-t02: Orchestrate exactly one run and expose both commands

**Files:** Create Review `src/review.ts`, `review.test.ts`, `request.ts`, `request.test.ts`, `cli.test.ts`; complete `src/cli.ts`, `runner.ts`; minimally extend provider CLI `args.ts`, `commands.ts` and tests for `consensus review`.

**Build:** Join capture → selection → identical-host preflight/dispatch → validation → drift → persistence. Preserve verbatim request separately from host summary; bounded prompts reference external capture paths/hashes. Treat embedded text as data. Inspection only, no tests/builds/network authorization. Enforce one invocation/one attempt/depth one with no repair call or provider replacement. Empty scopes explicitly have zero invocations. Finalize failure diagnostics even when provider/parsing/after-scan fails, without claiming crash-completed checks. Expose standalone and plugin-root commands through the same orchestration function; standalone still avoids generic dispatcher import.

**Verify:** `pnpm run test:vitest src/skills/consensus-review/src/review.test.ts src/skills/consensus-review/src/request.test.ts src/skills/consensus-review/src/cli.test.ts src/plugins/consensus/provider-cli/args.test.ts src/plugins/consensus/provider-cli/commands.test.ts tests/tooling/skill-packaging.test.ts`. Fake-provider cases cover every outcome, forwarding, capture cleanup, and zero/one invocation counts. Build/freshness/type-check.

**Format:** `pnpm exec oxfmt --write` with each exact authored file from this task's Files list that changed.

**Commit:** `feat(p04-t02): orchestrate one bounded reviewer invocation`.

### Task p04-t03: Render receivable Markdown and truthful path envelopes

**Files:** Create Review `src/render.ts`, `render.test.ts`, fixtures; update `review.ts`, `cli.ts` and their tests.

**Build:** Deterministic four-severity findings with stable IDs, evidence/suggestions/confidence, questions, exact request, root, scope, inspected context, checks, and identity evidence. Escape Markdown/injection input. Only complete valid stable results produce receivable reviews; incomplete/defective/failed outcomes are clearly diagnostics. CLI exits 0 completed (including findings/no-op), 2 usage/predispatch, 1 failed/incomplete/defective/output error, deliberately unlike generic runner envelopes. Human/JSON output always names absolute existing artifacts; relative output args resolve absolutely, export/canonical paths distinguished, never invent a diagnostic path.

**Verify:** `pnpm run test:vitest src/skills/consensus-review/src/render.test.ts src/skills/consensus-review/src/cli.test.ts src/skills/consensus-review/src/review.test.ts`; fixture each severity/verdict, empty/mixed results, anchors, historical paths, spaces, collisions and failures. Build/freshness/type-check.

**Format:** `pnpm exec oxfmt --write src/skills/consensus-review/src/render.ts src/skills/consensus-review/src/render.test.ts src/skills/consensus-review/src/review.ts src/skills/consensus-review/src/review.test.ts src/skills/consensus-review/src/cli.ts src/skills/consensus-review/src/cli.test.ts`; include authored fixtures explicitly.

**Commit:** `feat(p04-t03): render review artifacts and absolute handoffs`.

## Phase 5: Document, exercise receipt, and verify delivery (3 tasks)

### Task p05-t01: Finish host instructions and public documentation

**Files:** Review `SKILL.md`; create `documentation/docs/user-guide/consensus/review.md`; update `consensus/{index,configuration}.md`, `user-guide/{installation.md,skills/index.md,plugins/index.md}`, `README.md`, `CHANGELOG.md`, applicable maintained manifests/catalogs and navigation source. Generated metadata is regenerated through the owning docs tooling, not hand-edited.

**Build:** Explain both installation forms and a single canonical guide destination. Include annotated JSONC plus valid JSON configuration with actual field types/precedence/model-effort behavior and first supporting release; older binaries reject the additive key. Cover all scopes, document vs external conversation artifact, inspection-only limits, provider controls vs isolation, external persistent state/retention, identity uncertainty, path/exit/status contracts, and fixture vs live verification. Host always passes --host, obtains same-provider consent, returns clickable full absolute artifact paths, and never auto-receives/applies findings.

**Verify:** `pnpm run validate`, `pnpm run build:check`, focused instruction/CLI fixtures, and `pnpm --dir documentation exec next build` after separately running MDX/index generation with the verified current OAT CLI. Do not invoke the old docs prebuild OAT binary blindly; inspect its side effects first. Verify every new navigation link and rendered examples.

**Format:** `pnpm exec oxfmt --write` with the explicit changed authored Markdown/JSON paths from this task, excluding generated indexes/manifests as applicable and AGENTS files.

**Commit:** `docs(p05-t01): document review scopes configuration and limits`.

### Task p05-t02: Independently exercise OAT receipt

**Files:** Add deterministic renderer acceptance fixtures/test under Review `src/render.test.ts` and `src/fixtures/`; record exercise results in project `implementation.md` and the review event table.

**Build:** Fable performs the agreed independent receipt exercise using current `oat-review-receive` instructions in a disposable project/fixture destination, not the user's real finding register. Feed completed pass and changes-requested artifacts with all severities, locations/anchors, and questions; compare actual normalized register with expectations. Verify inconclusive/incomplete/defective diagnostics are not offered as receivable completed reviews. Preserve root/version/path fidelity. If the skill contract conflicts with the renderer, fix and re-exercise; a test-only parser does not prove instruction-driven compatibility.

**Verify:** `pnpm run test:vitest src/skills/consensus-review/src/render.test.ts`, plus recorded fixture hashes, actual receiving skill version, expected/observed findings and independent reviewer result. If Fable unavailable, obtain a named alternate reviewer; do not mark this accepted from self-review alone. No product live-provider call required.

**Format:** `pnpm exec oxfmt --write src/skills/consensus-review/src/render.test.ts` and explicit authored fixture paths; project artifacts are excluded and checked manually.

**Commit:** `test(p05-t02): verify independent OAT review receipt`.

### Task p05-t03: Validate the complete outputs and close the tracked item

**Files:** Any narrowly required fixes with colocated regression tests; applicable versions/manifests/generated payloads; project tracking; the associated backlog item/index/current-state/roadmap and consumed kickoff handoff.

**Build:** Reconcile current main/maintenance changes without overwriting other work. Validate both final generated installations outside the checkout. Run complete gates, inspect generated drift, and record exact results. Only after all acceptance criteria pass: read PJM lifecycle instructions, run `oat pjm doctor --json` and require declared adoption, archive BL-260916-add-consensus-review-cross via its CLI, regenerate index, update current-state/roadmap, and remove the consumed handoff using its specified exact path. Do not close adjacent items. Leave live acceptance explicitly unverified unless separately authorized.

**Verify:** `pnpm run premerge`; `pnpm run validate:skill-versions -- --base-ref origin/main`; `pnpm run validate:internal-flags`; changed-authored-file oxlint/oxfmt checks; docs production build from p05-t01; `git diff --check`; clean generated freshness. Record baseline SHA, totals, exclusions and existing unrelated failures accurately. Configured phase/final review gates and root reviews still run independently of this task.

**Format:** File-scoped `pnpm exec oxfmt --write <exact authored fix paths>` when there are source/doc fixes; do not format generated/PJM/project artifacts. No repo-wide formatting.

**Commit:** `chore(p05-t03): verify review delivery and reconcile backlog`.

## Acceptance Coverage

| Requirement | Primary tasks |
| --- | --- |
| Standalone/plugin, loop-free dependency-free installed runtime | p01-t01, p01-t02, p04-t02, p05-t03 |
| Read-only controls, single call, host/depth agreement, bounded captures | p02-t01, p02-t02, p04-t02 |
| All scopes, immutable evidence, external state, drift limitations | p03-t01, p03-t02 |
| Typed defaults, precedence, ordered/pinned choice and model/effort | p03-t03 |
| Deep schema, author/reviewer identity, full finding paths | p04-t01 |
| OAT Markdown, complete/incomplete separation, absolute artifacts | p04-t03, p05-t02 |
| User docs, actual receipt, version/packaging gates, PJM closeout | p05-t01, p05-t02, p05-t03 |

## Reviews

Existing scaffold rows retained. No completed formal review is claimed. Fable's earlier design feedback is incorporated into design.md; a follow-up and the plan review are pending.

| Scope  | Type     | Status  | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| ------ | -------- | ------- | ---- | -------- | ------------- | ---------- | ----------- |
| p01    | code     | pending | -    | -        | -             | -          | -           |
| p02    | code     | pending | -    | -        | -             | -          | -           |
| final  | code     | pending | -    | -        | -             | -          | -           |
| spec   | artifact | pending | -    | -        | -             | -          | -           |
| design | artifact | pending | -    | -        | -             | -          | -           |
| p03    | code     | pending | -    | -        | -             | -          | -           |
| p04    | code     | pending | -    | -        | -             | -          | -           |
| p05    | code     | pending | -    | -        | -             | -          | -           |
| plan   | artifact | pending | -    | -        | -             | -          | -           |

Review events are append-preserved; claim an unbound pending placeholder only for the first event. Preserve artifact-specific event identity and all trailing metadata cells. Spec is not used by this quick workflow; its inherited row is retained, not treated as a missing required artifact.

## Implementation Complete

**Planned scope, not a completion claim:**

- Phase 1: 2 tasks — installed packaging proof.
- Phase 2: 2 tasks — bounded capture and safe transport.
- Phase 3: 3 tasks — scope, state, and selection.
- Phase 4: 3 tasks — validation, orchestration, and rendering.
- Phase 5: 3 tasks — documentation, independent receipt, and full validation.

**Total: 13 tasks across 5 phases; 0 completed.** First task: `p01-t01`.
Plan review/readiness remains pending. No implementation has started.

## References

- [Design](design.md)
- [Discovery](discovery.md)
- [Project state](state.md)
- [Backlog item](../../../repo/pjm/backlog/items/BL-260916-add-consensus-review-cross.md)
- [Kickoff handoff](../../../repo/pjm/handoffs/BL-260916-add-consensus-review-cross.md)
