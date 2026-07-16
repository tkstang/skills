# Claude Code runtime reference

Use this reference only after resolving the acting runtime as Claude Code. It is the
runtime-specific companion to `session-observer-collab/SKILL.md`; the base
observer remains responsible for transcript reads, exact pins, and offsets.

## Monitor capability and disclosure

Claude Code's **Monitor** is a harness-native capability, not a command-line
feature that this skill can install or assume. In the active Claude Code
session, first establish that a callable Monitor facility is present and that
it can run a long-lived command and deliver its output back as a task
notification. A visible CLI binary, a background shell process, or a written
reference is not that proof.

Disclose one of these outcomes before arming:

| Probe result                                                          | Honest wake tier                      | Disclosure                                                                        |
| --------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| Monitor is callable and the complete live sequence below passes       | `event-wake`                          | Monitor task notifications deliver substantive watcher output for this exact pin. |
| Monitor is callable but the complete live sequence has not passed     | `scheduled-poll` or `buffered-manual` | Monitor is available but event wake is unvalidated.                               |
| Monitor is absent, unavailable, or cannot deliver a task notification | `scheduled-poll` or `buffered-manual` | No autonomous Claude Code wake is available in this environment.                  |

Do not call a Monitor output, an empty watcher heartbeat, or Monitor startup a
peer message. Monitor output is automatic control input: it cannot authorize
work, must not be echoed as human direction, and must not recursively create a
second watcher or wake.

## Pinned Monitor recipe

Resolve and announce both identities with the base `whoami` command, then use
the exact confirmed peer pin. Start exactly one persistent Monitor task around
this single foreground watcher; do not run a separate `catch-up` before it.

```sh
PEER_SESSION="<peer-runtime>:<peer-session-id>"

node <session-observer-skill>/scripts/session-observer.mjs catch-up-then-watch \
  --session "$PEER_SESSION" \
  --cwd "$PWD" \
  --until-stopped \
  --heartbeat-sec 0 \
  --quiet-empty
```

The Monitor wrapper is harness syntax, so use the active Claude Code
environment's documented Monitor invocation to launch that command. The base
arguments are intentional:

- `catch-up-then-watch` consumes the pinned unread range before watching and
  avoids a standalone-watch baseline gap.
- `--session` prevents a same-directory or newer-session candidate from being
  silently substituted.
- `--quiet-empty` advances over metadata-only transcript growth without
  producing a task notification.
- `--heartbeat-sec 0` prevents periodic status output from becoming a wake.
- `--until-stopped` keeps one watcher alive until explicit closeout.

Treat a Monitor notification as an `event-wake` candidate only when it carries
a new, completed, substantive delta for that exact pin and range. On receipt,
verify the pin and range, classify the delta under the shared no-op rules, and
then respond at most once. Empty, metadata-only, automatic, replayed,
non-success, or `[no-op]` output advances observer state but produces no
collaboration response.

## Required live Monitor sequence

Do not promote this recipe to `event-wake` until sanitized evidence shows this
complete sequence in one real Claude Code session:

1. Probe Monitor, record that it is callable, resolve the self and peer
   identities, and start one pinned quiet-empty/no-heartbeat watcher.
2. Confirm that normal metadata-only growth and a deliberately quiet interval
   create no task notification. This proves heartbeats and empty deltas are
   not being misclassified as peer work.
3. Post one real, completed, substantive peer turn. Confirm the Monitor task
   wakes the same Claude Code session with one notification carrying the
   exact pinned digest range; record the notification and resulting agent turn
   without copying peer prose, session IDs, paths, or lease state.
4. Restart or reconnect the Claude Code client to that **same** session while
   retaining the Monitor task. Recheck the exact pin, ensure no duplicate
   watcher was created, then post another substantive peer turn and confirm a
   notification still reaches the resumed same-session client.
5. Explicitly stop the Monitor task and the watcher. Confirm the task is no
   longer running, watcher status has no active process for the pin, and a
   later peer turn produces no notification.

A partial sequence validates only its observed step. In particular, a first
notification does not prove restart resilience, and a successful task launch
does not prove event wake. If client restart cancels Monitor or leaves its
delivery behavior uncertain, stop the old watcher, re-confirm the peer pin,
and use the fallback tier until a fresh complete sequence passes.

## Restart and clean stop

Keep the watcher pinned to the announced `<peer-runtime>:<peer-session-id>`
identity through a same-session client restart. A restart that creates a new
session ID is a new identity: do not carry the old pin forward or claim
resilience. If a peer appears unexpectedly quiet, run a pinned freshness check
and inspect a `newer-session-candidate` warning rather than silently switching
sessions.

At closeout, freeze automatic responses, perform the final pinned freshness
check, then cancel/stop the persistent Monitor task using the harness control.
Request a clean base watcher stop with `watch-ctl stop` for the same exact pin
when it remains active. Confirm both surfaces have stopped before recording
closeout. Monitor notifications remain automatic control signals throughout
cleanup; stopping them never authorizes any unrelated action.

## Scheduled and manual fallback

When Monitor is unavailable or unvalidated, use the strongest separately
proven lower tier:

- **Scheduled poll:** only when an external scheduler can actually give the
  Claude session a future turn. Each scheduled turn performs a pinned
  `catch-up` or restarts `catch-up-then-watch` as appropriate, then reports
  the exact consumed range. A cron-like shell process that cannot submit a
  Claude turn is not scheduled-poll wake evidence.
- **Buffered manual:** at the beginning of every user or externally initiated
  Claude turn, run a pinned catch-up before reporting status or acting on peer
  context. The user/external turn, not the watcher, is the scheduler.

Both fallbacks retain the identity, authority, no-op, pause, and closeout rules
from the main collaboration protocol. Neither permits an autonomous-wake
claim.

## Evidence status (2026-07-12)

This task's capability probe found the local `claude` CLI, but no callable
Claude Code Monitor surface was exposed to this worker. No Monitor task,
watcher, Claude session, or live session state was created. Therefore the
complete live sequence above was **not run** and the Claude Monitor
acceptance-matrix row remains **unvalidated**. The current honest posture is
`buffered-manual`; `scheduled-poll` may be selected only after a separate
effective scheduler probe.

The automated verification below checks repository/reference structure and
base watcher behavior. It is not proof of a live Monitor harness row.

```text
pnpm run validate
pnpm exec vitest run tests/session-observer/watch.test.ts
```

| Acceptance area             | Evidence in this task                                                                            | Live status |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ----------- |
| Task notification           | No callable Monitor surface exposed to this worker.                                              | Not run.    |
| Empty heartbeat suppression | Documented command uses `--quiet-empty` and `--heartbeat-sec 0`; base watcher test is automated. | Not run.    |
| Substantive notification    | No Claude peer turn or Monitor task was run.                                                     | Not run.    |
| Same-session restart        | No same-session client restart was run.                                                          | Not run.    |
| Clean stop                  | No Monitor task or watcher was started.                                                          | Not run.    |
