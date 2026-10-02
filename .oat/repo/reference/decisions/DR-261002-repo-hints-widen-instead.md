---
id: DR-261002-repo-hints-widen-instead
title: Repo hints widen instead of filtering
date: 2026-10-02
status: accepted
legacy_id: null
---

# Repo hints widen instead of filtering

## Context

Users often misremember which repo or directory a session ran in, so a hard cwd filter would return false 'not found' results.

## Decision

A --cwd hint is searched first; if that scoped pass finds no sessions, the history, metadata, and content tiers rerun unscoped and the result reports widened: true.

## Consequences

Hinted searches stay fast when the hint is right and never fail closed when it is wrong; consumers must read the widened flag to know the scope changed.
