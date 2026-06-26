---
id: BL-260619-refine-provider-exit-retry
title: Refine provider-exit retry classification (transient vs terminal)
status: done
priority: medium
scope: task
scope_estimate: M
labels:
  - consensus
  - provider-cli
  - reliability
  - retry
assignee: null
created: 2026-06-19T23:41:44Z
updated: 2026-06-21T05:01:55Z
associated_issues: []
legacy_id: bl-3291
---

## Description

**Resolution update (2026-06-21 — `provider-cli-hardening`):** this item was
rewritten to match shipped reality. The transient-vs-terminal classifier already
shipped with the provider CLI in `92a2711`; unknown/unmatched nonzero exits already
fall through as **terminal (no retry)**. The old "retry-all" premise is therefore
obsolete, and restoring retry-all would be a semantic regression rather than an
additive refinement.

The confirmed contract is: provider exits retry only when an adapter-owned
classifier has evidence for a transient or reliable external-interruption class;
recognized terminal exits and unknown/unmatched exits stop immediately with a
recorded terminal reason. `provider-cli-hardening` locked that contract and filled
the real gaps: transient exits retry without schema-validation prompt
contamination, the fired classification is recorded as a redacted diagnostic,
reliable external interrupts classify as retryable while timeout/output-cap paths
remain terminal, and provider-specific transient signatures are added only where
evidence exists.

**Why:** fail-fast unknown exits avoid wasting the bounded provider attempt budget
on failures with no retry evidence, while explicit transient signatures still
protect real rate-limit/provider-temporary cases. The important hardening is making
the classifier auditable, conservative, and tested rather than broadening retries.

**Scope note:** distinct from [[bl-3a88]] (tool-based verdict submission /
schema self-correction), which addresses **structured-output validation** churn
inside the provider turn. This item is about **process-exit** transient-vs-terminal
handling in the retry boundary. They are complementary, not duplicates.

Cross-link: [[bl-bb7e]] (done — shipped the provider CLI and the current retry
boundary this item refines).

## Acceptance Criteria

- Unknown/unmatched nonzero `PROVIDER_EXIT` outcomes remain terminal by default:
  no retry, `terminal_reason: provider_exit_terminal`, and a contract-locking test.
- Transient provider exits retry within `max_attempts` without mutating the next
  prompt with schema-validation feedback; schema-validation retries keep their
  existing feedback behavior.
- Adapter-owned classification distinguishes transient, terminal, unknown, and
  reliable external-interruption cases. Reliable external interrupts retry;
  timeout/output-cap/internal terminations and ambiguous signal cases remain
  terminal.
- Provider-specific transient signatures are added only where evidence exists
  (currently the documented Claude Code repeated-529 overload class); absence of
  Codex/Cursor-specific evidence is recorded instead of guessed.
- Unit/integration tests cover transient-retry, terminal-stop, unknown-terminal,
  interruption, and per-adapter matrix paths.
- Audit/diagnostic fields record which classification fired without leaking
  provider stderr beyond existing redaction rules.
