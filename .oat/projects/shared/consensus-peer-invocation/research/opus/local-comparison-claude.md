---
skill: analyze
schema: analysis
topic: "Peer/agent invocation & structured output — local codebase comparison"
model: claude-opus-4
generated_at: 2026-06-17
input_type: code / codebase comparison (multi-repo)
project: consensus-peer-invocation
---

# Local Comparison: Peer Invocation & Structured Output

Read-only inspection of six local codebases through the lens of the
consensus-cli initiative: build an owned, reusable peer-invocation CLI for the
`claude` + `codex` + `cursor` floor, with **desired-but-not-required**
extensibility to other providers (gemini, pi, kimi, open-weight models,
OpenCode-style tools), replacing the current Paseo dependency.

## Executive Summary

- **Two invocation philosophies exist locally.** (a) *Daemon/SDK-mediated*:
  Paseo runs a long-lived daemon and uses heterogeneous per-provider clients
  (Anthropic SDK, Codex app-server JSON-RPC, ACP child processes). (b) *Direct
  spawn*: Stoa, claude-octopus, and consensus-cli (via Paseo today) shell out to
  provider CLIs with prompt-fed stdin and captured stdout/file output. For a
  dependency-free shipped plugin, **direct spawn is the portable floor**;
  Stoa's adapter is the closest proven source material.
- **No local project achieves provider-native constrained structured output
  across all providers.** Every project falls back to prompt-instruction +
  post-hoc parse/validate. Paseo and Stoa add per-provider native hints
  (Codex `--output-schema`, Claude `--json-schema`) plus AJV/contract validation;
  the rest (claude-octopus, llm-council, quorum-cli) are prompt-only + regex
  scraping with no validation/retry.
- **consensus-cli today is the most disciplined consumer** — it gets
  provider-native `--output-schema` *through Paseo* plus a two-layer
  normalize→validate→retry loop and a real error taxonomy. The job is to keep
  that discipline while dropping the Paseo daemon.
- **No local project uses a submit-tool / forced-tool verdict pattern.** That
  remains greenfield (see web scan).
- **Cursor is a soft-schema provider everywhere.** No local code obtains a
  schema guarantee from Cursor; it is either a custom ACP provider (Paseo/
  consensus) or a `--output-format json` envelope wrapping free text (Stoa).

## Methodology

Seven parallel `general-purpose` subagents inspected each repo (read-only),
plus one web scan (separate artifact). Every claim below carries `path:line`
from the worker that found it. Generated `.mjs` files were skipped in favor of
canonical TypeScript where both exist.

---

## Per-Project Findings

### 1. consensus-cli (current) — provider-native via Paseo + validate/retry

**Invocation.** Single seam `invokePaseo` `spawn`s the `paseo` binary; no SDK.
Command is fully provider-agnostic — the peer ID is passed straight through:

```ts
// src/consensus/core/consensus-loop.ts:1169-1190
const args = ['run', '--provider', provider, '--output-schema', schemaPath, '--json', prompt];
const child = spawn('paseo', args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
```

- Seam type `PeerInvoker = (turn: PeerInvocation) => Promise<PaseoResult>`
  (`consensus-loop.ts:195`); overridable for tests/hosts.
- No provider-ID mapping table — `claude`/`codex`/`cursor` pass through verbatim
  (`consensus-loop.ts:1178-1180`).

**Structured output.** Provider-native schema **file** via `--output-schema`
(`consensus-loop.ts:1181-1182`), enforced by Paseo, **plus a two-layer
post-validation** because the JSON Schema cannot express the full contract
(comment notes "OpenAI forbids oneOf/not", `:1364-1366`):

1. `normalizeVerdict` strips fields the chosen verdict branch forbids
   (strict providers emit every property) — `:876-891`.
2. `validateVerdictShape` (`:779`) then `validateVerdictCaps` (`:1012`).

Retry: `invokeValidatedPeer` (`:1372-1405`) re-invokes on transient Paseo errors
**or** post-normalization shape/cap failure (`attempts=3, delayMs=750`). This is
the only local project that retries on *contract* invalidity, not just transport.

