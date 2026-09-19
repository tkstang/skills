---
title: 'Claude Code session schema'
description: 'The on-disk shape of Claude Code JSONL session transcripts as observed in a 2026-09-18 evidence snapshot, for engineers writing parsers against them.'
---

# Claude Code session schema

Claude Code writes each session as a JSON Lines file under a per-project directory. This
page describes the record shapes, the sidecar files around them, and the joins a parser
needs, strictly as observed in one evidence snapshot. It is a reference for building
readers, not a specification: nothing here is a vendor contract, and the format is free to
change between client versions. Related pages: [session schema index](index.md),
[Codex](codex.md), [Cursor](cursor.md), and
[shared transcript-core](../transcript-core.md).

## 1. Observation basis

All statements below come from one structure-only reconnaissance run on one machine on
2026-09-18. The evidence snapshot lives at
`.oat/repo/reference/research/session-schemas-2026-09-18/claude-code/` (a findings
document plus a field/type/count inventory; no message text, paths or identifiers were
retained).

| Dimension       | Value                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| Census          | 2,732 `.jsonl` files under the project directories                                        |
| Sample          | 336 files: 159 readable parent transcripts, 171 subagent transcripts, 6 workflow journals |
| Records parsed  | 220,566                                                                                   |
| Date range      | 2026-07-27 – 2026-09-18                                                                   |
| Client versions | 2.1.220 – 2.1.276 (36 distinct values in the sample)                                      |

Subagent transcripts were sampled stratified (up to five per client `version`) plus the 60
most recent, the 15 largest, and every file matching a rare-feature marker. The largest
version buckets are 2.1.263 (43 files), 2.1.251 (30) and 2.1.273 (23); seven files carry
no `version` at all (workflow journals). Every record class observed spans essentially the
whole version range: no version-gated record _shape_ was found. Three points were
independently re-checked after the initial pass and corrected where needed: records are
one per LF-terminated line (the "multi-line record" report was a reader artifact); an
absent `is_error` flag is not success evidence; and subagent results arrive on `user`
records with a top-level `origin.kind`, not on attachments.

**"Not observed" never means "does not exist."** Every absence stated on this page is an
absence of evidence on one machine over one date range. A parser should tolerate the
shapes described here and degrade gracefully on everything else.

## 2. File layout

Transcripts live under a per-project slug directory (`<slug>/`). The census of file shapes:

| Path shape                                                                   | Count   | Meaning                                         |
| ---------------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| `<slug>/<session-id>.jsonl`                                                  | 160     | Parent (main) session transcript                |
| `<slug>/<session-id>/subagents/agent-<agent-id>.jsonl`                       | 717     | Subagent transcript                             |
| `<slug>/<session-id>/subagents/agent-<agent-id>.meta.json`                   | 717     | Subagent spawn metadata                         |
| `<slug>/<session-id>/subagents/workflows/wf_<id>/agent-<agent-id>.jsonl`     | 1,801   | Workflow-spawned subagent transcript            |
| `<slug>/<session-id>/subagents/workflows/wf_<id>/agent-<agent-id>.meta.json` | 1,801   | …its spawn metadata                             |
| `<slug>/<session-id>/subagents/workflows/wf_<id>/journal.jsonl`              | 60      | Workflow journal (no `sessionId`, no `version`) |
| `<slug>/<session-id>/tool-results/<id>.txt`                                  | 684     | Persisted (externalized) tool output            |
| `<slug>/<session-id>/tool-results/pdf-<uuid>/<n>.jpg`                        | 46      | Rendered PDF pages                              |
| `<slug>/<session-id>/workflows/wf_<id>.json`, `workflows/scripts/*.js`       | 60 / 34 | Workflow definitions                            |
| `<slug>/memory/*.md`                                                         | 83      | Project auto-memory (not a transcript)          |

Only **160 of the 2,732 `.jsonl` files are parent transcripts** — under 6%; the other
~2,570 are subagent or workflow transcripts nested deeper. A reader that globs
`<slug>/*.jsonl` sees parents only: a reasonable default that sees no subagent work.

## 3. Identity and lineage

