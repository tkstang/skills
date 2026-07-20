---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-07-20
oat_generated: false
oat_template: false
---

# Specification: cursor-collaboration-reliability

## Problem Statement

Session Observer currently treats Cursor's optional `turn_ended` lifecycle
record as the boundary that makes assistant content visible. Discovery records
prior live-session evidence that substantive text can be present while the
observer continues to report no completed content, but the repository does not
yet contain a sanitized repeatable probe for that observation. Reproducing and
durably recording the structural evidence is therefore part of this project's
acceptance boundary, not an already promoted support claim.

Relaxing the terminal requirement without a stronger observation contract
would create the opposite failure: provisional, replaced, aborted, synthetic,
or ambiguous content could be presented as a completed peer response. Cursor
transcript repair, malformed lines, truncation, rotation, weak path matching,
and multiple consumers also expose ways for the current high-water accounting
to silently skip, duplicate, or inherit content across the wrong identity.

This project makes Cursor observation reliable by separating prefix-stable
content availability from lifecycle completion, requiring exact stateful
identity and fail-visible continuity, and keeping engagement, activity,
content, completion, and watcher health as distinct claims. Reliable
observation is the required shipping boundary. Broader Cursor transcript
surfaces and stronger wake behavior are evaluated only from automated and
sanitized live evidence and may remain explicit non-claims without blocking
the correctness outcome.

## Goals

### Primary Goals

- Make structurally stable, substantive Cursor assistant records observable
  during an active session without waiting indefinitely for an optional
  lifecycle terminal, while explicitly withholding semantic finality.
- Preserve a separate, stricter lifecycle-completion boundary for automatic
  continuation and other completion-sensitive consumers.
- Prevent silent loss, duplication, replay, or cursor inheritance when a
  transcript is malformed, repaired, truncated, rotated, replaced, or resumed.
- Require exact project, runtime, session, and transcript evidence for every
  stateful observation or continuation action.
- Report engagement, transcript activity, content availability, lifecycle
  completion, buffering, and watcher health truthfully and independently.
- Preserve the shipped N=2 collaboration, one-owner cursor, exact-pin, no-op,
  local-authority, and fail-closed invariants.

### Secondary Goals

- Inventory Cursor transcript-store and path variants, promoting only the
  variants supported by both fixture coverage and sanitized live evidence.
- Evaluate the existing Cursor lifecycle adapter and candidate stronger wake
  surfaces, including a bounded deterministic scheduled observer, without
  requiring any wake tier to validate for the project to ship.
- Leave repeatable structural probe records that future Cursor versions can be
  checked against without retaining conversation prose.

## Non-Goals

- N>2 collaboration, per-observer mesh namespaces, or shared-cursor ownership
  redesign.
- A general collaboration daemon, shared session log, direct agent messaging,
  work claiming, dependency orchestration, or message bus.
- A long-running LLM that polls another session on a timer.
- Desktop, terminal-pane, supervisor, or idle-session application integration
  unless a separately proven runtime callback is explicitly promoted later.
- Cursor SQLite chat-history support without a separately approved scope change
  backed by a concrete reliability need and sanitized live evidence.
- Broad Cursor support claims inferred from a directory, CLI, hook, feature
  flag, automated test, or documentation alone.
- Unrestricted token-by-token or fragment streaming with after-the-fact
  retraction as the observation contract.
- Marketplace, registry, hosted-search, or unrelated provider-propagation work.

## Requirements

### Functional Requirements

**FR1: Exact Cursor Surface and Identity Resolution**

- **Description:** Resolve the supported Cursor agent-transcript baseline and
  bind stateful work to one exact runtime, project/cwd, session, and canonical
  transcript path.
- **Acceptance Criteria:**
  - Direct, corroborated path and session evidence can select the current
    agent transcript.
  - Slug similarity, recency, file name similarity, and fallback candidates
    remain diagnostic evidence and cannot inherit state or auto-switch a pin.
  - Missing, conflicting, duplicate, or changed identity evidence produces a
    structured fail-visible outcome before an offset or lease is used.
- **Priority:** P0

**FR2: Content-First Cursor Observation**

