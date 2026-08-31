---
oat_generated: true
oat_generated_at: 2026-08-31T02:40:00Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: manual
oat_project: /Users/thomas.stang/.codex/worktrees/d7d8/skills/.oat/projects/synced/coding-session-handoff
---

# Artifact Review: plan

**Reviewed:** 2026-08-31T02:40:00Z
**Scope:** Committed plan at `0fbec1aa4d93ae86c64c5a11897708c79bc3df2f`
**Files reviewed:** Complete project lifecycle artifacts plus targeted repository, test, documentation, generated-output, provider-help, and OAT execution contracts
**Commits:** `0fbec1aa4d93ae86c64c5a11897708c79bc3df2f`

## Summary

Every FR/NFR has at least one real plan task, the six phases and 23 task IDs are monotonic, `oat project validate-plan` accepts the empty parallel-group declaration, and the installed Codex 0.151.0 and Claude Code 2.1.251 help surfaces support the planned version, successor, cleanup, and authentication probes. The plan also keeps both live gates mandatory, reserves provider mutation for the root, keeps raw receipts outside Git, and makes activation depend on both independent receipt reviews. It is not ready to execute, however, because four Important task-boundary and safety gaps would leave generated artifacts invalid, make the raw receipt review non-restartable, or mutate user scope.

Findings: 0 critical, 4 important, 0 medium, 0 minor

## Findings

### Critical

None.

### Important

- **Canonical transcript edits omit their generated outputs and required skill version bumps** (`plan.md:74`)
  - Issue: p01-t01 and p03-t02 modify `src/transcript/core/runtimes.ts`, which currently generates both `skills/session-observer/scripts/lib/runtimes.mjs` and `skills/export-session-transcript/scripts/lib/runtimes.mjs`; p01-t02 modifies `src/transcript/session-observer/lib/locate.ts`, which generates `skills/session-observer/scripts/lib/locate.mjs` (`scripts/build-generated.mjs:184-207,256-258`). None of those outputs or the affected existing skills' `SKILL.md` version fields is in the owning task scope. p03-t06 later runs the full build but declares only the new handoff output, so it would either change undeclared files or leave `build:check` and `validate:skill-versions` failing.
  - Fix: Assign each pre-existing generated output to the task that changes its canonical source (or to one explicitly dependency-ordered consolidation task), run `pnpm run build` and `pnpm run build:check`, and include synchronized version/`metadata.version` bumps for `session-observer` and `export-session-transcript` as required by the repository's changed-skill contract.
  - Requirement: NFR4, NFR6.

- **The new public skill directory is created three phases before its inventory contract** (`plan.md:442`)
  - Issue: p03-t06 creates `skills/coding-session-handoff/scripts/...`, while p06-t01 creates its `SKILL.md` and p06-t03 updates `tests/repo/layout.test.ts`. That layout test enumerates every directory under `skills/` and currently requires the exact public set (`tests/repo/layout.test.ts:42-60`), so the repository-wide suite is predictably red from p03-t06 through p06-t03. Those task commits are not independently verifiable/committable, and the mandatory live gates would run atop a known repository-contract failure.
  - Fix: Keep the pre-activation gate bundle in a non-public temporary/development output outside `skills/`, then land the canonical skill directory, `SKILL.md`, generated mapping/output, explicit inventory, and install contract atomically after receipt activation; alternatively co-land every required public-skill inventory contract when the directory first appears and adjust version sequencing accordingly.
  - Requirement: FR10, NFR4, NFR6.

