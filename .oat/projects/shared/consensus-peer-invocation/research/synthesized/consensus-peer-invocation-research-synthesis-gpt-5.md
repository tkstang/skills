---
skill: synthesize
schema: synthesis
topic: "Consensus peer invocation research synthesis"
model: gpt-5
generated_at: 2026-06-18
source_count: 7
---

# Consensus Peer Invocation Research Synthesis

## Executive Summary

Seven local research artifacts converge on the same practical direction:
replacing Paseo is still worth doing, but only as a narrow owned `consensus`
CLI for peer invocation, structured-output delivery, validation, diagnostics,
and audit capture. The work should not rebuild Paseo as a broad provider
platform.

The current method is `paseo run --provider <provider> --output-schema
<schemaPath> --json <prompt>`, wrapped by the consensus loop's own validation,
caps, retry, and audit/resume behavior. The research consistently treats that
consensus-side discipline as the valuable part to preserve. Paseo is useful
source material for schema prompting, validation retries, custom ACP provider
configuration, and provider diagnostics, but its daemon and broad provider
stack are not good first-scope dependencies for a shipped, dependency-free
plugin surface.

Stoa is the strongest direct implementation reference for the first slice:
spawn provider CLIs directly, normalize each provider's output, and select
schema delivery per provider. The synthesis lean is to borrow Stoa's command
and output-normalization patterns, but wrap them in a provider-adapter contract
instead of copying a closed provider enum.

Cursor remains the pressure case. The research agrees that Cursor CLI JSON is
a machine-readable envelope around free text, not a final schema guarantee.
The Cursor Agent SDK is worth evaluating because local custom tools can provide
a `submit_verdict`-style schema path, but it should be a behind-adapter spike,
not a load-bearing assumption in the first design.

Future provider support should shape the adapter boundary, not the first
implementation scope. Gemini, OpenCode, Kimi, Pi, OpenRouter, Ollama, GLM, and
other open-weight or OpenAI-compatible targets can be served later by capability
flags, base URL style adapters, or generic ACP/custom-command adapters. The
first design should still ship only the provider floor: Claude, Codex, and
Cursor.

The session-observer migration research does not change the provider decision.
Its value is implementation-substrate guidance: keep canonical TypeScript as
the edited source, generate committed dependency-free `.mjs` runtime outputs,
and verify generated entrypoints with drift checks and shipped-path tests.

## Synthesis Methodology

This synthesis consumed seven existing Markdown artifacts under
`.oat/projects/shared/consensus-peer-invocation/research/`:

- Four GPT-authored artifacts covering approach comparison, local prior art,
  external tooling, and session-observer migration relevance.
- Three Opus-authored artifacts under `research/opus/` covering a local
  comparison, web/tools scan, and recommendation.

No new web search, code inspection, or source verification was performed during
this synthesis. Claims below reconcile the existing artifacts by preserving
multi-source agreement, flagging open contradictions as leans rather than
decided facts, and attributing unique insights to their source artifacts.

Input schemas are mixed (`comparative`, `technical`, and `analysis`), so this
output uses the generic `synthesis` schema.

## Source Agreement

### Owned Narrow CLI Beats Continuing the Paseo Boundary

The peer comparison, local-prior-art survey, Opus local comparison, and Opus
recommendation all agree that Paseo currently solves more than this project
needs. Consensus needs one narrow primitive: invoke a peer once and return a
validated verdict record with useful diagnostics.

The agreed direction is an owned `consensus` CLI that can provide commands such
as:

```text
consensus provider ls --json
consensus run --provider <claude|codex|cursor> --schema <schema.json> --json <prompt>
```

The CLI should preserve useful Paseo ideas, especially validation loops,
structured retry prompts, provider probes, and configurable provider shapes,
without inheriting the daemon, workspaces, WebSocket transport, or broad
provider platform.

### Preserve the Consensus Loop's Validation Discipline

The Opus recommendation, Opus local comparison, peer comparison, and local
prior-art survey converge on the same preservation point: the current
consensus-side normalize, validate-shape, validate-caps, retry, byte-cap, and
audit/resume behavior is stronger than the surrounding tools.

The replacement should change the peer-invocation backend, not the core
deliberation control flow. Provider output remains untrusted until local
validation accepts it. Error taxonomy should become backend-neutral, but the
existing remediation style and retry semantics should survive.

### Stoa Is the Closest Direct Provider-Execution Reference

The peer comparison, local-prior-art survey, Opus local comparison, and Opus
recommendation all identify Stoa as the best source for first-scope provider
execution. Its useful patterns are direct `spawn`, per-provider command
builders, Codex final-message file capture, Cursor JSON envelope normalization,
schema-delivery selection, redacted diagnostics, and provider health/probe
concepts.

