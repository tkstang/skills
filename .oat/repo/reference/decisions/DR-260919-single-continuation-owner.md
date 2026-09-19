---
id: DR-260919-single-continuation-owner
title: Single continuation owner
date: 2026-09-19
status: accepted
legacy_id: null
---

# Single continuation owner

## Context

Observer and messaging integrations can share one session and continuation budget, but independent automatic loops or uncertain third-party hooks could duplicate wakes, overspend limits, or advance the wrong cursor.

## Decision

Require one proved continuation owner for each active session. Compose inbox and optional observation delivery through the owner-specific bounded hook or finite Claude Monitor, and refuse or require scoped acknowledgment when ownership is active, uncertain, or changed.

## Consequences

Inbox requests can take priority while sharing a finite budget with observation, dormant recognized hooks may coexist, and conflicting or unreadable ownership fails closed. Configuration changes require renewed acknowledgment, and restart or Monitor completion requires explicit re-arm.
