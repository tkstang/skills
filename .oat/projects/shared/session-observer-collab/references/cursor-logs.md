# Session Observer Collaboration Log — cursor

- Date: 2026-07-12 12:04 CDT
- Self runtime: cursor
- Session ID: c182953b-a058-48d8-bbd8-1b834742f2c1
- Transcript: /Users/tstang/.cursor/projects/Users-tstang-orca-workspaces-open-agent-toolkit-oat-repo-improve/agent-transcripts/c182953b-a058-48d8-bbd8-1b834742f2c1/c182953b-a058-48d8-bbd8-1b834742f2c1.jsonl
- Worktree: /Users/tstang/orca/workspaces/open-agent-toolkit/oat-repo-improve
- Task: Bounded Cursor participation smoke test (observe, verify, and report)

### [12:04] mechanics — Cursor self-transcript discovered

- What happened: The encoded project transcript store contained one JSONL file, and a unique excerpt from the kickoff prompt identified it as this session (`c182953b-a058-48d8-bbd8-1b834742f2c1`).
- Assessment: works-well — the project slug and session-directory layout provide an exact, unambiguous identity.
- Skill implication: Cursor discovery can safely pin the session ID from the transcript path and verify identity by matching a genuine user-message excerpt.

### [12:04] mechanics — Cursor activity is observable

- What happened: The live JSONL recorded the incoming user message, assistant text/planning blocks, and tool invocations with tool names and inputs; it did not record tool-result payloads observed during this run.
- Assessment: works-well — peer agents can follow conversational and action intent, with the gotcha that command/read outputs are unavailable unless the assistant later summarizes them.
- Skill implication: Cursor normalization should render user/assistant text by default and optionally tool calls, while not assuming corresponding `tool_result` records exist.

### [12:04] protocol — Pinned Claude review stayed stateless

- What happened: `review --runtime claude-code --session claude-code:35331219-1cd2-4997-a032-68f5c33f701b --max-turns 6` succeeded without `--mark-read`; the latest turns showed successful wake #9/no-op suppression checks, a metadata-only delta, and the user's report that the app closed unexpectedly while monitoring.
- Assessment: works-well — the required read proved cross-runtime visibility without touching the Codex-owned offsets.
- Skill implication: Multi-agent readers that do not own an offset must use pinned `review` calls and avoid all state-advancing modes.

### [12:04] mechanics — Locate selected this Cursor session

- What happened: Cursor `locate --json` returned this session as the tier-A winner with `engaged: true`, `active: true`, direct-parent cwd evidence, and no ties or fallbacks.
- Assessment: works-well — the active self-session is immediately discoverable as a candidate.
- Skill implication: Cursor locate diagnostics provide enough identity and engagement metadata for a peer to select the current session without changing observer state.

### [12:04] gotcha — Turn completion uses a top-level marker

- What happened: This active transcript had not yet emitted an end marker, as expected mid-turn; inspection of a completed Cursor transcript confirmed a standalone `{"type":"turn_ended","status":"success"}` record after the final assistant message.
- Assessment: gotcha — assistant message records alone do not prove that a turn is complete.
- Skill implication: Cursor wake filters should gate completed turns on top-level `type == "turn_ended"` (and inspect `status`), rather than treating the latest assistant text or tool call as completion.

### [12:10] gotcha — Observation ended with the bounded Cursor turn

- What happened: The smoke-test response emitted `turn_ended`, and no persistent observer was left running; this follow-up invocation manually repeated the pinned stateless Claude review and successfully read newer wake #12/#13 collaboration turns.
- Assessment: friction — Cursor transcripts are observable, but an ended Cursor agent turn is not automatically resumed when peer transcripts change.
- Skill implication: Persistent Cursor participation needs a Cursor-specific recurring wake/lease mechanism; until one exists, each host or user reinvocation must perform a pinned stateless `review`, because the Codex-owned stateful watcher cannot be shared safely.

### [12:13] protocol — Cursor stop hooks can chain agent turns

- What happened: Current Cursor hook documentation defines `stop` input fields `status` and `loop_count`, and a `followup_message` output that Cursor automatically submits as a new user message with a new generation; per-script `loop_limit` defaults to 5.
- Assessment: works-well — Cursor can implement bounded autonomous turn chaining, but this is not a same-turn veto and cannot wake an already-idle conversation from arbitrary background output.
- Skill implication: The Cursor adapter can use a short stop-hook catch window and `followup_message` lease, while late peer activity still requires an external trigger after the hook returns; its observer baseline must remain separate from Codex-owned offsets.
