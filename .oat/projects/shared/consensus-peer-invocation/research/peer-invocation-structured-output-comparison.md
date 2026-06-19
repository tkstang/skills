---
skill: compare
schema: comparative
topic: "Consensus peer invocation approaches"
model: gpt-5
generated_at: 2026-06-17
---

# Peer Invocation Structured Output Comparison

## Scope

This artifact compares the current consensus/Paseo path, the latest Paseo main
approach, Stoa's direct provider adapter approach, and the proposed future
consensus-owned approach. It is discovery evidence only: it should inform
`spec.md` and `design.md`, not act as an implementation plan.

The core question is whether the project needs deeper analysis before design.
Answer: yes, but the useful analysis is now captured here and in adjacent
research artifacts. The high-order distinction is:

- Paseo and Stoa are directly relevant to one-shot provider execution and
  structured-output contracts.
- Claude Octopus, llm-council, and quorum-cli are useful prior art for
  deliberation orchestration, quorum, audit artifacts, streaming control, and
  export schemas, but they should not define the first peer-invocation
  primitive.

## Current Consensus Baseline

The current consensus runtime invokes Paseo directly:

```text
paseo run --provider <provider> --output-schema <schemaPath> --json <prompt>
```

Evidence:

- `plugins/consensus/skills/refine/scripts/consensus-loop.mjs:666-682` builds
  that exact Paseo command.
- `plugins/consensus/skills/refine/scripts/consensus-loop.mjs:728-765` maps
  nonzero exits and invalid stdout JSON into consensus errors.
- `plugins/consensus/skills/refine/scripts/consensus-loop.mjs:775-846` retries
  Paseo exits, invalid JSON, invalid verdict shapes, and invalid verdict caps.
- `plugins/consensus/skills/refine/scripts/consensus-loop.mjs:1855-1869` keeps
  the default peer and synthesizer invokers behind injectable call sites.
- `src/consensus/refine/consensus-refine.ts:3595-3623` preflights Paseo with
  `paseo --version` and `paseo provider ls --json`.
- `plugins/consensus/README.md:116-142` documents that peer IDs come from Paseo
  inventory and Cursor peer support is currently a custom ACP path with softer
  structured output.

Strengths:

- The consensus loop already owns validation, caps, retry, and artifact/audit
  semantics around the subprocess boundary.
- The `invokePeer` seam is already present, so migration can be designed without
  replacing deliberation control flow.
- Paseo inventory centralizes provider discovery today.

Weaknesses:

- The runtime depends on a larger provider platform for one narrow capability:
  execute one peer turn and return schema-shaped JSON.
- Cursor is not a first-class native structured-output peer in the documented
  current consensus path; it is opt-in through generic ACP.
- Preflight and error naming are Paseo-shaped (`PASEO_MISSING`, `PASEO_EXIT`,
  `PASEO_INVALID_JSON`) even if the future backend is not Paseo.

## Paseo Latest Main

Paseo latest main has a reusable structured-response loop:

- `/Users/tstang/code/paseo/packages/server/src/server/agent/agent-response-loop.ts:65-99`
  defines structured-generation options with a caller, prompt, schema, retries,
  and fallback-provider list.
- `/Users/tstang/code/paseo/packages/server/src/server/agent/agent-response-loop.ts:113-170`
  builds Zod or JSON Schema validators.
- `/Users/tstang/code/paseo/packages/server/src/server/agent/agent-response-loop.ts:173-192`
  injects a JSON Schema into the prompt and builds retry prompts with validation
  errors.
- `/Users/tstang/code/paseo/packages/server/src/server/agent/agent-response-loop.ts:296-340`
  calls the agent, extracts JSON, parses, validates, retries, and throws a
  structured response error when exhausted.
- `/Users/tstang/code/paseo/packages/server/src/server/agent/providers/generic-acp-agent.ts:44-120`
  wraps a configured ACP command, availability checks, and diagnostics.
- `/Users/tstang/code/paseo/packages/server/src/server/agent/providers/cursor-acp-agent.ts:16-28`
  specializes the ACP path for Cursor by waiting for asynchronous initial
  command publication.

Useful ideas for consensus:

- Keep schema validation and retry as local orchestration responsibilities.
- Normalize Zod/JSON Schema validation behind a provider-independent validator.
- Treat provider availability diagnostics as first-class data.
- Preserve fallback as a migration option, but make fallback behavior explicit.

Limits as a direct dependency:

- Paseo is still a broad agent/provider platform. Consensus needs a narrow,
  dependency-free shipped plugin surface.
- The generic ACP path still relies on prompt injection plus external validation
  rather than native final-output constraints for all providers.
- Porting Paseo wholesale would preserve much of the integration weight the
  project is trying to reduce.

## Stoa Direct Provider Adapter

Stoa is the closest local example of a narrow provider adapter:

- `/Users/tstang/Code/stoa/apps/server/src/ai-workflows/provider-adapter.ts:129-142`
  selects provider executables for `claude-cli`, `codex-exec`, and
  `cursor-agent`.
- `/Users/tstang/Code/stoa/apps/server/src/ai-workflows/provider-adapter.ts:183-205`
  builds Claude CLI args, using `--json-schema` only when inline schema JSON is
  available.
- `/Users/tstang/Code/stoa/apps/server/src/ai-workflows/provider-adapter.ts:208-243`
  builds Codex exec args, including `--output-schema` and
  `--output-last-message`.
- `/Users/tstang/Code/stoa/apps/server/src/ai-workflows/provider-adapter.ts:245-300`
  builds Cursor CLI args with `cursor agent --print --output-format json` and
  treats Cursor stdin differently from Claude/Codex.
