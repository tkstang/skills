---
id: BL-260613-investigate-in-house-peer
title: Investigate in-house peer-invocation CLI to reduce/replace the external
  peer-run dependency
status: closed
priority: medium
scope: initiative
scope_estimate: L
labels:
  - consensus
  - architecture
  - provider-cli
  - build-vs-buy
assignee: null
created: 2026-06-13T17:44:50Z
updated: 2026-06-19T23:16:53Z
associated_issues: []
legacy_id: bl-bb7e
---

## Description

**Status update (2026-06-19): done.** The `consensus-peer-invocation`
project completed the investigation, design, implementation, cleanup, and final
review. The consensus plugin now owns a generated `consensus` provider CLI for
provider inventory, preflight, and one-shot structured peer runs. Refine and
Evaluate new runs route through that CLI by default; maintained
source/runtime/docs/tests no longer keep the old backend path. Cursor
submit-tool support remains deferred ([[bl-3a88]]) and authenticated
Cursor-as-peer verification remains open ([[bl-f0b6]]).

Evaluate building a thin in-house peer-invocation layer to reduce or replace the
runtime dependency on the Paseo CLI (`@getpaseo/cli`) for the consensus `refine`
skill. This is a build-vs-buy investigation, not a committed migration — the
outcome should be a recommendation plus a phased plan if we proceed.

### What we actually use Paseo for

The consensus loop uses exactly **one** Paseo capability, invoked once per peer
turn (see `invokePaseo` in `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`):

```
paseo run --provider <id> --output-schema <schema> --json <prompt>
```

We re-spawn this per turn and discard the agent each time. We use **none** of
Paseo's session persistence, daemon, worktrees, scheduling, chat rooms, relay,
or web app — i.e. the large majority of the product is unused surface for us.
Preflight additionally calls `paseo --version` and `paseo provider ls --json`.

### What Paseo genuinely provides (the value to replace)

1. **Per-provider adapters** — `claude` (native), `codex` (app-server protocol),
   and the ACP (Agent Client Protocol, JSON-RPC over stdio) adapter that covers
   the whole ACP ecosystem (cursor, gemini, copilot, opencode, qwen, …). This is
   real, churning work Paseo maintains as the underlying CLIs change.
2. **Provider-agnostic structured output** — for providers without native schema
   support, Paseo enforces `--output-schema` by injecting the JSON schema into
   the prompt, validating with AJV/Zod, and retrying (`agent-response-loop.ts`).
3. **A normalized provider inventory** via `paseo provider ls --json`.

### Why building our own is plausible

- Our two primary peers already expose first-class one-shot structured modes,
  so a direct subprocess call needs no daemon:
  - `claude -p --output-format json --json-schema <schema>`
  - `codex exec --output-schema <file> --json`
  - (`cursor-agent -p` print mode exists; schema would be our own
    inject+validate, the same approach Paseo uses for ACP providers.)
- **The swap seam already exists.** `runConsensusLoop` accepts an injectable
  `invokePeer`, defaulting to `invokePaseo`. A direct-CLI backend is a drop-in
  alternative — we can A/B it against Paseo without ripping anything out.
- We already maintain compatibility shims on top of Paseo (recent commits:
  "normalize strict structured-output verdicts (codex compatibility)", "drop
  unused branch fields") — a signal the abstraction is leaky for our verdict
  schema, so we are paying maintenance cost on both sides today.

### Costs of staying on Paseo

- Install + runtime friction: global `npm install -g @getpaseo/cli`, a running
  daemon, and per-provider config as prerequisites for a "skill".
- Version drift: we pin a tested range (`MIN_PASEO_VERSION` 0.1.0 –
  `MAX_TESTED_PASEO_VERSION` 0.9.0) and only warn outside it; Paseo is at 0.1.96
  and moving fast.
- Opaque failures and no ability to iterate internals when the abstraction
  doesn't fit (codex structured-output quirks; cursor's soft ACP schema path).

### Reference implementations (confirmed from source, 2026-06-14)

Two existing codebases de-risk this materially — we would be **porting and
narrowing our own / proven code, not reverse-engineering Paseo from scratch**:

- **`~/code/stoa`** already runs all three target providers *directly, with no
  Paseo*, in TypeScript (on vitest):
  - `apps/server/src/ai-workflows/provider-adapter.ts` builds the per-provider
    commands — `claude --json-schema` (native), `codex exec --output-schema`
    (native), and `cursor agent --print --output-format json` (envelope only).
  - `final-json-contract.ts` holds the inject-vs-native decision
    (`getSchemaDelivery`): claude with a constrained schema → native; codex →
    native only when opted in; **everything else, including cursor, →
    `prompt-only`** (inject schema into the prompt, parse + validate the final
    JSON). This is essentially the adapter layer this item proposes, already
    built and tested.
