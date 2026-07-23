---
id: BL-260718-make-consensus-records
title: Make consensus records and status writes atomic
status: closed
priority: high
scope: task
scope_estimate: S
labels:
  - repo-audit
  - consensus
  - correctness
assignee: null
created: 2026-07-18T00:04:09Z
updated: '2026-07-23T02:58:07Z'
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-atomic-consensus-records-writes.md
---

## Description

The consensus loop writes records.json (resumable deliberation history) and the loop status file in place on every peer/synthesis turn (src/consensus/core/consensus-loop.ts:1226-1229). A process kill mid-write leaves truncated JSON, and readExistingRecords then throws on every resume — the session is permanently lost. Replace both write sites with the temp-file + fsync + rename pattern already proven in the session-observer state stores.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-atomic-consensus-records-writes.md`, planned at commit 8309623).

## Acceptance Criteria

- flush() and writeLoopStatus write via same-directory temp + rename with byte-identical content
- Tests prove no tmp residue and previous-file survival when a write fails
- refine and evaluate SKILL.md versions bumped; build, build:check, test, validate all pass
