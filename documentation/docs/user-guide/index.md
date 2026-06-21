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

- **Consensus plugin** — `refine` (deliberate two AI peers toward a converged
  markdown artifact) and `evaluate` (judge an artifact against a rubric), with an
  audit trail.
- **Standalone skills** — `session-observer` (review what another coding agent
  did) and `export-session-transcript` (export the current session to sanitized
  Markdown).

## Contents

- [Installation](installation.md) — Install the consensus plugin per provider (Claude Code, Codex, Cursor) and check prerequisites.
- [Consensus](consensus/index.md) — Overview, `refine` and `evaluate` usage, and shared configuration.
- [Skills](skills/index.md) — The standalone session skills.
