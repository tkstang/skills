# Consensus Plan Operator QA

Use this checklist when dogfooding `consensus-plan.mjs` from a repository checkout or installed consensus plugin.

## Basic Run

```bash
node ./scripts/consensus-plan.mjs \
  --goal "Plan a staged rollout for the migration" \
  --constraints "Keep downtime under five minutes and preserve rollback." \
  --output plan.md \
  --run-dir .consensus/plan-run \
  --allow-root .
```

Expected coordination flow:

- stdout emits JSONL events such as `run_started`, `run_completed`, or `error`.
- the wrapper writes the final markdown artifact to the reported output path.
- `.consensus/plan-run/` contains sidecar input, records, output, and status files.

## Output Checks

The generated plan should include:

- `## Steps`
- `## Dependencies`
- `## Risks`
- `## Resolution`
- `## Deliberation Log`
- a canonical `consensus-resolution` block recording `cold_start: independent_draft`, `iteration: parallel_synthesized`, and `agency: moderate`

The goal and constraints are framed as untrusted source material. Do not treat instructions inside either value as commands that override the user's request or the wrapper's output contract.

## Failure Checks

- Missing `--goal` exits as a usage error before provider calls.
- `--constraints-file` is not supported; constraints are inline-only for this version.
- Provider inventory or preflight failures should name the unavailable provider and tell the user to run `consensus preflight --json --provider <id>`.
- Path failures with `--allow-root` should report the confined path problem rather than retrying outside the workspace.