| Field                                                       | Where                                        | Observation                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionId`                                                 | all message records                          | Exactly one distinct value per file, in 336/336 files. For parent files it always equals the filename stem (159/159). Resume and fork do **not** append to an existing file.                                                                                                    |
| `uuid` / `parentUuid`                                       | all message records                          | Form a DAG within a file. `parentUuid` is `null` at roots (348 in sample). No duplicate `uuid` in any file (0 in 220,566 records).                                                                                                                                              |
| `forkedFrom`                                                | `assistant` 735 / `user` 419 (1,485 records) | `{ sessionId, messageUuid }` — the resume/fork link, naming the ancestor session and the exact message forked from. Cross-file lineage is built from this, never from multiple `sessionId`s in one file.                                                                        |
| `leafUuid`                                                  | `last-prompt` records (7,798)                | Resume pointer to the conversation leaf.                                                                                                                                                                                                                                        |
| `isSidechain`                                               | all message records                          | `true` in **0** parent-file records (`false` 121,406, absent 48,928); `true` in 50,154 of 50,154 subagent-file records.                                                                                                                                                         |
| `agentId`                                                   | subagent files only                          | On 100% of subagent records, absent from 100% of parent records (170,334). Format: `a` plus 16 hex characters, uniform.                                                                                                                                                         |
| `cwd`, `gitBranch`, `version`                               | all message records                          | Present on 171,560 / 171,560 / 100% of message records. Session-level context travels per record, not in a header.                                                                                                                                                              |
| `requestId` / `slug`                                        | `assistant`                                  | API request id (50,145); `slug` on `assistant` 18,872 and `user` 10,784.                                                                                                                                                                                                        |
| `promptId`, `promptSource`, `permissionMode`, `origin.kind` | `user`                                       | `promptId` 28,352; `promptSource` in `typed` 1,858 / `system` 2,220 / `queued` 244 / `sdk` 538; `permissionMode` 2,428; `origin.kind` in `human` 1,109 / `task-notification` 1,130 / `coordinator` 21 / `peer` 2. Distinguishes human input from injected or automatic prompts. |

There is no file header record: identity fields repeat on every message record, so a
streaming reader can establish `sessionId`, `cwd`, `gitBranch` and `version` from the
first record it parses.

### Lineage join through `.meta.json`

Each subagent transcript has a sibling `agent-<agent-id>.meta.json`, a flat object; key
presence was censused over all 2,518 meta files, typing sampled over 400.

| Key                                                                                                                         | Type   | Notes                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agentType`                                                                                                                 | string | Subagent type name; always present                                                                                                                                                                           |
| `spawnDepth`                                                                                                                | number | Always present; gives nesting depth                                                                                                                                                                          |
| `model`                                                                                                                     | string | Resolved model                                                                                                                                                                                               |
| `description`                                                                                                               | string | Short task description; may be absent                                                                                                                                                                        |
| `toolUseId`                                                                                                                 | string | `toolu_*` id of the parent's `Agent` `tool_use`. The join key for directly spawned subagents; a structure-only re-check found it on every plain `subagents/*.meta.json` and on no workflow-spawned meta file |
| `parentAgentId`                                                                                                             | string | Present for nested subagents (agent spawns agent)                                                                                                                                                            |
| `isFork`, `requestNonInteractive`, `requestShape`, `spawnedWithWorktree`, `worktreeBranch`, `worktreePath`, `stoppedByUser` | mixed  | Optional                                                                                                                                                                                                     |

For directly spawned subagents the parent-to-child join is parent `Agent` `tool_use.id` →
`meta.toolUseId` → that meta file's sibling `agent-<agent-id>.jsonl`; `parentAgentId`
chains nested spawns. Workflow-spawned subagents carry no `toolUseId`, so they join to
their parent by directory containment only.

## 4. Record taxonomy

Every line is a JSON object with a top-level `type`; `system` records additionally carry
`subtype`, and `user` / `assistant` records carry `message.role`.

