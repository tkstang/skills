---
id: BL-260620-mid-loop-user-artifact-edits
title: Mid-loop user artifact edits (type=edit intervention) — for discussion
status: open
priority: low
scope: idea
scope_estimate: S
labels:
  - consensus
  - consensus-loop
  - undecided
assignee: null
created: 2026-06-20T00:10:39Z
updated: 2026-06-20T00:10:39Z
associated_issues: []
legacy_id: bl-58b3
---

## Description

**Status: undecided / for discussion — captured so it is not lost, not yet a
commitment.**

v3 open question #4 ("User intervention richness"): beyond the shipped
"new direction + new budget" intervention, should the user be able to inject
**explicit edits to the artifact mid-loop** and have the peers continue from that
edited state? The architecture sketches capturing this as a
`<user round=N type=edit>` entry in the deliberation log.

**Source:** `research/consensus/architecture-v3.md` (Open design questions #4;
"Mid-skill UX" — "User can manually edit a section's working state and tell the
skill to resume").

**Today:** resume already records user steering as a `USER_INTERVENTION` round and
host decisions as `HOST_DECISION` rounds, and the artifact is the canonical
resumable state — so a user *can* hand-edit the artifact between runs. What is
undecided is whether to make a **first-class `type=edit` intervention** (peers
explicitly told "the user edited this, continue from here") distinct from a
direction/steering prompt, with its own audit semantics.

**Open for discussion:** is this meaningfully different from the existing
hand-edit-then-resume path, or does the canonical-artifact resume already cover
it? Decide before building.

## Acceptance Criteria

- Decision recorded on whether a distinct `type=edit` user intervention adds
  value over the existing artifact-edit-then-resume path (may resolve `wont_do`).
- If pursued: `type=edit` interventions are logged as first-class audit entries
  and peers are framed to continue from the user-edited state.
