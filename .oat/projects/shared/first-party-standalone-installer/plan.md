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

# Implementation Plan: first-party-standalone-installer

> Execute this plan using `oat-project-implement`.

**Goal:** Add a dependency-free first-party command that installs a generated standalone skill from an exact tag into an explicit host's project-scoped skills directory while preserving the existing Consensus recovery installer.

**Architecture:** `install.sh` dispatches zero arguments to the unchanged Consensus path and standalone flags to an adjacent dependency-free Node.js 22 helper. The helper performs qualified-tag fetch and detached commit verification, generated-payload validation, complete path/mode/SHA-256 inventories, same-parent staging, atomic exclusive destination reservation, descriptor-held `wx` population, final verification, and host invocation output.

**Tech Stack:** Bash, Git, Node.js 22 repository tooling, Vitest, temporary local Git fixtures, Fumadocs Markdown.

**Commit Convention:** `{type}({scope}): {description}`

## Parallelism

The plan is sequential (`oat_plan_parallel_groups: []`). Installer behavior, its compatibility contract, and the user/release documentation describe one shared CLI boundary. The documentation task depends on the finalized command and output, while final verification and backlog disposition depend on both prior tasks. Parallel worktrees would create avoidable overlap in the install contract and integration checks.

## Phase 1: Implement and verify the first-party installer

### Task p01-t01: Add the standalone installer path and behavior tests

**Files:**

- Modify: `install.sh`
- Create: `scripts/install-standalone.mjs`
- Modify: `src/plugins/consensus/install-sh.test.ts`
- Create: `tests/tooling/standalone-installer.test.ts`

**Step 1: Establish the baseline**

Run: `pnpm run build:check`

Expected: Generated installation units are in sync before source work begins.

Run: `pnpm run test:vitest src/plugins/consensus/install-sh.test.ts src/plugins/consensus/install-contract.test.ts`

Expected: Existing Consensus installer behavior is green before the additive change.

**Step 2: Write failing standalone behavior tests**

Use temporary project roots and temporary local Git repositories with lightweight tags. Exercise the real `install.sh` process with isolated environment variables and working directories.

Cover:

- required `--skill`, `--agent`, and `--ref` parsing plus `--help`;
- Codex, Claude Code, and Cursor project destinations and invocation output;
- complete payload bytes and executable-mode preservation;
- missing tag, branch-only ref, missing generated skill, authored-source-only fixture, malformed name, unsupported host, unsafe entry, and symlinked ancestor refusal;
- annotated-tag handling and a same-named branch/tag fixture with different bytes that must install the peeled tag commit;
- existing destination preservation;
- deterministic post-preflight directory and symlink collision refusal with competing content preserved;
- post-reservation competing directory, regular-file, symlink, FIFO, and symlink-to-FIFO creation plus destination replacement, proving exclusive opens and no recursive cleanup preserve foreign entries without blocking or write-through;
- reserved marker-name rejection;
- injected post-reservation copy or inventory failure that leaves a marked partial destination, preserves concurrent additions, cleans checkout/staging state, and makes a later install refuse the existing path;
- zero-argument Consensus checkout, remote, checksum, permission, and repeated-install compatibility.

Run: `pnpm run test:vitest tests/tooling/standalone-installer.test.ts src/plugins/consensus/install-sh.test.ts`

Expected: New standalone cases fail for the missing behavior while legacy cases remain green.

**Step 3: Implement the dependency-free standalone flow**

- Dispatch no arguments to the existing Consensus path and delegate standalone arguments to `scripts/install-standalone.mjs` through Node.js 22.
- Validate standalone flags and safe names in the dependency-free helper before installation work; invoke Git with argv arrays.
- Fetch the fully qualified `refs/tags/<ref>` from the default repository or `--repository` override, peel it to a commit, check it out detached, and require `HEAD` equality before reading the payload.
- Select only `skills/<name>/` and require `SKILL.md`; never search or fall back to `src/skills/`.
- Reject symlinks and non-file/non-directory entries.
- Map hosts to `.agents/skills`, `.claude/skills`, or `.cursor/skills` beneath the physical current project.
- Refuse existing destinations and symlinked destination ancestors during preflight, then repeat the ancestor check immediately before publication.
- Inventory every regular file by relative path, permission mode, and SHA-256; copy to a same-parent stage; and verify inventory equality.
- Atomically reserve the final path with exclusive `mkdir`; if another directory or symlink appeared, preserve it and fail.
- Reject the reserved marker name in source payloads. Add the marker after reservation; create payload directories parent-first with exclusive `mkdir`; open payload files through Node `wx`, retain the descriptor through byte copy and permission changes, and never overwrite or open an existing final-path entry. Verify while excluding only the marker, then remove the marker only after verification succeeds.
- On post-reservation failure, preserve the marked partial destination and any concurrent additions, report explicit recovery, and clean only owned checkout/staging paths. Print the verified path plus host invocation name only after the marker is removed.

**Step 4: Format and verify**

Run: `pnpm exec oxfmt --write scripts/install-standalone.mjs src/plugins/consensus/install-sh.test.ts tests/tooling/standalone-installer.test.ts`

