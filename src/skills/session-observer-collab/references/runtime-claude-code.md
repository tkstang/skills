# Claude Code runtime reference

## Messaging composition status

The legacy base-observer Monitor below remains observation-only: it is not an
agent-messaging continuation controller and does not spend messaging activation
slots. Composed messaging instead uses the shipped finite
`scripts/claude-monitor.mjs` entrypoint. Do not wrap the legacy recipe or run it
beside the composed Monitor.

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
| Monitor is callable but the complete live sequence has not passed     | `scheduled-poll` or `buffered-manual` | Monitor is available but event wake is unvalidated for this session.              |
| Monitor is absent, unavailable, or cannot deliver a task notification | `scheduled-poll` or `buffered-manual` | No autonomous Claude Code wake is available in this environment.                  |

Do not call a Monitor output, an empty watcher heartbeat, or Monitor startup a
peer message. Monitor output is automatic control input: it cannot authorize
work, must not be echoed as human direction, and must not recursively create a
second watcher or wake.

## Finite composed Monitor

Create one proposed activation UUID. Arm the observer-collab lease with that
UUID, the collaboration UUID, explicit private cursor, exact self/peer,
transcript and cwd, plus acting-session confirmation that the legacy Monitor and
standalone messaging watcher are stopped. Then enable the same UUID with
controller `observer-collab` and mechanism `monitor`.

Use the same IDs and exact pins throughout the complete sequence:

```sh
node <observer-collab-skill>/scripts/collab-control.mjs arm \
  --root <absolute-state-root> --runtime claude-code \
  --peer-runtime <claude-code|codex|cursor> \
  --session <self-session> --peer-session <peer-session> \
  --cwd <absolute-worktree> --peer-transcript <absolute-transcript> \
  --cursor 0 --lease-ms 1800000 --continuation-cap 20 --loop-cap 100 \
  --collaboration-id <uuid> --activation-id <uuid> \
  --confirm-old-monitor-stopped --confirm-standalone-watcher-stopped

node <messaging-skill>/scripts/agent-messaging.mjs delivery enable \
  --root <absolute-state-root> --collab <collaboration-uuid> \
  --self claude-code:<self-session> --cwd <absolute-worktree> \
  --activation-id <activation-uuid> --controller observer-collab \
  --mechanism monitor --expires-in 30m --max-duration 30m \
  --max-continuations 20 --settings-paths <absolute-settings-path-list> \
  --confirm-old-monitor-stopped --confirm-standalone-watcher-stopped

node <observer-collab-skill>/scripts/claude-monitor.mjs \
  --root <absolute-state-root> --collaboration-id <collaboration-uuid> \
  --activation-id <activation-uuid> \
  --self claude-code:<self-session> --peer <runtime>:<peer-session> \
  --cwd <absolute-worktree> --peer-transcript <absolute-transcript> \
  --max-runtime-ms 1800000 --poll-ms 1000 \
  --confirm-old-monitor-stopped --confirm-standalone-watcher-stopped

# Re-arm after acknowledging the selected request or reading the pinned range.
node <observer-collab-skill>/scripts/collab-control.mjs arm \
  --root <absolute-state-root> --runtime claude-code \
  --peer-runtime <claude-code|codex|cursor> \
  --session <self-session> --peer-session <peer-session> \
  --cwd <absolute-worktree> --peer-transcript <absolute-transcript> \
  --collaboration-id <collaboration-uuid> --activation-id <activation-uuid> \
  --confirm-old-monitor-stopped --confirm-standalone-watcher-stopped
```

The command writes its one bounded notification to stdout. It writes one
redacted terminal reason to stderr and exits nonzero for refusal; a normal quiet
duration cap exits zero with `duration-complete` on stderr.

Launch `node <observer-collab-skill>/scripts/claude-monitor.mjs` in a proven
harness Monitor with the same IDs and pins, a finite `--max-runtime-ms` no
greater than 1800000, and both fresh stop confirmations. The command polls
addressed requests first. A request uses the existing message event, shared slot
and per-message claims without reading the transcript. Otherwise it reads the
exact peer candidate in-process without the base watcher or public observer
offset, claims a range-derived event and shared slot, and only then applies the
private-cursor CAS. A CAS loser and every identity, inventory, expiry or
continuity mismatch emit nothing.

One run emits at most one bounded notification containing exact message IDs or
the peer/index-base/range. It exits on notification, interruption, runtime cap,
activation expiry, or lease expiry and never self-rearms. Explicit re-arm must
name the same activation and peer; it preserves the private cursor, original
lease expiry and spent shared slots. An observation claim has no delivery retry
generation. Status calls a pre-slot attempt interrupted only from recorded
evidence; later outcomes remain unknown. Recovery is a normal explicit pinned
observer read, which advances public state under its existing contract but does
not mutate private Monitor state, claims, or slots.

Synthetic fixture proof does not establish installed or live Monitor delivery.
Keep the live tier unverified until an independently authorized exact-host
receipt completes the sequence below.

