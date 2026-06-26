---
id: DR-260603-watch-event-logs-are-metadata
title: Watch event logs are metadata-only and path-hardened to the state directory
date: 2026-06-03
status: Accepted.
legacy_id: DR-013
---

### DR-013: Watch event logs are metadata-only and path-hardened to the state directory

- **Date:** 2026-06-03
**Context:** `--event-log` writes operational telemetry to a user-supplied path; transcript text is sensitive and paths are attacker-influenced.
**Decision:** Event logs record metadata only (timestamps, counts, runtime markers) — never message content, which goes to stdout only. Event-log paths resolve inside `~/.local/state/session-observer/`; absolute paths, traversal escapes, symlink escapes (realpath-checked), and reserved internal filenames are rejected.
**Rationale:** Separating agent-consumable output from telemetry means logs can be archived or shipped without leaking transcript content; path hardening protects the watcher's own state files from being overwritten via a crafted flag.
- **Status:** Accepted.
