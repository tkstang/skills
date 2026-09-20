---
title: 'Codex session schema'
description: 'The Codex rollout transcript format as observed on 2026-09-18 — record taxonomy, tool-call carriers, subagent lineage, outcome evidence, and the limits of each join.'
---

# Codex session schema

Codex writes one JSONL rollout file per thread. Every line is a record with a top-level
discriminator (`type`) and a `payload` that carries its own discriminator for the larger
groups. This page describes the shapes actually seen in a bounded sample, what joins
reliably, and where a parser must refuse to guess.

For the shared, provider-neutral model see [transcript core](../transcript-core.md). For
the other providers see [Claude Code](claude-code.md) and [Cursor](cursor.md); the
[session schemas index](index.md) lists all three.

## Observation basis

> **Observed, not specified.** Everything here comes from reading rollout files on one
> machine on 2026-09-18: 333 files, 307,938 records, 22 distinct `cli_version` values
> spanning 0.142.4–0.155.1, with record dates from 2026-07-02 to 2026-09-18. The sample
> was stratified by version, with forced inclusion of sessions containing subagents,
> custom and function calls, web search, MCP, failures, aborts, and compaction. No
> file was unreadable. An abandoned scanner reported 17 lines as malformed after
> treating U+2028 and U+2029 inside string values as record boundaries; splitting on
> the LF byte only yields 0. **Readers must split on `\n` bytes only.** There is no published schema behind
> any of this, so **"not observed" never means "does not exist"** — it means this sample
> did not contain it. Treat every count as a property of the sample, not of Codex.

Identity and lineage claims — the `id`/`session_id` rule, the filename correspondence,
the multiple-`session_meta` case, the subagent share of recent files, and the inherited
history analysis — were independently re-checked on a separate 500-file sample (files
modified since 2026-08-20) or on a named parent/child pair. Those are the claims marked
**[verified]** below; the rest come from a single pass.

The evidence snapshot, including the raw findings and a machine-readable inventory,
lives at `.oat/repo/reference/research/session-schemas-2026-09-18/codex/`.

## File layout and identity

Rollouts live under `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`. The filename embeds
a uuid.

