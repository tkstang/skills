---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-09-13
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ["p05"]
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: false
---

# Implementation Plan: Skill Source Organization and Plugin Packaging

**Goal:** One authored owner per skill, explicit plugin/standalone payloads, agreed session names, public portable handoff promotion, and retirement of the private complexity-review owner.

**Architecture:** Extend the existing TypeScript/esbuild pipeline with declared installation units. Colocate authored skill content and owned tests under src/skills; keep genuine shared and plugin-level code separate. Generated payloads remain dependency-free Node ESM.

**Status:** Implementation-ready. The user accepted the design, activated this project after its predecessor merged, and approved the bounded review cleanups without another gate run. All findings are dispositioned below; the prior Fable threshold pass remains evidence for its original basis, not a fresh review of these edits. Implementation has not started; Sol will pick it up in a separate session.

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

**Inventory-dependent source paths:** p01-t01 must record per-task, shell-quoted authored file lists and complete formatter invocations in migration-inventory.md, especially for p02–p03 moves. Before starting each such task, copy its verified list into a task-local shell array named `task_format_paths` and replace that task's inventory-dependent Format command with the literal paths. Include directly affected tests/resources/configs; exclude deleted files, generated payloads, upstream mirrors and AGENTS/CLAUDE. Update the list for actual path drift before formatting. The non-empty guard below prevents an unpopulated array from formatting the repository root. This is ordinary task bookkeeping, not a new formatter or manifest system.

**Project-artifact formatting:** .oat is excluded from file-mode oxfmt. Load this shell function in the task terminal when a Format step calls it; it applies the existing stdin formatter only to the explicitly supplied files. Do not alter formatter config or create a repository helper for this recipe.

```bash
format_project_artifacts() {
  node --input-type=module -e '
    import { readFileSync, writeFileSync } from "node:fs";
    import { spawnSync } from "node:child_process";
    const paths = process.argv.slice(1);
    if (!paths.length) throw new Error("Explicit artifact paths required");
    for (const path of paths) {
      const source = readFileSync(path, "utf8");
      const result = spawnSync("pnpm", ["exec", "oxfmt", "--stdin-filepath", path], {
        input: source, encoding: "utf8"
      });
      if (result.status !== 0 || !result.stdout) throw new Error(result.stderr || "Formatting failed");
      if (source !== result.stdout) writeFileSync(path, result.stdout);
    }
  ' "$@"
}
```

Every task includes Format, Verify, and an atomic conventional commit. Stage only its owned paths. The explicit file sets below may grow only to directly affected imports/inventories identified during migration; record those additions. Documentation checks are not full runtime-suite gates.

## Parallelism

Sequential: p01 establishes build/version compatibility, p02 moves owners and removes the bridge, p03 changes shared distribution declarations, p04 verifies/documents those outputs, and p05 depends on the public merge. Adjacent phases share the builder/catalog, version consumers, generated outputs, or publication dependencies. Isolated parallel worktrees would increase merge risk rather than provide independent verification. Read-only bounded recon may run concurrently; no parallel implementation groups are declared.

## Phase p01: Packaging Foundation (3 tasks)

### Task p01-t01: Refresh baseline and lock the migration inventory

**Files:** Create migration-inventory.md in this project; update this plan only for verified path drift. Read issue #74, root AGENTS, current build/discovery/version tooling, all current canonical SKILL.md files, provider catalogs/manifests, install.sh, and personal-skills source/ownership declarations.

**Implement:** Verify the current handoff project's merge and active execution authority. Record actual base/head and a compact old-owner → new-owner → output/name/version map. Include skill-owned versus shared/plugin tests, executable/resource paths, references requiring the clean-break rename, existing consensus CLI entrypoints, and any retained experimental tooling under tools/coding-session-handoff. Do not inventory backward-compatibility obligations or design a legacy support layer. No code move yet. Confirm the source revisions and licenses for handoff and complexity-review. The inventory must cover every current product skill, not upstream OAT tooling.

Emit per-task explicit authored formatter path lists and complete command lines in migration-inventory.md, including p02–p03 destination paths and affected test/config/resource files. Replace inventory-dependent Format steps with those literal path lists before each task begins; do not require downstream agents to rediscover formatting syntax. The inventory remains Markdown bookkeeping, not a new executable manifest.

**Format:** `format_project_artifacts .oat/projects/shared/skill-source-organization/migration-inventory.md .oat/projects/shared/skill-source-organization/plan.md`.

**Verify:** git status --short; git merge-base HEAD "$TASK_BASE_REF"; gh pr view 70 --json state,mergedAt,mergeCommit; manually reconcile the inventory against scripts/lib/discover-skills.mjs and rg --files src skills plugins tests. Stop on unmapped owners, unmerged prerequisite, dirty overlap, or materially changed scope. GitHub status is evidence, not permission to merge.

**Commit:** docs(p01-t01): record verified skill migration inventory

### Task p01-t02: Add declared payload generation to the existing build pipeline

