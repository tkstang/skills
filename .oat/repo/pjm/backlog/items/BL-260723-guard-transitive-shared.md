---
id: BL-260723-guard-transitive-shared
title: Guard transitive shared-runtime skill version bumps
status: open
priority: medium
scope: task
scope_estimate: S
labels:
  - release-tooling
  - build-contract
  - wave-2-follow-up
assignee: null
created: 2026-07-23T06:40:00Z
updated: 2026-07-23T06:40:00Z
associated_issues: []
external_plans: []
---

## Description

`scripts/validate-skill-versions.mjs` derives changed skills from files under
canonical skill directories, so a change to a SHARED plugin-level generated
runtime (e.g. `plugins/consensus/scripts/consensus-loop.mjs`, consumed by the
`create`/`decide`/`plan`/`refine`/`evaluate` wrappers) does not require bumps
for its transitive consumers — waves 1 and 2 both shipped shared-runtime
behavior changes with only the directly-touched skills bumped, and the wave-2
final gate caught the gap (`create`/`decide`/`plan` were stale at 0.1.4 across
two behavior changes; fixed manually to 0.1.5). Add a guard: when a
`generatedOutputs` shared output changes, every skill whose generated wrapper
imports it must have a version bump (derive the consumer set from the
import-rewrite graph now available in `scripts/build-generated.mjs`).

Source: wave-2-execution final gate finding 2 (2026-07-23).

## Acceptance Criteria

- The skill-version validator (or a sibling check wired into the same CI
  job/pre-push hook) fails when a shared generated runtime changes without
  version bumps in all transitive consumer skills
- Consumer set derived mechanically from the build mapping/import graph, not a
  hand-maintained list
- Covered by a test that reproduces the wave-1/wave-2 gap scenario
