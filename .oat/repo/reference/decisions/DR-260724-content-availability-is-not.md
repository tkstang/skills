---
id: DR-260724-content-availability-is-not
title: Content availability is not completion
date: 2026-07-24
status: accepted
legacy_id: null
---

# Content availability is not completion

## Context

Cursor can expose stable substantive output before a reliable lifecycle terminal, while completion-sensitive collaboration must not act on open or unsuccessful turns.

## Decision

Treat prefix-stable substantive content as observable after stability confirmation, but require terminal lifecycle success for automatic continuation and other completion-sensitive consumers.

## Consequences

Cursor collaboration gains timely reliable observation without falsely presenting partial output as a completed peer turn; consumers must keep availability and completion as separate states.