**Files:** Modify scripts/build-generated.mjs and package.json; create scripts/build-generated.ts and narrowly scoped scripts/lib/packaging.ts as the eventual owners, plus src/distributions.ts for target declarations; update pnpm-lock.yaml, tsconfig.json, vitest.config.mjs, tests/tooling/generated-output-sync.test.ts; add tests/tooling/skill-packaging.test.ts.

**Implement:** Port the affected build entrypoint to TS with developer-only tsx, retaining existing package commands and a narrow compatibility entrypoint only while existing consumers need it. Define one small declaration for source owner, optional standalone output, plugin membership/local name, and required/optional workflow references; executable skill build.json declares entrypoints only. Prompt-only skills require neither build.json nor empty src directories.

Implement installed-name/reference rendering with explicit slots, allowed-source ownership, bundler-derived closure, resource copying, executable bits, and complete-tree inventory comparison. Reject escaping/absolute/traversing sources, undeclared executables, source/test/build leakage, runtime dependencies, symlinks outside supported contracts, output collisions, invalid/missing/test entrypoints, duplicate output basenames, stale/missing/orphan output. Stage then validate before replacement; preserve prior output on build failure and recover/report a backup on replacement failure, including rollback failure. Check input consistency across the build. Never replace an entire partially owned plugin root.

Keep the legacy file table only as a bounded bridge for not-yet-moved owners; one command owns both paths, no duplicate writers. Add source test globs now so moved tests cannot disappear later. Prepare legacy-owner version mapping support without changing today's version policy.

**Format:** `pnpm exec oxfmt --write scripts/build-generated.ts scripts/lib/packaging.ts src/distributions.ts package.json tsconfig.json vitest.config.mjs tests/tooling/generated-output-sync.test.ts tests/tooling/skill-packaging.test.ts`. Append any additional changed authored callers/tests from this task's inventory as literal paths; exclude generated compatibility output and the lockfile.

**Verify:** pnpm exec vitest run tests/tooling/generated-output-sync.test.ts tests/tooling/skill-packaging.test.ts tests/tooling/vitest-config.test.ts; pnpm run type-check; pnpm run build:check. Existing output must remain fresh or be deliberately rebuilt/versioned. Reuse table-driven negative cases and a controlled replacement failure fixture; no second test harness.

**Commit:** feat(p01-t02): generate declared skill installation units safely

### Task p01-t03: Prove representative install boundaries before bulk moves

**Files:** Extend tests/tooling/skill-packaging.test.ts and existing tests/helpers only where reusable setup is absent; update build declarations/compatibility bridge only for fixture-exposed defects.

**Implement:** Test the new source layout in temporary fixture roots using current real skill/resource/runtime inputs: complexity-review (prompt-only), export (executable with shared transcript code), a standalone-configured consensus consumer requiring its helper/CLI closure, and the complete consensus plugin. Execute installed .mjs from outside the checkout with fake HOME, synthetic input, and deterministic provider stubs. Establish that multiple declared plugin units and target-local names are handled; p03 supplies the real session plugin. No legacy alias cases are required.

Assert no sibling-install/checkout imports, valid resource links, and full output containment. Keep cheap inventory checks separate from representative execution. A future new runtime boundary warrants another case, not another matrix dimension.

**Format:** `test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"`. Populate from p01-t01's p01-t03 list, including tests/tooling/skill-packaging.test.ts and only changed helper/builder sources; concretize before this task starts.

**Verify:** pnpm exec vitest run tests/tooling/skill-packaging.test.ts tests/consensus/install-contract.test.ts; pnpm run build:check. The temporary fixtures must exercise the new declaration pipeline, not merely the old committed outputs. No user installations change.

**Commit:** test(p01-t03): verify isolated skill and plugin payloads

## Phase p02: Canonical Source and Tooling Migration (4 tasks)

### Task p02-t01: Colocate standalone skill owners and their tests

**Files:** Move owned content from skills/session-observer, skills/session-observer-collab, skills/export-session-transcript, skills/coding-session-handoff, skills/complexity-review and corresponding src/transcript skill areas into src/skills/<owner>; move genuine src/transcript/core to src/shared/transcript; move associated tests/session-observer*, tests/transcript-core and handoff tests according to the inventory. Update tsconfig.json (including moved/removed declaration-file inputs), declarations, imports, affected test helper paths, and generated outputs.

**Implement:** Preserve behavior and installed legacy names during this move; p03 owns public renames. Port collab's authored .mjs/.d.ts runtime to TS, or document a narrow required declaration boundary with objective evidence. Keep plugin-independent transcript code shared. Retained experimental handoff gate/tools code stays a tooling owner, not secretly shipped inside the public guidance skill. Move existing tests without re-authoring fixtures. Bump changed owners and affected consumers under the current policy, retaining legacy version comparison.

**Format:** `test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"`. Use the p02-t01 authored destination/test/resource list plus tsconfig.json, concretized by p01-t01 before this task starts. Regenerate with `pnpm run build`.

