---
id: DR-260914-session-and-consensus-plugin
title: Session and consensus plugin boundaries
date: 2026-09-14
status: accepted
legacy_id: null
---

# Session and consensus plugin boundaries

## Context

The repository needed coherent plugin groupings for session transfer operations and cross-session observation while several skills shared transcript code.

## Decision

Ship handoff, transcript export, and destination-fork guidance in the session plugin. Ship observer and observer-collab in the consensus plugin. Group products by behavior rather than by shared-code location, while retaining explicitly verified standalone forms.

## Consequences

Session and consensus have independent provider manifests and release versions. Shared transcript code remains separately owned and generated into each installation target that needs it; plugin membership does not create an implicit sibling-install dependency.
