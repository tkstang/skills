---
name: refine
description: Use when refining a draft and you want two AI peers to deliberate to convergence with structured verdicts, a final artifact, and a readable audit trail.
version: '0.1.6'
license: MIT
compatibility: Agent Skills baseline; requires Node.js 22+ and the generated consensus CLI.
allowed-tools: Bash(node:*), Bash(consensus:*), Read, Write
argument-hint: <input-artifact.md> [--goal "<refinement goal>"]
metadata:
  author: thomas.stang
  version: '0.1.6'
---

# Refine

Use this skill when the user wants a markdown draft refined through two-peer deliberation. The host model translates the user's intent into a wrapper invocation, coordinates host-native parallel dispatch when requested, and summarizes the resulting artifact. The deterministic work belongs to the scripts in this skill.

## Prerequisites

Before a run, ensure Node.js 22 or newer is available and the generated `consensus` CLI can run. From an installed plugin this may be exposed as `consensus`; from a repository checkout the same provider CLI lives at `plugins/consensus/scripts/consensus.mjs` and can be run with `node`.

Use provider inventory and provider-neutral preflight before expensive runs:

```bash
consensus provider ls --json
consensus preflight --json
```

The wrapper fails closed when a requested peer is missing, unavailable, unsupported, or auth-required. Relay the named provider, status, and remediation hint from the provider inventory rather than retrying. Cursor auth problems should be described through `auth_required` inventory/preflight diagnostics, commonly caused by a locked OS keychain or an unauthenticated Cursor CLI.

Provider `run` failures are reported in JSON envelopes. Terminal provider failures such as `ok: false`, `PROVIDER_EXIT`, `PROVIDER_INVALID_JSON`, or `PROVIDER_SCHEMA_VALIDATION` still exit process `0`; do not treat `$?` as success. Parse the envelope fields (`ok`, `code`, `retryable`, and `attempts.terminal_reason`) and report the structured failure. CLI usage failures (`CONSENSUS_CLI_USAGE`) exit `2`. The peer-facing `consensus submit` command is different: schema or capture failures exit nonzero so the peer can self-correct in-turn.

## Sequential Invocation

For the default one-shot path, run the wrapper from this skill directory:

```bash
node ./scripts/consensus-refine.mjs <input.md> --goal "<goal>"
```

