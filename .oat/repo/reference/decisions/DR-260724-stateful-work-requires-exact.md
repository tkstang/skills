---
id: DR-260724-stateful-work-requires-exact
title: Stateful work requires exact identity
date: 2026-07-24
status: accepted
legacy_id: null
---

# Stateful work requires exact identity

## Context

Working-directory, recency, and project-slug matches can identify multiple Cursor candidates and cannot safely own persisted offsets or collaboration leases.

## Decision

Require confirmed canonical project, session, and transcript identity plus verified continuity before stateful cursor, lease, or continuation operations; retain weak matches only as diagnostics.

## Consequences

Ambiguous, replaced, rotated, truncated, or incompletely indexed transcripts fail visibly and require explicit recovery instead of silently switching, replaying, or skipping content.
