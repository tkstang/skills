# Codex delivery boundary

## Capability labels

Documentation, fixture coverage, installation, trust, invocation, recipient
context, Stop continuation, and cleanup are separate facts. The bundled
`scripts/hooks/codex.mjs` adapter is fixture-tested. It is not installed,
trusted, invoked, or live-proven merely because the skill is present.

## Scoped inventory and ownership

Registration uses an explicitly supplied absolute `hooks.json` and hook script
path. Inspection reads the effective `Stop` command entries without executing
them. A recognized `session-observer-collab` launcher is inert when the exact
session has no lease or a validated idle/disarmed lease. Armed, waiting, or
triggered leases own continuation; triggered remains owner-present after nominal
expiry. Invalid/unreadable state refuses automatic delivery and reports:

```bash
node <observer-collab-skill>/scripts/collab-control.mjs disarm \
  --session <native-owner-session>
```

Run that command only after the current observer continuation finishes.
Messaging never disarms or removes the observer. Unrecognized Stop commands
require explicit acknowledgment of the current canonical inventory fingerprint.
A changed inventory requires disable/re-enable and fresh acknowledgment.

## Boundary contract

The adapter accepts exact native session ID, absolute cwd, boundary name, and a
stable native event ID. Missing event identity, identity/worktree mismatch,
continuation markers, inactive/expired activation, uncertain ownership, or
changed hook inventory emit no host protocol. A proven human prompt may renew a
human-idle activation; prompt-shaped callbacks without trusted provenance do
not. Stop defaults to zero wait and is capped at 60 seconds when explicitly
configured. Errors and interruption allow Stop.

Prompt context and Stop responses contain at most 6,000 characters of
attributed untrusted peer content. Larger bodies are replaced with exact message
IDs and full-read commands. Output is attempt evidence, not acknowledgment or
delivery proof; diagnostics are bounded and redacted on stderr/storage.

## Registration and trust

`delivery register` preserves unrelated hooks and installs only the exact
UserPromptSubmit/Stop command. `delivery unregister` removes only that command.
Command content changes may require renewed `/hooks` trust. Neither operation
proves invocation or live delivery. Live acceptance remains opt-in and is
recorded separately in `live-acceptance.md`.