- **Description:** Surface prefix-stable substantive assistant content without
  requiring `turn_ended`, while labeling it separately from lifecycle
  completion.
- **Acceptance Criteria:**
  - A syntactically closed Cursor JSONL record becomes content-available only
    after a second observation, separated by the configured stability/debounce
    interval, verifies that its exact raw prefix is unchanged; lifecycle remains
    pending.
  - Partial, malformed, metadata-only, tool-only, synthetic-control, empty, and
    already-known non-success content is not surfaced as substantive assistant
    content.
  - Every structurally stable substantive source record in the consumed range
    is rendered or explicitly retained as recoverable; normal delivery does not
    silently discard earlier records from the same open turn.
  - Each entry has a deterministic source key. Normal operation does not repeat
    it; a crash-ambiguous replay is labeled with the same key rather than
    presented as a new entry.
  - Content-available output is explicitly distinguishable from a successful
    completed peer turn.
- **Priority:** P0

**FR3: Lifecycle Reconciliation and Completion Eligibility**

- **Description:** Reconcile Cursor terminal outcomes independently from
  content visibility and retain terminal success as the automatic-continuation
  boundary.
- **Acceptance Criteria:**
  - `success` identifies one completed turn and its final substantive assistant
    record without duplicating content already observed.
  - `aborted`, `error`, `cancelled`, and unknown terminal outcomes emit a
    diagnostic, mark the turn non-successful, and never become continuation
    eligible.
  - Content that was honestly shown as lifecycle-pending before a later
    non-success terminal remains a historical pending observation; the terminal
    diagnostic explicitly records that it never became a successful completion.
  - An open turn may report content availability but cannot trigger automatic
    continuation or spend continuation budget.
  - Replayed automatic controls, acknowledgements, status echoes, no-op turns,
    and runtime diagnostics remain non-triggering.
- **Priority:** P0

**FR4: Fail-Visible Transcript Continuity**

- **Description:** Verify that every persisted Cursor cursor still refers to
  the same append-only transcript prefix before consuming new records.
- **Acceptance Criteria:**
  - Cursor accounting preserves stable physical frame positions even when a
    line is malformed or partially written.
  - Path/session mismatch, transcript shrink, prefix mutation, in-place
    replacement, unsupported rotation, or legacy unverified state pauses
    consumption with a structured continuity diagnostic.
  - Recovery requires an explicit reset/replay action; the observer never
    silently resets to zero, jumps to the tail, or carries an offset across an
    unproven identity boundary.
  - A repaired blocking frame can resume from the last verified checkpoint
    without losing or duplicating later content.
- **Priority:** P0

**FR5: Truthful Activity and Health State**

- **Description:** Represent engagement, activity, content availability,
  lifecycle, buffering, and watcher health as independent evidence-backed
  fields.
- **Acceptance Criteria:**
  - Human input and provisional progress count as activity without implying
    content availability or completion.
  - A healthy poll with no substantive delta is distinguishable from idle work,
    stale health, blocked continuity, and a filtered/no-op delta.
  - Heartbeats and status output report poll health, records behind, buffering,
    and the latest known lifecycle without presenting raw growth as progress.
  - Existing consumers receive compatible defaults for fields they do not yet
    understand.
- **Priority:** P0

**FR6: Atomic, Idempotent Observer Accounting**

- **Description:** Persist the next unread Cursor position and continuity
  checkpoint atomically for the single owning observer.
- **Acceptance Criteria:**
  - State updates remain lock-protected, atomic, crash-safe, and idempotent.
  - Cursor advancement uses an expected-checkpoint CAS and a metadata-only
    pending-delivery record so a crash cannot silently convert un-emitted output
    into consumed state.
  - Concurrent watchers cannot own the same exact target; the losing watcher
    acquires no delivery reservation and cannot consume, restore, or strand the
    winner's range.
  - Restart and catch-up resume at the last verified boundary with no silent
    duplicate or skipped substantive entry; an output/commit crash window is
    reported as delivery-uncertain and may replay only with the original entry
    keys.
  - Content-observation and completion-sensitive cursors cannot accidentally
    advance one another.
- **Priority:** P0

**FR7: Reliable Foreground Watch Behavior**

