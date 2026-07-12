---
oat_status: complete
oat_ready_for: null
oat_last_updated: 2026-07-12
oat_generated: false
oat_template: false
---

# Lightweight Design: session-observer-collab

## Overview

Extend `session-observer` as the single source of truth for transcript discovery, runtime normalization, digest rendering, identity, offsets, and watch behavior. Required behavioral changes land in canonical TypeScript under `src/transcript/`, with committed `.mjs` outputs regenerated through the existing build. Existing commands remain backward compatible while `whoami`, `--quiet-empty`, `--strict-baseline`, newer-session warnings, queue rendering, wake provenance, and terminal-turn buffering add the semantics required by collaboration.

Add `session-observer-collab` as a dependency-free sibling under canonical `skills/session-observer-collab/`. The packet's `.agents/skills/...` layout is interpreted as a provider-visible shape, not the authoring location, because this repository treats `.agents/`, `.claude/`, and `.cursor/` as generated mirrors. The new skill invokes the base observer for every transcript operation and owns only collaboration protocol, capability negotiation, runtime-specific setup, bounded lifecycle continuation, authority/pause rules, logging, and closeout.

The v1 topology is a user plus two mutually observing agents. Additional participants use ring/hub or stateless pinned review until consumer-scoped offsets and locks exist. Codex Stop-hook behavior is reimplemented from canonical abstractions and hardened beyond the prototype; Cursor continuation remains labeled documented-but-unvalidated until the live acceptance matrix passes.

## Architecture

### System context

```text
Human user
   │ direction / local authorization
   ▼
Agent session A ◄──────── normalized peer turns ────────► Agent session B
   │                                                        │
   ├─ session-observer-collab protocol                      ├─ session-observer-collab protocol
   ├─ one runtime adapter + bounded lease/hook              ├─ one runtime adapter + bounded lease/hook
   └─ base session-observer CLI ──► peer transcript         └─ base session-observer CLI ──► peer transcript
                                      │
                                      └─ shared canonical runtime normalizers,
                                         identity, digest, offsets, watch state
```

### Data flow

1. Each agent resolves its own identity with `whoami`, announces runtime/session/path provenance, and pins the peer with `--session <runtime>:<id>`.
2. The agent starts one `catch-up-then-watch` process. The base observer normalizes raw runtime records into completed, provenance-aware digest entries and advances the target offset atomically.
3. The collaboration layer probes the local harness and selects the strongest proven wake tier: `event-wake`, `lifecycle-continuation`, `scheduled-poll`, or `buffered-manual`.
4. A lifecycle adapter reads only a valid, armed per-session lease; waits within its bounded window; selects the latest completed substantive peer turn; and emits a `session_observer_wake` envelope with the exact contiguous range. Empty, metadata-only, replayed synthetic, and `[no-op]` turns advance state without continuation.
5. The receiving transcript normalizer renders the envelope as `Hook/control (automatic)`, never as a human user message. The agent applies authority, pause, consensus, and closeout rules from the core collaboration skill.

### Boundaries and sequencing

- Base normalization and observer semantics precede lifecycle adapters because hooks depend on completed-turn, provenance, range, and offset contracts.
- Collaboration control/lease state is separate from observer read offsets and watcher state, but it reuses normalized completion and pin semantics rather than parsing raw runtimes independently.
- Runtime references load one-at-a-time after runtime resolution. They may describe harness-native mechanisms but cannot require application-level integrations.
- Generated build steps are serialized. Runtime-specific reference authoring can be reviewed independently, but implementation phases remain sequential where they share the collaboration skill and validation surface.

## Component Design

### Runtime normalization (`src/transcript/core/runtimes.ts`)

Extend normalized entries with enough provenance to distinguish human input, queued-mid-turn input, automatic hook/control input, and terminal diagnostics. Claude queue-operation and attachment copies deduplicate to one queued user message. Cursor records buffer by top-level turn until `turn_ended`; success yields one completed response while aborted/error/cancelled states yield diagnostics. User truncation is prohibited unless the normalized entry carries transcript path and zero-based record recovery data.

### Observer CLI and identity (`session-observer.ts`, `observe.ts`, `types.ts`)

