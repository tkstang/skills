---
id: DR-260920-retrospectives-use-frozen
title: Retrospectives use frozen evidence
date: 2026-09-20
status: accepted
legacy_id: null
---

# Retrospectives use frozen evidence

## Context

Live session reads can drift and mix later evidence into the episode being reviewed, weakening reproducibility and provenance.

## Decision

Run a retrospective from a different known native session, freeze one exact target into paired narrative and activity files, and ground findings only in that frozen pair.

## Consequences

Findings are reproducible and provenance-bounded. Later live context may inform comparison but cannot silently rewrite the reviewed episode.
