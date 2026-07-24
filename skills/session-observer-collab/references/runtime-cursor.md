# Cursor runtime reference

Use this reference only after resolving the acting runtime as Cursor. Cursor
collaboration has two separate modes:

- **Observed-side review:** a pinned, stateless base-observer review of the
  peer transcript. This is the usable default when no lifecycle wake has been
  live-proven.
- **Lifecycle continuation adapter:** a bounded synthetic
  `followup_message` contract exists and is automated, but the measured Cursor
  top-level Stop and managed-subagent provider paths did not deliver it.
  Lifecycle continuation is **unavailable** on those measured surfaces.

The strongest evidence-backed tier is therefore **buffered-manual**. Scheduled
polling may replace it only after an already-existing effective scheduler is
separately proven. A configured hook, a unit test, CLI presence, or provider
contract documentation does not promote the tier.

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
lease ID, pinned peer, `schema_version="2"`,
`index_base="zero-based-jsonl-frame-index"`, and exact zero-based physical
JSONL frame range so the receiver can review provenance rather than treating
the envelope as ordinary direction. A legacy v1 envelope remains record-index
provenance; never reinterpret its range as Cursor frames.

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
polling only when effective scheduler proof exists; otherwise use manual
catch-up whenever a user needs dependable immediate control.

Use stateless, pinned observed-side review for normal collaboration and do not
advance another observer's target offset. A Stop-hook lease has its own private
cursor; it is not evidence that a background watcher remains active after the
hook returns. On any capability, identity, ordering, or lifecycle uncertainty,
fall back to a scheduled poll only when effective scheduler proof exists;
otherwise use buffered manual catch-up and disclose that no autonomous wake
exists.

Managed background-subagent completion plus `subagentStop` is a possible
stronger-tier probe, not an assumed upgrade. It may only be classified after a
live probe demonstrates that its completion signal reaches the same pinned
conversation safely and retains the same synthetic/no-op/loop protections.

## Evidence status (2026-07-24)

The bounded automated commands below passed at the recorded revision. The
collaboration suite covers adapter input validation, exact lease-session
binding, terminal success/non-success gates, pending completion, independent
loop limits, finite wait to `idle`, exact range/cursor claims, lease compare-and-
swap behavior, synthetic acknowledgement and `[no-op]` suppression, disarm and
prune cleanup, and the rule that idle/terminal leases do not resume on a later
generation. The paired runtime suite covers transcript-directory session
identity, `turn_ended` buffering, terminal diagnostics, and the
absent-tool-result fixture case.

```text
pnpm exec vitest run tests/session-observer-collab/cursor-hook.test.ts tests/session-observer-collab/control.test.ts tests/session-observer-collab/completion.test.ts tests/session-observer-collab/wake-envelope-contract.test.ts
pnpm exec vitest run tests/transcript-core/runtimes.test.ts
```

The Phase 6 live probes used the authenticated `agent` command in temporary
trusted workspaces with finite process and hook caps. Before invoking the
provider, each probe snapshotted the declared Cursor `projects` and `chats`
state roots. Cleanup removed only new direct children whose ownership was
proved by Cursor's exact encoded/compact workspace naming or bounded metadata
containing the exact workspace path; it then verified both the temporary
workspace and all four proved provider artifacts were absent. Pre-existing
entries are preserved, and any ambiguous new entry fails the probe without
being deleted. One probe targeted top-level `stop`; a second installed a fixed
project child definition while targeting `subagentStart`/`subagentStop`.
Neither project lifecycle hook produced an invocation record or same-parent
follow-up. The managed parent marker appeared, but the child marker was not
exposed in parent output. The probes retained no raw identity, transcript path,
provider prose, credential, or personal path and changed no provider
configuration. No complete live lifecycle,
Stop/`turn_ended` ordering, interaction-during-wait, restart/resume, recurring
loop, or scheduled-callback sequence passed, so those provider wake surfaces
are **unavailable** and buffered-manual is selected.

