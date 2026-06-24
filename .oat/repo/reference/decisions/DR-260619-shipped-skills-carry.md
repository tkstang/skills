---
id: DR-260619-shipped-skills-carry
title: Shipped skills carry a validator-backed top-level `version`, kept in sync
  with `metadata.version`
date: 2026-06-19
status: Accepted.
legacy_id: DR-022
---

### DR-022: Shipped skills carry a validator-backed top-level `version`, kept in sync with `metadata.version`

- **Date:** 2026-06-19
**Context:** Skill frontmatter previously stored the version only inside the nested `metadata.version` block. The `create-agnostic-skill` template and provider/host tooling expect a top-level `version`, but adding one risked dual-source drift and the repo validator only recognized `metadata.version`.
**Decision:** Promote `version` to a top-level frontmatter field on shipped skills while retaining `metadata.version` during the compatibility transition. `scripts/validate.mjs` resolves the effective version from the top-level field when present, else `metadata.version`, validates semver, and — when both are present — requires them to match (fail-closed). Release tooling (`scripts/bump-version.mjs`, `SKILL_FILES`) updates both fields for every listed skill, and contributors bump a skill's `version` when they ship a behavior/content change (recorded in `AGENTS.md` Repository Conventions). Chosen over (a) a cosmetic top-level field the validator ignores — dual source of truth — and (b) skipping promotion — leaves skills off the template/provider convention.
**Rationale:** Makes the top-level `version` real and machine-enforced without a flag-day removal of `metadata.version`, so other providers that still read the nested field keep working. The match requirement prevents the two fields from drifting, and routing the bump through `bump-version.mjs` keeps every skill's fields aligned mechanically. First applied to consensus `refine` + `evaluate` (consensus-rubric-guidance).
- **Status:** Accepted.
