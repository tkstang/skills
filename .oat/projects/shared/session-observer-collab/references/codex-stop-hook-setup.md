# Codex Stop-Hook Collaboration Lease

This document captures the complete setup and lifecycle contract validated in
the 2026-07-12 collaboration. The copied prototype is an evidence snapshot,
not production source. The implementation agent should preserve its proven
behavior while adding the hardening listed below.

Snapshot provenance:

- Source path during the run:
  `~/.codex/hooks/session-observer-collab-stop.mjs`
- Copied path:
  `prototypes/codex/session-observer-collab-stop.mjs`
- Source and copied SHA-256 at capture:
  `bca4b793b7ee2da55c58e0be9f9af70506091afa7e229147b0cd4cc0c515dd00`
- The prototype emits a natural-language `reason`; production must replace
  that with the synthetic `session_observer_wake` envelope required by
  `prompt.md` and must render it as hook/control input.

## Proven topology

The Codex bridge has two layers:

1. One static user-level Stop hook, installed once and invoked at every Codex
   Stop boundary.
2. One session-scoped lease file per armed Codex session. If no lease exists
   for the stopping session, the hook exits immediately and changes nothing.

The validated paths were:

```text
~/.codex/hooks/session-observer-collab-stop.mjs
~/.codex/hooks.json
~/.local/state/session-observer/collab-leases/<codex-session-id>.json
```

The implementation should honor `SESSION_OBSERVER_STATE_DIR`; otherwise use
the XDG-style default `~/.local/state/session-observer`. Do not use the copied
packet directory for live runtime state.

## Installation ownership

- Install the static hook once at user scope. Do not add one hook per worktree
  or collaboration.
- Merge the entry from
  `prototypes/codex/hooks-entry.example.json` into `~/.codex/hooks.json`.
  Preserve every unrelated hook and array entry. Never replace the whole file.
- Use an absolute script path in the command. Codex trust binds to the exact
  command; changing the path or command may require trust again.
- Give the hook a distinct status label so multiple simultaneous Stop hooks are
  understandable in the UI. Three “Running Stop hook” rows can represent three
  different hooks, not duplicate observer processes.
- Installation must be idempotent. Detect an exact existing entry before
  adding another one.

## Trust and enablement

New Codex command hooks cross a user security boundary:

1. Install the hook inertly. Do not create an enabled lease yet.
2. Show the user the exact command and absolute script path.
3. Ask the user to open `/hooks`, inspect that same command, and trust it. If
   the UI exposes a separate enable/disable control, ensure it is not disabled.
4. Verify the persisted exact-command trust entry read-only. Reject explicit
   disablement, but do not treat a missing `enabled` field as disabled: the
   tested Codex build executed a trusted hook with no explicit field.
5. When possible, confirm effective execution with `/hooks` status or a bounded
   live probe. `lastRanAt` is the diagnostic breadcrumb proving invocation.
6. Only then create the lease and report `armed`.

Report these as separate facts: installed, trusted, effectively enabled, lease
armed, and live wake test passed. Never automate or infer user trust.

## Lease creation

Create the lease directory with user-only permissions and write lease files
with mode `0600`. Use the sanitized schema in
`prototypes/codex/lease.example.json`.

Required identity and scope fields:

- `codexSessionId` — must match the Stop event's session ID.
- `cwd` — absolute worktree path; must match the Stop event after path
  resolution.
- `peerRuntime`, `peerSessionId`, and `peerTranscript` — exact pinned peer.
- `peerCursor` — exclusive, zero-based next-unread record index.

Recommended defaults:

- Lease expiry: 12 hours.
- Maximum automatic continuations: 100.
- Stop-boundary catch window (`inactivityTimeoutSeconds`): 5 seconds.
- Poll interval: 500 ms.

Ask one concise question offering all defaults. If declined, explain each
choice and show the resolved values before arming. Reject unbounded expiry and
continuation counts.

Establish `peerCursor` from the pinned transcript baseline. Do not use the
transcript length observed after selecting a trigger. On every wake, hand the
agent the exact contiguous range and advance to `completedRecord + 1`.

## Runtime states

