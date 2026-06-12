# Consensus Deliberation Skill — Architecture v3 (Modes, Iteration, Agency)

> Snapshot of a personal design note written 2026-04-30. Generalized for the repo on 2026-06-12. This is the canonical family architecture the v0.1 consensus plugin was built from; see `README.md` in this directory for provenance and `../../roadmap.md` for implementation status.

A family of agent skills for multi-agent consensus deliberation, all built on a shared underlying primitive (`consensus-loop`). Drives Claude Code and Codex (and optionally other providers) as **symmetric peers** through structured turn protocols on shared markdown artifacts, with a complete audit trail of the deliberation alongside the converged output.

This is the v3 architecture. Supersedes the v2 brainstorm (`brainstorms/2026-05-01-consensus-skill-orchestrator-v2.md`) with three substantive additions: (1) generalization from single-purpose `consensus-refine` to a family of consensus skills sharing a core primitive, (2) three first-class iteration modes (alternating, parallel-revision, parallel-synthesized) as an independent dimension from cold-start strategy, (3) editorial agency setting as a posture that affects multiple decision points in the loop. The core architectural findings from v2 (Paseo as primitive layer, sequential-then-parallel section orchestration, AGPL-via-shell-out, hash-based convergence, fresh-agents-per-turn) carry forward unchanged.

## The skill family

All skills share a common loop engine; they differ in initial state, prompt context, what counts as "done," and what each turn produces.

| Skill | Purpose | Input | Output |
|---|---|---|---|
| `consensus-refine` | Improve an existing artifact through deliberation | Artifact + goal | Refined artifact + deliberation log |
| `consensus-create` | Produce a new artifact from a brief through deliberation | Brief / spec / requirements (+ optional template) | Created artifact + deliberation log |
| `consensus-evaluate` | Judge an artifact against a rubric/spec | Artifact + rubric | Unified evaluation + reasoning + dissent |
| `consensus-decide` | Recommend among options with deliberation | Options + context | Decision doc + reasoning + alternatives |
| `consensus-plan` | Produce a structured plan from a goal | Goal + constraints | Plan (steps, dependencies, risks) + deliberation log |
| `consensus-research` | Investigate a question and produce findings | Question + scope | Synthesized findings + evidence + dissent |

They share the same core: orchestrator + agents + structured verdicts + convergence detection + deliberation log. They differ in: initial state, prompt context, what "done" looks like, whether sections come from the input or are derived, and what agents do during their turns (text edits vs. evaluations vs. tool-using research).

The shared core primitive is parameterized by:

```
consensus-loop(
  cold_start_strategy: "shared_input" | "independent_draft",
  iteration_mode:      "alternating" | "parallel_revision" | "parallel_synthesized",
  context_provider,    // mode-specific: brief, original doc, rubric, etc.
  convergence_criteria,
  prompt_template,
  max_rounds_per_section,
  editorial_agency:    "minimal" | "moderate" | "maximum",
  providers,
  ...
)
```

Each skill is a thin wrapper that sets sensible defaults for its use case but exposes overrides as flags.

## Iteration modes

Three first-class iteration patterns. A **round** = every agent involved has had one turn (so 1 round = 1 agent call in alternating, 2 in parallel, 2 + orchestrator synthesis in parallel-synthesized). This makes `--max-rounds-per-section` mode-agnostic from the user's perspective; cost implications are clear once they pick a mode.

### Alternating mode

One agent revises, the other responds. Classic turn-taking.

- Round 1: Agent A revises the artifact, emits verdict.
- Round 2: Agent B sees A's revision + verdict, revises or accepts.
- Repeat.
- Convergence: hash-match across consecutive turns, or both agents emit ACCEPT consecutively.

**Token-efficient** (1 call per round), faster on small edits, natural for refine where the artifact is mostly right. **Risk:** asymmetric authority — whichever agent goes first frames the conversation.

### Parallel-revision mode

Both agents work simultaneously on the same input each round, then swap.

