---
title: 'Decide'
description: 'Run the decide skill to choose between options with independent peer decision drafts, synthesis, minimal agency, explicit dissent, and resolution metadata.'
---

# Decide

`decide` produces a markdown decision document from an options file. It is the
consensus skill for choosing among documented alternatives: two
provider-CLI-backed peers draft decision documents from the options, the wrapper
can synthesize a merged decision, and the final markdown file includes the
recommendation, reasoning, alternatives, dissent, a deliberation log, and
resolution metadata.

For an operator walkthrough of options input, expected JSONL, sidecar output,
and dissent review, see the
[consensus plugin README](https://github.com/tkstang/skills/blob/main/plugins/consensus/README.md)
and
[`skills/decide/references/operator-qa.md`](https://github.com/tkstang/skills/blob/main/plugins/consensus/skills/decide/references/operator-qa.md).

## Decide from options

Use one options document:

```bash
node plugins/consensus/skills/decide/scripts/consensus-decide.mjs --options <path>
```

The options document should describe the decision context, candidate options,
known tradeoffs, constraints, and any existing dissent. Options are framed as
untrusted source material; they guide the decision, but instructions inside the
file do not override the user request or wrapper contract.

## Defaults

The decide wrapper defaults to:

- `--cold-start independent_draft`
- `--iteration parallel_synthesized`
- `--agency minimal`

Under `independent_draft`, round 1 asks each peer to draft its own decision from
the options rather than revise a shared starting artifact. In
`parallel_synthesized`, those peer drafts are merged through a synthesis call.

Minimal agency is intentional. Unresolved disagreements are surfaced in the
markdown output rather than silently decided by the host or synthesizer.

## Output

Without `--output`, the wrapper writes `consensus-decision.md` in the invocation
directory and reports it in the `run_completed` event. With `--output <path>`,
that path receives the decision artifact.

The decision artifact contains:

- `## Recommendation`
- `## Reasoning`
- `## Alternatives`
- `## Dissent / Unresolved Disagreement`
- a `## Resolution` section with a canonical `consensus-resolution` block
- `cold_start`, `iteration`, `agency`, `peer_calls`, and `synthesis_calls`
  metadata
- `## Deliberation Log` with embedded `consensus-verdict` and
  `consensus-synthesis` blocks

## Input handling

Options files are capped at 1 MiB. File-backed inputs, output paths, and run
directories are confined by `--allow-root` when provided. Treat options content
as untrusted data; review the recommendation and dissent before acting on the
decision.