The 2026-07-24 release-gate rerun encountered declared provider-state roots
whose current contents exceeded the unchanged 256 MiB aggregate pre-snapshot
byte limit. Both `top-level-stop` and `managed-subagent` stopped before provider
launch with exit code 2, `executionStatus: safety-failed`,
`evidenceLabel: unavailable`, and the exact diagnostic
`provider-state-scan-byte-budget-exceeded`. Each structured boundary row
recorded `providerLaunchAttempted: false` and `workspaceExistsAfter: false`;
discovered, owned, removed, and residual provider-artifact counts were all
zero. No temporary probe workspace remained. This fresh safety result does not
rewrite the historical bounded callback-delivery measurements below and does
not promote a stronger wake tier.

| Acceptance area       | Current evidence                                                                                                                                                                 | Evidence label   | Live outcome                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| Cursor observed side  | Automated normalization plus a sanitized, exact-pinned live catch-up and finite foreground watch cover transcript identity, terminal success, and structural observation status. | `live-validated` | Passed against one available controlled Cursor session.                              |
| Cursor continuation   | Adapter tests cover exact range, counters, caps, suppression, CAS, and cleanup on temporary state. Phase 6 evaluated top-level Stop delivery live.                               | `unavailable`    | No provider callback or same-parent follow-up was delivered.                         |
| Cursor identity/order | Exact `conversation_id` lease binding and transcript identity are automated; live probes retained only structural identity booleans.                                             | `unavailable`    | No callback payload existed to prove same-parent identity or ordering.               |
| Cursor interaction    | Bounded adapter wait state is automated.                                                                                                                                         | `unavailable`    | No provider wake existed on which to test interaction or restart.                    |
| Stronger tier         | Phase 6 installed a fixed managed child definition, prompt, markers, and structural lifecycle hooks.                                                                             | `unavailable`    | The parent marker appeared; no child marker, project hook, or follow-up was exposed. |

## Measured capability matrix (2026-07-24)

This sanitized matrix refreshes the structural baseline first measured before
the streaming frame reader was implemented. It retains no transcript prose,
raw session, lease, or identity value, credential, personal hostname, or
personal absolute path. Version commands were rerun on the sanitized local
host; they did not launch a conversation or validate provider behavior.

| Capability                            | Host                             | Provider                           | Version                    | Store                                                                 | Path shape                                                                               | Record shape                                                                                                                | Identity                                                                                                            | Action                                                           | Outcome                                                                                                               | Evidence label   |
| ------------------------------------- | -------------------------------- | ---------------------------------- | -------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Agent-transcript structural baseline  | `Darwin arm64`; hostname omitted | Cursor desktop CLI                 | `3.11.13` (`arm64`)        | Local Cursor agent-transcript store                                   | `~/.cursor/projects/<encoded-project>/agent-transcripts/<session-id>/<session-id>.jsonl` | Closed JSONL frames have top-level `role` plus nested `message.content`; terminal frames have top-level `type` and `status` | Transcript directory and filename placeholders matched; device and inode availability was recorded only as booleans | `cursor --version`; structural-only local store inspection       | Store shape and provider version measured live; automated structural coverage passed; no lifecycle ordering claimed   | `live-validated` |
| Streaming frame and terminal variants | Synthetic repository fixtures    | Cursor transcript fixture contract | Repository revision        | `tests/session-observer/fixtures/cursor/framed-*.jsonl`               | Repository-relative fixture paths only                                                   | Closed, blank, malformed-middle, partial-tail, repaired, appended, and same-length-replaced frames                          | No session, lease, or provider identity stored                                                                      | Focused fixture and reader suites                                | Structural scenarios pass automated checks; fixture prose is explicitly synthetic                                     | `automated-only` |
| Terminal failure retention            | Synthetic repository fixtures    | Cursor transcript fixture contract | Repository revision        | Cursor terminal fixtures                                              | Repository-relative fixture paths only                                                   | `aborted`, `error`, and `cancelled` terminal outcomes remain diagnostics and do not promote provisional content             | No raw identity stored                                                                                              | Focused analyzer and runtime suites                              | Failure outcomes retained as failures; no success promotion                                                           | `automated-only` |
| Cursor agent CLI behavior             | `Darwin arm64`; hostname omitted | Cursor agent CLI and `agent` alias | `2026.07.23-e383d2b`       | Temporary workspace plus declared Cursor `projects` and `chats` roots | Personal paths omitted; exact provider names used only in memory for ownership proof     | Two finite provider runs with structural hooks, fixed prompts, markers, pre-snapshots, exact cleanup, and absence checks    | Raw provider identity omitted; no delivered lifecycle callback to compare                                           | Executable top-level Stop and managed-subagent callback probes   | Normal bounded exits; each run proved and removed four provider artifacts; no lifecycle hook or same-parent follow-up | `live-validated` |
| Stop-hook lifecycle continuation      | Sanitized local host             | Cursor top-level `stop` hook       | Agent `2026.07.23-e383d2b` | Owner-only collaboration lease plus pinned peer transcript            | Isolated temporary workspace; retained path omitted                                      | Current hook contract does not expose `followup_message` for top-level `stop`; controlled project hook was not invoked      | No provider identity retained; exact same-parent identity and ordering remain unproved                              | Finite read-only Cursor Agent probe plus automated adapter tests | Agent returned only the initial response; no callback record or same-parent follow-up was delivered                   | `unavailable`    |
| Background or other transcript stores | Sanitized local host             | Cursor background/other surfaces   | `unavailable`              | No candidate store produced by a controlled probe                     | Unmeasured                                                                               | Unmeasured                                                                                                                  | Unmeasured                                                                                                          | Preserve the non-claim until a controlled candidate exists       | Unavailable; no fallback store inferred                                                                               | `unavailable`    |

