---
skill: analyze
schema: analysis
topic: "Web tools/frameworks for multi-agent deliberation & structured output"
model: claude-opus-4
generated_at: 2026-06-17
input_type: web research scan
project: consensus-peer-invocation
---

# Web Tools Scan: Structured Output, Submit-Tools, ACP & Multi-Agent Consensus

External scan for the consensus-cli initiative. Access date for **all** sources:
**2026-06-17**. Lens: an owned multi-provider peer-invocation CLI with reliable
structured output; floor `claude` + `codex` + `cursor`; extended provider
support (gemini, pi, kimi, open-weight, OpenCode) **desired but not required**.

## Executive Summary

- **Cursor SDK helps structured output ONLY via the custom-tool / submit-verdict
  path — not via constrained final output.** Neither Cursor CLI, Cursor SDK, nor
  ACP can force the final message to match a schema. The SDK's one advantage over
  the CLI is `local.customTools` with an `inputSchema` (the forced submit-tool
  pattern). That advantage costs a TS dependency, a public-beta surface, and
  defensive parsing of not-yet-stable tool schemas.
- **ACP is the wrong layer for an output contract** but the right layer for
  cheap provider breadth. Its schema carries **no** `outputSchema`/
  `response_format` and tool calls carry **untyped** `rawInput`/`rawOutput`.
  Great for "add gemini/cursor/opencode quickly," useless for verdict fidelity.
- **The submit-tool / forced-tool pattern is the unifying primitive.** It is
  native to the Claude and OpenAI APIs, is the *only* structured path the Cursor
  SDK offers, and degrades to prompt+validate+retry for anything that can't be
  tool-forced (Gemini CLI, free-text CLIs).
- **Provider-native structured output splits cleanly:** Codex CLI is the strong
  CLI citizen (`--output-schema`); Claude Code CLI's `--json-schema` is
  post-hoc-validated-with-retry (not constrained decoding); Cursor has no native
  flag; Gemini CLI is a gap (API-only); Ollama is solid locally.
- **llm-consortium is the closest prior art** to the consensus algorithm; the
  differentiator nobody nails is **enforced structured output through the whole
  consensus loop** — consensus-cli's premise.

---

## 1. Cursor Agent SDK vs cursor-agent CLI vs ACP (the central question)

**Finding.** The Cursor SDK exists (TypeScript, public beta, `npm install
@cursor/sdk`, ~April 2026). On structured output:

- **Schema-constrained final output: NOT supported in SDK *or* CLI.** SDK
  returns the answer as plain text on `RunResult.result`; no `outputSchema`/
  `output_format`. The CLI's `--output-format json` only wraps free text in a
  metadata envelope (`type`, `subtype`, `is_error`, `result`, `session_id`,
  `request_id`, `duration_ms`) — no `--output-schema`. **The SDK gives no
  advantage over the CLI for final-output structuring.**
- **SDK supports custom tools with input schemas; the CLI does not.**
  `local.customTools` accepts `SDKCustomTool` objects with an `inputSchema` +
  `execute` handler, exposed to the agent via a built-in MCP server
  (`custom-user-tools`). This is the submit-verdict path.
- **Both local and cloud.** Three runtimes: in-process local, Cursor-hosted
  cloud, self-hosted cloud. All inference goes through Cursor's hosted models.
  Custom tools documented for the **local** runtime.
- **Stability caveat:** Cursor's docs warn tool-call schemas are **not stable —
  parse defensively**; SDK is public beta.

**Implication.** The SDK *would* improve Cursor structured output for
consensus-cli — but only by defining a `submit_verdict` custom tool with the
verdict `inputSchema` and reading validated args from the tool invocation,
**not** by constraining final output. This is architecturally consistent with
the Claude/Codex forced-tool path. Costs: TS dependency (vs. shelling
`cursor-agent`), public-beta surface, defensive tool-schema parsing,
Cursor-hosted inference. Staying CLI-only means no Cursor structured guarantee —
back to prompt-and-parse.

Sources: https://cursor.com/docs/sdk/typescript ·
https://cursor.com/docs/cli/reference/output-format ·
https://cursor.com/changelog/sdk-updates-jun-2026 ·
https://thenewstack.io/cursor-sdk-ai-agents/ (2026-06-17)

## 2. Agent Client Protocol (ACP)

**Finding.** Zed Industries' open JSON-RPC 2.0 protocol (launched Aug 2025),
"LSP for coding agents" — a transport/session layer, not an inference or
output-contract layer (now `github.com/agentclientprotocol/agent-client-protocol`).

