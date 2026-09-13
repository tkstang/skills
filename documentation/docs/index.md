---
title: 'skills'
description: 'A personal home for Agent Skills and the consensus and session plugins, with explicit optional standalone skill distributions.'
---

# skills

> Status: v0.1.

A personal Agent Skills home — standalone skills under `skills/` and packaged
plugins under `plugins/<name>/`, runnable across Claude Code, Codex, and Cursor.
It ships the **consensus** plugin (provider-CLI-backed AI peers plus session
observation/collaboration), the **session** plugin (handoff, transcript export,
and destination-fork guidance), and explicitly declared standalone forms.

These docs are organized by audience. If you want to **install and use** what
this repo ships, start in the User Guide. If you want to understand **how it
works or contribute**, head to Engineering.

## Contents

- [User Guide](user-guide/index.md) — Install, use, and configure the consensus plugin and the standalone skills.
- [Engineering](engineering/index.md) — Architecture, the generated-runtime build contract, repository layout, and contributing.
