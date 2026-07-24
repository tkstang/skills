# Watch Mode — Implementation Reference

**Status:** implemented. The `watch` and `watch-ctl` subcommands are available, and top-level `--watch` maps to the foreground watcher.

**Scope:** This document records the watch-mode behavior, state contract, event stream, control surface, and deferred provider-hook boundary. The root `SKILL.md` stays operator-focused; keep detailed internals here.

---

## What watch mode does

`watch` is a foreground polling process around the existing locate/rank/digest/state pipeline. It identifies the relevant peer transcript for the selected runtime/cwd, establishes an initial baseline, then emits debounced catch-up digests when settled transcript changes arrive.

Implemented behavior includes:

- Multiple active watcher records through `watch.json`.
- Stale-pid cleanup at startup.
- Metadata-only JSONL event logging with `--event-log`.
- `watch-ctl` operations for `status`, `pause`, `resume`, `flush`, and `stop`.
- Graceful shutdown on normal exit, `watch-ctl stop`, SIGTERM, and SIGINT.
- `watchedByPid` ownership metadata on active session state.

Automatic agent responses only happen while the active invocation keeps the foreground watch process running and polls its output. Host/provider hooks that would wake a future invocation after the current one ends are deferred.

---

## CLI Shape

```
session-observer watch [--runtime <r>|both] [--cwd <path>]
                       [--debounce-sec 2] [--poll-sec 2]
                       [--max-pending-sec 30] [--max-runtime-min 0]
                       [--heartbeat-sec 120] [--until-stopped]
                       [--interactive] [--event-log <path>] [--json]

session-observer --watch [watch options]

session-observer catch-up-then-watch [watch options]
```

| Flag                  | Default         | Description                                                                                                                                                                       |
| --------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--runtime <r>\|both` | `auto`          | Which runtime(s) to watch. `both` runs a single process that polls both stores.                                                                                                   |
| `--cwd <path>`        | `process.cwd()` | Project directory to match sessions against.                                                                                                                                      |
| `--debounce-sec N`    | 2               | Hold for N seconds of quiet before emitting an event.                                                                                                                             |
| `--poll-sec N`        | 2               | Poll interval in seconds.                                                                                                                                                         |
| `--max-pending-sec N` | 30              | Maximum seconds to hold continuous transcript changes before emitting even if the file never goes quiet.                                                                          |
| `--max-runtime-min N` | 0 (unlimited)   | Auto-exit after N minutes (0 = run until stopped).                                                                                                                                |
| `--heartbeat-sec N`   | 120             | Emit quiet metadata/status heartbeat lines every N seconds; 0 disables heartbeats.                                                                                                |
| `--until-stopped`     | false           | Alias posture for unlimited foreground watching. Equivalent to `--max-runtime-min 0`.                                                                                             |
| `--interactive`       | false           | Alias posture for live collaboration. Equivalent to `--max-runtime-min 0`.                                                                                                        |
| `--event-log <path>`  | —               | Mirror events to a JSONL file (metadata only, no content). Relative paths resolve inside `~/.local/state/session-observer/`; absolute paths must also stay inside that directory. |
| `--json`              | false           | Emit each event as a JSON line to stdout instead of human-readable text.                                                                                                          |

Foreground process. Quits on SIGINT or SIGTERM. Stdout is a human-readable event stream; `--event-log` mirrors metadata-only delta events to a JSONL file for replay/introspection.

`--watch` is a top-level alias for `watch` and accepts the same watch options.

`catch-up-then-watch` starts the same foreground watcher but emits the unread backlog before settling into the watch loop. This is preferred for live collaboration because it prevents agents from losing unread backlog by accidentally treating a fresh watch baseline as a completed catch-up.

---

## Polling, not `fs.watch`

The watcher uses `setInterval`-based mtime polling rather than `fs.watch` / `fs.watchFile`. Rationale:

1. `fs.watch` recursive support is OS-specific: macOS `FSEvents` behaves differently from Linux `inotify`; deep directories require recursive flag that is not universally available.
2. The candidate set is small (a handful of JSONL files per runtime); stat is cheap.
3. Polling is predictable, easily testable (advance a fake clock), and avoids kernel-resource exhaustion.

---

## Polling Pseudocode

```
state: known = {}     // path → { mtime, size }
       pending = {}   // path → { firstChangedAt, lastChangedAt }