- **No structured output at the protocol level — prompt-only.** Verified against
  the canonical schema (v1+v2): `PromptRequest` carries only `sessionId`,
  `prompt` (ContentBlock[]), `_meta` — **no** `outputSchema`/`response_format`/
  `json_schema`. `PromptResponse` is a thin ack. **Tool calls carry untyped
  `rawInput`/`rawOutput` with NO declared `inputSchema`.**
- **Who speaks it (agents, 40+):** Gemini CLI (reference impl), Claude Code &
  Codex (via Zed adapters), **Cursor (native ACP agent)**, Cline, Copilot,
  Goose, OpenCode. Clients: Zed, Neovim, Emacs, JetBrains. *Cursor is an
  agent, not a client.*

**Implication.** ACP is attractive for **extended provider portability** (one
transport to drive Gemini/Cursor/OpenCode/etc. — directly serving the
"desired" extensibility goal) but conveys **zero output guarantees**. Treat ACP
as an optional "add a provider quickly" adapter, never the verdict path; for
reliable structure go below ACP to each provider's native mechanism or a
submit-tool.

Sources: https://agentclientprotocol.com/protocol/schema ·
https://agentclientprotocol.com/protocol/prompt-turn ·
https://agentclientprotocol.com/get-started/agents ·
https://zed.dev/blog/bring-your-own-agent-to-zed (2026-06-17)

## 3. Provider-native structured output (current state)

| Provider | Mechanism / flag | Constrained decoding? | Tier |
|---|---|---|---|
| **OpenAI API** | `response_format`/`text.format` json_schema + `strict:true`; or forced function | Yes | Strongest |
| **Anthropic API** | `output_config.format={type:"json_schema"}`; or strict tool + `tool_choice:{type:"tool"}` | Yes | Strongest |
| **Codex CLI** | `codex exec --output-schema <file>` + `-o/--output-last-message <file>` | Final-msg validated | Strong (CLI) |
| **Claude Code CLI** | `claude -p --output-format json --json-schema <schema>` → `.structured_output` | No — validate + re-prompt | Good |
| **Claude Agent SDK** | `outputFormat {type:"json_schema"}` → `structured_output`, retry on mismatch | No — validate + retry | Good |
| **Ollama (local)** | `format` = JSON Schema object | Yes (model-dependent) | Good locally |
| **OpenCode** | SDK `format`/`json_schema` (internal StructuredOutput tool, retry) | No — tool-emulated | Moderate |
| **Gemini API** | `responseSchema` + `responseMimeType:"application/json"` (field naming in flux) | Yes | Strong (API only) |
| **Gemini CLI** | `--output-format json` ONLY — envelope, no schema flag (open FRs) | No — envelope only | **Gap** |

**Implication.** The floor splits: **Codex CLI is the strong CLI citizen**;
**Claude Code CLI `--json-schema` is post-hoc-validated-with-retry**, not a
token-level guarantee (call the Messages API `output_config.format` if a hard
guarantee is needed); **Cursor has no native flag** (CLI or SDK). For extended
providers, **Gemini CLI is a gap** (API-only), Ollama solid locally. ⇒ A
per-provider adapter with an **always-present validate+retry fallback** is
mandatory, because Claude Code/SDK, OpenCode, and prompt-only paths are not
constrained-decoding.

Sources: https://developers.openai.com/api/docs/guides/structured-outputs ·
https://platform.claude.com/docs/en/build-with-claude/structured-outputs ·
https://developers.openai.com/codex/cli/reference ·
https://code.claude.com/docs/en/agent-sdk/structured-outputs ·
https://ollama.com/blog/structured-outputs · https://opencode.ai/docs/sdk/ ·
https://ai.google.dev/gemini-api/docs/structured-output ·
https://geminicli.com/docs/cli/headless/ (2026-06-17)

## 4. Submit-tool / tool-mediated schema pattern

- **Forced tool use = the canonical primitive.** Anthropic
  `tool_choice:{type:"tool",name:"submit_verdict"}` and OpenAI
  `tool_choice:{type:"function",...}` force a validated tool call whose
  `input_schema` IS the verdict schema. *Caveat:* Anthropic forced tool use
  conflicts with extended thinking (only `auto`/`none` there) — force the tool
  only on the final submission turn.
  https://github.com/anthropics/anthropic-cookbook/blob/main/tool_use/tool_choice.ipynb
