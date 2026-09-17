---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-09-17
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ["p01"]
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: false
---

# Implementation Plan: first-party-standalone-installer

> Execute this plan using `oat-project-implement`.

**Goal:** Add a dependency-free first-party command that installs a generated standalone skill from an exact tag into an explicit host and explicit project or user scope while preserving the existing Consensus recovery installer.

**Architecture:** `install.sh` dispatches zero arguments to the unchanged Consensus path and standalone flags to an adjacent dependency-free Node.js 22 helper. The helper adapts the proven `personal-skills` pinned-Git, inventory, explicit-destination, and injectable-filesystem patterns: it scrubs inherited `GIT_*`, reads one generated payload from an exact tag in a private bare repository, resolves the selected host/scope destination, reserves it exclusively, writes without overwrite-capable operations, verifies the inventory, and prints the host invocation.

**Tech Stack:** Bash, Git, Node.js 22 standard library, Vitest, temporary local Git fixtures, Fumadocs Markdown.

**Commit Convention:** `{type}({scope}): {description}`

## Parallelism

The plan is sequential (`oat_plan_parallel_groups: []`). Installer behavior, its compatibility contract, and the user/release documentation describe one shared CLI boundary. Documentation depends on the finalized command, while final verification and backlog disposition depend on both prior tasks.

## Phase 1: Implement and verify the first-party installer

### Task p01-t01: Adapt the proven installer core for public standalone installs

**Files:**

- Modify: `install.sh`
- Create: `scripts/install-standalone.mjs`
- Modify: `src/plugins/consensus/install-sh.test.ts`
- Create: `tests/tooling/standalone-installer.test.ts`

**Step 1: Read implementation contracts and establish the baseline**

Read `src/AGENTS.md` and `documentation/docs/engineering/architecture/generated-runtime.md` before changing shipped or build-adjacent code. Use these prior-art sources as design references, not runtime dependencies:

- `tkstang/personal-skills` `scripts/install.ts`
- `tkstang/personal-skills` `scripts/external/git-source.ts`
- `tkstang/personal-skills` `tests/install.test.ts`

Run: `pnpm run build:check`

Expected: Generated installation units are in sync before source work begins.

Run: `pnpm run test:vitest src/plugins/consensus/install-sh.test.ts src/plugins/consensus/install-contract.test.ts`

Expected: Existing Consensus installer behavior is green before the additive change.

**Step 2: Write proportional failing tests**

Use temporary project roots, temporary `HOME` directories, and temporary local Git repositories. Exercise the real `install.sh` process for CLI behavior and exported helper functions for the single injected filesystem failure.

Cover these coherent groups, using tables instead of bespoke process harnesses:

