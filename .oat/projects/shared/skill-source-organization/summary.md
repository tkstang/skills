---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-14
oat_generated: true
oat_summary_last_task: p05-t01
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: Skill Source Organization and Plugin Packaging

## Overview

This project reorganized the public repository so each shipped skill has one authored source directory while standalone and plugin installations are generated outputs. It implements issue #74, introduces separate session and consensus plugin boundaries, and preserves dependency-free Node.js runtime packages without claiming unverified marketplace or live-provider readiness.

All 14 planned tasks are implemented. Public PR #79 merged at `8767bce4819a2cae1a9f257de650a5ed0ae0afc1`; p05 removed the two private authored owners and opened linked personal-skills PR #32 while preserving active installations. Formal p05 and final OAT reviews remain pending.

## What Was Implemented

- Added a typed distribution catalog for canonical skill owners, standalone targets, plugin-local names, shared code, resources, and workflow prerequisites. The build stages complete installation units, validates paths and ownership, and replaces outputs atomically.
- Colocated thirteen skill owners under `src/skills`, consensus plugin code under `src/plugins/consensus`, and shared transcript logic under `src/shared/transcript`. Shipped `.mjs` and skill/plugin payloads remain committed generated outputs.
- Created the session plugin with `handoff`, `export-transcript`, and `fork-to-destination`; added `observer` and `observer-collab` to the consensus plugin; and retained selected descriptive standalone forms.
- Renamed public standalone skills to `session-export-transcript` and `session-fork-to-destination` as a clean break with no aliases, redirects, wrappers, or duplicate legacy installation paths.
- Promoted the portable `session-handoff` source and newer `complexity-review` content into public canonical owners while preserving attribution, privacy, and authorization boundaries.
- Removed the private personal-skills authored copies of `complexity-review` and `session-handoff` in PR #32. The personal plugin now consumes byte-exact rendered public payloads through its existing external-source lifecycle, pinned to the public merge commit.
- Made quoted `metadata.version` the sole authored skill-version field. Version validation follows renamed owners, includes local edits and shared-source fan-out, and requires an explicit comparison base.
- Migrated affected build, validation, internal-flag, and version tooling to TypeScript, expanded isolated installation and generated-output regressions, and updated CI, manifests, contributor and scoped agent guidance, release guidance, the docs site, and the changelog.

The public milestone passed 1,988 Vitest tests with one skip, 50 focused review-fix tests, 40 isolated packaging tests, type-check, generated-output freshness, structural validation, smoke, internal-flag validation, the twelve-skill version gate, whitespace checks, and a 39-route documentation build. The final independent public review reported zero findings at every severity; the later documentation expansion also passed its focused 23-test docs suite, structural validation, generated-output freshness, and changed-file formatting checks. The private cutover passed packaging, complete checks, version validation, type-check, lint, formatting, 322 tests with one intentional skip, installed-runtime tests, external-source freshness, temporary-install inventory and byte parity, PJM doctor, and diff checks.

## Key Decisions

- **Declared skill distributions.** Authored skill ownership lives under `src/skills`; a typed catalog generates every supported standalone and plugin installation target. Generated installation layouts never become editable sources. Shared runtime is bundled into each target, while real workflow prerequisites are declared and checked without automatic installation.
- **Session and consensus plugin boundaries.** Session transfer, export, and destination-fork guidance ship in the session plugin. Cross-session observation and bounded collaboration ship in consensus. Shared code location does not determine product grouping.
- **Metadata version is the sole skill version.** Quoted stable `metadata.version` is the sole authored skill version. One skill version applies to all generated forms, while plugin release versions remain independent. Renamed skills ship only under their new names; historical owner mappings remain solely for safe version comparison.

## Notable Challenges

- Moving owners and tests exposed stale path assumptions across CI, docs, scoped agent instructions, release guidance, and generated-output tests. Two bounded review-fix iterations completed the maintained-reference sweep and added regression coverage.
- Generated-output replacement needed path containment, symlink rejection, shared-input fingerprints, and atomic swaps so freshness checks cannot escape the repository or destroy the previous output on failure.
- The p01 review reached its three-cycle cap with one narrow symlink-freshness issue. The user authorized that exact correction and waived another review; root verification passed before later phases continued.
- The private repository originally pointed its external snapshots at public `src/skills`, which contains authored templates. P05 corrected the source to the supported rendered standalone payload under public `skills/` before removing the duplicate editable owners.

## Tradeoffs Made

- Generated payload duplication is retained because standalone skills and plugins must run without importing sibling installations or checkout source. A single catalog and builder keep that duplication mechanical.
- The project extends the existing Vitest and packaging infrastructure rather than creating provider-by-skill matrices or a second installation framework.
- Static and isolated-artifact checks establish packaging correctness only. Live provider discovery, permissions, publication, and install behavior remain separate release evidence.
- The private personal plugin retains generated copies for installation continuity, but their external registry pins exact public rendered bytes so they do not become another authored owner.

## Integration Notes

