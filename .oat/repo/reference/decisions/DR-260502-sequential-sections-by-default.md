---
id: DR-260502-sequential-sections-by-default
title: Sequential sections by default; parallel orchestration is host-mediated,
  fail-closed
date: 2026-05-02
status: Accepted.
legacy_id: DR-003
---

### DR-003: Sequential sections by default; parallel orchestration is host-mediated, fail-closed

- **Date:** 2026-05-02
**Context:** Multi-section documents benefit from parallel per-section deliberation. The v2 brainstorm assumed the wrapper would spawn its own sub-agents via `paseo run --detach`; the design had to choose who owns parallel dispatch.
**Decision:** Sequential section processing is the default. Parallel mode is opt-in and host-mediated: the wrapper prepares section packets and a manifest (`--prepare-parallel`), emits JSONL dispatch instructions, the host runtime dispatches section-runner subagents using its native mechanism, and the wrapper assembles results in original order via `--fan-in <manifest>`. The wrapper never owns host subagent processes. On Codex, subagent authorization is fail-closed: denial fails the parallel run rather than silently degrading to sequential.
**Rationale:** Host-native dispatch (Claude Task tool, Cursor native, Codex spawn_agent) is more robust than wrapper-owned detached processes and matches per-host capability tiers. Fail-closed authorization preserves auditability — no surprise behavior change mid-run. Parallel reduces wall-clock only, not token cost, so sequential remains the stable default.
- **Status:** Accepted.
