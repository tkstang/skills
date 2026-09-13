# consensus-evaluate operator QA

Use this walkthrough when validating the shipped `evaluate` skill against live peers. The examples assume commands are run from the repository root.

For the shorter release-gate check that proves the current provider CLI works
against live Claude+Codex for both shipped consumers, use the shared runbook at
`plugins/consensus/references/live-e2e.md`.

## Minimal Evaluation

Before running live peers, verify the shared prerequisites and provider
inventory:

```bash
node --version            # must be >= 22
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json
```

For an installed plugin, the same checks may be exposed as `consensus provider ls
--json` and `consensus preflight --json`. Requested peers should report `ready`.
If Cursor reports `auth_required`, unlock the OS keychain or authenticate the
Cursor CLI in your normal login shell before retrying.

The evaluate wrapper validates provider ID syntax and surfaces provider-neutral
diagnostics from peer invocation. Provider inventory checking is still a useful
operator preflight step before an expensive live run.

## Provider CLI dogfood checklist

Before a release cutover, capture these checks in the parity note or release
checklist:

- `pnpm run build:check`
- `pnpm run test`
- Focused Evaluate provider CLI integration tests:
  `pnpm exec vitest run tests/consensus/evaluate/provider-cli-integration.test.ts tests/consensus/evaluate/wrapper.test.ts tests/consensus/evaluate/output.test.ts`
- `node plugins/consensus/scripts/consensus.mjs provider ls --json`
- `node plugins/consensus/scripts/consensus.mjs preflight --json`
- Per-provider preflight for `claude`, `codex`, and `cursor`, noting
  `auth_required` separately from implementation failures.

```bash
node plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs \
  path/to/artifact.md \
  --rubric path/to/rubric.md \
  --peers claude,codex \
  --max-rounds 2
```

Expected behavior:

- stdout emits JSONL coordination events, not the markdown evaluation body
- the final `run_completed` event includes a non-empty `output_path`
- without `--output`, the artifact is written to `<artifact>.evaluation.md`
- the evaluation artifact includes `## Unified findings` and `## Deliberation log`
- peer records are embedded as `consensus-verdict` blocks

## Explicit Output Path

```bash
node plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs \
  path/to/artifact.md \
  --rubric path/to/rubric.md \
  --output path/to/evaluation.md \
  --peers claude,codex
```

Confirm `path/to/evaluation.md` contains the evaluation and stdout still contains only coordination JSONL.

## Default Settings

The evaluate wrapper defaults to:

- `shared_input` cold start
- `parallel_revision` iteration
- `minimal` agency

These defaults make each peer evaluate the same artifact and rubric independently each round. Use `--iteration alternating` only when the user wants lower cost, and use `--agency moderate` or `--agency maximum` only when the user explicitly wants more host-side resolution.

## Dissent Review

Inspect the final artifact before reporting completion. If peers converge with residual concerns, the artifact includes `## Dissent`. If the run reaches impasse or escalation, it includes `## Unresolved dissent`.

When `## Unresolved dissent` appears, summarize each peer's position and ask the user whether to accept the unresolved result, provide new direction, increase the round budget, or rerun with different peers.
