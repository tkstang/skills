---
id: DR-260514-deterministic-tier-based
title: Deterministic tier-based session ranking with explicit no-match widening
date: 2026-05-14
status: Accepted.
legacy_id: DR-008
---

### DR-008: Deterministic tier-based session ranking with explicit no-match widening

- **Date:** 2026-05-14
**Context:** Multiple candidate transcripts can match a project directory; selection must be predictable, not heuristic.
**Decision:** Rank candidates in lexicographic tiers: Tier A exact-cwd match (after realpath normalization), Tier B bidirectional ancestor/descendant path match, Tier C no match — which returns `noMatch` with widening options (sister worktrees, explicit cwd, global-most-recent) instead of silently falling through. Within a tier, newest mtime wins; near-ties (5 s window) surface as user choices; `--session <runtime:id>` pins past ranking entirely.
**Rationale:** Tiers are testable and explainable; weighted scores hide magic constants. Explicit no-match prevents silently digesting an unrelated session — the worst failure mode for a peer-review tool.
- **Status:** Accepted.
