---
title: 'skills'
description: 'A personal home for Agent Skills and plugins, including the consensus deliberation plugin.'
---

# skills

> Status: v0.1 pre-release.

A personal Agent Skills home — standalone skills under `skills/` and packaged
plugins under `plugins/<name>/`, runnable across Claude Code, Codex, and Cursor.
It ships the **consensus** plugin (two provider-CLI-backed AI peers deliberate
over an artifact toward a converged result with an audit trail) plus standalone
session skills (peer-transcript review and sanitized session export).

These docs are organized by audience. If you want to **install and use** what
this repo ships, start in the User Guide. If you want to understand **how it
works or contribute**, head to Engineering.

## Contents

- [User Guide](user-guide/index.md) — Install, use, and configure the consensus plugin and the standalone skills.
- [Engineering](engineering/index.md) — Architecture, the generated-runtime build contract, repository layout, and contributing.
