---
skill: deep-research
schema: technical
topic: "Structured-output and multi-agent tooling landscape"
model: gpt-5
generated_at: 2026-06-17
---

# Tooling Landscape

## Executive Summary

No reviewed external tool appears to directly solve this project's exact need:
a small local boundary that invokes coding-agent CLIs as peers, supports the
provider floor `claude` + `codex` + `cursor`, returns validated verdict records,
and preserves consensus audit/resume semantics.

The web scan does reveal useful design patterns:

- Agent SDKs increasingly expose native structured final output.
- Generic LLM libraries expose schema validation over API calls.
- Tool-call/submission paths are a strong alternative when final JSON is weak.
- MCP and ACP are useful protocols, but they solve different parts of the
  problem.
- Multi-agent frameworks tend to be too broad for the first peer-invocation
  boundary.

## Agent CLI and SDK Surfaces

### Claude Agent SDK

Claude Agent SDK structured outputs are directly relevant. The docs describe
validated JSON after multi-turn tool use, schema validation, retries on mismatch,
and typed output using JSON Schema, Zod, or Pydantic.

Fit:

- Strong fit for Claude provider-native structured output.
- Useful model for error semantics when retries are exhausted.
- Also supports custom tools, which is relevant to a submit-tool design.

Limit:

- Claude-specific. It does not define Cursor or Codex behavior.

Source: https://code.claude.com/docs/en/agent-sdk/structured-outputs

### Codex CLI

Codex non-interactive mode documents JSONL event output, `--output-last-message`,
and `--output-schema` for final structured responses.

Fit:

- Strong fit for Codex provider-native or provider-assisted schema delivery.
- `--output-last-message` is useful for separating final answer capture from
  progress/event output.

Limit:

- This only covers Codex. The design still needs provider-independent
  validation and error normalization.

Source: https://developers.openai.com/codex/noninteractive

### Cursor CLI

Cursor CLI output format docs describe JSON and stream-json envelopes. The final
successful JSON result shape includes a result event with fields such as
`type`, `subtype`, `is_error`, and a `result` string.

Fit:

- Strong fit for machine-readable process output and event capture.
- Useful for Stoa-style Cursor normalization.

Limit:

- This is an output envelope, not evidence of schema-constrained final verdicts.

Source: https://cursor.com/docs/cli/reference/output-format

### Cursor TypeScript SDK

Cursor TypeScript SDK is relevant because it exposes local custom tools. The
docs and `@cursor/sdk@1.0.19` type declarations show:

- `SDKAgent.send(message, options)` returns a `Run`.
- `Run.result` is a string.
- `local.customTools` can be provided at agent creation or per send.
- Custom tools have `inputSchema` and an `execute` callback.
- Custom tools are local-only and exposed through a built-in
  `custom-user-tools` MCP server.

Fit:

- Strong candidate for a Cursor-specific verdict submit tool.
- More promising than asking Cursor CLI to end with schema-perfect final JSON.

Limit:

- Needs a proof that a stateless one-turn Cursor peer reliably discovers and
  uses a required custom tool.
- Adds SDK dependency and local/cloud distinction to the design.

Sources:

- https://cursor.com/docs/sdk/typescript
- https://cursor.com/changelog/sdk-updates-jun-2026
- `@cursor/sdk@1.0.19` published package declarations inspected on 2026-06-17.

## Structured Generation Libraries

### AI SDK

Vercel AI SDK structured output standardizes object generation across providers
using schemas and validation. Its docs explicitly note that models can still
produce incorrect or incomplete structured data, so callers need schemas and
validation.

Fit:

- Good reference for schema abstraction and provider normalization.
- Its ACP provider ecosystem is worth watching for future integration.

Limit:

- It primarily wraps language model/provider APIs, not local coding-agent CLI
  sessions with workspace tools and existing auth.

Source: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data

### LangChain

