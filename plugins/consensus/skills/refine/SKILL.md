---
name: refine
description: Use when refining a draft and you want two AI peers to deliberate to convergence with structured verdicts, a final artifact, and a readable audit trail.
license: MIT
compatibility: Agent Skills baseline; requires `paseo` CLI on PATH.
allowed-tools: Bash(node:*), Bash(paseo:*), Read, Write
metadata:
  author: thomas.stang
  version: "0.1.0"
---

# Refine

Use this skill when the user wants a markdown draft refined through two-peer deliberation. The host model translates the user's intent into a wrapper invocation, coordinates host-native parallel dispatch when requested, and summarizes the resulting artifact. The deterministic work belongs to the scripts in this skill.

## Prerequisites

Before a run, ensure Node.js 22 or newer and `paseo` are available. If `paseo` is missing, tell the user the wrapper will fail preflight and point them to the install-assist script documented by this plugin. Do not auto-install dependencies.

## Sequential Invocation

For the default one-shot path, run the wrapper from this skill directory:

```bash
node ./scripts/consensus-refine.mjs <input.md> --goal "<goal>"
```

Pass through user-specified flags such as `--peers`, `--max-rounds`, `--agency`, `--output`, `--resume`, `--allow-root`, and `--fail-on-section-error` when the user asks for them. The default mode is sequential section processing.

Read JSONL emitted on stdout. Treat each JSONL line as host coordination data: status updates, warnings, artifact paths, impasse summaries, or parallel dispatch instructions. Use stderr only as terminal diagnostics, not as the coordination protocol.

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

## Output Contract

The wrapper writes a markdown deliberation artifact. Report the artifact path to the user and summarize the final status, section counts, impasses, and any release-time or provider warnings emitted by JSONL.
