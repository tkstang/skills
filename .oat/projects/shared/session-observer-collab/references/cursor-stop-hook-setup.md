# Cursor Stop-Hook Continuation Contract

Cursor documents bounded generation chaining through a Stop hook. This recipe
is **documented but not live-validated in this run**. Until the acceptance
matrix passes, report scheduled polling as the operational floor.

## Capability classification

Classify this as `lifecycle-continuation`: Cursor ends the current generation,
submits `followup_message` as a synthetic user-shaped control message, and
starts a new generation. Once the Stop hook returns and the conversation is
idle, arbitrary background output cannot wake it.

## Hook contract

Documented Stop-hook inputs:

- `conversation_id`
- `generation_id`
- `status`
- `loop_count`

The only continuation output is:

```json
{
  "followup_message": "<session_observer_wake ...>...</session_observer_wake>"
}
```

Requirements:

- Continue only after a completed/successful status and a substantive completed
  peer delta.
- Set the hook timeout slightly above the configured catch window and fail
  open when the hook cannot decide safely.
- Respect Cursor's configurable `loop_limit` (default 5) and also enforce the
  collaboration lease's independent finite expiry and continuation cap.
- Use a Cursor-private consumer cursor or stateless review; never advance
  another observer's target offset.
- Record `conversation_id`, `generation_id`, `loop_count`, lease ID, exact peer
  range, and terminal outcome as control provenance.

## Synthetic control envelope

`followup_message` is serialized through a user-message-shaped channel but is
not human input. Emit a machine-readable envelope such as:

```xml
<session_observer_wake automatic="true"
  runtime="cursor"
  lease_id="LEASE_ID"
  peer="claude-code:PEER_SESSION_ID"
  records="120-145">
Review the pinned peer range and respond only if it contains substantive new information.
</session_observer_wake>
```

The base renderer must label this as `Hook/control (automatic)`, never `User`.
It cannot carry human authorization. Wake filters must suppress nested or
replayed synthetic envelopes so collaboration hooks cannot recursively treat
their own control messages as peer direction.

## Cursor turn buffering

Cursor transcript activity is provisional until the top-level completion
record arrives:

```json
{ "type": "turn_ended", "status": "success" }
```

Default observer behavior:

- Buffer planning text, assistant fragments, and tool calls until `turn_ended`.
- For `success`, emit one completed turn containing the final assistant response.
- Show intermediate planning/tool activity only in explicit debug mode.
- For `aborted`, `error`, or `cancelled`, emit a terminal diagnostic with the
  status, do not present provisional planning as the agent's position, and do
  not trigger ordinary peer collaboration automatically.
- Define transcript-rotation and restart behavior without guessing completion.

## Required live probes

- Map `conversation_id` to the transcript-directory session ID.
- Establish ordering between `turn_ended` and Stop-hook invocation.
- Prove recurring follow-ups and `loop_count` behavior.
- Exercise aborted, error, and cancelled generations.
- Measure user input while the Stop hook waits.
- Test restart/resume behavior.
- Verify `[no-op]`, empty-delta, and synthetic-message suppression.
- Determine whether managed background-subagent completion plus
  `subagentStop` offers a stronger wake tier.

Promote Cursor from documented to validated `lifecycle-continuation` only after
arm → peer post → synthetic follow-up → new generation → disarm succeeds.