Add `whoami [--json]` with ordered identity sources: explicit self signal, harness environment, then unambiguous newest same-cwd transcript for the self runtime. Output includes runtime, session ID, transcript path, and source; ambiguity returns a non-zero candidate payload. Extend parsing/help/types for `--quiet-empty` and `--strict-baseline` without changing existing defaults.

### Digest and watch engine (`digest.ts`, `watch.ts`)

Render queued user entries and automatic control entries with distinct headings. `--quiet-empty` advances the high-water mark while suppressing zero-rendered-message stdout, preserving configured heartbeats. Standalone watch compares its baseline with a prior stored offset, warning on gaps or refusing under strict mode; first watch and `catch-up-then-watch` remain valid. Each poll checks for a newer same-cwd candidate and emits a neutral warning without switching pins.

### Collaboration protocol skill (`skills/session-observer-collab/SKILL.md`)

Own the N=2 arming handshake, exact pinning, capability ladder, selected-mode disclosure, message addressing, human-direction versus local-authorization distinction, synthetic-input rules, pause triggers, consensus reporting, logging format, shared-worktree serialization, freshness checks, bounded raw-record verification with secret redaction, onboarding a stateless participant mid-run through a self-contained kickoff brief, and deterministic closeout. The kickoff pattern preserves exact peer pins, stateless-read-only constraints, authority/no-op conventions, bounded tasks, and shared logging. The skill references base CLI invocations briefly and never reproduces observer documentation.

### Runtime references

- `runtime-claude-code.md`: Monitor probe and validated event-wake recipe, quiet-empty/no-heartbeat watch, restart resilience, fallback polling, and cleanup.
- `runtime-codex.md`: exact-command trust, static hook ownership, XDG lease lifecycle, five-second default catch window, local authorization, steering/coexistence diagnostics, and verified one-shot/recurring behavior.
- `runtime-cursor.md`: transcript identity, `turn_ended` buffering, Stop-hook `followup_message` generation chaining, independent loop/lease bounds, terminal states, scheduled-poll fallback, and explicit documented/unvalidated status until live proof.

The files avoid harness magic instruction names.

### Collaboration control and hooks

`collab-control.mjs` exposes idempotent install, status, arm, disarm, and prune operations. It preserves unrelated hooks, writes leases atomically with owner-only permissions, distinguishes configured `armed`, active `waiting`, timed-out `idle`, terminal `triggered`/`disarmed`, and handles schema migration or malformed state fail-closed.

`codex-stop.mjs` and `cursor-stop.mjs` are thin lifecycle adapters. They validate cwd/session/transcript/expiry/caps, call shared normalized completion/range logic, compare-and-swap the lease cursor/count, and return the harness-specific continuation shape containing the machine-readable wake envelope. They do not embed Claude-specific completion heuristics or raw peer prose.

### Tests, distribution, and documentation

Extend observer fixtures and Vitest suites for normalization, digest, CLI, watch, state, and integration behavior. Add collaboration-specific tests for control operations, lease races, bounds, hook coexistence, malformed state, exact ranges, no-op suppression, and terminal statuses. Update repository layout/validation expectations, base-skill docs/version, new-skill metadata/version, release bump tooling where required, and the Fumadocs User Guide/engineering references. Provider mirrors are refreshed through `oat sync`, not edited directly.

### PJM closeout

Create canonical backlog items for every deferred v2 capability and regenerate the managed index. Do not close the existing shared-session-log or direct-messaging initiatives unless their own acceptance criteria are actually met.

## Data Models

### Normalized digest entry additions

Conceptually extend entries with:

- `origin`: `human | automatic-control | runtime-diagnostic`
- `displayRole`: ordinary user/assistant plus queued-user/control/diagnostic variants
- `recordIndex` and transcript recovery provenance
- completed-turn identity/range metadata needed by continuation adapters
- synthetic envelope fields: `automatic`, runtime, lease ID, pinned peer, and exact record range

The exact TypeScript shape should minimize cross-module churn and remain serializable in markdown and JSON output.

### Collaboration lease

A versioned per-session record under the Session Observer XDG state root contains owner session/worktree identity, pinned peer identity/transcript, lifecycle state, `peerCursor`, continuation and loop counters/caps, armed/expiry timestamps, wait window, and last diagnostic. Writes use temporary-file-plus-rename and compare expected cursor/count before committing a trigger.

