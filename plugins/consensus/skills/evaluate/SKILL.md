---
name: evaluate
description: Use when evaluating an artifact against a rubric with two AI peers, unified findings, per-peer reasoning, and dissent preserved in the deliberation log.
version: '0.1.0'
license: MIT
compatibility: Agent Skills baseline; requires `paseo` CLI on PATH.
allowed-tools: Bash(node:*), Bash(paseo:*), Read, Write
argument-hint: <artifact.md> [--rubric <rubric.md>]
metadata:
  author: thomas.stang
  version: '0.1.0'
---

# Evaluate

Use this skill when the user wants an artifact judged against a rubric, spec, checklist, or acceptance criteria. The host model translates the user's intent into a wrapper invocation and summarizes the resulting evaluation. The deterministic work belongs to the scripts in this skill.

## Prerequisites

Before a run, ensure Node.js 22 or newer and `paseo` are available. If `paseo` is missing, tell the user the wrapper cannot invoke peers and point them to the install-assist script documented by this plugin. Do not auto-install dependencies.

Before invoking the evaluate wrapper with explicit peers or a synthesizer, the host/operator should run `paseo provider ls --json` and verify each requested provider is registered and ready. This evaluate wrapper validates provider ID syntax and surfaces Paseo/runtime failures from peer invocation, but it does not perform provider-inventory preflight or emit `PEER_UNAVAILABLE`.

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

## When NOT to Use

- You need to _improve_ an artifact through deliberation — use the `refine` skill instead.
- No rubric, spec, checklist, or acceptance criteria exists and you are not willing to collaboratively create one — the wrapper requires `--rubric <path>`.
- The artifact exceeds 1 MiB — the wrapper rejects oversized input before evaluation starts.
- You want a single quick opinion rather than structured peer judgment — a direct host-model review is cheaper and faster.
- The rubric has more than 12 distinct heading or bullet criteria — the wrapper silently drops criteria beyond the first 12; trim or prioritize before running.

## Examples

### Basic explicit-rubric invocation

```
Please evaluate this design doc against the attached rubric.
```

The host model invokes the wrapper from the skill directory:

```bash
node ./scripts/consensus-evaluate.mjs design-doc.md --rubric rubric.md
```

After the run, report the evaluation artifact path and summarize the key findings, peer disagreements, and any provider warnings.

### Conversational evaluation request

When the user does not provide a rubric upfront:

> "Can you evaluate this pull request description? I care most about clarity and completeness."

Ask what goals the evaluation should serve. Then either:

- Ask the user to point to an existing rubric file, or
- Offer to collaboratively create a rubric together before running the wrapper (see [Guided Rubric Creation](#guided-rubric-creation)).

## Success Criteria

- The wrapper exits cleanly and produces an evaluation artifact at the reported path.
- Unified findings from the converged or last-agreed evaluation are present in the artifact.
- Final status, key findings, peer disagreements, and any provider warnings from JSONL are relayed to the user.
- Residual dissent (`## Dissent`) and unresolved impasses (`## Unresolved dissent`) are surfaced explicitly — never hidden.
- If evaluation ends at impasse, divergent positions are presented and the user is asked how to proceed.

## Operator QA

For a hands-on walkthrough of artifact/rubric inputs, expected JSONL, sidecar output, and dissent review, see `references/operator-qa.md`.
