---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-07-12
oat_generated: false
---

# Discovery: session-observer-collab

## Phase Guardrails (Discovery)

- Capture the supplied collaboration packet as the implementation source of truth.
- Define the v1 boundary and the relationship between the existing observer and the new collaboration layer.
- Do not change runtime code during quick-start planning.

## Initial Request

Improve the existing `session-observer` skill using failures observed during a real Claude Code/Codex/Cursor collaboration run, and add a sibling `session-observer-collab` skill that lets a user and two coding-agent sessions collaborate through mutual observation. The copied packet under `references/` is authoritative: `prompt.md` defines the deliverables, `acceptance-matrix.md` defines proof, and the runtime notes/prototype are supporting evidence rather than canonical source.

## Clarifying Questions

No blocking clarification is required. The handoff explicitly defines the product boundary, canonical source, required runtime behavior, validation matrix, and deferred-work policy. The user requested discovery, lightweight design, and planning from that packet.

## Solution Space

### Approach 1: Extend the observer and add a compositional protocol layer _(Chosen)_

Keep transcript parsing, normalization, identity, offsets, and watch behavior in the existing TypeScript-backed `session-observer`. Add `session-observer-collab` as a sibling skill that invokes the base CLI and owns only collaboration protocol, capability selection, runtime-specific lifecycle adapters, lease/control operations, and closeout. This matches the handoff, preserves one observer implementation, and gives runtime adapters a clear boundary.

### Approach 2: Put collaboration behavior into the base observer

This would reduce the number of skills but mix transcript mechanics with higher-level authority, consensus, pause, and multi-agent workflow policy. It would also make normal one-way observation carry lifecycle-hook complexity. Rejected because the packet explicitly requires composition and prohibits reimplementing the CLI.

### Approach 3: Build a separate collaboration service

A daemon or message-bus architecture could offer stronger wake behavior and eventually support N>2 full mesh. It is a larger application-level integration, conflicts with the dependency-free/install-free v1 posture, and overlaps existing backlog initiatives. Rejected for v1; optional application integrations remain future tier upgrades.

### Chosen Direction

Ship the compositional two-layer design. Implement required base improvements 1.1 through 1.9, create the N=2 collaboration skill and its runtime adapters/control surface, and treat per-observer namespaces (Part 1.10) and other intentionally deferred capabilities as concrete file-backed backlog follow-ups rather than expanding v1.

## Options Considered

- **N=2 versus N>2:** scope v1 to user plus two mutually observing agents. Document ring, hub, and stateless-review shapes for additional participants; do not claim safe full mesh without consumer-scoped offsets and locks.
- **Runtime-neutral versus harness-native wake behavior:** keep the core capability ladder runtime-neutral while shipping one load-on-demand reference per supported harness. Harness-native mechanisms are first-class; terminal supervisors and pane-injection services are optional integrations.
- **Automatic session switching:** emit neutral newer-session candidates but never auto-switch a pin without confirmation.
- **Cursor readiness:** implement and test terminal buffering and the documented continuation contract, but keep continuation labeled documented-but-unvalidated until the live matrix passes.
- **User truncation:** prefer complete user messages; if a hard cap remains, require an exact transcript path and zero-based record recovery pointer.

## Key Decisions

- `prompt.md` is the authoritative implementation brief and `acceptance-matrix.md` is the complete definition of done.
- Canonical observer changes land under `src/transcript/session-observer/`; generated `.mjs` files are regenerated with the repository build and never hand-edited.
- `session-observer-collab` composes with the base CLI and does not duplicate transcript operations.
- The skill owns runtime-neutral protocol plus exactly one runtime reference selected after runtime resolution.
- Control scripts own idempotent install/status/arm/disarm/prune flows; users do not normally hand-edit leases.
- Synthetic `session_observer_wake` envelopes render as automatic hook/control input and carry no human authority.
- Every runtime announces the strongest wake tier actually proven: event-wake, lifecycle-continuation, scheduled-poll, or buffered-manual.
- Codex lifecycle continuation uses a trusted static Stop hook plus bounded per-session XDG lease; Cursor continuation remains documented-but-unvalidated until live proof succeeds.
- Required v1 behavior includes queued Claude input, quiet empty deltas, fail-closed `whoami`, baseline-gap detection, newer-session warnings, truncation recovery, synthetic wake normalization, and Cursor terminal buffering.
- Part 1.10 per-observer namespaces are deferred unless implementation evidence makes them low-risk; every deferral becomes a file-backed backlog item before closeout.

## Constraints

