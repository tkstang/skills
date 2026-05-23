# Watch Mode — Design Reference (v2, not implemented in v1)

**Status:** designed, not implemented. This document commits the leading hypothesis so v2 doesn't re-litigate.

**Scope:** Everything in this document is design-only. No `watch` or `watch-ctl` subcommand exists in v1. The v1 skill ships `review`, `catch-up`, `locate`, and `state`.

---

## Why design-only in v1?

`watch` is a foreground polling daemon — a fundamentally different execution model from the single-shot CLI subcommands in v1. Shipping it correctly requires:

- Singleton enforcement (one watcher per runtime per machine).
- Stale-pid detection at startup.
- A durable event log (JSONL, metadata-only).
- A control surface for `pause`/`resume`/`flush`/`stop`.
- Graceful shutdown on SIGTERM/SIGINT with state-file cleanup.

These add surface area and test complexity that are out of scope for the first iteration. The design is frozen here to avoid rediscovery work when v2 picks this up.

---

## CLI Shape

```
session-observer watch [--runtime <r>|both] [--cwd <path>]
                       [--debounce-sec 2] [--poll-sec 2]
                       [--max-runtime-min 0]
                       [--event-log <path>] [--json]
```

| Flag | Default | Description |
|---|---|---|
| `--runtime <r>\|both` | `auto` | Which runtime(s) to watch. `both` runs a single process that polls both stores. |
| `--cwd <path>` | `process.cwd()` | Project directory to match sessions against. |
| `--debounce-sec N` | 2 | Hold for N seconds of quiet before emitting an event. |
| `--poll-sec N` | 2 | Poll interval in seconds. |
| `--max-runtime-min N` | 0 (unlimited) | Auto-exit after N minutes (0 = run until stopped). |
| `--event-log <path>` | — | Mirror events to a JSONL file (metadata only, no content). |
| `--json` | false | Emit each event as a JSON line to stdout instead of human-readable text. |

Foreground process. Quits on SIGINT or SIGTERM. Stdout is a human-readable event stream; `--event-log` mirrors events to a JSONL file for replay/introspection.

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
       pending = {}   // path → { firstSeenAt, lastSeenMtime }

loop every poll-sec:
  candidates = locate.discover(runtime, cwd)

  for c in candidates:
    if c.mtime > (known[c.path]?.mtime ?? 0):
      pending[c.path] = { firstSeenAt: now(), lastSeenMtime: c.mtime }
      known[c.path] = { mtime: c.mtime, size: c.size }

  for path, entry in pending:
    age = now() - entry.firstSeenAt
    if age >= debounce-sec:
      emit(path)             // full locate → rank → catch-up → state.markRead pipeline
      pending.delete(path)

  // Read control file if present and apply directives
  apply_control_file_if_present()

  sleep poll-sec
```

**Debounce:** when a transcript's mtime first changes, hold for `debounce-sec`. Further changes reset the timer. Only emit when the file has been quiet for `debounce-sec`. This avoids emitting on half-formed turns while the peer runtime is still writing.

---

## Event Emission Pipeline

Emitting a session update is the same pipeline as `catch-up`:

```
locate.discover(runtime, cwd)
  → rank.rank(candidates, cwd)
    → digest.buildDigest(runtime, transcriptPath, { fromIndex, ... })
      → state.markRead(runtime, sessionId, { ... })
        → emit event (stdout and/or event-log)