Evidence labels use the governing taxonomy row by row: `live-validated`,
`automated-only`, `documented-but-unvalidated`, `unavailable`, or
`unsupported`. Every row retains each required capability field; fixture-only
proof is always `automated-only`, and an absent probe surface is `unavailable`
or `unsupported` rather than promoted. Failure outcomes are retained as
failures and never relabeled as successful capability evidence.

## Observed-side acceptance (2026-07-24)

The finite acceptance harness passed all 19 expected/actual rows. Four rows used
one available controlled Cursor session with the provider transcript strictly
read-only and isolated temporary observer state. Fifteen rows used sanitized
fixture copies in temporary Cursor stores. The harness emitted structural JSON
only and retained no transcript text, raw session identity, lease identity,
credential, hostname, or personal absolute path.

```text
node scripts/probe-cursor-acceptance.mjs --runtime cursor --cwd "<requested-cwd>" --json
```

| Acceptance row               | Command status                  | Expected structural outcome                                         | Actual structural outcome                                                                                                                                      | Evidence label   |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Acting-side `whoami`         | Ran; finite; JSON parsed        | Structural identity result plus available provider version          | No acting Cursor identity was available; the non-identity result and Cursor 3.11.13 arm64 version were retained                                                | `live-validated` |
| Exact Cursor locate          | Ran; exit 0                     | Exact Cursor winner plus available provider version                 | One exact Cursor winner was available; provider version passed; raw identity and path were omitted                                                             | `live-validated` |
| Exact-pinned catch-up        | Ran; exit 0                     | Exact schema/index and healthy terminal read-only observation       | Digest schema 2; zero-based JSONL frame index; engagement engaged; assistant activity; content available; lifecycle success; delivery reserved; health healthy | `live-validated` |
| Bounded catch-up-then-watch  | Ran; exit 0; finite deadline    | One final `max-runtime` stop after baseline without command timeout | Positive finite runtime configured; baseline preceded exactly one final `max-runtime` stop; provider version passed                                            | `live-validated` |
| Second-scan stability        | Ran; exit 0                     | Stable content remains lifecycle-pending                            | Content available; lifecycle pending; health healthy                                                                                                           | `automated-only` |
| Success/abort/error/cancel   | All four ran; exit 0            | Preserve each terminal outcome                                      | Success remained success; abort, error, and cancel remained failures with provisional content suppressed                                                       | `automated-only` |
| Malformed and partial repair | Both before/after sequences ran | Resume from the verified boundary after repair                      | Malformed input failed closed before repair; partial input buffered; both resumed healthy after repair                                                         | `automated-only` |
| Shrink and replacement       | Both before/after sequences ran | Block unsafe continuity                                             | `TRANSCRIPT_SHRANK` and `TRANSCRIPT_REPLACED` retained as blocked outcomes                                                                                     | `automated-only` |
| Restart and reset/replay     | Both sequences ran              | Resume without replay; explicitly replay after reset                | Append resumed from the saved frame; reset replayed from frame zero                                                                                            | `automated-only` |

