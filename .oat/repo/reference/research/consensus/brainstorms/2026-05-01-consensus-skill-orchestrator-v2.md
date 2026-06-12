# Consensus Deliberation Skill — Architecture v2 (brainstorm)

> Snapshot of a personal design note written 2026-04-30/05-01. Generalized for the repo on 2026-06-12. Superseded on architecture by `../architecture-v3.md`, but the Paseo source findings, the skill-vs-CLI analysis, and the harmonization/parallel designs remain the canonical statements of those analyses.

A Claude Code skill that orchestrates multi-section consensus refinement using Paseo's agent CLI as the primitive layer. Drives Claude Code and Codex as **symmetric peers** through structured ACCEPT / REVISE / IMPASSE verdicts until convergence on each section, with optional parallelization and a final harmonization pass. Output is a complete audit trail of the deliberation alongside the converged document.

This is an evolution of the earlier brainstorm captured in `2026-04-30-consensus-cli-v1.md`. The earlier note framed this as a standalone CLI with a peer protocol; this revision pivots to a Claude Code **skill** as the home, formalizes the artifact-as-audit-trail design, and adds parallel multi-section orchestration via sub-agent delegation.

## Why a skill rather than a standalone CLI

The original framing was a Node CLI orchestrating Paseo via subprocess. Investigating Paseo's source revealed that `paseo run --output-schema` already does most of the heavy lifting (subprocess management, provider abstraction, JSON schema validation with retry, agent lifecycle). The orchestrator becomes thin enough that the bigger question is *where* it should live, not *how* to build it.

A Claude Code skill wins on:

- **Native invocation.** `/consensus-refine email.md` from any conversation. No context switch.
- **Filesystem access.** Reads input doc, writes deliberation artifact, no glue code.
- **Mid-process steering.** User can pause, ask questions, manually edit a section, resume — natural in skill UX, awkward in standalone CLI.
- **Sub-agent delegation.** Skills already have a model for spawning sub-agents; this maps cleanly to per-section parallelization.
- **Artifact as conversation.** The deliberation log can be inspected, shared, or re-engaged with later as a real Claude Code artifact.

Build personal-first, lift to a shared toolkit later if useful across projects.

## Findings from Paseo source review

The Paseo investigation produced four concrete findings that shape the architecture:

**`--output-schema` is prompt + parse + retry, not constrained generation.** The schema is JSON-stringified and appended to the prompt with `"You must respond with JSON only that matches this JSON Schema: {schema}"`. Response is run through a robust JSON extractor (markdown-fenced first, then balanced-bracket scanning anywhere in prose, so `"Sure, here's: {…}"` works). Validation via Ajv or Zod's safeParse. On failure, retry with the original prompt plus `"Previous response was invalid: {errors}. Respond again with JSON only."` Up to 2 retries (3 total attempts). Provider-agnostic — same code path for Claude, Codex, OpenCode. Reliability is best-effort with self-correction; not bulletproof, but good enough for structured verdicts.

**Paseo's own loop service uses fresh agents per iteration.** In `loop-service.ts`, each iteration calls `agentManager.createAgent` for the worker, runs it, then `closeAgent` or `archiveAgent`. New agents for the next iteration. They explicitly chose stateless-per-iteration over agent-reuse via `paseo send`. This validates the same model for our consensus loop: each turn is a fresh `paseo run` with the full artifact passed in.

**`paseo send` is stateful conversation accumulation.** Confirmed via `runSendCommand` — it appends a user message to an existing agent's persistent session. Useful for follow-ups in interactive use, but wrong shape for symmetric peer deliberation where each turn should see identical input.

**AGPL is not a concern.** Paseo is `AGPL-3.0-or-later`. As long as we shell out to the `paseo` binary as an external dependency (same as `git`, `node`), no copyleft contamination. This keeps the skill MIT-friendly.

## Architecture overview

The skill is the orchestrator. Paseo is the primitive layer.

- **Paseo handles:** agent process lifecycle, provider abstraction (Claude Code / Codex / OpenCode), JSON schema validation with retry, subprocess management, output streaming.
- **Skill handles:** section parsing, convergence detection (artifact hashing), deliberation log assembly, sub-agent orchestration (sequential or parallel), impasse handling, user tiebreaker UX, final synthesis.

### Sequential MVP

Ship this first. Simpler, easier to debug, validates the protocol on real docs before layering parallelization.

1. Skill reads input artifact (email, doc, etc.).
2. Parses into sections — default by markdown headings, override via explicit `<!-- section: name -->` markers, or user-specified boundaries.
3. For each section *sequentially*:
   - Spin up consensus loop: alternating `paseo run --output-schema` calls for Claude and Codex.
   - Each agent sees: full original doc (context) + section boundaries (focused scope) + last turn's verdict from the other agent + current artifact state.
   - Agents emit structured verdict (schema below).
   - Hash-based convergence: if both agents' turns produce the same artifact (typically both emit ACCEPT, or one REVISES and the other ACCEPTS the revision), section is converged.
   - Max rounds per section (default 10–15) and oscillation detection for impasse.
