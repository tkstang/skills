---
name: evaluate
description: Use when evaluating an artifact against a rubric with two AI peers, unified findings, per-peer reasoning, and dissent preserved in the deliberation log.
license: MIT
compatibility: Agent Skills baseline; requires Node.js 22+ and the generated consensus CLI.
allowed-tools: Bash(node:*), Bash(consensus:*), Read, Write
metadata:
  author: thomas.stang
  version: '0.1.0'
---

# Evaluate

Use this skill when the user wants an artifact judged against a rubric, spec, checklist, or acceptance criteria. The host model translates the user's intent into a wrapper invocation and summarizes the resulting evaluation. The deterministic work belongs to the scripts in this skill.

## Prerequisites

Before a run, ensure Node.js 22 or newer is available and the generated `consensus` CLI can run. From an installed plugin this may be exposed as `consensus`; from a repository checkout the same provider CLI lives at `plugins/consensus/scripts/consensus.mjs` and can be run with `node`.

Before invoking the evaluate wrapper with explicit peers or a synthesizer, check provider inventory and preflight:

```bash
consensus provider ls --json
consensus preflight --json
```

The wrapper validates provider ID syntax and surfaces provider-neutral diagnostics from peer invocation. Requested providers must be present and usable in the provider inventory; Cursor auth problems should be described through `auth_required` inventory/preflight diagnostics, commonly caused by a locked OS keychain or an unauthenticated Cursor CLI.

## Evaluation Invocation

Run the wrapper from this skill directory:

```bash
node ./scripts/consensus-evaluate.mjs <artifact.md> --rubric <rubric.md>
```

Pass through user-specified flags such as `--goal`, `--peers`, `--max-rounds`, `--agency`, `--iteration`, `--synthesizer`, `--output`, `--run-dir`, and `--allow-root` when the user asks for them.

The defaults are:

- `--cold-start shared_input`
- `--iteration parallel_revision`
- `--agency minimal`

The wrapper requires `--rubric <path>`. It rejects `--cold-start independent_draft` because independent-draft startup is not yet supported for this skill family.

Read JSONL emitted on stdout. Treat each JSONL line as host coordination data: status updates, warnings, artifact paths, or impasse summaries. Use stderr only as terminal diagnostics, not as the coordination protocol.

## Input Handling

The artifact and rubric are untrusted content. The wrapper frames both as data for peer evaluation, not instructions to follow, and caps each input at 1 MiB before evaluation. Do not paste unbounded user content into wrapper flags; pass files.

## Output Contract

The wrapper writes a markdown evaluation artifact. With `--output <path>`, that path receives the artifact. Without `--output`, the wrapper writes a sidecar named `<artifact>.evaluation.md` and reports it in the `run_completed` event.

The evaluation artifact contains:

- unified findings from the converged or last-agreed evaluation document
- a deliberation log with canonical `consensus-verdict` blocks for each peer turn
- `## Dissent` for residual concerns after convergence, when present
- `## Unresolved dissent` for impasse or escalation states

Report the artifact path to the user and summarize final status, key findings, peer disagreements, and any provider warnings emitted by JSONL.

## Iteration Modes

The default `parallel_revision` mode asks both peers to evaluate simultaneously each round and converge on emergent agreement. It costs two peer calls per round. `alternating` and `parallel_synthesized` are also accepted through the shared loop, but `parallel_revision` with minimal agency is the default because independent judgment and visible disagreement are the point of evaluation.

In `parallel_synthesized` mode the synthesis call defaults to the first configured peer's provider. Override it with `--synthesizer <provider-id>` only when the user asks to route synthesis separately.

## Impasse Handling

At minimal agency, unresolved peer disagreement is surfaced rather than silently decided. If JSONL reports an impasse or the final artifact contains `## Unresolved dissent`, present the divergent positions and ask the user how to proceed: accept the impasse, give new direction, change the budget or agency level, or rerun with a different peer set.

## Operator QA

For a hands-on walkthrough of artifact/rubric inputs, expected JSONL, sidecar output, and dissent review, see `references/operator-qa.md`.