- **Description:** Preserve bounded foreground watch semantics while applying
  the new Cursor content, continuity, and health model.
- **Acceptance Criteria:**
  - Baseline establishment is explicit; strict baseline refuses an unread gap,
    and catch-up-then-watch closes the setup gap.
  - Debounce and maximum-pending behavior coalesce deterministic deltas without
    converting partial or blocked records into content.
  - Newer same-cwd candidates produce a diagnostic while the watcher remains on
    its exact pin.
  - Pause, resume, stop, signal cleanup, maximum runtime, and quiet-heartbeat
    behavior leave no stale watcher ownership.
- **Priority:** P0

**FR8: Safe Collaboration Completion Contract**

- **Description:** Keep collaboration continuation on a private,
  completion-sensitive cursor and preserve all v1 authority and topology
  invariants.
- **Acceptance Criteria:**
  - Only one contiguous, terminal-successful, substantive completed peer range
    under an exact active lease can emit a synthetic wake envelope.
  - Pending content, failure diagnostics, replay, metadata, no-op output, and
    automatic controls may advance only the appropriate safe cursor and never
    spend continuation budget.
  - Lease identity, index-base, cursor, count, expiry, loop, CAS, and disarm
    checks fail closed.
  - Reliable observation can ship while Cursor continuation remains
    documented-but-unvalidated or falls back to manual catch-up.
- **Priority:** P0

**FR9: Evidence-Gated Cursor Coverage**

- **Description:** Maintain a support matrix for Cursor stores, path variants,
  record shapes, lifecycle behaviors, and capability tiers.
- **Acceptance Criteria:**
  - Every supported row has sanitized fixtures, automated coverage, and a
    repeatable structural live probe on a named host/runtime version.
  - Current agent-transcript JSONL is the baseline; background-agent, CLI,
    dotted-slug, and other variants are promoted individually only when their
    identity and record shapes are measured.
  - Unavailable or partially probed rows remain unsupported or
    documented-but-unvalidated with the missing evidence stated.
  - Durable evidence records contain structure, ordering, timing, versions,
    redacted identifiers, and outcomes, but no substantive transcript prose.
- **Priority:** P1

**FR10: Evidence-Gated Stronger Wake Evaluation**

- **Description:** Evaluate Cursor lifecycle continuation and stronger
  harness-native or scheduled wake surfaces after observation correctness is
  proven.
- **Acceptance Criteria:**
  - This requirement is satisfied by an evidence-backed tier decision; it does
    not require shipping a new scheduler, worker, or wake adapter.
  - The evaluation distinguishes event-wake, lifecycle-continuation,
    scheduled-poll, and buffered-manual tiers using effective live behavior.
  - If a deterministic scheduled observer is selected for a later
    implementation, it uses an exact private cursor and bounded cadence, expiry,
    event count, cancellation, and cost; it is not a periodically invoked LLM.
  - A surface is implemented or promoted only if a future notification reaches
    the same pinned parent conversation and passes substantive/no-op,
    interruption, recurrence, restart, late-output, and disarm probes.
  - If no stronger surface validates, the project records the non-claim and
    retains the conservative fallback without blocking completion.
- **Priority:** P1

### Non-Functional Requirements

**NFR1: Fail-Closed Security and Authority**

- **Description:** Observation and automatic controls must not widen local
  authority or act on ambiguous evidence.
- **Acceptance Criteria:**
  - Auto-discovered transcript paths are canonicalized and constrained to the
    supported local store; identity or path ambiguity stops stateful work.
  - Synthetic controls remain provenance-bearing non-human input and cannot
    authorize privileged work or recursively trigger themselves.
  - The observer reads transcripts and writes only owner-local state/evidence;
    it does not mutate provider transcripts or inject directly into a peer.
- **Priority:** P0

**NFR2: Privacy-Preserving Evidence and State**

- **Description:** Minimize retained transcript-derived data and prevent prose
  from entering durable project evidence.
- **Acceptance Criteria:**
  - Fixtures, logs, documentation, and live probe artifacts use synthetic or
    redacted placeholders.
  - Local state stores only the identity, cursor, structural checkpoint, and
    status needed for continuity; state directories/files use owner-only
    permissions where supported.
  - Event logs and diagnostics never persist substantive peer prose.
