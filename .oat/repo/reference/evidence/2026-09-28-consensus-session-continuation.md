# Consensus provider session continuation — verification record

Date: 2026-09-28. Branch: `feat/consensus-session-continuation`. All live
runs used synthetic markers in disposable workspaces under `/tmp`, with
prompts and schemas kept outside the workspace.

## Installed CLIs

| Provider | Executable | Version |
| --- | --- | --- |
| Claude | `claude` | Claude Code 2.1.284 |
| Codex | `codex` | codex-cli 0.157.1 |
| Cursor | `cursor-agent` | 2026.09.28-64d2043 |

## Capability matrix

| Provider | Documented by provider | Accepted by installed CLI | Live raw-CLI smoke | Through `consensus run` | Adapter capability |
| --- | --- | --- | --- | --- | --- |
| Claude | `--print --resume <id>` | yes | passed | passed | `verified` |
| Codex | `exec resume <id>` | yes (`--sandbox` rejected on resume) | passed | passed | `verified` |
| Cursor | `--resume [chatId]`, JSON `session_id` | `--resume` listed in help | passed 2026-09-29 (answer replayed once on reconnect) | refused (`PROVIDER_UNSUPPORTED_OPTION`) | `unverified` |

## Raw CLI findings (earlier pass, same date)

- Codex: the session ID is the first JSONL event, `thread.started.thread_id`.
  `exec resume` rejects `--sandbox`; `-c sandbox_mode=` and
  `-c approval_policy=` hold on the resumed turn (rollout `turn_context`).
  An unknown UUID exits 1 with `no rollout found for thread id` on stderr. A
  non-UUID that matches no thread name silently starts a **new** thread
  (exit 0).
- Claude: the session ID and `modelUsage` come from the result JSON.
  Resuming without `--model` kept the session's model. An unknown UUID exits 1
  with `No conversation found with session ID` on stderr. `--resume` also
  accepts a session title.
- Design consequences: session UUIDs only, a session-identity check on every
  resumed turn, and not-found classification from stderr only.

## Wrapper-path results (`node plugins/consensus/scripts/consensus.mjs run`)

Codex (`gpt-6-luna`, low effort, `--sandbox read-only`) and Claude
(`claude-haiku-4-5-20251001`, low effort, `--permission-mode read-only`):

1. Session A (marker 1) and session B (marker 2) started as `mode: new`,
   `round: 1`, with session IDs captured from provider output.
2. A follow-up that contained no marker resumed A and then B in separate
   processes (`--resume <id> --round 2`). Each returned only its own marker
   with the rule applied. `mode: native-resume`, and `session_id` equalled
   `requested_session_id`.
3. Each workspace stayed clean (`git status --porcelain` empty). The Codex
   rollout for the resumed turn shows `sandbox: read-only`,
   `approval: never`, and the same model and effort.
4. Codex also:
   - An unknown UUID returned `PROVIDER_SESSION_NOT_FOUND` with
     `turn: not_started`.
   - The same call with `--resume-fallback reconstructed` returned
     `mode: reconstructed`, a new session, the predecessor recorded, and
     `fallback_reason: session_not_found`. The peer stated it had no memory
     of an earlier conversation.
   - An explicit `--continuation reconstructed --previous-session <A>`
     returned `mode: reconstructed` with a new session ID.
   - `--resume my-title` was rejected with `CONSENSUS_CLI_USAGE` before any
     provider call.
5. Claude: an unknown UUID returned `PROVIDER_SESSION_NOT_FOUND` with
   `turn: not_started`.
6. Cursor: `--resume <uuid>` returned `PROVIDER_UNSUPPORTED_OPTION` with no
   provider call.

## Cursor status

The earlier pass on this date saw `cursor-agent status` report "Not logged
in". A later check showed a logged-in Cursor team account, and the user
authorized a live test with `cursor-grok-4.6-high`. The raw-CLI attempt used a
disposable workspace, `--print --output-format json --mode ask --sandbox
enabled --trust`, and no `--force`. Every agent call failed before any turn:
three "Connection lost, reconnecting to https://agentn.global.api5.cursor.sh"
retries, then `RetriableError: WritableIterable is closed`, exit 1, empty
stdout. The failure reproduced on the default model and on grok 4.6 high, with
and without ask mode and the sandbox, with the prompt on stdin or as an
argument, and with the calling shell's sandbox disabled. A plain HTTPS request
to the same host returned 200, and `cursor-agent status` and `about`
succeeded. So the agent's streaming connection, not authentication, is
failing. No workaround was attempted.

