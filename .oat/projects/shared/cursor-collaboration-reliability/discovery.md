---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-07-19
oat_generated: false
---

# Discovery: cursor-collaboration-reliability

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details.

- Prefer outcomes and constraints over concrete deliverables (no specific scripts, file paths, or function names).
- If an implementation detail comes up, capture it as an **Open Question** for design (or a constraint), not as a deliverable list.

## Initial Request

Create a spec-driven project to make Cursor collaboration observation reliable
after live validation showed that Cursor lifecycle terminals are not dependable
assistant-turn boundaries. Explore a cohesive scope spanning transcript and
lifecycle evidence, safe recognition of substantive live content, trustworthy
observer accounting and identity, and evidence-gated collaboration wake
behavior. Keep larger collaboration-platform initiatives separate unless
discovery proves they share the same outcome and design surface.

## Clarifying Questions

### Question 1: Discovery Focus

**Q:** Which gray areas should discovery explore?
**A:** Explore Cursor live-content boundaries and freshness semantics; explore
observer truthfulness and recovery guarantees; include stronger Cursor wake
behavior only as a later phase after observation correctness is established.
**Decision:** Treat boundary recognition and truthful observer state as the
project's correctness core. Any stronger wake claim is subordinate to proven
observation behavior and may not promote merely because an adapter or automated
test exists.

### Question 2: Cursor Transcript Surfaces

**Q:** Which Cursor transcript surfaces should this project promise to make
reliable?
**A:** Use evidence-gated breadth.
**Decision:** Treat the current agent transcript as the supported baseline.
Background-agent or CLI stores and dotted-path variants may enter the supported
set only when sanitized live evidence establishes their identity, lifecycle,
and record shapes. Keep SQLite chat history out of scope unless discovery
establishes a concrete reliability need and sufficient evidence.

### Question 3: Live Completion Promise

**Q:** What completion promise should Session Observer make for active Cursor
turns?
**A:** Use a content-first boundary.
**Decision:** Stable substantive content must be observable without requiring a
Cursor lifecycle terminal. The observer must distinguish content that is safe
to present from confirmed lifecycle completion, suppress content known to be
aborted or replaced, and avoid presenting an optional terminal as the sole
definition of an assistant turn.

### Question 4: Continuity and Recovery

**Q:** What guarantee should apply when a Cursor transcript is repaired,
truncated, rotated, or resumed?
**A:** Require fail-visible continuity.
**Decision:** The observer must never silently skip or duplicate substantive
content. It may continue only when transcript and session continuity are
supported by sufficient evidence; otherwise it must pause or perform an
explicitly disclosed reset/replay with diagnostics rather than infer continuity.

### Question 5: Activity and Health Semantics

**Q:** How should active Cursor work affect engagement and watcher-health
reporting before completion?
**A:** Separate the activity states.
**Decision:** Live human input and provisional progress count as active
engagement, while content availability, lifecycle completion, and watcher
health remain distinct claims. Expected provisional activity must not make a
healthy watcher appear stale, and raw transcript growth alone must not prove
healthy or substantive progress.

### Question 6: Stateful Identity

**Q:** What identity standard should govern stateful Cursor observation and
automatic continuation?
**A:** Require exact evidence.
**Decision:** Stateful operations require confirmed project, session, and
transcript identity. Slug similarity, recency, and other weak matches may help
locate candidates but remain diagnostic until confirmed; they cannot inherit
offsets, switch a target, or authorize automatic continuation.

### Question 7: Wake Success Boundary

**Q:** Can this project succeed if correctness is proven but no stronger Cursor
wake surface validates?
**A:** Yes; correctness can ship independently.
**Decision:** Reliable observation is the required project outcome. Stronger
wake behavior is a later evidence-gated lane: if no stronger live path proves
effective, retain the conservative fallback and document the non-claim rather
than blocking otherwise proven correctness.

### Question 8: Evidence Standard

