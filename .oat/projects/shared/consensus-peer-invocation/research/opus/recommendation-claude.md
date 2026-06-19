---
skill: analyze
schema: analysis
topic: "Recommendation — consensus-cli peer invocation & structured output"
model: claude-opus-4
generated_at: 2026-06-17
input_type: synthesis / recommendation
project: consensus-peer-invocation
---

# Recommendation: Peer Invocation & Structured Output for consensus-cli

Synthesizes the local comparison and web scan into preserve / borrow / avoid /
prototype guidance, read through the project lens: an owned, reusable
`consensus` CLI for the `claude` + `codex` + `cursor` floor that replaces the
Paseo daemon dependency, keeps current audit/validation discipline, and treats
**extended provider support (gemini, pi, kimi, open-weight, OpenCode) as a
desired — not required — design pressure** so users can add providers later.

## The One-Paragraph Answer

Replace Paseo's `run --output-schema` with a **direct-spawn provider adapter
modeled on Stoa's `provider-adapter.ts` + `final-json-contract.ts`**, wrapped in
a **`ProviderAdapter` registry** (borrowing quorum-cli's `ChatClient` Protocol
seam) so providers are data, not branches. Preserve consensus-cli's existing
**normalize → validate-shape → validate-caps → retry** loop, byte caps, error
taxonomy, and JSON-array audit trail — they are stronger than any sibling's and
are the real product moat. Make structured output a **three-rung per-adapter
ladder** — (1) provider-native schema where it exists (Codex `--output-schema`,
Claude `--json-schema`, Ollama `format`), (2) submit-verdict forced-tool where
the channel supports custom tools, (3) prompt-inject + validate + retry as the
universal floor — because no single mechanism covers the floor. For Cursor, the
**Agent SDK's custom-tool path is the only thing that beats prompt-and-parse**,
but it adds a TS dependency and a public-beta surface, so prototype it behind the
adapter interface rather than committing the floor to it. Keep an **`extends:
"acp"`-style generic adapter** as the cheap "add gemini/cursor/opencode later"
escape hatch, accepting that ACP gives breadth but **zero** output guarantee.

## Preserve (consensus-cli already does this better than the field)

1. **The two-layer validate+retry contract.** `normalizeVerdict` →
   `validateVerdictShape` → `validateVerdictCaps`, with `invokeValidatedPeer`
   retrying on *contract* invalidity, not just transport
   (`consensus-loop.ts:876-891, 779, 1012, 1372-1405`). No sibling retries on
   contract violation; Stoa/octopus/council/quorum do none of this. This is the
   moat — carry it forward verbatim against the new backend.
2. **Byte caps at two layers** — subprocess SIGKILL cap (10 MiB) + per-field
   verdict caps (`:339, 321-328`). Direct spawn makes the subprocess cap *more*
   important (no daemon backpressure).
