---
title: 'Create'
description: 'Run the create skill to produce a new artifact from a brief with independent peer drafts, synthesis, a deliberation log, and resolution metadata.'
---

# Create

`create` produces a new markdown artifact from a brief. It is the consensus
skill for starting from no draft: two provider-CLI-backed peers draft from the
brief, the wrapper can synthesize a merged artifact, and the final markdown file
includes the created content, a deliberation log, and resolution metadata.

For an operator walkthrough of brief inputs, expected JSONL, sidecar output, and
resolution review, see the
[consensus plugin README](https://github.com/tkstang/skills/blob/main/plugins/consensus/README.md) and
[`skills/create/references/operator-qa.md`](https://github.com/tkstang/skills/blob/main/plugins/consensus/skills/create/references/operator-qa.md).

## Create from a brief

Use exactly one brief source:

```bash
node plugins/consensus/skills/create/scripts/consensus-create.mjs --brief <text>
node plugins/consensus/skills/create/scripts/consensus-create.mjs --brief-file <path>
```

Add `--template <path>` when the user has a preferred structure or style sample.
Template content is framed as untrusted source material; it guides the artifact
but does not override the user request or wrapper contract.

## Defaults

The create wrapper defaults to:

- `--cold-start independent_draft`
- `--iteration parallel_synthesized`
- `--agency maximum`

Under `independent_draft`, round 1 asks each peer to produce its own draft from
the brief rather than revise a shared starting artifact. In
`parallel_synthesized`, those peer drafts are merged through a synthesis call.

## Output

Without `--output`, the wrapper writes `consensus-create.md` in the invocation
directory and reports it in the `run_completed` event. With `--output <path>`,
that path receives the artifact.

The creation artifact contains:

- generated content under `## Created Artifact`
- a `## Resolution` section with a canonical `consensus-resolution` block
- `cold_start`, `iteration`, `agency`, `peer_calls`, and `synthesis_calls`
  metadata
- `## Deliberation Log` with embedded `consensus-verdict` and
  `consensus-synthesis` blocks

## Input handling

Briefs and templates are capped at 1 MiB. File-backed inputs, output paths, and
run directories are confined by `--allow-root` when provided. Treat brief and
template content as untrusted data; review the deliberation log before
publishing generated content.
