---
id: bl-bb7e
title: 'Investigate in-house peer-invocation CLI to reduce/replace the Paseo dependency'
status: open
priority: medium
scope: initiative
scope_estimate: L
labels: [consensus, architecture, paseo, build-vs-buy]
assignee: null
created: '2026-06-13T17:44:50Z'
updated: '2026-06-13T17:44:50Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

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

### Decision pivot

The deciding question is **how many peer providers we want to support**:
- 2–3 providers with native headless modes → building our own is modest-cost
  and removes the daemon/install/version-drift friction.
- "Whatever speaks ACP" (broad provider catalog) → Paseo's adapter + ACP catalog
  maintenance is worth keeping.

Related context: the cursor-as-peer path is supported by Paseo via a custom ACP
provider (`cursor-agent acp`) but is unverified end-to-end and routes through the
soft (prompt-inject + retry) schema path; see README "Advanced Configuration"
and the cursor-as-peer verification follow-up.

## Acceptance Criteria

- A written build-vs-buy recommendation lands in `.oat/repo/reference/research/`
  (or a successor decision record), covering: the exact Paseo surface we use,
  the value to replace, the cost of each option, and the provider-count pivot.
- A spike validates a direct-CLI `invokePeer` backend for `claude` and `codex`
  using their native structured-output modes, wired behind the existing
  `invokePeer` injection seam (no change to `consensus-loop.mjs` control flow),
  and benchmarked against `invokePaseo` for schema-retry rate and latency.
- The required migration steps are enumerated and sequenced, including at least:
  provider adapter contract, structured-output inject+validate+retry helper,
  provider inventory/availability replacement for `paseo provider ls --json`,
  preflight/version handling, error taxonomy parity (`PASEO_MISSING`,
  `PEER_UNAVAILABLE`, `PASEO_EXIT`, `PASEO_INVALID_JSON` equivalents), and a
  decision on cursor/ACP provider coverage.
- Explicit go/no-go: either a phased migration plan (split into follow-up items)
  or a documented decision to stay on Paseo with the rationale recorded.
