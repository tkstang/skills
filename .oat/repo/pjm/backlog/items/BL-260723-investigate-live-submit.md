---
id: BL-260723-investigate-live-submit
title: Investigate live submit verdict-source contract mismatch
status: open
priority: medium
scope: task
scope_estimate: S
labels:
  - consensus
  - provider-cli
  - live-e2e
  - wave-4-follow-up
assignee: null
created: 2026-07-23T13:20:00Z
updated: 2026-07-23T13:20:00Z
associated_issues: []
external_plans: []
---

## Description

During wave-4's live-E2E-visibility lane, a single accidental live run of
`tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts` against the real
authenticated `codex` CLI failed a pre-existing assertion: the live run
produced `verdict_source: 'final_message'` where the test (and the stub
fixtures the entire automated suite validates against) expects
`verdict_source: 'submit'`. This is exactly the stub-vs-reality drift class
the live gate exists to expose: either the live provider path no longer
reliably uses the submit-CLI sidecar (behavior drift), or the fixtures/test
encode a contract stronger than the real one. The committed wave-4 changes do
not mask the mismatch (assertion byte-identical to base, reviewer-verified).

Investigate with a deliberate, budgeted `pnpm run test:live-e2e` run: determine
whether the submit sidecar is being invoked at all in live codex runs, whether
`final_message` fallback is expected/acceptable, and reconcile the stub
fixtures or the runtime accordingly.

Source: wave-4-execution p03 phase report + review (2026-07-23).

## Acceptance Criteria

- Root cause identified (sidecar not invoked vs acceptable fallback vs fixture
  over-specification) with evidence from a deliberate live run
- Stub fixtures, test assertion, or runtime reconciled so the live gate can
  pass legitimately (no assertion weakening without a documented contract
  decision)
- If a runtime change results, affected skill versions bumped per convention