The live result promotes only observed-side reading and finite foreground watch
behavior for this measured store/version. It does not validate Stop-hook
ordering, same-conversation continuation, interaction during a hook wait,
restart/resume lifecycle behavior, recurring hook loops, scheduled callbacks,
or `subagentStop`; those rows remain `documented-but-unvalidated` or
`unavailable` as recorded above.

## Collaboration lifecycle acceptance (2026-07-23)

The provider-delivered Stop route was unavailable in this invocation: the
active provider hook routing did not point to the collaboration Stop hook, and
the probe did not widen authority by editing provider configuration. The
complete live lifecycle was unavailable on this measured route and the
operational fallback remains buffered manual catch-up.

The shipped control and hook entrypoints were still tested end to end with the
documented Stop payload on isolated temporary state. The peer transcript was a
copied sanitized repository fixture under a temporary Cursor store; no live
provider transcript was mutated. The retained command sequence uses
placeholders and omits raw session, lease, path, and transcript values:

```text
HOME="<temporary-home>" node skills/session-observer-collab/scripts/collab-control.mjs arm \
  --runtime cursor --peer-runtime cursor \
  --session "<owner-session>" --peer-session "<peer-session>" \
  --cwd "<temporary-cwd>" --peer-transcript "<temporary-cursor-transcript>" \
  --wait-ms 100 --lease-ms 60000 --continuation-cap 2 --loop-cap 2 \
  --cursor 0 --json

printf '%s\n' '{"conversation_id":"<owner-session>","generation_id":"<generation-id>","status":"success","loop_count":0}' |
  HOME="<temporary-home>" node skills/session-observer-collab/scripts/hooks/cursor-stop.mjs

HOME="<temporary-home>" node skills/session-observer-collab/scripts/collab-control.mjs status \
  --session "<owner-session>" --json
HOME="<temporary-home>" node skills/session-observer-collab/scripts/collab-control.mjs disarm \
  --session "<owner-session>" --json
HOME="<temporary-home>" node skills/session-observer-collab/scripts/collab-control.mjs prune \
  --session "<owner-session>" --json
```

| Acceptance row              | Expected structural outcome                                                      | Actual structural outcome                                                                                  | Evidence label   |
| --------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------- |
| Exact finite lease arm      | Exact owner/peer/path binding; cursor 0; finite wait, lease, continuation, loops | New lease armed on temporary state                                                                         | `automated-only` |
| Successful Stop hook        | Exactly one synthetic follow-up for one completed substantive peer turn          | One follow-up emitted for exact zero-based JSONL frame range `0-5`                                         | `automated-only` |
| Post-trigger status         | Advance the private cursor and both counters exactly once                        | State returned to `armed`; cursor 6, continuation count 1, loop count 1                                    | `automated-only` |
| Failure and pending gates   | Failure outcomes and pending completion emit no follow-up                        | Focused tests preserved failure outcomes and suppressed pending completion                                 | `automated-only` |
| No-op and replay gates      | `[no-op]`, synthetic acknowledgement, stale claim, and replay emit no follow-up  | Focused tests suppressed all four paths; stale compare-and-swap claim did not consume another continuation | `automated-only` |
| Disarm and cleanup          | Explicit disarm, targeted prune, and no late wake                                | Lease changed to `disarmed`; targeted prune removed one lease; focused tests suppressed late wake          | `automated-only` |
| Provider-delivered callback | The active Cursor conversation delivers Stop to the collaboration hook           | Unavailable; no provider route to this hook was established                                                | `unavailable`    |

This automated sequence proves the bounded shipped entrypoint behavior only. It
does not prove provider callback delivery, Stop relative to `turn_ended`,
same-conversation follow-up generation, user interaction during the wait,
restart/resume, recurring live loops, or `subagentStop`.

## Same-parent Stop callback evaluation (2026-07-24)

A controlled Cursor Agent run evaluated the real top-level `stop` surface in
a trusted temporary workspace. The executable probe creates the exact project
`hooks.json`, a structural-only logger/follow-up hook, fixed prompt and
markers, and snapshots the declared Cursor `projects` and `chats` roots before
provider invocation. It removes only exact new ownership-proven state and
verifies absence afterward; pre-existing state is preserved and ambiguous new
state fails closed. The hook has a ten-second timeout and one-loop cap. An
independent parent-process timer enforces the 90-second Agent cap with
termination and kill fallback; this is separate from the provider hook
timeout.

