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
Choose a stable absolute entrypoint path, conventionally:

```text
~/.codex/hooks/session-observer-collab-stop.mjs
```

Its registered command must remain byte-for-byte stable:

```text
node -- '/absolute/path/to/session-observer-collab-stop.mjs'
```

`codex-install` atomically writes an owner-only launcher at that path and a
content-addressed support bundle beside it. The bundle preserves the shipped
hook's composition with Session Observer digest parsing and the shared
collaboration lease/runtime modules, so the installed artifact resolves all
ESM imports without the repository. An unchanged reinstall keeps the same
launcher bytes and bundle identity. A shipped runtime-content change publishes
the complete new support tree before atomically replacing the launcher, then
removes superseded owned bundles.

The Codex registration adapter (`scripts/codex-lifecycle.mjs`) merges the exact
stable command into `~/.codex/hooks.json`. The single-quoted script argument is
an argv-safe registration schema: it preserves spaces and shell metacharacters
as path bytes rather than shell syntax. It writes a distinct status label,
`Checking for Session Observer peer activity`, and preserves every unrelated
event, Stop group, and command. Re-running installation detects the exact entry
and makes no second observer entry. The command path stays stable, but after an
upgrade changes launcher content, inspect and explicitly re-trust it in
`/hooks`; path equality alone is not approval of changed code.

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
`trusted`, `explicitEnablement`, `effectiveExecution`, `leaseArmed`,
`liveWake`, and `mayArm` separate. A missing `enabled` field is
`not-explicitly-enabled`, never an inferred enablement fact. It never claims a
different command or merely installed JSON is enough to arm a session.

## Stable control commands

The shipped `collab-control.mjs` is the supported lifecycle surface. Set
`CODEX_OBSERVER_HOOK` to the stable destination for the installed launcher and
keep that value unchanged after trust approval. The quoted shell variables
keep the CLI arguments intact even when `$HOME` or the hook path contains
whitespace. Run this command from the shipped skill checkout so the installer
can copy its committed runtime modules into the private support bundle.

```sh
export CODEX_OBSERVER_HOOK="$HOME/.codex/hooks/session-observer-collab-stop.mjs"
export COLLAB_CONTROL="/absolute/path/to/session-observer-collab/scripts/collab-control.mjs"

node "$COLLAB_CONTROL" codex-install \
  --hooks-path "$HOME/.codex/hooks.json" \
  --script-path "$CODEX_OBSERVER_HOOK" --json
```

After manually approving the exact displayed command in `/hooks`, save only
read-only `/hooks` trust/status exports as JSON arrays, then inspect each fact:

```sh
node "$COLLAB_CONTROL" codex-status \
  --hooks-path "$HOME/.codex/hooks.json" \
  --script-path "$CODEX_OBSERVER_HOOK" \
  --session "$CODEX_SESSION_ID" \
  --trust-records-path "/absolute/path/to/hooks-trust.json" \
  --hook-statuses-path "/absolute/path/to/hooks-status.json" --json
```

`trusted: "trusted"` proves the exact registered command has a trust record;
`effectiveExecution: "observed"` requires an exact-command `lastRanAt`.
`liveWake` remains `unverified` until an actual arm → Stop → substantive peer
post → continuation run is measured. The command never converts missing
`enabled` data into proof of enablement.

Uninstall is deliberately separate from normal `disarm`. It scans collaboration
leases while holding the control lock, refuses active Codex leases or malformed
lease state, removes only one exact observer registration, and only then may
remove the marker-identified observer launcher and support bundle:

```sh
node "$COLLAB_CONTROL" codex-uninstall \
  --hooks-path "$HOME/.codex/hooks.json" \
  --script-path "$CODEX_OBSERVER_HOOK" \
  --confirmed --remove-script --json
```

If the exact registration is absent or duplicated, no installed artifact is
removed. An unmarked file or support directory is never claimed as observer
state. The launcher and installed support directories are mode `0700`; support
files and their ownership manifest are mode `0600`. Installation copies no
credentials, trust records, transcript data, or live leases.

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
other `hooks.json` entry, and remove only the owned launcher/support bundle
after there are no active collaboration leases. Do not use normal closeout as
authorization to uninstall the shared hook.

## Live validation boundary

Automated tests prove registration merge/removal, exact-command status
classification, finite wait/idle behavior, concurrent Stop safety, and restart
re-arm semantics. They do not prove a user has trusted the hook in a live
Codex client. Mark each live lifecycle row independently: the targeted rows
measured below are validated, while unmeasured rows remain
documented-but-unvalidated. Do not infer recurring coverage or queued-input
behavior from a one-shot wake, cursor, expiry, coexistence, or cleanup result.

## Automated acceptance subset (2026-07-12)

The bounded acceptance command was run without touching live Codex hooks,
trust records, leases, or session state:

```text
pnpm exec vitest run tests/session-observer-collab/codex-hook.test.ts tests/session-observer-collab/control.test.ts
```

Result: the bounded automated subset passed at the recorded revision. This is automated proof only;
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

The table above records the automated-only command's evidence boundary. The
targeted live results below supersede its `Not run` cells only for the named
rows; they do not broaden the automated subset or validate unlisted behavior.

## Targeted live state-integrity retest (2026-07-12)

A fresh real Codex TUI and a separate real Codex peer session exercised the
state-integrity fixes at revision `ca51a5a`. Evidence was sanitized before
recording, and all temporary leases, transcripts, and session artifacts were
removed after the run. This was a targeted retest, not a broad rerun of every
live acceptance row.

| Targeted row                       | Live evidence                                                                                                                                                                                                                                                                                                                                                                                                                              | Result |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Fresh no-lease Stop gate           | The run began with zero leases. The TUI completed normally with all three installed Stop hooks active; the trusted observer launcher retained its 65-second timeout and the unrelated Orca hook remained active.                                                                                                                                                                                                                           | Pass   |
| Interrupted waiter recovery        | During a real 15-second wait, `status` preserved `waiting` with a live wait token and PID. Esc visibly interrupted the Stop hook. The first post-Esc status recovered in 91 ms to `idle` / `waiter-terminated`, cleared all four wait ownership fields, and left both counts at zero; an immediate second status was unchanged.                                                                                                            | Pass   |
| No-op cursor then substantive wake | While the peer turn was incomplete, the cursor advanced only across completed preamble records (`12 -> 14`) and spent no budget. After the same real `[no-op]` turn completed, the cursor advanced across its exact remaining range (`14 -> 25`) with both counts still zero. The next substantive range advanced `25 -> 32`, spent exactly one continuation and loop count, and produced one owner continuation with no `[no-op]` replay. | Pass   |
| Absolute lease expiry              | A 1.5-second lease remained stored as `armed` with cursor and counts unchanged immediately after its absolute deadline. A substantive peer turn posted after that deadline did not reach the owner; the next real Stop invocation pruned the expired lease without spending budget.                                                                                                                                                        | Pass   |
| Scoped stale-resource pruning      | Removing the uniquely owned temporary worktree and transcript made only that lease stale. Targeted `prune` removed exactly the stale lease while a separate live control lease remained unchanged.                                                                                                                                                                                                                                         | Pass   |
| Deterministic disarm               | The first scoped `disarm` changed the control lease once to `disarmed` / `user-disarmed`. Repeating it returned `changed: false` with identical state and timestamp. Final scoped pruning left zero lease files and did not alter the static hooks.                                                                                                                                                                                        | Pass   |

Recurring two-continuation behavior and queued-input/steering behavior were not
rerun in this targeted retest. Their status must come from their own live
acceptance evidence rather than this state-integrity run.
