---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-21
oat_generated: true
oat_summary_last_task: p03-t05
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: provider-cli-hardening

## Overview

This project hardened the owned `consensus` provider CLI, the subprocess boundary
that invokes Claude, Codex, and Cursor peers and returns schema-valid verdicts to
the deterministic consensus engine. It addressed two reliability weaknesses:
fragile prompt-and-parse verdict capture, and provider-exit retry classification
that needed to be locked, audited, and separated from schema-validation feedback.

The project satisfied backlog items `bl-3a88` and `bl-3291` without changing the
core consensus engine contract or adding runtime dependencies.

## What Was Implemented

- Provider-exit retry classification now keeps unknown exits terminal by default,
  records a redacted `exit_classification` diagnostic, retries reliable external
  interrupts, and keeps timeout/output-cap failures terminal.
- Transient provider-exit retries no longer contaminate the next prompt with
  schema-validation feedback. Schema-validation retries still provide validation
  feedback as before.
- Adapter coverage now locks common transient, provider-specific transient,
  terminal, interrupted, and unknown classifications across Claude, Codex, and
  Cursor.
- `consensus submit` was added as a provider-turn verdict-submission command. It
  validates submitted verdict JSON against the active schema, emits one structured
  `SubmitResult` JSON line, writes a run-bound sidecar on success, and surfaces
  actionable stderr on failure for in-turn self-correction.
- Provider turns now inject `CONSENSUS_SUBMIT_COMMAND`, `CONSENSUS_SUBMIT_SCHEMA`,
  `CONSENSUS_SUBMIT_FILE`, and `CONSENSUS_SUBMIT_MAX_BYTES`; successful sidecars
  are preferred over final-message parsing and reported through
  `diagnostics.verdict_source: "submit"`.
- The existing `ConsensusCliRunEnvelope` shape is unchanged. If no valid sidecar
  exists, wrappers fall back to final-message parsing and the existing terminal
  handling.
- Submit-enabled Codex turns avoid native `--output-schema`, so Codex strict-output
  rejection cannot stop the peer before it can run the submit command.
- Submit capture is size-bounded, and generated plugin runtime output was rebuilt
  from canonical TypeScript source.
- Deterministic evidence fixtures cover both historical failure classes: no
  structured final message and strict-output rejection. A gated live Codex
  workspace-write E2E covers prompt-driven submit capture with
  `verdict_source: "submit"`.
- DR-024 promoted the submit-CLI decision into the repo decision record, and
  repo-reference/backlog/docs surfaces were updated to mark `bl-3a88` and
  `bl-3291` complete.

## Key Decisions

- Submit-CLI was selected over MCP for this repo because it reuses the owned
  dependency-free subprocess boundary, works across the first supported provider
  floor, preserves deterministic post-turn capture, and avoids adding a
  server/config surface.
- No-submission behavior remains additive by default: prefer a valid submitted
  sidecar, then fall back to final-message parsing. Strict require-submission mode
  is deferred until adoption evidence supports tightening the contract.
- The `bl-3291` backlog premise was treated as drift against shipped code.
  Unknown provider exits were already terminal, so the project confirmed and locked
  that contract instead of restoring retry-all behavior.
- Provider-specific transient signatures are evidence-gated. This project added
  the documented Claude repeated-529 overload signature and avoided speculative
  Codex/Cursor patterns.
- Native Cursor submit-tool support remains reserved. The provider-neutral submit
  CLI path is the shipped verdict-submission mechanism.

## Design Deltas

- Codex read-only sandbox posture was originally documented as a limitation
  rather than a shipped support claim for sidecar writes. The 2026-07-07 follow-up
  relocated submit capture under the provider turn cwd at `.consensus/submit/`,
  removing the old tmpdir sidecar dependency.
- Final review tightened the design by removing Codex native strict-output
  enforcement from submit-enabled turns and bounding submit capture size. Those
  changes became the shipped source of truth and were reflected in DR-024 and
  public docs.

## Notable Challenges

- The p02 review caught that prompts advertised a bare `consensus submit --json -`
  command, which was unsafe in plugin/checkouts where `consensus` is not on PATH.
  The implementation now injects and advertises the exact
  `CONSENSUS_SUBMIT_COMMAND`.
- The p02 re-review caught submit sidecar write failures escaping the structured
  stdout contract. The submit handler now reports write failures as structured
  `SubmitResult` JSON plus concise stderr.
- The final review caught two blockers: submit-enabled Codex still used native
  strict-output flags, and submit capture could bypass output-size limits. Both
  were fixed before final re-review passed.
- The final manual pass v3 had one Minor comment-clarity observation about
  provider strategy selection; it was resolved with a source comment and no
  behavior change.

## Integration Notes

- Work on provider CLI behavior should edit canonical TypeScript under
  `src/consensus/provider-cli/` and run `pnpm run build` to regenerate
  `plugins/consensus/scripts/consensus.mjs`.
- Downstream consensus-family work can rely on DR-024's submit-CLI plus
  parse-fallback contract instead of reopening MCP-vs-CLI or Codex strict-output
  strategy.
- Consumers should treat `diagnostics.verdict_source` and
  `diagnostics.exit_classification` as additive diagnostics; the success envelope
  contract remains compatible.

## Follow-up Items

- Add an opt-in strict require-submission mode once submit adoption evidence is
  strong enough to justify terminal failure when no sidecar is present.
- Codex read-only submit capture relocation is no longer open; the remaining
  verdict-path hardening follow-up is strict require-submission mode.
- Backoff/jitter for transient retries remains deferred because it adds wall-clock
  nondeterminism.

## Associated Issues

- `bl-3a88`: Tool-based verdict submission for consensus peers.
- `bl-3291`: Refine provider-exit retry classification.
