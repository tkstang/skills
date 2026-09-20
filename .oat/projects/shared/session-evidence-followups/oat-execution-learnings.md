---
oat_generated: false
---

# Execution learnings

## 2026-09-20

- One approved wave uses one canonical plan, not external plans or a separate execution program (explicit user clarification).
- User-selected Opus through Consensus Review replaces duplicate default framework reviewer/gate routes; Sol implements. No second wave is authorized.
- CLI scaffolding succeeded but its path-limited automatic commit hit an index.lock during lint-staged. The lock was absent on inspection; retry a normal scoped staged commit, never delete a lock blindly.
- Native Claude availability names are in attachment.names; invoked names are in attachment.skills[].name. Distinguish availability from invocation and omit instruction bodies.
- Native Codex provider-limit retry timing occurs in a message string. Preserve extracted text/provenance and time ambiguity, not an invented absolute retry timestamp.

- The valid Opus pass is full-plan review plus narrow H1 verification; avoid repeating a full audit for an isolated grammar correction.
- Consensus reply format distinguishes repository locations from external anchors, and changes_requested requires Critical/High. Include these constraints in later review requests so valid findings are not lost to response-shape rejection.
- User explicitly requested 15-minute Consensus Review default, scoped as p00-t01 before remaining execution. One PR remains confirmed.