```

No new parsing code. Watch is a debounce-wrapped loop around the existing `catch-up` pipeline.

---

## Watch State (`~/.local/state/session-observer/watch.json`)

```jsonc
{
  "schemaVersion": 1,
  "active": {
    "pid": 12345,
    "runtime": "codex",
    "cwd": "/Users/.../Code/foo",
    "startedAt": "2026-05-14T16:42:09Z",
    "lastEventAt": "2026-05-14T16:48:11Z",
    "eventCount": 4
  }
}
```

**Locking:** same `state.json.lock`-style atomic temp+rename write protocol as `state.json`. Only one watcher per runtime; startup refuses if `active.pid` is a live process. Stale pids (no such process — `ESRCH` from `kill(pid, 0)`) are cleared on startup without user intervention.

**`--runtime both`:** one `active` entry covers both runtimes; `runtime` field is `"both"`. Each runtime has its own debounce timer and read offset inside the single process.

---

## Event-Log JSONL Schema

Each line in the event log is metadata only — no message content:

```jsonc
{
  "ts": "2026-05-14T16:48:11Z",
  "runtime": "codex",
  "sessionId": "abc123…",
  "newRecords": 3,
  "digestChars": 482,
  "ranges": { "fromIndex": 47, "toIndex": 50 }
}
```

Content stays in the rendered stdout digest. The log is for introspection and replay.

---

## Control Surface

No SIGUSR1. A control file at `~/.local/state/session-observer/watch.control.json` is read each poll tick. A sibling verb writes intent:

```bash
session-observer watch-ctl flush        # force-emit any pending debounce immediately
session-observer watch-ctl pause        # stop emitting until resume (still polling)
session-observer watch-ctl resume       # re-enable emission
session-observer watch-ctl status       # print active watch.json contents
session-observer watch-ctl stop         # SIGTERM the watcher pid
```

**`watch.control.json` schema:**

```jsonc
{
  "directive": "flush" | "pause" | "resume" | "stop",
  "issuedAt": "2026-05-14T16:50:00Z"
}
```

The watcher reads this file on each poll tick, applies the directive, then deletes the file. `stop` sends SIGTERM to the watcher's own pid, triggering graceful shutdown.

**Rationale over SIGUSR1:** discoverable via `--help`, one mechanism for many actions, trivially scriptable and testable, latency ≤ `poll-sec` is acceptable.

---

## SIGTERM / SIGINT Graceful Shutdown

On SIGTERM or SIGINT:

1. Finish any in-flight event emission.
2. Call `state.markRead` for any pending updates that were computed but not yet committed.
3. Clear `watchedByPid` on all active session entries in `state.json`.
4. Clear `active` in `watch.json`.
5. Delete `watch.control.json` if present.
6. Exit 0.

---

## Interaction with `catch-up`

If `watchedByPid` is non-null on a session entry, `catch-up` **warns, not refuses**:

```
warning: watcher pid 12345 is also reading this session; offsets may interleave (benign)
```

The race is benign — the offset advances; the watcher's next tick sees no new records and idles. No `--force` flag is needed.

---

## Future Hook Integration (post-v2, out of scope)

Wiring the watcher into Claude Code's `UserPromptSubmit` hook or a Codex equivalent would let the host runtime automatically prompt the agent when fresh peer activity is available. This requires host-specific `settings.json` changes and is out of scope for the watcher itself.

---

## Safety Rules

These are binding even at design stage:

- **Read-only on transcripts.** No writes to `~/.claude/` or `~/.codex/` ever.
- **Writes only to** `~/.local/state/session-observer/`. No other filesystem mutations.
- **No memory/vault writes from the watcher.** A future `--capture-notable` flag, if added, must be opt-in and must only write summarized findings (not per-event content). A v2 question.
- **No network calls.**

---

## Decisions Locked (Not Open for v2 Re-litigaton)

| Decision | Rationale |
|---|---|
| No SIGUSR1 | Control surface is more discoverable and scriptable via control file + `watch-ctl`. |
| No `--notify` / macOS notification center | Expected usage is two terminals side-by-side; system notifications add noise. |
| Polling over `fs.watch` | OS-agnostic; cheap for small candidate sets; predictable test behavior. |
| Debounce before emit | Avoids half-formed turns during active writes. Default 2s is tunable. |
| One process for `--runtime both` | Simpler singleton enforcement; shared debounce loop; one event log. |
