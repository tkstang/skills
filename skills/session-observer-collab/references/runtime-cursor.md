# Cursor runtime reference

Use this reference only after resolving the acting runtime as Cursor. Cursor
collaboration has two separate modes:

- **Observed-side review:** a pinned, stateless base-observer review of the
  peer transcript. This is the usable default when no lifecycle wake has been
  live-proven.
- **Lifecycle continuation:** the documented Cursor Stop-hook path that can
  return one synthetic `followup_message`. It remains
  **documented-but-unvalidated** until one complete live run proves arm → peer
  post → follow-up generation → disarm in the same conversation.

Scheduled polling is the honest operational floor until that second mode has
passed its live acceptance row. A configured hook, a unit test, or CLI presence
does not promote the tier.

## Identity and completed-turn boundary

Pin the observed peer as an exact `<runtime>:<session-id>` identity and retain
the transcript path used to resolve it. The Stop payload's `conversation_id`
must equal the Cursor lease's owner session; `generation_id` identifies only
that completion attempt. Do not use a similar same-worktree conversation,
generation ID, or transcript filename as a substitute for the exact owner
identity.

Cursor transcript activity is provisional until the top-level terminal record:

```json
{ "type": "turn_ended", "status": "success" }
```

The base observer buffers planning, fragments, and tool activity through that
boundary. A successful terminal record renders one completed response; an
`aborted`, `error`, or `cancelled` record renders a terminal diagnostic and
never promotes provisional content to a peer position. The normalizer's
existing terminal-success fixture includes tool activity with no tool-result
payload, so observed-side completion must not require a missing tool result.

The exact ordering between `turn_ended` persistence and Cursor Stop-hook
invocation is not live-proven. Do not claim that either event necessarily
precedes the other from the documented payload alone. The live identity/order
probe must record both facts against the same sanitized conversation before
lifecycle continuation can be promoted.

## Stop-hook continuation contract

The documented Stop input contains only:

- `conversation_id`
- `generation_id`
- `status`
- `loop_count`

On a successful, exact-session event, the adapter reads the owner-only lease,
checks peer/runtime/path/cursor/expiry state, and waits only for the configured
bounded window. It returns either no output or exactly this shape:

```json
{
  "followup_message": "<session_observer_wake ...>...</session_observer_wake>"
}
```

The envelope is a synthetic control message, not human input or authorization.
The base renderer must label it `Hook/control (automatic)`. It carries the
lease ID, pinned peer, and exact zero-based peer record range so the receiver
can review provenance rather than treating the envelope as ordinary direction.

Respect both independent bounds:

- Cursor's `loop_count` is checked against the configured hook `loop_limit`
  (default 5).
- The lease also has finite continuation count, loop count, expiry, and a
  per-stop wait deadline. Neither bound substitutes for the other.

Only a substantive completed peer delta can spend one continuation. Empty,
metadata-only, replayed synthetic, automatic acknowledgement, and `[no-op]`
turns advance the private cursor as appropriate but spend no continuation.
Non-success Stop statuses (`aborted`, `error`, and `cancelled`), malformed
identity, exhausted loop limit, or unavailable/mismatched lease are fail-closed
no-ops before peer output is observed.

Once a wait reaches `idle`, or a cap reaches terminal `triggered`, later peer
output cannot wake that conversation. A client restart does not restore
coverage from an idle, terminal, or disarmed lease: confirm the active
conversation identity and explicitly re-arm with a fresh peer cursor. Restart
and same-conversation resume behavior still need live measurement; this rule
prevents an old lease from being presented as autonomous coverage.

## Interaction and fallback rules

Do not promise prompt user steering while a Cursor Stop hook is in its bounded
wait. The documented input does not prove whether input is queued, interrupts
the hook, starts another generation, or is rejected. Keep the default window
short, disclose that interaction behavior is unmeasured, and use scheduled
polling or manual catch-up whenever a user needs dependable immediate control.

Use stateless, pinned observed-side review for normal collaboration and do not
advance another observer's target offset. A Stop-hook lease has its own private
cursor; it is not evidence that a background watcher remains active after the
hook returns. On any capability, identity, ordering, or lifecycle uncertainty,
fall back to a scheduled poll; when polling is unavailable, use buffered manual
catch-up and disclose that no autonomous wake exists.

Managed background-subagent completion plus `subagentStop` is a possible
stronger-tier probe, not an assumed upgrade. It may only be classified after a
live probe demonstrates that its completion signal reaches the same pinned
conversation safely and retains the same synthetic/no-op/loop protections.

## Evidence status (2026-07-12)

The bounded automated command below passed at the recorded revision. It covers
adapter input validation, exact lease-session binding, success/non-success
gates, independent loop limits, finite wait to `idle`, exact range/cursor
claims, synthetic acknowledgement and `[no-op]` suppression, and the rule that
idle/terminal leases do not resume on a later generation. The paired runtime
suite covers transcript-directory session identity, `turn_ended` buffering,
terminal diagnostics, and the absent-tool-result fixture case.

```text
pnpm exec vitest run tests/session-observer-collab/cursor-hook.test.ts tests/transcript-core/runtimes.test.ts
```

The local `cursor-agent` and `agent` command paths were present during this
task's availability probe, but neither was used to run a Cursor conversation or
hook. No complete lifecycle run, user-input-during-wait probe, restart/resume
probe, Stop/`turn_ended` ordering probe, recurring live loop probe, or
`subagentStop` stronger-tier probe was performed. Those absences are not live
validation and leave lifecycle continuation **documented-but-unvalidated**.

| Acceptance area       | Current evidence                                                                                                                        | Live status                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Cursor observed side  | Automated normalization covers transcript identity, terminal success/diagnostics, stateless digest inputs, and no required tool result. | Automated only; no live observed-side session run in this task.         |
| Cursor continuation   | Adapter tests cover envelope/range, caps, no-op/synthetic suppression, and idle/terminal no-wake behavior.                              | Not run; lifecycle tier remains documented-but-unvalidated.             |
| Cursor identity/order | Exact `conversation_id` lease binding is tested; transcript-directory session extraction is tested.                                     | Stop relative to `turn_ended` not run.                                  |
| Cursor interaction    | Bounded wait state is tested.                                                                                                           | Input during wait, recurring loop behavior, and restart/resume not run. |
| Stronger tier         | No `subagentStop` behavior is assumed.                                                                                                  | Not run.                                                                |

## Required live lifecycle probe

Before changing any lifecycle label, capture sanitized evidence for this exact
sequence:

1. Resolve and announce the active `conversation_id` and matching transcript
   session identity; arm one finite lease with a pinned peer.
2. Record whether `turn_ended` is written before or after the Stop invocation.
3. Post one substantive completed peer turn and observe exactly one
   `followup_message` generation within `loop_limit`.
4. Verify the envelope's range/cursor, then disarm and prove late peer output
   cannot create another generation.
5. Run separate probes for each non-success status, a `[no-op]`/synthetic turn,
   user input during the wait, restart/resume, recurring loop count, and any
   `subagentStop` route.

Sanitize session IDs, transcript paths, peer prose, and lease data before
retaining evidence. A partial probe, unavailable CLI/hook, or a successful
unit test is not a substitute for this complete lifecycle run.