4. After each section converges, append the section's full deliberation log to the master artifact.
5. After all sections done, optional harmonization pass.
6. Synthesize final converged document.

### Parallel v2

Add once the sequential MVP is stable. The key insight is that **each sub-agent is itself a complete orchestrator instance** — the skill spawns N sub-agents (one per section), each runs an independent two-agent consensus loop on its own section, writes to its own scratch log file, and returns. Zero contention, no merge conflicts, scales trivially.

1. Main orchestrator parses sections.
2. For each section, spawn a detached sub-agent via `paseo run --detach` with: full original doc, section boundary, unique scratch log path (e.g., `.consensus/section-3.log.json`).
3. Collect all sub-agent IDs.
4. `paseo wait` on all of them in parallel — blocks until all idle.
5. Each sub-agent independently:
   - Spins up its own Claude + Codex pair via `paseo run`.
   - Runs the consensus loop until convergence on its section.
   - Writes deliberation log to its scratch file.
   - Returns result to main orchestrator.
6. Main collects all section logs in order.
7. Optional harmonization pass (sequential, on the assembled doc).
8. Synthesize master artifact.

Wall-clock benefit is significant: 10 sections × 5 rounds × ~30s/round sequentially = ~25 minutes; in parallel, ~2.5 minutes plus harmonization. Fault isolation is the secondary win — a contentious section 7 doesn't block sections 1–6 and 8–10.

*(v0.1 implementation note: parallel orchestration ultimately shipped as host-mediated subagent dispatch rather than `paseo run --detach`; see the decision record.)*

### Harmonization pass

Optional final pass after all sections converge. Both agents see the full assembled document (not the per-section logs — keep context bounded) and propose cross-section refinements: terminology drift, redundancy, transition issues, narrative flow. Same consensus loop mechanics, same convergence detection. Log gets appended to the master artifact under a `Harmonization` section. Can force individual section re-runs if cross-section issues require deep edits, though typically the pass is light-touch.

## Verdict protocol

Each turn emits structured JSON validated against a schema:

```json
{
  "type": "object",
  "properties": {
    "verdict": {
      "enum": ["ACCEPT", "REVISE", "IMPASSE"]
    },
    "reasoning": {
      "type": "string",
      "description": "Why this verdict. If REVISE, explain the changes."
    },
    "proposed_artifact": {
      "type": "string",
      "description": "Only if REVISE: the revised section. Empty for ACCEPT/IMPASSE."
    },
    "concerns": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Optional: lingering concerns even if accepting."
    }
  },
  "required": ["verdict", "reasoning"]
}
```

Semantic guidance the skill injects into the per-turn prompt:

- **ACCEPT** — current artifact is good as-is, no further changes needed.
- **REVISE** — propose specific edits; must include `proposed_artifact` with the new version.
- **IMPASSE** — explicitly cannot reach agreement, escalate to user tiebreaker.

## Convergence detection

Two primary mechanisms plus two safety nets:

1. **Hash-based (primary).** After each turn, hash the proposed artifact. If two consecutive turns from different agents produce the same hash, section is converged. Catches "Claude proposes X, Codex accepts X, Claude accepts X."
2. **Explicit acceptance.** Both agents emit `ACCEPT` consecutively on the same artifact.
3. **Max rounds.** After N rounds (default 10–15 per section), mark as impasse if not converged.
4. **Oscillation detection.** If artifact hash alternates between two states across 4+ turns, agents are stuck — escalate as impasse.

## Impasse handling

Per-section impasse keeps the larger process moving:

- Mark section as `IMPASSE` in the deliberation log.
- Keep the best-effort artifact from the last round in place.
- In sequential mode, continue to the next section.
- In parallel mode, the other sections may already be done.
- Main orchestrator surfaces all impasses in a single batch at the end so the user tiebreaks once rather than getting interrupted N times.
- For each impasse, the orchestrator can ask one agent to synthesize a "here's what we disagree about" summary, then prompt the user with the divergent options.
- User decision becomes a `<user round=N>` entry in the section's log; the section can be re-run if needed.

## Artifact format

The deliberation artifact is an ADR for the entire decision-making process. Top of file is the converged output (grabbable, useful immediately). Below is the full audit trail.

