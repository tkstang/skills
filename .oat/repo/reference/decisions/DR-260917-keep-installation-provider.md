---
id: DR-260917-keep-installation-provider
title: Keep installation provider-specific
date: 2026-09-17
status: accepted
legacy_id: null
---

# Keep installation provider-specific

## Context

Codex, Claude Code, and Cursor use different skill directories, while existing repository workflows already own canonical cross-provider mirroring.

## Decision

Write only the destination for the explicitly selected provider and do not create cross-provider mirrors or invoke oat sync.

## Consequences

Installing for multiple hosts requires separate commands, but one install cannot unexpectedly mutate unrelated provider views or interfere with the existing synchronization workflow.