- Node.js 22+; shipped skills remain dependency-free and install-free.
- Preserve backward compatibility for existing observer CLI behavior.
- Keep top-level and metadata skill versions synchronized and bump every changed canonical skill.
- Add new skills to release version-bump tooling and refresh user/provider mirrors only according to the repository's post-merge/dogfooding rules.
- Serialize commands that mutate generated assets when multiple agents share a worktree.
- Do not copy live session state, secrets, unsanitized leases, or machine-specific identifiers from the prototype packet.
- Never use harness magic instruction filenames such as `claude.md` or `CLAUDE.md` for runtime references.
- Distinguish documented behavior from live-validated behavior in code, tests, docs, and handoff claims.

## Success Criteria

- Base observer behavior passes every row in the packet's Base `session-observer` matrix across review, catch-up, and watch paths where applicable.
- The new skill provides a reliable N=2 arming handshake, exact session pins, baseline-safe watch setup, honest wake-tier selection, authority rules, pause triggers, consensus reporting, logging, and deterministic closeout.
- Claude Code Monitor behavior and Codex one-shot/recurring Stop-hook behavior retain their validated classification through automated and live-harness proof.
- Cursor activity is buffered through `turn_ended`; all terminal statuses are explicit, and continuation remains labeled unvalidated unless its live matrix passes.
- Empty, metadata-only, replayed synthetic, and `[no-op]` activity cannot create recursive automatic continuation or consume loop budget.
- Tests cover observer regressions, collaboration state/control behavior, hook coexistence and bounds, sanitized fixtures, and generated-source parity.
- Documentation accurately covers the updated base CLI and the new collaboration skill without stale provider-support claims.
- Deferred v2 capabilities have canonical backlog IDs included in the implementation handoff.
- The repository's targeted tests, build check, full test/validate/smoke gates, skill-version validation, and relevant live harness checks pass.

## Out of Scope

- N>2 full-mesh collaboration in the v1 shared state model.
- A required daemon, terminal supervisor, pane injector, desktop integration, or third-party runtime dependency.
- Automatic switching to a newer peer session without human/agent confirmation.
- Treating peer-agent content or synthetic control input as human instruction or authorization.
- Replacing the base observer CLI inside the collaboration skill.
- Claiming Cursor lifecycle continuation is validated before the required live probe.

## Deferred Ideas

- Per-observer offset namespaces and duplicate-watcher locks for safe N>2 full mesh.
- Stronger Cursor wake surfaces such as managed background-agent completion or `subagentStop`.
- Cursor background-agent/CLI transcript-store coverage and dotted-path slug edge cases.
- Non-blocking idle-session wake through optional application integrations.

Each intentionally deferred capability must be represented by one or more concrete backlog items during implementation closeout.

## Open Questions

- Whether Part 1.10 is sufficiently bounded to include in v1 should be decided from implementation complexity and migration risk, not assumed during planning.
- Which Cursor live probes are possible in the implementation environment must be measured; unavailable probes preserve the documented-but-unvalidated label.
- Whether the user wants static runtime hooks retained or uninstalled is an explicit closeout choice, not a planning default.

## Assumptions

- Existing transcript adapters and watch-state abstractions can be extended without changing the no-runtime-dependencies contract.
- The supplied Codex prototype is a trustworthy behavior oracle but will be re-expressed through canonical repository architecture.
- The new standalone skill will live under canonical `skills/session-observer-collab/`; generated/provider mirrors are outputs, not authoring sources.

## Risks

- Lifecycle hooks can misclassify synthetic user-shaped records as human authority or recursively wake peers if provenance and cursor advancement are not atomic.
- Runtime transcript ordering differs, especially Cursor's provisional records before `turn_ended`; generic handling could expose incomplete positions.
- Shared state and generated-output operations can race in multi-agent/shared-worktree use.
- Exact-command hook trust and coexistence are easy to document incorrectly; effective execution must be probed rather than inferred from config shape.
- Broad implementation phases could couple base parsing changes, hook state, generated outputs, and documentation too tightly for safe parallel work.

## Next Steps

1. Validate the lightweight component boundary and data flow.
2. Produce an execution plan with stable task IDs, exact write boundaries, and acceptance-matrix verification.
3. Resolve dispatch/review settings, run the plan artifact review, and hand off to `oat-project-implement`.

## References

- [Authoritative prompt](references/prompt.md)
- [Packet manifest](references/README.md)
- [Acceptance matrix](references/acceptance-matrix.md)
- [Closeout runbook](references/closeout-runbook.md)
