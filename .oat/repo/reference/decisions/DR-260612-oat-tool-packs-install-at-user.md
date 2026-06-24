---
id: DR-260612-oat-tool-packs-install-at-user
title: OAT tool packs install at user scope; the repo keeps only the workflow
  pack and project-local stubs
date: 2026-06-12
status: Accepted current-state exception.
legacy_id: DR-017
---

### DR-017: OAT tool packs install at user scope; the repo keeps only the workflow pack and project-local stubs

- **Date:** 2026-06-12
**Context:** Repo-committed `.agents/` skill packs (analyze, research, docs, utility, brainstorm, etc.) duplicated user-level installs and bloated the repo (~15k lines removed).
**Decision:** General-purpose OAT packs live at `~/.agents/skills/` (user scope). The repo keeps the project-lifecycle workflow pack, the project-management (`oat-pjm-*`) backlog structure under `.oat/repo/reference/backlog/`, and minimal repo-local agent stubs.
**Rationale:** User-scoped packs update once per machine instead of per-repo, and the repo's committed surface stays focused on what it ships.
- **Status:** Accepted current-state exception.

**Drift note (2026-06-24):** Fleet audit and live repo state show `.agents/skills/` still contains the full OAT pack, not only the workflow pack and project-local stubs described here. The current fleet remediation accepts that committed surface as the repo's review state for now. User-scoped packs remain the preferred destination for general-purpose OAT installs, but this repo should only remove the extra committed pack surface through an explicit tool-owned packaging or sync decision, not as a manual drift cleanup.
