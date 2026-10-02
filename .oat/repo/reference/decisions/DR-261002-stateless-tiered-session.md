---
id: DR-261002-stateless-tiered-session
title: Stateless tiered session search
date: 2026-10-02
status: accepted
legacy_id: null
---

# Stateless tiered session search

## Context

Finding a past coding-agent session meant grepping multi-GB stores (about 12 GB on the larger machine, where a full rg did not finish in 120 s), while history and metadata tiers answer most queries in about 1 s or less.

## Decision

session-search keeps no index or cache; it searches history files, then metadata indexes, then a bounded user/assistant content scan, then a deep rung with tool output, narrowed by time windows, cwd hints, and noise exclusion. A persistent FTS index was rejected.

## Consequences

No index maintenance, staleness handling, or new secret-bearing artifact; unhinted deep scans on very large stores stay slow, mitigated by the large-scan guard (exit 3, --allow-large-scan) and --deadline-ms.
