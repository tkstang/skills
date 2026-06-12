# Two-Agent Consensus Deliberation CLI (v1 brainstorm)

> Snapshot of a personal design note written 2026-04-30. Generalized for the repo on 2026-06-12. Superseded on architecture by `../architecture-v3.md` (via the v2 brainstorm), but the prior-art survey, the "why symmetric peer beats host+tool" arguments, and the large-document strategy remain the canonical statements of those analyses.

A CLI that orchestrates Claude Code and Codex CLI as **symmetric peers**, driving them through structured deliberation turns on a shared artifact until they converge — with the user as tiebreaker only on genuine impasse. Born from the friction of manually shuttling drafts between Claude Code and Codex CLI to refine emails, design docs, architecture documents, and similar artifacts.

## Problem Framing

Current refinement loops between two AI agents require manual context shuttling: paste output from one agent, ask the other for feedback, paste back, iterate. Both agents are valuable as critics of each other's work, but the manual mediation kills the loop's velocity and creates an asymmetry — whichever agent's session you're in becomes the de facto authority.

The existing workaround (a markdown file with append-only `Codex rebuttal` / `Claude rebuttal` sections, manually iterated) reduces friction but still requires the user to drive every turn.

What's actually wanted: kick off a problem to a CLI, both agents iterate against a shared artifact until they reach consensus, pause for user input only when they reach genuine impasse, return a final synthesized output alongside a full deliberation log.

## Prior Art Surveyed

- **`openai/codex-plugin-cc`** — One-shot delegation. Claude Code calls Codex via MCP for code review, adversarial review, or task rescue. Host+tool pattern; no deliberation loop.
- **`SnakeO/claude-co-commands`** — Same shape, different commands (`/co-brainstorm`, `/co-plan`, `/co-validate`). Claude Code drives, Codex answers via MCP.
- **`michelhelsdingen/ensemble`** — Closest in spirit. Real multi-agent orchestrator with tmux session per agent, message bus, monitor TUI, multi-host support. But designed for collaborative task execution rather than peer deliberation: lead/worker role hierarchy, free-form messaging, auto-disband on completion-signal (not consensus). Tmux substrate adds operational overhead.

The conceptual gap across all prior art: none implement *symmetric* peer deliberation with explicit ACCEPT/REVISE/IMPASSE protocol and convergence-by-artifact-hash. That's the wedge for a new tool.

## Architecture Sketch

### Neutral orchestrator pattern

A standalone CLI (Node/TS) — not Claude Code, not Codex — spawns each agent as a subprocess in headless mode (`claude -p` and `codex exec`). The orchestrator owns the loop; both agents are peers reporting to the orchestrator's protocol, not to each other.

### Shared artifact = source of truth

Append-only markdown with structured turn markers (`<claude round="3">`, `<codex round="3">`, `<user round="4">`). Both agents see the full artifact + goal + protocol instructions on every turn. Final synthesized output sits at the top for grabbability; full deliberation log sits below.

Illustrative shape:

```markdown
# Consensus: <title>

## Final Output
<converged artifact at the top so it's grabbable>

## Resolution
- Status: converged | impasse | max_rounds
- Rounds: 4 | User interventions: 0
- Models: claude-sonnet-4.7, gpt-5.4
- Tokens: ~24k | Cost: $0.18

## Goal
<original prompt + constraints>

## Deliberation Log
### Round 1 — claude (revise)
**Reasoning:** Tone too formal for audience.
**Changes:** Softened opening, added concrete example.
**Concerns:** Length still feels long.

### Round 2 — codex (revise)
...
```

This is an ADR for the deliberation, not just a transcript.

### Turn protocol

Each agent emits one of three structured verdicts per turn:

- **ACCEPT** — current artifact is good as-is
- **REVISE** — proposes new artifact version + reasoning + remaining concerns
- **IMPASSE** — explicitly flags a tiebreaker need

### Convergence and impasse detection

- Two consecutive ACCEPTs → converged, exit
- Same artifact hash twice in a row → converged via no-change
- Oscillation between two hashes → cycle detected, escalate
- N rounds without convergence (default ~6) → max-rounds, escalate
- Explicit IMPASSE from either agent → escalate immediately

