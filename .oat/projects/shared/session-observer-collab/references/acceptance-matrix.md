# Session Observer Collaboration Acceptance Matrix

Use this matrix for the base-skill changes and the new collaboration layer.
“Documented” and “validated” are different outcomes; do not promote a harness
recipe without its required live probe.

## Base `session-observer`

| Area                | Required proof                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queued Claude input | Enqueue/attachment pairs render once as `User (queued mid-turn)` in review, catch-up, and watch.                                                                     |
| Quiet empty deltas  | `--quiet-empty` advances offsets without stdout for zero-rendered-message deltas.                                                                                    |
| Self identity       | `whoami --json` returns runtime/session/transcript with provenance and fails closed on ambiguity.                                                                    |
| Baseline gaps       | Standalone watch warns over unread backlog; `--strict-baseline` refuses; first watch and catch-up-then-watch remain valid.                                           |
| New peer session    | Watch emits `newer-session-candidate` without auto-switching.                                                                                                        |
| Truncation          | User text is complete or carries transcript path plus exact zero-based recovery record.                                                                              |
| Optional N>2        | If Part 1.8 lands, state and duplicate-watcher locks are keyed by consumer plus target, old state migrates safely, and default behavior remains backward compatible. |

## Collaboration protocol

| Area                  | Required proof                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Identity handshake    | Both agents announce and pin exact identities; stale same-cwd session is not silently selected.             |
| Authority             | Cross-session direction is visible, while privileged action approval remains local to the acting harness.   |
| Loop prevention       | Empty deltas and `[no-op]` turns consume no automatic continuation; short substantive feedback still wakes. |
| Consensus             | A disagreement and a narrower agreement are reported accurately without “both agents agree” inflation.      |
| Pause behavior        | Peer-to-user questions, convergence, and genuine disagreement return control to the user.                   |
| Shared worktree       | Mutating/generated-asset CLI operations are serialized or explicitly partitioned.                           |
| Final artifact review | The peer that finds a scope defect rechecks the published handoff/PR and reports findings or no findings.   |

## Harness adapters

| Runtime                | Required proof                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code            | Monitor-backed watch emits task notifications, suppresses empty heartbeats, survives a same-session client restart, and is stopped cleanly.                                                         |
| Codex one-shot         | Exact-command trust, effective invocation breadcrumb, one substantive trigger, exact range/cursor, and disarm with no intervening user turn.                                                        |
| Codex recurring        | Two automatic continuations in one session, finite cap/expiry, accurate `armed`/`waiting`/`idle`, no-op suppression, and no silent record loss.                                                     |
| Codex timeout/input    | Five-second no-hit path becomes `idle`; queued user input and steering behavior are documented and measured.                                                                                        |
| Codex coexistence      | Other Stop hooks survive install/uninstall; multiple UI rows are diagnosable; stale worktree leases prune safely.                                                                                   |
| Cursor observed side   | Transcript discovery, `turn_ended` completion, stateless review, and absent tool-result payload behavior remain covered.                                                                            |
| Cursor continuation    | Live arm → peer post → `followup_message` generation → disarm passes within `loop_limit`; late peer output cannot wake an idle session. Until this passes, label tier 2 documented but unvalidated. |
| Cursor identity/order  | `conversation_id` maps to the transcript-directory session ID and `turn_ended` ordering relative to Stop is proven.                                                                                 |
| Cursor terminal states | Success emits one final response; aborted/error/cancelled turns emit diagnostics without promoting provisional planning.                                                                            |
| Cursor interaction     | Recurring `loop_count`, user input during wait, restart/resume, synthetic-message suppression, and `[no-op]` behavior are tested.                                                                   |
| Cursor stronger tier   | Probe managed background-subagent completion plus `subagentStop`; record the result without assuming it upgrades the tier.                                                                          |
| Unknown runtime        | Falls back honestly to scheduled poll or buffered manual mode without claiming autonomous wake.                                                                                                     |

## Closeout

- All per-agent logs are complete or explicitly bounded evidence artifacts.
- `prompt.md` has no stale runtime classification.
- Prototype files contain no live session IDs, secrets, or machine-specific
  lease state.
- Watchers, Monitor tasks, and session leases are stopped/disarmed.
- Static global hooks are retained or uninstalled according to explicit user
  choice.
- Any deferred v2 work has a concrete backlog item and the IDs appear in the
  implementation handoff.
