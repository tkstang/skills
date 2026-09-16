# Skills Repo Roadmap

**Last updated:** 2026-09-16
**Status:** Post-PR #83 roadmap proposal. Consensus Review is the user-selected high-priority feature. The immediate kickoff order and capacity await operator confirmation; the linked [July priority alignment](backlog/reviews/priority-alignment.md) is historical, pending refresh.

## Planning model

The [current-state snapshot](current-state.md) records merged capability; this page records direction, not delivery claims. Each active item appears below. The [full review](backlog/reviews/backlog-and-roadmap-review.md) explains value, effort, dependencies, and implementation evidence.

Completed source colocation, Session packaging, skill promotion, docs IA/visuals, and typed configuration documentation are not future roadmap items. Keep historical release and completion evidence in [completed history](backlog/completed.md) and [RELEASING.md](../../../RELEASING.md).

## Now

### Reliability and bounded review

- **BL-260916-session-observer-re-armed — Investigate observer re-arm catch-up and suspected unread-record gaps.** Recommend a bounded reproduction first. Establish whether a renderable peer message is lost across termination/restart; filtered raw-index gaps alone do not prove it. Existing catch-up and Monitor guidance must be accounted for before changing runtime.
- **BL-260916-add-consensus-review-cross — Add consensus-review: cross-model review of a bounded scope.** Next high-priority feature: one dispatched read-only reviewer invocation with explicit scope/provenance, owned JSON output, and an OAT-compatible Markdown adapter. New reviewer defaults belong in its own config key. Different provider does not guarantee different model family. Unsupported read-only policy must not be silently weakened.

The observer investigation is recommended scheduling, **not a technical prerequisite** for Review. Review does not wait on convergence settings or helper extraction.

### Optional independent onboarding lane

- **BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills.** Pinned generated payloads, project-scope destinations, integrity/error handling, and install documentation. Confirm spare capacity before opening this lane; multi-host/live acceptance is more than a copy script.

Release/discovery verification for already-merged distributions can proceed independently under the existing release checklist. This planning pass does not authorize installation, publication, or paid provider calls.

## Next

### Consensus correctness and maintainability

- **BL-260916-honor-configured-peer-models — Honor configured peer models and effort in convergence workflows.** Documentation is merged; fix propagation and supported resume behavior across five wrappers, then update the limitation in the same shipping change. Reserved roles and per-skill defaults are outside scope.
- **BL-260723-make-remaining-consensus-loop — Make remaining consensus-loop write sites atomic.** Small independent crash-safety change with existing helper/failure-test patterns.
- **BL-260723-split-loop-free-cli-helpers — Split loop-free cli-helpers core for panel sharing.** Optional preparation for Review or later shared cleanup; not a blocker. Serialize shared Consensus source/output edits or integrate after rebasing.
- **BL-260723-investigate-live-submit — Investigate live submit verdict-source contract mismatch.** Keep the diagnosis visible; live observation needs a separately approved bounded provider run. Rebase the September 7 plan to current source paths and effective policy before executing it.

### Provider-neutral collaboration and evidence

- **BL-260619-inter-agent-direct-messaging — Inter-agent direct messaging (addressable, prioritized).** Project/worktree recipient inboxes, exact runtime/session identity and aliases, IDs/acknowledgments/deduplication, and bounded continuation. Define concurrency and acknowledgment semantics; no daemon, harness-specific transport requirement, or second wake path.
- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter.** Separate design/build project using the retained research packet: detailed record locations, native call/result correlation, coverage states, privacy, and unchanged conversation defaults. It is not bundled into Review or messaging.

Messaging may precede fidelity. Coordinate shared observer/collaboration files and identity/state conventions, not an invented merged-log dependency.

## Later

### Merged evidence and stateful scale

- **BL-260619-shared-session-log-substrate — Stateless multi-session activity merge.** Depends on the session-fidelity activity contract. Deterministic provenance-preserving merge over exact pins; timestamps are ordering hints, not causal proof. No daemon/registration in v1 and no mutation of another consumer's offsets.
- **BL-260713-per-observer-offsets-and-safe — Per-observer offsets and safe N>2 collaboration mesh.** Separate design for consumer namespaces, ownership, locking/CAS, replay, and recovery. Neither inboxes nor a stateless view satisfy it.
- **BL-260713-optional-idle-session — Optional idle-session application integrations.** Evidence-gated, opt-in assistance outside the dependency-free core. Queued inbox content does not imply ability to wake an idle host.

### Deliberation quality and research

- **BL-260612-add-consensus-research-skill — Add consensus-research skill (investigate question, synthesized findings).** Retain the tool-permission/evidence-provenance decision gate before build. Review is not this research workflow.
- **BL-260612-add-deliberation-metrics — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts.** Inventory available provider signals, then resume-safe aggregation; unavailable is explicit, never invented cost.
- **BL-260612-add-similarity-heuristic — Add similarity heuristic for near-converged deliberation states.** Usage-gated measured scoring, not a rename of existing agency/double-ACCEPT behavior. Metrics-first is useful sequencing, not a hard dependency.
- **BL-260612-add-whole-document — Add whole-document harmonization pass after section convergence.** Design the context/default boundary and Refine fan-in/resume integration before implementation.
- **BL-260701-add-multi-round-panel — Add multi-round panel discussion.** Product distinction already decided: optional, attributed, non-converging. Build only with usage evidence that single-round breadth is inadequate.

These remain open, not abandoned. Moving them behind immediate workflow needs replaces the July research/loop-quality kickoff recommendation; it does not declare their acceptance criteria complete.

### Reserved capabilities

- **BL-260619-define-host-native-dispatch — Define host-native dispatch / safe-packet protocol (reserved seam).** Concrete demand and reviewed go/no-go first; the shipped capability remains false.
- **BL-260619-multi-peer-3-deliberation — Multi-peer (3+) deliberation extension (reserved / v3+ concern).** Panel breadth is not group convergence. Require evidence that two-peer convergence is insufficient.

## Uncommitted follow-up ideas

Per-workflow defaults and activation of reserved roles are known config limitations, not hidden scope in the peer-model fix. Strict required submission, extra transcript providers, typed-test-fixture polish, and broader orchestration remain ideas unless separately captured. Do not turn historical notes or a diagram into implementation commitments.
