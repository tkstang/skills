---
id: BL-260919-verify-live-agent-messaging
title: Verify live agent-messaging host acceptance
status: open
priority: medium
scope: task
scope_estimate: S
labels:
  - multi-agent
  - messaging
  - acceptance
assignee: null
created: 2026-09-19T21:22:58.875Z
updated: 2026-09-19T21:22:58.875Z
associated_issues: []
external_plans: []
---

## Description

Run the separately authorized live acceptance matrix for agent messaging after deterministic implementation is complete: Codex prompt/Stop delivery, Claude prompt/Stop/watch delivery, and Claude composed Monitor wake delivery. Live provider execution, installation, credentials, release, and publication remain outside the implementation project and require explicit authorization.

Follow-up for [BL-260619-inter-agent-direct-messaging — Inter-agent direct messaging (addressable, prioritized)](../archived/BL-260619-inter-agent-direct-messaging.md).

## Acceptance Criteria

- Record explicit authorization before each live-provider or host-installation run, including the approved provider, boundary, credentials, quota, and cleanup scope.
- Verify Codex prompt and Stop delivery with an enrolled exact-session recipient, preserving the observed host output and delivery/acknowledgment evidence.
- Verify Claude prompt, Stop, and watch delivery against the resolved settings inventory, preserving the observed host output and delivery/acknowledgment evidence.
- Verify a finite Claude composed Monitor wake from arm through launch and required re-arm, preserving the Monitor terminal outcome and invocation evidence.
- Record failures without treating deterministic fixtures, generated payload parity, or one provider tier as proof of another tier; do not publish or release as part of this acceptance task.
