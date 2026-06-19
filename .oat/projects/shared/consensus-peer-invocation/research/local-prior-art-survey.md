---
skill: deep-research
schema: technical
topic: "Local prior art for consensus peer invocation"
model: gpt-5
generated_at: 2026-06-17
---

# Local Prior Art Survey

## Scope

This survey covers local repos that might inform the consensus peer-invocation
design:

- `/Users/tstang/code/paseo`
- `/Users/tstang/Code/stoa`
- `/Users/tstang/code/claude-octopus`
- `/Users/tstang/code/llm-council`
- `/Users/tstang/code/quorum-cli`

The purpose is to extract lessons and code examples, not to choose an
implementation.

## Paseo

Paseo is the current dependency and the richest local reference for generic
provider orchestration.

Relevant code:

- `packages/server/src/server/agent/agent-response-loop.ts`
- `packages/server/src/server/agent/structured-generation-providers.ts`
- `packages/server/src/server/agent/providers/generic-acp-agent.ts`
- `packages/server/src/server/agent/providers/cursor-acp-agent.ts`
- `packages/cli/src/run.ts`
- `public-docs/supported-providers.md`
- `public-docs/custom-providers.md`

Key pattern:

```ts
const basePrompt = [
  prompt.trim(),
  "",
  "You must respond with JSON only that matches this JSON Schema:",
  schemaText,
].join("\n");
```

Then the loop calls the agent, extracts JSON from the final text, parses,
validates with Zod or AJV, and retries with validation errors.

What to borrow:

- Validation/retry loop with concrete validation errors.
- Provider availability and diagnostics as data.
- Fallback provider sequencing as a migration option.
- Cursor ACP readiness nuance: Cursor may need initial command waiting.

What not to borrow wholesale:

- A broad provider catalog as the first consensus scope.
- A generic ACP backend as the default structured-output strategy for the
  provider floor.
- A dependency on server/runtime concepts outside the shipped consensus plugin
  constraints.

## Stoa

Stoa is the closest fit for direct provider execution across the desired floor.

Relevant code:

- `apps/server/src/ai-workflows/provider-adapter.ts`
- `apps/server/src/ai-workflows/final-json-contract.ts`
- `apps/server/src/__tests__/ai-workflows/final-json-contract.test.ts`

Key command examples:

```text
claude --permission-mode bypassPermissions -p --json-schema <schema-json>
codex exec --cd <workspace> --output-schema <schema-file> --output-last-message <path>
cursor agent --print --output-format json --workspace <workspace> --trust --force <prompt>
```

Key output-normalization example:

```ts
if (result.type !== 'result') return invalidCursorOutput(...);
if (result.is_error !== false) return invalidCursorOutput(...);
if (result.subtype !== 'success') return invalidCursorOutput(...);
if (typeof result.result !== 'string') return invalidCursorOutput(...);
```

What to borrow:

- Provider-specific command builders for Claude, Codex, and Cursor.
- A separate schema-delivery decision: provider-native vs prompt-only.
- Cursor JSON envelope normalization.
- Contract tests that assert delivery mode by provider and workflow.

What not to borrow wholesale:

- Stoa server-specific workflow/logging/config types.
- Stoa workflow contracts that are unrelated to consensus verdict artifacts.
- The assumption that provider execution alone fully solves verdict reliability.

## Claude Octopus

Claude Octopus is broad orchestration prior art, not a narrow peer-invocation
primitive.

Relevant code:

- `mcp-server/dist/index.js`
- `scripts/orchestrate.sh`
- `scripts/lib/dispatch.sh`
- `scripts/lib/spawn.sh`
- `scripts/lib/council.sh`
- `scripts/lib/cursor-agent.sh`
- `tests/unit/test-council-command.sh`
- `tests/unit/test-structured-decisions.sh`

Key patterns:

- MCP server exposes workflows like `octopus_debate`, `octopus_council`, and
  `octopus_review`, then delegates to `scripts/orchestrate.sh`.
- Provider dispatch maps agent names to CLI commands, including Codex,
  Claude, Gemini, OpenRouter, Ollama, Qwen, Copilot, and Cursor.
- The council flow has goal/domain/style/depth/member options, quorum,
  critical-veto scanning, cost caps, provider status, run directories, and
  `summary.json` artifacts.