Pass through user-specified flags such as `--peers`, `--max-rounds`, `--agency`, `--iteration`, `--synthesizer`, `--output`, `--resume`, `--allow-root`, and `--fail-on-section-error` when the user asks for them. The default mode is sequential section processing with the `alternating` iteration mode. See [Iteration Modes](#iteration-modes) for the parallel modes and their cost multipliers.

Read JSONL emitted on stdout. Treat each JSONL line as host coordination data: status updates, warnings, artifact paths, impasse summaries, or parallel dispatch instructions. Use stderr only as terminal diagnostics, not as the coordination protocol.

## Iteration Modes

Select how the two peers deliberate with `--iteration <mode>`. The default is `alternating`. Pass the flag through only when the user asks for a parallel mode or when their goal warrants the extra cost.

- `alternating` (default): one peer revises and the other responds, turn by turn. Lowest cost — one peer call per round.
- `parallel_revision`: both peers revise the same input simultaneously each round, each critiquing its own and the peer's previous revision; the run converges on emergent agreement. Costs **2x peer calls** per round (two peer calls instead of one).
- `parallel_synthesized`: parallel revision plus a wrapper-driven synthesis call each round that merges both revisions into the next round's shared input. Costs **2x peer calls plus one synthesis call** per round.

Cost disclosure rides the `run_started` event: read its `iteration_mode` and `calls_per_round: { peer, synthesis }` fields and relay the multiplier to the user before a long run. At completion, the `run_completed` event and the resolution block report the actual `peer_calls` and `synthesis_calls` totals.

Pick the mode by what the document needs: `alternating` for routine tightening; `parallel_revision` when independent convergence is the signal you want; `parallel_synthesized` when you want a merged draft each round on contested material. The extra spend is the trade-off — disclose it.

### Synthesizer selection

In `parallel_synthesized` mode the synthesis call defaults to the first configured peer's provider. Override it with `--synthesizer <provider-id>` to run routine merging on a cheaper model; the provider must be present and usable in the provider inventory or preflight fails (`SYNTHESIZER_UNAVAILABLE`). The flag is warned-and-ignored outside `parallel_synthesized` mode. The synthesizer identity is recorded with every synthesis record and in the resolution block.

Invalid mode values fail preflight with `INVALID_ITERATION_MODE` and a message listing the allowed modes.

## Resume and Recovery

Use `--resume <artifact-path>` to continue from a prior deliberation artifact. Resume state comes from the artifact's canonical section states and deliberation records; do not reconstruct completed sections from the current input file.

When the prior run stopped at impasse or max rounds and the user gives new direction, pass it through with `--user-direction "<direction>"`. User direction is recorded as a user round in the new deliberation artifact.

If resume reports corrupt section state, surface the diagnostics path and ask before skipping anything. Use `--skip-corrupt-section <section-id>` for explicit per-section skips, `--skip-all-corrupt` when the user approves skipping every corrupt section interactively, and `--yes-skip-corrupt` only when the user has already approved non-interactive corrupt-section skipping. Do not silently restart corrupt sections or discard resume records.

## Parallel Orchestration

Parallel mode is host mediated. The wrapper prepares packets and the host model dispatches subagents; the wrapper does not spawn host-native agents directly.

1. Prepare:

```bash
node ./scripts/consensus-refine.mjs <input.md> --prepare-parallel --goal "<goal>"
```

2. Parse the JSONL line with `phase: "parallel_dispatch_required"`. It includes the manifest path, section packets, and requested `parallelism`.
3. Dispatch one bounded section-runner subagent per section packet using the host runtime's native mechanism. Use `plugins/consensus/agents/consensus-section-runner.md` as the task contract.
4. Batch dispatches by the requested `parallelism`: launch at most that many section runners at once, wait for a batch to finish, then launch the next batch until every manifest section has produced its declared files.
5. After every section runner writes its declared files, fan in:

```bash
node ./scripts/consensus-refine.mjs --fan-in <manifest-path>
```

Keep result assembly in original section order. If a section reports impasse or error, continue collecting other completed sections unless the user's flags require failure.

On SIGINT or user cancellation during parallel dispatch, the host model owns cleanup. Cancel outstanding subagents using the host runtime's native cancellation mechanism, then run `--fan-in <manifest-path>` only for completed section outputs if the user wants a partial artifact. The wrapper does not own host-native subagent processes and cannot cancel them directly.

## Codex Authorization

When running under Codex and host-native subagent dispatch requires user authorization, ask once before dispatching section runners. If authorization is denied or unavailable, fail closed: do not silently switch to sequential mode and do not claim parallel execution occurred. Tell the user how to rerun sequentially if they want that fallback.

## Impasse Handling

If JSONL reports an impasse, surface the divergent options clearly: choose one revision, blend revisions, give new direction, change the budget or agency level, or accept the impasse. User direction must be captured by the wrapper as a user round entry in the deliberation artifact. Do not hide section impasses when summarizing a run.

## Escalation Handling

Parallel modes can produce a structured **escalation** when a section gets stuck — persistent unresolved disagreements, oscillation, budget exhaustion, or a declare-done-despite-drift state. The wrapper emits an `escalation_required` JSONL event and the run ends at that section (headless behavior, like impasse). The event carries the divergent state: `trigger`, `decide_via`, `decision_kinds`, the two divergent revisions (and synthesis text plus `unresolved_disagreements` in synthesized mode), an optional `promoted_from`, and a `resume` vector with the artifact path and the flag to use.

Branch on `decide_via`:

- **`decide_via: user`** — present the divergent options to the user exactly as you would an impasse (pick one revision, blend, give new direction, change budget/agency, or accept the impasse). The user's answer re-enters via `--resume <artifact> --user-direction "<text>"` and records as a user round. This is the only path at minimal agency.
- **`decide_via: host`** — you decide using the conversation context, then re-invoke `--resume <artifact> --host-direction "<decision text>"` (optionally `--host-decision-kind <kind>` where kind is one of `pick_a`, `pick_b`, `blend`, `direct`, `accept_impasse`, `extend_budget`, or `defer_to_user`). The decision records as an attributed `HOST_DECISION` orchestrator round, distinct from user rounds. **Always disclose the decision you made to the user in conversation** — host-decided rounds are not silent; the user must be able to see what you chose and why.

If you cannot responsibly make a host-routed call, decline with `--host-decision-kind defer_to_user`; the wrapper re-emits the escalation routed to the user without consuming budget. Never self-decide an escalation that the event routes to the user: `--host-direction` against a user-routed escalation is rejected fail-closed (`ESCALATION_ROUTING`).

A `promoted_from: 'host'` marker means a previously host-routed escalation has been promoted to the user because a host decision was already tried and the trigger re-fired (genuinely stuck) — present it to the user.

## Output Contract

The wrapper writes a markdown deliberation artifact. Report the artifact path to the user and summarize the final status, section counts, impasses, and any release-time or provider warnings emitted by JSONL.

## When NOT to Use

- The document does not need structured peer deliberation — quick edits or single-pass rewriting do not justify the peer-call cost.
- You need fast, low-cost feedback: use a single peer review or the host model's own editing capability instead.
- The input artifact exceeds 1 MiB — the wrapper rejects oversized inputs before evaluation starts.
- The goal is to _evaluate_ an artifact against a rubric, not to improve it through deliberation — use the `evaluate` skill instead.
- You are looking for a yes/no acceptance decision rather than a converged revision — again, `evaluate` is the better fit.

## Examples

### Basic one-shot refinement

```
Please refine this draft using the consensus skill.
```

The host model invokes the wrapper from the skill directory:

```bash
node ./scripts/consensus-refine.mjs proposal.md --goal "Tighten the argument and cut filler prose"
```

After the run, report the output artifact path and summarize the key changes made.

### Conversational invocation

When the user describes what they want in natural language:

> "Can you clean up this RFC? The structure is fine but the wording is too wordy."

Translate the request: the goal is conciseness-focused tightening. Run the sequential wrapper with an explicit goal flag matching the user's intent, then summarize the result inline.

## Success Criteria

- The wrapper exits cleanly and produces a deliberation artifact at the reported path.
- The artifact contains a converged revision (not just an impasse record) for every section.
- Final status, section counts, impasses, and any provider warnings from JSONL are relayed to the user.
- If the run ends at impasse or max rounds, the divergent options are presented and the user is asked how to proceed.
- Parallel runs disclose the cost multiplier before dispatching section runners.

## Operator QA

For a hands-on walkthrough of the iteration modes and the escalation ladder against live peers — exact commands, example inputs, expected JSONL and artifact shapes, and the per-mode cost/quality comparison — see `references/operator-qa.md`. The runnable example documents live in `references/examples/`.