- **Instructor** (567-labs/instructor) — Pydantic `response_model` → tool schema
  → validated object + retry; 15+ providers via `from_provider(...)`; Python+TS.
  **In-process library** — helps the orchestrator's host language, not
  heterogeneous shelled-out peers. https://github.com/567-labs/instructor
- **BAML** (BoundaryML) — **most CLI-friendly / language-agnostic.**
  Schema-Aligned Parsing coerces messy output even from no-tool models; one
  `.baml` schema; ships a **local HTTP server + OpenAPI client gen**
  (`npx @boundaryml/baml dev`), 100% local. https://github.com/BoundaryML/baml
- **Outlines** (dottxt-ai) — hardest guarantee (logit-masking constrained
  decoding) but **only for local models you control**; hosted APIs fall back to
  the provider's structured API. https://github.com/dottxt-ai/outlines

**Implication.** Submit-verdict-via-forced-tool is the throughline unifying the
floor: native to Claude/OpenAI APIs, the only structured path for the Cursor
SDK, degrades gracefully. If the orchestrator is TS/Python, **Instructor** can
be the verdict layer for API-direct peers; for one schema across heterogeneous
shelled-out peers, **BAML's local server** is the most portable; **Outlines**
only for local-weight peers. (Note: a from-scratch forced-tool implementation is
~modest and avoids the dependency — see recommendation.)

## 5. Multi-agent deliberation / consensus frameworks

- **llm-consortium** (irthomasthomas) — **closest direct prior art.** `llm`-CLI
  plugin: fan out (`model:count`), synthesize via an **arbiter** model, score
  **confidence** vs threshold, **iterate** with refined context; SQLite logging;
  provider portability free via `llm` plugins. *Gap:* does not enforce structured
  output through consensus (arbiter prose). Pairs with `llm --schema` (DSL/JSON-
  Schema/Pydantic; OpenAI native, Anthropic via tool use, plugins elsewhere).
  https://github.com/irthomasthomas/llm-consortium ·
  https://simonwillison.net/2025/Feb/28/llm-schemas/
- **CrewAI** — `output_pydantic`/`output_json` per task; native OpenAI/Anthropic/
  Gemini + everything else via **LiteLLM**. Cautionary tale: structured-output
  reliability hinges on LiteLLM's static `supports_response_schema` table —
  silently degrades if stale; **keep a prompt fallback.**
  https://docs.crewai.com/en/concepts/llms
- **LangGraph** — `with_structured_output()` picks **native json_schema →
  tool-calling → prompt** per provider — exactly the fallback ladder to copy.
  Heavy dependency surface; pattern > package.
  https://github.com/langchain-ai/langgraph
- **AutoGen** — Pydantic `output_content_type` → `StructuredMessage`, but
  documented only on OpenAI clients; **now in maintenance mode** (→ Agent
  Framework). Learn from, don't depend on.
  https://github.com/microsoft/autogen
- **Topology references:** Karpathy **llm-council** (propose → anonymized
  peer-critique → chairman) and Together **MoA** (layered proposer→aggregator;
  diverse proposers beat repeated single model). Neither focuses on structured
  output. https://github.com/karpathy/llm-council ·
  https://github.com/togethercomputer/MoA

**Implication.** llm-consortium is the algorithm consensus-cli is building
(arbiter + confidence + iteration) and proves the **delegate-portability-to-a-
plugin-layer** model. Copy CrewAI's `output_pydantic`/`output_json` split,
LangGraph's per-provider strategy ladder, and Karpathy's anonymized-peer-review
detail. The unclaimed differentiator is enforced structured output through the
whole loop.

---

## Flags / Items to Verify Against Local CLIs

- **Claude Code `--json-schema`** is documented mainly via issues/community
  blogs — confirm against local `claude --help`.
- **Gemini API** structured-output config field naming is mid-migration
  (`responseSchema` vs `responseFormat.text.schema`) — pin to SDK version.
- **OpenCode** canonical repo may be `anomalyco/opencode` not `sst/opencode` —
  verify before depending.
- **"Council Mode" arXiv 2604.02923** (structured synthesis protocol) is
  conceptually on-target but **OSS code availability unverified** (low
  confidence).

## Sources & References

All accessed 2026-06-17 (links inline above). Primary docs and repos preferred;
news/blog sources used only to corroborate beta/stability status (The New Stack
on the Cursor SDK; Simon Willison on `llm` schemas).
