---
id: bl-f0b6
title: 'Verify cursor-as-peer end-to-end through provider CLI (authenticated cursor-agent)'
status: done
priority: medium
scope: task
scope_estimate: S
labels: [consensus, provider-cli, cursor, verification]
assignee: null
created: '2026-06-13T19:12:43Z'
updated: '2026-06-20T20:36:06Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

**Status update (2026-06-20): completed.** After unlocking the login keychain in
the same SSH session that runs the provider CLI, `cursor-agent --version` and
`consensus preflight --json --provider cursor` report Cursor as ready. The
provider CLI now sends the schema in prompt-only structured-output instructions
and extracts embedded JSON objects from Cursor wrapper prose before schema
validation.

Cursor live evidence after the fix:

- Direct provider smoke returned `ok: true` with
  `diagnostics.strategy_used: "prompt_only"` and `cli_attempts: 1`.
- Refine with `--peers cursor,codex --max-rounds 2` converged at
  `tmp/e2e-provider-cli/refine-email-cursor-after-fix.consensus.md`.
- Evaluate with `--peers cursor,codex --max-rounds 2` converged at
  `tmp/e2e-provider-cli/evaluate-release-cursor.evaluation.md`.
- Refine recorded Cursor/Codex/Cursor strategies
  `prompt_only` / `constrained_native` / `prompt_only`, all first-attempt
  successes.
- Evaluate recorded Cursor/Codex/Cursor/Codex strategies
  `prompt_only` / `constrained_native` / `prompt_only` /
  `constrained_native`, all first-attempt successes.

**Prior status update (2026-06-19): still open, reframed for the provider CLI.**
Cursor is now represented by the generated `consensus` provider CLI inventory
and preflight path. On this machine, Cursor currently reports `auth_required`
because the macOS login keychain is locked. This item should verify an
authenticated Cursor peer through `consensus provider ls`, `consensus preflight`,
and a live Refine/Evaluate peer run once local auth is usable.

Cursor is represented in the provider CLI's first provider floor and can be
targeted via `--peers cursor,codex` once it reports usable in
`consensus provider ls --json` / `consensus preflight --json --provider cursor`.
This path has been exercised end-to-end with authenticated local Cursor
credentials. Cursor-as-peer remains auth-sensitive because credentials are
backed by local OS keychain/session state, but the provider CLI path is now live
verified.

Two specific unknowns motivate this:

1. **Auth/environment:** `cursor-agent` stores credentials in the OS keychain. A
   locked/unauthenticated keychain makes provider CLI inventory/preflight report
   `auth_required`. A real run needs an authenticated `cursor-agent` and a
   `ready`/usable provider status.
2. **Structured output:** Cursor has no native schema flag in the current first
   scope. The provider CLI treats Cursor as prompt-only plus local
   validation/retry. We need to confirm the verdict schema survives that path
   (schema-retry rate, malformed-JSON handling, latency) without degrading
   deliberation quality.

Related: bl-bb7e is complete; findings here now feed release/provider support
wording and any later submit-tool hardening work ([[bl-3a88]]).

## Acceptance Criteria

- A full `refine` deliberation run completes with `--peers cursor,codex` (and,
  separately, `cursor` as one peer in a parallel mode) against an authenticated
  `cursor-agent`, with the run artifact and JSONL captured as evidence.
- Schema behavior is characterized: observed schema-retry rate and any
  malformed-verdict / provider-invalid-JSON occurrences recorded, with a verdict
  on whether cursor-as-peer is reliable enough to document as supported.
- Preflight behavior confirmed against a real errored Cursor provider (locked
  keychain or signed-out) — provider CLI preflight reports `auth_required` with
  the remediation hint.
- README/SKILL wording updated from "unverified end-to-end" to the verified
  status (supported, or supported-with-caveats, or not-recommended) based on the
  evidence; findings cross-referenced into bl-bb7e.
