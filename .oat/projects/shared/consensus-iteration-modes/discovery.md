---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-12
oat_generated: false
---

# Discovery: consensus-iteration-modes

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details.

- Prefer outcomes and constraints over concrete deliverables (no specific scripts, file paths, or function names).
- If an implementation detail comes up, capture it as an **Open Question** for design (or a constraint), not as a deliverable list.

## Initial Request

Implement v3 Phase 2 of the consensus plugin: the two remaining iteration modes, `parallel_revision` and `parallel_synthesized`, in the shared consensus-loop engine, exposed through the existing `refine` skill via `--iteration`. This unblocks the five deferred family skills (`consensus-evaluate`, `-create`, `-decide`, `-plan`, `-research`), all of which default to one of these modes per the v3 architecture.

Backlog items: `bl-5d49` (parallel-revision) and `bl-7af0` (parallel-synthesized, which carries the synthesis-mediation design gate). Source material: `.oat/repo/reference/research/consensus/architecture-v3.md`, the consensus lane in `.oat/repo/reference/roadmap.md`, and DR-002 through DR-006 in `.oat/repo/reference/decision-record.md`. See `references/README.md` in this project.

Headline open question carried in from planning: the v3 architecture assumed a model orchestrator that can synthesize ("orchestrator-as-third-voice"), but v0.1 shipped a deterministic script orchestrator — synthesized mode needs a mediation decision (host-mediated synthesis turns vs. a third peer call) before build.

## Clarifying Questions

### Question 1: {Topic}

**Q:** {Question}
**A:** {User's answer}
**Decision:** {What this means for the project}

## Solution Space

_Include this section only when the request is exploratory or multiple viable approaches exist. For well-understood requests with an obvious approach, omit or replace with a single sentence stating the chosen direction._

{Divergent exploration of the problem space before converging on an approach. Capture genuinely distinct strategies, not minor variations. Include 2-3 approaches as needed.}

### Approach 1: {Strategy Name} _(Recommended)_

**Description:** {What this approach involves}
**When this is the right choice:** {Conditions under which this approach is best}
**Tradeoffs:** {What you give up by choosing this}

### Approach 2: {Strategy Name}

**Description:** {What this approach involves}
**When this is the right choice:** {Conditions under which this approach is best}
**Tradeoffs:** {What you give up by choosing this}

### Chosen Direction

**Approach:** {Which approach was selected}
**Rationale:** {Why this approach over the alternatives}
**User validated:** {Yes/No — explicit buy-in before proceeding}

## Options Considered

{Specific implementation options within the chosen approach. More granular than Solution Space — captures decisions about libraries, patterns, data formats, etc.}

### Option A: {Option Name}

**Description:** {What this option involves}

**Pros:**

- {Benefit 1}
- {Benefit 2}

**Cons:**

- {Drawback 1}
- {Drawback 2}

**Chosen:** {A/B/Neither}

**Summary:** {1-2 sentence summary of the chosen option and why}

## Key Decisions

1. **{Decision Category}:** {Decision made and why}
2. **{Decision Category}:** {Decision made and why}

## Constraints

- {Constraint 1}
- {Constraint 2}

## Success Criteria

- {Criterion 1}
- {Criterion 2}

## Out of Scope

- {Thing we explicitly decided not to do}
- {Thing we explicitly decided not to include in this phase}

## Deferred Ideas

{Ideas that came up during discovery but are intentionally out of scope for now}

- {Idea 1} - {Why deferred}
- {Idea 2} - {Why deferred}

## Open Questions

{Questions that need resolution before or during specification (and later design)}

- **{Question Category}:** {Question that needs answering}
- **{Question Category}:** {Question that needs answering}

## Assumptions

{Assumptions we're making that need validation}

- {Assumption 1}
- {Assumption 2}

## Risks

{Potential risks identified during discovery}

- **{Risk Name}:** {Description}
  - **Likelihood:** Low / Medium / High
  - **Impact:** Low / Medium / High
  - **Mitigation Ideas:** {How to address}

## Next Steps

Use this discovery artifact to drive the next workflow step:

- **Spec-driven mode:** continue to `oat-project-design` (which confirms
  requirements and produces both `spec.md` and `design.md`).
- **Spec-driven mode → formalize-only:** use `oat-project-spec` standalone
  if you want a formalized requirements artifact but aren't ready to
  design yet.
- **Quick mode → straight to plan:** proceed directly to `plan.md` when
  scope is clear and no architecture decisions remain.
- **Quick mode → optional lightweight design:** produce a focused
  `design.md` (architecture, components, data flow, testing) before
  planning. Choose this when discovery surfaced architecture choices
  or component boundaries.
- **Quick mode → promote:** escalate to spec-driven if discovery revealed
  the scope is larger or more complex than expected.
