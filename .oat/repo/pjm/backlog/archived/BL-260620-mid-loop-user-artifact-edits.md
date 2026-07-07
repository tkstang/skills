---
id: BL-260620-mid-loop-user-artifact-edits
title: Mid-loop user artifact edits (type=edit intervention) — for discussion
status: wont_do
priority: low
scope: idea
scope_estimate: S
labels:
  - consensus
  - consensus-loop
  - decision-sweep
assignee: null
created: 2026-06-20T00:10:39Z
updated: 2026-07-07T03:50:31Z
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

## Verdict

Resolved `wont_do` on 2026-07-07.

Do not add a distinct `type=edit` user intervention. The supported path remains:
the user edits the canonical artifact, resumes with `--user-direction` that
states what changed or what should happen next, and the existing
`USER_INTERVENTION` round records that direction.

A separate edit event type would require diff capture, artifact provenance rules,
resume-hash semantics, and extra peer framing, but it would not unlock a workflow
that the canonical-artifact resume path does not already support. Revisit only if
real audit requirements need machine-readable user edit diffs rather than a user
direction note.

## Acceptance Criteria

- Decision recorded: a distinct `type=edit` user intervention does not add enough
  value over the existing artifact-edit-then-resume path to justify new loop
  semantics.
- No implementation planned.