**Q:** What evidence bar should a Cursor reliability or wake capability claim
have to meet?
**A:** Require per-claim evidence.
**Decision:** Every supported Cursor transcript surface and capability claim
requires automated fixture coverage plus a repeatable, sanitized live probe.
Untested hosts, versions, stores, lifecycle paths, or wake surfaces must remain
explicitly unsupported or documented-but-unvalidated.

### Question 9: Compatibility Boundary

**Q:** How strongly should this project preserve the shipped v1 collaboration
contract?
**A:** Preserve the existing invariants.
**Decision:** Exact pinning, one-owner stateful offsets, the N=2 topology,
no-op suppression, local privileged authority, and fail-closed ambiguity remain
non-negotiable. Cursor reliability improvements may refine observation semantics
and evidence labels but cannot weaken these protocol guarantees.

### Question 10: Project Boundary

**Q:** Should observer correctness and stronger Cursor wake behavior split into
separate OAT projects?
**A:** Keep one project.
**Decision:** Use one sequential reliability project because both lanes consume
the same identity, completion, continuity, and evidence contract. Preserve a
valid shipping boundary after observation correctness so an unavailable or
unproven wake surface cannot block that core outcome.

### Question 11: Durable Evidence Privacy

**Q:** What transcript-content boundary should durable Cursor validation
evidence follow?
**A:** Persist structural evidence only.
**Decision:** Durable validation may retain event shapes, ordering, timing,
identity relationships, lifecycle classifications, and redacted placeholders.
Do not retain substantive transcript content in project artifacts, fixtures,
logs, or documentation.

## Solution Space

### Approach 1: Evidence-Gated Correctness First _(Recommended)_

**Description:** Define reliable observation around substantive content,
fail-visible continuity, exact identity, and distinct activity/completion/health
claims. Expand supported Cursor surfaces only from measured evidence, then
evaluate stronger wake behavior against the same contract.
**When this is the right choice:** When active collaboration must remain useful
without optional lifecycle terminals and public capability claims must be
repeatable and auditable.
**Tradeoffs:** Support expands more slowly, and some Cursor variants or wake
surfaces may remain explicitly unvalidated rather than receiving broad support.

### Approach 2: Lifecycle-Conservative Reliability

**Description:** Retain lifecycle terminals as the sole completion boundary and
focus the project on transcript discovery coverage, diagnostics, and capability
labeling.
**When this is the right choice:** When false completion is considered worse
than indefinitely buffering otherwise substantive live work.
**Tradeoffs:** It preserves the current conservative behavior but does not solve
the observed active-collaboration failure when terminals are absent or delayed.

### Approach 3: Provisional Streaming

**Description:** Surface Cursor messages as they appear, label them provisional,
and reconcile later lifecycle outcomes after the fact.
**When this is the right choice:** When lowest possible latency is the primary
goal and downstream consumers can tolerate retraction or replacement.
**Tradeoffs:** It creates the largest risk of exposing aborted or unstable
content, complicates continuity and wake suppression, and strains the existing
fail-closed protocol.

### Chosen Direction

**Approach:** Evidence-Gated Correctness First
**Rationale:** It solves the observed absence/delay of Cursor lifecycle
terminals while preserving exact identity, continuity, authority, and no-op
invariants. It also creates an honest shipping boundary before any stronger
wake capability is claimed.
**User validated:** Yes

## Options Considered

### Option A: Evidence-Gated Surface Coverage

**Description:** Support the existing agent transcript baseline and admit other
Cursor stores or path variants only from sanitized live evidence.
**Chosen:** Yes
**Summary:** This avoids speculative parsing and makes the supported surface
explicit without prematurely absorbing SQLite chat history.

### Option B: Content-First Completion

**Description:** Recognize stable substantive content independently from
optional lifecycle completion, while keeping the two claims distinct.
**Chosen:** Yes
**Summary:** This restores useful active collaboration without adopting an
unbounded provisional stream or falsely treating content as lifecycle-complete.

### Option C: Fail-Visible Continuity

**Description:** Continue only when session and transcript history can be
reconciled; otherwise pause or reset with an explicit diagnostic.
**Chosen:** Yes
**Summary:** This prioritizes no silent loss or duplication over uninterrupted
best-effort progress.

