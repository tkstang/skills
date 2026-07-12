# Codex runtime reference

Use this reference after resolving the acting runtime as Codex. Codex automatic
continuation is a bounded Stop-hook capability, not a background watcher and
not a promise that future peer output can wake a session.

## Capability facts

Keep these facts separate in setup, status, and handoff output:

| Fact                | Meaning                                                                          | Evidence                                                                       |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Installed           | The exact observer command is present in `~/.codex/hooks.json`.                  | Read the merged `Stop` entry.                                                  |
| Trusted             | Codex has a persisted trust record for that exact command.                       | Read-only `/hooks` trust information.                                          |
| Effectively invoked | Codex actually ran the exact command.                                            | `/hooks` status or a bounded live probe; `lastRanAt` is the useful breadcrumb. |
| Lease armed         | A session-specific collaboration lease is configured for its next Stop boundary. | Lease status.                                                                  |
| Waiting             | A Stop-hook process is currently polling inside its finite catch window.         | Lease status.                                                                  |
| Live wake passed    | A peer turn caused one real synthetic continuation.                              | Measured arm → Stop → peer post → continuation evidence.                       |

An absent `enabled` property is **not** evidence of disablement. Reject only an
explicit `enabled: false`; report a missing field as “not explicitly disabled,”
not as enabled. Trust is also exact-command scoped: a record for a different
script path or command does not authorize the observer command.

## Install and approve the static Stop hook

Install one static observer hook per user, not one per worktree or per peer.
Copy the shipped hook script to a stable absolute path, conventionally:

```text
~/.codex/hooks/session-observer-collab-stop.mjs
```

Its registered command must remain byte-for-byte stable:

```text
node /absolute/path/to/session-observer-collab-stop.mjs
```

The Codex registration adapter (`scripts/codex-lifecycle.mjs`) merges this
exact command into `~/.codex/hooks.json`. It writes a distinct status label,
`Checking for Session Observer peer activity`, and preserves every unrelated
event, Stop group, and command. Re-running installation detects the exact
entry and makes no second observer entry.

After installation, do all of the following before arming a lease:

1. Show the user the exact command and absolute script path.
2. Have the user open `/hooks`, inspect that same command, and explicitly
   trust it. Never automate that approval.
3. If Codex exposes an enable/disable control, reject an explicit disablement.
4. Read the persisted exact-command trust fact and `/hooks` execution status.
   A trusted command with an observed `lastRanAt` (or a bounded successful live
   probe) is effectively invoked.
5. Only after those facts are established, create the session lease and report
   it as `armed`.

The registration adapter’s readiness result intentionally leaves `installed`,
`trusted`, `enablement`, `effectiveExecution`, and `mayArm` separate. It never
claims a missing status field, a different command, or merely installed JSON is
enough to arm a session.

## Bounded lease lifecycle

The lease contains the exact Codex session ID, resolved worktree path, peer
runtime/session, peer transcript, cursor, finite continuation and loop caps,
and expiry. The global hook checks all of those facts on every Stop event. A
mismatched worktree, malformed lease, expired lease, missing resource, or
unrelated session is a fail-closed no-op and must not affect another lease.

The default catch window is **five seconds**. This is deliberately short:
Codex queues user input while a command Stop hook runs, so the hook cannot
reliably self-preempt when the user starts steering. A longer wait (up to the
documented control maximum) is an explicit opt-in and must warn:

> Codex may queue your message until the Stop hook resolves. For a long catch
> window, steer or interrupt the session if you need to submit input promptly.

State is literal:

| State       | Meaning                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `armed`     | The next Stop boundary can start a finite wait; no process is waiting now.                                |
| `waiting`   | The Stop hook is actively able to catch peer output until its stored deadline.                            |
| `idle`      | That deadline elapsed. The lease remains a record, but later peer output cannot wake the stopped session. |
| `triggered` | A terminal one-shot/cap-limited continuation fired; it has no further automatic coverage.                 |
| `disarmed`  | The user explicitly disabled the lease.                                                                   |

