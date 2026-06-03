---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-03
oat_generated: false
---

# Discovery: session-observer-watch

## Initial Request

Add watch mode to the `session-observer` skill so that, after identifying the relevant peer session, it keeps watching for transcript changes and automatically surfaces new catch-up output without the user repeatedly saying "catch up." The user specifically asked for a `--watch` argument and was open to polling, debounce, a background subagent, or another pragmatic mechanism.

## Request Classification

Exploratory but bounded. The repo already contains `skills/session-observer/references/watch-design.md`, which documents the intended v2 direction: a polling watcher, debounce, singleton state, metadata event log, and `watch-ctl` control surface. That reference turns the open-ended parts into an implementation-ready plan, with one important scope choice: host/provider hook integration is deferred, while the CLI and skill workflow should make continuous watching possible during an active agent invocation.

## Solution Space

### Approach 1: Foreground Polling Watcher With Agent Response Loop (Recommended)

**Description:** Implement `session-observer watch` plus a `--watch` alias. The CLI polls ranked transcript candidates, debounces changes, runs the same catch-up pipeline already used by one-shot mode, and writes rendered digests to stdout. The skill instructions tell the agent to keep the command running and respond whenever new digest output appears.

**When this is the right choice:** Best for local dogfooding because it needs no provider-specific hooks, keeps transcript access read-only, and can be tested with deterministic polling/debounce behavior.

**Tradeoffs:** It only automatically responds while an agent invocation is actively watching the process output. It does not magically resume a closed chat or inject prompts into providers.

### Approach 2: Detached Daemon With Control Commands

**Description:** Start a background process that keeps running after the initiating turn, writes metadata events to disk, and can be managed with `watch-ctl`.

**When this is the right choice:** Useful if the main value is persistent machine-local observation independent of the current agent turn.

**Tradeoffs:** It still cannot make the current assistant send future chat messages without a host integration. It also adds lifecycle risk around orphaned processes, stale pid cleanup, and user expectations.

### Approach 3: Provider Hook Or Background Subagent Integration

**Description:** Wire provider-specific hooks or a background subagent mechanism so transcript changes trigger a fresh agent prompt.

**When this is the right choice:** Best if the product requirement is "the assistant should initiate future conversational turns even after the initial command finishes."

**Tradeoffs:** Provider-specific, harder to validate, and not supported uniformly by Claude Code, Codex, and Cursor skill execution. This should not be the first implementation layer.

### Chosen Direction

**Approach:** Foreground polling watcher with control-file state, a `watch` subcommand, and a `--watch` alias.

**Rationale:** This matches the existing v2 reference design and gives the user the practical behavior they asked for in a live coding session: once the agent starts watch mode, new peer transcript activity is emitted and can be answered without another user prompt. It avoids over-promising detached automatic replies that the host runtime cannot guarantee yet.

**User validated:** Not separately prompted during quick start; this plan assumes the existing reference design plus the user's "whatever makes sense" wording is sufficient to proceed. If the user later requires provider-hook automation in this phase, the plan should be revised before implementation.

## Options Considered

### Polling vs `fs.watch`

**Chosen:** Polling.

**Summary:** Use `setInterval` polling over the small ranked candidate set. This is OS-agnostic, deterministic in tests, and already documented in `references/watch-design.md`.

### `watch` Subcommand vs `--watch` Flag

**Chosen:** Support both.

**Summary:** Keep `session-observer watch` as the canonical CLI shape from the reference design, and add `--watch` as a convenience alias because the user explicitly asked for a `--watch` argument.

### Foreground Output vs Detached-Only Event Log

**Chosen:** Foreground output first, optional metadata event log.

**Summary:** Rendered digest content should go to stdout so the active agent can respond. The event log should remain metadata-only for introspection and safety.

### Control Mechanism

**Chosen:** Control file plus `watch-ctl`.

**Summary:** Use `~/.local/state/session-observer/watch.control.json` and a sibling `watch-ctl` command for `flush`, `pause`, `resume`, `status`, and `stop`, matching the v2 reference.

## Key Decisions

