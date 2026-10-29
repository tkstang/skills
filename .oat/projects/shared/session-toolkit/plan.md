---
oat_template: true
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-10-29
oat_phase: plan
oat_phase_status: in_progress
oat_plan_hill_phases: [] # [] = none for brief modes
oat_plan_parallel_groups: [] # groups of phases that run concurrently in worktrees; [] = fully sequential
oat_plan_source: brief
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Project Brief: session-toolkit

> Execute this brief using `oat-project-implement`. Phases are the units of
> progress: each `## Phase pNN:` block carries intent and exit evidence instead
> of planned tasks, and only the next phase must be concrete. Execution records
> (`### Task pNN-tNN:`) live in `implementation.md`, never here.

**Commit Convention:** `{type}({scope}): {description}` - e.g., `feat(p01-t01): add user auth endpoint`

**Phase block grammar (strict):** each phase is one `## Phase pNN: <name>`
heading followed by a blank line and these exact lines:

```markdown
**Intent:** one or more non-empty lines
**Exit evidence:** one or more non-empty lines
**Provisional:** no
```

Phase IDs are stable and document order governs execution. `**Provisional:**`
accepts `yes` or `no`; absent means `no`. The first phase must not be
provisional. Do not add `### Task` headings to phases.

## Goal

Create `@tkstang/session-toolkit` with the `seshtk` CLI as the maintained owner of provider/session identity, transcript discovery, parsing and reads, historical search, export, and structured activity extraction shared by Skills and ORC. Remove duplicated authored provider logic while preserving the capabilities each repository already provides.

## Outcomes

<!-- Number each outcome and name the evidence that will show it holds. Completion is audited against this list. -->

1. **One maintained session toolkit serves Skills and ORC** — Evidence: package API and CLI acceptance checks, consumer integration evidence, and removal of duplicate authored provider implementations. Exact capabilities and phase evidence will be written after alignment.
2. **The CLI notifies users when a newer release is available** — Evidence: controlled current/newer-version and failed-lookup checks, with session command behavior and machine-readable stdout preserved.

## Approach

Use a small pnpm workspace in this repository with one public library and CLI package at `packages/session-toolkit/`. Keep existing skill sources and the separately managed documentation app in place. ORC imports the published package API. Interactive skills invoke the CLI with explicit prerequisite handling. Unattended hook entrypoints bundle the toolkit functions they need at build time from that same authored package source; they never fetch dependencies or prompt while firing.

Alignment interview remains in progress for the runtime baseline, ORC command disposition, delivery endpoint and authority. The existing reconnaissance and independent Opus review are evidence inputs; their other recommendations are not automatically accepted design.

**Proposed update-notice behavior:** best-effort, cached checks report a newer release on interactive CLI runs through stderr. Registry failures do not fail session commands. Automatic hooks and noninteractive machine invocations remain quiet. The cache interval and check mechanism are phase-local implementation choices; there is no automatic upgrade.

<!-- Optional: add a `### Design` subsection when architecture decisions need recording. Delete this comment otherwise. -->

## Constraints and Out of Scope

- **Constraint:** Preserve one authored provider implementation across runtime CLI and bundled-hook distributions. Bundled hooks receive toolkit changes through rebuilds and installation updates.
- **Constraint:** CLI stdout retains its documented output contract when update notices are emitted.
- **Out of scope:** Automatic package upgrades are not requested.

## Decisions

- **Accepted naming:** npm package `@tkstang/session-toolkit`; CLI `seshtk`. Recorded in DR-261028-session-toolkit-naming. Alternatives `stk` and `sesh` were rejected after finding existing CLI conflicts.
- **Package home (accepted):** one public library + CLI package in a small pnpm workspace here. Keeps engine and skill changes together with bounded package build/release tooling; separate-repository and ORC-owned publication were rejected.
- **Distribution (accepted):** interactive CLI prerequisites plus build-time bundling for unattended hook entrypoints. The user accepted the clarified recommendation. This preserves autonomous/offline hook execution, at the cost of rebuilding hooks for toolkit fixes; requiring a preinstalled CLI for hooks and bundling every skill were not selected.
- **Update notifications (required):** the user requested notice when a newer CLI version is available. Notification timing and output details above remain a proposed implementation contract pending overall design alignment.
- **Workflow:** the user selected brief mode after comparing it with quick-start and pursuing-goals. One cross-repository delivery needs architecture alignment and phases with completion evidence; execution records will be created during implementation.

## Known Unknowns

- [Open question] — Settled by: [phase ID that resolves it]

## Delivery endpoint and authority

- **Endpoint:** [open | merged] — [what "delivered" means for this project]
- **Authority:** [who approves the brief, phase acceptance, and the delivery; what the agent may decide alone]

## Milestones

<!-- Reserved for goal mode. Brief projects deliver once and leave this section empty. -->

## Phase p01: [Phase Name]

**Intent:** [What this phase changes and why.]
**Exit evidence:** [The verification that shows the phase is done.]
**Provisional:** no

## Phase p02: [Phase Name]

**Intent:** [What this phase is expected to change; refine before it starts.]
**Exit evidence:** [The verification expected to show the phase is done.]
**Provisional:** yes

---

## Parallelism

Phases that have no overlapping file modifications may run concurrently. To declare parallelism:

```yaml
oat_plan_parallel_groups: [['p02', 'p03']]
```

Each inner array is a group of phases that execute in parallel (each in its own worktree) and merge back in plan order after all pass. Groups may be declared whenever the phases become concrete.

Default is `[]` (fully sequential, no worktrees).

---

## Reviews

| Scope | Type     | Status  | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| ----- | -------- | ------- | ---- | -------- | ------------- | ---------- | ----------- |
| plan  | artifact | pending | -    | -        | -             | -          | -           |
| p01   | code     | pending | -    | -        | -             | -          | -           |
| final | code     | pending | -    | -        | -             | -          | -           |

Add one `code` row per phase as phases become concrete. For code-review events,
`Reviewed Head` is the full 40-character SHA at the head of the reviewed range.
Writers must preserve every existing row and every unknown trailing cell.

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

---

## Implementation Complete

**Summary:**

- Phase p01: [Description]

**Total: [N] phases**

Ready for final code review and PR preparation.

---

## References

- Journal: `implementation.md`
- Research: `references/research/`
- Reconnaissance: `../../../repo/reference/brainstorms/2026-10-28-shared-session-toolkit.md`
- Independent proposal review: `../../../repo/reference/brainstorms/2026-10-28-shared-session-toolkit-opus-review.md`
- Accepted naming: `../../../repo/reference/decisions/DR-261028-session-toolkit-naming.md`
- Project log: `project-log.md` (when enabled)