For `install.sh`, warn once with `no format command discovered in repo instructions; skipping`, then preserve the existing shell style manually.

Run: `pnpm run test:vitest tests/tooling/standalone-installer.test.ts src/plugins/consensus/install-sh.test.ts src/plugins/consensus/install-contract.test.ts`

Expected: All standalone and legacy installer cases pass.

Run: `pnpm run type-check`

Expected: TypeScript checks pass.

**Step 5: Commit**

```bash
git add install.sh scripts/install-standalone.mjs src/plugins/consensus/install-sh.test.ts tests/tooling/standalone-installer.test.ts
git commit -m "feat(installer): add pinned standalone skill installs"
```

### Task p01-t02: Document the first-party path and release acceptance

**Files:**

- Modify: `documentation/docs/user-guide/installation.md`
- Modify: `RELEASING.md`
- Modify: `src/plugins/consensus/install-contract.test.ts`
- Create or modify if needed: `tests/release/standalone-install-contract.test.ts`

**Step 1: Add contract assertions**

Protect the documented command shape, explicit pinned tag, supported hosts, generated `skills/<name>/` boundary, project-scope default, verification wording, and printed invocation guidance. Preserve the separate Consensus recovery test's immutable raw URL pin and shared runtime path instead of weakening it globally.

Run: `pnpm run test:vitest src/plugins/consensus/install-contract.test.ts tests/release/standalone-install-contract.test.ts tests/repo/readme-scope.test.ts`

Expected: New documentation assertions fail before the guide is updated; README and Consensus recovery invariants remain green.

**Step 2: Update canonical documentation**

- Add the first-party procedure beside the existing Skills CLI path.
- Show a pinned-tag checkout/install workflow and all three host values.
- State the generated-payload-only boundary and refusal of `src/skills/`.
- Explain absent-destination refusal and how to choose a different project or remove an installation deliberately.
- Distinguish exact-tag resolution and copy-fidelity verification from signed provenance, fresh-session discovery, and live behavior.
- Add release checklist evidence for each advertised host: pinned tag, selected skill, project placement, payload verification, printed invocation, fresh-session discovery, and bounded invocation/permission behavior.
- Mark live host evidence as a separate authority-gated release step, not something static tests prove.

**Step 3: Format and verify**

Run: `pnpm exec oxfmt --write documentation/docs/user-guide/installation.md RELEASING.md src/plugins/consensus/install-contract.test.ts tests/release/standalone-install-contract.test.ts`

If the optional release test file is not created, omit it from the formatter invocation.

Run: `pnpm run test:vitest src/plugins/consensus/install-contract.test.ts tests/release/standalone-install-contract.test.ts tests/repo/readme-scope.test.ts`

Expected: Documentation and compatibility contracts pass.

Run: `pnpm --dir documentation build`

Expected: The production documentation build and generated navigation complete successfully.

**Step 4: Commit**

```bash
git add documentation/docs/user-guide/installation.md RELEASING.md src/plugins/consensus/install-contract.test.ts tests/release/standalone-install-contract.test.ts
git commit -m "docs(installer): add first-party standalone procedure"
```

Omit any path that was not created or changed.

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

Update the backlog item with automated evidence and the explicit status of Claude Code, Codex, and Cursor live install/discovery/invocation checks. Without separate authorization, keep those live checks pending, leave the item active, do not archive it, and do not delete the kickoff handoff.

Only if the agreed live verification boundary has been explicitly authorized and all host evidence passes:

```bash
oat backlog archive BL-260916-add-a-first-party-install --summary "Added and verified the first-party pinned-tag standalone skill installer"
oat backlog regenerate-index
git rm .oat/repo/pjm/handoffs/BL-260916-add-a-first-party-install.md
```

Then refresh `current-state.md` and `roadmap.md` if the operating picture changed.

**Step 3: Format and verify project-management artifacts**

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

## Reviews

| Scope  | Type     | Status  | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| ------ | -------- | ------- | ---- | -------- | ------------- | ---------- | ----------- |
| p01    | code     | pending | -    | -        | -             | -          | -           |
| final  | code     | pending | -    | -        | -             | -          | -           |
| spec   | artifact | pending | -    | -        | -             | -          | -           |
| design | artifact | pending | -    | -        | -             | -          | -           |
| plan   | artifact | received | 2026-09-16 | reviews/artifact-plan-review-2026-09-16T231057Z.md | - | - | - |

## Implementation Complete

**Summary:**

- Phase 1: 3 tasks — installer behavior, user/release documentation, and complete static verification with live-boundary bookkeeping.

**Total: 3 tasks**

Implementation is complete when all three tasks and configured reviews pass. The backlog item remains active if authority-gated live host evidence is still pending.

## References

- Discovery: `discovery.md`
- Design: `design.md`
- Backlog item: `.oat/repo/pjm/backlog/items/BL-260916-add-a-first-party-install.md`
- Kickoff handoff: `.oat/repo/pjm/handoffs/BL-260916-add-a-first-party-install.md`
- Distribution catalog: `src/distributions.ts`
- Packaging contract: `scripts/lib/packaging.ts`
- Installation guide: `documentation/docs/user-guide/installation.md`
- Release checklist: `RELEASING.md`