- **Priority:** P0

**NFR3: Backward Compatibility**

- **Description:** Preserve supported Claude Code, Codex, non-Cursor observer,
  and existing collaboration behavior unless a versioned migration explicitly
  changes a contract.
- **Acceptance Criteria:**
  - Existing non-Cursor fixture and integration suites remain green.
  - Cursor state/index schema changes are versioned and legacy Cursor offsets
    are not silently trusted.
  - Existing lifecycle consumers can select the terminal-success projection
    during migration.
- **Priority:** P0

**NFR4: Dependency-Free Shipped Runtime**

- **Description:** Keep shipped skills install-free and based only on Node.js
  standard library APIs.
- **Acceptance Criteria:**
  - Canonical TypeScript remains the source for generated transcript runtime
    changes; committed generated outputs pass drift checks.
  - No runtime package dependency or service is added.
  - Every changed shipped skill receives the required synchronized version
    bump and provider-mirror refresh.
- **Priority:** P0

**NFR5: Bounded Resource Use**

- **Description:** Keep polling, continuity verification, rendering, and any
  continuation attempt deterministic and bounded.
- **Acceptance Criteria:**
  - Unchanged watcher polls use metadata checks and do not reparse or rehash the
    transcript.
  - Changed transcripts are processed in a bounded, streaming manner without a
    second unbounded content copy.
  - Existing digest limits, watcher runtime controls, and collaboration lease
    limits remain effective.
- **Priority:** P1

**NFR6: Reproducible Verification**

- **Description:** Make every public Cursor reliability claim independently
  reviewable.
- **Acceptance Criteria:**
  - Automated fixture tests cover every state transition and failure boundary.
  - Controlled live probes record commands, versions, sanitized structural
    observations, and expected versus actual outcomes.
  - Documentation labels automated-only, live-validated, unavailable, and
    documented-but-unvalidated evidence distinctly.
- **Priority:** P0

## Constraints

- Shipped skills require Node.js 22 or newer, use only standard library APIs at
  runtime, and require no install step.
- Canonical transcript behavior is authored in TypeScript under `src/` and
  generated into committed runtime output; generated files are not independent
  authoring sources.
- Collaboration runtime modules remain dependency-free authored JavaScript and
  use a separate owner-local private cursor/lease store.
- The N=2 topology, one owner per stateful cursor, exact pins, no-op
  suppression, local privileged authority, and fail-closed ambiguity are fixed
  compatibility constraints.
- Configuration presence, automated tests, CLI availability, and product
  documentation are insufficient to claim live capability support.
- The accepted repository knowledge snapshot predates substantial source
  changes; source, focused tests, and new sanitized probes are authoritative.
- Durable project artifacts must not contain substantive transcript content.

## Dependencies

- Existing Cursor agent-transcript JSONL access under the user's local Cursor
  project store.
- Session Observer's transcript adapters, locate/rank pipeline, digest builder,
  atomic state store, foreground watcher, and generated-runtime build.
- Session Observer Collaboration's exact lease, completion selector, runtime
  adapters, and synthetic wake envelope.
- Vitest fixture/integration suites and controlled Cursor sessions for live
  identity, lifecycle, interruption, and store-shape probes.
- Fumadocs user and engineering documentation for the support matrix and
  capability labels.

## High-Level Design (Proposed)

Use the evidence-gated correctness-first approach confirmed in discovery. Add
a Cursor-specific framed transcript read and turn analysis that preserves
physical source positions, distinguishes prefix-stable content availability
from terminal completion, and produces explicit activity/content/lifecycle
status. The ordinary observer uses idempotent keyed delivery with a visible
uncertain state for the unavoidable output/commit crash window.
Completion-sensitive collaboration uses a separate projection and private
cursor that remains terminal-success-only.

Before reusing a persisted Cursor cursor, validate exact identity and an
append-only prefix checkpoint. Any unverified legacy state, path change,
shrink, repair behind the checkpoint, or replacement becomes a structured
pause requiring explicit reset/replay. Thread the resulting state through
digest and foreground-watch output without changing the meaning of health or
completion. Broader store support and stronger wake tiers are conditional
evidence phases, not prerequisites for shipping the observation core.