```markdown
# Consensus: <title>

## Final Output

<converged document>

## Resolution

- Status: converged | partial-impasse | max-rounds
- Sections: 8 of 10 converged, 2 impasse
- Total rounds: 47
- User interventions: 1
- Models: claude-sonnet-4.7, codex/gpt-5.4
- Wall-clock: 4m 12s
- Approximate cost: $0.34

## Goal

<original prompt + constraints>

## Deliberation Log

### Section 1: Opening paragraph

**Status:** Converged (5 rounds)

#### Round 1 — Claude (revise)
**Reasoning:** Tone is too formal for the audience; first sentence should hook with a concrete example.
**Proposed changes:** [snippet]

#### Round 2 — Codex (revise)
**Reasoning:** Agree on tone. Also suggests cutting redundant paragraph 3.
**Proposed changes:** [snippet]

#### Round 3 — Claude (accept)
**Reasoning:** Codex's cut works — paragraph 3 was redundant with the new opening.

#### Round 4 — Codex (accept)

**Converged text:**
[final paragraph 1]

---

### Section 2: ...

[similar]

---

### Harmonization Pass

**Status:** Converged (2 rounds)

#### Round 1 — Claude (revise)
**Reasoning:** Terminology inconsistency — section 1 uses "consensus," section 3 uses "agreement." Standardize.

#### Round 2 — Codex (accept)
```

The format is markdown-readable for humans and parseable for the skill (and any future tooling). Each round is a structured record; the orchestrator can reconstruct full state from the artifact for resume scenarios.

## Skill invocation surface

```
/consensus-refine <input-path>
  --approach sequential | parallel    (default: sequential)
  --sections auto | explicit          (default: auto via markdown headings)
  --harmonize true | false            (default: true)
  --max-rounds 15                     (default per section)
  --providers claude,codex            (default; supports custom pairs)
  --output <path>                     (default: <input>.consensus.md)
```

Mid-skill UX:

- User can pause and ask the skill questions about progress.
- User can manually edit a section's working state and tell the skill to resume from a specific point.
- User can ask the agents to focus on specific aspects on the next round (e.g., "both of you, prioritize tone over length").
- All steering interactions land in the artifact as `<user>` entries so the audit trail is complete.

## Implementation plan (as written at the time)

**Phase 1: Sequential MVP**

1. Define artifact format spec (frontmatter, section markers, round record schema, resolution block).
2. Implement section parsing — markdown heading detection with explicit-marker override.
3. Implement single-section consensus loop — `paseo run --output-schema`, hash detection, round limits, schema validation.
4. Implement deliberation log assembly and artifact synthesis.
5. Test on real artifacts: a meaty email, a one-pager, an arch doc section.

**Phase 2: Parallel extension**

1. Implement sub-agent spawning via `paseo run --detach` with section-scoped scratch logs.
2. Implement parallel wait and result collection.
3. Implement ordered log assembly.
4. Test on multi-section docs (5+, 10+).

**Phase 3: Polish**

1. Harmonization pass.
2. Impasse handling and user tiebreaker UX.
3. Metrics (token counts, wall-clock, rounds per section).
4. Documentation and shareable examples.
5. Decision: keep personal or publish.

## Open design questions (as written at the time)

1. **Prompt engineering depth.** Does Paseo's schema+retry obviate careful verdict-prompt tuning, or do we still need explicit semantic guidance for ACCEPT vs REVISE vs IMPASSE? Probably some baseline prompt tuning is still worth doing, but lighter than originally feared.
2. **Section detection.** Markdown headings as the default makes sense. Explicit `<!-- section: name -->` markers as override. Should LLM auto-chunking be a fallback for unstructured docs, or just fail loudly and ask the user to add structure?
3. **Harmonization context window.** Do agents see the full assembled doc only, or also the per-section deliberation logs? Probably just the final doc to keep context bounded; logs are useful for the user, not for the harmonization decision.
4. **Per-section budgets.** Should each sub-agent have independent max-rounds and cost caps, or shared defaults? Per-section makes sense for heterogeneous difficulty (a contentious section legitimately needs more rounds).
5. **User interruption during parallel.** Stop signal to all sub-agents, with a report on which ones completed before the interrupt? Probably yes; need clean cleanup semantics.
6. **Resume protocol.** If the skill is interrupted mid-section, can it pick up where it left off? Probably parse the existing artifact for state, but worth deciding whether artifact-as-state is authoritative or whether internal scratch state matters. *(Resolved in v0.1: artifact is authoritative.)*
7. **Metrics scope.** Start minimal (rounds + status) or comprehensive from day one (tokens, wall-clock, latency)? Lean minimal; expand if useful.
8. **Three-or-more-agents extension.** Three-way consensus changes the math (pairwise disagreement, ties of three). Almost certainly v3+ concern, but worth flagging the path.

## Related

- `2026-04-30-consensus-cli-v1.md` — the original CLI-framed brainstorm; this note supersedes it on architecture but the prior-art survey and "why symmetric peer beats host+tool" arguments still apply.
- Paseo source: `packages/server/src/server/agent/agent-response-loop.ts` (structured response mechanism), `packages/server/src/server/loop-service.ts` (Paseo's own loop pattern, validated stateless-per-iteration) in the Paseo repository.
