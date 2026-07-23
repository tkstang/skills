---
id: BL-260723-split-loop-free-cli-helpers
title: Split loop-free cli-helpers core for panel sharing
status: open
priority: low
scope: task
scope_estimate: S
labels:
  - consensus
  - tech-debt
  - wave-3-follow-up
assignee: null
created: 2026-07-23T09:30:00Z
updated: 2026-07-23T09:30:00Z
associated_issues: []
external_plans: []
---

## Description

Wave-3's helper consolidation excluded `consensus-panel.ts` by reviewed ruling:
the shared `src/consensus/shared/cli-helpers.ts` hard-depends on
consensus-loop (`ConsensusError`/`EXIT_CODES` at cli-helpers.ts:11), so a panel
import would transitively couple panel to the loop, regressing its documented
decoupling (own `PANEL_EXIT_CODES`/`PanelError`; enforced by
`tests/tooling/shared-cli-helpers-guard.test.ts`). Panel therefore still
duplicates ~10 pure helpers (requireValue, validateProviderId, pathExists,
nearestExistingPath, ensureFinalNewline, prompt-block encoding, envelope
parsing, providerStatusMap, inside).

Reviewer-named follow-up shape: extract a loop-free
`src/consensus/shared/cli-helpers-core.ts` holding the pure,
ConsensusError-free helpers; both panel and the existing loop-coupled
`cli-helpers.ts` import from it; the confineWrite/atomicWriteFile/
providerCliUnavailableError trio stays in the loop-coupled layer. Update the
panel-decoupling guard to allow the core import while still forbidding the
loop-coupled module.

Source: wave-3-execution p01 review ruling (2026-07-23).

## Acceptance Criteria

- Loop-free core module extracted; panel imports it; the loop-coupled layer
  re-exports/composes it with zero behavior change
- Panel-decoupling guard updated (core allowed, loop-coupled forbidden) and the
  re-fork guard covers the new module
- Build fan-out entries + ignore lists updated; affected skill versions bumped;
  full premerge green
