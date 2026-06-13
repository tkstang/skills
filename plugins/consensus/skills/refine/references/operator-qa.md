# Operator QA: consensus refine iteration modes

Manual dogfood guide for the v0.2 iteration-mode work (parallel-revision,
parallel-synthesized, and the agency-gated escalation ladder). This is the
NFR4 "audit-trail legibility" verification for the `consensus-iteration-modes`
project: the automated suite proves the mechanics; this guide is the human pass
that confirms the three modes produce artifacts a reader can actually follow.

Run it on a machine that has `paseo` on `PATH` and real peer CLIs configured
(usually `claude` and `codex`). It exercises live models and **costs real API
spend** — see the cost note in each scenario.

## Prerequisites

```bash
# From the repo root
node --version            # must be >= 22
paseo --version           # must be present (tested range 0.1.0–0.9.0)

# The wrapper shells out to `paseo run`, which needs the paseo DAEMON running:
paseo daemon status       # if not running:  paseo daemon start
                          # (run these in your normal login shell so paseo can
                          #  see your provider auth — a minimal/non-interactive
                          #  shell may report providers as unavailable)

# Confirm at least TWO peers are AVAILABLE (consensus needs two). Providers can
# sit in 'loading' for a few seconds after a daemon (re)start, then resolve to
# 'available' or 'unavailable'. 'unavailable' usually means that provider's CLI
# is not logged in / has no token in the daemon's environment.
paseo provider ls         # need >= 2 rows showing 'available' (e.g. claude + codex)
```

> **Two real gotchas from dogfooding (2026-06-13), both surfaced as clean
> errors in the artifact, not crashes):**
> - `DAEMON_NOT_RUNNING` → run `paseo daemon start`.
> - `Provider '<x>' is not available` / "Available providers: none" → start the
>   daemon from your login shell and make sure the provider is authenticated;
>   `paseo provider ls` must show it `available` (not `loading`/`unavailable`)
>   before you run. If your canonical peer (e.g. `claude`) is unavailable, either
>   authenticate it or substitute another available provider with
>   `--peers <a>,<b>` (e.g. `--peers codex,copilot`).

The wrapper lives at:

```
plugins/consensus/skills/refine/scripts/consensus-refine.mjs
```

The example inputs used below live in this directory under `examples/`.

> **Output hygiene.** The wrapper writes `<input>.consensus.md` next to its
> input by default. To keep generated artifacts out of git while you iterate,
> send output to the gitignored `tmp/` directory with `--output`, e.g.
> `--output tmp/email-alternating.consensus.md`. Generated `*.consensus.md`
> files inside `examples/` are gitignored as a backstop, but `--output tmp/...`
> keeps the examples directory clean. Create it once: `mkdir -p tmp`.

## How to read a run

Two surfaces matter:

1. **stdout JSONL** — one JSON object per line, the host-coordination protocol.
   The lines you care about:
   - `run_started` — carries `iteration_mode` and `calls_per_round: { peer, synthesis }`. This is the **cost disclosure**: `{ peer: 1, synthesis: 0 }` for alternating, `{ peer: 2, synthesis: 0 }` for parallel-revision, `{ peer: 2, synthesis: 1 }` for parallel-synthesized.
   - `escalation_required` — only emitted when a section gets stuck; the **only** event that carries divergent revision/synthesis text. Has `trigger`, `decide_via`, `decision_kinds`, the divergent revisions, an optional `promoted_from`, and a `resume` vector.
   - `run_completed` — carries `peer_calls`, `synthesis_calls`, `sections_escalated`.
   - stderr is human diagnostics only — ignore it for coordination.
2. **The artifact** (`<input>.consensus.md` or your `--output` path) — top-to-bottom:
   - `# Consensus Refine Artifact`
   - `## Final Output` — the converged document (grab this).
   - `## Resolution` — `Status`, `Mode`, `Parallel`, `Agency`, `Peers`, `Sections`, `Turns`/`rounds`, `Calls: N peer; M synthesis`.
   - `## Goal`
   - `## Deliberation Log` — per-section rounds. Each round shows the peer verdicts (and, in synthesized mode, the synthesis). Hidden HTML-commented canonical blocks (`consensus-verdict`, `consensus-synthesis`, `consensus-section-status`) carry the machine-readable record; the prose around them is what you audit for legibility.

**The NFR4 question to keep in mind while reading:** can you attribute every
content change to a specific actor — peer A, peer B, the synthesizer, the host,
or you (a user/host intervention) — and follow *why* each section concluded the
way it did, without consulting any state outside the artifact?

---

## Scenario 1 — Alternating (baseline / regression sanity)

Cheapest run; confirms v0.2 didn't regress the v0.1 path.

```bash
mkdir -p tmp
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs \
  plugins/consensus/skills/refine/references/examples/email-announcement.md \
  --goal "Tighten this announcement: keep it warm but cut the rambling; lead with the change." \
  --output tmp/email-alternating.consensus.md
```