- required `--skill`, `--agent`, `--scope`, and `--ref` parsing, plus help and representative invalid/missing values;
- Codex, Claude Code, and Cursor destination/invocation mappings at both project and user scope, with user tests confined to a temporary `HOME`;
- complete multi-file payload bytes and executable-mode preservation;
- missing tag, branch-only ref, missing generated skill, `src/skills`-only fixture, malformed name, unsupported host/scope, unsafe Git entry, and reserved marker refusal;
- one annotated tag sharing a name with a different branch, proving the fully qualified tag wins;
- inherited `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and representative `GIT_CONFIG_*` decoys, proving the intended private repository is used and the decoy is unchanged;
- an existing destination preserved byte-for-byte and one symlinked-ancestor refusal;
- one programmatically injected mid-write failure leaving `.standalone-install-incomplete` in the new destination;
- standalone flags applied to an isolated `install.sh` with no adjacent helper, requiring checkout guidance and no destination mutation;
- zero-argument Consensus compatibility through the existing focused suite.

Do not add real-process race checkpoints, timed handshakes, FIFO/special-file collision permutations, or destination-replacement fixtures.

Run: `pnpm run test:vitest tests/tooling/standalone-installer.test.ts src/plugins/consensus/install-sh.test.ts`

Expected: New standalone cases fail for missing behavior while legacy cases remain green.

**Step 3: Implement the dependency-free public delta**

- Dispatch no arguments to the existing Consensus path and delegate standalone arguments to `scripts/install-standalone.mjs` through Node.js 22.
- Require explicit `--skill`, `--agent`, `--scope <project|user>`, and `--ref`; accept optional `--repository`; validate all inputs before destination mutation.
- When standalone flags are present but the adjacent helper is missing, fail with `install.sh:` checkout guidance before creating destination directories.
- Build every Git subprocess environment by dropping all inherited keys with the `GIT_` prefix, then add deliberate noninteractive controls.
- In a private bare repository, fetch only `refs/tags/<ref>` from `https://github.com/tkstang/skills.git` or the explicit repository override, peel `FETCH_HEAD^{commit}`, and read only `skills/<name>/` with `git ls-tree` and `git cat-file`.
- Require `SKILL.md`; accept only safe relative paths and regular-file modes `100644` or `100755`; reject symlinks, gitlinks, unsupported modes, and `.standalone-install-incomplete`.
- Record a deterministic inventory of relative path, executable mode, and SHA-256 bytes.
- Resolve project scope beneath the physical current directory and user scope beneath `HOME`; map the selected host to `.agents/skills`, `.claude/skills`, or `.cursor/skills`. Do not create provider mirrors or run `oat sync`.
- Validate/create the provider parent chain one real directory at a time after source validation. Refuse symlinked ancestors and any existing final destination.
- Reserve the final destination with exclusive `mkdir`, write `.standalone-install-incomplete`, create payload directories parent-first, and create files through held Node `wx` descriptors before applying modes.
- Re-inventory the destination while excluding only the marker. Remove the marker and report the selected tag, scope, verified path, and invocation only after exact equality succeeds.
- Export a small `fileOperations` object for direct failure injection. Do not expose environment-driven test hooks or wait protocols.
- On post-reservation failure, retain the marked partial destination, report its exact path, and clean only the private Git repository.

**Step 4: Format and verify**

Run: `pnpm exec oxfmt --write scripts/install-standalone.mjs src/plugins/consensus/install-sh.test.ts tests/tooling/standalone-installer.test.ts`

For `install.sh`, warn once with `no format command discovered in repo instructions; skipping`, then preserve the existing shell style manually.

Run: `pnpm run test:vitest tests/tooling/standalone-installer.test.ts src/plugins/consensus/install-sh.test.ts src/plugins/consensus/install-contract.test.ts`

Expected: Standalone and legacy installer cases pass without network access or real user-home mutation.

Run: `pnpm run type-check`

Expected: TypeScript checks pass.

Run: `pnpm exec oxlint scripts/install-standalone.mjs tests/tooling/standalone-installer.test.ts src/plugins/consensus/install-sh.test.ts`

Expected: Changed JavaScript/TypeScript files pass static lint.

**Step 5: Commit**

```bash
git add install.sh scripts/install-standalone.mjs src/plugins/consensus/install-sh.test.ts tests/tooling/standalone-installer.test.ts
git commit -m "feat(installer): add scoped standalone skill installs"
```

### Task p01-t02: Document both scopes and release acceptance

**Files:**

- Modify: `documentation/docs/user-guide/installation.md`
- Modify: `RELEASING.md`
- Modify: `src/plugins/consensus/install-contract.test.ts`

**Step 1: Add focused contract assertions**

Extend the existing installation contract test with stable assertions for the command shape, required explicit scope, exact tag, supported hosts, generated `skills/<name>/` boundary, default repository, and verification wording. Preserve the Consensus recovery test's immutable raw URL pin and shared runtime path.

Do not create a separate release-contract test unless the implementation demonstrates that the existing contract file cannot express these stable assertions clearly.

Run: `pnpm run test:vitest src/plugins/consensus/install-contract.test.ts tests/repo/readme-scope.test.ts`

Expected: New assertions fail before the guide is updated; README and Consensus recovery invariants remain green.

**Step 2: Update canonical documentation**

