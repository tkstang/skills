---
id: DR-260914-declared-skill-distributions
title: Declared skill distributions
date: 2026-09-14
status: accepted
legacy_id: null
---

# Declared skill distributions

## Context

Authored skills previously mixed source ownership with standalone and plugin installation layouts, which made copies drift and obscured dependency and release boundaries.

## Decision

Keep each skill's complete authored source under src/skills and declare every supported standalone or plugin target in one typed distribution catalog. Generate self-contained installation units, bundle shared runtime into each target, and declare real workflow prerequisites without automatic installation.

## Consequences

Generated payloads are derivative and must never be edited directly. The builder, freshness checks, installed-artifact tests, and version fan-out all derive from the same declarations; adding a distribution requires catalog and boundary evidence rather than another packaging framework.
