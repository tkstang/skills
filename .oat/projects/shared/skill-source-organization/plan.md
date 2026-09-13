---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-13
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

# Implementation Plan: Skill Source Organization and Plugin Packaging

**Goal:** One authored owner per skill, explicit plugin/standalone payloads, agreed session names, public portable handoff promotion, and retirement of the private complexity-review owner.

**Architecture:** Extend the existing TypeScript/esbuild pipeline with declared installation units. Colocate authored skill content and owned tests under src/skills; keep genuine shared and plugin-level code separate. Generated payloads remain dependency-free Node ESM.

**Status:** Active planning; plan authored and required review disposition pending. User's “proceed” on 2026-09-13 accepted the settled design as the planning basis. Coding-session-handoff has merged, and the user explicitly activated this project and authorized self-review plus the plan review gate. Implementation has not started.

## Execution Boundaries

- Start only after coding-session-handoff merges and the user activates this project. Refresh its final merged behavior, source layout, versions, issue #74, and actual PR base before moving anything.
- p01–p04 produce the public migration PR. p05 is a post-merge private-repo follow-through; it must not prevent reviewing/merging the public milestone, and it must not be falsely marked complete with p04.
- At the p04 boundary, obtain publication/merge approval and use the progress-PR workflow for the public milestone while the project remains incomplete. Do not wait for p05 before opening that PR. Do not auto-merge.
- p05 begins only when the public replacement is merged and installable. Opening the requested personal-skills removal PR is planned execution scope; merging it, replacing active installs, or broad cleanup needs separate approval.
- No live session/fork experiments, paid provider calls, transcript inspection, global sync/install changes, unrelated formatting, or new runtime dependencies. Existing experimental fork guidance stays experimental.
- Create any ongoing implementation worktree through the same-machine visible Codex task mechanism required by AGENTS, not a hidden manual worktree. Internal reviewers may remain in the current task.
- Record the actual comparison base as TASK_BASE_REF at kickoff. It is supplied by the caller from the real PR base; no implicit fetch or missing-base fallback. Version guards must compare renamed owners to the legacy baseline.
- Honor repository version bumps in every affected commit. Keep the existing dual-field policy until p02-t03 switches the source/validators/tooling together; after that, metadata.version is sole authority. Shared consumer changes also need bumps.

## Product Contract

| Canonical / standalone skill | Plugin | Plugin-local name |
| --- | --- | --- |
| session-observer | consensus | observer |
| session-observer-collab | consensus | observer-collab |
| session-export-transcript | session | export-transcript |
| session-fork-to-destination | session | fork-to-destination |
| session-handoff | session | handoff |
| complexity-review | none | not applicable |

Standalone observer names always retain session-. The user also permits full session-observer/session-observer-collab plugin-local names if materially simpler; default to the short names and record any use of that fallback. Existing consensus-local names remain unchanged. Every plugin skill can opt into standalone output through configuration; do not advertise an unconfigured output.

Clean-break renames, confirmed by the user on 2026-09-13: no backward compatibility for old skill names, install paths, or renamed script entrypoints. Do not add legacy alias declarations, redirects, wrappers, or duplicate generated payloads. Update maintained documentation and references to the new names; a migration note is not a compatibility mechanism. Retain historical old-to-new owner/version mapping solely for version validation. Temporary internal build adapters, if needed between migration commits, must be removed before the public milestone and are not shipped compatibility layers.

Shared script imports are bundled/materialized into each installation unit. A genuine installed-skill prerequisite is declared and checked, not auto-installed. Observer-collab requires observer; handoff's observer/export integrations remain optional.

## Verification and Formatting Contract

Keep existing source regression coverage. Introduce at most one focused packaging suite, tests/tooling/skill-packaging.test.ts, using existing temporary-directory/provider-stub helpers where feasible. Extend existing version/build/manifest/install suites rather than duplicate their assertions. Each added case must identify a stable contract or concrete costly failure.

Use representative prompt-only, executable, shared-code, required-skill, and complete-plugin installations outside the checkout with fake HOME/config. Validate all output inventories/resources cheaply, but do not run an exhaustive provider-by-skill matrix. No whole-prompt snapshots, prose-string locks, golden private transcripts, coverage quotas, or custom LLM evaluator.

**Scoped source formatting:** pnpm exec oxfmt --write followed by the explicit authored file paths listed by the task. Never pass a whole source root or include generated outputs, upstream mirrors, AGENTS/CLAUDE files. Shell/YAML exclusions follow repository config; check their diff hygiene.