### User tiebreaker UX

On impasse, orchestrator asks one agent to synthesize a "here's what we disagree about" summary, prompts user via stdin with the divergent options. User input becomes a `<user round="N">` entry in the artifact; both agents see it next round and the loop continues.

### Artifact-as-observability

Live tmux monitoring is unnecessary — the post-hoc artifact contains every turn's reasoning in full. Resume reads state from the artifact itself. Async mid-flight steering possible via append-and-resume — arguably better than reactive live monitoring for non-code use cases (rewards judgment over reflexes).

## Large-Document Strategy

For docs too large to re-feed every turn (architecture docs, multi-section specs):

**Outline-first.** Round 0 converges on the outline (section list + one-line each). Locks structural skeleton, prevents cross-section drift.

**Sequential section refinement.** Each section runs its own consensus loop with carry-forward context: outline + previously-finalized section *summaries* (1-2 lines each, not full text) + current section in full + last verdict.

**Whole-doc harmonization pass.** After all sections converge, run a final pass with both agents seeing the assembled doc to catch terminology drift, redundancy across sections, and transition issues. May force individual section re-runs.

**Section impasse handling.** Mark `[IMPASSE — pending user decision]`, keep last-accepted version in place, continue. Surface all impasses in a batch at the end so user tiebreaks once rather than getting interrupted N times.

**Unifying observation:** a one-section "doc" is just an email. Same engine, different chunking strategy. Build the section-level loop first, validate on small docs, then layer chunking on top.

## Why Symmetric Peer > Host+Tool

Six arguments, ranked by strength:

1. **Bias-free input parity.** Host pattern means the host decides what to forward to the tool — a summarization step that introduces bias. Neutral orchestrator gives both agents identical input.
2. **Hard termination contract.** A real loop in code with hash-based convergence + max-rounds is a hard contract. A prompt that says "keep iterating until done" is a soft hope that drifts.
3. **Symmetry of authority.** Host pattern lets the host silently dismiss the tool ("Codex suggests X but I'll go with Y"). Neutral loop makes both declare ACCEPT/REVISE on equal footing.
4. **Anti-sycophancy.** Both models lean toward agreeing with "the user." In host pattern, Codex implicitly answers to Claude. In neutral pattern, both answer to the orchestrator's protocol.
5. **Audit trail.** Append-only artifact with structured turns is a real artifact for retrospectives. "Round 4: Codex pushed on tone, Claude conceded paragraph 2, defended 3, user broke tie."
6. **Provider flexibility.** Neutral lets you drop in Gemini, a local model, or a third voice without rewriting. Host pattern hard-codes the asymmetry.

Host pattern isn't wrong for everything — fire-and-forget second opinions make sense as one-shot delegation. The two patterns coexist; reach for the neutral loop when you want the agents to *negotiate* rather than consult.

## Fit With Existing Workflow

- **Toolkit command surface.** Natural fit for a consensus verb on small artifacts and a `--hybrid` flag for large docs. Multi-provider thesis aligns. Replaces the existing manual-iteration markdown workflow.
- **Knowledge-base destination.** Output artifact is essentially an ADR for the deliberation; it accumulates a personal corpus of "here's how I made decisions, with reasoning" — far better archive than "the model told me to do X."
- **Workflow replacement.** Same artifact shape and append-only philosophy as the existing manual workflow — automated loop drops in cleanly.

## Next Steps (as written at the time)

- Spend ~1 hour with ensemble on a small task to validate the "next to" vs "on top of" decision and surface anything in their substrate worth pulling forward.
- Draft the per-agent prompt template and dry-run it manually (paste into Claude Code, paste into Codex separately) to see how reliably they emit structured verdicts — this is the next non-trivial design piece.
- Sketch the artifact format spec (frontmatter schema, turn marker syntax, resolution section) — this is the contract the orchestrator and both agents share.
- Decide section-loop-first vs hybrid-first build order. Lean section-loop-first: simpler primitive, validates the protocol on small docs before layering chunking.
