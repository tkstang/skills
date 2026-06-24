---
id: DR-260603-watch-is-a-foreground-polling
title: Watch is a foreground polling watcher with a shared observe pipeline, not
  a daemon or provider hooks
date: 2026-06-03
status: Accepted.
legacy_id: DR-012
---

### DR-012: Watch is a foreground polling watcher with a shared observe pipeline, not a daemon or provider hooks

- **Date:** 2026-06-03
**Context:** Implementing watch mode required choosing among foreground polling (streams into the active agent invocation), a detached daemon (cannot trigger future agent turns), and provider hooks (uneven host support).
**Decision:** Foreground stat-based polling with debounce coalescing, emitting catch-up digests to stdout for the active agent to respond to. One-shot `catch-up` and the watch loop share an extracted `observe.mjs` pipeline (selection → digest → offset update). Control via `watch-ctl status|pause|resume|flush|stop`; lock-protected watcher state with stale-PID cleanup; multi-watcher safety with duplicate-target rejection (hardened in PR #7, 2026-06-11).
**Rationale:** Foreground delivers the actual need — automatic responses during an active session — without over-promising post-session automation. Polling is OS-agnostic and deterministic for injected-time tests. The shared pipeline prevents one-shot and watch behavior from diverging.
- **Status:** Accepted.
