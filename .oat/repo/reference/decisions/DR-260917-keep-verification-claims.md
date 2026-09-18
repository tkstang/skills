---
id: DR-260917-keep-verification-claims
title: Keep verification claims narrow
date: 2026-09-17
status: accepted
legacy_id: null
---

# Keep verification claims narrow

## Context

Local tagged fixtures and temporary homes can prove exact-tag selection, path placement, bytes, and executable modes, but they cannot prove signed provenance, real-home behavior, fresh provider discovery, or live invocation.

## Decision

Document automated copy-fidelity evidence separately from release provenance and live host acceptance, and require explicit live checks for every advertised host and scope before claiming provider-path completion.

## Consequences

The implementation can merge with strong static evidence while the six-row live acceptance matrix remains visibly pending and authority-gated.