**Byte caps.** Subprocess cap `SUBPROCESS_OUTPUT_CAP_BYTES = 10 MiB`
(`:339`, SIGKILL on overflow `:1198-1221`); verdict content caps `VERDICT_CAPS`
(`:321-328`, e.g. proposed_artifact 256 KiB, total 512 KiB).

**Error taxonomy** (`consensus-loop.ts` / `consensus-refine.ts`):
`PASEO_MISSING`, `PASEO_EXIT`, `PASEO_INVALID_JSON`, `SUBPROCESS_OUTPUT_CAP`,
`PEER_UNAVAILABLE`, `INVALID_VERDICT_SHAPE`, `INVALID_VERDICT_CAPS`/
`OVERSIZE_REJECTED`, `SYNTHESIZER_UNAVAILABLE`, `PASEO_VERSION_UNTESTED` (warn).
Mapped to process exit codes in `exitCodeForError` (`:679-714`).

**Preflight/inventory.** `preflightPaseo` runs `paseo --version` then
`paseo provider ls --json`, normalizes inventory (`normalizeProviderInventory`
`:2016-2041`), gates peers via `resolvePeers` → `PEER_UNAVAILABLE`
(`consensus-refine.ts:3488-3527, 3585-3645`). Tolerates `loading` (cold-daemon
10–30s window) but fails closed on `error`/`unavailable`.

**Audit/resume.** Single pretty-printed **JSON array** file rewritten + fsync'd
per append (`createRecordsWriter` `:1096-1124`); `LoopRecord` carries
`raw_paseo_response`, verdict fields, hashes, `schema_version: 'v1'`. Resume
counts `peerTurnCount` and continues; special pending-synthesis resume re-runs
only the synthesis step (`:2630-2655`).

**Cursor.** Not special-cased — an ordinary peer ID getting the same
`--output-schema`. Its only distinction: described as a custom ACP provider whose
`cursor-agent` CLI can report `status:"error"` on auth failure, caught at
preflight (`SKILL.md:20`, `consensus-refine.ts:1977-1987`).

---

### 2. Paseo — daemon + heterogeneous per-provider clients

**Architecture (critical).** Paseo is **not** a thin spawner. The `paseo` CLI is
a WebSocket client to a long-lived `@getpaseo/server` daemon
(`packages/cli/src/utils/client.ts:25`) that owns all provider sessions. A
`paseo run` therefore needs `paseo daemon start` first, or fails with
`DAEMON_NOT_RUNNING` (`run.ts:392-405`). The CLI imports `@getpaseo/server`
wholesale — the dependency is the entire daemon + provider stack.

**Invocation is per-provider, not uniform** (`provider-registry.ts:107-154`):

| Provider | Client | Transport |
|---|---|---|
| Claude | `ClaudeAgentClient` | `@anthropic-ai/claude-agent-sdk` `query()` (`claude/query.ts:2`) |
| Codex | `CodexAppServerAgentClient` | Codex app-server JSON-RPC (`codex/app-server-transport.ts`) |
| Copilot / Cursor / generic | `*ACPAgentClient` extends `AcpAgent` | `@agentclientprotocol/sdk` over spawned child stdio (`acp-agent.ts:819-884`) |
| OpenCode | `OpenCodeAgentClient` | `@opencode-ai/sdk` |
| Pi/OMP | `PiRpcAgentClient` | custom RPC |

Providers declared in a static manifest `AGENT_PROVIDER_DEFINITIONS`
(`provider-manifest.ts:165-223`); `paseo provider ls` derives from it and
overlays live daemon status. **Custom ACP providers** register at runtime via
config `extends:"acp"` + `command` argv (`provider-registry.ts:581-625`);
Cursor's default is `["cursor-agent","acp"]` (`:166`). *This `extends:"acp"`
custom-provider model is the most relevant feature for the "let users add
gemini/pi/kimi/opencode" desire.*

