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
updated: 2026-09-16T18:06:09Z
associated_issues: []
external_plans:
  - .oat/repo/reference/external-plans/2026-09-07-reconcile-live-submit-verdict-source.md
---

## Description

During wave-4's live-E2E-visibility lane, a single accidental live run of
`src/plugins/consensus/provider-cli/e2e/submit-live.e2e.test.ts` against the real
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

## September 16 review note

The linked September 7 external plan predates source colocation. Rebase its source/test paths before execution. Its assertion that the live test defaults to a writable policy is stale: `runtimePolicyFor()` currently defaults Codex to `read-only` (environment-overridable) and Claude to `read-only`. Inspect effective policy and sanitize failure-envelope reporting before any separately authorized, budgeted live run. This review performed no such run.
