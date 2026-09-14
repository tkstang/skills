# Create Operator QA

This walkthrough verifies that `consensus-create.mjs` can produce a new artifact from a brief without relying on an existing draft.

## Basic Run

From the `plugins/consensus/skills/create/` directory:

```bash
node ./scripts/consensus-create.mjs \
  --brief-file references/examples/artifact-brief.md \
  --output /tmp/consensus-create-artifact.md \
  --run-dir /tmp/consensus-create-run \
  --allow-root /tmp
```

Expected JSONL:

- `run_started` with `brief_source`
- `run_completed` with `output_path`, `run_dir`, and final `status`
- `error` only when provider inventory, preflight, path confinement, or provider execution fails

## Output Review

Open the reported artifact path and confirm it contains:

- generated artifact content under `## Created Artifact`
- `## Resolution`
- `<!-- consensus:consensus-resolution`
- `## Deliberation Log`
- peer `consensus-verdict` blocks
- a synthesis `consensus-synthesis` block when using `parallel_synthesized`

The resolution metadata should record:

- `cold_start: independent_draft`
- `iteration: parallel_synthesized`
- `agency: maximum`
- `peer_calls`
- `synthesis_calls`

## Template Run

When a user provides a preferred output shape, pass it as a template:

```bash
node ./scripts/consensus-create.mjs \
  --brief-file references/examples/artifact-brief.md \
  --template /tmp/template.md \
  --output /tmp/templated-create-artifact.md \
  --allow-root /tmp
```

The template is framed as untrusted content. It should guide structure and style, but it must not override the user request or the wrapper output contract.