A one-shot lease has a continuation cap of one. A recurring lease may re-enter
`waiting` on later Stop boundaries, but each accepted continuation spends its
finite count/loop budget and expiry still wins. Empty, metadata-only,
automatic/replayed, and `[no-op]` peer output never spends that budget. On a
no-hit timeout the hook writes `idle`; it must not describe the lease as still
watching.

## Restart, closeout, and cleanup

The static hook survives client restarts, but an `idle`, terminal, or disarmed
lease does not resume automatic coverage merely because Codex restarted. The
user must explicitly re-arm after confirming the same session/worktree/peer
pin and fresh cursor. This prevents old peer output from waking a new client
state.

Use `disarm` for normal collaboration closeout. It is deterministic and scoped
to the named Codex session; repeating it is harmless. It leaves the static
hook installed for future collaborations.

Run `prune` during setup/status as well as after a Stop event. It may remove
only unambiguous leases that are expired, cap-exhausted, disarmed when
explicitly targeted, or whose worktree/transcript is missing. Do not silently
delete malformed or otherwise ambiguous leases, and never prune another
session while handling one session’s disarm.

Static-hook uninstall is a separate explicit user choice. Confirm it, remove
only entries whose command exactly equals the observer command, preserve every
other `hooks.json` entry, and remove the script only after there are no active
collaboration leases. Do not use normal closeout as authorization to uninstall
the shared hook.

## Live validation boundary

Automated tests prove registration merge/removal, exact-command status
classification, finite wait/idle behavior, concurrent Stop safety, and restart
re-arm semantics. They do not prove a user has trusted the hook in a live
Codex client. Mark live lifecycle continuation as documented-but-unvalidated
until an actual exact trust breadcrumb, one substantive peer-triggered wake,
range/cursor advance, cap behavior, steering observation, coexistence, and
disarm have been measured against the acceptance matrix.

## Automated acceptance subset (2026-07-12)

The bounded acceptance command was run without touching live Codex hooks,
trust records, leases, or session state:

```text
pnpm exec vitest run tests/session-observer-collab/codex-hook.test.ts tests/session-observer-collab/control.test.ts
```

Result: **2 test files passed, 32 tests passed**. This is automated proof only;
it is not evidence that any live Codex harness row passed.

| Acceptance area                 | Automated subset evidence                                                                                                                           | Live status                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Exact-command trust/readiness   | Synthetic readiness fixtures classify exact trust, explicit disablement, omitted `enabled`, and `lastRanAt`.                                        | Not run; no live `/hooks` breadcrumb. |
| One substantive trigger         | Synthetic peer digest produces one wake envelope and advances one claim.                                                                            | Not run.                              |
| Exact range/cursor              | Asserts `records="0-2"` and `peerCursor: 3` for the claimed range.                                                                                  | Not run.                              |
| Recurring two-continuation flow | Single continuation, CAS race, and cap exhaustion are covered; two automatic continuations in one session are not.                                  | Not run.                              |
| Finite caps/expiry              | Cap exhaustion, lease expiry, and bounded wait expiry become terminal/idle.                                                                         | Not run.                              |
| Waiting/idle states             | Stored wait deadlines and `wait-timeout` transitions are asserted.                                                                                  | Not run.                              |
| No-op suppression               | `[no-op]` output does not spend continuation budget and ends in `idle` after timeout.                                                               | Not run.                              |
| Queued input/steering           | No automated test in this subset exercises queued user input or steering.                                                                           | Not run.                              |
| Hook coexistence                | Install is idempotent and preserves unrelated `Stop`/`SessionStart` entries; UI-row coexistence is not exercised.                                   | Not run.                              |
| Stale-worktree pruning          | Identity mismatch fails closed; expired/capped/targeted disarmed pruning is covered. Missing-resource stale-worktree pruning is not exercised here. | Not run.                              |
| Disarm                          | Idempotent disarm and exact-hook uninstall guards are covered.                                                                                      | Not run.                              |

All live one-shot, recurring, timeout/input, coexistence, and disarm claims
remain **documented but unvalidated** pending an independently evidenced Codex
client run with no intervening user turn.