**Project-artifact formatting:** .oat is excluded from file-mode oxfmt. For each edited project Markdown file, run the documented formatter via pnpm exec oxfmt --stdin-filepath followed by that exact file path, supply its contents on stdin, and apply the formatted output only to that file. Do not alter formatter config.

Every task includes Format, Verify, and an atomic conventional commit. Stage only its owned paths. The explicit file sets below may grow only to directly affected imports/inventories identified during migration; record those additions. Documentation checks are not full runtime-suite gates.

## Parallelism

Sequential: p01 establishes build/version compatibility, p02 moves owners and removes the bridge, p03 changes shared distribution declarations, p04 verifies/documents those outputs, and p05 depends on the public merge. Adjacent phases share the builder/catalog, version consumers, generated outputs, or publication dependencies. Isolated parallel worktrees would increase merge risk rather than provide independent verification. Read-only bounded recon may run concurrently; no parallel implementation groups are declared.

## Phase p01: Packaging Foundation (3 tasks)

### Task p01-t01: Refresh baseline and lock the migration inventory

**Files:** Create migration-inventory.md in this project; update this plan only for verified path drift. Read issue #74, root AGENTS, current build/discovery/version tooling, all current canonical SKILL.md files, provider catalogs/manifests, install.sh, and personal-skills source/ownership declarations.

**Implement:** Verify the current handoff project's merge and active execution authority. Record actual base/head and a compact old-owner → new-owner → output/name/version map. Include skill-owned versus shared/plugin tests, executable/resource paths, references requiring the clean-break rename, existing consensus CLI entrypoints, and any retained experimental tooling under tools/coding-session-handoff. Do not inventory backward-compatibility obligations or design a legacy support layer. No code move yet. Confirm the source revisions and licenses for handoff and complexity-review. The inventory must cover every current product skill, not upstream OAT tooling.

**Format:** Use the project-artifact formatting command above for migration-inventory.md and any amended plan.

**Verify:** git status --short; git merge-base HEAD "$TASK_BASE_REF"; gh pr view 70 --json state,mergedAt,mergeCommit; manually reconcile the inventory against scripts/lib/discover-skills.mjs and rg --files src skills plugins tests. Stop on unmapped owners, unmerged prerequisite, dirty overlap, or materially changed scope. GitHub status is evidence, not permission to merge.

**Commit:** docs(p01-t01): record verified skill migration inventory

### Task p01-t02: Add declared payload generation to the existing build pipeline

**Files:** Modify scripts/build-generated.mjs and package.json; create scripts/build-generated.ts and narrowly scoped scripts/lib/packaging.ts as the eventual owners, plus src/distributions.ts for target declarations; update pnpm-lock.yaml, tsconfig.json, vitest.config.mjs, tests/tooling/generated-output-sync.test.ts; add tests/tooling/skill-packaging.test.ts.

**Implement:** Port the affected build entrypoint to TS with developer-only tsx, retaining existing package commands and a narrow compatibility entrypoint only while existing consumers need it. Define one small declaration for source owner, optional standalone output, plugin membership/local name, and required/optional workflow references; executable skill build.json declares entrypoints only. Prompt-only skills require neither build.json nor empty src directories.

Implement installed-name/reference rendering with explicit slots, allowed-source ownership, bundler-derived closure, resource copying, executable bits, and complete-tree inventory comparison. Reject escaping/absolute/traversing sources, undeclared executables, source/test/build leakage, runtime dependencies, symlinks outside supported contracts, output collisions, invalid/missing/test entrypoints, duplicate output basenames, stale/missing/orphan output. Stage then validate before replacement; preserve prior output on build failure and recover/report a backup on replacement failure, including rollback failure. Check input consistency across the build. Never replace an entire partially owned plugin root.

Keep the legacy file table only as a bounded bridge for not-yet-moved owners; one command owns both paths, no duplicate writers. Add source test globs now so moved tests cannot disappear later. Prepare legacy-owner version mapping support without changing today's version policy.

