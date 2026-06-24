---
id: DR-260514-session-observer-is-standalone
title: session-observer is standalone — peer-transcript adapters ported, not
  depended on
date: 2026-05-14
status: Accepted.
legacy_id: DR-007
---

### DR-007: session-observer is standalone — peer-transcript adapters ported, not depended on

- **Date:** 2026-05-14
**Context:** Stoa already had transcript adapters and a proven lock/atomic-rename state pattern. session-observer needed the same per-runtime knowledge.
**Decision:** No runtime dependency on Stoa. Per-runtime transcript logic (Claude Code encoded-cwd dirs, Codex session-meta extraction, later Cursor agent transcripts) was ported into the skill's own `runtimes.mjs`; the state layer reuses the lock + temp + rename pattern by reimplementation. Transcript reads are strictly read-only; state writes confined to `~/.local/state/session-observer/`.
**Rationale:** The skill must work on machines that never installed Stoa. The adapters are small enough that porting beats coupling; drift is handled by owning the copies (later restructured by DR-014).
- **Status:** Accepted.