1. **Watch behavior:** Implement a long-running foreground watcher that emits catch-up digests after debounced transcript changes.
2. **Automatic response boundary:** The skill will instruct the agent to keep the watch process open and respond to emitted digests; provider hooks and detached self-triggering are out of scope.
3. **CLI compatibility:** Add `watch` as the canonical subcommand and `--watch` as an alias.
4. **State safety:** Persist watcher process metadata only under `~/.local/state/session-observer/`, using the same atomic-write/lock discipline as existing state.
5. **Transcript safety:** Continue treating runtime transcripts as read-only inputs.
6. **Dogfooding:** Because this is a standalone skill edit, implementation must refresh the canonical user-level `~/.agents/skills/session-observer` copy, verify provider symlinks, and run `oat sync --scope user`.

## Constraints

- Runtime and tests must run on Node >=22 with no third-party runtime dependencies.
- Runtime plugin/skill code should use Node standard library APIs.
- The watcher must never write to `~/.claude/`, `~/.codex/`, or `~/.cursor/` transcript stores.
- Watcher writes are limited to `~/.local/state/session-observer/`.
- No memory/vault writes from watch mode.
- No network calls.
- Debounce and max-runtime controls must make tests deterministic and avoid hung test processes.
- Existing one-shot `review`, `catch-up`, `locate`, and `state` behavior must remain compatible.

## Success Criteria

- `session-observer watch ...` and `session-observer --watch ...` enter watch mode.
- Watch mode identifies the same session candidate as the existing locate/rank/catch-up path.
- Watch mode polls for transcript changes, debounces quiet periods, and emits at most one digest per settled update burst.
- New output is rendered as catch-up digest content suitable for the active agent to summarize or respond to.
- `--json` emits JSON-line events and `--event-log` writes metadata-only JSONL records.
- `watch-ctl status`, `pause`, `resume`, `flush`, and `stop` work through a control file.
- Singleton enforcement prevents duplicate watchers for the same runtime/cwd, while stale pids are cleared.
- Existing CLI tests still pass, and new watch-specific tests cover state, debounce, control, and bounded runtime.
- Skill docs no longer say watch mode is unimplemented and include operator guidance for active watch sessions.
- User-level dogfooding install is refreshed and provider skill symlinks are verified.

## Out of Scope

- Provider hook installation that triggers new assistant turns after the current invocation ends.
- macOS notifications or other desktop notification integrations.
- A detached-only daemon that does not stream useful digest content to the active agent.
- Memory/vault capture of watched content.
- Network callbacks or remote event streaming.

## Deferred Ideas

- Provider-specific hook integration for future self-triggered follow-up prompts.
- Opt-in notable-event capture that writes summarized findings to memory, with explicit user control.
- A richer replay UI for metadata event logs.

## Open Questions

- **Host automation:** Exact provider-hook mechanics remain deferred; implementation should not block on them.
- **Default runtime breadth:** The reference allows `--runtime both`; implementation should include it if low-friction, but may preserve `auto` as the default when `both` would complicate singleton state or tests.

## Assumptions

- The user primarily wants automatic responses during an active watch session, not after the conversation is closed.
- Polling every two seconds and debouncing for two seconds are acceptable defaults.
- `--max-runtime-min 0` means unlimited, but tests and smoke checks should use short bounded runs.
- Existing transcript ranking and digest construction are the source of truth for session identity and rendered output.

## Risks

- **Hung watcher during tests:** Long-running process behavior can stall test runs.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Implement `--max-runtime-min`, test-friendly poll/debounce values, and explicit stop controls early.

- **Duplicate offset updates:** A watcher and manual `catch-up` could both advance state.
  - **Likelihood:** Medium
  - **Impact:** Low
  - **Mitigation Ideas:** Preserve the existing benign race model: warn when watched by pid, but do not refuse catch-up.

- **Over-promising automatic chat behavior:** CLI output alone cannot initiate future turns after the agent stops watching.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Document the boundary clearly in `SKILL.md`: watch mode is automatic while the invocation is active; provider hooks are deferred.

## Next Steps

Proceed directly to quick-mode `plan.md` and execute with `oat-project-implement`.