## Key Decisions

1. **Product direction:** Use evidence-gated correctness first, not
   terminal-only buffering or unrestricted provisional streaming.
2. **Completion semantics:** Substantive content may become observable without
   a lifecycle terminal, but observable content and confirmed lifecycle
   completion remain separate claims.
3. **Continuity:** Never silently lose or duplicate content; pause or visibly
   reset when session or transcript continuity cannot be proven.
4. **State truthfulness:** Engagement, content availability, lifecycle
   completion, and watcher health are distinct states.
5. **Identity:** Stateful observation and automatic continuation require exact
   project, session, and transcript evidence; weak matches remain diagnostic.
6. **Surface coverage:** Expand beyond the current agent transcript only from
   sanitized live evidence; do not infer support from similar stores or paths.
7. **Evidence:** Every supported surface or capability requires automated
   coverage and a repeatable sanitized live probe.
8. **Wake sequencing:** Observation correctness is the required shipping
   boundary. Stronger wake behavior is evaluated later and may remain an honest
   non-claim with conservative fallback.
9. **Compatibility:** Preserve the shipped N=2, exact-pin, one-owner cursor,
   no-op, local-authority, and fail-closed protocol invariants.
10. **Project shape:** Keep correctness and wake evaluation in one sequential
    project because they share the same observation contract.
11. **Privacy:** Persist structural validation evidence only; never durable
    substantive transcript content.

## Constraints

- Shipped skills remain dependency-free, require no install step, and use the
  Node.js standard library at runtime.
- Canonical behavior remains owned by TypeScript source with generated runtime
  outputs kept in sync; generated files are not independent authoring sources.
- Existing non-Cursor behavior and the shipped collaboration authority model
  must not regress.
- Configuration presence, automated tests, or CLI availability alone cannot
  promote a Cursor capability to live-validated.
- Ambiguous identity, continuity, completion, or wake evidence fails closed.
- Durable validation evidence contains structural and redacted data only.
- The accepted repository knowledge snapshot is stale by 233 changed files;
  current Cursor-specific claims must be verified from live source, tests, and
  focused probes rather than relying on that snapshot alone.

## Success Criteria

- Stable substantive Cursor content becomes observable during an active session
  without requiring an optional or delayed lifecycle terminal.
- Aborted, cancelled, errored, replaced, metadata-only, synthetic, replayed, or
  no-op activity cannot be promoted as a successful substantive completion or
  trigger automatic continuation.
- Transcript repair, malformed input, truncation, rotation, restart, and resume
  cannot cause silent content loss, duplication, or cursor inheritance across
  an unproven identity boundary.
- Engagement, content availability, lifecycle completion, buffering, and
  watcher health are reported distinctly and truthfully for long-running active
  Cursor work.
- Every stateful operation uses an exact confirmed identity and never
  auto-switches based on slug similarity, recency, or a newer candidate alone.
- Every claimed Cursor store, path variant, lifecycle behavior, or wake tier has
  automated coverage plus repeatable structural live evidence; all other
  surfaces remain explicit non-claims.
- A controlled collaboration acceptance run proves exact pinning, one bounded
  substantive follow-up, no-op and late-output suppression, restart/resume
  handling, and deterministic disarm/closeout without retaining message content.
- Observation correctness can complete and ship even when no stronger wake
  surface validates; the resulting fallback and capability labels remain
  accurate.
- Existing v1 collaboration invariants and supported non-Cursor observation
  behavior remain intact.

## Out of Scope

- N>2 collaboration, per-observer mesh namespaces, and shared-cursor ownership
  redesign.
- Shared session-log infrastructure, agent-to-agent direct messaging, work
  claiming, dependency orchestration, or a general collaboration daemon.
- Optional desktop, terminal-pane, supervisor, or idle-session application
  integrations.
- Cursor SQLite chat history unless later evidence establishes a concrete need
  and the project boundary is explicitly revised.
- Broad support claims for unmeasured Cursor hosts, versions, stores, or wake
  surfaces.