**Structured output (`--output-schema`).** Primarily **prompt-injection +
JSON-scrape + AJV-validate + bounded retry (maxRetries 2)** — NOT native for
most providers (`agent-response-loop.ts:173-181, 296-341`;
`run.ts:185-217, 511-561`). `buildBasePrompt` injects the schema as prose;
`extractJsonFromMarkdown` scrapes the last assistant message; AJV validates;
retry prompt appends validation errors. **Only Codex and OpenCode get a native
schema hint** (`codex-app-server-agent.ts:3434-3435`; `opencode-agent.ts:3122`).
**Claude and all ACP providers (incl. Cursor) get NO native schema** —
`session/new`/`session/prompt` convey only `cwd/mcpServers` and `prompt`
(`acp-agent.ts:1066-1070, 1158-1162`). Final mismatch → hard
`OUTPUT_SCHEMA_FAILED` (exit 1).

**Key implication.** consensus-cli's current "provider-native via Paseo"
structured output is, for Claude and Cursor, actually **Paseo's prompt-and-parse
loop** under the hood — the same technique an owned CLI would reimplement in
~300 lines, minus the daemon, WebSocket transport, workspaces, and ACP
child-process machinery.

---

### 3. Stoa — direct spawn + hybrid schema delivery (closest source material)

**Invocation.** Plain `node:child_process.spawn`, prompt via stdin, SIGKILL
timeout (default 300s), no SDKs (`inbox-invoker.ts:687-753`). Provider IDs are a
fixed enum `claude-cli` | `codex-exec` | `cursor-agent` (`config.ts:390-394`).
Exact per-provider commands (`provider-adapter.ts`):

```text
claude-cli:   claude --permission-mode bypassPermissions -p [--model M] [--effort E] [--json-schema <inline-json>]   (stdin→stdout)        :183-206
codex-exec:   codex --ask-for-approval never --sandbox workspace-write exec --cd <ws> [--output-schema <file>] --output-last-message <file>  :208-243
cursor-agent: cursor agent --print --output-format json --workspace <ws> --trust --force [--model M] <prompt>          (positional→stdout)   :245-264
```

**Final JSON contract (hybrid delivery).** `getSchemaDelivery`
(`final-json-contract.ts:125-144`) chooses per provider:

- claude-cli → `provider-native` inline `--json-schema` **unless schema is
  permissive** (no required + additionalProperties), then `prompt-only` (Claude
  returns a placeholder for unconstrained schemas, `:138-143`).
- codex-exec → `prompt-only` by default; `provider-native` only when caller opts
  in (`codexProviderNative:true`).
- cursor-agent → always `prompt-only`.

Prompt-only appends a suffix embedding the schema JSON
(`buildFinalJsonPromptSuffix` `:146-156`). Extraction is **post-processed**
(`normalizeProviderOutput` `:493-528`): codex reads `--output-last-message`
file; cursor parses the JSON envelope and asserts
`type==='result' && !is_error && subtype==='success'` then pulls `.result`;
claude trims stdout. **No in-loop validate-then-retry** — a parse failure
returns `error:'parse_failed'` (`:979-988`); a rolling 5-run health signal flips
unhealthy after 3 consecutive failures but does not retry (`:126-127, 755-805`).

**Diagnostics.** Failure taxonomy `provider-exit-nonzero` |
`provider-output-invalid` (`provider-adapter.ts:65-67`); rich redacting
diagnostic summarizer (`:325-421`); doctor preflight probes PATH + capability
(cursor `--help` grep for `--output-format`, codex `debug models`)
(`doctor/discovery.ts:70-200`).

**Extensibility.** Closed enum + branching dispatch, **not a registry** — adding
a provider edits ~6 files in lockstep. But the functions are pure and
dependency-light: `provider-adapter.ts` imports **types only** from
`@stoa/schemas` plus an optional Fastify-logger alias; `final-json-contract.ts`
core helpers are dependency-free. **~95% portable** to a dependency-free plugin
after severing type imports and Stoa-specific workflow contracts.

---

### 4. claude-octopus — Bash fan-out, prompt-only + grep scraping

