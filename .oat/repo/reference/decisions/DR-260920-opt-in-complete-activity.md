---
id: DR-260920-opt-in-complete-activity
title: Opt-in complete activity export
date: 2026-09-20
status: accepted
legacy_id: null
---

# Opt-in complete activity export

## Context

Compact Observer and narrative defaults intentionally omit detail, while retrospective analysis needs every supported invocation from one captured snapshot.

## Decision

Expose complete structured activity only through explicit --activity-output as one sensitive JSON artifact paired with the narrative, retaining bounded previews and unchanged ordinary defaults.

## Consequences

Complete captured activity is available without turning default output into a large or publish-safe analytics stream.