Example command mapping:

```sh
codex exec --skip-git-repo-check --model <model> --sandbox <mode> -
claude --print --allowed-tools Read,Glob,Grep
agent --trust --output-format text --model <model>
```

What to borrow:

- Provider status and cost/budget summary artifacts.
- Quorum/veto concepts as optional higher-level consensus guardrails.
- MCP exposure as a possible integration surface for orchestration commands.
- Run-directory summaries for human review.

What not to borrow wholesale:

- Bash-heavy orchestration as the consensus runtime shape.
- Broad provider fleet support as a first milestone.
- Text/result-file parsing as the core verdict reliability strategy.

## llm-council

llm-council is a small multi-model deliberation web app using OpenRouter.

Relevant code:

- `backend/council.py`
- `backend/openrouter.py`

Key pattern:

```py
stage1_results = await stage1_collect_responses(user_query)
stage2_results, label_to_model = await stage2_collect_rankings(user_query, stage1_results)
aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
stage3_result = await stage3_synthesize_final(user_query, stage1_results, stage2_results)
```

The ranking phase anonymizes answers as `Response A`, `Response B`, and so on,
then asks each model to emit a final ranking in a strict text format. A parser
extracts the `FINAL RANKING:` section and computes aggregate average ranks.

What to borrow:

- Independent response collection followed by anonymized peer ranking.
- Aggregate rank metadata as a deliberation signal.
- Chairman/synthesizer separation from peer response collection.

What not to borrow wholesale:

- API-only OpenRouter transport.
- Regex parsing as the primary structured-output strategy.
- A web-app conversation model.

## quorum-cli

quorum-cli is the strongest local reference for discussion method taxonomy and
interactive control-plane design.

Relevant code:

- `src/quorum/team.py`
- `src/quorum/agents.py`
- `src/quorum/ipc.py`
- `frontend/src/utils/export/schemas/*`
- `frontend/src/utils/export/parser/*`

Key patterns:

- Method registry includes `standard`, `oxford`, `advocate`, `socratic`,
  `delphi`, `brainstorm`, and `tradeoff`.
- `FourPhaseConsensusTeam` documents a four-phase structure: independent
  answers, structured critique, sequential discussion, and final positions with
  confidence.
- IPC uses JSON-RPC over stdin/stdout NDJSON with a running task, discussion
  lock, cancel/pause state, rate limiter, and bounded event queue.
- Input validation and prompt-injection sanitization are explicit before method
  recommendation.
- Export schemas and parsers are method-aware.

What to borrow:

- Discussion method names as a taxonomy reference for future consensus-family
  skills.
- JSON-RPC eventing, cancellation, pause, and backpressure as control-plane
  inspiration if consensus grows interactive runs.
- Method-aware export schema separation.
- Prompt-injection sanitization before model-driven method selection.

What not to borrow wholesale:

- A TUI/frontend-oriented IPC model for the first peer-invocation primitive.
- A general discussion application surface.
- Method complexity before the provider/verdict contract is settled.

## Cross-Repo Lessons

1. Separate provider execution from deliberation mechanics. Paseo and Stoa are
   provider-execution references; Octopus, llm-council, and quorum-cli are
   deliberation/orchestration references.
2. Keep structured-output validation inside the owned boundary even when a
   provider has native schema support. Native support improves reliability but
   does not replace consensus artifact validation.
3. Cursor needs a stronger design than prompt-only final JSON. Cursor CLI JSON is
   a machine-readable envelope; Cursor SDK custom tools are the more interesting
   path for validated verdict submission.
4. Audit summaries matter. Octopus and quorum-cli both make run artifacts and
   export surfaces visible; consensus should preserve or improve the current
   artifact trail.
5. Do not let method taxonomy drive the first contract. First settle
   provider/preflight/schema/verdict/error semantics for the narrow provider
   floor.

## Discovery Recommendation

Design should use three lanes:

- Direct lane: current consensus, Paseo, and Stoa inform the peer-invocation CLI
  contract.
- Submit lane: Cursor SDK custom tools and MCP/CLI submit surfaces inform the
  verdict-submission option.
- Orchestration lane: Octopus, llm-council, and quorum-cli inform future
  consensus-family features, summaries, quorum, and method taxonomies.

Only the direct and submit lanes should shape the first implementation scope.
