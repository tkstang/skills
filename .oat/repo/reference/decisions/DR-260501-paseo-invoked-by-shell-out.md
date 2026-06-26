---
id: DR-260501-paseo-invoked-by-shell-out
title: Paseo invoked by shell-out, never embedded
date: 2026-05-01
status: Superseded by DR-023.
legacy_id: DR-002
---

### DR-002: Paseo invoked by shell-out, never embedded

- **Date:** 2026-05-01
**Context:** The consensus plugin needs peer-CLI orchestration (provider abstraction, structured-output validation with retry, subprocess lifecycle). Paseo provides all of it but is AGPL-3.0-or-later; the plugin is MIT.
**Decision:** Shell out to the `paseo` binary as an external prerequisite (like `git` or `node`). Never vendor or embed Paseo source. Users install Paseo themselves; `scripts/install-paseo.mjs` offers opt-in, confirm-first install assist. Preflight validates availability via `paseo provider ls --json` and warns outside the tested version range (0.1.0–0.9.0 at v0.1).
**Rationale:** Shelling out keeps the license boundary clean (no copyleft contamination), delegates the hard orchestration problems to a maintained tool, and keeps the plugin dependency-free Node stdlib. Subprocess overhead (~100–200 ms/turn) is negligible against LLM latency. Risk of Paseo CLI drift is mitigated by version-range checks.
- **Status:** Superseded by DR-023.