| `type` (`subtype`)                                       | Records       | Files   | Versions  | Notes                                                                          |
| -------------------------------------------------------- | ------------- | ------- | --------- | ------------------------------------------------------------------------------ |
| `attachment`                                             | 87,914        | 320     | .220–.276 | Largest class; 44 distinct `attachment.type` values (section 8)                |
| `assistant`                                              | 50,178        | 321     | .220–.276 | One record **per content block**, not per API response (section 8)             |
| `user`                                                   | 28,413        | 326     | .220–.276 | Carries `tool_result` blocks and `toolUseResult`                               |
| `last-prompt`                                            | 7,798         | 157     | .220–.276 | `{type, sessionId, leafUuid, lastPrompt?}` — resume pointer                    |
| `atis-latch`                                             | 7,241         | 150     | .220–.276 | Host/UI state latch                                                            |
| `mode` / `permission-mode`                               | 6,346 / 6,008 | 57 / 56 | .220–.276 |                                                                                |
| `ai-title`                                               | 5,844         | 63      | .220–.276 | Generated session title                                                        |
| `queue-operation`                                        | 5,566         | 137     | .220–.276 | `operation` in `enqueue` 2,790 / `dequeue` 1,495 / `remove` 1,286 / `popAll` 1 |
| `bridge-session`                                         | 4,820         | 51      | .220–.270 | Not seen at or above .272 in the sample                                        |
| `pr-link`                                                | 3,446         | 21      | .220–.273 | Host-specific                                                                  |
| `cost-state`                                             | 32            | 21      | .233–.270 | Host-specific                                                                  |
| `system` `stop_hook_summary`                             | 2,269         | 66      | .220–.276 | `level: "suggestion"`, no `content`                                            |
| `system` `turn_duration`                                 | 2,121         | 47      | .220–.276 | No `level`, no `content`                                                       |
| `file-history-snapshot`                                  | 1,100         | 54      | .220–.276 | `snapshot.trackedFileBackups` keyed by absolute file path                      |
| `system` `away_summary`                                  | 355           | 42      | .220–.275 | `content: string`                                                              |
| `custom-title` / `agent-name`                            | 206 / 206     | 4 / 4   | .220–.270 |                                                                                |
| `file-history-delta`                                     | 199           | 26      | .220–.276 |                                                                                |
| `frame-link`                                             | 76            | 1       | .247      | Single session; host-specific                                                  |
| `system` `informational`                                 | 43            | 19      | .220–.261 | `level` in `warning` 38 / `notice` 5                                           |
| `system` `local_command`                                 | 40            | 13      | .220–.266 | `level: "info"`, `content: string`                                             |
| `started` / `result`                                     | 39 / 39       | 6 / 6   | (journal) | Workflow `journal.jsonl` only; no `sessionId`, `version` or `timestamp`        |
| `system` `compact_boundary`                              | 20            | 9       | .220–.273 | `level: "info"`, plus `compactMetadata`                                        |
| `artifact-autoreact-ledger` / `artifact-comment-monitor` | 15 / 4        | 1 / 1   | .247      | Host-specific                                                                  |
| `system` `scheduled_task_fire`                           | 4             | 2       | .261–.272 |                                                                                |
| `system` `agents_killed`                                 | 2             | 2       | .251–.258 | No `content`                                                                   |
| `system` `bridge_status`                                 | 1             | 1       | .259      |                                                                                |

Several classes (`atis-latch`, `bridge-session`, `pr-link`, `frame-link`, `ai-title`,
`custom-title`, `agent-name`, `artifact-*`, `cost-state`) look host- or wrapper-injected
rather than core Claude Code. Treat the set above as open: **a reader must tolerate
unknown top-level `type` values** rather than failing or dropping the file. The common
envelope on `user` / `assistant` / `attachment` records is `uuid`, `parentUuid`,
`sessionId`, `timestamp`, `version`, `cwd`, `gitBranch`, `isSidechain`, `userType` (only
`external` observed), and `entrypoint` (`cli` 141,596 / `sdk-cli` 19,447 / `sdk-ts`
10,620).

## 5. Tool calls and results

A tool call is a `tool_use` block inside `assistant.message.content`; its result is a
`tool_result` block in a following `user.message.content`, correlated by `tool_use_id`.

| Metric                                                     | Value                      |
| ---------------------------------------------------------- | -------------------------- |
| `tool_use` blocks                                          | 25,149 (all ids `toolu_*`) |
| Paired with at least one `tool_result` in the same file    | 25,146                     |
| `tool_use` with **no** `tool_result` in the same file      | 3                          |
| `tool_result` with no matching `tool_use` in the same file | 0                          |
| `tool_use` receiving more than one `tool_result`           | 0                          |

Within a file, `tool_use_id` → `tool_result` is effectively a total 1:1 function, and
correlation needs no cross-file join: a subagent's tool calls live entirely inside that
subagent's file. Two extra aids appear on `user` records: `sourceToolAssistantUUID`
(25,106 — the `uuid` of the assistant record that emitted the call) and `sourceToolUseID`
(135).

### `tool_result` content

`user.message.content[type == "tool_result"].content` is polymorphic: a `string` in
23,871 cases, otherwise an array of `text` (773), `image` (420) or `tool_reference` (82)
blocks. `tool_reference` blocks carry a `tool_name` field — a second, block-level place a
tool name appears.

```json
{
  "type": "user",
  "uuid": "<uuid>",
  "message": {
    "role": "user",
    "content": [
      { "type": "tool_result", "tool_use_id": "<tool-use-id>", "content": "…" }
    ]
  },
  "toolUseResult": { "…": "…" }
}
```

### The sibling `toolUseResult` carrier

