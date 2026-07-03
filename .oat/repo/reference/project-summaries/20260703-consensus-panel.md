---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-07-03
oat_generated: true
oat_summary_last_task: p06-t01
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: consensus-panel

## Overview

This project shipped the default consensus configuration foundation and the new
`consensus-panel` workflow as one coherent feature lane. The goal was to let
users configure default consensus peers and panelists once, then run either
existing convergence workflows or a neutral 2+ panel breadth gather without
manual composition on every invocation.

## What Was Implemented

- Added a shared `ConsensusDefaultsConfig` schema, persisted user/project config
  store, and resolver with precedence `invocation > project > user > built-in`.
- Added provider CLI `consensus config get/list/set/clear` commands with
  JSON-only envelopes for user, project, and effective scopes.
- Integrated configured defaults into `create`, `decide`, `plan`, `refine`, and
  `evaluate` while preserving explicit `--peers` precedence and two-peer
  convergence semantics.
- Added the `panel` / `consensus-panel` workflow with neutral moderator prompts,
  independent provider-backed panelist turns, attributed markdown artifacts,
  JSONL status events, schema validation, and shortfall diagnostics.
- Updated shipped skill instructions, operator QA, examples, plugin manifests,
  README surfaces, changelog notes, Fumadocs user-guide pages, and navigation.
- Closed `BL-260626-configure-default-consensus` and
  `BL-260626-add-consensus-panel-skill`, and added
  `BL-260701-add-multi-round-panel` as the deferred follow-up.
- Resolved the final review finding by making project config reads and effective
  resolution work from nested working directories via upward lookup to the
  nearest existing `.consensus/config.json`.

## Key Decisions

- **One project for config and panel:** The two backlog items were implemented
  together so default-panel ergonomics landed with the visible panel workflow.
- **Provider CLI owns configuration:** The `consensus` provider CLI is the
  single command surface for viewing, setting, clearing, and resolving defaults.
- **Invocation wins over persisted defaults:** Per-run flags stay authoritative,
  then project config, user config, and built-ins fill in only when needed.
- **Panel is single-round breadth gathering:** v1 deliberately surfaces
  independent attributed responses instead of extending the convergence loop or
  forcing a single synthesized outcome.
- **Moderator stays neutral:** The host asks one approved question, dispatches
  panelists, and renders their responses without becoming an extra panel voice.
- **Canonical TypeScript sources remain authoritative:** Runtime `.mjs` plugin
  outputs are generated from `src/` and verified with `pnpm run build:check`.

## Notable Challenges

- Phase reviews caught several boundary issues before closeout: persisted config
  schema shape, no-config built-in peer preservation, generated schema asset
  paths, canonical `--allow-root` containment checks, and HiLL checkpoint
  bookkeeping.
- The final review caught a documented project-root semantics gap. The fix
  resolved project config from nested working directories and added resolver plus
  provider CLI regression coverage.

## Tradeoffs Made

- The panel wrapper was implemented as direct fan-out over `consensus run`
  rather than by extending the convergence loop, keeping the new feature
  isolated from two-peer iteration semantics.
- Multi-round panel discussion was deferred because it changes the product from
  independent breadth gathering into deliberation with cross-talk and different
  state/resume concerns.

## Integration Notes

- Project config lives at `.consensus/config.json`; reads walk upward from the
  invocation cwd to find the nearest existing project config, while a first
  project config write falls back to the explicit cwd.
- Shipped skill runtime code remains dependency-free. Any future changes to
  generated `.mjs` files should be made in canonical TypeScript source and
  regenerated with `pnpm run build`.
- Changed canonical skills must continue to bump their `SKILL.md` versions and
  keep top-level and metadata versions synchronized.

## Follow-up Items

- `BL-260701-add-multi-round-panel`: optional multi-round panel discussion where
  panelists can react to each other's initial responses.
