---
id: DR-260724-use-buffered-manual-wake
title: Use buffered-manual wake for Cursor
date: 2026-07-24
status: accepted
legacy_id: null
---

# Use buffered-manual wake for Cursor

## Context

Finite authenticated probes found no reliable same-parent Stop callback, managed callback, or existing scheduled surface on the measured Cursor path.

## Decision

Select buffered-manual as Cursor's honest wake tier and require an external or user turn to start a pinned catch-up before acting on peer context.

## Consequences

Cursor can participate as a reliably observed peer, but the project does not claim autonomous wake until a future provider callback or scheduler passes the complete live evidence sequence.