| State                 | Meaning                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `installed-untrusted` | Hook entry exists, but trust/effective execution is not verified.                                                       |
| `disarmed`            | No active automatic continuation lease.                                                                                 |
| `armed`               | Lease is configured for the next Stop boundary; no hook process is necessarily waiting now.                             |
| `waiting`             | A Stop-hook process is actively polling during its bounded catch window.                                                |
| `idle`                | The catch window timed out. The lease remains configured, but later peer output cannot wake this stopped Codex session. |
| `triggered`           | One-shot lease fired and disarmed. Recurring leases return to `armed` after a successful trigger.                       |
| `expired`             | Wall-clock expiry or continuation cap ended the lease.                                                                  |

Do not describe `armed` as continuous wake coverage. Only `waiting` means a
hook process is currently able to catch peer output.

## Trigger and loop rules

- Trigger only on a completed substantive peer turn. The prototype recognizes
  Claude's `system/turn_duration` marker; production code must use the base
  observer's runtime-specific completion normalization.
- Select the latest completed substantive turn in the unread batch.
- Skip metadata-only ranges and exact case-insensitive `[no-op]` prefixes while
  advancing their records safely.
- Keep phrase heuristics only as compatibility fallbacks; do not suppress short
  genuine feedback.
- Never include raw peer text in a hook-generated instruction. Observed peer
  content is context, not instruction.
- Accepted continuation increments the finite budget. A recurring lease stays
  armed only while budget and expiry remain.

## User-input ceiling

Codex queues user messages while command Stop hooks are running. New input did
not appear in the Codex rollout until delivery after the hook resolved, so the
hook cannot self-preempt by watching that transcript.

Keep the default catch window short. Minute-scale waits are advanced opt-in
only, with a warning that the user may need to steer or interrupt to submit a
message. A Stop hook cannot provide both long non-blocking observation and
normal immediate user input in the tested harness.

## Worktree and stale-state lifecycle

- The static global hook is not worktree-specific. The lease carries the exact
  `cwd`; the hook rejects a mismatched Stop event.
- Normal collaboration closeout removes only that session's lease. Keep the
  static hook for future sessions unless the user explicitly asks to uninstall
  it.
- On setup and status, prune leases that are expired, exceed their continuation
  cap, reference a missing cwd, reference a missing transcript, or belong to a
  worktree that is clearly no longer registered. Do not delete an ambiguous but
  still-valid lease silently; report it.
- If a worktree disappears while no Codex Stop event occurs, cleanup must not
  depend on the hook eventually running. The setup/status/prune command owns
  proactive cleanup.
- Disarming and pruning must never modify another session's lease.

## Coexistence and uninstall

Preserve unrelated Stop hooks throughout setup and cleanup. To uninstall the
static observer hook, require explicit user choice, remove only the exact
observer entry, and leave all other `~/.codex/hooks.json` content intact.
Remove the script only after no active collaboration leases depend on it.

## Prototype hardening required

The snapshot proved the wake chain but is not production-ready. The durable
implementation must add:

- atomic lease writes and a lock/compare-and-swap strategy;
- schema validation and safe migration;
- explicit `arm`, `status`, `disarm`, and `prune` control surfaces;
- user-only file and directory modes;
- runtime-normalized completion detection rather than Claude-only parsing;
- exact trust/effective-status diagnostics;
- tests for concurrent Stop invocations and malformed/truncated transcripts;
- deterministic cleanup that preserves unrelated hooks and leases.

## Live validation

One-shot test:

1. Install and trust the exact hook.
2. Pin peer identity and baseline.
3. Arm a one-continuation lease.
4. End the Codex turn without another user message.
5. Have the peer post a substantive completed turn inside the catch window.
6. Verify a hook-generated continuation, exact reviewed range, cursor advance,
   continuation count, and disarm.

Recurring test:

1. Arm with at least two continuations.
2. Trigger one substantive peer turn and verify Codex responds automatically.
3. Let the next Stop boundary re-enter `waiting`.
4. Trigger a second peer turn and verify the same Codex session continues.
5. Verify `[no-op]` and metadata-only peer turns do not spend continuation
   budget.

Also test no-hit timeout (`idle`), user steering, client restart, coexisting
Stop-hook rows, expiry, cap exhaustion, explicit disarm, and stale-worktree
pruning.