**Verify:** pnpm exec vitest run src/skills/session-observer src/skills/session-observer-collab src/skills/export-session-transcript src/skills/coding-session-handoff src/shared/transcript tests/tooling/skill-packaging.test.ts; pnpm run type-check; pnpm run build:check; pnpm run validate. Reconcile source test counts/identities against the inventory so moved suites cannot silently stop running.

**Commit:** refactor(p02-t01): colocate standalone skill sources and tests

### Task p02-t02: Colocate consensus owners and plugin-level runtime

**Files:** Move plugins/consensus/skills authored resources and src/consensus skill-specific modules/tests to src/skills/<canonical-owner>; move non-skill provider CLI/core/config ownership to src/plugins/consensus and genuinely cross-product helpers to src/shared as justified by imports. Update tests/consensus owner paths, declarations, plugin-level source manifests, consumers and generated outputs.

**Implement:** Keep all existing consensus plugin-local names and complete-plugin install paths. Do not force the consensus CLI/core into an arbitrary skill or duplicate it per plugin skill when plugin-local sharing works. Assign unambiguous canonical identities in the inventory without renaming unrelated user-facing skills. Preserve provider adapters, subprocess/permission boundaries, recovery installer semantics, fixtures, and output behavior. Remove migrated legacy output mappings; bump all affected owners.

**Format:** `test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"`. Use the p02-t02 authored destination/resource/manifest/test list, concretized by p01-t01 before this task starts. Run `pnpm run build` for generated outputs.

**Verify:** pnpm exec vitest run src/skills src/plugins/consensus src/shared tests/consensus/install-contract.test.ts tests/consensus/install-sh.test.ts tests/tooling/skill-packaging.test.ts; pnpm run type-check; pnpm run build:check; pnpm run smoke. This is the one broad source migration check, not a requirement to rerun all tests for each moved file.

**Commit:** refactor(p02-t02): colocate consensus skills and plugin runtime

### Task p02-t03: Switch canonical discovery and version ownership atomically

**Files:** scripts/lib/discover-skills.mjs and scripts/lib/skill-frontmatter.mjs to TS owners; scripts/validate-skill-versions.mjs, scripts/bump-version.mjs, scripts/validate.mjs to TS owners; src/distributions.ts and migration baseline mapping; canonical SKILL.md metadata; tests/release/skill-version-bumps.test.ts, tests/release/versioning.test.ts, tests/release/validate-script.test.ts, tests/repo/skill-frontmatter.test.ts; related package entrypoints. Close BL-260723-guard-transitive-shared in this same implementation commit using .oat/repo/pjm/AGENTS.md.

**Implement:** Make src/skills the authored discovery root and generated outputs derivative. Switch source/validators/release tooling together to quoted stable metadata.version only. Legacy comparison readers may accept old fields; reject new root version/meta.version and reconcile conflicting historical values. Moves/renames preserve identity rather than becoming “new.”

Derive affected skill owners from actual runtime closure, including plugin-shared output changes. Enforce strict increases for authored code/tests/resources/deletions and changed payloads, including local staged/unstaged/untracked edits. Distinguish new/removed owners; reject ownerless generated output and unresolved explicit bases. Root-only docs/tooling do not bump unrelated skills unless output changes.

Make plugin release selection explicit and target-scoped; session/consensus versions are independent of each other and skill versions. Preserve current manifest/catalog consistency and tag checks. Use one legacy map, not permanent dual source authority.

**Format:** `test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"`. Use the p02-t03 authored TS/test/SKILL.md/package list, concretized by p01-t01 before this task starts. Format the exact authored backlog files with `format_project_artifacts "${task_backlog_paths[@]}"` after assigning their concrete non-generated paths during the backlog lifecycle step. Do not format generated indexes or AGENTS. Run `pnpm run build`.

**Verify:** pnpm exec vitest run tests/release/skill-version-bumps.test.ts tests/release/versioning.test.ts tests/release/validate-script.test.ts tests/repo/skill-frontmatter.test.ts; pnpm run validate:skill-versions -- --base-ref "$TASK_BASE_REF"; pnpm run validate; pnpm run build:check. Fixtures cover renamed-owner baseline, the observed transitive missed-bump case, local edit states, nonstable/regressed versions, missing/shallow base, and one-plugin release isolation. Reuse existing fixtures rather than duplicate each scenario by owner.

**Commit:** feat(p02-t03): enforce canonical skill and independent plugin versions

### Task p02-t04: Finish existing CI and repository-tooling migration

**Files:** package.json, pnpm-lock.yaml, scripts/smoke-test.mjs and affected compatibility/tooling callers, scripts/sync-transcript-core.mjs, .github/workflows/validate.yml and release callers, .lintstagedrc.mjs, .oxlintrc.json, .oxfmtrc.json, vitest.config.mjs, tools/git-hooks affected callers, tests/tooling/generated-output-sync.test.ts, tests/tooling/git-hooks.test.ts, tests/tooling/vitest-config.test.ts, tests/release/smoke-test-script.test.ts.

