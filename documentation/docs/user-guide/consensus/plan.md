---
title: 'Plan'
description: 'Run the plan skill to turn a goal and inline constraints into structured markdown steps, dependencies, risks, a deliberation log, and resolution metadata.'
---

# Plan

`plan` produces a structured markdown plan from a goal and optional inline
constraints. It is the consensus skill for planning from no existing plan: two
provider-CLI-backed peers draft plans from the goal, the wrapper can synthesize
a merged plan, and the final markdown file includes steps, dependencies, risks,
a deliberation log, and resolution metadata.

For an operator walkthrough of goal input, expected JSONL, sidecar output, and
resolution review, see the
[consensus plugin README](https://github.com/tkstang/skills/blob/main/plugins/consensus/README.md)
and
[`skills/plan/references/operator-qa.md`](https://github.com/tkstang/skills/blob/main/plugins/consensus/skills/plan/references/operator-qa.md).

## Plan from a goal

Use an inline goal and optional inline constraints:

```bash
node plugins/consensus/skills/plan/scripts/consensus-plan.mjs --goal <text>
node plugins/consensus/skills/plan/scripts/consensus-plan.mjs --goal <text> --constraints <text>
```

`--goal <text>` is required. `--constraints <text>` is optional and inline-only
for this version; there is no `--constraints-file` path input.

## Defaults

The plan wrapper defaults to:

- `--cold-start independent_draft`
- `--iteration parallel_synthesized`
- `--agency moderate`

Under `independent_draft`, round 1 asks each peer to draft its own plan from the
goal and constraints rather than revise a shared starting plan. In
`parallel_synthesized`, those peer drafts are merged through a synthesis call.

## Output

Without `--output`, the wrapper writes `consensus-plan.md` in the invocation
directory and reports it in the `run_completed` event. With `--output <path>`,
that path receives the plan artifact.

The plan artifact contains:

- `## Steps`
- `## Dependencies`
- `## Risks`
- a `## Resolution` section with a canonical `consensus-resolution` block
- `cold_start`, `iteration`, `agency`, `peer_calls`, and `synthesis_calls`
  metadata
- `## Deliberation Log` with embedded `consensus-verdict` and
  `consensus-synthesis` blocks

Required headings are prompt-framed markdown, not a new machine-readable
planning schema.

## Input handling

Goals and constraints are capped at 1 MiB. Output paths and run directories are
confined by `--allow-root` when provided. Treat goal and constraint text as
untrusted data; review dependencies and risks before acting on the plan.
