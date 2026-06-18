# consensus-evaluate operator QA

Use this walkthrough when validating the shipped `evaluate` skill against live peers. The examples assume commands are run from the repository root.

## Minimal Evaluation

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
