---
id: DR-260503-editorial-agency-is
title: Editorial agency is a deterministic user-facing flag, shipped at v0.1
date: 2026-05-03
status: Accepted.
legacy_id: DR-006
---

### DR-006: Editorial agency is a deterministic user-facing flag, shipped at v0.1

- **Date:** 2026-05-03
**Context:** The v3 architecture planned agency (minimal/moderate/maximum) for a later phase, but convergence strictness and impasse handling needed the parameter anyway.
**Decision:** Expose `--agency minimal|moderate|maximum` at v0.1. Agency deterministically modulates (a) hash convergence strictness (minimal = bytewise; moderate = normalized; maximum = normalized + near-match acceptance on consecutive ACCEPTs) and (b) impasse handling at max-rounds/oscillation (minimal = always surface; moderate = surface meaningful disagreements; maximum = orchestrator may declare best-effort done, logging the decision). The setting is written to artifact frontmatter and preserved across resume.
**Rationale:** Deterministic-once-set beats heuristics for auditability; recording agency in the artifact makes runs reproducible and resumable under the original posture. Future iteration modes add more agency decision points to the same table.
- **Status:** Accepted.