- Add the first-party procedure beside the existing Skills CLI path.
- Show explicit project and user examples for each supported host, with no default scope.
- Use `v0.1.2` as the planned pinned example only with an explicit caveat that the command becomes usable once a release contains the helper and current generated payloads; reject placeholders and mutable refs in contract assertions.
- State that tests use a temporary `HOME` and that real user-level installation requires deliberate operator action.
- Explain the generated-payload-only boundary, existing-destination refusal, and marked-partial recovery behavior.
- State that the installer writes only the selected provider directory and does not create cross-provider mirrors or run `oat sync`.
- Distinguish exact-tag resolution and copy-fidelity verification from signed provenance, fresh-session discovery, and live behavior.
- Add release checklist evidence for each advertised host and scope: pinned tag, selected skill, placement, payload verification, printed invocation, fresh-session discovery, and bounded invocation/permission behavior.
- Mark live host evidence and real user-home mutation as separate authority-gated release steps.

**Step 3: Format and verify**

Run: `pnpm exec oxfmt --write documentation/docs/user-guide/installation.md RELEASING.md src/plugins/consensus/install-contract.test.ts`

Run: `pnpm run test:vitest src/plugins/consensus/install-contract.test.ts tests/repo/readme-scope.test.ts`

Expected: Documentation and compatibility contracts pass.

Run: `pnpm --dir documentation build`

Expected: The production documentation build and generated navigation complete successfully.

Run: `pnpm exec oxlint src/plugins/consensus/install-contract.test.ts`

Expected: The changed TypeScript contract test passes static lint.

**Step 4: Commit**

```bash
git add documentation/docs/user-guide/installation.md RELEASING.md src/plugins/consensus/install-contract.test.ts
git commit -m "docs(installer): add scoped first-party procedure"
```

### Task p01-t03: Run the full gate and record the pending live boundary

**Files:**

- Modify: `.oat/repo/pjm/backlog/items/BL-260916-add-a-first-party-install.md`
- Modify through lifecycle tooling: `.oat/projects/shared/first-party-standalone-installer/implementation.md`
- Conditionally close only after authorized live acceptance: `.oat/repo/pjm/backlog/completed.md`, `.oat/repo/pjm/backlog/index.md`, `.oat/repo/pjm/current-state.md`, `.oat/repo/pjm/roadmap.md`, `.oat/repo/pjm/handoffs/BL-260916-add-a-first-party-install.md`

**Step 1: Run complete static verification**

Run: `pnpm run build:check`

Expected: Generated payloads remain fresh without repair.

Run: `pnpm run validate:skill-versions -- --base-ref origin/main`

Expected: The installer-only change requires no canonical skill version bump.

Run: `pnpm run premerge`

Expected: Build, type-check, build freshness, full Vitest suite, repository validation, and smoke tests pass.

Run: `pnpm --dir documentation build`

Expected: Documentation builds successfully after the full repository gate.

Run: `git diff --check`

Expected: No whitespace errors.

**Step 2: Record acceptance honestly**

Update the backlog item with automated evidence and the explicit status of project and user scope checks for Claude Code, Codex, and Cursor. Without separate authorization, keep real user-home mutation and live install/discovery/invocation checks pending, leave the item active, do not archive it, and do not delete the kickoff handoff.

Only if the agreed live verification boundary has been explicitly authorized and all host/scope evidence passes:

```bash
oat backlog archive BL-260916-add-a-first-party-install --summary "Added and verified the first-party scoped standalone skill installer"
oat backlog regenerate-index
git rm .oat/repo/pjm/handoffs/BL-260916-add-a-first-party-install.md
```

Then refresh `current-state.md` and `roadmap.md` if the operating picture changed.

**Step 3: Verify project-management artifacts**

Warn once with `no format command discovered in repo instructions; skipping`, then keep generated/index-managed regions owned by their OAT commands and run:

Run: `oat pjm doctor --json`

Expected: PJM adoption and backlog lifecycle checks pass with either an active pending-live item or a fully archived item.

**Step 4: Commit**

If live acceptance remains pending:

```bash
git add .oat/repo/pjm/backlog/items/BL-260916-add-a-first-party-install.md
git commit -m "chore(installer): record pending live acceptance"
```

If all acceptance is authorized and complete, commit the full archive/index/handoff closeout instead:

```bash
git add .oat/repo/pjm
git commit -m "chore(installer): close first-party install backlog item"
```

## Phase 2: Resolve final review findings

### Task p02-t01: (review) Pin the bootstrap checkout to the fully qualified release tag

