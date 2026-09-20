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