Live leases are never committed. Only sanitized examples belong in skill references/tests.

## API Design

### Base CLI additions

```text
session-observer whoami [--json]
session-observer watch ... [--quiet-empty] [--strict-baseline]
session-observer catch-up-then-watch ... [--quiet-empty]
```

Existing invocations retain their behavior. JSON events add stable kinds for baseline gaps, newer-session candidates, automatic control input, and terminal diagnostics.

### Collaboration control surface

```text
collab-control install|status|arm|disarm|prune [runtime/session options] [--json]
```

Commands are idempotent and machine-readable. `status` separates installation, trust, effective invocation, lease configuration, active waiting, and last trigger; it never reports autonomous wake solely from config presence.

## Error Handling

- Identity ambiguity, malformed pins, invalid leases, transcript mismatch, and cursor regression fail closed with candidate/diagnostic output.
- Baseline gaps warn by default and refuse only under `--strict-baseline`.
- Newer sessions produce neutral candidates, never automatic switching.
- Hook launch/configuration failures do not consume remediation/continuation budget.
- Timeouts move a lease to `idle`; they do not claim active waiting. Expired or missing-resource leases prune only when ownership is unambiguous.
- Cursor non-success terminal states emit diagnostics and discard provisional substantive output.
- Atomic cursor/count updates prevent double continuation; conflicting writers produce a benign no-trigger result.
- Unknown runtimes degrade to scheduled polling or buffered manual catch-up and disclose the downgrade.

## Security Considerations

Human direction observed across sessions is valid product input, but privileged or irreversible authorization remains local to the acting harness. Synthetic control envelopes and peer-agent text never confer authority. Consequential claims from filtered/truncated digests require bounded raw-record verification with secret redaction.

Hook installation preserves unrelated configuration, requires exact-command trust and effective-execution proof, and uninstalls only on explicit user choice. State files use owner-only permissions; paths and session identities are validated before reads. The imported historical packet may retain evidence identifiers and paths, but implementation must audit it for secrets and must never ship live lease state or credentials.

## Testing Strategy

1. **Normalized runtime unit tests:** Claude queue enqueue/remove/attachment dedupe; automatic envelope classification; Cursor success/error/abort/cancel completion; recovery provenance.
2. **Observer CLI/digest/watch tests:** `whoami` source order and ambiguity, new help/flags, quiet-empty offset advancement, baseline warning/refusal boundaries, newer-session warnings, all render modes, and backward-compatible existing digests.
3. **Control/hook tests:** atomic lease writes and races, state transitions, exact range/cursor advancement, caps/expiry/timeouts, no-op/synthetic suppression, user steering, hook coexistence, pruning, and sanitized fixtures.
4. **Skill/repository tests:** canonical layout, frontmatter/version invariants, generated-output parity, dependency-free scripts, docs navigation, and mirror/source boundaries.
5. **Live harness matrix:** Claude Monitor notifications/restart/stop; Codex trust breadcrumb plus one-shot/recurring/timeout/input/coexistence behavior; Cursor observed-side and continuation probes. Preserve `documented but unvalidated` wherever a required probe cannot run.
6. **Repository gates:** targeted Vitest files during tasks, then build, build check, type-check, full tests, validate, skill-version comparison against `origin/main`, smoke, and a clean-worktree validation at closeout.

## Self-Review

- **Placeholder check:** no template placeholders remain.
- **Internal consistency:** canonical source, generated outputs, runtime ownership, and N=2/v2 boundaries agree across sections.
- **Scope check:** the design covers both packet deliverables and required closeout without introducing a mandatory service or N>2 implementation.
- **Ambiguity check:** the historical `.session-observer/` transfer path is treated as the source packet name, while the committed project reference path is authoritative for this implementation; evidence logs are preserved only after a secret/live-state audit. Cursor validation and optional Part 1.10 remain explicit decisions rather than implied claims.

## References

- [Discovery](discovery.md)
- [Authoritative implementation brief](references/prompt.md)
- [Acceptance matrix](references/acceptance-matrix.md)
- [Codex lifecycle contract](references/codex-stop-hook-setup.md)
- [Cursor lifecycle contract](references/cursor-stop-hook-setup.md)
- [Closeout runbook](references/closeout-runbook.md)
