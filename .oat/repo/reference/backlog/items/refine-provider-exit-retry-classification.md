---
id: bl-3291
title: 'Refine provider-exit retry classification (transient vs terminal)'
status: open
priority: medium
scope: task
scope_estimate: M
labels: [consensus, provider-cli, reliability, retry]
assignee: null
created: '2026-06-19T23:41:44Z'
updated: '2026-06-19T23:41:44Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

The shipped `consensus` provider CLI (`src/consensus/provider-cli/`) currently
retries **all** nonzero provider exits within `max_attempts`, except cases an
adapter recognizes as terminal (unsupported options, auth-required, missing
executable, recursion-guard failure, output cap, usage error). `design.md:564`
explicitly defers smarter classification:

> Later refinements can add stderr/signature matching for rate limits, 429s,
> interrupted runs, and provider-specific transient classes.

This item tracks that refinement: classify `PROVIDER_EXIT` outcomes by matching
adapter stderr/exit signatures so retries target genuinely transient failures
(rate limits, 429s, interrupted runs, transient network/provider errors) instead
of retrying every nonzero exit. Terminal-but-currently-retried classes (for
example deterministic argument/usage failures that slip past the adapter's
terminal set) should be recognized and stopped early to avoid wasted attempts
and latency.

**Why:** retry-all is a safe floor but burns `max_attempts` and wall-clock on
failures that will never succeed, and under-reacts to provider-specific
transient classes that deserve more deliberate backoff. Signature-based
classification makes provider runs both faster to fail and more resilient to
transient blips.

**Scope note:** distinct from [[bl-3a88]] (tool-based verdict submission /
schema self-correction), which addresses **structured-output validation** churn
inside the provider turn. This item is about **process-exit** transient-vs-terminal
handling in the retry boundary. They are complementary, not duplicates.

Cross-link: [[bl-bb7e]] (done — shipped the provider CLI and the current retry
boundary this item refines).

## Acceptance Criteria

- `PROVIDER_EXIT` classification distinguishes transient (retryable) from
  terminal (non-retryable) using adapter-owned stderr/exit-signature matching,
  covering at least rate limits / 429s, interrupted runs, and one
  provider-specific transient class per shipped adapter where evidence exists.
- Recognized-terminal exits stop retrying immediately with a `terminal_reason`,
  rather than consuming the full `max_attempts` budget.
- Unknown/unmatched nonzero exits retain the current retry-within-`max_attempts`
  behavior so the change is strictly additive (no regression for unclassified
  cases).
- Unit/integration tests cover transient-retry, terminal-stop, and
  unknown-fallthrough paths for each adapter that gains a signature.
- Audit/diagnostic fields record which classification fired (transient vs
  terminal vs unknown) without leaking provider stderr content beyond existing
  redaction rules.