**Implement:** Port only affected repository-owned tooling to TS/tsx and preserve established command names. Remove the obsolete file-by-file mapping bridge after all owners are migrated. Derive output inventories/exclusions from declared targets where formats permit; retain parity guards for static config lists. Include authored TS/colocated tests in lint and Vitest selection, with generated/upstream/instruction exclusions.

CI checks committed freshness without first repairing it, resolves the actual PR base/head/merge-base with sufficient history, fails on ambiguous/missing history, and reruns version comparison on base changes. Preserve pinned actions, frozen lockfile installs, read-only permissions, safe checkout credentials, and separate docs/release/live workflows. Avoid duplicate full builds. Keep optional hooks as consumers, not new authoritative infrastructure.

**Format:** `test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"`. Use the p02-t04 authored tooling/config/test list, concretized by p01-t01 before this task starts. YAML, generated outputs and instruction files remain excluded; inspect `git diff --check`. Regenerate outputs only with `pnpm run build`.

**Verify:** pnpm exec vitest run tests/tooling/generated-output-sync.test.ts tests/tooling/git-hooks.test.ts tests/tooling/vitest-config.test.ts tests/release/smoke-test-script.test.ts; pnpm run build:check; pnpm run type-check; pnpm run validate:internal-flags. A temporary stale/orphan fixture must fail before any rebuild; inspect changed-file selectors and base-change rerun coverage. Do not alter live hooks or user installs to prove behavior.

**Commit:** build(p02-t04): align existing checks with authored skill ownership

## Phase p03: Product Names, Plugin Groupings, and Promotions (4 tasks)

### Task p03-t01: Generate the session plugin and configured standalone forms

**Files:** src/distributions.ts; src/plugins/session provider/plugin metadata; src/plugins/consensus metadata; canonical renamed src/skills/session-export-transcript and src/skills/session-fork-to-destination; observer/collab instructions/resource references; root marketplace/catalog manifests; pinned recovery install contract if affected; tests/repo/layout.test.ts, tests/repo/plugin-manifests.test.ts, tests/repo/marketplace-manifests.test.ts, tests/consensus/install-sh.test.ts, tests/tooling/skill-packaging.test.ts.

**Implement:** Apply the Product Contract table. Observer/collab keep session- standalone names and join consensus; export/fork join session while remaining standalone. Existing consensus names stay unchanged. Rewrite only explicit target references, not ordinary prose. Preserve experimental status and the current merged fork guidance behavior.

Make the export/fork renames a clean break: remove superseded generated product paths through the builder's owned-output replacement, update maintained references and document the new names. Do not preserve old script entrypoints or generate legacy aliases/redirects/wrappers. Add both plugins to supported manifest/catalog surfaces and ensure release tooling has no consensus-only assumptions. Keep standalone eligibility opt-in but demonstrate one real consensus consumer can be configured without bespoke build code.

**Format:** `test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"`. Use the p03-t01 authored catalog/skill/resource/manifest/test list, concretized by p01-t01 before this task starts. Run `pnpm run build`.

**Verify:** pnpm exec vitest run tests/repo/layout.test.ts tests/repo/plugin-manifests.test.ts tests/repo/marketplace-manifests.test.ts tests/release/versioning.test.ts tests/consensus/install-sh.test.ts tests/tooling/skill-packaging.test.ts; pnpm run validate; pnpm run build:check. Extend the existing packaging suite with one real session-plugin export-transcript execution from a temporary installation outside the checkout, using fake HOME/config and synthetic input. Verify installed resources resolve without checkout or sibling-install imports; use deterministic provider stubs only if needed, never a live provider. Inspect all target names/resources and both complete-plugin inventories, including absence of superseded old-name product outputs. Preserve the pinned recovery installer behavior; do not infer live provider discovery from static success.

**Commit:** feat(p03-t01): group session operations and generate standalone forms

### Task p03-t02: Promote portable session-handoff without adding an engine

**Files:** Create src/skills/session-handoff/SKILL.md and assets/handoff-template.md from the verified personal-skills authored source; update src/distributions.ts, relevant source resources and existing layout/frontmatter/packaging fixtures.

**Implement:** Use personal-skills 1.1.0 at 80a5a76de093f812776efb5c90bdc40504dbedfb as the planning baseline, rechecking actual source/history at execution. Preserve source provenance, author/license, read-only inspection, acceptance/authorization boundaries, bounded evidence, and optional sanitized transcript behavior. No runtime/build.json for this two-file prompt-only skill. Generate standalone session-handoff and session:handoff, with renamed export and observer references resolved appropriately.

Do not implement research-backed evidence enrichment or issue #75 own-session review. Inspect public safety and carry existing promotion-readiness gaps into validation rather than declaring behavioral acceptance from packaging.