**Expect:**
- `run_started` shows `iteration_mode: "alternating"`, `calls_per_round: { peer: 1, synthesis: 0 }`.
- The email is a single logical section, so it converges in a handful of rounds.
- Resolution: `Mode: alternating`, `Parallel: false`, `Calls: N peer; 0 synthesis`.
- Deliberation log alternates peer turns (one peer revises, the other accepts/revises). No synthesis blocks, no critique blocks.
- Final Output is materially tighter than the input and leads with the decision.

---

## Scenario 2 — Parallel-revision (emergent convergence)

Both peers revise concurrently each round and converge by agreeing independently.
~2× the peer calls of alternating.

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs \
  plugins/consensus/skills/refine/references/examples/architecture-note.md \
  --goal "Make this rate-limiter note precise and skimmable for senior engineers; keep all five sections." \
  --iteration parallel_revision \
  --output tmp/arch-parallel-revision.consensus.md
```

**Expect:**
- `run_started` shows `iteration_mode: "parallel_revision"`, `calls_per_round: { peer: 2, synthesis: 0 }`.
- The note has five `##` sections, so the log has five section blocks, each converging independently.
- Each round records **both** peers' revisions **and a critique** (`own_previous` / `peer_previous`) — this is the parallel signal. You should be able to see each peer assessing the other's prior revision.
- Convergence reason is emergent: the two peers' same-round revisions hash-match, or one adopts the other (`ACCEPT_PEER`), or both mark `CONVERGED`.
- Resolution: `Mode: parallel_revision`, `Parallel: false` (sections still run sequentially unless you add `--prepare-parallel`), `Calls: 2N peer; 0 synthesis`.
- **NFR4 check:** for each section, can you see what each peer changed and why they agreed?

---

## Scenario 3 — Parallel-synthesized (merged each round)

Parallel revision plus a per-round synthesizer that merges both drafts. The most
expensive mode: ~2× peer calls **plus** one synthesis call per round.

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs \
  plugins/consensus/skills/refine/references/examples/contested-tradeoffs.md \
  --goal "Sharpen this Rust-rewrite argument; make the strongest honest case while keeping the risks visible." \
  --iteration parallel_synthesized \
  --output tmp/rust-synthesized.consensus.md
```

**Expect:**
- `run_started` shows `iteration_mode: "parallel_synthesized"`, `calls_per_round: { peer: 2, synthesis: 1 }`.
- Each round: both peers revise, then a **synthesis** block appears (`synthesized_artifact`, `synthesis_reasoning`, `unresolved_disagreements`). The synthesized text becomes the next round's shared input.
- The synthesizer defaults to the first peer's provider — confirm the resolution block names it. (Try `--synthesizer codex` on a second run to see the identity change, or a cheaper provider if you have one configured.)
- Convergence reason is **synthesis stability**: both peers' revisions of a round match the prior synthesis.
- Resolution: `Mode: parallel_synthesized`, `Calls: 2N peer; M synthesis`.
- **NFR4 check:** can you follow the synthesizer's editorial decisions? Is each `synthesis_reasoning` legible, and do the `unresolved_disagreements` (if any) make sense?

---

## Scenario 4 — Escalation ladder (the headline v0.2 behavior)

The contested doc is the best escalation trigger. At **moderate** agency, a
persistent disagreement routes to the **host** (you); at **minimal** agency it
routes to you as a plain stop, like v0.1 impasse.

```bash
# Moderate agency: a stuck synthesized section escalates to the host (you).
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs \
  plugins/consensus/skills/refine/references/examples/contested-tradeoffs.md \
  --goal "Force the disagreement: make BOTH a decisive pro-rewrite version and a decisive against-rewrite version coexist — do not blandly merge them." \
  --iteration parallel_synthesized \
  --agency moderate \
  --max-rounds 4 \
  --output tmp/rust-escalation.consensus.md
```

This goal is deliberately adversarial — it asks the peers to *not* converge, so
the run is likely to exhaust its small budget or accumulate persistent
disagreements and emit an escalation. (Convergence is also a valid outcome; if it
converges, raise the tension in the goal or lower `--max-rounds` to 3.)

**Expect, if it escalates:**
- An `escalation_required` JSONL line with `trigger` (e.g. `persistent_disagreement` or `budget_exhausted`), `decide_via: "host"`, `decision_kinds` (including `defer_to_user`), both divergent revisions, and a `resume` vector: `{ artifact_path, flag: "--host-direction" }`.
- The run exits at that section (headless behavior, like impasse). The artifact is written with the section marked escalation.

**Then resume with a host decision** (you are the host orchestrator making the call):

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs \
  --resume tmp/rust-escalation.consensus.md \
  --host-direction "Go with the pro-rewrite framing but keep the risks section verbatim; lead with correctness." \
  --host-decision-kind direct
```

