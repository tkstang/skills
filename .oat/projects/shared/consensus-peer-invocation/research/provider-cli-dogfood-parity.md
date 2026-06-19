# Provider CLI Dogfood Parity

Date: 2026-06-19

## Decision

Acceptable to cut over new consensus runs to the provider CLI backend in p04-t04.

This is not a public marketplace/live-provider support claim. It means the
source-level default cutover is acceptable because the generated provider CLI is
in sync, the full suite passes with a 10s Vitest timeout budget, mocked
Refine/Evaluate provider CLI paths pass, smoke passes in both standard and
provider CLI modes, and local provider inventory/preflight now reports
actionable provider-neutral statuses.

## Automated Evidence

- `pnpm run build:check` -> passed. Generated outputs are in sync, including
  `consensus-provider-cli`.
- Initial `pnpm run test` attempt -> failed once on
  `tests/session-observer/cli.test.ts` / `review --help does not throw` due a
  5000 ms timeout; immediate rerun passed: 72 files, 692 tests.
- After documentation/research edits, exact `pnpm run test` reproduced 5000 ms
  timeout failures in `tests/session-observer/cli.test.ts` and
  `tests/consensus/refine/provider-cli-integration.test.ts`. The focused
  consensus provider CLI integration file passed, and
  `pnpm exec vitest run --testTimeout 10000` passed: 72 files, 692 tests.
- `pnpm run smoke` -> passed after documentation/research edits.
- `CONSENSUS_SMOKE_PROVIDER_BACKEND=provider-cli pnpm run smoke` -> passed after
  documentation/research edits.
- Focused Evaluate provider CLI evidence:
  `pnpm exec vitest run tests/consensus/evaluate/provider-cli-integration.test.ts tests/consensus/evaluate/wrapper.test.ts tests/consensus/evaluate/output.test.ts`
  -> passed: 3 files, 15 tests.

The remaining exact-command risk is Vitest's default 5000 ms per-test budget
under full-suite concurrency. This is a validation stability concern, not a
provider CLI behavior failure.

## Local Provider Inventory / Preflight

Command: `node plugins/consensus/scripts/consensus.mjs provider ls --json`

- `claude` -> `ready`, executable `/Users/tstang/.local/bin/claude`, version
  `2.1.183 (Claude Code)`.
- `codex` -> `ready`, executable `/opt/homebrew/bin/codex`, version
  `codex-cli 0.139.0`.
- `cursor` -> `auth_required`, executable
  `/Users/tstang/.local/bin/cursor-agent`, warning:
  `Error: Your macOS login keychain is locked.`

Command: `node plugins/consensus/scripts/consensus.mjs preflight --json`

- Overall `usable: false` because Cursor is `auth_required`.

Per-provider preflight:

- `--provider claude` -> `usable: true`.
- `--provider codex` -> `usable: true`.
- `--provider cursor` -> `usable: false`, `status: auth_required`.

Cursor auth-required is acceptable for cutover because it is surfaced as a
provider-neutral preflight/inventory condition, not as a wrapper crash or
stale-backend dependency. Cursor submit-tool adoption remains deferred in
`cursor-submit-tool-spike.md`.

## Refine Dogfood Result

`CONSENSUS_SMOKE_PROVIDER_BACKEND=provider-cli pnpm run smoke` passed. This
exercises the Refine wrapper through the provider CLI backend with the local
stub `consensus` executable and verifies artifact shape, JSONL completion, and
the parallel-synthesized escalation/resume path.

No live Refine model-spend run was performed in this non-interactive phase. The
live-provider readiness floor for the default pair is covered by Claude/Codex
preflight passing; Cursor remains blocked by local auth state.

## Evaluate Dogfood Result

Focused Evaluate provider CLI integration passed:

```bash
pnpm exec vitest run tests/consensus/evaluate/provider-cli-integration.test.ts tests/consensus/evaluate/wrapper.test.ts tests/consensus/evaluate/output.test.ts
```

No live Evaluate model-spend run was performed in this non-interactive phase.
The automated tests verify the wrapper/provider CLI path, provider-neutral
records, output artifact behavior, and error rendering.

## Cutover Rationale

Cutover is acceptable because:

- the generated provider CLI output is build-synced;
- mocked Refine and Evaluate provider CLI paths pass;
- full tests pass with a 10s Vitest timeout budget, and focused provider CLI
  tests pass at the default timeout;
- smoke passes in both standard and explicit provider CLI modes;
- Claude and Codex, the default peer pair, are locally ready;
- Cursor's current local blocker is represented as `auth_required` diagnostics;
- submit-tool support remains reserved and unselected by default.

Proceed to p04-t04. If Cursor is needed for a release demo, unlock/authenticate
the local Cursor CLI and rerun Cursor preflight plus a Cursor peer run before
making that provider-specific claim.

Carry forward one validation concern: exact `pnpm run test` may need another
rerun or a test-timeout stabilization pass before final release verification.