| Property                 | Observation                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| File identity            | The **first** `session_meta` record. Its `payload.id` equals the filename uuid in **500/500** files **[verified]**.                                    |
| `payload.id`             | The thread's own id.                                                                                                                                   |
| `payload.session_id`     | The **root** thread id.                                                                                                                                |
| Subagent test            | `payload.id != payload.session_id` ⇔ subagent, exactly: 379/379 subagent files differ, 0 non-subagent files differ (500-file re-check) **[verified]**. |
| Forks                    | A forked session (`forked_from_id` set) keeps `id == session_id`, so forks are not subagents under this test.                                          |
| `payload.source`         | A bare **string** for cli / vscode / exec sessions; an **object** for subagents. A parser must accept both.                                            |
| `payload.model_provider` | Present; the model name is not here (see [Session metadata](#session-metadata)).                                                                       |

A file can contain **more than one** `session_meta` record, and this is common: 71 of
500 files have two **[verified]**. In every such file the two headers carry _different_
`id`s, the subagent's header is first, and the parent's header sits on line 2. A
validation rule requiring all `session_meta` ids in a file to agree would reject roughly
14–16% of files, all of them children. Resolve identity from the first header and
corroborate it against the filename; never assume uniqueness.

Subagent files dominate recent activity: **379 of the 500** most recently modified files
are subagent threads **[verified]**. Resolving a child to its parent is therefore a
mainline path, not an edge case, for any workspace that uses subagents.

```json
{
  "type": "session_meta",
  "payload": { "id": "<uuid>", "session_id": "<uuid>", "source": "…", "…": "…" }
}
```

## Subagent lineage

### Fields on the child header

| Field                            | Where                            | Notes                                                                                             |
| -------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `parent_thread_id`               | `source.subagent.thread_spawn.*` | Also promoted to top-level `payload.*` on newer versions — read both locations.                   |
| `depth`                          | `source.subagent.thread_spawn.*` | Same dual placement.                                                                              |
| `agent_path`                     | `source.subagent.thread_spawn.*` | Same dual placement.                                                                              |
| `agent_nickname`                 | `source.subagent.thread_spawn.*` | Same dual placement.                                                                              |
| `agent_role`                     | `source.subagent.thread_spawn.*` | Same dual placement.                                                                              |
| `subagent_history_start_ordinal` | `session_meta.payload`           | Present on 27% of headers in the main sample. See below.                                          |
| `forked_from_ordinal_exclusive`  | `session_meta.payload`           | Observed; not seen on child headers in the 500-file re-check.                                     |
| `history_base`                   | `session_meta.payload`           | `{thread_id, end_ordinal_exclusive, end_byte_offset}`. Not seen on child headers in the re-check. |

### What the parent records about a child

The parent file can name its children natively **[verified on the named pair]**:
`item_completed` items of type `SubAgentActivity` carry `agent_thread_id` equal to the
child's own `session_meta.id` — the same uuid the child filename embeds — plus
`agent_path` and a `kind` in `started` / `interacted` / `completed` / `interrupted`
(1,161 / 502 / 410 / 30 occurrences across the sample).

The `spawn_agent` call is an **inconsistent** lineage source. Its arguments (`message`,
`agent_type`, `task_name`, `fork_turns`, `model`, `reasoning_effort`) contain no thread
id. Its output returns `nickname` (550) and `task_name` (479), and carries `agent_id` in
**71 of 582** outputs. When `agent_id` is present it is recorded evidence and can be
used; when it is absent, do not infer the child from the nickname or from adjacency.
`SubAgentActivity` is the carrier that names the child thread wherever the
`item_completed` stream records it.

Two further carriers describe cross-agent traffic: `CollabAgentToolCall`
(`sender_thread_id`, `receiver_thread_ids[]`, `agents_states` keyed by thread id) and
`agent_message` (author and recipient nicknames). Each is preceded by
`inter_agent_communication_metadata {trigger_turn}`.

The `item_completed` stream is universal in the sample, but per-version presence of the
`SubAgentActivity` item type is unconfirmed for older rollouts. Confirm it before relying
on it there.

### Inherited parent history inside child files

**[verified, root re-check on 379 child files]** A child file can begin with a copy of
the parent's context. 138 of 379 child files (36%) declare
`session_meta.payload.subagent_history_start_ordinal` on their first header. Records
whose top-level `ordinal` is **below** that value are inherited parent context, not the
child's own work: 11,494 inherited records against 31,266 own records in the sample,
including 2,704 inherited tool-call records across 64 files.

Three discriminators, in descending order of reliability:

| Signal                                     | Strength                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `ordinal < subagent_history_start_ordinal` | Authoritative where the marker exists (138 files).                                    |
| `turn_id` disjointness                     | Inherited records' `turn_id`s are disjoint from the child's own in **138/138** files. |
| Timestamps                                 | Useless. No inherited record predates the child file's creation time.                 |

The second `session_meta` record (the 71 two-header files) always carries the parent's
id (71/71) and always falls inside the inherited range (70/70 where the marker is
present). One two-header file has no marker, and ownership of its early records is
**undetermined**. 68 files carry the marker with no second header.

Inherited call ids do **not** match the direct parent's call ids — 0 of 184 across 25
checked pairs — so inherited calls cannot be de-duplicated against the parent file by
`call_id`. The reason is undetermined.

Consequence for a reader that counts activity: classify `ordinal <
subagent_history_start_ordinal` as inherited and exclude it from the child's invocation
counts. Where the marker is absent but a second header exists, ownership is `unknown`
and should be reported as such rather than guessed.

## Record taxonomy

27 discriminator groups were observed. The following have a stable shape across the
versions where they appear; all but `token_usage_record` appear in all 22 versions.

| Group                                                            | Counts and notes                                    |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| `session_meta`                                                   | Stable. File identity; may repeat (above).          |
| `turn_context`                                                   | Stable. Per-turn model and effort.                  |
| `world_state`                                                    | Stable. `state` contents not read.                  |
| `token_usage_record`                                             | Stable shape, but present in only 9 of 22 versions. |
| `response_item` · `reasoning`                                    | 43.5k                                               |
| `response_item` · `custom_tool_call` / `custom_tool_call_output` | 30.5k                                               |
| `response_item` · `message`                                      | 16.9k                                               |
| `response_item` · `function_call` / `function_call_output`       | 15.1k                                               |

The `event_msg` layer is the volatile part. Shapes appear and disappear between
versions, so a parser must tolerate unknown `event_msg` payload types rather than
failing on them.

| `event_msg` shape                                                                             | Versions observed                                        |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `patch_apply_end`, `user_message`, `agent_message`, `sub_agent_activity`, `context_compacted` | 0.151.0–0.153.4 only                                     |
| `tool_search_call` / `tool_search_output`, `web_search_call`                                  | 0.142.x only                                             |
| `turn_aborted`, `compacted`                                                                   | Not observed in the two 0.155.1 files (n=2, unconfirmed) |
| `item_completed`                                                                              | Universal, 86.5k records                                 |

`item_completed.payload.item.type` has its own 15-member sub-taxonomy:

| `item.type`           | Count  |
| --------------------- | ------ |
| `Reasoning`           | 40,496 |
| `CommandExecution`    | 20,441 |
| `AgentMessage`        | 13,096 |
| `CollabAgentToolCall` | 4,271  |
| `FileChange`          | 3,507  |
| `SubAgentActivity`    | 2,103  |
| `UserMessage`         | 1,490  |
| `ContextCompaction`   | 376    |
| `McpToolCall`         | 340    |
| `WebSearch`           | 249    |
| `Extension`           | 164    |
| `ImageView`           | 19     |
| `EnteredReviewMode`   | 7      |
| `ExitedReviewMode`    | 7      |
| `HookPrompt`          | 2      |

## Tool calls and results

Two parallel streams describe tool use: the `response_item` stream (keyed by
`call_id`) and the `item_completed` stream (keyed by `item.id` and `ordinal`). Calls live in both, with different ids and
different content. [Joining the two streams](#joining-the-two-streams) covers the
consequences.

### `function_call`

| Field               | Type   | Notes                                                                                                     |
| ------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `payload.call_id`   | string | The join key within the response stream.                                                                  |
| `payload.id`        | string | **Not** the call id. Differs from `call_id` in 45,097 of 45,647 calls. Never correlate on it.             |
| `payload.arguments` | string | A **JSON-encoded string** in 100% of 15,092 records. The object form was not observed; decode before use. |
| `payload.namespace` | string | Optional, present on 48% of records. Separate from the tool name.                                         |

This carrier holds everything that is not `exec` or `apply_patch`, including MCP calls
and `spawn_agent`.

### `function_call_output`

| Field             | Type            | Notes                                                                                                                                                                                                                                       |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payload.call_id` | string          | Joins to the call.                                                                                                                                                                                                                          |
| `payload.output`  | array \| string | An array of `input_text` / `input_image` blocks, a bare string, or a JSON-encoded string. All three shapes were observed across output records; the split per carrier was measured only for `custom_tool_call_output` (block array in 96%). |
| —                 | —               | No status, exit code, or duration. See [Outcome evidence](#outcome-evidence).                                                                                                                                                               |

### `custom_tool_call`

| Field             | Type   | Notes                                                                |
| ----------------- | ------ | -------------------------------------------------------------------- |
| `payload.name`    | string | Only two values observed: `exec` (29,944) and `apply_patch` (608).   |
| `payload.call_id` | string | Joins to the output.                                                 |
| `payload.input`   | string | **Raw text, never JSON.** Do not attempt to parse it as arguments.   |
| `payload.status`  | string | A constant `completed`. Carries no information — see the trap below. |

### `custom_tool_call_output`

| Field             | Type            | Notes                                                                                |
| ----------------- | --------------- | ------------------------------------------------------------------------------------ |
| `payload.call_id` | string          | Joins to the call.                                                                   |
| `payload.output`  | array \| string | The block array form dominates here: 96% are arrays of `input_text` / `input_image`. |
| —                 | —               | No status, exit code, or duration.                                                   |

### MCP

MCP has **no dedicated response-item type**. An MCP invocation is a `function_call` in
the response stream plus an `item_completed` item of type `McpToolCall` carrying
`server`, `tool`, `arguments`, `result`, `duration`, `status`, `error`, and
`readOnlyHint`. The outcome fields exist only on the item, not on the call output.

### Web search

Web search appears as the `item_completed` item type `WebSearch` (249 items). A separate
`web_search_call` `event_msg` shape was observed in 0.142.x only. `WebSearch` items carry
no status field.

### Correlation completeness

Within a single file, `call_id` correlation is close to total: **4 calls without an
output, 0 outputs without a call, and 9 call ids with more than one output**. A parser
must therefore model output as a list per call id, not a single value, and must tolerate
a call whose output never arrives (an interrupted turn).

## Outcome evidence

This is the constraint most likely to produce a wrong reader.

- `function_call_output` and `custom_tool_call_output` carry **no status, no exit code,
  and no duration**. A successful and a failed command look identical in the response
  stream.
- `custom_tool_call.payload.status` is a **constant `completed`** across every record.
  Reading it as success is the central trap of this format.
- Outcome lives only in the `item_completed` stream:

| Field            | Where              | Observation                                                                                       |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| `item.exit_code` | `CommandExecution` | Present on 100% of items. Distribution: 0 → 19,444; 1 → 784; 2 → 116; 130 → 19; plus a long tail. |
| `item.status`    | `CommandExecution` | `completed` / `failed` = 19,444 / 997.                                                            |
| `item.status`    | `McpToolCall`      | `completed` / `failed` = 300 / 40.                                                                |
| `item.duration`  | items with timing  | `{secs, nanos}`.                                                                                  |

- `WebSearch`, `Reasoning`, `AgentMessage`, and `Extension` items carry **no status**.
  For these, the only honest outcome is `unknown`.
- `turn_aborted.reason` was `interrupted` in all 105 records. It is **turn-level**: it
  never names which call was interrupted, so it cannot be attributed to a specific tool
  invocation.

## Joining the two streams

`item_completed.payload.item.id` does **not** join to `call_id`. The numbers:

| Item type          | Items whose `item.id` matched a `call_id`                                        |
| ------------------ | -------------------------------------------------------------------------------- |
| `CommandExecution` | 432 of 20,441 — and **all 432 are from 0.154.0**; every other version matched 0. |
| `FileChange`       | 587 of 3,507                                                                     |
| `WebSearch`        | 53 of 249                                                                        |
| `McpToolCall`      | 13 of 340                                                                        |

Why 0.154.0 aligned is undetermined. Do not build on it.

What does join is the turn:

- `item_completed.payload.turn_id` ↔
  `response_item.payload.internal_chat_message_metadata_passthrough.turn_id`, with full
  overlap in 143 of 149 files and 0 disjoint files.
- `ordinal` is a file-wide, strictly increasing sequence: 196,099 increments, 1 repeat,
  0 decrements.

So the only explicit correlation is `call_id`, and it exists **within** the response
stream. Attaching an exit code or status from the item stream to a specific call
requires matching on turn plus ordinal adjacency. That is an **inferred join**. It is
weaker evidence than a native id, it must be labelled as inferred wherever it surfaces,
and it must never overwrite an outcome a call already reports about itself.

One practical corollary: exec output is stored **twice** — once as response-item output
and once in the item stream — under different id schemes. Pick one carrier for previews
rather than merging them, or the same bytes will appear twice.

## Session metadata

| Concern                    | Where it lives                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model and reasoning effort | Per-turn `turn_context`, not `session_meta`. `session_meta` records `model_provider` only. Because the value is per turn, mid-session model and effort switches are observable. |
| Token usage                | `token_count.info` with `total_token_usage` (cumulative) and `last_token_usage` (per turn).                                                                                     |
| Response-joinable usage    | `token_usage_record` (thread, turn, root-turn, and response ids). The only usage record joinable to a response; present in 9 of 22 versions.                                    |
| Compaction                 | `compacted`, carrying a window chain: `first_window_id` → `previous_window_id` → `window_id`, plus `window_number`, `retained_context`, `guardian_history`.                     |
| Reasoning                  | `encrypted_content` on 99.4% of reasoning records. A plaintext `summary` is non-empty on 45%.                                                                                   |

Codex has no native skill-invocation or skill-version field in the observed
transcripts. Historical Codex builds did expose an experimental native
`read_file` function with JSON arguments containing required `file_path` and
optional `offset`, `limit`, `mode`, and `indentation`; upstream removed it on
2026-03-25 in commit
[`14c35a16`](https://github.com/openai/codex/commit/14c35a16a8a41cc16c5e36c2c4287b7b2db6e975).
The reader recognizes only that exact native name and path key. The carrier is
absent from the recent local sample. Current shell reads, aliases, and prose
mentions are not equivalent evidence.

The cumulative counter is not strictly monotonic: it rose in 46,450 of 46,523
comparisons, and all 73 decreases sit at compaction boundaries. A reader that assumes
monotonicity will compute negative deltas at exactly those points; treat a decrease as a
compaction signal, not as corrupt data.

The activity reader preserves `total_token_usage`, `last_token_usage`, and
`token_usage_record` as separate semantics. Identical token-count snapshots are
collapsed; a cumulative decrease starts a numbered segment and emits a reset
diagnostic rather than a negative delta. Response usage can inherit a model only
when its recorded `turn_id` joins a `turn_context`; totals and last-turn records
remain model-unknown when no native join exists. No counter is converted to
price or cost.

## Output size limits

| Measurement                         | Value                                                         |
| ----------------------------------- | ------------------------------------------------------------- |
| Response-item output payload size   | p50 920 B · p99 40,147 B · max 399,386 B; none exceeded 1 MB. |
| `item.stdout` / `aggregated_output` | Peak at exactly **1,048,608 bytes** across independent files. |
| `formatted_output`                  | Peaks at exactly **40,109 bytes** across independent files.   |
| `stderr`                            | Empty in every record observed.                               |

The exact repetition of those peak values across unrelated files means a hard cap is
applied before writing. The truncation is **silent**: no marker, no pointer field, and
no external blob storage was found. A payload whose length is exactly a cap value should
be labelled "possibly source-truncated" — its tail is not the true end of the output.

## Known errors in earlier research

The 2026-09-10 research packet's Codex schema —
`schemas/native/codex-record.schema.json`, which was parser-derived — is wrong or
silent on the essentials, and
`10-schema-guide-and-coverage.md` does not mention Codex at all.

Contradicted by observation:

- `payload.id` described as the session id for `session_meta`, with no subagent
  distinction — the `id` vs `session_id` split is the whole lineage signal.
- Legacy `sessionId`, top-level `cwd`, top-level `message`, and `message.role` shapes:
  not observed.
- Object-form `arguments`: not observed (100% JSON-encoded string).
- String-form `content`: not observed.
- `git.sha`: not observed. The actual fields are `branch`, `commit_hash`, and
  `repository_url`.
- `duration_ms` presented as the command duration carrier: it is not.

Missing entirely:

- The whole `item_completed` stream and its item taxonomy.
- `exit_code`, `status`, `parsed_cmd`, `process_id` — that is, all outcome evidence.
- `ordinal` and the `turn_id` passthrough join.
- All subagent lineage.
- `token_usage_record`, `world_state`, `thread_settings_applied`.
- The two-`session_meta` case.

## Not observed / not determined

- Whether `turn_aborted` and `compacted` were removed in 0.155.1. Only two 0.155.1 files
  were in the sample, so their absence there is not evidence of removal.
- Whether the 1 MiB and 40 KiB caps are configurable.
- The semantics of `world_state.state` and `thread_settings_applied`; their contents were
  not read.
- Why `item.id` aligned with `call_id` in 0.154.0 and no other version.
- Why inherited call ids do not match the direct parent's call ids.
- Ownership of the early records in the one two-header file that has no
  `subagent_history_start_ordinal`.
- Per-version presence of `SubAgentActivity` in older rollouts.

## Fixture checklist

Shapes worth capturing as sanitized fixtures. These are structural predicates; scrub
every value.

- A parent and child pair sharing `session_id`, child newer; plus a child file with two
  `session_meta` records.
- A `function_call` with JSON-string `arguments` and a `namespace`, with its matching
  output.
- A `custom_tool_call` of each name — `exec` and `apply_patch` — with raw-text `input`
  and a block-array output.
- A call id with more than one output, and a call with no output (interrupted turn).
- An `item_completed` `CommandExecution` with a non-zero `exit_code` and
  `status: failed`.
- An `McpToolCall` item with `status: failed`; a `WebSearch` item; a `FileChange` item.
- `SubAgentActivity` `started` and `completed`; a `spawn_agent` call with its output; a
  `CollabAgentToolCall`.
- `turn_aborted`; `compacted` with its window chain; `token_count` spanning a compaction.
- A reasoning record with `encrypted_content` (strip the blob) and one with a plaintext
  summary.
- An output at exactly a cap length — use a synthetic payload of the same length.
- A forked session with `forked_from_id` set and `id == session_id`.