The caveat is also consistent: Stoa solves provider execution, not consensus
verdict reliability. Its logic should inform the adapter implementation while
the consensus CLI keeps its own validation, retry, verdict caps, and artifact
contracts.

### Structured Output Requires a Capability Ladder

The tooling landscape, Opus web scan, Opus recommendation, and peer comparison
agree that no single mechanism covers Claude, Codex, Cursor, and future
providers. The durable design should model structured output as a per-adapter
strategy:

1. Provider-native schema when available and practical.
2. Submit-tool or forced-tool verdict submission when the channel supports it.
3. Prompt-inject, parse, validate, and retry as the universal floor.

Local validation remains mandatory for every rung. Provider-native delivery can
reduce failure rates, but it should not replace the consensus contract.

### Cursor Is the Schema Pressure Case

All relevant artifacts agree that Cursor does not currently have a proven
native final-output schema guarantee in the CLI path. Cursor CLI JSON output is
an envelope that can help event capture and normalization, but the `result`
field is still text.

The Cursor SDK is more interesting because its local custom tools expose input
schemas. The research lean is to prototype a `submit_verdict` custom tool
behind the provider-adapter interface and compare its failure rate against the
prompt-and-parse path. Until that proof exists, Cursor should remain a
soft-schema provider.

### Long-Tail Providers Are Design Pressure, Not First Scope

The local-prior-art survey, Opus recommendation, Opus local comparison, and
Opus web scan all support future extensibility, but not as a first milestone.
The first implementation should cover Claude, Codex, and Cursor. The adapter
contract should still leave room for OpenAI-compatible base URL providers,
generic ACP/custom-command adapters, local Ollama-style structured output, and
future API-backed Gemini/OpenCode/Kimi/GLM paths.

### Generated Runtime Packaging Must Be Explicit

The session-observer analysis and discovery comparison agree that packaging is
a first-class design question. If the new CLI lives in the shipped plugin
surface, the repo conventions require canonical TypeScript source, generated
committed `.mjs` outputs, drift checks, and generated-entrypoint tests.

The unresolved boundary is whether there is one package-level reusable CLI, one
generated plugin entrypoint, or both sharing canonical TypeScript source.

## Contradictions

### Reusable CLI vs. First-Scope Narrowness

One position is that the CLI should be reusable by Stoa and future tools. The
opposing risk is that designing for every consumer could recreate Paseo.

Lean: design a reusable command boundary and adapter interface, but implement
only the consensus peer-invocation floor first. Stoa should be a future
consumer candidate, not an immediate migration requirement. This is a lean, not
a decided fact, because Stoa's exact consumption needs still need design-time
verification.

### Provider-Native Schema vs. Submit-Tool Verdicts

One position prefers provider-native structured output where available. Another
emphasizes submit-tool or forced-tool verdict capture as the more reliable
cross-agent primitive.

Lean: do not choose one globally. Use a capability ladder per adapter. Codex
may use `--output-schema`; Claude can use its best available schema/tool path;
Cursor should test SDK custom tools; every path still ends in local validation.
This remains a lean because real failure rates have not yet been measured in
this project.

### Cursor SDK vs. Cursor CLI Simplicity

The Cursor SDK may improve structured output through custom tools, but it adds
a TypeScript dependency, public-beta surface, local/cloud runtime distinction,
and defensive parsing requirements. Cursor CLI is simpler but appears to offer
only an output envelope.

Lean: keep Cursor CLI or prompt-validated behavior as the baseline and run a
small SDK spike behind the adapter. Adopt the SDK only if it materially reduces
schema failures and can fit the shipped-runtime dependency constraints.

### Long-Tail Provider Support vs. Avoiding Paseo Rebuild

The user goal includes future providers such as Gemini, Pi, Kimi, GLM,
OpenCode, and open-weight models. The counter-pressure is that broad provider
support is exactly what made Paseo too large for the current need.

Lean: encode provider capabilities and a registry/config shape now, but do not
ship broad provider catalog work in the first implementation. Generic ACP or
custom-command adapters can be later escape hatches with explicit "no schema
guarantee" semantics.

### Generated Plugin Entry Point vs. Package-Level CLI

The session-observer analysis surfaces a packaging contradiction: a shipped
plugin runtime wants generated dependency-free `.mjs` files, while Stoa-style
reuse may want a package-level CLI.

Lean: unresolved by research. The design phase must decide whether the stable
external command is generated, package-level, or both sharing canonical source.
This should be treated as a required design decision before implementation.

## Unique Insights

- The Opus recommendation introduces the clearest "three-rung" structured-output
  ladder and recommends a `ProviderAdapter` registry so providers are data, not
  branching logic.
- The Opus local comparison argues that the current Paseo path may be prompt and
  parse for Claude and Cursor despite appearing provider-native from
  consensus-cli's perspective. That should be verified before claiming parity or
  regression.