**Files:**

- Modify: `documentation/docs/user-guide/installation.md`
- Modify: `tests/release/standalone-install-contract.test.ts`

**Step 1: Understand the issue**

Review finding M1: `git clone --branch v0.1.2 --single-branch` can select a
same-named branch instead of the annotated release tag, so the documented
bootstrap may execute installer bytes that are not from the promised release.
Location: `documentation/docs/user-guide/installation.md:127`

**Step 2: Implement the fix**

Replace the clone command with a fresh checkout that fetches only
`refs/tags/v0.1.2` using `--no-tags --depth=1`, then detaches at the peeled
`FETCH_HEAD^{commit}` before assigning `INSTALLER`. Add a local Git regression
with a divergent same-named branch and annotated tag; assert the checkout HEAD
and installer bytes both come from the tag.

**Step 3: Format and verify**

Run: `pnpm exec oxfmt --write documentation/docs/user-guide/installation.md tests/release/standalone-install-contract.test.ts`

Run: `pnpm exec oxlint tests/release/standalone-install-contract.test.ts`

Run: `pnpm run test:vitest tests/release/standalone-install-contract.test.ts`

Expected: The local collision regression and documentation contract pass, and
the changed authored files satisfy formatting and lint checks.

**Step 4: Commit**

```bash
git add documentation/docs/user-guide/installation.md tests/release/standalone-install-contract.test.ts
git commit -m "fix(installer): pin documented bootstrap tag"
```

## Reviews

| Scope  | Type     | Status  | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| ------ | -------- | ------- | ---- | -------- | ------------- | ---------- | ----------- |
| p01    | code     | passed | 2026-09-17 | reviews/p01-review-2026-09-17T012147Z.md | 6800dcebee56689aa9045e0d471e815e564950f2 | manual | - |
| p02    | code     | pending | - | - | - | - | - |
| final  | code     | fixes_added | 2026-09-17 | reviews/archived/final-review-2026-09-17T012706Z.md | cfe7cc01ee606523e2d14ffbea0fbcfd08124168 | auto | - |
| spec   | artifact | pending | -    | -        | -             | -          | -           |
| design | artifact | pending | -    | -        | -             | -          | -           |
| plan   | artifact | fixes_completed | 2026-09-16 | reviews/archived/artifact-plan-review-2026-09-16T231057Z.md | - | - | - |
| plan   | artifact | fixes_completed | 2026-09-16 | reviews/archived/artifact-plan-review-2026-09-16T232140Z.md | - | - | - |

The `spec` placeholder row is retained for ledger compatibility; quick mode does not produce `spec.md`.

The first gate's findings were resolved in the lifecycle artifacts. The second gate's Git-environment, parent-creation, default-repository, and contract-test consistency findings were also resolved. The user-approved complexity revision then removed the second staging copy, environment-driven race harness, and exhaustive adversarial collision matrix; it added explicit project/user scope and documented `personal-skills` as prior art. No further pre-implementation gate is required unless the user requests one. Both gate rows remain `fixes_completed`, not `passed`, because no clean re-gate was run.

## Implementation Complete

**Summary:**

- Phase 1: 3 tasks — scoped installer behavior, user/release documentation, and complete static verification with live-boundary bookkeeping.
- Phase 2: 1 task — final-review correction for unambiguous release-tag bootstrap selection.

**Total: 4 tasks**

Implementation is complete when all four tasks and configured code reviews pass. The backlog item remains active if authority-gated live host or real user-home evidence is pending.

## References

- Discovery: `discovery.md`
- Design: `design.md`
- Backlog item: `.oat/repo/pjm/backlog/items/BL-260916-add-a-first-party-install.md`
- Kickoff handoff: `.oat/repo/pjm/handoffs/BL-260916-add-a-first-party-install.md`
- Prior-art installer: `tkstang/personal-skills` `scripts/install.ts`
- Prior-art pinned source reader: `tkstang/personal-skills` `scripts/external/git-source.ts`
- Distribution catalog: `src/distributions.ts`
- Packaging contract: `scripts/lib/packaging.ts`
- Installation guide: `documentation/docs/user-guide/installation.md`
- Release checklist: `RELEASING.md`
