---
id: DR-261002-optional-rg-prefilter
title: Optional rg prefilter with Node verification
date: 2026-10-02
status: accepted
legacy_id: null
---

# Optional rg prefilter with Node verification

## Context

The skill CLI must be dependency-free, yet rg and sqlite3 make large stores far faster when present, and results must not depend on which tools a machine has.

## Decision

rg and sqlite3 are optional accelerators detected at runtime (with env overrides and Homebrew absolute paths); rg -l --no-config -a serves only as a provable-superset file prefilter, and Node verifies and classifies every hit. After real stores proved to JSON-escape / and HTML-sensitive characters, the prefilter runs only for patterns made of never-escaped characters.

## Consequences

Results are identical with and without rg, which tests assert; patterns containing escaped characters fall back to the Node scan; the deep tier always skips the prefilter.