```text
node scripts/probe-cursor-wake-surfaces.mjs --describe --json
node scripts/probe-cursor-wake-surfaces.mjs --mode top-level-stop --json
```

The measured command emitted this sanitized structural result. It retained no
provider prose, raw identity, credential, personal path, or transcript content:

```json
{
  "mode": "top-level-stop",
  "provider": {
    "name": "Cursor Agent",
    "version": "2026.07.23-e383d2b",
    "architecture": "arm64"
  },
  "bounds": {
    "processCapMs": 90000,
    "hookTimeoutSeconds": 10,
    "followupLoopLimit": 1
  },
  "safety": {
    "workspacePolicy": "exact-created-workspace",
    "providerStatePolicy": "snapshot-new-exact-owned-remove",
    "preExistingArtifacts": "preserved",
    "ambiguousArtifacts": "fail-without-removal"
  },
  "setup": {
    "hooksConfigVersion": 1,
    "hookEvents": ["stop"],
    "hookScriptPresent": true,
    "childDefinitionPresent": false,
    "fixedPrompt": true,
    "fixedMarkers": [
      "CURSOR_WAKE_PROBE_STOP_INITIAL",
      "CURSOR_WAKE_PROBE_STOP_FOLLOWUP"
    ]
  },
  "rows": [
    {
      "id": "provider-version",
      "expected": { "available": true },
      "actual": { "available": true },
      "status": "passed"
    },
    {
      "id": "bounded-provider-process",
      "expected": { "commandRun": true, "exitCode": 0, "timedOut": false },
      "actual": { "commandRun": true, "exitCode": 0, "timedOut": false },
      "status": "passed"
    },
    {
      "id": "lifecycle-hooks",
      "expected": { "top-level-stop": 1 },
      "actual": { "top-level-stop": 0 },
      "status": "unavailable"
    },
    {
      "id": "fixed-markers",
      "expected": {
        "CURSOR_WAKE_PROBE_STOP_INITIAL": true,
        "CURSOR_WAKE_PROBE_STOP_FOLLOWUP": true
      },
      "actual": {
        "CURSOR_WAKE_PROBE_STOP_INITIAL": true,
        "CURSOR_WAKE_PROBE_STOP_FOLLOWUP": false
      },
      "status": "unavailable"
    },
    {
      "id": "surface-outcome",
      "expected": { "callbackDelivered": true },
      "actual": {
        "callbackDelivered": false,
        "outcome": "callback-unavailable"
      },
      "status": "unavailable"
    },
    {
      "id": "provider-state-boundary",
      "expected": {
        "snapshotSucceeded": true,
        "ambiguousCount": 0,
        "existsAfterCount": 0
      },
      "actual": {
        "snapshotSucceeded": true,
        "ambiguousCount": 0,
        "existsAfterCount": 0
      },
      "status": "passed"
    }
  ],
  "cleanup": {
    "attempted": true,
    "succeeded": true,
    "workspaceExistsAfter": false,
    "providerArtifacts": {
      "declaredRootCount": 2,
      "snapshotSucceeded": true,
      "discoveredNewCount": 4,
      "ownershipProvenCount": 4,
      "ambiguousCount": 0,
      "removedCount": 4,
      "existsAfterCount": 0,
      "succeeded": true
    },
    "diagnostic": "removed-exact-probe-state"
  }
}
```

The current installed Cursor hook contract lists `followup_message` for
`subagentStop`, not for top-level `stop`. During the controlled run, the agent
returned only the requested initial response. The project `stop` hook produced
no structural invocation record, so there was no callback from which to prove
exact owner identity, one-consumer delivery, v2 envelope delivery, duplicate
suppression, or disarm/restart recovery. The temporary workspace and all four
new exact ownership-proven provider artifacts were removed and independently
verified absent after the probe; no provider configuration or pre-existing
provider state was mutated.

| Probe facet              | Expected structural outcome                                                | Actual structural outcome                                                     | Evidence label   |
| ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| Provider/version         | Authenticated finite Cursor Agent invocation                               | Agent `2026.07.23-e383d2b` ran and exited successfully within the process cap | `live-validated` |
| Top-level callback       | Exactly one `stop` hook invocation for the same parent                     | No project-hook invocation record was produced                                | `unavailable`    |
| Same-parent v2 delivery  | One redacted v2 envelope delivered back into the originating conversation  | Only the initial response was returned; no follow-up response was delivered   | `unavailable`    |
| Identity/one consumer    | Exact identity equality and exactly one consumer confirmed without raw IDs | Not measurable because no callback payload was delivered                      | `unavailable`    |
| Recovery and suppression | Disarm/restart plus duplicate suppression exercised after a delivered wake | Not run because the prerequisite callback surface was unavailable             | `unavailable`    |

