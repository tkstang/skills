# Live provider E2E runbook

Use this runbook when you need to prove the shipped consensus plugin still works
against real provider CLIs. These checks exercise live models and can spend
provider budget. They are intentionally separate from `pnpm run test`, which
uses fixtures and mocks.

Run commands from the repository root unless noted otherwise.

## When to Run

- Before tagging or publishing a release that changes consensus runtime code,
  schemas, prompts, provider adapters, or plugin packaging.
- After upgrading a provider CLI when its structured-output behavior may have
  changed.
- After changing the generated provider CLI at
  `plugins/consensus/scripts/consensus.mjs` or canonical source under
  `src/consensus/`.

## Prerequisites

```bash
node --version
pnpm run build:check
pnpm run test
pnpm run validate
pnpm run smoke
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json
```

For installed-plugin validation, the provider CLI may also be exposed as
`consensus`:

```bash
consensus provider ls --json
consensus preflight --json
```

Confirm the peers you plan to use report `ready`. For the first provider floor,
run with `--peers claude,codex` unless you are specifically validating Cursor.
If Cursor reports `auth_required`, unlock the macOS login keychain or
authenticate the Cursor CLI in the current user session before treating it as an
implementation failure.

Keep live outputs in ignored scratch paths:

```bash
set -o pipefail
mkdir -p tmp/e2e-provider-cli
```

## Refine E2E

This run uses the checked-in email example and should converge in a small number
of provider calls.

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs \
  plugins/consensus/skills/refine/references/examples/email-announcement.md \
  --goal "Tighten this announcement: keep it warm but concise; lead with the change." \
  --peers claude,codex \
  --max-rounds 2 \
  --output tmp/e2e-provider-cli/refine-email.consensus.md \
  | tee tmp/e2e-provider-cli/refine-email.stdout.jsonl
```

Expected:

- stdout has a `run_completed` JSONL event with `status: "converged"`.
- The artifact exists at `tmp/e2e-provider-cli/refine-email.consensus.md`.
- The artifact resolution reports `Status: converged`, `Peers: claude, codex`,
  and non-zero peer calls.
- The run records under the emitted `.consensus/run-...` directory show provider
  strategies including:
  - Claude: `provider_validated`
  - Codex: `constrained_native`

## Evaluate E2E

This run uses the small checked-in artifact/rubric pair under
`plugins/consensus/references/e2e/`.

```bash
node plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs \
  plugins/consensus/references/e2e/evaluate-release-note.md \
  --rubric plugins/consensus/references/e2e/evaluate-release-rubric.md \
  --peers claude,codex \
  --max-rounds 2 \
  --output tmp/e2e-provider-cli/evaluate-release.evaluation.md \
  | tee tmp/e2e-provider-cli/evaluate-release.stdout.jsonl
```

Expected:

- stdout has a `run_completed` JSONL event with `status: "converged"`.
- The artifact exists at `tmp/e2e-provider-cli/evaluate-release.evaluation.md`.
- The artifact frontmatter reports `kind: consensus-evaluate`,
  `iteration: parallel_revision`, and `peers: ["claude","codex"]`.
- The run records under the emitted `.consensus/evaluate-...` directory show
  both live providers and the expected strategies:
  - Claude: `provider_validated`
  - Codex: `constrained_native`

## Evidence to Capture

When recording release or PR evidence, include:

- The exact provider inventory/preflight result, especially provider statuses.
- The Refine `run_completed` event and artifact path.
- The Evaluate `run_completed` event and artifact path.
- The provider strategy list from each run's `records.json`.
- Any provider-local blockers, such as Cursor `auth_required`, separated from
  consensus implementation failures.

You can summarize provider strategies with a one-off Node command using the run
directory from the `run_completed` event:

```bash
node -e 'const fs=require("node:fs"); const p=process.argv[1]; const r=JSON.parse(fs.readFileSync(p,"utf8")); console.log(JSON.stringify({agents:r.map(x=>x.agent), verdicts:r.map(x=>x.verdict), strategies:r.map(x=>x.provider_diagnostics?.strategy_used), attempts:r.map(x=>x.attempts)}, null, 2));' \
  .consensus/<run-id>/sections/<section-dir>/records.json
```

For Evaluate, the records file is directly under the emitted run directory:

```bash
node -e 'const fs=require("node:fs"); const p=process.argv[1]; const r=JSON.parse(fs.readFileSync(p,"utf8")); console.log(JSON.stringify({agents:r.map(x=>x.agent), verdicts:r.map(x=>x.verdict), strategies:r.map(x=>x.provider_diagnostics?.strategy_used), attempts:r.map(x=>x.attempts)}, null, 2));' \
  .consensus/<evaluate-run-id>/records.json