A `toolUseResult` field sits beside `message` on 22,551 `user` records and holds the
structured form of the result. It is **not always an object**: about 480 cases are a bare
`string` (Bash 395, Agent 34, Read 13, Write 8, Edit 6, plus several MCP tools, `Skill`,
`Monitor`, `AskUserQuestion`, `StructuredOutput`, `TaskStop`), some an `array`, and some a
JSON-encoded string. A reader must type-check before destructuring.

| Tool                                              | `toolUseResult` keys                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Bash`                                            | `stdout`, `stderr`, `interrupted`, `isImage`, `noOutputExpected`, plus optional `bashEditDiff`, `gitOperation`, `backgroundTaskId`, `backgroundCwdHint`, `persistedOutputPath`, `persistedOutputSize`, `returnCodeInterpretation`, `staleReadFileStateHint`, `timedOutAfterMs`, `dangerouslyDisableSandbox`                |
| `Read`                                            | `type` in `text` 811 / `image` 114 / `parts` 16 / `file_unchanged` 1; `file` (object)                                                                                                                                                                                                                                      |
| `Edit`                                            | `filePath`, `oldString`, `newString`, `replaceAll`, `originalFile`, `structuredPatch`, `userModified`, plus `staleRecovered`, `memdirStamped`                                                                                                                                                                              |
| `Write`                                           | `type` in `create` 231 / `update` 54; `filePath`, `content`, `originalFile`, `structuredPatch`, `userModified`                                                                                                                                                                                                             |
| `Agent`                                           | `agentId`, `status`, `description`, `prompt`, `resolvedModel`, `isAsync`, `outputFile`, `canReadOutputFile` (553×); a rare synchronous variant adds `agentType`, `content`, `usage`, `toolStats`, `totalTokens`, `totalToolUseCount`, `totalDurationMs`, `harnessNoteCount`, `harnessSectionHash`, `harnessTailCount` (1×) |
| `WebFetch` / `WebSearch`                          | `url`, `code`, `codeText`, `bytes`, `durationMs`, `result` / `query`, `results`, `searchCount`, `durationSeconds`                                                                                                                                                                                                          |
| `Workflow`                                        | `workflowName`, `runId`, `taskId`, `taskType`, `scriptPath`, `status`, `summary`, `transcriptDir`                                                                                                                                                                                                                          |
| `Skill` / `Monitor` / `ToolSearch` / `TaskOutput` | `commandName`, `success`, `allowedTools?` / `taskId`, `timeoutMs`, `persistent` / `query`, `matches`, `total_deferred_tools` / `task`, `retrieval_status`                                                                                                                                                                  |
| `SendMessage` / `Artifact`                        | `message`, `success`, `pin?`, `msg_id?`, `resumedAgentId?`, `display?` / `artifact_id`, `url`, `version`, `title`, `path`, `updated`, `liveSubscription`                                                                                                                                                                   |
| `AskUserQuestion`                                 | `questions`, `answers` (**keyed by full question text** — a privacy hazard), `annotations?`                                                                                                                                                                                                                                |

Tool-call volume in the sample is dominated by `Bash` 20,603, then `Read` 1,431, `Edit`
1,002, `Agent` 593, `Write` 337, `WebFetch` 286, `SendMessage` 188, `Skill` 138,
`WebSearch` 136, `AskUserQuestion` 132, `ToolSearch` 84, `Workflow` 60, `Monitor` 47,
`StructuredOutput` 32, and a long tail below 15 calls each, plus 39 MCP calls.

### MCP

MCP tool calls use the flat name `mcp__<server>__<tool>` in `tool_use.name`. There is
**no separate server or namespace field** on the block, so a reader that wants the server
must split the name. Thirty-nine MCP calls appear in the sample, across a handful of
servers (names redacted from the snapshot). A separate `mcpMeta` object appears on 12
`user` records with `structuredContent` and `_meta` (the MCP structured-content channel),
and MCP tool _definitions_ appear inside `attachment` records at `attachment.tools[].name`
and `attachment.entries[].name`.

### Denials, rejections, interruptions

| Signal                      | Where                       | Observation                                                                                                                                                                                                                |
| --------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toolDenialKind`            | top level on `user` records | 48 occurrences, sole value `"user-rejected"`. The only structured permission-denial signal; a sibling of `message`, not inside the `tool_result`.                                                                          |
| `interruptedMessageId`      | top level on `user` records | 71 occurrences — the assistant message whose turn the user interrupted.                                                                                                                                                    |
| `toolUseResult.interrupted` | Bash only                   | `false` in all 18,597 sampled observations; `true` appears in 1 of 2,732 files corpus-wide.                                                                                                                                |
| Hook blocking               | `attachment.type`           | `hook_success` 56,349, `hook_non_blocking_error` 45, `hook_blocking_error` 1. There is no per-tool-call hook-block field: the block is a separate `attachment` record that must be correlated by position or `parentUuid`. |