loop every poll-sec:
  candidates = locate.discover(runtime, cwd)

  for c in candidates:
    if c.mtime > (known[c.path]?.mtime ?? 0):
      pending[c.path] = {
        firstChangedAt: pending[c.path]?.firstChangedAt ?? now(),
        lastChangedAt: now()
      }
      known[c.path] = { mtime: c.mtime, size: c.size }

  for path, entry in pending:
    quiet = now() - entry.lastChangedAt
    age = now() - entry.firstChangedAt
    if quiet >= debounce-sec or age >= max-pending-sec:
      emit(path)             // full locate → rank → catch-up → state.markRead pipeline
      pending.delete(path)

  // Read control file if present and apply directives
  apply_control_file_if_present()

  sleep poll-sec
```

**Debounce:** when a transcript's mtime first changes, hold for `debounce-sec`. Further changes reset the quiet timer. Emit when the file has been quiet for `debounce-sec`, or when the pending change has been held for `max-pending-sec`. For schema-v1 runtimes this settles record changes. Cursor also requires its framed-reader stability and continuity checks; debounce alone is not terminal completion evidence.

---

## Event Emission Pipeline

Emitting a session update is the same orchestration as `catch-up`, with an
explicit runtime branch:

```
locate exact target
  → non-Cursor: schema-v1 digest → record-offset markRead
  → Cursor: scan frames → analyze turns → schema-v2 observation digest
      → reserve output ownership → emit → commit Cursor state/continuity
  → emit metadata event (stdout and/or event-log)