LangChain distinguishes provider-native structured output from tool-strategy
structured output. It also notes that native support depends on model/provider
capabilities and that tools plus structured output require simultaneous support.

Fit:

- Good conceptual match for the consensus design question:
  provider-native where possible, tool strategy where better.

Limit:

- Framework dependency is too broad for the shipped consensus plugin.

Source: https://docs.langchain.com/oss/javascript/langchain/structured-output

### Pydantic AI

Pydantic AI output docs are useful mainly as a caution: some schema paths depend
on the model interpreting a schema, and validation errors may need to be reflected
back with an output validator.

Fit:

- Reinforces the need for local validation and retry feedback.

Limit:

- Python framework, not a local coding-agent CLI boundary.

Source: https://pydantic.dev/docs/ai/core-concepts/output/

### Mastra, Strands, CrewAI, AutoGen

These frameworks all offer some form of structured output, tool calling, or
multi-agent composition.

Fit:

- Useful as background evidence that schema and tool-call strategies are common
  design patterns.

Limit:

- They are broad application frameworks. They do not remove the need to support
  local Claude/Codex/Cursor command behavior, auth, preflight, output capture,
  and consensus audit compatibility.

Sources:

- https://mastra.ai/docs/agents/structured-output
- https://strandsagents.com/docs/user-guide/concepts/agents/structured-output/
- https://docs.crewai.com/en/concepts/tasks
- https://microsoft.github.io/autogen/0.4.6//user-guide/agentchat-user-guide/tutorial/agents.html

## Protocol Surfaces

### MCP

MCP tools have input schemas, and the current specification also allows output
schemas for tool result validation. This matters for a submit-tool design because
the verdict can be treated as a tool input rather than final prose.

Fit:

- Strong candidate for exposing `consensus submit` to agents that can use MCP.
- Useful schema vocabulary for tool arguments and structured tool results.

Limit:

- Availability depends on whether each peer invocation can access the MCP server
  in its execution context.

Source: https://modelcontextprotocol.io/specification/2025-06-18/server/tools

### ACP

ACP standardizes editor/client to coding-agent communication over local or
remote transports. Paseo uses ACP as a provider integration path.

Fit:

- Good abstraction for launching and interacting with coding agents.
- Relevant if consensus wants to keep broad coding-agent compatibility later.

Limit:

- It is not itself a verdict schema or final-output guarantee.
- Broad ACP support is outside the current provider floor.

Source: https://agentclientprotocol.com/get-started/introduction

## External Tools Worth Watching

| Tool or surface | What it offers | Fit for this project |
| --- | --- | --- |
| Claude Agent SDK structured output | Validated structured final output after tool use | Strong for Claude-specific adapter ideas |
| Codex CLI `--output-schema` | Final response constrained by JSON Schema | Strong for Codex adapter ideas |
| Cursor SDK custom tools | Local in-process tool callbacks with input schemas | Strong candidate for Cursor submit-tool path |
| AI SDK / LangChain | Provider/tool strategies for structured output | Good conceptual references, too broad as dependencies |
| MCP tools | Standard tool input/output schemas | Strong submit-tool integration candidate |
| ACP | Coding-agent subprocess protocol | Useful fallback/provider abstraction, not enough alone |
| CrewAI / AutoGen / Mastra / Strands | Multi-agent or agent framework structured output | Too broad for first consensus primitive |

## Design Implications

1. Keep the first owned boundary narrow. External frameworks do not replace the
   need for local CLI-specific process handling.
2. Model structured output as a strategy, not a single flag. Claude, Codex, and
   Cursor have different capabilities.
3. Treat Cursor SDK custom tools as a serious submit-tool candidate because it
   offers schema-shaped tool arguments where Cursor CLI final output does not.
4. Keep local validation and consensus verdict normalization even when a provider
   advertises native structured output.
5. Do not commit to MCP-only submit unless design proves every peer path can see
   and call the MCP server in the relevant execution context.