Free-text matching on denial phrasing is unreliable: "rejected" and "permission" occur in
hundreds of ordinary tool outputs carrying `is_error: false`.

## 6. Subagent results

Subagent transcripts are separate files for **every client version observed**
(2.1.220 – 2.1.276); none are inlined into the parent. The parent's `Agent`
`tool_use.input` carries `description` (593), `prompt` (593),
`subagent_type` (572), `model` (532), `run_in_background` (121) and `isolation` (7). The
paired `toolUseResult` carries `agentId`, `status`, `resolvedModel`, `isAsync`,
`outputFile` and `canReadOutputFile`.

**`status` is `async_launched` in 553 of 554 cases** (`completed` once), so the parent's
tool result records _the launch, not the outcome_: no result text, no usage, no tool
counts, no duration. `outputFile` points outside the project transcript directory.

A parent-only read can therefore **name** subagent activity — type, description, model and
`agentId` per spawn — but cannot **see** it. To see the work, follow `agentId` (or
`meta.toolUseId`) into the subagent file; 503 of 554 `agentId`s in the sample resolve to
an existing `<session-dir>/subagents/agent-<id>.jsonl` and 51 do not, from older or pruned
sessions, so a reader must tolerate dangling agent ids. Results reach the parent later as
separate records — principally `user` records whose top-level
`origin.kind == "task-notification"` (1,130), and `SendMessage` tool results. In 553 of
554 observed cases the `Agent` tool result itself carries only launch metadata; one
synchronous exemplar carried the result inline.

## 7. Outcome evidence

**There is no exit code anywhere.** No numeric `exitCode` / `returnCode` field was found
on any of the 22,551 `toolUseResult` carriers. `Bash` records only `stdout`, `stderr`,
`interrupted`, `isImage` and `noOutputExpected`; `returnCodeInterpretation` is a free-text
`string` (148 occurrences), not a number. The only machine-readable outcome bit is
`is_error` on the `tool_result` block:

| Signal                         | Count                                                                 |
| ------------------------------ | --------------------------------------------------------------------- |
| `is_error` present and `false` | 20,269 (Bash 20,206, Workflow 60, SendFeedback 3)                     |
| `is_error` present and `true`  | 496                                                                   |
| `is_error` absent              | ~4,380 (Read, Edit, Write, Agent, WebFetch, WebSearch, Skill, MCP, …) |

`is_error` is emitted as an explicit boolean essentially only by `Bash`. Every other tool
omitted it on success and set it to `true` on failure in this sample. That is an
observation about this sample, not a recorded success signal. The evidence rule is:

> **`is_error === true` is recorded failure evidence. `is_error === false` is recorded
> non-failure evidence. An absent `is_error` records nothing: report the outcome as
> _unknown_ unless another recorded field (for example a `toolUseResult` status)
> establishes it.** Never treat a missing flag as proof of success.

Failure counts in the sample: Bash 395, Agent 34, Read 13, Write 8, Edit 6, Skill 4,
AskUserQuestion 4, Monitor 2, and 3 MCP calls. Other outcome fields on `assistant`
records: `isAbortedMidStream` (3), `truncatedAfterOutput` (4), `isApiErrorMessage` (38),
`apiErrorStatus` (5, number) and `error` (26, string).

A reader must report as **unknown**: exit codes; whether a Bash failure was a non-zero
exit, a timeout or a sandbox denial (only free text distinguishes them); whether a
non-Bash tool succeeded semantically; and whether a denial was a permission prompt or a
hook block, except for the 48 `toolDenialKind` cases.

## 8. Session metadata

**Models.** `message.model` values: `claude-opus-5` 28,522, `claude-fable-5-1` 11,359,
`claude-fable-5` 7,544, `claude-sonnet-5` 2,798, `<synthetic>` 38 (error/placeholder
records). Mid-session model changes are real: of 159 parent files, 133 use one model, 12
use two, 5 use three, 9 have none; all 171 sampled subagent files use exactly one.
`effort` is a top-level `assistant` field (`high` 35,819, `medium` 7,564, `xhigh` 6,834,
`low` 8), with a nullable `perTurnEffort` (5,821).

**Streaming duplication — a double-counting hazard.** Assistant records are written **one
per content block**, not one per API response: each carries `apiBlockIndex` (25,303) and
repeats the same `message.id`. Of 23,715 `(file, message.id)` groups, 17,027 have more
than one record and only 6,688 are singletons, while `message.usage` is present on all
50,261 assistant records, so summing usage naively over-counts by roughly 2×.
**Deduplicate on `(sessionId, message.id)` before aggregating usage.**