**Format:** pnpm exec oxfmt --write on the explicit changed authored scripts/*.ts, scripts/lib/*.ts, src/distributions.ts, package.json, tsconfig.json, vitest.config.mjs and the two named tooling test files; exclude any generated compatibility output.

**Verify:** pnpm exec vitest run tests/tooling/generated-output-sync.test.ts tests/tooling/skill-packaging.test.ts tests/tooling/vitest-config.test.ts; pnpm run type-check; pnpm run build:check. Existing output must remain fresh or be deliberately rebuilt/versioned. Reuse table-driven negative cases and a controlled replacement failure fixture; no second test harness.

**Commit:** feat(p01-t02): generate declared skill installation units safely

### Task p01-t03: Prove representative install boundaries before bulk moves

**Files:** Extend tests/tooling/skill-packaging.test.ts and existing tests/helpers only where reusable setup is absent; update build declarations/compatibility bridge only for fixture-exposed defects.

**Implement:** Test the new source layout in temporary fixture roots using current real skill/resource/runtime inputs: complexity-review (prompt-only), export (executable with shared transcript code), a standalone-configured consensus consumer requiring its helper/CLI closure, and the complete consensus plugin. Execute installed .mjs from outside the checkout with fake HOME, synthetic input, and deterministic provider stubs. Establish that multiple declared plugin units and target-local names are handled; p03 supplies the real session plugin. No legacy alias cases are required.

Assert no sibling-install/checkout imports, valid resource links, and full output containment. Keep cheap inventory checks separate from representative execution. A future new runtime boundary warrants another case, not another matrix dimension.

**Format:** pnpm exec oxfmt --write on tests/tooling/skill-packaging.test.ts and only added/changed helper or builder source files.

**Verify:** pnpm exec vitest run tests/tooling/skill-packaging.test.ts tests/consensus/install-contract.test.ts; pnpm run build:check. The temporary fixtures must exercise the new declaration pipeline, not merely the old committed outputs. No user installations change.

**Commit:** test(p01-t03): verify isolated skill and plugin payloads

## Phase p02: Canonical Source and Tooling Migration (4 tasks)

### Task p02-t01: Colocate standalone skill owners and their tests

**Files:** Move owned content from skills/session-observer, skills/session-observer-collab, skills/export-session-transcript, skills/coding-session-handoff, skills/complexity-review and corresponding src/transcript skill areas into src/skills/<owner>; move genuine src/transcript/core to src/shared/transcript; move associated tests/session-observer*, tests/transcript and handoff tests according to the inventory. Update declarations, imports, affected test helper paths, and generated outputs.

**Implement:** Preserve behavior and installed legacy names during this move; p03 owns public renames. Port collab's authored .mjs/.d.ts runtime to TS, or document a narrow required declaration boundary with objective evidence. Keep plugin-independent transcript code shared. Retained experimental handoff gate/tools code stays a tooling owner, not secretly shipped inside the public guidance skill. Move existing tests without re-authoring fixtures. Bump changed owners and affected consumers under the current policy, retaining legacy version comparison.

**Format:** pnpm exec oxfmt --write on the explicit moved/edited authored .ts, SKILL.md and resource paths from the inventory, not generated payloads. Regenerate via pnpm run build.

**Verify:** pnpm exec vitest run src/skills/session-observer src/skills/session-observer-collab src/skills/export-session-transcript src/skills/coding-session-handoff src/shared/transcript tests/tooling/skill-packaging.test.ts; pnpm run type-check; pnpm run build:check; pnpm run validate. Reconcile source test counts/identities against the inventory so moved suites cannot silently stop running.

**Commit:** refactor(p02-t01): colocate standalone skill sources and tests

### Task p02-t02: Colocate consensus owners and plugin-level runtime

**Files:** Move plugins/consensus/skills authored resources and src/consensus skill-specific modules/tests to src/skills/<canonical-owner>; move non-skill provider CLI/core/config ownership to src/plugins/consensus and genuinely cross-product helpers to src/shared as justified by imports. Update tests/consensus owner paths, declarations, plugin-level source manifests, consumers and generated outputs.

**Implement:** Keep all existing consensus plugin-local names and complete-plugin install paths. Do not force the consensus CLI/core into an arbitrary skill or duplicate it per plugin skill when plugin-local sharing works. Assign unambiguous canonical identities in the inventory without renaming unrelated user-facing skills. Preserve provider adapters, subprocess/permission boundaries, recovery installer semantics, fixtures, and output behavior. Remove migrated legacy output mappings; bump all affected owners.

**Format:** pnpm exec oxfmt --write on the explicit authored destination .ts/resource/manifest/test files from the inventory. Run pnpm run build for generated outputs.

**Verify:** pnpm exec vitest run src/skills src/plugins/consensus src/shared tests/consensus/install-contract.test.ts tests/consensus/install-sh.test.ts tests/tooling/skill-packaging.test.ts; pnpm run type-check; pnpm run build:check; pnpm run smoke. This is the one broad source migration check, not a requirement to rerun all tests for each moved file.

**Commit:** refactor(p02-t02): colocate consensus skills and plugin runtime

### Task p02-t03: Switch canonical discovery and version ownership atomically

**Files:** scripts/lib/discover-skills.mjs and scripts/lib/skill-frontmatter.mjs to TS owners; scripts/validate-skill-versions.mjs, scripts/bump-version.mjs, scripts/validate.mjs to TS owners; src/distributions.ts and migration baseline mapping; canonical SKILL.md metadata; tests/release/skill-version-bumps.test.ts, tests/release/versioning.test.ts, tests/release/validate-script.test.ts, tests/repo/skill-frontmatter.test.ts; related package entrypoints. Close BL-260723-guard-transitive-shared in this same implementation commit using .oat/repo/pjm/AGENTS.md.

**Implement:** Make src/skills the authored discovery root and generated outputs derivative. Switch source/validators/release tooling together to quoted stable metadata.version only. Legacy comparison readers may accept old fields; reject new root version/meta.version and reconcile conflicting historical values. Moves/renames preserve identity rather than becoming “new.”

Derive affected skill owners from actual runtime closure, including plugin-shared output changes. Enforce strict increases for authored code/tests/resources/deletions and changed payloads, including local staged/unstaged/untracked edits. Distinguish new/removed owners; reject ownerless generated output and unresolved explicit bases. Root-only docs/tooling do not bump unrelated skills unless output changes.

Make plugin release selection explicit and target-scoped; session/consensus versions are independent of each other and skill versions. Preserve current manifest/catalog consistency and tag checks. Use one legacy map, not permanent dual source authority.

**Format:** pnpm exec oxfmt --write on explicit changed authored TS, tests, source SKILL.md and package files; use project-artifact formatting for backlog Markdown. Do not format generated indexes or AGENTS. Run pnpm run build.

**Verify:** pnpm exec vitest run tests/release/skill-version-bumps.test.ts tests/release/versioning.test.ts tests/release/validate-script.test.ts tests/repo/skill-frontmatter.test.ts; pnpm run validate:skill-versions -- --base-ref "$TASK_BASE_REF"; pnpm run validate; pnpm run build:check. Fixtures cover renamed-owner baseline, the observed transitive missed-bump case, local edit states, nonstable/regressed versions, missing/shallow base, and one-plugin release isolation. Reuse existing fixtures rather than duplicate each scenario by owner.

**Commit:** feat(p02-t03): enforce canonical skill and independent plugin versions

### Task p02-t04: Finish existing CI and repository-tooling migration

**Files:** package.json, pnpm-lock.yaml, scripts/smoke-test.mjs and affected compatibility/tooling callers, scripts/sync-transcript-core.mjs, .github/workflows/validate.yml and release callers, .lintstagedrc.mjs, .oxlintrc.json, .oxfmtrc.json, vitest.config.mjs, tools/git-hooks affected callers, tests/tooling/generated-output-sync.test.ts, tests/tooling/git-hooks.test.ts, tests/tooling/vitest-config.test.ts, tests/release/smoke-test-script.test.ts.

**Implement:** Port only affected repository-owned tooling to TS/tsx and preserve established command names. Remove the obsolete file-by-file mapping bridge after all owners are migrated. Derive output inventories/exclusions from declared targets where formats permit; retain parity guards for static config lists. Include authored TS/colocated tests in lint and Vitest selection, with generated/upstream/instruction exclusions.

CI checks committed freshness without first repairing it, resolves the actual PR base/head/merge-base with sufficient history, fails on ambiguous/missing history, and reruns version comparison on base changes. Preserve pinned actions, frozen lockfile installs, read-only permissions, safe checkout credentials, and separate docs/release/live workflows. Avoid duplicate full builds. Keep optional hooks as consumers, not new authoritative infrastructure.

**Format:** pnpm exec oxfmt --write on explicit changed authored TS/JS/JSON/test files. YAML, generated outputs and instruction files remain excluded; inspect git diff --check. Regenerate outputs only via pnpm run build.

**Verify:** pnpm exec vitest run tests/tooling/generated-output-sync.test.ts tests/tooling/git-hooks.test.ts tests/tooling/vitest-config.test.ts tests/release/smoke-test-script.test.ts; pnpm run build:check; pnpm run type-check; pnpm run validate:internal-flags. A temporary stale/orphan fixture must fail before any rebuild; inspect changed-file selectors and base-change rerun coverage. Do not alter live hooks or user installs to prove behavior.

**Commit:** build(p02-t04): align existing checks with authored skill ownership

## Phase p03: Product Names, Plugin Groupings, and Promotions (4 tasks)

### Task p03-t01: Generate the session plugin and configured standalone forms

**Files:** src/distributions.ts; src/plugins/session provider/plugin metadata; src/plugins/consensus metadata; canonical renamed src/skills/session-export-transcript and src/skills/session-fork-to-destination; observer/collab instructions/resource references; root marketplace/catalog manifests; pinned recovery install contract if affected; tests/repo/layout.test.ts, tests/repo/plugin-manifests.test.ts, tests/repo/marketplace-manifests.test.ts, tests/consensus/install-sh.test.ts, tests/tooling/skill-packaging.test.ts.

**Implement:** Apply the Product Contract table. Observer/collab keep session- standalone names and join consensus; export/fork join session while remaining standalone. Existing consensus names stay unchanged. Rewrite only explicit target references, not ordinary prose. Preserve experimental status and the current merged fork guidance behavior.

Make the export/fork renames a clean break: remove superseded generated product paths through the builder's owned-output replacement, update maintained references and document the new names. Do not preserve old script entrypoints or generate legacy aliases/redirects/wrappers. Add both plugins to supported manifest/catalog surfaces and ensure release tooling has no consensus-only assumptions. Keep standalone eligibility opt-in but demonstrate one real consensus consumer can be configured without bespoke build code.

**Format:** pnpm exec oxfmt --write on the explicit authored catalog, source skill/resource, manifest and named test files. Run pnpm run build.

**Verify:** pnpm exec vitest run tests/repo/layout.test.ts tests/repo/plugin-manifests.test.ts tests/repo/marketplace-manifests.test.ts tests/release/versioning.test.ts tests/consensus/install-sh.test.ts tests/tooling/skill-packaging.test.ts; pnpm run validate; pnpm run build:check. Extend the existing packaging suite with one real session-plugin export-transcript execution from a temporary installation outside the checkout, using fake HOME/config and synthetic input. Verify installed resources resolve without checkout or sibling-install imports; use deterministic provider stubs only if needed, never a live provider. Inspect all target names/resources and both complete-plugin inventories, including absence of superseded old-name product outputs. Preserve the pinned recovery installer behavior; do not infer live provider discovery from static success.

**Commit:** feat(p03-t01): group session operations and generate standalone forms

### Task p03-t02: Promote portable session-handoff without adding an engine

**Files:** Create src/skills/session-handoff/SKILL.md and assets/handoff-template.md from the verified personal-skills authored source; update src/distributions.ts, relevant source resources and existing layout/frontmatter/packaging fixtures.

**Implement:** Use personal-skills 1.1.0 at 80a5a76de093f812776efb5c90bdc40504dbedfb as the planning baseline, rechecking actual source/history at execution. Preserve source provenance, author/license, read-only inspection, acceptance/authorization boundaries, bounded evidence, and optional sanitized transcript behavior. No runtime/build.json for this two-file prompt-only skill. Generate standalone session-handoff and session:handoff, with renamed export and observer references resolved appropriately.

Do not implement research-backed evidence enrichment or issue #75 own-session review. Inspect public safety and carry existing promotion-readiness gaps into validation rather than declaring behavioral acceptance from packaging.

**Format:** pnpm exec oxfmt --write src/skills/session-handoff/SKILL.md src/skills/session-handoff/assets/handoff-template.md src/distributions.ts and explicit edited fixture files. Run pnpm run build.

**Verify:** pnpm exec vitest run tests/repo/layout.test.ts tests/repo/skill-frontmatter.test.ts tests/tooling/skill-packaging.test.ts; pnpm run validate; manually compare source/resources to the pinned personal baseline and inspect optional-integration/authorization behavior. Synthetic/manual examples suffice; no paid provider run or new evaluator.

**Commit:** feat(p03-t02): promote portable session handoff

### Task p03-t03: Bring the newer complexity-review content into the public owner

**Files:** src/skills/complexity-review/SKILL.md and references/evidence-guide.md, source provenance in migration-inventory.md, existing packaging fixtures only if necessary.

**Implement:** Bring the newer personal-skills 1.0.2 content, including authorization safeguards, provider-neutral invocation, and conditional evidence-guide loading, into the public canonical owner. Verify the source revision and compare complete resources, not just version numbers. Preserve attribution and choose a valid increased version consistent with the public baseline and current policy. Remain standalone and prompt-only; do not add runtime or speculative tests.

**Format:** pnpm exec oxfmt --write src/skills/complexity-review/SKILL.md src/skills/complexity-review/references/evidence-guide.md; project-artifact formatting for the inventory. Run pnpm run build.

**Verify:** pnpm exec vitest run tests/repo/skill-frontmatter.test.ts tests/tooling/skill-packaging.test.ts; pnpm run validate; pnpm run validate:skill-versions -- --base-ref "$TASK_BASE_REF"; manually inspect the intended source delta and installed reference resolution. Record public ownership and p05 dependency.

**Commit:** feat(p03-t03): upstream newer complexity review guidance

### Task p03-t04: Make skill prerequisites and selected CLI preflight explicit

**Files:** Canonical observer-collab, observer, handoff and CLI-backed consensus SKILL.md/resources; narrow existing CLI availability helpers under src/plugins/consensus or src/shared; distribution dependency declarations; tests/tooling/skill-packaging.test.ts and existing owner-level preflight tests.

**Implement:** Before dependent work, resolve required skill workflows through supported host inventory/installed contract, accepting documented standalone or plugin forms. Missing observer stops collab with the canonical name and maintained install link; optional observer/export absence does not block handoff. No automatic install, workflow duplication, or universal host registry.

CLI-backed operations resolve installed helper paths, reliable minimum versions and operation-specific capabilities before work. Scope checks to the selected provider; no unrelated authentication probes or mandatory network. Known-newer compatible update advice may use existing evidence only, with no new updater/cache service. Prefer prose guards for prose workflows and small helper reuse for executable consumers.

**Format:** pnpm exec oxfmt --write on the explicit affected authored SKILL.md/resources, helper TS and test files. Run pnpm run build.

**Verify:** pnpm exec vitest run tests/tooling/skill-packaging.test.ts and the exact owner-level preflight test files identified in the inventory; pnpm run validate; pnpm run build:check. Cover present/missing required skill in supported forms, absent optional integrations, missing/incompatible selected CLI, and no unrelated probe/network/auto-install. Use deterministic stubs and a manual instruction check where no executable contract exists.

**Commit:** feat(p03-t04): guard declared skill and CLI prerequisites

## Phase p04: Documentation and Public Merge Milestone (2 tasks)

### Task p04-t01: Document installation, authoring, and migration contracts

**Files:** README.md, CONTRIBUTING.md, RELEASING.md, root AGENTS/CLAUDE contract as needed, documentation/docs/user-guide/installation.md and affected skill/consensus/session maps/pages, documentation/docs/engineering/repository-layout.md and affected architecture/contributing pages, documentation/index.md (generated), existing docs/layout checks.

**Implement:** Use oat-project-document and documentation/AGENTS.md, obtain its required concise recommendation approval, then update the maintained site and lean README. Explain multi-plugin and opt-in standalone patterns, short/full names, required versus shared-code dependencies, install links, clean-break renames without old-name support, source colocation/build declarations, generated outputs, independent plugin releases, and sole metadata.version policy. Document private-owner transitions and either/or installation guidance unless co-installation was actually verified.

Preserve authored Contents navigation, regenerate the Fumadocs index through its owner, and keep dated evidence in this project. Do not turn static output checks into claims of marketplace/live discovery or mature fork support.

**Format:** pnpm exec oxfmt --write on the explicit changed authored Markdown paths, excluding AGENTS/CLAUDE and generated documentation/index.md. Run oat docs generate-index --docs-dir docs --output index.md with cwd documentation.

**Verify:** pnpm exec vitest run tests/repo/docs-presence.test.ts tests/repo/readme-scope.test.ts tests/repo/layout.test.ts; pnpm run validate; pnpm --dir documentation run build. Validate local links for project and user/engineering Markdown through the existing validation surface, accounting for MDX syntax and external paths. Do not claim docs:lint (currently a no-op) is evidence.

**Commit:** docs(p04-t01): document multi-plugin and standalone skill ownership

### Task p04-t02: Verify the public milestone and prepare its reviewed PR

**Files:** Create validation.md in this project; update implementation.md and state.md with actual outcomes; narrow source/test fixes only through separately identified follow-up tasks when required.

**Implement:** Confirm all p01–p03/p04-t01 changes and declared outputs, source test migration completeness, transitive version guard/backlog closure, clean-break renames with no legacy support layer, and both plugins. Run one full closeout sweep and record static, isolated-artifact, behavioral, and live-release evidence separately. Apply complexity-review to the effective migration delta: remove duplicated test infrastructure and justify any new machinery by a real contract.

Run the required independent review of the whole public code delta and receive its findings before publication; root review alone is not final gate evidence. Use oat-project-pr-progress for the public milestone when publication is authorized. Project stays incomplete with p05 pending; get explicit merge approval. Missing live promotion/readiness evidence remains an honest release limitation or an authorization-bound blocker, never an inferred pass.

**Format:** Project-artifact formatter for validation.md, implementation.md and state.md; any review-driven code fixes use their new task's scoped formatter.

**Verify:** pnpm run validate:skill-versions -- --base-ref "$TASK_BASE_REF"; pnpm run type-check; pnpm run build:check (before any repair); pnpm run validate; pnpm run test; pnpm run smoke; pnpm run validate:internal-flags; git diff --check. Reuse p04-t01 docs build if its basis is unchanged. Capture isolated-artifact suite output and independent review disposition. No live/paid gate without explicit execution authorization.

**Commit:** docs(p04-t02): record public packaging migration verification

## Phase p05: Post-Merge Personal-Skills Cutover (1 task)

### Task p05-t01: Open the private authored-copy removal PR

**Prerequisite:** Public migration milestone is merged and its supported installation source is available. A proposed PR, local commit, or passing static test is not sufficient. Verify public source revisions before any removal.

**Files:** In a separately authorized visible personal-skills task/worktree: src/skills/complexity-review, src/skills/session-handoff and their generated personal payloads/declarations as applicable; external-skills.json and pinned source via existing lifecycle tooling if retained as personal distributions; affected ownership/install docs and promotion register. In this project: validation.md, implementation.md and state.md.

**Implement:** Read personal-skills AGENTS and author-skill first; inventory exact authored/generated/installed ownership and preserve active installations. Remove the private complexity-review authored copy in the requested separate PR, after preserving its newer content publicly. Include the session-handoff ownership cutover only within confirmed cross-repo execution authority; otherwise record the precise remaining transition and stop before claiming completion. Replace retained private distribution entries with supported public-source consumption using existing tooling, not hand-copied editable duplicates.

Regenerate affected payloads, update registry/docs, and use the private repository's version policy. Open and link the PR to the public change when executing the approved task. Do not merge it or run uninstall/global sync. Record a frozen transitional owner only while that PR is pending. If the prerequisite is not met, remain pending without retries or guessed cleanup targets.

**Format:** Use personal-skills' currently documented file-scoped pnpm exec oxfmt --write on changed authored TS/JSON/Markdown, excluding pristine imported snapshots and generated output; verify that command against its package/AGENTS at execution. Use the project-artifact formatter for public tracking files.

**Verify:** In personal-skills run its documented pnpm check and pnpm check:versions --base-ref "$TASK_BASE_REF" against that repository's actual PR base, with package/installer tests restricted to temporary destinations. Inspect the exact source removals and regenerated inventory; verify public source/version provenance and that active user installs are unchanged. gh pr view on both linked PRs records actual status, not assumed merge. Task acceptance is a correctly scoped open removal PR plus recorded disposition; its merge/install transition remains explicitly pending unless separately approved.

**Commit:** chore(p05-t01): consume public session and review skill owners (private repo); docs(p05-t01): record personal skill ownership PR (public project bookkeeping)

## Reviews

| Scope | Type | Status | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| p01 | code | pending | - | - | - | - | - |
| p02 | code | pending | - | - | - | - | - |
| final | code | pending | - | - | - | - | - |
| spec | artifact | pending | - | - | - | - | - |
| design | artifact | pending | - | - | - | - | - |
| plan | artifact | received | 2026-09-13 | - | - | - | - |
| p03 | code | pending | - | - | - | - | - |
| p04 | code | pending | - | - | - | - | - |
| p05 | code | pending | - | - | - | - | - |
| plan | artifact | received | 2026-09-13 | reviews/artifact-plan-review-2026-09-13T151722Z.md | - | - | - |

Existing scaffold rows are preserved. Spec is intentionally absent in quick mode; design approval for planning does not fabricate an independent review. p04's public milestone review is distinct from project-wide final review after post-merge follow-through. All gate results require actual recorded evidence.

### Plan Self-Review: 2026-09-13

Structured review completed: 0 Critical, 0 Important, 3 Medium, 0 Minor. No review artifact was written by the read-only reviewer. These are the original findings; the subsequent gate reviewed that task contract. See the current disposition below for the user's decisions. A threshold pass alone does not settle remaining findings or establish readiness.

- M1: Explicitly execute one real session-plugin entrypoint outside the checkout in p03-t01's existing packaging suite, closing the design's distinct-runtime-layout proof.
- M2: Assign CHANGELOG.md to p04-t01 with the existing changelog convention, formatting and verification.
- M3: Replace descriptive Format steps with runnable file-scoped commands; concretize inventory-dependent path lists at p01-t01 before those tasks start.

Reviewer dispatch (launcher-selected/config-declared; independent runtime identity not reported):

Dispatch: scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-reviewer-gpt-5-6-sol-high

Parent model/effort were unavailable as launcher evidence, so the exact-ceiling exception was used. Configured quick-start gate scope is legacy-plan-only; its command is preserved unchanged.

### Plan Gate: 2026-09-13

The configured Claude Fable gate passed its Important threshold: 0 Critical, 0 Important, 3 Medium, 3 Minor. The structured result is ok and receive-eligible, with matching project, run and configured invocation corroboration. The reviewer ran inline through the validated headless route and reported no nested reconnaissance. This is configured Fable invocation evidence, not independent runtime-model telemetry; automated diversity attribution reported unknown producer.

The active review above remains received, not fully consumed or clean-passed. Artifact edits require user confirmation under oat-project-review-receive. The initial proposed dispositions below are historical; the current user disposition supersedes them:

- Gate M1 / self-review M1 (Minor task scope): resolve in p03-t01 with one real session-plugin export smoke in the existing packaging suite; no extra matrix.
- Gate M2 / self-review M2 (Minor task scope): assign the existing CHANGELOG.md Unreleased record to p04-t01, with formatting and inspection.
- Gate M3 (Minor task scope): make compatibility aliases optional explicitly owned declaration entries, inheriting the canonical owner's version and generated-output validation. Preserve actual published old names/paths without creating another authored skill; define discovery/layout treatment in p01-t02 and p03-t01. This retains the accepted compatibility requirement rather than weakening it to docs-only redirects.
- Gate m1 (Negligible task scope): correct tests/transcript to tests/transcript-core and explicitly include tsconfig.json in the source-move task.
- Gate m2 (Negligible task scope): clarify the artifact-less self-review ledger convention; preserve both review events.
- Gate m3 / self-review M3 (Minor task scope): require p01-t01 to emit explicit per-task formatter path lists and make the formatting recipes directly runnable. This closes the same issue even though the two reviewers assigned different severities.

No new implementation tasks or source edits have been made. Keep plan readiness unset until the remaining review disposition is settled. The following user disposition supersedes the proposed automatic re-review/re-gate step for these bounded edits.

### Current User Disposition: 2026-09-13

- Gate M1 / self-review M1: resolve_in_artifact. User approved the single session-plugin test; p03-t01 now explicitly plans one outside-checkout export-transcript smoke inside the existing packaging suite. The test is planned, not implemented or run.
- Gate M3: rejected_with_rationale under the revised requirement. The user explicitly rejected backward compatibility as unnecessary complexity and overhead. Discovery, design, Product Contract and execution tasks now require a clean break, with no legacy aliases, redirects, wrappers or old entrypoints. The earlier finding was valid against the earlier requirement; that requirement has been removed rather than implemented with more machinery.
- Gate M2, m1, m2, m3 / self-review M2, M3: needs_user_direction. Changelog ownership and the previously proposed formatting/path/ledger cleanups remain unchanged; the user's latest message specifically approved the test and removed compatibility work, not these other edits. Do not silently mark them resolved or default-defer them.
- Re-execution: the user questioned the value of another gate for this change; the root agrees that this scope reduction and one explicit existing-suite smoke do not warrant another provider review. No reviewer or gate is launched for these edits, and no persistent gate configuration is disabled. The prior Fable threshold pass applies to the reviewed basis at 001af602, not the updated artifacts. These edits are user-directed and locally checked, not newly independently reviewed. Any later material expansion requires its own review judgment.

The active gate artifact remains in reviews/ while receipt is partial. Task count stays 14 and implementation remains unstarted.

## Implementation Complete

Not started.

| Phase | Tasks | Completed |
| --- | --- | --- |
| p01 Packaging foundation | 3 | 0 |
| p02 Source/tooling migration | 4 | 0 |
| p03 Products/promotions | 4 | 0 |
| p04 Public documentation/verification | 2 | 0 |
| p05 Post-merge private cutover | 1 | 0 |
| Total | 14 | 0 |

p01–p04 comprise the 13-task public milestone; p05 is one post-merge cross-repo task. Do not mark all 14 complete when the public PR is ready.

## References

- [Discovery](discovery.md)
- [Design](design.md)
- [Project state](state.md)
- [Issue #74](https://github.com/tkstang/skills/issues/74)
- BL-260723-guard-transitive-shared: Guard transitive shared-runtime skill version bumps