**Format:** `pnpm exec oxfmt --write src/skills/session-handoff/SKILL.md src/skills/session-handoff/assets/handoff-template.md src/distributions.ts`. Append this task's actual edited fixture paths from the inventory as literal arguments. Run `pnpm run build`.

**Verify:** pnpm exec vitest run tests/repo/layout.test.ts tests/repo/skill-frontmatter.test.ts tests/tooling/skill-packaging.test.ts; pnpm run validate; manually compare source/resources to the pinned personal baseline and inspect optional-integration/authorization behavior. Synthetic/manual examples suffice; no paid provider run or new evaluator.

**Commit:** feat(p03-t02): promote portable session handoff

### Task p03-t03: Bring the newer complexity-review content into the public owner

**Files:** src/skills/complexity-review/SKILL.md and references/evidence-guide.md, source provenance in migration-inventory.md, existing packaging fixtures only if necessary.

**Implement:** Bring the newer personal-skills 1.0.2 content, including authorization safeguards, provider-neutral invocation, and conditional evidence-guide loading, into the public canonical owner. Verify the source revision and compare complete resources, not just version numbers. Preserve attribution and choose a valid increased version consistent with the public baseline and current policy. Remain standalone and prompt-only; do not add runtime or speculative tests.

**Format:** `pnpm exec oxfmt --write src/skills/complexity-review/SKILL.md src/skills/complexity-review/references/evidence-guide.md`; `format_project_artifacts .oat/projects/shared/skill-source-organization/migration-inventory.md`. Append any actual edited fixture paths as literal arguments to the source formatter. Run `pnpm run build`.

**Verify:** pnpm exec vitest run tests/repo/skill-frontmatter.test.ts tests/tooling/skill-packaging.test.ts; pnpm run validate; pnpm run validate:skill-versions -- --base-ref "$TASK_BASE_REF"; manually inspect the intended source delta and installed reference resolution. Record public ownership and p05 dependency.

**Commit:** feat(p03-t03): upstream newer complexity review guidance

### Task p03-t04: Make skill prerequisites and selected CLI preflight explicit

**Files:** Canonical observer-collab, observer, handoff and CLI-backed consensus SKILL.md/resources; narrow existing CLI availability helpers under src/plugins/consensus or src/shared; distribution dependency declarations; tests/tooling/skill-packaging.test.ts and existing owner-level preflight tests.

**Implement:** Before dependent work, resolve required skill workflows through supported host inventory/installed contract, accepting documented standalone or plugin forms. Missing observer stops collab with the canonical name and maintained install link; optional observer/export absence does not block handoff. No automatic install, workflow duplication, or universal host registry.

CLI-backed operations resolve installed helper paths, reliable minimum versions and operation-specific capabilities before work. Scope checks to the selected provider; no unrelated authentication probes or mandatory network. Known-newer compatible update advice may use existing evidence only, with no new updater/cache service. Prefer prose guards for prose workflows and small helper reuse for executable consumers.

**Format:** `test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"`. Use the p03-t04 affected authored SKILL.md/resource/helper/test list, concretized by p01-t01 before this task starts. Run `pnpm run build`.

**Verify:** pnpm exec vitest run tests/tooling/skill-packaging.test.ts and the exact owner-level preflight test files identified in the inventory; pnpm run validate; pnpm run build:check. Cover present/missing required skill in supported forms, absent optional integrations, missing/incompatible selected CLI, and no unrelated probe/network/auto-install. Use deterministic stubs and a manual instruction check where no executable contract exists.

**Commit:** feat(p03-t04): guard declared skill and CLI prerequisites

## Phase p04: Documentation and Public Merge Milestone (2 tasks)

### Task p04-t01: Document installation, authoring, and migration contracts

**Files:** README.md, CONTRIBUTING.md, RELEASING.md, CHANGELOG.md, root AGENTS/CLAUDE contract as needed, documentation/docs/user-guide/installation.md and affected skill/consensus/session maps/pages, documentation/docs/engineering/repository-layout.md and affected architecture/contributing pages, documentation/index.md (generated), existing docs/layout checks.

**Implement:** Use oat-project-document and documentation/AGENTS.md, obtain its required concise recommendation approval, then update the maintained site and lean README. Explain multi-plugin and opt-in standalone patterns, short/full names, required versus shared-code dependencies, install links, clean-break renames without old-name support, source colocation/build declarations, generated outputs, independent plugin releases, and sole metadata.version policy. Document private-owner transitions and either/or installation guidance unless co-installation was actually verified.

Preserve authored Contents navigation, regenerate the Fumadocs index through its owner, and keep dated evidence in this project. Do not turn static output checks into claims of marketplace/live discovery or mature fork support.

Update CHANGELOG.md's existing Unreleased section for the session plugin, clean-break skill renames, session-handoff promotion, newer complexity-review content, and sole metadata.version policy. Reconcile the entries against the final provider manifests and actual implemented changes; do not invent release dates or published versions.