**`message.usage` fields** (n = 50,261): `input_tokens`, `output_tokens`,
`cache_creation_input_tokens`, `cache_read_input_tokens` and `cache_creation` are present
on 100%; `service_tier` (50,223 / null 38), `inference_geo` (same split),
`output_tokens_details` (36,837 / null 33), `server_tool_use` (39,791), `iterations`
(39,753 / null 38) and `speed` (39,753 / null 38) are partial. `message.diagnostics`
(object or null, 50,173) carries `cache_miss_reason.{type, cache_missed_input_tokens}`
(620).

**`stop_reason`**: `tool_use` 36,164, `null` 10,470, `end_turn` 3,589, `stop_sequence` 38.
**`requestId`** appears on 50,145 assistant records and identifies the API request.

**Thinking blocks.** 16,748 `thinking` blocks exist, but only 830 (5.0%) carry non-empty
`thinking` text; 15,918 (95.0%) are signature-only. A reader must not assume reasoning
text is available. `attachment.type == "thinking_stripped"` (6) marks removal points.

**Compaction.** `isCompactSummary: true` on 20 `user` records (9 of 2,732 files
corpus-wide), paired with a `system` record whose `subtype` is `compact_boundary` (20),
whose `compactMetadata` keys are `trigger`, `preTokens`, `postTokens`, `durationMs`,
`preservedMessages`, `preservedSegment`, `preCompactDiscoveredTools` and
`cumulativeDroppedTokens`. Compacted records also carry `isVisibleInTranscriptOnly: true`
(20), and a `compact_file_reference` attachment (41) points at externalized
pre-compaction content. **`system` records** always have a `subtype`; `level` (`info` /
`warning` / `notice` / `suggestion`) appears only on some subtypes; `content` is always a
`string` when present and is absent entirely on `stop_hook_summary`, `turn_duration` and
`agents_killed`.

**`attachment.type`** is the richest metadata channel: 44 distinct values over 87,914
records, and the set should be treated as open. The largest are `hook_success` 56,349,
`total_tokens_reminder` 17,211, `batching_reminder_sent` 5,232,
`bash_output_audience_note` 3,372, `queued_command` 738 and `environment` 696; the rare
tail carries the structural signals cited elsewhere on this page, including
`compact_file_reference` 41, `read_truncation_notice` 31, `thinking_stripped` 6 and
`hook_blocking_error` 1. Full counts are in the snapshot inventory.

**Attribution fields** on `assistant` records: `attributionAgent` 16,101,
`attributionSkill` 9,800, `attributionMcpServer` / `attributionMcpTool` 82,
`attributionPlugin` 22, `advisorModel` 373. **Slash commands** have no structured record
type: they appear as `user.message.content` strings containing `<command-name>` (130
files) and `<local-command-stdout>` (70), and as `system` records with
`subtype: local_command` (40).

## 9. Externally persisted output and sizes

Large Bash output is written to a sidecar file and referenced two ways that do not carry
the same information. In the transcript text, the `tool_result` content contains a bare
`<persisted-output>` marker (270 occurrences in the sample; no attributes observed on the
tag). The **path** appears only in the sibling `toolUseResult.persistedOutputPath`,
alongside `persistedOutputSize` — 254 carriers, all on `Bash`. A reader consuming only
`message.content[type == "tool_result"]` sees the marker and cannot resolve it. Every
observed path has the shape
`<slug>/<session-id>/tool-results/<9-char-id>.txt`, and 251 of the 254 targets still exist
on disk (3 missing), so resolution must tolerate a missing file. Corpus-wide the literal
token `persisted-output` appears in 444 of 2,732 files. Other sidecars:
`tool-results/pdf-<uuid>/*.jpg` (46 rendered PDF pages), one `tool-results/*.pdf`, and
workflow definitions under `<session-id>/workflows/`.

Payload sizes, characters per `tool_result` block; overall (n = 25,146) p50 889,
p90 7,879, p99 162,338, max 681,794.

| Tool                                        | n      | p50    | p90     | p99     | max     |
| ------------------------------------------- | ------ | ------ | ------- | ------- | ------- |
| `Read`                                      | 1,431  | 20,706 | 201,762 | 416,559 | 681,794 |
| `Bash`                                      | 20,601 | 884    | 6,080   | 20,942  | 29,937  |
| `WebFetch`                                  | 285    | 1,047  | 2,557   | 45,038  | 45,038  |
| `mcp__<server>__<tool>` (one MCP read tool) | 5      | 9,280  | 24,660  | —       | 24,660  |
| `WebSearch`                                 | 136    | 2,494  | 3,043   | 3,874   | 6,017   |
| `Agent`                                     | 593    | 1,084  | 1,099   | 1,119   | 3,248   |
| `Edit`                                      | 1,002  | 210    | 254     | 356     | 490     |