No top-level Stop adapter is shipped from this result. Lifecycle continuation
remains unavailable on the measured path, and buffered-manual catch-up remains
the operational fallback pending evaluation of an already-existing managed
callback surface.

## Managed and scheduled callback evaluation (2026-07-24)

Because the same-parent top-level Stop route was unavailable, a second
controlled Cursor Agent run evaluated the existing managed `Subagent` surface.
The same executable probe creates an isolated project `hooks.json`, the
structural logger/follow-up hook, and a fixed `.cursor/agents/` child
definition. That child can only return fixed markers and has no file, shell,
network, or credential task. The hook timeout is ten seconds with a one-loop
cap, while an independent parent-process timer enforces the 120-second Agent
cap. The same pre-snapshot, exact ownership proof, targeted removal, and final
absence checks cover the temporary workspace and both declared provider-state
roots.

```text
node scripts/probe-cursor-wake-surfaces.mjs --mode managed-subagent --json
```

The rerun emitted this sanitized structural result:

```json
{
  "mode": "managed-subagent",
  "provider": {
    "name": "Cursor Agent",
    "version": "2026.07.23-e383d2b",
    "architecture": "arm64"
  },
  "bounds": {
    "processCapMs": 120000,
    "hookTimeoutSeconds": 10,
    "followupLoopLimit": 1
  },
  "safety": {
    "workspacePolicy": "exact-created-workspace",
    "providerStatePolicy": "snapshot-new-exact-owned-remove",
    "preExistingArtifacts": "preserved",
    "ambiguousArtifacts": "fail-without-removal"
  },
  "setup": {
    "hooksConfigVersion": 1,
    "hookEvents": ["subagentStart", "subagentStop"],
    "hookScriptPresent": true,
    "childDefinitionPresent": true,
    "fixedPrompt": true,
    "fixedMarkers": [
      "CURSOR_WAKE_PROBE_MANAGED_CHILD",
      "CURSOR_WAKE_PROBE_MANAGED_PARENT",
      "CURSOR_WAKE_PROBE_MANAGED_FOLLOWUP"
    ]
  },
  "rows": [
    {
      "id": "provider-version",
      "expected": { "available": true },
      "actual": { "available": true },
      "status": "passed"
    },
    {
      "id": "bounded-provider-process",
      "expected": { "commandRun": true, "exitCode": 0, "timedOut": false },
      "actual": { "commandRun": true, "exitCode": 0, "timedOut": false },
      "status": "passed"
    },
    {
      "id": "lifecycle-hooks",
      "expected": {
        "subagent-start": 1,
        "managed-subagent-stop": 1
      },
      "actual": {
        "subagent-start": 0,
        "managed-subagent-stop": 0
      },
      "status": "unavailable"
    },
    {
      "id": "fixed-markers",
      "expected": {
        "CURSOR_WAKE_PROBE_MANAGED_CHILD": true,
        "CURSOR_WAKE_PROBE_MANAGED_PARENT": true,
        "CURSOR_WAKE_PROBE_MANAGED_FOLLOWUP": true
      },
      "actual": {
        "CURSOR_WAKE_PROBE_MANAGED_CHILD": false,
        "CURSOR_WAKE_PROBE_MANAGED_PARENT": true,
        "CURSOR_WAKE_PROBE_MANAGED_FOLLOWUP": false
      },
      "status": "unavailable"
    },
    {
      "id": "surface-outcome",
      "expected": { "callbackDelivered": true },
      "actual": {
        "callbackDelivered": false,
        "outcome": "callback-unavailable"
      },
      "status": "unavailable"
    },
    {
      "id": "provider-state-boundary",
      "expected": {
        "snapshotSucceeded": true,
        "ambiguousCount": 0,
        "existsAfterCount": 0
      },
      "actual": {
        "snapshotSucceeded": true,
        "ambiguousCount": 0,
        "existsAfterCount": 0
      },
      "status": "passed"
    }
  ],
  "cleanup": {
    "attempted": true,
    "succeeded": true,
    "workspaceExistsAfter": false,
    "providerArtifacts": {
      "declaredRootCount": 2,
      "snapshotSucceeded": true,
      "discoveredNewCount": 4,
      "ownershipProvenCount": 4,
      "ambiguousCount": 0,
      "removedCount": 4,
      "existsAfterCount": 0,
      "succeeded": true
    },
    "diagnostic": "removed-exact-probe-state"
  }
}
```

