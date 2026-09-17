---
name: review
description: Use when an independent provider-backed reviewer should inspect an explicitly bounded branch, file set, or document without modifying it.
license: MIT
compatibility: Agent Skills baseline; requires Node.js 22+ and a supported provider CLI.
allowed-tools: Bash(node:*), Read
argument-hint: base_branch=<ref> | --files <paths...> | --document <path> --host <runtime>
metadata:
  author: thomas.stang
  version: '0.1.6'
---

# Consensus Review

This installation contains the skill-owned Review runtime, bounded scope and
selection modules, deep reply validation, external JSON state, and safe
single-turn provider transport. The end-user CLI and Markdown rendering are not
complete yet. Do not represent direct CLI execution as a completed review or
substitute a generic autonomous loop.

The installed executable is owned by this skill:

```bash
node ./scripts/review.mjs
```

Until the remaining workflow phase lands, direct CLI execution exits with a
`foundation_only` diagnostic and performs no provider invocation. The bundled
runtime exposes an internal, testable one-turn transaction for the later CLI.
It has no OAT runtime dependency, does not apply findings, and does not import
the consensus dispatcher or convergence loop.