```

Cursor observation is content-first: stable substantive content may emit with
lifecycle `pending`, while failure/terminal reconciliation remains separate.
The completion-sensitive collaboration path is not part of watch and stays
terminal-only.

---

## Watch State (`~/.local/state/session-observer/watch.json`)

```jsonc
{
  "schemaVersion": 1,
  "active": {
    "pid": 12345,
    "runtime": "codex",
    "requestedRuntime": "auto",
    "cwd": "<project-cwd>",
    "session": "codex:<session-id>",
    "startedAt": "2026-05-14T16:42:09Z",
    "pollSec": 3,
    "debounceSec": 3,
    "maxPendingSec": 30,
    "staleAfterSec": 36,
    "lastPollAt": "2026-05-14T16:48:14Z",
    "lastEventAt": "2026-05-14T16:48:11Z",
    "eventCount": 4,
    "heartbeatSec": 120,
    "resolvedRuntime": "codex",
    "sessionId": "<session-id>",
    "transcriptPath": "<provider-transcript>",
    "targets": [
      {
        "runtime": "codex",
        "sessionId": "<session-id>",
        "transcriptPath": "<provider-transcript>",
        "cwd": "<project-cwd>",
        "recordCount": 458,
        "baselineRecordIndex": 458,
        "engagementStatus": "engaged",
        "lockedAt": "2026-05-14T16:42:09Z",
      },
    ],
    "lastError": null,
  },
  "watchers": ["..."],
}
```

**Locking:** `watch.json` uses the same atomic temp+rename and owner-lock pattern as the state stores. Multiple watchers may be active in one state directory, including reciprocal sessions in the same worktree watching each other. Startup refuses when the same live pid already owns a watcher; target acquisition additionally refuses when another live watcher has already locked onto the same target session, because duplicate same-target watchers would race over the shared per-session position and each see only an arbitrary partial stream. The authoritative duplicate check happens inside `recordWatcherTarget` under the `watch.json` lock (an unlocked pre-check gives a fast path), so two watchers starting concurrently — before either has recorded its target — still resolve to exactly one owner. For Cursor, the loser cannot commit a delivery reservation or frame checkpoint. Legacy single-`active` records without `targets[]` are matched by their top-level `resolvedRuntime`/`sessionId` fields. Stale pids (no such process — `ESRCH` from `kill(pid, 0)`) are cleared on startup without user intervention. The legacy `active` field mirrors the first live watcher for compatibility; `watchers[]` is the multi-watcher source of truth.

**`--runtime both`:** one `active` entry covers both runtimes; `runtime` field is `"both"`. Each runtime has its own debounce timer and read offset inside the single process.

`watch-ctl status --json` enriches this state with live transcript drift and health fields for every active watcher. Schema-v1 targets retain record-index status. A Cursor target declares `zero-based-jsonl-frame-index` and carries `observationCursor`, `bufferedFromFrame`, a continuity checkpoint/state, pending candidate deadline, and the last independent status facets: `engagement`, `activity`, `content`, `lifecycle`, `delivery`, and `health`. `healthy` means polling and continuity verification succeeded; it does not claim substantive peer progress or lifecycle completion. Pending/partial input is buffered, while malformed input, continuity failure, stale polling, or uncertain delivery is fail-visible in `healthReasons`.

---

## Event-Log JSONL Schema

Each line in the event log is metadata only — no message content. Delta event records have a stable `type` field:

```jsonc
{
  "type": "delta",
  "ts": "2026-05-14T16:48:11Z",
  "runtime": "codex",
  "indexBase": "zero-based-jsonl-record-index",
  "sessionId": "<session-id>",
  "newRecords": 3,
  "digestChars": 482,
  "ranges": { "fromIndex": 47, "toIndex": 50 },
}
```

Content stays in the rendered stdout digest. The log is for introspection and replay.
Cursor delta ranges instead declare `zero-based-jsonl-frame-index`; consumers
must dispatch by schema/index base and never reinterpret them as record ranges.

Event-log paths are constrained to the session-observer state directory. A relative path such as `events/watch.jsonl` writes under `~/.local/state/session-observer/`; absolute paths or `..` segments that escape that directory are rejected.

## Stdout Event Types

In `--json` mode, stdout events use these stable `type` values:

| Type        | Meaning                                                              | Agent behavior                                                          |
| ----------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `baseline`  | Watcher locked onto a transcript and established its initial offset. | Stay quiet; this is setup, not a completed watch.                       |
| `delta`     | New transcript records were emitted as a catch-up digest.            | Read the digest, respond if useful, then keep watching.                 |
| `heartbeat` | Watcher is still active during a quiet period.                       | Stay quiet unless `healthy` is false or `recordsBehind` is unexpected.  |
| `stopped`   | Watch loop exited normally, by timeout, signal, or `watch-ctl stop`. | If the user wanted continued monitoring, restart `catch-up-then-watch`. |
| `error`     | Watch setup or the watch loop hit an error before exiting.           | Surface the error and decide whether to restart or ask for help.        |

Setup failures (invalid runtime, event-log path validation, `startWatcher` refusal) are also rendered as a single `error` event in `--json` mode, so the stdout stream is the complete contract — agents never need to fall back to stderr to learn why a watch exited.

Human-readable output mirrors the same contract: the first watch line explicitly says the watcher is active and the process must stay open, baseline lines do not include old content, quiet periods emit `still watching` heartbeat lines, and stop output reminds the agent to resume watching when continued monitoring was requested.

---

## Control Surface

No SIGUSR1. Pid-targeted control files at `~/.local/state/session-observer/watch.control.<pid>.json` are read each poll tick (one file per watcher, so controls aimed at different watchers cannot overwrite each other within a poll interval). A legacy pid-less `watch.control.json` is still honored. A sibling verb writes intent:

```bash
session-observer watch-ctl flush        # force-emit any pending debounce immediately
session-observer watch-ctl pause        # stop emitting until resume (still polling)
session-observer watch-ctl resume       # re-enable emission
session-observer watch-ctl status       # print active watch.json contents
session-observer watch-ctl stop         # SIGTERM the watcher pid
```

**Control file schema (`watch.control.<pid>.json`, legacy `watch.control.json`):**

```jsonc
{
  "directive": "flush" | "pause" | "resume" | "stop",
  "issuedAt": "2026-05-14T16:50:00Z",
  "pid": 12345
}
```

The watcher reads its own pid-targeted control file (falling back to the legacy pid-less file) on each poll tick, applies the directive, then deletes the file. Directives addressed to pids that are no longer alive are garbage-collected whenever watch state is loaded. `watch-ctl status` lists all active watchers. Mutating controls (`pause`, `resume`, `flush`, `stop`) select the watcher for the current cwd by default; when that implicit cwd filter matches nothing, they fall back to the only watcher matching the remaining filters, so a lone watcher stays controllable from any directory (an explicit `--cwd` remains a hard filter). If multiple watchers match, the caller must disambiguate with `--runtime`, `--session`, or `--pid`. `stop` also sends SIGTERM to the selected pid, triggering graceful shutdown. The command output reminds agents that if continued monitoring is still desired, they should restart `catch-up-then-watch` after responding.

**Rationale over SIGUSR1:** discoverable via `--help`, one mechanism for many actions, trivially scriptable and testable, latency ≤ `poll-sec` is acceptable.

---

## SIGTERM / SIGINT Graceful Shutdown

On SIGTERM or SIGINT:

1. Finish any in-flight event emission.
2. Call `state.markRead` for any pending updates that were computed but not yet committed.
3. Clear `watchedByPid` on all active session entries in `state.json`.
4. Remove this pid from `watchers[]` in `watch.json` and refresh the compatibility `active` field.
5. Delete this pid's control file, plus the legacy `watch.control.json` if it is pid-less or targets this pid.
6. Exit 0.

---

## Interaction with `catch-up`

If `watchedByPid` is non-null on a session entry, `catch-up` **warns, not refuses**:

```
warning: watcher pid 12345 is also reading this session; offsets may interleave (benign)
```

The race is benign — the offset advances; the watcher's next tick sees no new records and idles. No `--force` flag is needed.

---

## Deferred Provider Hook Integration

Wiring the watcher into Claude Code's `UserPromptSubmit` hook or a Codex equivalent would let the host runtime automatically prompt an agent when fresh peer activity is available after the original invocation ends. That requires host-specific settings and lifecycle handling and remains deferred.

The current automatic-response boundary is the active invocation: an agent starts `watch`, keeps the foreground process running, polls stdout, and responds to each emitted digest until the user stops watching or the process exits. If a user asks a side question while the agent is watching, answering the question must not silently end the requested monitoring posture. The agent should answer and then resume reading stdout; if the host forces the watch process to stop before answering, the next action should be restarting `catch-up-then-watch` unless the user explicitly stopped monitoring.

In yield-after-turn harnesses, a backgrounded watch process does not wake the agent when stdout changes; callers must actively read stdout, poll `watch-ctl status --json`, or use a host-specific wake hook. Once the invocation stops polling, no provider hook will summon a new agent for later watch events.

---

## Safety Rules

These are binding for watch mode:

- **Read-only on transcripts.** No writes to `~/.claude/`, `~/.codex/`, or
  `~/.cursor/` provider data.
- **Writes only to** `~/.local/state/session-observer/`. No other filesystem mutations.
- **No memory/vault writes from the watcher.** A future `--capture-notable` flag, if added, must be opt-in and must only write summarized findings, not per-event content.
- **No network calls.**

---

## Decisions Locked

| Decision                                  | Rationale                                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| No SIGUSR1                                | Control surface is more discoverable and scriptable via control file + `watch-ctl`.                                                     |
| No `--notify` / macOS notification center | Expected usage is two terminals side-by-side; system notifications add noise.                                                           |
| Polling over `fs.watch`                   | OS-agnostic; cheap for small candidate sets; predictable test behavior.                                                                 |
| Debounce before emit                      | Avoids half-formed turns during active writes. Default 2s is tunable.                                                                   |
| One process for `--runtime both`          | Shared debounce loop and one event log for a combined watcher, while still allowing separate watcher processes for reciprocal sessions. |