- Edit canonical content under `src/skills`, `src/plugins`, or `src/shared`; run `pnpm run build`; never hand-edit generated installation payloads.
- Use `pnpm tsx scripts/apply-internal-flags.ts` after refreshing OAT tooling, then run `oat sync`.
- A changed skill owner or transitive shared input requires that owner's `metadata.version` to increase. Plugin release versions use separate target selection.
- Private PR #32 is the pending ownership cutover. Its external snapshots pin public merge commit `8767bce4819a2cae1a9f257de650a5ed0ae0afc1`; active user-install fingerprints were unchanged during implementation.

## Follow-up Items

- Complete formal p05 and final OAT review and the authorized project archive workflow.
- Merge personal-skills PR #32 only with separate authorization, then reconcile active installations through the owning repository's normal workflow.
- Live and paid provider checks, fresh marketplace discovery, permission behavior, and global user-install reconciliation remain outside the local public milestone.

## Associated Issues

- GitHub issue #74: skill source colocation and generated declared installation units.
- Backlog item `BL-260723-guard-transitive-shared`: closed by the shared-consumer version guard in p02.

## Workflow Observations

### 2026-09-13 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:3,minor:3 exit=0 status=ok artifact=.oat/projects/shared/skill-source-organization/reviews/artifact-plan-review-2026-09-13T151722Z.md run=ad0f809d-26ad-4210-9d55-2f0340097ea0

### 2026-09-13 · structural · oat-reviewer · p01-review-cycle-3

7c4c38ea-f650-4f95-8fec-252278d09f90 artifact=.oat/projects/shared/skill-source-organization/reviews/archived/p01-review-2026-09-13T172248Z.md reconnaissance=attempted waves=2 result=critical:0,important:1,medium:0,minor:0

### 2026-09-13 · structural · oat-project-implement · p01

26360de4-05a7-4c8a-ae15-cfffe34fe1f8 status=blocked review_cycle=3 fix_iterations=2 remaining=important:1 artifact=.oat/projects/shared/skill-source-organization/reviews/archived/p01-review-2026-09-13T172248Z.md

### 2026-09-13 · project · feedback · p01 post-cap disposition

9e44ba12-4107-4c9e-87ab-86028e7ef2f5 The user authorized the single remaining symlink-freshness fix after the automatic review cap and explicitly waived another review cycle. Commit 684d4f8d addresses the exact finding; root verification passed 62 scoped tests plus type-check, build check, validation, and smoke, superseding the prior blocked phase outcome.

### 2026-09-13 · structural · oat-project-implement · p01-post-cap

bfbd17d5-b678-4351-95da-ddfecfda868b status=passed disposition=operator-verified-no-rereview fix=684d4f8d19187e197e7b54c561f179e87fd4e917 next=p02

### 2026-09-13 · structural · oat-reviewer · p02-review-cycle-1

c3d3ae1a-ad64-445b-8534-7faab3394017 artifact=.oat/projects/shared/skill-source-organization/reviews/archived/p02-review-2026-09-13T202600Z.md reconnaissance=attempted waves=3 result=critical:0,important:3,medium:1,minor:0

### 2026-09-13 · structural · oat-reviewer · p02-review-cycle-2

543901be-9d41-4fa7-86ed-c2160493136f artifact=.oat/projects/shared/skill-source-organization/reviews/archived/p02-review-2026-09-13T204639Z.md reconnaissance=attempted waves=2 result=critical:0,important:1,medium:2,minor:0

### 2026-09-13 · structural · oat-reviewer · p02-review-cycle-3

b66fa567-aa91-45c9-8cb1-d9fb38b09680 artifact=.oat/projects/shared/skill-source-organization/reviews/archived/p02-review-2026-09-13T210441Z.md reconnaissance=attempted waves=1 result=critical:0,important:0,medium:0,minor:0

### 2026-09-13 · structural · oat-project-implement · p02

387034cd-51fd-4d3c-9690-141db913ba38 status=passed review_cycle=3 fix_iterations=2 recovery_attempts=2 reviewed_head=9104c37597c8b7fa452ef1aeadaf48e153e1a210 next=p03

### 2026-09-13 · structural · oat-reviewer · p03-review-cycle-2

a3d779e7-fe52-47cb-ae5d-9271c3fff54f artifact=.oat/projects/shared/skill-source-organization/reviews/archived/p03-review-2026-09-13T222103Z.md reconnaissance=attempted waves=2 result=critical:0,important:0,medium:0,minor:0

### 2026-09-13 · structural · oat-project-implement · p03

6f408a29-487a-4f94-b5a9-5d3cc06d98c5 status=passed review_cycle=2 fix_iterations=1 recovery_attempts=1 reviewed_head=de269575225719185ac456f1e8fcac1dde8ea0b5 next=p04

### 2026-09-14 · structural · oat-reviewer · p04-review-cycle-1

f1432336-557b-46a0-a995-918567c5dd0e artifact=.oat/projects/shared/skill-source-organization/reviews/archived/p04-review-2026-09-14T002632Z.md reconnaissance=attempted waves=2 result=critical:0,important:2,medium:1,minor:0

### 2026-09-14 · structural · oat-project-implement · p04

8f123054-e9ec-4acd-90b5-4f29252890db status=passed review_cycle=3 fix_iterations=2 recovery_attempts=2 reviewed_head=9d9c1e8607941999b0baeed9e8d8d7749a96730f next=progress-pr-authorization