- The Opus web scan highlights ACP as useful for provider breadth but not for
  output guarantees, and identifies Gemini CLI as a schema gap while Ollama is a
  promising local structured-output path.
- The GPT tooling landscape notes that MCP tool input and output schemas may
  become useful for a `consensus submit` path, but only if peer invocations can
  actually see and call the MCP server in their execution context.
- The local-prior-art survey separates direct provider-execution references
  from orchestration references. Paseo and Stoa shape the first CLI; Claude
  Octopus, llm-council, and quorum-cli shape later audit, quorum, ranking, and
  discussion-method features.
- The session-observer analysis reframes the implementation risk: the hard part
  is not only provider commands, but maintaining generated runtime outputs,
  import rewrites, package boundaries, and shipped-entrypoint tests.

## Consolidated Recommendations

1. Proceed to design an owned `consensus` CLI as the replacement boundary for
   `paseo run`, while keeping Paseo as source material and possible fallback
   during migration.
2. Keep first implementation scope to `claude`, `codex`, and `cursor`.
3. Define a provider-adapter interface with capability flags for native schema,
   submit-tool support, prompt-only fallback, event envelope normalization,
   probes, and redacted diagnostics.
4. Port the useful Stoa direct-spawn behavior into that adapter shape, not into
   a Stoa-specific or closed-enum implementation.
5. Preserve the consensus loop's existing validation, caps, retries, audit
   records, and resume semantics. Rename backend-specific error codes only as
   part of an explicit compatibility plan.
6. Treat Cursor SDK custom tools as an isolated proof, with acceptance criteria
   based on stateless one-turn reliability, schema-failure rate, dependency
   posture, and audit capture quality.
7. Design for future providers through adapter capabilities and config shape,
   but defer Gemini/OpenCode/Kimi/GLM/Pi/OpenRouter/Ollama implementation until
   the provider floor is stable.
8. Resolve CLI packaging before implementation: package-level bin, generated
   plugin entrypoint, or both from shared canonical TypeScript.
9. Plan verification around parity fixtures, provider preflight/probe tests,
   invalid-output retry tests, byte-cap tests, audit/resume compatibility,
   generated-output drift checks, and smoke tests against shipped `.mjs`
   entrypoints.

## Provenance Table

| Source File | Skill | Schema | Model | Generated At |
| --- | --- | --- | --- | --- |
| `research/peer-invocation-structured-output-comparison.md` | compare | comparative | gpt-5 | 2026-06-17 |
| `research/local-prior-art-survey.md` | deep-research | technical | gpt-5 | 2026-06-17 |
| `research/tooling-landscape.md` | deep-research | technical | gpt-5 | 2026-06-17 |
| `research/session-observer-ts-migration-analysis.md` | analyze | analysis | gpt-5 | 2026-06-17 |
| `research/opus/recommendation-claude.md` | analyze | analysis | claude-opus-4 | 2026-06-17 |
| `research/opus/local-comparison-claude.md` | analyze | analysis | claude-opus-4 | 2026-06-17 |
| `research/opus/web-tools-scan-claude.md` | analyze | analysis | claude-opus-4 | 2026-06-17 |

## Sources & References

Local repositories and project artifacts referenced by the input research:

- `/Users/tstang/Code/consensus-cli`
- `/Users/tstang/code/paseo`
- `/Users/tstang/Code/stoa`
- `/Users/tstang/code/claude-octopus`
- `/Users/tstang/code/llm-council`
- `/Users/tstang/code/quorum-cli`
- `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration`

External references carried forward from the input research:

- Cursor SDK: https://cursor.com/docs/sdk/typescript
- Cursor CLI output format: https://cursor.com/docs/cli/reference/output-format
- Cursor SDK changelog: https://cursor.com/changelog/sdk-updates-jun-2026
- Claude Agent SDK structured outputs:
  https://code.claude.com/docs/en/agent-sdk/structured-outputs
- Anthropic structured outputs:
  https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Codex non-interactive / structured output:
  https://developers.openai.com/codex/noninteractive
- OpenAI structured outputs:
  https://developers.openai.com/api/docs/guides/structured-outputs
- MCP specification: https://modelcontextprotocol.io/specification
- Agent Client Protocol: https://agentclientprotocol.com/
- AI SDK structured outputs: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
- LangChain structured output:
  https://docs.langchain.com/oss/python/langchain/structured-output
- PydanticAI output docs: https://ai.pydantic.dev/output/
- Ollama structured outputs: https://ollama.com/blog/structured-outputs
- Gemini API structured output:
  https://ai.google.dev/gemini-api/docs/structured-output
- OpenCode SDK: https://opencode.ai/docs/sdk/