**Key Components:**

- **Cursor framed transcript reader** — preserves closed, malformed, and
  partial physical frames and supplies continuity material.
- **Cursor turn analyzer** — projects prefix-stable content separately from
  terminal-success completion and failure diagnostics.
- **Exact identity and continuity guard** — validates candidate identity,
  canonical path, index base, and append-only prefix before cursor reuse.
- **Cursor-specific state and versioned digest projection** — persists verified
  frame accounting without changing legacy non-Cursor state semantics and
  reports independent activity/content/lifecycle/health fields.
- **Foreground watcher integration** — preserves baseline, debounce,
  ownership, heartbeat, and deterministic cleanup semantics.
- **Completion-sensitive collaboration adapter** — consumes only confirmed
  completed ranges through a private bounded lease cursor.
- **Evidence and capability matrix** — gates surface and wake claims on
  automated plus sanitized live proof.

**Alternatives Considered:**

- **Terminal-only observation** — rejected because it preserves the live
  collaboration failure that initiated the project.
- **Unrestricted provisional streaming** — rejected because it conflates
  fragments with stable records, complicates retraction, and weakens the
  completion/authority boundary.
- **Background LLM polling** — rejected because observation is deterministic,
  repeated model invocation adds cost and authority ambiguity, and polling does
  not itself prove same-session wake delivery.
- **Automatic reset on shrink or path change** — rejected because it can hide
  loss, duplication, or cross-session cursor reuse.

## Success Metrics

- A synthetic Cursor acceptance fixture and sanitized live probe surface a
  structurally stable substantive assistant record before `turn_ended` while
  labeling lifecycle as pending. Synthetic fixture prose is fictional and live
  prose is replaced by structural placeholders.
- Terminal success, abort, error, cancellation, unknown outcome, malformed
  frame, partial tail, repair, truncation, replacement, and rotation tests all
  produce the specified non-ambiguous states with no silent loss or duplicate
  prose.
- Controlled restart/catch-up and duplicate-watcher runs deliver every
  substantive source record without silent loss; a forced crash-window replay
  is explicitly labeled delivery-uncertain with stable entry keys.
- Exact-pin, no-op, synthetic-control, late-output, bounded continuation, and
  deterministic disarm acceptance rows remain green.
- All existing non-Cursor session-observer and collaboration tests pass.
- Every supported Cursor surface/capability row has both automated and
  sanitized live evidence; missing rows remain explicit non-claims.
- The project can be marked complete with reliable observation and a truthful
  buffered-manual fallback even if no stronger Cursor wake surface validates.

## Requirement Index

| ID | Description | Priority | Verification | Planned Tasks |
| --- | --- | --- | --- | --- |
| FR1 | Resolve and persist exact Cursor surface identity | P0 | unit + integration: direct/fallback identity, collisions, path mismatch | See plan.md |
| FR2 | Surface prefix-stable Cursor content before terminal | P0 | unit + e2e: two-scan stability, partial/malformed and pending lifecycle | See plan.md |
| FR3 | Reconcile lifecycle separately and gate completion | P0 | unit + integration: success/failure/pending/automatic-control matrix | See plan.md |
| FR4 | Verify continuity and require explicit recovery | P0 | unit + integration: repair, shrink, replacement, rotation and replay | See plan.md |
| FR5 | Report independent activity/content/lifecycle/health | P0 | unit + e2e: state transition and heartbeat matrix | See plan.md |
| FR6 | Persist atomic idempotent observer accounting | P0 | unit + integration: CAS reservation, crash recovery, concurrency and cursor separation | See plan.md |
| FR7 | Preserve reliable bounded foreground watch behavior | P0 | integration: baseline, debounce, candidate warning and cleanup | See plan.md |
| FR8 | Preserve terminal-only bounded collaboration completion | P0 | integration + e2e: exact lease, contiguous range, no-op and disarm | See plan.md |
| FR9 | Gate Cursor surface support on per-row evidence | P1 | manual + integration: capability matrix and sanitized probes | See plan.md |
| FR10 | Evaluate stronger wake without making it a ship blocker | P1 | manual + e2e: same-parent callback, interruption, restart and fallback | See plan.md |
| NFR1 | Fail closed without widening authority | P0 | unit + manual: unsafe path, ambiguity and synthetic provenance | See plan.md |
| NFR2 | Retain structural state/evidence without prose | P0 | unit + manual: artifact scan and owner-only state | See plan.md |
| NFR3 | Preserve versioned backward compatibility | P0 | integration: non-Cursor regression and state/schema migration | See plan.md |
| NFR4 | Keep shipped runtime dependency-free and generated in sync | P0 | integration: build check, validation and skill versions | See plan.md |
| NFR5 | Keep changed-file processing and all waits bounded | P1 | perf + integration: unchanged poll, changed transcript and lease bounds | See plan.md |
| NFR6 | Make capability evidence reproducible and honest | P0 | manual + integration: fixtures, probe records and support labels | See plan.md |

