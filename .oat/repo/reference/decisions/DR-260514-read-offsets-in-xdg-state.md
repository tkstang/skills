---
id: DR-260514-read-offsets-in-xdg-state
title: Read offsets in XDG state, keyed by runtime:sessionId, with locked atomic
  persistence
date: 2026-05-14
status: Accepted.
legacy_id: DR-009
---

### DR-009: Read offsets in XDG state, keyed by runtime:sessionId, with locked atomic persistence

- **Date:** 2026-05-14
**Context:** `catch-up` needs a durable high-water mark per observed session that survives crashes and concurrent writers.
**Decision:** State lives at `~/.local/state/session-observer/state.json`, keyed `${runtime}:${sessionId}` (not by cwd). All mutation happens under an exclusive-create lock with temp+rename atomic writes; corrupt files are backed up to unique timestamped names before reset; transcript shrinkage resets the offset with a warning.
**Rationale:** Session identity is stabler than cwd (sessions survive directory moves; re-ranking is cheap). XDG state semantics make it durable-but-not-precious. The lock scope covers reads too, because corruption backups write during load.
- **Status:** Accepted.