- Unrestricted provisional streaming with after-the-fact retraction as the
  primary observation contract.
- Marketplace, registry, hosted-search, or provider-propagation verification
  unrelated to Cursor observation correctness.

## Deferred Ideas

- **Safe N>2 mesh:** Deferred because it changes cursor ownership and topology
  rather than strengthening the existing N=2 Cursor path.
- **Idle-session integrations:** Deferred because they add platform-specific
  dependencies and authority surfaces; this project may establish prerequisites.
- **Shared log and direct messaging:** Deferred as separate initiative-scale
  collaboration substrate work.
- **Cursor in aggregate multi-runtime watch:** Revisit only if a concrete user
  need and identity model justify widening the existing aggregate runtime
  contract.
- **SQLite chat-history support:** Reconsider only with sanitized live evidence
  and an explicit product need.

## Open Questions

- **Content boundary:** What observable evidence establishes that substantive
  content is stable enough to present when no lifecycle terminal exists?
- **Continuity evidence:** What stable checkpoint proves continuity when parsed
  records are repaired or compacted, a transcript rotates, or a session ID
  appears under a different path?
- **State model:** How can activity, buffering, content availability,
  completion, and health remain distinct without breaking existing consumers?
- **Supported matrix:** Which Cursor host, version, agent-transcript,
  background-agent, CLI, and dotted-path variants can be reproduced and
  structurally evidenced during this project?
- **Candidate freshness:** How should old exact-history candidates coexist with
  newer candidates without recency becoming an automatic identity decision?
- **Identity collisions:** How should multiple transcript files sharing a
  conversation directory or session identifier be handled without guessing?
- **Live acceptance:** What repeatable controlled actions and timing evidence
  are sufficient to validate each claimed lifecycle and wake behavior?
- **Wake capability:** Which, if any, Cursor-native wake surface proves effective
  under interruption, user steering, recurrence limits, restart, and disarm?

## Assumptions

- Controlled Cursor sessions and host variants needed for live probes will be
  available during design or implementation.
- Cursor lifecycle terminals are optional or environment-dependent and cannot
  serve as the only live content boundary.
- The current agent-transcript JSONL surface remains the supported baseline
  while broader surfaces are evidence-gated.
- Structural evidence is sufficient to reproduce and review lifecycle,
  identity, continuity, and wake findings without retaining message content.
- The existing N=2 collaboration contract is the correct compatibility base.

## Risks

- **Premature content promotion:** A content-first boundary could expose
  assistant output that is still changing or later aborted.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Require explicit stability evidence, preserve outcome
    classification, and keep uncertain content non-substantive.
- **Offset discontinuity:** Repairing malformed records or changing transcript
  paths may shift logical positions and silently skip or duplicate content.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Make continuity independently verifiable and fail
    visibly whenever the prior checkpoint cannot be reconciled.
- **Identity collision or stale selection:** Weak path evidence, reused session
  identifiers, or old exact histories may select the wrong Cursor session.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Require exact corroborated identity for stateful use
    and keep freshness signals advisory.
- **False health reporting:** Expected provisional activity may appear stuck,
  while raw file growth may appear healthy without substantive progress.
  - **Likelihood:** High
  - **Impact:** Medium
  - **Mitigation Ideas:** Keep polling, activity, content, and completion states
    distinct and evidence-based.
- **Synthetic confidence:** Extensive fixture coverage may be mistaken for live
  Cursor support across hosts or versions.
  - **Likelihood:** High
  - **Impact:** High
  - **Mitigation Ideas:** Enforce per-claim live evidence and explicit
    documented-but-unvalidated labels.
- **Wake loops or authority confusion:** Stronger continuation could replay
  automatic controls, bypass user steering, or act on uncertain completion.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Preserve local authority, no-op suppression, exact
    pins, bounded counts, expiry, and deterministic disarm.
- **Scope expansion:** Transcript-store coverage, wake behavior, N>2, idle
  integrations, and shared collaboration infrastructure may blur together.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Keep the chosen correctness boundary and explicit
    defer list; split only if a lane loses the shared observation contract.

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
