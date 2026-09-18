# Codex rollout schema — observed evidence (2026-09-18)

Structure-only evidence from local `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
files. No message text, commands, paths, or tool payloads are reproduced. "Not
observed" never means "does not exist".

Produced by a bounded recon worker. Claims marked **[verified]** were independently
re-checked by the root reviewer on a separate 500-file sample (files modified since
2026-08-20) or on the named parent/child pair.

## Sample

- 333 files / 307,938 records; 22 `cli_version` values (0.142.4–0.155.1);
  2026-07-02 → 2026-09-18; stratified by version with forced inclusion of sessions
  containing subagents, custom/function calls, web search, MCP, failures, aborts,
  and compaction. The worker reported 17 malformed lines (0.006%); a root re-check
  that splits on the LF byte only found 0 malformed lines in 300 recent files, so those
  17 are attributed to `readline` breaking on U+2028/U+2029 inside strings. 0 unreadable files.
- Counts in this document come from the worker's stratified sample and its own
  structural passes. `inventory.json` beside this file is a separate, fully
  reproducible snapshot (newest 300 files by mtime, `inventory.mjs`, no post-processing).

## 1. Record taxonomy (27 discriminator groups)

Stable across all 22 versions: `session_meta`, `turn_context`, `world_state`,
`token_usage_record`, and every `response_item` type — `reasoning` (43.5k),
`custom_tool_call` / `custom_tool_call_output` (30.5k), `message` (16.9k),
`function_call` / `function_call_output` (15.1k).

Volatile `event_msg` layer:

| Shape | Versions observed |
| ----- | ----------------- |
| `patch_apply_end`, `user_message`, `agent_message`, `sub_agent_activity`, `context_compacted` | 0.151.0–0.153.4 only |
| `tool_search_call` / `tool_search_output`, `web_search_call` | 0.142.x only |
| `turn_aborted`, `compacted` | not observed in the two 0.155.1 files (n=2, unconfirmed) |
| `event_msg \| item_completed` (86.5k) | universal |

`item_completed.payload.item.type` sub-taxonomy (15): Reasoning 40,496 ·
CommandExecution 20,441 · AgentMessage 13,096 · CollabAgentToolCall 4,271 ·
FileChange 3,507 · SubAgentActivity 2,103 · UserMessage 1,490 · ContextCompaction 376 ·
McpToolCall 340 · WebSearch 249 · Extension 164 · ImageView 19 ·
EnteredReviewMode 7 · ExitedReviewMode 7 · HookPrompt 2.

## 2. Tool calls and results (`response_item` stream)

- `call_id` is the join key on all four call/output types. `payload.id` differs from
  `call_id` in 45,097 of 45,647 calls — never use it for correlation.
- `custom_tool_call`: only `exec` (29,944) and `apply_patch` (608). Arguments are
  **raw text in `payload.input`**, never JSON.
- `function_call`: everything else. `payload.arguments` is a **JSON-encoded string in
  100%** of 15,092 records (object form not observed). Optional separate
  `payload.namespace` (48%).
- Outputs: `payload.output` is an array of `input_text` / `input_image` blocks
  (custom, 96%), a bare string, or a JSON-encoded string.
- Correlation within a file is excellent: **4 calls without output, 0 outputs without
  a call, 9 call ids with more than one output.**
- MCP has no dedicated response-item type: it is a `function_call` plus an
  `item_completed` item of type `McpToolCall`
  (`server` / `tool` / `arguments` / `result` / `duration` / `status` / `error` / `readOnlyHint`).

## 3. Outcome evidence — key design constraint

- `function_call_output` and `custom_tool_call_output` carry **no status, exit code,
  or duration**. `custom_tool_call.payload.status` is a constant `completed` and must
  not be read as success.
- Outcome lives only in the `item_completed` stream: `item.exit_code` on 100% of
  CommandExecution items (0 → 19,444; 1 → 784; 2 → 116; 130 → 19; …),
  `item.status` completed/failed (CommandExecution 19,444/997; McpToolCall 300/40),
  `item.duration = {secs, nanos}`.
- WebSearch / Reasoning / AgentMessage / Extension items carry no status → `unknown`.
- `turn_aborted.reason` was `interrupted` in all 105 records; it is turn-level and
  never names the interrupted call.

## 4. Cross-stream join

- `item_completed.payload.item.id` does **not** join to `call_id`: 432 of 20,441
  CommandExecution items matched, all in 0.154.0; every other version 0
  (FileChange 587/3,507; WebSearch 53/249; McpToolCall 13/340).
- What does join: `item_completed.payload.turn_id` ↔
  `response_item.payload.internal_chat_message_metadata_passthrough.turn_id`
  (full overlap in 143/149 files, 0 disjoint), plus `ordinal`, which is strictly
  increasing file-wide (196,099 increments, 1 repeat, 0 decrements).
- Consequence: explicit correlation is `call_id` within the response stream;
  attaching exit code/status from the item stream requires turn + ordinal adjacency,
  which is an *inferred* join and must be labelled as weaker evidence than a native id.
- Exec output is stored twice (response-item output and item stream) under different
  id schemes; choose one carrier for previews.

## 5. Identity and lineage

- **`payload.id != payload.session_id` ⇔ subagent, exactly [verified]:** 379/379
  subagent files have `id != session_id`; 0 non-subagent files do (500-file re-check).
  Forked sessions (`forked_from_id`) keep `id == session_id`. `session_id` is the
  root thread id.
- **The first `session_meta` id equals the filename uuid in 500/500 files [verified].**
- **Multiple `session_meta` records per file are common [verified]:** 71 of 500
  files have two, always with *different* `id`s, always a subagent header first and
  a second header on line 2 (the parent's). A rule requiring all `session_meta` ids
  in a file to agree would reject ~14–16% of files, all of them children. The file's
  identity is its first `session_meta`, corroborated by the filename.
- **Subagent files are the majority of recent rollouts [verified]:** 379 of the 500
  most recently modified files are subagent threads, so resolving a child to its
  parent's id affects most sessions that use subagents.
- `source` is a bare string for cli/vscode/exec sessions and an object for subagents.
  Subagent fields appear both under `source.subagent.thread_spawn.*`
  (`parent_thread_id`, `depth`, `agent_path`, `agent_nickname`, `agent_role`) and
  promoted to top-level `payload.*` on newer versions.
- Also present: `subagent_history_start_ordinal` (27%), `forked_from_ordinal_exclusive`,
  `history_base {thread_id, end_ordinal_exclusive, end_byte_offset}`.

### Inherited parent history inside child files [verified, root re-check on 379 child files]

- 138 of 379 child files (36%) declare `session_meta.payload.subagent_history_start_ordinal`
  on their first header. Records whose top-level `ordinal` is below that value are
  **inherited parent context copied into the child file**, not the child's own work:
  11,494 inherited records vs 31,266 own records in the sample, including 2,704
  inherited tool-call records across 64 files.
- The second `session_meta` record (71 files) always carries the parent's id (71/71)
  and always sits inside the inherited range (70/70 where the marker is present).
  One two-header file has no marker; ownership of its early records is undetermined.
  68 files have the marker without a second header.
- Second discriminator: inherited records' `turn_id`s are disjoint from the child's own
  `turn_id`s in 138/138 files. Timestamps do **not** distinguish inherited records
  (none predate the child file's creation time).
- Inherited call ids did not match the direct parent's call ids in 25 checked pairs
  (0 of 184), so inherited calls cannot be de-duplicated against the parent by
  `call_id`. Reason undetermined.
- `history_base` and `forked_from_ordinal_exclusive` were not observed on child headers
  in this 500-file re-check.
- Consequence: an activity reader must classify `ordinal < subagent_history_start_ordinal`
  as inherited context and exclude it from the child's invocation counts; where the
  marker is absent but a second header exists, ownership is `unknown`.

### What the parent records about a child

- **The parent can name its children natively [verified on the named pair]:**
  `item_completed` items of type `SubAgentActivity` carry `agent_thread_id` equal to
  the child's own `session_meta.id`, plus `agent_path` and
  `kind ∈ started / interacted / completed / interrupted`
  (1,161 / 502 / 410 / 30 across the sample). The child filename embeds that uuid.
- The `spawn_agent` call arguments (`message`, `agent_type`, `task_name`,
  `fork_turns`, `model`, `reasoning_effort`) contain **no thread id**; its output
  returns `nickname` (550) and `task_name` (479) but `agent_id` in only 71 of 582.
  Nickname ↔ thread id therefore needs the `SubAgentActivity` record, not the call.
- Additional carriers: `CollabAgentToolCall` (`sender_thread_id`,
  `receiver_thread_ids[]`, `agents_states` keyed by thread id) and `agent_message`
  (author/recipient nicknames), each preceded by
  `inter_agent_communication_metadata {trigger_turn}`.
- `SubAgentActivity` was observed only where the `item_completed` stream carries it;
  per-version presence should be confirmed before relying on it for older rollouts.

## 6. Session metadata

- `session_meta` records `model_provider` but not the model. Model and effort come
  from per-turn `turn_context`, so mid-session switches are observable.
- `token_count.info`: `total_token_usage` (cumulative) vs `last_token_usage`
  (per-turn). Monotonic in 46,450 / 46,523 comparisons; the 73 decreases are at
  compaction boundaries. `token_usage_record` (thread/turn/root-turn/response ids)
  is the only response-joinable usage record and appears in 9 of 22 versions.
- `compacted` carries a window chain (`first_window_id` → `previous_window_id` →
  `window_id`, `window_number`, `retained_context`, `guardian_history`).
- Reasoning is encrypted (`encrypted_content` in 99.4%); a plaintext `summary` is
  non-empty in 45%.

## 7. Large outputs

- Response-item output payloads: p50 920 B, p99 40,147, max 399,386; none over 1 MB.
- `item.stdout` / `aggregated_output` peak at exactly 1,048,608 bytes and
  `formatted_output` at 40,109 across independent files — hard caps applied before
  writing, i.e. **silent in-transcript truncation with no marker**. No pointer field
  and no external blob storage were found. `stderr` was empty in every record.
- A payload at exactly a cap value should be labelled "possibly source-truncated";
  its tail is not the true end of the output.

## 8. Contradictions with the research packet

`schemas/native/codex-record.schema.json` (parser-derived) is wrong or silent on the
essentials; `10-schema-guide-and-coverage.md` does not mention Codex.

- Contradicted: `payload.id` described as the session id for `session_meta` without
  the subagent distinction; legacy `sessionId` / top-level `cwd` / `message` /
  `message.role` shapes not observed; object-form `arguments` not observed;
  string-form `content` not observed; `git.sha` not observed (actual:
  `branch` / `commit_hash` / `repository_url`); `duration_ms` is not the command
  duration carrier.
- Missing: the entire `item_completed` stream and taxonomy, `exit_code` / `status` /
  `parsed_cmd` / `process_id`, `ordinal`, the `turn_id` passthrough join, all
  subagent lineage, `token_usage_record`, `world_state`, `thread_settings_applied`,
  and the two-`session_meta` case.

## 9. Not determined

- Whether `turn_aborted` / `compacted` are removed in 0.155.1 (n=2).
- Whether the 1 MiB / 40 KiB caps are configurable.
- Semantics of `world_state.state` and `thread_settings_applied` (contents not read).
- Why `item.id` aligned with `call_id` only in 0.154.0.

## 10. Fixture-capture checklist (structural predicates; scrub all values)

- parent + child pair sharing `session_id`, child newer; child file with two
  `session_meta` records
- `function_call` with JSON-string `arguments` and `namespace`; matching output
- `custom_tool_call` `exec` and `apply_patch` with raw-text `input`; block-array output
- call id with more than one output; call with no output (interrupted turn)
- `item_completed` CommandExecution with non-zero `exit_code` and `status: failed`
- McpToolCall item with `status: failed`; WebSearch item; FileChange item
- `SubAgentActivity` started/completed; `spawn_agent` call + output; `CollabAgentToolCall`
- `turn_aborted`; `compacted` with window chain; `token_count` across a compaction
- reasoning with `encrypted_content` (strip the blob) and with a plaintext summary
- an output at exactly a cap length (synthetic payload of the same length)
- forked session (`forked_from_id` set, `id == session_id`)

## Verification addendum (independent reviewer, 2026-09-18)

Structure-only re-checks on the 300 newest rollouts: `payload.id != call_id` in 18,428
of 19,021 calls (96.9%); first `session_meta` id equals the filename uuid in 300 of 300;
`exit_code` on 16,883 of 16,883 CommandExecution items (status completed 15,918 / failed
965); 0 malformed lines when splitting on LF; `ordinal` strictly increasing with 0
repeats in a 120-file subset. **`spawn_agent` outputs carried an `agent_id` key in 0 of
245 outputs in this newer sample**, against 71 of 582 in the stratified sample — the
field's presence is version- or mode-dependent, which is why it is documented as an
inconsistent lineage source.
