---
id: BL-260919-collaboration-protocol-peer
title: "Collaboration protocol: peer-initiated headless resume and provenance"
status: open
priority: medium
scope: task
scope_estimate: S
labels:
  - session-observer-collab
  - protocol
assignee: null
created: 2026-09-19T19:24:01.060Z
updated: 2026-09-19T19:24:01.060Z
associated_issues: []
external_plans: []
---

## Description

During the session-fidelity collaboration on 2026-09-19 one peer resumed the other peer's Claude Code session headlessly (`claude -p --resume <session>` in plan mode) twice to obtain a read-only review while that peer was idle. The reviews were useful and read-only, but the protocol does not mention this path: the prompts were appended to the peer's transcript as ordinary `user` records, the live session had no memory of the work attributed to it, and the transcript gained a second writer. The collaboration skill's authority rules treat peer text as context, never instruction, and a later retro of such a transcript needs to tell the writers apart.

## Acceptance Criteria

- The collaboration skill states whether a peer may resume the other peer's session headlessly, and if so under what conditions (read-only permission mode, user consent, bounded prompt).
- Records produced by such a resume are identifiable from recorded evidence (for example the recorded entrypoint), and the skill tells the resumed instance and the live instance how to disclose it.
- The protocol says how findings from a headless run are attributed and that the live peer must read them back before they count as its position.
- The schema reference notes that one transcript file can have concurrent writers and what evidence distinguishes them.
