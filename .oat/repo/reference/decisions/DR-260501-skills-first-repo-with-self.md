---
id: DR-260501-skills-first-repo-with-self
title: Skills-first repo with self-contained sub-plugins; OAT scaffolding
  invisible to plugin consumers
date: 2026-05-01
status: Accepted.
legacy_id: DR-001
---

### DR-001: Skills-first repo with self-contained sub-plugins; OAT scaffolding invisible to plugin consumers

- **Date:** 2026-05-01
**Context:** The repo needed to ship the consensus plugin publicly while remaining the long-term home for all personal skills, and it is OAT-initialized (`.oat/`, `.agents/`) for private project management.
**Decision:** Plugins are self-contained packages under `plugins/<name>/` carrying their own provider manifests (`.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`); repo-root marketplace files declare them via `source.path`. Top-level `skills/` is reserved for standalone skills not part of any published plugin. Plugin manifests, skills, and published scripts never reference `.oat/` or `.agents/` paths; validation enforces the boundary.
**Rationale:** The sub-plugin pattern lets the repo grow additional plugin groups (e.g. `plugins/research/`) without restructuring, keeps each plugin independently installable, and lets internal process tooling evolve without affecting published deliverables. Consumers install plugins without OAT.
- **Status:** Accepted.
