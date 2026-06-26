---
id: DR-260515-watch-mode-design-locked-but
title: Watch mode design-locked but deferred from session-observer v1
date: 2026-05-15
status: Superseded by DR-012 (watch shipped 2026-06-04).
legacy_id: DR-011
---

### DR-011: Watch mode design-locked but deferred from session-observer v1

- **Date:** 2026-05-15
**Context:** Continuous "watch and weigh in" was the eventual goal, but unproven ergonomics shouldn't block the high-value one-shot modes.
**Decision:** Ship `review`/`catch-up`/`locate`/`state` first; freeze the watcher design (poll-not-fs.watch, debounce, `watch-ctl` control surface, singleton enforcement, metadata-only event log) in `references/watch-design.md` so implementation could start later without re-litigating shape.
**Rationale:** Most value was in the simple modes; the locked design made the v2 build cheap and shape-stable.
- **Status:** Superseded by DR-012 (watch shipped 2026-06-04).