The managed parent marker was returned, but the child marker was not exposed
in the parent output and neither project lifecycle hook produced an invocation
record. This run therefore did not independently promote native child
execution, managed callback effectiveness, or same-parent delivery. Without a
delivered callback, exact ownership, start/stop pairing, one-consumer
semantics, interruption/restart behavior, duplicate suppression, and bounded
recovery could not be promoted.

The existing scheduled-surface inventory found no Cursor or Session Observer
cron entry and no matching LaunchAgent. The Cursor Agent CLI exposes no
scheduled callback command. Its private cloud `worker` command requires an
operator-managed authentication token and a long-running service; starting it
would introduce the exact credential, external service, and daemon authority
this phase forbids, so it was not run. Both temporary probe workspaces and each
run's four exact ownership-proven provider artifacts were removed and verified
absent after their finite invocations. The probe preserved all pre-existing
provider entries.

| Candidate surface                    | Required proof                                                                  | Actual structural outcome                                                                                           | Evidence label |
| ------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------- |
| Managed local `subagentStop`         | One paired child lifecycle callback delivers one v2 wake to the exact parent    | Fixed managed prompt returned its parent marker, but no child marker, project-hook record, or follow-up was exposed | `unavailable`  |
| Exact ownership and one consumer     | Parent/child identities match structurally and exactly one callback is consumed | Not measurable because no managed callback payload was delivered                                                    | `unavailable`  |
| Interruption/restart and suppression | Finite interruption, restart, duplicate suppression, and cleanup all pass       | Prerequisite callback delivery was unavailable; exact temporary and provider-state cleanup passed                   | `unavailable`  |
| Existing scheduled callback          | An already-running deterministic surface submits a future pinned catch-up       | No Cursor/observer cron, LaunchAgent, or Cursor scheduler command was available                                     | `unavailable`  |
| Cursor private cloud worker          | Existing authorized local callback with no new credential, daemon, or service   | Requires a token and long-running external-service connection; deliberately not started                             | `unsupported`  |

No managed or scheduled adapter is shipped from these results. Buffered-manual
catch-up remains the strongest evidence-backed tier on the measured Cursor
surfaces.

## Selected tier and backlog disposition

The selected Cursor wake tier is **buffered-manual**. Top-level Stop,
managed-subagent callback, and scheduled-poll are not selected; their measured
surfaces are `unavailable`, while the private cloud worker route is
`unsupported` by this project's authority boundary.

The stronger-wake backlog acceptance criteria are satisfied as an
evidence-backed investigation outcome:

- the capability inventory is versioned and records effectiveness separately
  from configuration presence;
- no unavailable surface was selected for implementation;
- the existing bounded adapter suites cover success, late and non-success
  completion, duplicate suppression, restart boundaries, disarm, cleanup, and
  honest fallback;
- the runtime and user-facing documentation preserve exact probe evidence and
  support labels.

Terminal backlog mutation was completed atomically in p06-t04 after the
evidence-backed investigation selected no stronger surface.

The post-implementation probe will:

1. Create one controlled synthetic Cursor turn and record provider version,
   redacted path shape, top-level keys, content-block types, terminal status,
   newline closure, and file-identity availability.
2. Scan closed, blank, malformed-middle, partial-tail, repaired, appended, and
   same-length replaced fixtures using zero-based physical frame indexes.
3. Confirm that a requested verified prefix is snapshotted at the exact byte
   boundary while later appended bytes remain permitted.
4. Record only structural labels, byte/index relationships, hashes compared as
   booleans, and expected-versus-actual outcomes; do not retain hashes, raw
   identities, paths, credentials, or transcript prose.
5. Keep every unexecuted store, path, record, identity, or lifecycle row
   unsupported or documented-but-unvalidated.

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