- **Untracked receipts have no restart-safe path handoff to their independent reviewers** (`plan.md:536`)
  - Issue: p04 writes each raw receipt beneath an external `mktemp -d` root and commits only redacted digest/status (`plan.md:474-477,501-504`), while p05 merely says to read the raw receipt. No task preserves a local-only locator, passes the exact path to a reviewer, or keeps the temp root alive across the likely Claude-auth stop/resume boundary. The design explicitly forbids receipt auto-discovery, so a fresh p05 phase dispatch cannot deterministically obtain the evidence it must review before activation.
  - Fix: Define a root-owned, mode-0600, untracked receipt-locator lifecycle and explicit reviewer dispatch contract: retain the exact path and digest across restart, pass them directly to a reviewer distinct from the implementer/gate executor, validate mode/digest before reading, keep the reviewer read-only, and activate only from the resulting redacted passing artifact. Do not add the raw receipt to Git or tracked project artifacts.
  - Requirement: FR6, FR8, NFR2, NFR3.

- **Bare `oat sync` would also update user scope** (`plan.md:709`)
  - Issue: The task says to run project `oat sync` while also forbidding installation of the branch version into user scope. Installed `oat sync --help` reports the default scope as `all`, so following the written command would sync both project and user views and violate the repository's main-only user-install contract.
  - Fix: Replace the instruction with an explicit preview and project-only application, such as `oat sync --scope project --dry-run` followed by `oat sync --scope project`, and verify only repository provider mirrors/symlinks changed while the user-level install remains on `main`.
  - Requirement: FR10, NFR6.

### Medium

None.

### Minor

None.

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md`, `spec.md`, `design.md`, `plan.md`, `implementation.md`, `state.md`, clean archived design review `reviews/archived/artifact-design-review-2026-08-31T023100Z.md`, root `AGENTS.md`, `tests/AGENTS.md`, `documentation/AGENTS.md`, package scripts, generated-output mappings, public-skill layout tests, OAT implementation/phase-owner contracts, and installed provider/OAT help output.

### Requirements Coverage

| Requirements | Status | Notes |
| --- | --- | --- |
| FR1-FR5, FR7, FR9 | aligned | Concrete implementation and verification tasks cover discovery, preview, selection, Git evidence, continuity modes, digest confirmation, and itemized outcomes. |
| FR6, FR8 | partial | Mandatory exact-version gates and root-only execution are explicit, but the untracked raw evidence cannot reliably reach the required independent reviewer after a restart. |
| FR10 | partial | Public skill, docs, and provider-view tasks exist; directory sequencing and the default-all sync command violate repository/install contracts. |
| NFR1-NFR3, NFR5 | aligned | Read-only, privacy, fail-closed, and bounded-resource scenarios have concrete task/test coverage. |
| NFR4, NFR6 | partial | Existing generated outputs/version bumps are unowned, and the new public directory temporarily makes the explicit layout suite fail. |

### Extra Work (not in declared requirements)

None.

## Plan Contract Checks

- Frontmatter, required sections, Reviews table shape/preservation, Implementation Complete summary, References, checklist, task IDs, and commit messages are valid.
- `oat_plan_parallel_groups: []` is correct and passes `oat project validate-plan`; no phase-level parallel group is falsely declared.
- Codex 0.151.0 and Claude Code 2.1.251 successor/cleanup/auth help surfaces are present, and both live gates remain mandatory completion blockers rather than optional plan-only scope.
- Root-only gate authority, no bypass/push/publish/release behavior, task-local Claude authentication, untracked raw receipts, and review-before-activation dependencies are stated correctly except for the receipt locator and sync findings above.

## Verification Commands

```bash
oat project validate-plan --project-path .oat/projects/synced/coding-session-handoff --json
pnpm run build:check
pnpm run validate:skill-versions -- --base-ref origin/main
pnpm exec vitest run tests/repo/layout.test.ts tests/tooling/generated-output-sync.test.ts tests/release/versioning.test.ts
oat sync --help
codex --version && codex exec fork --help && codex delete --help
claude --version && claude project purge --help && claude auth status --help
```

## Recommended Next Step

Run `oat-project-review-receive` to convert the four Important findings into bounded plan-fix tasks, then re-review the corrected plan before implementation.
