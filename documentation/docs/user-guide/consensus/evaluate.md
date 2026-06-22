---
title: 'Evaluate'
description: 'Run the evaluate skill to judge an artifact against a rubric with two AI peers, unified findings, embedded verdict records, and preserved dissent.'
---

# Evaluate

`evaluate` judges an artifact against a rubric, spec, checklist, or acceptance
criteria using two provider-CLI-backed AI peers, preserving unified findings,
per-peer reasoning, and dissent in the deliberation log.

For an operator walkthrough of evaluation inputs, expected JSONL, sidecar output,
and dissent review, see the
[consensus plugin README](https://github.com/tkstang/skills/blob/main/plugins/consensus/README.md) and
[`skills/evaluate/references/operator-qa.md`](https://github.com/tkstang/skills/blob/main/plugins/consensus/skills/evaluate/references/operator-qa.md).

## Evaluate an artifact against a rubric

```bash
node plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs artifact.md --rubric rubric.md
```

## Defaults

The evaluate wrapper defaults to:

- `--cold-start shared_input` (cold start)
- `--iteration parallel_revision`
- `--agency minimal`

`parallel_revision` with minimal agency is the default because independent
judgment and visible disagreement are the point of evaluation. The wrapper
requires `--rubric <path>` and rejects `--cold-start independent_draft` because
evaluate compares an existing artifact against a rubric. `independent_draft` is
for the create/decide/plan wrappers that start from briefs, options, or goals
rather than an existing artifact.

## Output

Without `--output`, the wrapper writes a sidecar named `<artifact>.evaluation.md`
and reports it in the `run_completed` event; with `--output <path>`, that path
receives the artifact. The evaluation artifact contains:

- unified findings from the converged or last-agreed evaluation document
- embedded `consensus-verdict` records for each peer turn
- `## Dissent` for residual concerns after convergence, when present
- `## Unresolved dissent` for impasse or escalation states

At minimal agency, unresolved peer disagreement is surfaced rather than silently
decided — never hidden.

## Guided rubric creation

If you want an evaluation but do not have a rubric yet — or you ask for help
authoring one — the `evaluate` skill runs a host-model guided flow: it elicits
your evaluation goals, adapts one of the bundled example rubrics, writes a draft
to a path you approve, then invokes the wrapper with `--rubric`. The raw
`--rubric` contract above is unchanged for users who already have a rubric.

Rubric criteria are the `##`–`######` headings and `-` / `*` bullets in the file,
and the wrapper uses the first 12 distinct criteria, so keep the load-bearing
ones near the top. Weights and scoring scales are peer-facing guidance, not
machine-parsed structure.

Four ready-to-adapt example rubrics ship under
`skills/evaluate/references/examples/`:

- `general-purpose.md` — annotated template for any written artifact
- `code-review.md` — pull request descriptions and implementation proposals
- `technical-writing.md` — documentation, tutorials, and API reference
- `design-architecture.md` — ADRs, system designs, and RFCs