**Format:** `pnpm exec oxfmt --write README.md CONTRIBUTING.md RELEASING.md CHANGELOG.md documentation/docs/user-guide/installation.md documentation/docs/engineering/repository-layout.md`. Append the other exact authored paths approved by oat-project-document before execution; exclude AGENTS/CLAUDE and generated documentation/index.md. Run `(cd documentation && oat docs generate-index --docs-dir docs --output index.md)`.

**Verify:** pnpm exec vitest run tests/repo/docs-presence.test.ts tests/repo/readme-scope.test.ts tests/repo/layout.test.ts; pnpm run validate; pnpm --dir documentation run build. Inspect `git diff -- CHANGELOG.md` for the five named changes against actual source/manifests; no new prose-locking test is required. Validate local links for project and user/engineering Markdown through the existing validation surface, accounting for MDX syntax and external paths. Do not claim docs:lint (currently a no-op) is evidence.

**Commit:** docs(p04-t01): document multi-plugin and standalone skill ownership

### Task p04-t02: Verify the public milestone and prepare its reviewed PR

**Files:** Create validation.md in this project; update implementation.md and state.md with actual outcomes; narrow source/test fixes only through separately identified follow-up tasks when required.

**Implement:** Confirm all p01–p03/p04-t01 changes and declared outputs, source test migration completeness, transitive version guard/backlog closure, clean-break renames with no legacy support layer, and both plugins. Run one full closeout sweep and record static, isolated-artifact, behavioral, and live-release evidence separately. Apply complexity-review to the effective migration delta: remove duplicated test infrastructure and justify any new machinery by a real contract.

Run the required independent review of the whole public code delta and receive its findings before publication; root review alone is not final gate evidence. Use oat-project-pr-progress for the public milestone when publication is authorized. Project stays incomplete with p05 pending; get explicit merge approval. Missing live promotion/readiness evidence remains an honest release limitation or an authorization-bound blocker, never an inferred pass.

**Format:** `format_project_artifacts .oat/projects/shared/skill-source-organization/validation.md .oat/projects/shared/skill-source-organization/implementation.md .oat/projects/shared/skill-source-organization/state.md`. Any review-driven code fixes use their new task's scoped formatter.

**Verify:** pnpm run validate:skill-versions -- --base-ref "$TASK_BASE_REF"; pnpm run type-check; pnpm run build:check (before any repair); pnpm run validate; pnpm run test; pnpm run smoke; pnpm run validate:internal-flags; git diff --check. Reuse p04-t01 docs build if its basis is unchanged. Capture isolated-artifact suite output and independent review disposition. No live/paid gate without explicit execution authorization.

**Commit:** docs(p04-t02): record public packaging migration verification

## Phase p05: Post-Merge Personal-Skills Cutover (1 task)

### Task p05-t01: Open the private authored-copy removal PR

**Prerequisite:** Public migration milestone is merged and its supported installation source is available. A proposed PR, local commit, or passing static test is not sufficient. Verify public source revisions before any removal.

**Files:** In a separately authorized visible personal-skills task/worktree: src/skills/complexity-review, src/skills/session-handoff and their generated personal payloads/declarations as applicable; external-skills.json and pinned source via existing lifecycle tooling if retained as personal distributions; affected ownership/install docs and promotion register. In this project: validation.md, implementation.md and state.md.

**Implement:** Read personal-skills AGENTS and author-skill first; inventory exact authored/generated/installed ownership and preserve active installations. Remove the private complexity-review authored copy in the requested separate PR, after preserving its newer content publicly. Include the session-handoff ownership cutover only within confirmed cross-repo execution authority; otherwise record the precise remaining transition and stop before claiming completion. Replace retained private distribution entries with supported public-source consumption using existing tooling, not hand-copied editable duplicates.

Regenerate affected payloads, update registry/docs, and use the private repository's version policy. Open and link the PR to the public change when executing the approved task. Do not merge it or run uninstall/global sync. Record a frozen transitional owner only while that PR is pending. If the prerequisite is not met, remain pending without retries or guessed cleanup targets.

**Format:** In the authorized private worktree, assign `task_format_paths` to the exact changed authored TS/JSON/Markdown paths from its refreshed inventory, excluding pristine snapshots, deleted files and generated output; verify the currently documented formatter there, then run `test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"`. Back in this public worktree, run `format_project_artifacts .oat/projects/shared/skill-source-organization/validation.md .oat/projects/shared/skill-source-organization/implementation.md .oat/projects/shared/skill-source-organization/state.md`.

**Verify:** In personal-skills run its documented pnpm check and pnpm check:versions --base-ref "$TASK_BASE_REF" against that repository's actual PR base, with package/installer tests restricted to temporary destinations. Inspect the exact source removals and regenerated inventory; verify public source/version provenance and that active user installs are unchanged. gh pr view on both linked PRs records actual status, not assumed merge. Task acceptance is a correctly scoped open removal PR plus recorded disposition; its merge/install transition remains explicitly pending unless separately approved.

