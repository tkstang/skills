---
id: BL-260723-make-remaining-consensus-loop
title: Make remaining consensus-loop write sites atomic
status: open
priority: low
scope: task
scope_estimate: S
labels:
  - consensus
  - correctness
  - wave-1-follow-up
assignee: null
created: 2026-07-23T05:20:00Z
updated: 2026-07-23T05:20:00Z
associated_issues: []
external_plans: []
---

## Description

Wave-1's atomic-writes lane converted `flush()` and `writeLoopStatus` in
`src/consensus/core/consensus-loop.ts` to the `atomicWriteFile` temp+rename
helper, per its plan's scope. Two write sites in the same file were explicitly
deferred by that plan and remain in-place `writeFile` calls: `writeSectionOutput`
(~line 2210) and `seedRecordsFile` (~line 2274). Convert both to `atomicWriteFile`
for consistency and crash safety, with the same no-tmp-residue/previous-file-survival
test pattern established in `tests/consensus/core/loop-records.test.ts`.

Source: wave-1-execution p01 phase report (deferred-by-plan follow-up), 2026-07-23.

## Acceptance Criteria

- `writeSectionOutput` and `seedRecordsFile` write via `atomicWriteFile` with
  serialized bytes unchanged
- Tests cover no-tmp-residue and previous-file survival for both sites
- Generated outputs regenerated; affected skill versions bumped per convention;
  full premerge green