**What it is.** A ~3100-line **Bash** Claude Code plugin (`package.json:1-9`,
`main: scripts/orchestrate.sh`) fanning a task across up to 9 external CLIs
(Codex, Gemini, Antigravity, Copilot, Qwen, Ollama, Perplexity, OpenRouter,
OpenCode, Cursor) + Claude, with "consensus gates." No SDK, no `query()`.

**Invocation.** Shell out to each CLI; command strings built by a per-provider
`case` in `get_agent_command()` (`dispatch.sh:17-199`), word-split into an
array, prompt fed via stdin to dodge ARG_MAX (`agent-sync.sh:223, 245, 285`).
Every provider invoked in **text mode** (`-o text`, `--output-format text`).

**Structured output.** **None native.** Providers write free-text markdown;
structured signals (veto/severity/confidence) are scraped with grep/awk
(`council.sh:1772-1817`); the only JSON is `summary.json` assembled by the
orchestrator with `jq` from shell vars (`:2180-2269`). No schema, no validation,
no retry.

**Consensus mechanics (worth borrowing).** Council phases advice→critique→
revision→chair-synthesis with **quorum** (`:1561-1594, 1589`) and **critical
veto** gates (`:1808`); Debate engine for N-way adversarial rounds
(`debate.sh:23`); reviewer lockout + alternate routing (`quality.sh:233-281`);
`host-native` provider status to avoid recursive self-spawn (`council.sh:1430`).
The `summary.json` audit schema (`quorum{}`, `veto{}`, gate booleans) is a clean
machine-readable consensus contract.

**Avoid.** Structured-output-via-regex-on-free-text is the central fragility;
text-only invocation forgoes every provider's native JSON/tool capability; one
mega-`case` per provider + scattered shim scripts instead of a declarative
manifest.

---

### 5. llm-council — single-provider (OpenRouter), prompt-only ranking

**What it is.** Python FastAPI web app (not a CLI), self-described "Saturday
vibe-code hack" (`README.md:13-15`). 3-stage council: parallel first opinions →
**anonymized** peer ranking → Chairman synthesis (`council.py:296-335`).

**Invocation.** One provider: **OpenRouter via raw `httpx`** (no SDKs), every
model an OpenRouter id string (`openrouter.py:8-53`); parallel fan-out via
`asyncio.gather` (`:56-79`) with per-call try/except → `None` graceful
degradation.

**Structured output.** **Prompt-only + regex.** Ranking demands a literal
`FINAL RANKING:` format (`council.py:76-93`) scraped by
`parse_ranking_from_text` (`:177-208`) with a looser fallback regex. No JSON
mode, no schema, no validation/retry.

**Borrow.** Anonymized peer review with a `label_to_model` map to kill
self-preference bias (`:49-56`); aggregate-by-mean-rank as a transparent
consensus metric (`:236-253`); graceful per-model degradation; cheap model for
ancillary tasks (`:277-278`). **Avoid.** Brittle regex scraping; no abstraction
layer (fine only because OpenRouter unifies vendors — which consensus-cli's
multi-CLI goal cannot rely on).

---

### 6. quorum-cli — multi-provider SDK abstraction, prompt-only + regex

**What it is.** Python 3.11+ CLI, "multi-agent AI discussion system," 7 debate
methods (`agents.py:167`), 5-phase standard pipeline ending in a synthesizer
declaring `CONSENSUS: YES/PARTIAL/NO` (`agents.py:781`). Language selector
injects "respond in {lang}" while forcing English section headers so parsers
still work (`agents.py:18-47`).

**Invocation.** **Direct vendor SDKs over HTTP** (`openai`, `anthropic`), no CLI
spawn. A `ChatClient` Protocol (`clients/types.py:42-62`) with two impls;
**all OpenAI-compatible vendors (Google, xAI, Ollama, OpenRouter, LM Studio,
llama-swap, custom) reuse `OpenAIClient` with a different `base_url`**
(`models.py:259-333`) — only Anthropic gets a bespoke client. Config-driven
routing via `<PROVIDER>_MODELS` env (`providers.py:115-153`); LRU client pool +
shared httpx pool.