## Open Questions

- **Content presentation:** Is prefix-stable, lifecycle-pending assistant text
  after one unchanged debounce interval the right user-facing boundary, given
  that it may later receive a non-success terminal and remain visible only as a
  historical pending observation?
- **Cursor matrix:** Which Cursor desktop/CLI/background-agent versions and
  stores will be available for sanitized implementation-time probes?
- **Wake investment:** After the correctness boundary passes, should the
  project spend its optional wake phase first on the existing Stop hook, a
  managed local subagent/`subagentStop` route, or a deterministic scheduled
  observer callback?
- **State migration ergonomics:** Is an explicit one-time Cursor state reset and
  replay acceptable when upgrading from legacy unverified offsets?

## Assumptions

- Cursor agent-transcript JSONL records are append-oriented. A
  newline-terminated parseable record is only a stability candidate; a second
  observation after the configured interval must verify its exact prefix before
  it becomes content-available, and a new live probe must validate this policy.
- Controlled Cursor sessions needed for the baseline live probe will be
  available during implementation.
- The current agent-transcript store remains the baseline even if broader
  stores cannot be reproduced.
- Automatic continuation continues to require terminal success even after
  ordinary content observation becomes content-first.
- Structural and redacted evidence is sufficient to review identity, ordering,
  continuity, and wake behavior without retaining prose.

## Risks

- **Record-stable content is mistaken for a final answer:** A closed assistant
  record may be followed by more work or a non-success terminal.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Label lifecycle-pending content explicitly, deliver each
    record once, and keep completion-sensitive consumers terminal-only.
- **Continuity checks are either too weak or too expensive:** Weak checks can
  miss a rewrite; naive full rereads can add latency on large transcripts.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Use streaming prefix verification only when file metadata
    changes, retain an in-process watcher cache, and fail visibly on unsupported
    cases.
- **Identity collision or stale selection:** Similar slugs or reused session
  identifiers may point at the wrong file.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Require corroborated canonical path/cwd/session evidence
    for stateful use and keep fallback candidates diagnostic.
- **Schema migration causes replay friction:** Refusing legacy Cursor offsets
  can require one explicit replay.
  - **Likelihood:** High
  - **Impact:** Medium
  - **Mitigation:** Preserve a backup, emit an exact recovery command, and keep
    non-Cursor state migration automatic.
- **Synthetic confidence from fixtures:** Comprehensive automated coverage can
  be mistaken for live provider support.
  - **Likelihood:** High
  - **Impact:** High
  - **Mitigation:** Enforce per-row live evidence and explicit evidence labels.
- **Wake evaluation expands authority or scope:** A background or managed agent
  may introduce a new executor without proving parent-session delivery.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Keep polling deterministic and private-cursor, require a
    same-parent live callback probe, and retain buffered-manual fallback.

## References

- Discovery: `discovery.md`
- Knowledge Base: `.oat/repo/knowledge/project-index.md`
- Current architecture: `.oat/repo/knowledge/architecture.md`
- Cursor runtime evidence: `skills/session-observer-collab/references/runtime-cursor.md`
- Related backlog: `BL-260713-cursor-transcript-store`,
  `BL-260713-stronger-cursor-collaboration`
