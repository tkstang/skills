---
id: BL-260619-add-a-test-guarding-bundled
title: Add a test guarding bundled rubric examples at <=12 parser-visible criteria
status: open
priority: low
scope: test
scope_estimate: S
labels:
  - consensus
  - evaluate
  - rubric
  - test
  - nice-to-have
assignee: null
created: 2026-06-19T16:50:01Z
updated: 2026-06-19T16:50:01Z
associated_issues: []
legacy_id: bl-3913
---

## Description

The `evaluate` wrapper's `extractRubricCriteria` parses `##`–`######` headings and `-`/`*` bullets, dedupes, and silently keeps only the **first 12** distinct criteria. The four bundled example rubrics under `plugins/consensus/skills/evaluate/references/examples/` were authored to stay at or below that cap (10 load-bearing criteria each after the `## How to adapt this rubric` heading was demoted to bold), so nothing important is truncated today.

There is currently **no automated guard** asserting the examples remain `<=12` parser-visible criteria. A future edit that adds headings/bullets — or re-promotes the adaptation note to a heading — could silently push a real criterion past the cap and reintroduce the spurious/truncated-criterion regression that was just fixed.

This item tracks adding a focused test that runs the real `extractRubricCriteria` logic over each bundled example and asserts the count stays within the cap, so the invariant is protected mechanically rather than by author discipline.

## Source

Deferred Minor from the consensus-rubric-guidance final review (`final-review-2026-06-19.md`, Minor #2). Ship-safe future-proofing; the examples are correct as shipped.

## Acceptance Criteria

- A Vitest `.test.ts` (matching the current `tests/` layout — `node:test` is retired and blocked by `tests/tooling/no-node-test-runner.test.ts`), placed under `tests/consensus/evaluate/`, imports/exercises the canonical `extractRubricCriteria` logic and runs it over every file in `plugins/consensus/skills/evaluate/references/examples/`.
- The test asserts each example yields `<=12` distinct parser-visible criteria.
- The test fails clearly if a new example is added that exceeds the cap, naming the offending file and count.
- No change to the shipped wrapper runtime or the example content is required to make the test pass (it documents the current, correct state).
