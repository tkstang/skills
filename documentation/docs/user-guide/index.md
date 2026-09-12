---
title: 'User Guide'
description: 'Install, use, and configure the consensus plugin and the standalone skills shipped by this repo.'
---

# User Guide

How to install and use what this repo ships. Everything here is consumer-facing:
install commands, usage, capabilities, configuration, and limitations. For
internals and contribution guidance, see the [Engineering](../engineering/index.md)
trunk instead.

What ships today:

- **Consensus plugin** — `create`, `decide`, and `plan` start from a brief,
  options, or goal; `refine` and `evaluate` converge or judge artifacts with
  audit trails; `phone-a-friend` asks one peer for a one-shot advisory take.
- **Standalone skills** — `session-observer` (review what another coding agent
  did), `session-observer-collab` (coordinate two exactly pinned agent
  sessions), `export-session-transcript` (export the current session to
  sanitized Markdown), and `complexity-review` (judge whether a plan or
  implementation's machinery earns its cost).

## Contents

- [Installation](installation.md) — Install the consensus plugin per provider (Claude Code, Codex, Cursor) and check prerequisites.
- [Consensus](consensus/index.md) — Overview, `create`, `decide`, `plan`, `refine`, `evaluate`, `phone-a-friend`, and shared configuration.
- [Skills](skills/index.md) — The standalone session skills and the complexity review.