- `/Users/tstang/Code/stoa/apps/server/src/ai-workflows/provider-adapter.ts:452-527`
  normalizes Cursor's JSON envelope and routes Codex through the
  `--output-last-message` file.
- `/Users/tstang/Code/stoa/apps/server/src/ai-workflows/final-json-contract.ts:125-143`
  explicitly chooses provider-native vs prompt-only schema delivery.
- `/Users/tstang/Code/stoa/apps/server/src/__tests__/ai-workflows/final-json-contract.test.ts:125-185`
  codifies Claude native delivery, Cursor prompt-only delivery, and Codex
  prompt-only defaults for generic contracts.

Useful ideas for consensus:

- The provider floor can stay small: Claude, Codex, Cursor.
- Command construction, schema delivery mode, output normalization, and error
  diagnostics should be separate decisions.
- Cursor should remain soft-schema unless a stronger live mechanism is proven.
- Codex native `--output-schema` can be opt-in or contract-specific rather than
  assumed universally safe.

Limits as a direct source:

- Stoa's implementation is server-shaped and depends on Stoa workflow types,
  logging, config, and workspace assumptions.
- It solves provider execution, not consensus verdict submission or consensus
  audit compatibility.
- It is evidence for design, not copy-paste-ready runtime code.

## Proposed Future Consensus Direction

The strongest direction remains a small consensus-owned CLI boundary, with
verdict submission evaluated as a first-class primitive.

Candidate command shapes for design discussion:

```text
consensus provider ls --json
consensus run --provider <claude|codex|cursor> --schema <schema.json> --json <prompt>
consensus submit --run-id <id> --schema <schema.json> --json <verdict.json>
```

The important design distinction:

- `run` is an execution primitive: start a provider, capture stdout/files/events,
  normalize output, validate it, and return one result or one failure.
- `submit` is a verdict primitive: let a peer call a validated local tool/command
  so the orchestrator receives a schema-checked verdict instead of scraping a
  final prose/JSON response.

Cursor SDK is relevant to the second primitive, not proven as native structured
final output:

- Cursor's official TypeScript SDK docs describe programmatic agent runs and
  local custom tools.
- The published `@cursor/sdk@1.0.19` declarations expose local `customTools`
  with `inputSchema`, and `SDKAgent.send()` returns a `Run` whose `result` is a
  string.
- Cursor CLI `--output-format json` documents a result envelope; that is useful
  for machine parsing but is not the same as a schema-constrained final verdict.

## Comparative Matrix

| Approach | Structured-output reliability | Scope fit | Cursor fit | Reuse potential | Main risk |
| --- | --- | --- | --- | --- | --- |
| Keep current Paseo path | Medium: local validation and retry, but backend stays Paseo-shaped | Medium | Medium-low; generic ACP and soft schema | Low-medium | Dependency and diagnostic surface stays broad |
| Lean into latest Paseo main | Medium-high for prompt/validate/retry discipline | Medium-low | Medium; Cursor ACP specialization helps readiness, not native final schemas | Medium | Still imports the provider platform problem |
| Port Stoa-style direct adapter into plugin | Medium-high for Claude/Codex, medium-low for Cursor | High for first migration | Medium-low unless submit-tool is added | Low | Duplicates provider logic across repos |
| Build reusable `consensus` CLI | High if it combines native schema where available with local validation | High if kept narrow | Medium now, potentially high with submit-tool | High | Over-designing a provider platform |
| Submit-tool verdict primitive | Potentially high because validation feedback happens in-context | Medium if scoped to verdicts | High candidate for Cursor SDK local custom tools | High | Needs proof for stateless one-turn peers and audit capture |
| Adopt a council framework/product | Low-medium for this primitive | Low | Varies | Low-medium | Solves broader orchestration, not the local coding-agent peer boundary |

## Recommendation

Proceed to design with a reusable `consensus` CLI boundary as the preferred
direction. Treat Stoa as the best local source for direct provider command and
schema-delivery design, and Paseo as the best local source for generic
structured-response retry/fallback design.

Do not adopt Paseo latest main wholesale and do not model the first design after
Octopus, llm-council, or quorum-cli. Those tools should inform guardrails,
control surfaces, audit summaries, and method taxonomy only.

Cursor SDK should be carried forward as a design candidate for a Cursor-specific
submit-tool path. It should not be treated as evidence that Cursor has native
schema-constrained final output.

## Sources

Local source paths:

- `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- `src/consensus/refine/consensus-refine.ts`
- `plugins/consensus/README.md`
- `/Users/tstang/code/paseo/packages/server/src/server/agent/agent-response-loop.ts`
- `/Users/tstang/code/paseo/packages/server/src/server/agent/providers/generic-acp-agent.ts`
- `/Users/tstang/code/paseo/packages/server/src/server/agent/providers/cursor-acp-agent.ts`
- `/Users/tstang/Code/stoa/apps/server/src/ai-workflows/provider-adapter.ts`
- `/Users/tstang/Code/stoa/apps/server/src/ai-workflows/final-json-contract.ts`

Web sources:

- Cursor TypeScript SDK: https://cursor.com/docs/sdk/typescript
- Cursor CLI output format: https://cursor.com/docs/cli/reference/output-format
- Cursor SDK custom tools changelog: https://cursor.com/changelog/sdk-updates-jun-2026
- Claude Agent SDK structured outputs: https://code.claude.com/docs/en/agent-sdk/structured-outputs
- Codex non-interactive structured outputs: https://developers.openai.com/codex/noninteractive