## Legacy observation-only Monitor recipe

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

## Monitor lifetime and re-arming

Monitor lifetimes are controlled by the active harness. One observed Claude
Code session produced expiry notices after approximately 30 minutes in that
session, but that is not a universal Monitor duration or a portable harness
contract. Treat an expiry, cancellation, disconnect, or uncertain task state
as a reason to re-check both the Monitor and watcher rather than as proof that
either is still live.

Use this bounded exact-pin re-arm procedure:

1. Freeze automatic collaboration responses and retain the exact
   `<peer-runtime>:<peer-session-id>` pin. Record the previous digest's raw
   `nextIndex` and rendered range when one exists.
2. Stop the old watcher cleanly. Prefer `watch-ctl stop` for the exact active
   watcher and confirm it no longer appears in `watch-ctl status`. A clean
   SIGTERM requests orderly shutdown but does not force a pending delta flush;
   normal max-runtime expiry performs a final poll/flush before it exits.
3. Start exactly one replacement with `catch-up-then-watch`, the same exact
   `--session` pin, and the quiet/no-heartbeat arguments above. Do not restart
   with plain `watch`: it intentionally consumes the unread baseline and emits
   a `baseline-gap` warning instead of rendering that range.
4. Inspect the catch-up evidence before resuming automatic responses. The raw
   range is `[fromIndex, nextIndex)` and the persisted legacy
   `lastRecordIndex` should equal `nextIndex`. `renderedFromIndex` and
   `renderedToIndex` identify the rendered subset. Tool-, reasoning-, or
   metadata-only records can advance the raw range and persisted offset while
   leaving both rendered indexes null; that is filtered activity, not by
   itself evidence of a lost peer message.
5. Resume only after the replacement owns the exact pin and any substantive
   delta has been handled once. If a competing watcher is reported, keep the
   established owner and do not start another consumer.

Deterministic synthetic coverage verifies that a renderable message appended
while stopped is emitted once after clean SIGTERM, `watch-ctl stop`, and normal
max-runtime lifetimes. It also covers filtered-only advancement, an append
during replacement startup, and the contender-first same-target interleaving.
The alternate owner-polls-before-contender-rollback ordering remains a shared
legacy-offset/compare-and-set limitation: use one watcher per exact target and
do not treat concurrent consumers as supported.

Two delivery boundaries remain explicit. Legacy Claude/Codex
`observeCatchUp()` persists `lastRecordIndex = nextIndex` before the watcher
writes stdout. A rejected stdout write therefore leaves the range consumed,
and another exact-pin re-arm does not replay it. Separately, even a completed
stdout write proves only process output; it does not prove the Claude Code
Monitor delivered those bytes into the observing agent. No synthetic test can
establish observing-agent delivery. A safe change to either boundary requires
delivery reservations, compare-and-set checkpoints, or live harness evidence,
not offset rollback by another consumer.

## Evidence status (2026-09-16)

One real Claude Code session ran the pinned Monitor recipe against a Codex
peer for roughly ten hours of collaboration, across five Monitor lifetimes.
Sanitized observations, with the acceptance area they bear on:

| Acceptance area             | Evidence in that session                                                                                                                                                                                              | Live status               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Task notification           | Monitor was callable; every completed substantive peer turn produced one task notification carrying the exact pinned digest range, and the session acted on it once per turn.                                         | Observed, repeatedly.     |
| Empty heartbeat suppression | `--quiet-empty` and `--heartbeat-sec 0` produced no notifications during quiet intervals; only `newer-session-candidate` warnings and the baseline line appeared as automatic control.                                | Observed.                 |
| Substantive notification    | Peer decisions, requests, and corrections arrived as single notifications and were classified under the no-op rules before any response.                                                                              | Observed, repeatedly.     |
| Same-session restart        | Not exercised: the client was not restarted. Monitor expiry and re-arm were exercised five times; two re-arms showed raw gaps later found to contain filtered tool/reasoning activity, not confirmed renderable loss. | Not run; re-arm observed. |
| Clean stop                  | `watch-ctl stop` plus Monitor expiry left no watcher process and no lease state; a later peer turn produced no notification.                                                                                          | Observed.                 |
| Task lifetime               | Expiry notices arrived after approximately 30 minutes in that session. No cross-version or cross-harness duration guarantee was established.                                                                          | Session-specific only.    |

Honest posture from that evidence: `event-wake` was observed repeatedly during
each tested Monitor task lifetime in that session. Neither one task lifetime
nor the observed duration is a universal guarantee. Restart resilience remains
unvalidated, so a session that loses its client must re-arm from the named pin
and inspect the raw and rendered ranges rather than claim continuity. The
automated verification below checks persisted state, rendered digests, and
captured stdout only; it does not verify live Monitor-to-agent delivery:

```text
pnpm run validate
pnpm exec vitest run src/skills/session-observer/src/watch.test.ts
```
