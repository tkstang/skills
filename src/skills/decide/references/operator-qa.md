# Decide Operator QA

This walkthrough verifies that `consensus-decide.mjs` can produce a markdown decision document from a contested options file while preserving unresolved disagreement.

## Basic Run

From the `plugins/consensus/skills/decide/` directory:

```bash
node ./scripts/consensus-decide.mjs \
  --options references/examples/contested-options.md \
  --output /tmp/consensus-decision.md \
  --run-dir /tmp/consensus-decide-run \
  --allow-root /tmp
```

Expected JSONL:

- `run_started` with `options_file`
- `run_completed` with `output_path`, `run_dir`, and final `status`
- `error` only when provider inventory, preflight, path confinement, or provider execution fails

## Output Review

Open the reported artifact path and confirm it contains:

- `## Recommendation`
- `## Reasoning`
- `## Alternatives`
- `## Dissent / Unresolved Disagreement`
- `## Resolution`
- `<!-- consensus:consensus-resolution`
- `## Deliberation Log`
- peer `consensus-verdict` blocks
- a synthesis `consensus-synthesis` block when using `parallel_synthesized`

The resolution metadata should record:

- `cold_start: independent_draft`
- `iteration: parallel_synthesized`
- `agency: minimal`
- `peer_calls`
- `synthesis_calls`

## Dissent Check

If the synthesis result contains unresolved disagreement, confirm the final decision artifact lists those items under `## Dissent / Unresolved Disagreement`. Minimal agency means unresolved disagreement is surfaced to the operator rather than silently decided.