**Commit:** chore(p05-t01): consume public session and review skill owners (private repo); docs(p05-t01): record personal skill ownership PR (public project bookkeeping)

## Reviews

| Scope | Type | Status | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| p01 | code | fixes_completed | 2026-09-13 | reviews/p01-review-2026-09-13T164437Z.md | fa4e6256d63af58806c4ef273d7700af1af21534 | manual | - |
| p01 | code | fixes_completed | 2026-09-13 | reviews/p01-review-2026-09-13T165921Z.md | c14f9d524554f49f01080f3e9502696b9b3a19a3 | manual | - |
| p01 | code | fixes_completed | 2026-09-13 | reviews/p01-review-2026-09-13T172248Z.md | 737e7c06041f7344bf8eeed0cfbc4b79877c72f8 | manual | - |
| p02 | code | fixes_completed | 2026-09-13 | reviews/p02-review-2026-09-13T202600Z.md | a2014e9b8641cf0af03fe89eb634494614874260 | manual | - |
| p02 | code | fixes_completed | 2026-09-13 | reviews/p02-review-2026-09-13T204639Z.md | 1f78d3c9619d4a940acac8e61f1fcb70fe3719e8 | manual | - |
| p02 | code | passed | 2026-09-13 | reviews/p02-review-2026-09-13T210441Z.md | 9104c37597c8b7fa452ef1aeadaf48e153e1a210 | manual | - |
| final | code | pending | - | - | - | - | - |
| spec | artifact | pending | - | - | - | - | - |
| design | artifact | pending | - | - | - | - | - |
| plan | artifact | fixes_completed | 2026-09-13 | - | - | - | - |
| p03 | code | fixes_completed | 2026-09-13 | reviews/p03-review-2026-09-13T215053Z.md | 0a8f3b9e1e8bbd92f720cefb0663f4c39928ef86 | manual | - |
| p03 | code | passed | 2026-09-13 | reviews/p03-review-2026-09-13T222103Z.md | de269575225719185ac456f1e8fcac1dde8ea0b5 | manual | - |
| p04 | code | fixes_completed | 2026-09-14 | reviews/p04-review-2026-09-14T002632Z.md | 0055176770dc0e869fa952978faf5832cba7c1c4 | manual | - |
| p04 | code | fixes_completed | 2026-09-14 | reviews/p04-review-2026-09-14T004843Z.md | fb10094dcdcbe7eadefe62cc4b9973aa02a20c7a | manual | - |
| p05 | code | pending | - | - | - | - | - |
| plan | artifact | fixes_completed | 2026-09-13 | reviews/archived/artifact-plan-review-2026-09-13T151722Z.md | - | - | - |

Existing scaffold rows are preserved. Spec is intentionally absent in quick mode; design approval for planning does not fabricate an independent review. p04's public milestone review is distinct from project-wide final review after post-merge follow-through. All gate results require actual recorded evidence.

The plan event with Artifact `-` intentionally records the structured, artifact-less self-review; its findings and dispatch stamp are below. It is not evidence of a missing file. The second plan event is the separate artifact-backed Fable gate. Both use fixes_completed to preserve the distinction between applied/dispositioned findings and a fresh clean reviewer pass. The user accepted these bounded changes without a rerun and authorized implementation readiness; no unresolved findings remain.

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

The review above is now consumed and archived, with applied/dispositioned findings rather than a new clean reviewer pass. The initial proposed dispositions below are historical; the current user disposition supersedes them:

- Gate M1 / self-review M1 (Minor task scope): resolve in p03-t01 with one real session-plugin export smoke in the existing packaging suite; no extra matrix.
- Gate M2 / self-review M2 (Minor task scope): assign the existing CHANGELOG.md Unreleased record to p04-t01, with formatting and inspection.
- Gate M3 (Minor task scope): make compatibility aliases optional explicitly owned declaration entries, inheriting the canonical owner's version and generated-output validation. Preserve actual published old names/paths without creating another authored skill; define discovery/layout treatment in p01-t02 and p03-t01. This retains the accepted compatibility requirement rather than weakening it to docs-only redirects.
- Gate m1 (Negligible task scope): correct tests/transcript to tests/transcript-core and explicitly include tsconfig.json in the source-move task.
- Gate m2 (Negligible task scope): clarify the artifact-less self-review ledger convention; preserve both review events.
- Gate m3 / self-review M3 (Minor task scope): require p01-t01 to emit explicit per-task formatter path lists and make the formatting recipes directly runnable. This closes the same issue even though the two reviewers assigned different severities.

No new implementation tasks or source edits have been made. Review disposition is complete. The following user disposition supersedes the proposed automatic re-review/re-gate step for these bounded edits.

### Current User Disposition: 2026-09-13

