---
id: DR-260917-constrain-the-payload
title: Constrain the payload and source identity
date: 2026-09-17
status: accepted
legacy_id: null
---

# Constrain the payload and source identity

## Context

Authored skill source may require generated runtime and resources, while branches and compatibility names do not provide immutable release identity.

## Decision

Install only the generated skills/<name>/ payload from the commit peeled from an exact qualified tag. Do not fall back to authored source, plugin payloads, branches, or compatibility aliases.

## Consequences

Release tags must contain build-validated standalone payloads. The narrower contract makes installed content deterministic and prevents incomplete source-only installs.