**Expect:**
- The decision records as a `HOST_DECISION` orchestrator round in the deliberation log — **distinct from a user round** — carrying your text and the trigger it answered.
- The section continues from there (budget refreshed like the user path).
- **NFR4 check:** in the final artifact, can you tell the host made this call (vs. a peer or the user), and see what was decided and why?

**Variations worth one run each:**
- **Decline as host** — resume with `--host-decision-kind defer_to_user` and no/empty direction; the wrapper re-emits the escalation routed to the **user** (`promoted_from: "host"`). This is the "genuinely stuck → kick it up" path.
- **Minimal agency** — rerun Scenario 4 with `--agency minimal`. The same stuck state should surface to **you as the user** directly (`decide_via: "user"`); resume with `--user-direction "..."` instead. This is the v0.1-equivalent path and proves minimal agency preserves the old behavior.
- **Routing guard** — on a `decide_via: "user"` escalation, try `--host-direction "..."`; expect a fail-closed `ESCALATION_ROUTING` rejection (a host may not answer a user-routed escalation).

---

## Negative / guard checks (fast, no convergence needed)

These fail fast at preflight and cost little or nothing:

```bash
# Invalid mode → INVALID_ITERATION_MODE, exits with a usage error listing allowed modes.
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs \
  plugins/consensus/skills/refine/references/examples/email-announcement.md \
  --goal "x" --iteration parallel_magic

# Unknown synthesizer → SYNTHESIZER_UNAVAILABLE at preflight.
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs \
  plugins/consensus/skills/refine/references/examples/email-announcement.md \
  --goal "x" --iteration parallel_synthesized --synthesizer not-a-real-provider

# Resuming a v0.1 artifact → SCHEMA_VERSION_MISMATCH (no migration). If you have an
# old v0 artifact lying around, point --resume at it; otherwise skip.
```

## Optional: verify cursor-as-peer (outstanding end-to-end)

Cursor is supported only as a **custom ACP provider**, and it is **not yet verified
end-to-end** — a full deliberation run against an authenticated `cursor-agent` is
outstanding. Cursor runs through Paseo's generic ACP path, where `--output-schema`
is enforced by prompt injection + validation/retry rather than the native structured
output `claude`/`codex` expose, so expect more schema-retry churn (the wrapper's
peer-validation retry, added in v0.2, helps absorb it). To verify:

```bash
# 1. Register Cursor as a custom ACP provider (see the plugin README "Advanced
#    Configuration"): add it to ~/.paseo/config.json, then authenticate cursor-agent
#    (it stores creds in the OS keychain — a locked keychain makes the provider
#    report status "error", which preflight now catches as PEER_UNAVAILABLE).
paseo provider ls            # confirm 'cursor' shows status 'available'

# 2. Run a real alternating deliberation with cursor as a peer.
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs \
  plugins/consensus/skills/refine/references/examples/email-announcement.md \
  --goal "Tighten: lead with the change, keep it warm." \
  --peers cursor,codex --output tmp/cursor-test.consensus.md
```

**What to check:** preflight passes (cursor reported `available`); the run converges
(or hits budget) without `OUTPUT_SCHEMA_FAILED` / validator errors; the artifact's
deliberation log attributes turns to `cursor` and `codex`. Note any elevated
schema-retry churn. Until this passes, keep cursor-as-peer documented as unverified.

## Mode comparison (the actual NFR4 deliverable)

Run Scenarios 1–3 on the **same** document (pick the architecture note or the
contested doc), same goal, and compare the three `## Final Output` blocks and
their deliberation logs side by side. Capture, in a sentence or two each:

- Did each artifact let you attribute every change to an actor and follow why each section concluded? (Yes/No + any spot where it didn't.)
- Did the synthesized mode's `synthesis_reasoning` read as legible editorial judgment, or as filler?
- Roughly what did each mode cost (from `run_completed` `peer_calls`/`synthesis_calls`) vs. the quality of its output?

Record the findings in the project's `implementation.md` under the p06-t06
notes (or paste them back to the assistant to record). That closes NFR4.

## Pass criteria

- [ ] All three modes run end-to-end and produce a converged `## Final Output`.
- [ ] Cost disclosure (`calls_per_round`) and final counts (`peer_calls`/`synthesis_calls`) match the mode (1/0, 2/0, 2/1 per round).
- [ ] An escalation surfaces, routes per agency, and a `--host-direction` resume records a `HOST_DECISION` round distinct from user rounds.
- [ ] The `defer_to_user` decline and the minimal-agency user route both behave as described.
- [ ] Every artifact is auditable per the NFR4 question above.
- [ ] The negative guards (`INVALID_ITERATION_MODE`, `SYNTHESIZER_UNAVAILABLE`, `ESCALATION_ROUTING`, `SCHEMA_VERSION_MISMATCH`) fire as expected.