```

## Optional Cursor-as-Peer E2E

Cursor is part of the first provider floor, but local authentication is
operator-owned. Start by clearing the common keychain blocker:

```bash
security unlock-keychain
cursor-agent --version
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json --provider cursor
```

When testing over SSH, run `security unlock-keychain` in that SSH session before
invoking `cursor-agent`. Unlocking the mini's GUI login session may not make the
keychain usable to an already-open SSH shell.

Continue only when Cursor reports `ready` / `usable: true`. If it still reports
`auth_required`, authenticate Cursor and unlock the login keychain in the same
terminal/session that will run the provider CLI before treating the result as a
consensus failure.

Run a one-call provider CLI smoke before spending on full skill E2E:

```bash
node <<'NODE' | node plugins/consensus/scripts/consensus.mjs run --request-json - --json
const path = require('node:path');
process.stdout.write(JSON.stringify({
  schema_version: 'v1',
  provider: 'cursor',
  schema_path: path.resolve('plugins/consensus/skills/refine/schemas/verdict-alternating.schema.json'),
  prompt: 'Return exactly one JSON object matching the schema. Use schema_version v1, verdict ACCEPT, brief reasoning, empty proposed_artifact, and empty concerns.',
  cwd: process.cwd(),
  max_attempts: 2,
}));
NODE
```

Target provider smoke result:

- The provider CLI emits a valid envelope with `ok: true`.
- `diagnostics.strategy_used` is `prompt_only`.
- If the first Cursor response is malformed but retry succeeds, record the
  retry count; this is useful supportability evidence.

Observed 2026-06-20 before the fix: after unlocking the login keychain in the
SSH session, Cursor preflight reported `ready`, and a direct provider CLI smoke
passed only when the prompt explicitly required "one JSON object and no prose."
A live Refine run with `--peers cursor,codex` failed before the first recorded
turn with `Missing required JSON field: schema_version`.

Observed 2026-06-20 after the provider CLI prompt-only fix: Cursor received the
schema in prompt-only structured-output instructions, and the provider CLI can
extract embedded JSON objects from Cursor wrapper prose before schema
validation. The direct provider smoke emitted `ok: true` with
`strategy_used: "prompt_only"` and `cli_attempts: 1`.

Then run the live skill paths with Cursor as one peer:

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs \
  plugins/consensus/skills/refine/references/examples/email-announcement.md \
  --goal "Tighten this announcement: keep it warm but concise; lead with the change." \
  --peers cursor,codex \
  --max-rounds 2 \
  --output tmp/e2e-provider-cli/refine-email-cursor.consensus.md \
  | tee tmp/e2e-provider-cli/refine-email-cursor.stdout.jsonl

node plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs \
  plugins/consensus/references/e2e/evaluate-release-note.md \
  --rubric plugins/consensus/references/e2e/evaluate-release-rubric.md \
  --peers cursor,codex \
  --max-rounds 2 \
  --output tmp/e2e-provider-cli/evaluate-release-cursor.evaluation.md \
  | tee tmp/e2e-provider-cli/evaluate-release-cursor.stdout.jsonl
```

Expected Cursor skill evidence:

- Both wrappers emit `run_completed` with `status: "converged"` or another
  non-error terminal state that is justified by the deliberation artifact.
- Records include Cursor with `strategy_used: "prompt_only"`.
- Any `PROVIDER_INVALID_JSON` / `PROVIDER_SCHEMA_VALIDATION` retries are
  recorded with the final disposition.

Current 2026-06-20 Cursor evidence:

- Refine with `--peers cursor,codex --max-rounds 2` converged at
  `tmp/e2e-provider-cli/refine-email-cursor-after-fix.consensus.md`.
- Evaluate with `--peers cursor,codex --max-rounds 2` converged at
  `tmp/e2e-provider-cli/evaluate-release-cursor.evaluation.md`.
- Refine records used strategies `prompt_only`, `constrained_native`,
  `prompt_only` with all three provider CLI calls succeeding on the first
  attempt.
- Evaluate records used strategies `prompt_only`, `constrained_native`,
  `prompt_only`, `constrained_native` with all four provider CLI calls
  succeeding on the first attempt.

## Known Provider-Specific Failure Modes

These are useful regression clues:

- Claude Code `--print --output-format json --json-schema ...` returns a wrapper
  JSON object. The schema-constrained payload lives under `structured_output`;
  `result` may be prose.
- The Claude print-mode path expects the prompt as a positional argument in the
  current supported CLI behavior. Diagnostics must redact that prompt as
  `<prompt>`.
- Codex native structured output requires every declared top-level object
  property to appear in `required`. The consensus loop still owns
  branch-specific verdict validation after normalization.
- Cursor may report `auth_required` when the macOS login keychain is locked.
  Treat that as local operator state. When testing over SSH, unlock the keychain
  in the same SSH shell that invokes `cursor-agent` and the provider CLI.

## Cleanup

The recommended output paths are ignored by git, but you can remove live run
state after recording evidence:

```bash
rm -rf tmp/e2e-provider-cli .consensus
```
