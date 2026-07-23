---
id: BL-260718-cache-transcript
title: Cache transcript classification in watch loop
status: closed
priority: medium
scope: task
scope_estimate: M
labels:
  - repo-audit
  - session-observer
  - performance
assignee: null
created: 2026-07-18T00:04:09Z
updated: '2026-07-23T05:16:09Z'
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-07-17-watch-loop-classification-cache.md
---

## Description

The session-observer watch loop re-reads and re-parses every candidate transcript in full on every 2s poll tick (watch.ts:872/1177 → locate.ts discovery → full readRecords per candidate) — O(candidates × transcript size) churn for the life of every watch, with no cache unlike the codex cwd-cache path. Add an in-memory classification cache keyed by (path, mtime, size), behavior-identical on existing suites.

Source: 2026-07-17 repository audit (external plan at `.oat/repo/reference/external-plans/2026-07-17-watch-loop-classification-cache.md`, planned at commit 8309623).

## Acceptance Criteria

- Cache hits skip file reads; mtime/size change invalidates; watch output proven identical on existing suites
- session-observer SKILL.md bumped; full contract passes
