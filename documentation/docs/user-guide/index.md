---
title: 'User Guide'
description: 'Install and use the plugins, standalone skills, and Session Toolkit CLI and library.'
---

# User Guide

Install, use, and configure the skills and tools in this collection. New here? Start with
[Getting Started](getting-started/index.md). For implementation details and
contribution guidance, see [Engineering](../engineering/index.md).

What ships today:

- **Consensus plugin** — `create`, `decide`, and `plan` start from a brief,
  options, or goal; `refine` and `evaluate` converge or judge artifacts with
  audit trails; `panel` collects attributed perspectives; `phone-a-friend`
  asks one peer for an advisory take, one-shot by default with bounded
  follow-up rounds on request;
  `observer` and `observer-collab` provide plugin-local session observation.
- **Session plugin** — `align`, `debrief`, `sitrep`, and `reorient` clarify
  intent, recent history, current progress, and the whole thread; `next-steps`
  recommends an action. `messaging`, `handoff`, `export-transcript`, `search`,
  `fork-to-destination`, `seshtk-cli`, and `retro` support coordination,
  continuity, session evidence, and lessons.
- **Session Toolkit** — the `seshtk` terminal command and typed ESM library
  find, read, search, and export local Claude Code, Codex, and Cursor sessions.
- **Optional standalone skills** — every Session member is also available
  individually; its guide gives both names. Observer and Collaborative Observer
  remain standalone and Consensus members only. `author-skill`, `explain-options`,
  `must-we`, `complexity-review`, `babysit-pr`, and `land-pr` remain standalone only.
  The PR skills repair CI/review findings until green; only `land-pr` merges.
  Consensus `phone-a-friend` and `review` are also available as the standalone
  skills `phone-a-friend` and `consensus-review`; its six other peer workflows
  remain plugin-only.

Plugin and standalone entries share canonical guides rather than duplicate
documentation. Pick by the task you want to accomplish, then use the guide's
installation names for the form you have installed.

## Contents

- [Getting Started](getting-started/index.md) — Choose an installation form and try a bounded request.
- [Plugins](plugins/index.md) — Compare Consensus and Session, then explore their members.
- [Standalone Skills](skills/index.md) — Find every independently installable skill by capability.
- [Session Toolkit](session-toolkit/index.md) — Use the `seshtk` CLI and typed session APIs.
- [Installation](installation.md) — Provider setup, standalone installation, prerequisites, and updates.
- [Consensus](consensus/index.md) — Peer workflows, observation, collaboration, and configuration.