3. **The real error taxonomy + exit-code mapping** (`:679-714`). Re-map the
   `PASEO_*` codes to backend-neutral equivalents (see prototype #4) but keep the
   structure and the remediation messages.
4. **The JSON-array audit trail with `raw_*_response` + resume** (`:1096-1124`,
   pending-synthesis resume `:2630-2655`). Preserve the record shape and
   `schema_version: 'v1'`; only rename `raw_paseo_response` → `raw_provider_response`
   (with a read-compat alias for old runs).
5. **The overridable `invokePeer` seam** (`:195`). It is exactly the injection
   point the new adapter plugs into — migrate behind it, keep loop control flow
   untouched (a stated constraint).

## Borrow (proven patterns from siblings)

1. **Stoa's direct-spawn adapter, near-verbatim** — it is ~95% portable
   (type-only `@stoa/schemas` imports + optional logger to sever) and already
   encodes the exact per-provider command/output quirks for the floor:
   claude stdin→stdout, codex `--output-last-message` file, cursor JSON-envelope
   `.result` extraction (`provider-adapter.ts:183-264`). This is the single most
   valuable piece of source material in the survey.
2. **Stoa's hybrid `getSchemaDelivery`** (`final-json-contract.ts:125-144`) —
   per-provider choice of native vs prompt-only, including the *permissive-schema
   → prompt-only* guard for Claude. Generalize it into the three-rung ladder.
3. **quorum-cli's `ChatClient` Protocol seam + base_url collapse**
   (`clients/types.py:42-62`, `models.py:259-333`) — model the registry so all
   OpenAI-compatible providers (gemini, kimi, openrouter, lmstudio, opencode-via-
   OpenAI-endpoint) are one adapter keyed by `base_url`. Directly serves the
   "let users add providers" goal.
4. **Paseo's `extends:"acp"` custom-provider config** (`provider-registry.ts:581-625`)
   — the model for a generic user-registered adapter. Borrow the *config shape*
   (id + command argv + capabilities), not the daemon.
5. **claude-octopus's consensus-audit primitives** — `quorum{}` and `veto{}`
   gate records in `summary.json` (`council.sh:2216-2268`) and the `host-native`
   provider status that skips recursive self-spawn (`:1430`). The host-native
   case matters: a consensus run launched *from* Claude Code that also spawns
   `claude` must avoid the recursion/hang octopus guards against.
6. **llm-council's anonymized peer review** (`council.py:49-56`) and **mean-rank
   aggregate** (`:236-253`) — cheap, transparent consensus-quality levers if/when
   the consensus family grows beyond pairwise refine.
7. **LangGraph's strategy ladder** (native → tool → prompt) as the canonical
   shape for rung selection; **CrewAI's cautionary tale** — never trust a static
   capability table without a prompt fallback.

## Avoid

1. **Re-creating a daemon / WebSocket / workspace lifecycle.** Paseo's coupling
   (CLI imports `@getpaseo/server` wholesale; `run` needs `paseo daemon start`)
   is precisely the burden being shed. Direct spawn is stateless and matches the
   dependency-free shipped-plugin constraint.
2. **Structured output via regex-scraping free text** (octopus grep/awk, council
   & quorum `re.compile`). It silently breaks on phrasing drift and is the exact
   fragility this project exists to fix. Always parse a delimited JSON object and
   validate it; never scrape prose for verdict fields.
3. **Trusting ACP (or Cursor CLI `--output-format json`) for schema fidelity.**
   Both convey *no* output schema; the JSON is an envelope around free text. Use
   them for breadth/transport only.
4. **A closed provider enum with branching dispatch** (Stoa's own shape) — port
   the *functions*, not the `if/ternary` chains. Adding a provider must be one
   adapter + config, not a 6-file edit.
5. **Committing the floor to the Cursor Agent SDK.** It is public beta with
   explicitly unstable tool schemas and forces Cursor-hosted inference + a TS
   dependency. Prototype it behind the adapter; don't make it load-bearing.
6. **Forcing tools during extended thinking** (Anthropic constraint) — force the
   submit-verdict tool only on the final submission turn.

## Prototype Next (in priority order)

1. **`ProviderAdapter` registry + port Stoa's three CLI adapters** behind the
   existing `invokePeer` seam. Interface: `buildArgs`, `inputMode`
   (stdin|positional), `outputMode` (stdout|last-message-file|json-envelope),
   `schemaDelivery`, `capabilities`, `probe`. Wire `claude`/`codex`/`cursor`;
   prove parity with the current Paseo path on the existing refine fixtures.
   *This is the migration spike.*
2. **The three-rung structured-output ladder per adapter**, reusing the existing
   normalize→validate→caps→retry loop unchanged. Rung 1 native (codex
   `--output-schema`, claude `--json-schema` when schema non-permissive); rung 3
   prompt-inject+validate+retry universal floor. Measure schema-failure rate vs
   the current Paseo path per provider.
3. **Submit-verdict forced-tool spike (rung 2), Claude/Codex API first** — prove
   `tool_choice` forced submission yields validated args with near-zero retry,
   then evaluate whether it should become the *default* verdict channel for
   API-capable peers. This is the reliability lever no surveyed project pulls.
4. **Backend-neutral preflight + error taxonomy.** Replace `paseo --version` /
   `paseo provider ls --json` with per-adapter `probe()` (Stoa's doctor model:
   PATH check + capability grep, `doctor/discovery.ts:70-200`). Map
   `PASEO_MISSING`→`PROVIDER_MISSING`, `PASEO_EXIT`→`PROVIDER_EXIT`,
   `PASEO_INVALID_JSON`→`PROVIDER_INVALID_JSON`, keep `PEER_UNAVAILABLE`; add
   read-compat aliases.
5. **Cursor SDK custom-tool spike (isolated, optional).** Behind the adapter
   interface, prove a stateless one-turn Cursor agent reliably discovers and
   calls a `submit_verdict` custom tool. Gate on: does it beat the current
   prompt-and-parse retry rate enough to justify a TS dependency + beta surface?
   If not, keep Cursor on rung 3.
6. **Generic `extends:"acp"`-style adapter (deferred, desired-not-required).**
   A config-registered adapter (id + command argv + capabilities) so a user can
   add gemini/pi/kimi/opencode without code, accepting rung-3-only structured
   output. Ships the "extensible to other providers" promise without expanding
   the tested floor.

## Decision Summary (preserve / borrow / avoid / prototype)

| Lever | Verdict | Source |
|---|---|---|
| validate+retry contract loop | **Preserve** | consensus-cli `consensus-loop.ts` |
| byte caps, audit trail, resume | **Preserve** | consensus-cli |
| direct-spawn CLI adapter | **Borrow** | Stoa `provider-adapter.ts` |
| hybrid schema delivery | **Borrow → generalize to 3-rung** | Stoa `final-json-contract.ts` |
| adapter registry / base_url collapse | **Borrow** | quorum-cli `ChatClient` |
| generic custom-provider config | **Borrow shape** | Paseo `extends:"acp"` |
| consensus/veto audit primitives | **Borrow** | claude-octopus `summary.json` |
| daemon / WebSocket / workspaces | **Avoid** | Paseo |
| regex-scrape free text | **Avoid** | octopus / council / quorum |
| ACP / Cursor CLI for schema fidelity | **Avoid (breadth only)** | web scan |
| submit-verdict forced tool | **Prototype** | web scan (Anthropic/OpenAI) |
| Cursor Agent SDK custom tool | **Prototype (isolated)** | web scan |
| generic ACP adapter for extension | **Prototype (deferred)** | Paseo + web scan |

## Open Questions (for main-thread verification)

1. **Schema-failure rates are unmeasured.** Claim: native (codex) + validate/
   retry beats Cursor's prompt-only path. Needs empirical per-provider failure
   rates against current refine fixtures before choosing default rungs.
2. **Does the current "provider-native via Paseo" path actually constrain
   Claude/Cursor output today?** Web/Paseo evidence says Paseo prompt-injects for
   Claude+ACP (only Codex/OpenCode get native hints). If so, dropping Paseo loses
   *no real native guarantee* for Claude/Cursor — confirm against a live
   `paseo run --provider claude --output-schema` to be certain before claiming parity.
3. **Claude Code CLI `--json-schema` reality.** Documented via issues/community,
   not confirmed in local `claude --help`. Verify the exact flag, output field
   (`.structured_output`), and whether it constrains or post-validates.
4. **Cursor SDK viability for stateless one-turn peers.** Unverified that a
   single-turn Cursor agent reliably calls a custom submit tool; also confirm
   credential handling and whether local runtime is required. Decides prototype #5.
5. **Codex strict-output quirks.** Discovery flags `--output-schema` strict-mode
   quirks (every-property emission handled by `normalizeVerdict`). Confirm
   whether to always use `--output-schema` or gate it to constrained contracts.
6. **Dependency posture for rung 2/3.** Build forced-tool + validation in-house
   (Node stdlib, preserves dependency-free shipped plugin) vs. depend on BAML's
   local server / Instructor. Recommendation leans in-house for the floor; verify
   the build cost is acceptable vs. a vendored library.
7. **Generic adapter security/sandbox.** A user-registered `command` argv adapter
   is an arbitrary-exec surface. Define the trust/sandbox model before shipping
   the extension escape hatch.
8. **Submission capture channel.** If submit-tool lands: does the orchestrator
   read a sidecar file, stdout envelope, temp dir, or event stream? (Mirrors the
   discovery.md open question; the adapter `outputMode` enum should encode it.)
