---
title: 'User Guide'
description: 'Install and use the consensus and session plugins or their declared standalone skill forms.'
---

# User Guide

How to install and use what this repo ships. Everything here is consumer-facing:
install commands, usage, capabilities, configuration, and limitations. For
internals and contribution guidance, see the [Engineering](../engineering/index.md)
trunk instead.

What ships today:

- **Consensus plugin** — `create`, `decide`, and `plan` start from a brief,
  options, or goal; `refine` and `evaluate` converge or judge artifacts with
  audit trails; `phone-a-friend` asks one peer for a one-shot advisory take;
  `observer` and `observer-collab` provide plugin-local session observation.
- **Session plugin** — `handoff`, `export-transcript`, and
  `fork-to-destination` package continuation, sanitized export, and
  experimental destination-side fork guidance.
- **Optional standalone skills** — the session capabilities retain descriptive
  `session-*` names, while `complexity-review` remains standalone only.

## Contents

- [Installation](installation.md) — Choose plugin or standalone forms, install per provider, and check prerequisites and release evidence.
- [Consensus](consensus/index.md) — Overview, peer workflows, session observation members, and shared configuration.
- [Skills](skills/index.md) — Choose portable continuation, sanitized export, or same-provider native fork guidance, then find canonical and plugin-local skill names.