**Structured output.** **None native** — zero `response_format`/`json_schema`/
tool-calling (grep-confirmed). All critique/position/consensus data is regex-
scraped from prompt-instructed text with raw-content fallback
(`standard.py:41-44`, `base.py:586`). One JSON path (method advisor) uses
`json.loads` + fence-stripping + clamp + hardcoded fallback, **no retry**
(`ipc.py:1214-1293`).

**Borrow.** The `ChatClient` Protocol seam; the "collapse all OpenAI-compatible
vendors onto one client keyed by `base_url`" trick (gets gemini/kimi/openrouter/
opencode nearly free); config-driven model→provider routing; key redaction;
language-but-English-headers trick. **Avoid.** No native structured output; no
validation/retry; hardcoded `if/elif` provider chains across 3 files instead of
a registry.

---

## Cross-Project Comparison Matrix

| Project | Invocation | Schema delivery | Validation/retry | Provider model | Extensibility |
|---|---|---|---|---|---|
| **consensus-cli (now)** | spawn `paseo run` | provider-native file via Paseo (really prompt-loop for claude/cursor) | normalize→shape→caps, retry x3 | Paseo inventory | via Paseo custom ACP only |
| **Paseo** | daemon + per-provider SDK/JSON-RPC/ACP | prompt-inject + AJV + retry x2; native hint for codex/opencode | AJV, retry x2 | static manifest + `extends:"acp"` | strong (custom ACP) |
| **Stoa** | direct spawn (CLI) | hybrid: native (`--json-schema`/`--output-schema`) or prompt-only | post-parse only, no retry; health window | closed enum, branching | pure fns, no registry |
| **claude-octopus** | Bash spawn, text mode | none (prompt convention) | none, grep/awk scrape | `case` + shims | easy (add case), data-poor |
| **llm-council** | OpenRouter HTTP | prompt-only | none, regex | OpenRouter ids | trivial (within OpenRouter) |
| **quorum-cli** | vendor SDK HTTP | prompt-only | none, regex; advisor json no-retry | `ChatClient` Protocol + base_url | moderate, 3-file edits |

## What This Means for consensus-cli (preview — full version in recommendation)

1. **Stoa's direct-spawn adapter is the portable replacement for Paseo's `run`**
   — no daemon, ~95% portable, already handles per-provider command/output
   quirks for the exact floor.
2. **Keep consensus-cli's own discipline** (normalize→validate→retry loop, byte
   caps, error taxonomy, JSON-array audit) — it is stronger than any sibling's.
3. **Refactor the closed-enum branching into a `ProviderAdapter` registry** so
   the desired gemini/pi/kimi/opencode extension is config + one adapter, not a
   6-file edit — borrowing quorum-cli's Protocol seam and base_url collapse, and
   Paseo's `extends:"acp"` idea for the generic add-a-provider path.
4. **The submit-tool / forced-tool verdict pattern is absent locally** and is
   the one reliability lever none of these projects pull (see web scan).

## Sources & References

All references are `path:line` in the six local repos, captured 2026-06-17 by
read-only subagent inspection:
- `/Users/tstang/Code/consensus-cli/src/consensus/core/consensus-loop.ts`,
  `/src/consensus/refine/consensus-refine.ts`,
  `/plugins/consensus/skills/refine/SKILL.md`
- `/Users/tstang/code/paseo/packages/{cli,server,protocol}/...`
- `/Users/tstang/Code/stoa/apps/server/src/ai-workflows/{provider-adapter,final-json-contract,policy}.ts`,
  `/apps/server/src/inbox-invoker.ts`, `/packages/schemas/src/config.ts`,
  `/apps/server/src/doctor/{discovery,client}.ts`
- `/Users/tstang/code/claude-octopus/scripts/lib/{dispatch,agent-sync,council,debate,quality}.sh`
- `/Users/tstang/code/llm-council/backend/{config,openrouter,council}.py`
- `/Users/tstang/code/quorum-cli/src/.../{agents,providers,models,config}.py`,
  `clients/{types,openai_client,anthropic_client}.py`, `methods/standard.py`,
  `base.py`, `ipc.py`