Bash output is effectively capped near 30 KB, with overflow going to `tool-results/`.
`Read` is not capped and dominates memory cost: a reader that materializes whole records
should stream or cap `Read` results itself. The word "truncated" appears in 189
`tool_result` payloads, but **no structured truncation field or marker token was found**;
the structured truncation signals that do exist are
`attachment.type == "read_truncation_notice"` (31) and `truncatedAfterOutput` (4).

## 10. Known errors in earlier research

The earlier research packet (2026-09-10) carried a Claude Code record schema. It claims
three things **not observed** here in 2,732 files across 2.1.220 – 2.1.276:

- `sessionID` and `session_id` — only `sessionId` exists.
- A `summary` property and `type: "summary"` records — zero corpus-wide.
- `model` as a _top-level_ record property — the model lives at `message.model`; a
  top-level `model` exists only on `attachment` records whose `attachment.type` is
  `model`.

It correctly flagged `toolUseResult.answers` being keyed by full question text as a
privacy hazard, and its other listed fields (`toolUseResult.annotations` and `.agentId`,
`queue-operation`, `isCompactSummary`, `leafUuid`, `isMeta`, `permissionMode`, `slug`,
`entrypoint`, `userType`, `cwd`, `gitBranch`) were all confirmed.

It **omits** these, all load-bearing for correlating activity: `isSidechain`, `agentId`,
`subtype` on `system` records, `forkedFrom`, `toolDenialKind`, `interruptedMessageId`,
`sourceToolAssistantUUID`, `sourceToolUseID`, `requestId`, `apiBlockIndex`, `effort` /
`perTurnEffort`, the `attribution*` family, `promptSource`, `promptId`, `origin`,
`mcpMeta`, `message.diagnostics`, `isApiErrorMessage` / `apiErrorStatus`,
`isAbortedMidStream`, `truncatedAfterOutput`, `queuePriority` and `scheduledTaskId`.

Two structural facts it does not cover at all, each changing a reader's design: subagent
transcripts are **separate files** joined through `.meta.json` `toolUseId` (the packet
describes only a `toolUseResult.agentId` extraction path), and `Agent` tool results are
launches, not outcomes (553 of 554).

## 11. Not observed / not determined

Each item was searched for and not found in the stated corpus — an absence of evidence on
one machine, not a statement that the shape cannot exist.

| Searched for                                                                                      | Corpus searched                                                                                    |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `type: "summary"` or a `summary` top-level property; `type: "progress"`                           | 2,732 files                                                                                        |
| `isSidechain: true`, or any `agentId`, inside a parent `<session-id>.jsonl`                       | 159 parent files / 170,334 parent records                                                          |
| A file containing more than one `sessionId`                                                       | 336 files                                                                                          |
| Duplicate `uuid` within a file                                                                    | 220,566 records                                                                                    |
| A `tool_use` receiving two `tool_result`s, or a `tool_result` with no `tool_use` in the same file | 25,149 tool uses                                                                                   |
| A numeric `exitCode` / `returnCode` field                                                         | 22,551 `toolUseResult` carriers                                                                    |
| `redacted_thinking` blocks                                                                        | 16,748 thinking blocks                                                                             |
| `stop_reason: "max_tokens"`                                                                       | 50,261 assistant records                                                                           |
| A structured truncation field or `<truncated>`-style marker                                       | 25,146 `tool_result` payloads                                                                      |
| `toolDenialKind` values other than `user-rejected`                                                | 48 occurrences                                                                                     |
| A server/namespace field on MCP `tool_use` blocks                                                 | 39 MCP calls                                                                                       |
| `toolUseResult.interrupted: true`                                                                 | 18,597 sampled Bash results (observed in 1 of 2,732 files corpus-wide)                             |
| Version-gated record _shapes_                                                                     | whole sample; narrower ranges only on low-frequency host-specific classes, which sampling explains |

**Withdrawn worker claim: multi-line records.** An initial scanner reported records
spanning 2–9 physical lines. That abandoned scanner treated U+2028 and U+2029 inside
transcript string values as record boundaries. Splitting on the LF byte only yields **0
malformed lines** across 300 recent files (256,296 lines). Records are one per
LF-terminated line. **Do not build multi-line record recovery.** Split on `\n` bytes
only, and keep a fixture whose string values contain U+2028, U+2029 and `\r`.

## 12. Fixture checklist

