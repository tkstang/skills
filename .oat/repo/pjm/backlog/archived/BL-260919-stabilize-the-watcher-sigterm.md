---
id: BL-260919-stabilize-the-watcher-sigterm
title: Stabilize the watcher SIGTERM re-arm test
status: closed
priority: medium
scope: task
scope_estimate: S
labels:
  - session-observer
  - testing
  - ci
assignee: null
created: 2026-09-19T19:07:12.403Z
updated: '2026-09-21T02:31:12Z'
associated_issues: []
external_plans: []
---

## Description

The session-observer watch test "re-arms an exact Codex pin after clean SIGTERM shutdown" (src/skills/session-observer/src/watch.test.ts, around line 649) is timing-dependent. On 2026-09-19 it failed once in CI on PR #92 (expected one watch delta, received none) and passed on an unchanged re-run; PR #92 changes only documentation/package.json and its lockfile, so the PR could not have caused it, and the same base commit passed on main. The test starts a watcher process, sends SIGTERM, re-arms, and asserts on the number of delta events within a fixed window, so a slow shared runner can miss the delta. It will fail unrelated pull requests at random until fixed. Sequence this after the session-fidelity stack lands or rebases, because that stack's identity layer edits the same test file.

## Acceptance Criteria

- The test waits on a condition (poll for the expected delta up to a generous deadline) instead of asserting after a fixed timing window; it is not skipped, retried blindly, or marked flaky.
- Other tests in `watch.test.ts` that start a watcher process and assert on event counts after signals or timers are audited for the same pattern and fixed or listed with a reason.
- The test passes 50 consecutive local runs, including under artificial CPU load, and the `validate` CI job passes on three consecutive runs of the fixing PR.
- If the investigation shows a real race in the watcher's shutdown or re-arm path rather than in the test, the product defect is fixed (or filed separately) and the test asserts the corrected behavior.
