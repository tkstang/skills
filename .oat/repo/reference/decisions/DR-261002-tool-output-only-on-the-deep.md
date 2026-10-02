---
id: DR-261002-tool-output-only-on-the-deep
title: Tool output only on the deep rung
date: 2026-10-02
status: accepted
legacy_id: null
---

# Tool output only on the deep rung

## Context

Tool output is the bulk of store bytes and noise, but the motivating session was findable only through ChatGPT titles captured in Codex MCP tool output.

## Decision

Tool output is excluded from routine tiers and searched only on the final deep rung (run when nothing else matched and the content tier is selected) or when --include-tools labels the content scan deep.

## Consequences

Routine results rank on user and assistant text; tool-only matches are still reachable before an empty result is reported; the deep rung skips the rg prefilter and is slower.