Shapes worth a fixture, with a predicate selecting an exemplar record (usable as
`jq -c 'select(<predicate>)' <file>`). Sanitize before committing; the last row holds
private keys by design.

| Group                         | Shapes                                                                                         | Structural predicate                                                                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming duplication         | Assistant turn split across content blocks                                                     | `.type=="assistant" and .apiBlockIndex>0`                                                                                                                                                 |
| Bash carrier variants         | Success with structured carrier; background task; git-operation enrichment                     | `(.toolUseResult\|type)=="object" and (.toolUseResult\|has("stdout"))`; `.toolUseResult.backgroundTaskId? != null`; `.toolUseResult.gitOperation? != null`                                |
| Failure                       | Bash failure (and any `is_error` failure)                                                      | `.type=="user" and ([.message.content[]?\|select(.type=="tool_result" and .is_error==true)]\|length>0)`                                                                                   |
| Persisted output              | Bash result externalized to `tool-results/`                                                    | `.toolUseResult.persistedOutputPath? != null`                                                                                                                                             |
| Carrier type mismatch         | `toolUseResult` as a bare string; as an array                                                  | `(.toolUseResult\|type)=="string"`; `(.toolUseResult\|type)=="array"`                                                                                                                     |
| Edit/Read/Write variants      | Edit with `structuredPatch`; Read `image` / `parts` / `file_unchanged`                         | `.toolUseResult.structuredPatch? != null`; `.toolUseResult.type? \| IN("image","parts","file_unchanged")`                                                                                 |
| Agent launch vs result        | Async launch (common); synchronous result with usage and tool stats; the parent's `Agent` call | `.toolUseResult.status?=="async_launched"`; `.toolUseResult.toolStats? != null`; `.type=="assistant" and ([.message.content[]?\|select(.type=="tool_use" and .name=="Agent")]\|length>0)` |
| Subagent lineage              | Subagent record; nested subagent; spawn-metadata join key                                      | `.isSidechain==true and (.agentId\|type)=="string"`; on `agent-*.meta.json`: `.parentAgentId != null`; `.toolUseId != null and .agentType != null`                                        |
| Subagent result delivery      | Task-notification `user` record                                                                | `.type=="user" and .origin.kind=="task-notification"`                                                                                                                                     |
| Session lineage               | Fork/resume link; resume leaf pointer; mid-session model change                                | `.forkedFrom? != null`; `.type=="last-prompt"`; two distinct `.message.model` values within one `sessionId`                                                                               |
| Interruption and denial       | User tool denial; interrupted turn                                                             | `.toolDenialKind? != null`; `.interruptedMessageId? != null`                                                                                                                              |
| Assistant-level errors        | Aborted mid-stream or truncated; API error record                                              | `.isAbortedMidStream==true or .truncatedAfterOutput==true`; `.isApiErrorMessage==true`                                                                                                    |
| Compaction                    | Summary record and its boundary                                                                | `.isCompactSummary==true`; `.type=="system" and .subtype=="compact_boundary"`                                                                                                             |
| Attachment signals            | Hook blocking error; read truncation notice                                                    | `.type=="attachment" and .attachment.type=="hook_blocking_error"`; `.type=="attachment" and .attachment.type=="read_truncation_notice"`                                                   |
| MCP                           | MCP call and its structured content                                                            | `([.message.content[]?\|select(.type=="tool_use" and (.name\|startswith("mcp__")))]\|length>0)`; `.mcpMeta? != null`                                                                      |
| Block-array results           | `tool_result` with `text` / `image` / `tool_reference` blocks                                  | `([.message.content[]?\|select(.type=="tool_result" and (.content\|type)=="array")]\|length>0)`                                                                                           |
| Thinking                      | Signature-only block; block with text                                                          | `([.message.content[]?\|select(.type=="thinking" and (.thinking\|length)==0)]\|length>0)`; same with `>0`                                                                                 |
| Host/UI records               | Slash-command turn; queue-operation lifecycle                                                  | `.type=="user" and (.message.content\|type)=="string"` (text contains `<command-name>`); `.type=="queue-operation" and .operation=="dequeue"`                                             |
| Workflow                      | Workflow subagent and its journal                                                              | `.toolUseResult.workflowName? != null`; in the journal: `.type=="started" or .type=="result"`                                                                                             |
| Line-splitting guard          | Record whose string values contain U+2028 / U+2029 / `\r`                                      | Not selectable with `jq`; construct synthetically and assert the reader splits on `\n` bytes only                                                                                         |
| Private-key shapes (sanitize) | File-history snapshot (absolute-path keys); `AskUserQuestion` answers (question-text keys)     | `.type=="file-history-snapshot"`; `.toolUseResult.answers? != null`                                                                                                                       |