- **`~/code/paseo`** confirms the "value to replace" precisely:
  - Structured output is a single **prompt-inject + AJV/Zod validate + retry**
    loop over an `AgentCaller = (prompt) => Promise<string>` abstraction
    (`packages/server/src/server/agent/agent-response-loop.ts`:
    `buildBasePrompt` injects the schema, `buildValidator` uses AJV/Zod,
    `buildRetryPrompt` re-prompts with errors). ~50 lines; trivial to reproduce
    (stoa already did).
  - The real moat is the **adapter catalog**:
    `providers/claude/`, `providers/codex/` (app-server protocol), and the ACP
    family — `acp-agent.ts` / `generic-acp-agent.ts` plus `cursor-acp-agent.ts`,
    `copilot-acp-agent.ts`, `opencode/`, etc. — plus a cross-provider/model
    fallback ladder (`StructuredGenerationOutputError`). This churning adapter
    work is what we keep paying for, and the only part expensive to rebuild.

**Cursor is soft-schema in both implementations** — it has no native schema flag
(confirmed: no `output-schema`/`json-schema` for cursor anywhere in stoa or
paseo). So supporting cursor means we still need the inject+validate+retry helper
regardless. This is the single strongest argument for the submit-tool approach
([[bl-3a88]]): a verdict-submission tool normalizes claude/codex/cursor onto one
mechanism and erases the native-vs-soft split entirely.

### Decision pivot

The deciding question is **how many peer providers we want to support**:
- 2–3 providers → building our own is modest-cost (stoa already has the three
  direct adapters) and removes the daemon/install/version-drift friction.
- "Whatever speaks ACP" (broad provider catalog: copilot, opencode, gemini,
  qwen, …) → Paseo's adapter catalog + cross-model fallback ladder is worth
  keeping.

**Operator lean (2026-06-15 — directionally stronger, still not an active
project):** floor is **claude + codex + cursor**; broader ACP support is "nice to
have" but not required. The Stoa implementation already handled this same
provider set directly (`provider-adapter.ts` + `final-json-contract.ts`), so the
likely direction is to port/narrow that approach rather than keep depending on
Paseo for one per-turn `run` capability. Because cursor is soft-schema, the
build still includes the inject+validate+retry helper (it is not a pure "native
modes only" build). Capture this as the preferred direction for a future
design/spike, not as current implementation work; if broad ACP coverage becomes
a product goal, the pivot can still flip back toward staying on Paseo. See
[[bl-f0b6]] (cursor-as-peer verification) only if Paseo-path evidence is still
needed.

## Acceptance Criteria

**Completion evidence (2026-06-19):**

- Discovery, synthesized research, design, plan, and implementation artifacts
  live under `.oat/projects/shared/consensus-peer-invocation/`.
- Provider CLI implementation landed under `src/consensus/provider-cli/` with
  generated runtime output at `plugins/consensus/scripts/consensus.mjs`.
- Refine/Evaluate default cutover, provider-neutral audit fields, bounded
  probes/subprocesses, request JSON validation, source cleanup scan, and release
  docs were implemented and final-reviewed.
- Final review passed in
  `.oat/projects/shared/consensus-peer-invocation/reviews/final-review-2026-06-19-v3.md`.

- A written build-vs-buy recommendation lands in `.oat/repo/reference/research/`
  (or a successor decision record), covering: the exact Paseo surface we use,
  the value to replace, the cost of each option, and the provider-count pivot.
- A spike validates a direct-CLI `invokePeer` backend wired behind the existing
  `invokePeer` injection seam (no change to `consensus-loop.mjs` control flow),
  benchmarked against `invokePaseo` for schema-retry rate and latency. Cover the
  operator-lean provider set — `claude` + `codex` (native structured-output
  modes) and `cursor` (envelope + inject/validate/retry, since it has no native
  schema flag). Port from the proven `~/code/stoa` adapters
  (`provider-adapter.ts`, `final-json-contract.ts`) rather than starting fresh.
- The required migration steps are enumerated and sequenced, including at least:
  provider adapter contract, structured-output inject+validate+retry helper,
  provider inventory/availability replacement for `paseo provider ls --json`,
  preflight/version handling, error taxonomy parity (`PASEO_MISSING`,
  `PEER_UNAVAILABLE`, `PASEO_EXIT`, `PASEO_INVALID_JSON` equivalents), and a
  decision on cursor/ACP provider coverage.
- Explicit go/no-go: either a phased migration plan (split into follow-up items)
  or a documented decision to stay on Paseo with the rationale recorded.
