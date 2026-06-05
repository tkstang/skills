---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-04
oat_generated: true
oat_summary_last_task: p07-t01
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: session-observer-watch

## Overview

This quick-mode project added continuous watch mode to the standalone `session-observer` skill. The user wanted an agent to catch up on another runtime once and then keep monitoring for new peer transcript activity without repeatedly prompting "catch up."

The implementation keeps the behavior local and foreground-based: the watcher streams debounced catch-up digests to the active agent invocation that started it, while provider hooks that could wake a future invocation remain explicitly deferred.

## What Was Implemented

- Added `session-observer watch` and top-level `--watch` as foreground watcher entrypoints around the existing locate/rank/digest/state catch-up pipeline.
- Added `session-observer watch-ctl` with `status`, `pause`, `resume`, `flush`, and `stop` controls backed by `watch.control.json`.
- Added lock-protected watcher state in `watch.json`, stale-pid cleanup, and `watchedByPid` session metadata so manual `catch-up` can warn when a watcher is also reading the same session.
- Extracted reusable catch-up observation logic into `observe.mjs` so one-shot `catch-up` and watch events share candidate selection, digest construction, and state updates.
- Implemented polling and debounce in `watch.mjs`, including markdown or JSON-line stdout events, bounded runtime support, graceful SIGINT/SIGTERM cleanup, and metadata-only `--event-log` output.
- Hardened event-log paths so writes stay under `~/.local/state/session-observer/`, reject traversal, reject symlink escapes, and reject reserved state/control/lock/temp/backup filenames.
- Kept the shipped `--runtime both` contract to Claude Code plus Codex only. Cursor remains supported through explicit `--runtime cursor` or `--runtime auto`.
- Updated `SKILL.md`, `references/watch-design.md`, root `README.md`, validation checks, the repo `.agents` symlink view, and the user-level `~/.agents/skills/session-observer` dogfooding install.

## Key Decisions

- **Foreground watch over detached daemon.** The project chose a foreground process because it can stream useful digest content to the currently active agent without host-specific lifecycle work.
- **Polling over `fs.watch`.** Polling is OS-agnostic, cheap for the small transcript candidate set, and deterministic enough for injected-time tests.
- **Shared catch-up pipeline.** Watch mode reuses the same observe/digest/state path as one-shot `catch-up`, reducing the risk of divergent transcript parsing or offset semantics.
- **Metadata-only event logs.** Message content remains on stdout for the active agent; event logs record operational metadata only.
- **Dogfooding sync required.** Because this is a standalone skill under `skills/`, the project refreshed the user-level install and verified Claude/Cursor symlinks before closeout.

## Design Deltas

- The implementation uses one global active watcher entry in `watch.json`, which is stricter than "duplicate watcher for the same runtime/cwd" wording but matches the single control-file model.
- Event-log path semantics became stricter during review fixes: callers may choose filenames or subdirectories only inside the session-observer state directory, and reserved state/control style names are rejected even under nested log directories.
- `--runtime both` intentionally excludes Cursor to match the shipped operator docs. Cursor support remains explicit through `--runtime cursor` and automatic through `--runtime auto`.
- Provider-hook automation remains deferred. Watch mode only responds while an active invocation keeps the foreground watcher running and consumes stdout.

## Notable Challenges

- `--runtime both` originally risked consuming new records during baseline refresh before debounce emission. Review fixes split baseline handling so already tracked runtimes preserve pending updates until the watcher emits them.
- Inactive `watch-ctl` operations could leave stale directives for the next watcher. The final behavior returns a no-active-watcher payload, clears stale control files, and avoids writing new directives when no watcher is active.
- Debounce coalescing needed deterministic tests. The watch loop now supports injected time/sleep hooks so the regression verifies one coalesced event without relying on wall-clock timing.
- Event-log hardening required both lexical containment and realpath checks to reject symlink escapes and reserved state-file corruption paths.

## Tradeoffs Made

- The project did not implement provider hooks, macOS notifications, network callbacks, or memory/vault capture. Those would change the lifecycle and privacy model and were outside the quick-mode scope.
- Watch mode establishes an initial baseline without emitting old content. For combined "catch up and watch" requests, skill instructions now tell agents to run `catch-up` first and then start `watch`.
- Manual `catch-up` still succeeds when a watcher owns the same session offset. The race is benign and easier to recover from than a hard refusal.

## Integration Notes

- Runtime code remains Node >=22, ESM, and Node-standard-library only.
- Watcher writes are limited to `~/.local/state/session-observer/`; the skill still never mutates Claude Code, Codex, or Cursor transcript stores.
- `--json` on `watch` emits newline-delimited event objects to stdout. `--event-log` mirrors metadata-only JSONL records and never includes digest message content.
- Root README and the canonical skill docs now describe watch mode as implemented; older OAT repo reference summaries are historical and were intentionally left unchanged.

## Follow-up Items

- Provider-hook integration remains a possible future project if automatic follow-up after the initiating invocation exits becomes a product requirement.
- Cursor SQLite chat history remains out of scope; the skill continues to inspect Cursor agent transcript JSONL only.

## Associated Issues

No external Linear or GitHub issue was associated with this quick-mode project.