- Round 1 (cold start): Both agents independently produce v1 (from shared input or independent drafts depending on cold-start strategy).
- Round 2: Each agent receives both round-1 outputs, independently produces a revision plus a critique of both inputs (own and peer).
- Round 3: Each agent receives both round-2 revisions, same process.
- Convergence: hash-match between the two agents' revisions in the same round (emergent agreement, not negotiated). Alternative: both emit `ACCEPT_PEER`.

**Stronger consensus signal** — "given the same inputs, we both independently arrived at the same place" is substantively different from "I won't push further." **Cost:** 2x agent calls per round, but parallel wall-clock comparable. **Risk:** rabbit-holing on style preferences (handled by orchestrator surfacing to user after max rounds, see Editorial agency).

### Parallel-synthesized mode

Both agents revise in parallel, then **the orchestrator itself synthesizes** based on both revisions and both critiques. Resolution: the orchestrator IS the third voice — it has broader context (master log, goal, prior rounds, cross-section state) than either peer agent, so it has more signal to make editorial calls. No fourth agent is spawned; the synthesis happens in the skill's own model.

- Round 1: Both agents independently produce v1.
- Round 1 synthesis: Orchestrator produces v1.5 by combining both drafts using both critiques as guidance, with synthesis reasoning.
- Round 2: Both agents see v1.5, independently revise and critique.
- Round 2 synthesis: Orchestrator produces v2.5.
- Repeat.
- Convergence: agents' revisions of round N's synthesis are nearly identical to the synthesis itself (synthesis is stable enough that further parallel revision doesn't change it meaningfully). Hash-match primary; high-similarity-but-not-identical can trigger one more round to confirm.

**Solves the rabbit-holing problem from pure parallel** — divergence resets each round to a single synthesized starting point. **Most architecturally distinct mode** because the orchestrator gains genuine editorial agency. **Trust calibration matters** — the synthesizer's role must be legible in the audit trail.

The synthesis prompt is the new design surface in this mode. Sketch:

```
You are synthesizing two independent revisions into a unified version.

Brief / Goal: [...]

Agent A's revision: [...]
Agent A's critique:
  - Strengths of B's previous: [...]
  - Weaknesses of B's previous: [...]
  - What I changed and why: [...]

Agent B's revision: [...]
Agent B's critique: [...]

Where both critiques agree, treat as established. Where they disagree, prefer the change supported by stronger reasoning. Produce a synthesized version that incorporates each agent's identified strengths.

Output JSON: { synthesized_artifact, synthesis_reasoning, unresolved_disagreements: [] }
```

The `unresolved_disagreements` field is critical — it surfaces what the orchestrator couldn't reconcile, which becomes both an audit trail entry and a signal for whether the next round will actually converge.

Synthesis reasoning is a first-class artifact entry. Each round in this mode logs: agent A's revision + critique, agent B's revision + critique, **orchestrator's synthesis + reasoning + unresolved disagreements**. The user can audit the orchestrator's decisions, not just the agents'.

### Comparison

| Mode | Calls/round | Orchestrator role | Best for | Risk |
|---|---|---|---|---|
| Alternating | 1 | Mechanical | Polish, refine, token-efficient | Asymmetric authority |
| Parallel-revision | 2 | Mechanical | Independent thinking, strong emergent consensus | Rabbit-holing on style |
| Parallel-synthesized | 2 + orchestrator | Editorial third voice | Combining strengths, breaking ties via meta-judgment | Higher per-round cost, orchestrator bias |

## Cold-start strategies

Independent dimension from iteration mode. Three iteration modes × two cold-start strategies = six configurations.

- **`shared_input`** — All agents see the same starting artifact in round 1. Natural for refine (artifact exists), evaluate (artifact + rubric), research (question + scope).
- **`independent_draft`** — Round 1 has agents producing their own outputs from the brief, no shared starting artifact. Natural for create (brief only), decide (independent recommendations), plan (independent approaches).

## Editorial agency setting

A *posture* that shapes orchestrator behavior at three distinct decision points: **convergence detection**, **impasse handling**, and (in synthesized mode) **synthesis style**. Categorical primary (`minimal | moderate | maximum`) with optional numeric override (1–10) for power users.

| Setting | Convergence calls | Impasse handling | Synthesis style (synthesized mode) |
|---|---|---|---|
| **Minimal** | Strict hash-match only | Always surface to user | Even-handed merge, surface unresolved |
| **Moderate** | Hash-match + strong signal of stable convergence | Surface contested calls, decide minor ones | Editorial judgment with explicit reasoning |
| **Maximum** | Liberal — orchestrator can declare done when synthesis stabilizes | Decide unless genuinely stuck | Confident editorial decisions |

Agency is **universal across iteration modes**, not synthesized-only. In alternating and parallel-revision modes, it still affects whether the orchestrator calls convergence early, how impasses are handled, and how aggressively to push toward done.

**Interaction with max-rounds:** max-rounds is the *budget*; agency is what the orchestrator *does* when budget runs out.

- Minimal agency + budget exhausted → surface to user.
- Maximum agency + budget exhausted → orchestrator makes a call (synthesizes final, picks stronger revision, declares best-effort done) and logs the decision.
- Moderate is in between — surface meaningful disagreements, decide minor ones, log everything.

**User experience by combination:**

- *Conservative:* minimal agency + low max-rounds → lots of surfacing, user heavily involved, slow but tightly controlled.
- *Aggressive:* maximum agency + high max-rounds → orchestrator runs autonomously, surfaces only on real impasse, fast and hands-off.
- *Default middle:* moderate agency + sensible max-rounds → orchestrator handles routine convergence and minor calls, surfaces meaningful disagreements.

## Round budgets and user-driven re-budgeting

Per-section budgets with surface-to-user-on-exhaustion is the right primitive. Different sections have different difficulty profiles — a global max-rounds either over-budgets easy sections or under-budgets hard ones.

**Flow when budget exhausted:**

1. Orchestrator surfaces to user with: divergent state, cumulative critiques, summary of what they keep diverging on.
2. User options:
   - Pick one of the current revisions.
   - Blend specific aspects manually.
   - Give new direction (steering prompt to both agents).
   - Raise/lower the bar (relax/tighten convergence criteria).
   - Set a new max-rounds and resume.
   - Accept the impasse and move on.
3. User input becomes a `<user round=N>` entry in the deliberation log.
4. If continuing, both agents see the user input in their next round's context.

Each user intervention is a first-class entry in the audit trail. The artifact captures both the agent debate AND the human steering — a complete record of how the document actually got made.

## Skill defaults

These are starting points; all overridable via flags.

| Skill | Cold-start | Iteration | Agency |
|---|---|---|---|
| `consensus-refine` | shared_input | alternating | moderate |
| `consensus-create` | independent_draft | parallel_synthesized | maximum |
| `consensus-evaluate` | shared_input | parallel_revision | minimal |
| `consensus-decide` | independent_draft | parallel_synthesized | minimal |
| `consensus-plan` | independent_draft | parallel_synthesized | moderate |
| `consensus-research` | shared_input | parallel_synthesized | moderate |

Reasoning notes:

- **Refine + alternating + moderate:** artifact already exists, incremental polish, token-efficient; light editorial calls fine, big disagreements surface.
- **Create + parallel_synthesized + maximum:** user wants something produced, divergent thinking + orchestrator synthesis combines strengths, orchestrator should drive.
- **Evaluate + parallel_revision + minimal:** independent judgment is the whole point; synthesis would dilute. Surface every meaningful disagreement.
- **Decide + parallel_synthesized + minimal:** divergent recommendations make sense; synthesis useful for combining reasoning. But the *decision* is the user's — orchestrator should be a faithful summarizer of agent positions, not a fourth recommender.
- **Plan + parallel_synthesized + moderate:** divergent thinking on approach, then synthesize. Light editorial calls OK.
- **Research + parallel_synthesized + moderate:** synthesis of findings is the point; contested facts surface, editorial framing is allowed.

## Verdict schema (mode-aware)

The verdict shape varies by iteration mode. The core primitive picks the right schema; skills consume normalized results.

### Alternating mode

```json
{
  "verdict": { "enum": ["ACCEPT", "REVISE", "IMPASSE"] },
  "reasoning": "string",
  "proposed_artifact": "string (only if REVISE)",
  "concerns": ["optional: lingering concerns even if accepting"]
}
```

### Parallel-revision mode

Each agent produces a revision plus a critique of both inputs:

```json
{
  "critique": {
    "own_previous": "what I'd improve in my last revision",
    "peer_previous": "strengths and weaknesses of the other's last revision"
  },
  "verdict": { "enum": ["REVISE", "ACCEPT_PEER", "CONVERGED", "IMPASSE"] },
  "proposed_artifact": "string (the revision; if ACCEPT_PEER, copy of peer's previous)"
}
```

- `ACCEPT_PEER` — "the other agent's revision is better than mine, I'm adopting it." If both agents emit `ACCEPT_PEER` of each other in the same round, explicit consensus crossover.
- `CONVERGED` — agent's own assessment that "we're done," useful when hash-equality isn't quite there but both agents recognize the work is essentially complete.

### Parallel-synthesized mode

Agents emit the same shape as parallel-revision. Orchestrator emits synthesis:

```json
{
  "synthesized_artifact": "string",
  "synthesis_reasoning": "string explaining editorial decisions",
  "unresolved_disagreements": ["strings — things the orchestrator couldn't reconcile"]
}
```

## Convergence detection

Mechanisms shared across modes:

1. **Hash-based (primary).** Hash artifact after each round. Mode-specific:
   - Alternating: same hash from consecutive turns by different agents.
   - Parallel-revision: same hash from both agents in the same round.
   - Parallel-synthesized: agents' revisions of round N's synthesis match the synthesis itself.
2. **Explicit acceptance.** Mode-specific verdicts (ACCEPT, ACCEPT_PEER, CONVERGED) signal agent-perceived done.
3. **Max rounds per section.** Default 10–15; configurable. Triggers user surfacing (subject to agency setting).
4. **Oscillation detection.** If artifact alternates between two states (or two divergent versions in parallel mode) across 4+ rounds, escalate as impasse. More critical in parallel modes than alternating.

Agency setting modulates how strictly these criteria are applied.

## Sectioning and parallelization

Unchanged from v2:

- Default section detection by markdown headings; explicit `<!-- section: name -->` markers as override; user-specified boundaries supported.
- **Sequential MVP:** loop each section to convergence, append logs, advance.
- **Parallel v2:** main orchestrator spawns N sub-agents (one per section). Each sub-agent is itself a complete orchestrator instance — gets full doc + section boundary + scratch log path, runs its own consensus loop in chosen iteration mode, returns. Main waits, collects in order, runs harmonization pass. *(v0.1 implementation note: this landed as host-mediated dispatch rather than `paseo run --detach`; see the decision record.)*
- Per-section impasse keeps the larger process moving — surface all impasses in batch at end for user tiebreaking.

The iteration mode and agency settings apply *within* each section's loop, regardless of whether sections run sequentially or in parallel.

## Artifact format

All modes converge on a structured markdown ADR for the deliberation. Top is converged output (grabbable). Below is the audit trail.

New in v3: synthesis entries in synthesized mode, user intervention entries when budget exhausted, mode/agency metadata in the resolution block.

```markdown
# Consensus: <title>

## Final Output

<converged document>

## Resolution

- Mode: refine | create | evaluate | decide | plan | research
- Iteration: alternating | parallel_revision | parallel_synthesized
- Cold-start: shared_input | independent_draft
- Editorial agency: minimal | moderate | maximum
- Status: converged | partial-impasse | max-rounds | user-stopped
- Sections: 8 of 10 converged, 2 impasse
- Total rounds: 47
- User interventions: 1
- Models: claude-sonnet-4.7, codex/gpt-5.4
- Wall-clock: 4m 12s
- Approximate cost: $0.34

## Goal / Brief

<original input>

## Deliberation Log

### Section 1: Opening paragraph

**Status:** Converged (5 rounds)

#### Round 1 — parallel-revision

**Agent A (Claude) revision:** [...]
**Agent A critique:** [strengths/weaknesses/what-I-changed]

**Agent B (Codex) revision:** [...]
**Agent B critique:** [...]

#### Round 2 — orchestrator synthesis (synthesized mode only)

**Synthesized artifact:** [...]
**Synthesis reasoning:** [editorial decisions]
**Unresolved disagreements:** [list]

#### Round 3 — parallel-revision

[similar]

**Converged text:** [...]

---

### Section 4: Hard paragraph

**Status:** User intervention at round 5; converged at round 7.

#### Rounds 1–5
[...]

#### User intervention (after round 5)

**Reason:** Max rounds exhausted; agents diverged on tone.
**Divergent state:** [summary]
**User direction:** "Go with concise tone, prioritize clarity over completeness."
**New max-rounds:** 3 (added)

#### Rounds 6–7
[...]

---

### Harmonization Pass

[similar]
```

## Skill invocation surface

```
/consensus-<mode> <input> [options]

Shared options:
  --approach        sequential | parallel    (default: sequential)
  --sections        auto | explicit          (default: auto via markdown headings)
  --iteration       alternating | parallel_revision | parallel_synthesized
  --cold-start      shared_input | independent_draft
  --agency          minimal | moderate | maximum
  --max-rounds      <N>                       (per section)
  --escalate-after  <N>                       (rounds before user surfacing)
  --providers       claude,codex              (default; supports custom pairs)
  --harmonize       true | false              (default: true)
  --output          <path>

Mode-specific:
  consensus-refine    --goal <text>
  consensus-create    --brief <text> | --brief-file <path>  --template <path>
  consensus-evaluate  --rubric <path>
  consensus-decide    --options <path>
  consensus-plan      --constraints <text>
  consensus-research  --question <text>  --scope <text>
```

Mid-skill UX (unchanged from v2):

- User can pause and ask the skill questions about progress.
- User can manually edit a section's working state and tell the skill to resume.
- User can ask the agents to focus on specific aspects on the next round.
- All steering interactions land in the artifact as `<user>` entries.

## Implementation plan

**Phase 1: Core primitive + sequential `consensus-refine` MVP**

1. Define artifact format spec (frontmatter, section markers, round records, resolution block) — including v3 additions for mode/agency metadata and synthesis entries.
2. Implement `consensus-loop` core primitive parameterized by cold-start, iteration, agency, convergence criteria.
3. Implement section parsing (markdown headings, explicit markers, user-specified).
4. Implement alternating iteration mode end-to-end (smallest surface).
5. Wire up `consensus-refine` skill as thin wrapper, sequential approach.
6. Test on real artifacts (email, one-pager, arch doc section).

**Phase 2: Parallel-revision and parallel-synthesized iteration modes**

1. Implement parallel-revision mode in core primitive (two agent calls per round, convergence on hash-match between agents in same round).
2. Implement parallel-synthesized mode (agents + orchestrator synthesis, synthesis-stability convergence).
3. Wire orchestrator synthesis into the skill's own model (no fourth agent).
4. Test mode-switching on the same artifact to compare outcomes.

**Phase 3: Editorial agency + budget surfacing**

1. Implement agency setting affecting convergence, impasse, synthesis.
2. Implement budget-exhaustion surfacing flow (present state, user options, log intervention, resume).
3. Implement oscillation detection (more critical in parallel modes).
4. Test agency calibration on contentious vs. easy artifacts.

**Phase 4: Skill family + parallel section orchestration**

1. Build `consensus-create`, `consensus-evaluate`, `consensus-decide`, `consensus-plan`, `consensus-research` as thin wrappers with appropriate defaults.
2. Implement parallel section orchestration via sub-agent delegation.
3. Add harmonization pass.
4. Add metrics (token counts, wall-clock, rounds per section).

**Phase 5: Polish**

1. Resume protocol (mid-section interruption recovery from artifact alone).
2. Documentation, examples, sharing.
3. Decision: keep personal or publish more broadly.

## Open design questions (carried forward + new in v3)

1. **Synthesis prompt tuning** (new) — orchestrator synthesis is editorial; how much guidance do we give about *how* to weight critiques? Probably explicit "prefer change supported by stronger reasoning" framing, but worth iterating.
2. **Editorial agency calibration** (new) — minimal/moderate/maximum is the right categorical, but what does each *actually* mean in code? Especially around "liberal" vs "strict" hash-match acceptance and "surface" vs "decide" thresholds.
3. **Cost tracking and budgeting** (refined from v2) — `--max-rounds-per-section` is round-budget; should there also be a `--max-cost-per-section` or `--max-cost-total` for hard token budget caps? Probably yes for production use.
4. **User intervention richness** — beyond "new direction + new budget," should the user be able to inject explicit edits to the artifact mid-loop, then have agents continue from that state? Probably yes, captured as `<user round=N type=edit>`.
5. **Section detection fallback** — markdown headings + explicit markers cover most cases; should LLM auto-chunking be a fallback for unstructured docs? Probably opt-in only (`--sections auto-llm`) given the non-determinism.
6. **Harmonization context** (carried) — agents see only assembled doc, or also per-section logs?
7. **Resume protocol** (carried) — artifact-as-state authoritative, or scratch state needed? *(Resolved in v0.1: artifact is authoritative; see decision record.)*
8. **Three+ agent extension** (carried) — pairwise disagreement, ties of three; v3+ concern.
9. **Skill discoverability** — six skills is a lot; do they share enough docs that one `/consensus` umbrella command with subcommands makes sense, or are six distinct skills cleaner for the user? *(v0.1 shipped namespaced `consensus:refine`, pointing toward the umbrella shape.)*

## Why this is a solid design foundation

The v3 architecture has converged on a small set of orthogonal dimensions that compose into a large design space:

- **6 skills** (refine, create, evaluate, decide, plan, research)
- **3 iteration modes** (alternating, parallel-revision, parallel-synthesized)
- **2 cold-start strategies** (shared_input, independent_draft)
- **3 agency levels** (minimal, moderate, maximum)
- **2 section approaches** (sequential, parallel)

That's 6 × 3 × 2 × 3 × 2 = 216 valid configurations, but only ~6–10 are actually useful in practice (the per-skill defaults plus a handful of common overrides). The defaults table captures the high-value combinations; the dimensional structure means the full space is available when needed.

Key architectural commitments now stable:

- Skill family with shared `consensus-loop` primitive (not one monolithic CLI, not six unrelated tools)
- Paseo as the agent-orchestration primitive (shelled out, AGPL handled)
- Stateless-per-turn agents (validated against Paseo's own loop pattern)
- Hash-based convergence + structured verdicts as the contract
- Artifact-as-audit-trail (not just final output, full deliberation record)
- Orchestrator-as-third-voice in synthesized mode (broader context = stronger editorial signal)
- Editorial agency as a posture affecting multiple decision points
- Per-section round budgets with user-driven re-budgeting on exhaustion
- Sub-agent delegation for parallel section orchestration (each sub-agent a complete orchestrator instance)

Ready to start building from. Phase 1 (core primitive + sequential `consensus-refine` with alternating mode) is the smallest valuable shippable scope.

## Related

- `brainstorms/2026-05-01-consensus-skill-orchestrator-v2.md` — v2 brainstorm. Skill-as-orchestrator framing, sequential→parallel section orchestration, Paseo source findings, AGPL analysis. v3 supersedes the architecture sections; the prior-art survey, Paseo findings, and "why symmetric peer beats host+tool" arguments still stand.
- `brainstorms/2026-04-30-consensus-cli-v1.md` — original CLI-framed brainstorm. Prior-art comparisons (codex-plugin-cc, claude-co-commands, ensemble) and the symmetric-peer-vs-host+tool analysis remain useful.
- Paseo source (structured response mechanism and loop pattern): `packages/server/src/server/agent/agent-response-loop.ts` (JSON extraction, retry logic) and `packages/server/src/server/loop-service.ts` (validates fresh-agents-per-iteration) in the Paseo repository.
