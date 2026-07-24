---
id: DR-260724-separate-observation
title: Separate observation and collaboration cursors
date: 2026-07-24
status: accepted
legacy_id: null
---

# Separate observation and collaboration cursors

## Context

Ordinary observation and completion-sensitive collaboration have different authority and completion requirements; sharing a cursor could let public delivery spend private continuation state.

## Decision

Maintain separate observer delivery state and lease-scoped private collaboration continuity, with selected-prefix binding and compare-and-swap ownership.

## Consequences

Public reads cannot authorize or consume automatic continuation, and stale or duplicate completion claims cannot advance collaboration budgets.
