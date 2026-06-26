---
id: BL-260626-configure-default-consensus
title: Configure default panel/consensus agent configs via CLI
status: open
priority: medium
scope: feature
scope_estimate: M
labels:
  - consensus
  - provider-cli
  - cli
  - config
assignee: null
created: 2026-06-26T04:55:26Z
updated: 2026-06-26T04:55:26Z
associated_issues: []
---

## Description

Add CLI support for configuring your **default** panel / consensus agent
configuration (which providers/models to use, default panel size, and any
role-specific defaults), so users do not have to re-specify the same agent
composition on every invocation of a consensus-family skill.

Today peer/panel composition is specified per invocation. This item adds a
persisted, user-owned default that the consensus skills read when no
per-invocation override is given. It is the enabling dependency for the
"use my default panel" ergonomics in **BL-260626-add-consensus-panel-skill**,
and it benefits the rest of the family (`refine`, `evaluate`, `phone-a-friend`)
the same way. These two items are intended to be the **same project**.

Scope/design to settle at build:

- What is configurable: default provider(s)/model(s), default panel size, and
  potentially per-role defaults (e.g. a moderator vs panelist distinction, or a
  default advisory peer for `phone-a-friend`).
- Precedence ordering: per-invocation flag > project config > user config >
  built-in default. Keep this explicit and documented.
- Storage location + schema (user scope vs project scope), validated against the
  provider inventory/preflight so a default cannot silently point at an
  unavailable provider.
- CLI surface: `consensus config`-style get/set/list (or equivalent) on the owned
  provider CLI.

## Acceptance Criteria

- CLI commands exist to view, set, and clear default consensus/panel agent
  configuration (at minimum: default providers/models and default panel size;
  per-role defaults if in scope).
- Defaults are persisted in a documented location with a documented precedence
  order (per-invocation flag > project > user > built-in).
- Consensus-family skills read these defaults when no per-invocation override is
  supplied, and per-invocation flags still win.
- Configuration is validated against the provider inventory/preflight, warning
  (or refusing, per design) when a configured provider/model is unavailable.
- The config schema and precedence are documented in the documentation site with
  examples; tests cover precedence resolution and validation.
- BL-260626-add-consensus-panel-skill can consume these defaults for its default
  panel composition.