Resolution (2026-09-29): both machines had `"network": {"useHttp1ForAgent":
false}` set explicitly in `~/.cursor/cli-config.json`. With the user's approval
it was set to `true` on the mini and the laptop, with backups saved at
`cli-config.json.bak-http1-20260929`. After that, programmatic calls worked from
the user's terminal. Agent shells could no longer see the keychain-held login
("Not logged in"), so the user ran the raw marker test:

- Sessions A (`c246fef9…`) and B (`4af0cecd…`) were started with
  `cursor-grok-4.6-high`, `--print --output-format json --mode ask --sandbox
  enabled --trust`, the prompt on stdin, and no `--force`.
- `--resume <A>` and `--resume <B>` in separate processes returned each
  session's own marker, uppercased. Each `session_id` was unchanged, and the
  workspace stayed clean.
- On both resumed turns, stderr showed "Connection lost, reconnecting to
  https://api2.cursor.sh … Retry attempt 1", and `result` contained the answer
  twice in a row. Cursor's transport retry replayed the turn.

Status: raw-CLI native resume works. The wrapper resume path is not
implemented, and the replay contradicts the wrapper's no-duplicate-turn
guarantee, so the adapter stays `unverified`.

The same test also showed that `--print` with the prompt on stdin works. The
one-shot adapter had been omitting `--print`, although `--output-format` only
applies in print mode. It now passes `--print`.

## Review

- A design consult with a peer (`gpt-6-astra`, high effort, run through this
  wrapper) found a duplicate-turn hole: not-found text quoted in peer output,
  followed by a nonzero exit, triggered a reconstructed fallback. It is fixed
  by the stderr-only match plus a session-evidence gate, and covered by a
  regression test that fails on the old classifier.
- Round 2 of the same consult was a native resume of the peer's session
  through this wrapper (same `thread_id`, `mode: native-resume`, round 2).
  The peer confirmed both fixes and raised two narrow gaps, both now closed:
  - Output with a trailer that doesn't parse still read as "no session", so
    a rejection or `not_started` now requires empty stdout. A regression row
    covers the counterexample.
  - An automatic fallback could exceed phone-a-friend's call budget, so the
    skill now requires two remaining calls and half the remaining time
    before enabling it.
- A `codex review --uncommitted` on `gpt-6-sol` at xhigh found no runtime
  defects and three documentation defects, all fixed:
  - Reconstructed rounds were missing the read-only control.
  - The follow-up commands applied one provider's flags to all providers (a
    Claude sandbox flag, and model/effort for Cursor).
  - The plugin README still described phone-a-friend as one-shot only.

## Cursor one-shot through the wrapper (after the `--print` fix)

On 2026-09-29 the user ran this from their own terminal:
`node plugins/consensus/scripts/consensus.mjs run --provider cursor` with the
advisory schema.

- `ok: true` with a schema-valid advisory.
- Argv: `cursor-agent --print --output-format json --force`.
- `continuation.mode: new`, with `session_id` (`94dba5ea…`) taken from
  Cursor's JSON output.
- `verdict_source: submit`: under `--force`, the peer ran `consensus submit`.
- The answer cited facts that appear only in the repository's
  continuation-packet example, not in the prompt. Under `--force`, the one-shot
  Cursor peer reads the workspace freely. That is expected for this policy, but
  it means one-shot Cursor advice is not limited to the prompt, and the
  workspace is not read-only.

## Cursor read-only policy (2026-09-29)

The user ran `/tmp/cursor-trust-test.sh`, where each case gets a brand-new git
workspace. All cases used `--print --output-format json --mode ask --sandbox
enabled`, with no `--force`:

1. Without `--trust`: exit 1 after 0 s. The error was "Workspace Trust
   Required… Pass --trust, --yolo, or -f". Print mode fails fast; it does not
   hang.
2. With `--trust`, a ping: `pong`, and the workspace was unchanged.
3. With `--trust`, a list-then-write prompt: the peer ran `ls -la` and
   refused to create `probe.txt` ("Ask mode only allows read-only tools").
   There was no hang and the workspace was unchanged.

So `--force` bypasses the trust check only as a side effect, and `--trust
--mode ask --sandbox enabled` works as a read-only replacement. It now ships
as the opt-in `--permission-mode read-only` for Cursor.