- Gate M1 / self-review M1: resolve_in_artifact. User approved the single session-plugin test; p03-t01 now explicitly plans one outside-checkout export-transcript smoke inside the existing packaging suite. The test is planned, not implemented or run.
- Gate M3: rejected_with_rationale under the revised requirement. The user explicitly rejected backward compatibility as unnecessary complexity and overhead. Discovery, design, Product Contract and execution tasks now require a clean break, with no legacy aliases, redirects, wrappers or old entrypoints. The earlier finding was valid against the earlier requirement; that requirement has been removed rather than implemented with more machinery.
- Gate M2 / self-review M2: resolve_in_artifact. User approved the remaining cleanup; p04-t01 now owns CHANGELOG.md's Unreleased entries, scoped formatting and manual comparison against actual source/manifests.
- Gate m1: resolve_in_artifact. p02-t01 now names tests/transcript-core and owns tsconfig.json declaration-input updates.
- Gate m2: resolve_in_artifact. The ledger prose explicitly explains the artifact-less self-review event and preserves it separately from the artifact-backed gate event.
- Gate m3 / self-review M3: resolve_in_artifact. p01-t01 explicitly supplies per-task formatter path lists and concrete invocations; Format steps use exact known paths or guarded task-local lists to be concretized before execution. A documented stdin-format/apply recipe covers project Markdown without adding a helper subsystem.
- Re-execution: the user approved all remaining cleanups after the root recommended applying them without another gate, then explicitly requested implementation readiness for Sol's separate session. No reviewer or gate is launched for these edits, and no persistent gate configuration is disabled. The prior Fable threshold pass applies to the reviewed basis at 001af602, not the updated artifacts. These edits are user-approved and locally checked, not newly independently reviewed. Any later material expansion requires its own review judgment.

The consumed gate artifact is archived at reviews/archived/artifact-plan-review-2026-09-13T151722Z.md. Receipt is complete; no findings are deferred or awaiting direction. Task count stays 14 and implementation remains unstarted. Planning readiness is approved; implementation kickoff must still confirm HiLL checkpoints, refresh the actual source/base inventory, and honor the public/private milestone authority boundaries.

## Implementation Progress

p01 is complete by user-authorized direct disposition after the review-cycle cap. Commit `684d4f8d19187e197e7b54c561f179e87fd4e917` fixes the final symlink-freshness finding, and the user explicitly waived another independent review cycle. Root verification passed before advancing to p02.

| Phase | Tasks | Completed |
| --- | --- | --- |
| p01 Packaging foundation | 3 | 3 |
| p02 Source/tooling migration | 4 | 4 |
| p03 Products/promotions | 4 | 4 |
| p04 Public documentation/verification | 2 | 2 |
| p05 Post-merge private cutover | 1 | 0 |
| Total | 14 | 13 |

p01–p04 comprise the 13-task public milestone; p05 is one post-merge cross-repo task. Do not mark all 14 complete when the public PR is ready.

### P04 Review Cycle 1 Fix Register: 2026-09-14

Independent whole-public-delta review at `0055176770dc0e869fa952978faf5832cba7c1c4` found 0 Critical, 2 Important, 1 Medium, and 0 Minor findings. Root disposition accepts all three findings for the bounded p04 fix loop:

- **I1 — active maintenance and release references:** update current contributor, scoped-agent, release, compatibility, test, and consensus manifest descriptions to the final colocated owners and nine-skill inventory. Preserve old paths only in historical records and the version baseline.
- **I2 — plan progress ledger:** resolved in this receipt by aligning p04 to 2/2 and the project to 13/14 while p05 remains pending.
- **M1 — custom-root generated-output check:** pass the resolved fixture root into declared-distribution checking and add a nonempty custom-root regression that proves clean plus stale, missing, and orphaned fixture behavior.

I1 and M1 are code/documentation fixes owned by the p04 phase implementer. After focused and full verification, run a fresh independent p04 review against the changed head before publication.

### P04 Review Cycle 2 Fix Register: 2026-09-14

Fresh whole-public-delta review at `fb10094dcdcbe7eadefe62cc4b9973aa02a20c7a` confirmed cycle-one I2 and M1 closed, then found 0 Critical, 1 Important, 0 Medium, and 1 Minor finding. Root accepts both for the second and final automatic p04 fix iteration:

- **I1 — remaining maintained-reference drift:** update the root internal-flag runbook and contributor hooks page to the runnable TypeScript command, align session-observer test ownership, rename the public guidance skill in the experimental tool README while preserving the tool command, and extend the existing maintained-path regression across these surfaces.
- **m1 — validation basis:** refresh `validation.md` to the current post-fix head/evidence, including 1,988 tests and the 50-case review-fix suite, so publication review cannot mistake the earlier totals for the current basis.

Run focused and full verification, then a third independent p04 review against the changed head. That review is the phase's final automatic review cycle.

## References

- [Discovery](discovery.md)
- [Design](design.md)
- [Project state](state.md)
- [Issue #74](https://github.com/tkstang/skills/issues/74)
- BL-260723-guard-transitive-shared: Guard transitive shared-runtime skill version bumps
