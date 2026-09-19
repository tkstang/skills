# Claude Code native session transcript schema — observed evidence

Structure-only reconnaissance of the Claude Code JSONL transcripts on this machine,
produced to inform an opt-in "activity view" (correlated tool calls/results, subagent
lineage, session metadata).

**Privacy contract.** This document and the companion `inventory.json` contain field
paths, JSON types, discriminator/enum values and counts only. No message text, command
strings, file contents, tool output, user paths or identifiers are reproduced.
Counts in this document come from the worker's stratified sample and its own
structural passes. The `inventory.json` beside this file is a separate, fully
reproducible snapshot (newest 300 files by mtime, `inventory.mjs`, no post-processing);
the worker's original post-processed inventory was discarded.

---

## 0. Corpus, sampling, method

**On-disk layout** (`~/.claude/projects/<slug>/`), full census of 2,732 `.jsonl` files:

| Path shape | Count | Meaning |
| --- | --- | --- |
| `<slug>/<session-id>.jsonl` | 160 | **Parent (main) session transcript** |
| `<slug>/<session-id>/subagents/agent-<agent-id>.jsonl` | 717 | Subagent transcript |
| `<slug>/<session-id>/subagents/agent-<agent-id>.meta.json` | 717 | Subagent spawn metadata |
| `<slug>/<session-id>/subagents/workflows/wf_<id>/agent-<agent-id>.jsonl` | 1,801 | Workflow-spawned subagent transcript |
| `<slug>/<session-id>/subagents/workflows/wf_<id>/agent-<agent-id>.meta.json` | 1,801 | …its spawn metadata |
| `<slug>/<session-id>/subagents/workflows/wf_<id>/journal.jsonl` | 60 | Workflow journal (no `sessionId`, no `version`) |
| `<slug>/<session-id>/tool-results/<id>.txt` | 684 | **Persisted (externalised) tool output** |
| `<slug>/<session-id>/tool-results/pdf-<uuid>/<n>.jpg` | 46 | Rendered PDF pages |
| `<slug>/<session-id>/workflows/wf_<id>.json` + `workflows/scripts/*.js` | 60 / 34 | Workflow definitions |
| `<slug>/memory/*.md` | 83 | Project auto-memory (not a transcript) |

Only **160 parent transcripts** exist here; the other ~2,570 JSONL files are subagent
or workflow transcripts. A reader that globs `<slug>/*.jsonl` sees only parents.

**Sample:** 336 files — all 159 readable parent transcripts, 171 subagent transcripts
(stratified <=5 per client `version`, plus the 60 most recent and the 15 largest, plus
every file matching a rare-feature marker), and 6 workflow journals. 220,566 records.
Date range 2026-07-27 -> 2026-09-18. Client versions in sample: 2.1.220 … 2.1.276
(36 distinct; largest buckets 2.1.263 x43, 2.1.251 x30, 2.1.273 x23, 2.1.261 x18,
2.1.258 x16, 2.1.235 x16, 2.1.237/2.1.247 x15; `(none)` x7 = workflow journals).
Every record class observed spans essentially the whole version range — **no
version-gated record shape was found** (exceptions noted per row in section 1).

### 0a. Parser hazard: records are NOT always one per physical line — **NOT REPRODUCED**

> **Reviewer note (root, 2026-09-18): cause confirmed — this is a reader artifact, not
> a transcript property.** Splitting strictly on the LF byte yields **0 malformed
> lines** across 300 recent files (256,296 lines), and an earlier re-check found 0
> across 153 parent, 718 subagent, and 1,861 workflow files. Node's `readline` (and any
> splitter that treats U+2028/U+2029 as line terminators) reports ~290 "malformed"
> lines on the same files, because those code points occur unescaped inside JSON
> string values. Records ARE one per LF-terminated line. The durable lesson is for
> readers: split on `\n` bytes only, never with `readline`, and keep a fixture whose
> string values contain U+2028, U+2029, and `\r`.

---

## 1. Record taxonomy

Discriminator = top-level `type`, plus `subtype` for `system`, plus `message.role`.

| `type` (`subtype`) | Records | Files | Versions | Notes |
| --- | --- | --- | --- | --- |
| `attachment` | 87,914 | 320 | .220–.276 | Largest class by far; 44 `attachment.type` variants (section 6) |
| `assistant` (`message.role=assistant`) | 50,178 | 321 | .220–.276 | One record **per content block**, not per API response (section 6) |
| `user` (`message.role=user`) | 28,413 | 326 | .220–.276 | Carries `tool_result` blocks and `toolUseResult` |
| `last-prompt` | 7,798 | 157 | .220–.276 | `{type, sessionId, leafUuid, lastPrompt?}` — resume pointer |
| `atis-latch` | 7,241 | 150 | .220–.276 | Host/UI state latch |
| `mode` | 6,346 | 57 | .220–.276 | |
| `permission-mode` | 6,008 | 56 | .220–.276 | |
| `ai-title` | 5,844 | 63 | .220–.276 | Generated session title |
| `queue-operation` | 5,566 | 137 | .220–.276 | `operation` in `enqueue` 2790 / `dequeue` 1495 / `remove` 1286 / `popAll` 1; keys `{type, operation, timestamp, sessionId, content?, reason?}` |
| `bridge-session` | 4,820 | 51 | .220–.270 | Not seen >= .272 in sample |
| `pr-link` | 3,446 | 21 | .220–.273 | |
| `system` `stop_hook_summary` | 2,269 | 66 | .220–.276 | `level: "suggestion"`, no `content` |
| `system` `turn_duration` | 2,121 | 47 | .220–.276 | no `level`, no `content` |
| `file-history-snapshot` | 1,100 | 54 | .220–.276 | `snapshot.trackedFileBackups` keyed **by absolute file path** (private keys) |
| `system` `away_summary` | 355 | 42 | .220–.275 | `content: string` |
| `custom-title` / `agent-name` | 206 / 206 | 4 / 4 | .220–.270 | |
| `file-history-delta` | 199 | 26 | .220–.276 | |
| `frame-link` | 76 | 1 | .247 | Single-session; host-specific |
| `system` `informational` | 43 | 19 | .220–.261 | `level` in `warning` 38 / `notice` 5 |
| `system` `local_command` | 40 | 13 | .220–.266 | `level: "info"`, `content: string` |
| `started` / `result` | 39 / 39 | 6 / 6 | (journal) | Workflow `journal.jsonl` only; `{type, agentId, key, …}`; **no `sessionId`, no `version`, no `timestamp`** |
| `cost-state` | 32 | 21 | .233–.270 | |
| `system` `compact_boundary` | 20 | 9 | .220–.273 | `level: "info"`, `compactMetadata` (section 6) |
| `artifact-autoreact-ledger` / `artifact-comment-monitor` | 15 / 4 | 1 / 1 | .247 | Host-specific |
| `system` `scheduled_task_fire` | 4 | 2 | .261–.272 | |
| `system` `agents_killed` | 2 | 2 | .251–.258 | no `content` |
| `system` `bridge_status` | 1 | 1 | .259 | |

Several classes (`atis-latch`, `bridge-session`, `pr-link`, `frame-link`, `ai-title`,
`custom-title`, `agent-name`, `artifact-*`, `cost-state`) look host/wrapper-injected
rather than vanilla Claude Code and should be treated as *ignorable unknowns*, not as a
closed set. **Design implication: the reader must tolerate unknown top-level `type`
values.**

Universal envelope on `user`/`assistant`/`attachment` records: `uuid`, `parentUuid`
(`null` at roots — 348 in sample), `sessionId`, `timestamp`, `version`, `cwd`,
`gitBranch`, `isSidechain`, `userType` (only value observed: `external`),
`entrypoint` in `cli` 141,596 / `sdk-cli` 19,447 / `sdk-ts` 10,620.
`uuid` was unique within every file (0 duplicates in 220k records).

---

## 2. Tool calls, tool results, and the `toolUseResult` carrier

### Pairing

| Metric | Value |
| --- | --- |
| `tool_use` blocks | 25,149 (all ids `toolu_*`) |
| paired with >=1 `tool_result` in same file | 25,146 |
| `tool_use` with **no** `tool_result` in the same file | **3** |
| `tool_result` with no matching `tool_use` in the same file | **0** |
| `tool_use` receiving **more than one** `tool_result` | **0** |

So within a single file, `tool_use_id` -> `tool_result` is effectively a total 1:1
function. Correlation is safe on `tool_use_id` alone; no cross-file joins are needed for
tool pairing (subagent tool calls live entirely inside the subagent file).

Additional correlation aids on `user` records: `sourceToolAssistantUUID` (25,106 —
points at the `uuid` of the assistant record that emitted the call) and
`sourceToolUseID` (135).

### `tool_result` content shape (`user.message.content[type=tool_result]`)

| `content` shape | Count |
| --- | --- |
| `string` | 23,871 |
| `array` of `text` blocks | 773 |
| `array` of `image` blocks | 420 |
| `array` of `tool_reference` blocks | 82 |

`tool_reference` blocks carry a `tool_name` field — a second, block-level place where a
tool name appears.

### The sibling `toolUseResult` carrier

Present on 22,551 `user` records. Type is usually `object`, but also `string` (~480
cases: Bash 395, Agent 34, Read 13, Write 8, Edit 6, several MCP tools, `Skill`,
`Monitor`, `AskUserQuestion`, `StructuredOutput`, `TaskStop`), `array` (some MCP
tools), and JSON-encoded `string` — **a reader must type-check it, not assume object.**

Observed key sets per tool (top; full list in `inventory.json`):

| Tool | `toolUseResult` keys |
| --- | --- |
| `Bash` | `stdout`, `stderr`, `interrupted`, `isImage`, `noOutputExpected` (+ optional `bashEditDiff`, `gitOperation`, `backgroundTaskId`, `backgroundCwdHint`, `persistedOutputPath`, `persistedOutputSize`, `returnCodeInterpretation` (string), `staleReadFileStateHint`, `timedOutAfterMs`, `dangerouslyDisableSandbox`) |
| `Read` | `type` in `text` 811 / `image` 114 / `parts` 16 / `file_unchanged` 1; `file` (object) |
| `Edit` | `filePath`, `oldString`, `newString`, `replaceAll`, `originalFile`, `structuredPatch`, `userModified` (+ `staleRecovered`, `memdirStamped`) |
| `Write` | `type` in `create` 231 / `update` 54; `filePath`, `content`, `originalFile`, `structuredPatch`, `userModified` |
| `Agent` | `agentId`, `status`, `description`, `prompt`, `resolvedModel`, `isAsync`, `outputFile`, `canReadOutputFile` (553x); **rare synchronous variant** adds `agentType`, `content`, `usage`, `toolStats`, `totalTokens`, `totalToolUseCount`, `totalDurationMs`, `harnessNoteCount`, `harnessSectionHash`, `harnessTailCount` (1x) |
| `WebFetch` | `url`, `code`, `codeText`, `bytes`, `durationMs`, `result` |
| `WebSearch` | `query`, `results`, `searchCount`, `durationSeconds` |
| `Skill` | `commandName`, `success`, `allowedTools?` |
| `Workflow` | `workflowName`, `runId`, `taskId`, `taskType`, `scriptPath`, `status`, `summary`, `transcriptDir` |
| `Monitor` | `taskId`, `timeoutMs`, `persistent` |
| `SendMessage` | `message`, `success`, `pin?`, `msg_id?`, `resumedAgentId?`, `display?` |
| `AskUserQuestion` | `questions`, `answers` (**keyed by full question text**), `annotations?` |
| `ToolSearch` | `query`, `matches`, `total_deferred_tools` |
| `TaskOutput` | `task`, `retrieval_status` |
| `Artifact` | `artifact_id`, `url`, `version`, `title`, `path`, `updated`, `liveSubscription` |

### Structured exit status

**There is no exit code anywhere.** `Bash` records only `stdout`/`stderr`/`interrupted`;
`returnCodeInterpretation` is a free-text `string` (148x), not a number. The only
machine-readable outcome bit is `is_error` on the `tool_result` block (section 3).

### MCP

MCP tool calls use the flat `mcp__<server>__<tool>` name in `tool_use.name`; there is
**no separate server/namespace field** on the tool_use block. Servers observed in sample
(39 calls total) across six servers; server names redacted.
A separate `mcpMeta` object appears on 12 `user` records (`structuredContent`, `_meta`)
— the MCP structured-content channel. MCP tool *definitions* also show up inside
`attachment` records (`attachment.tools[].name`, `attachment.entries[].name`).

Tool-call volume in sample: `Bash` 20,603, `Read` 1,431, `Edit` 1,002, `Agent` 593,
`Write` 337, `WebFetch` 286, `SendMessage` 188, `Skill` 138, `WebSearch` 136,
`AskUserQuestion` 132, `ToolSearch` 84, `Workflow` 60, `Monitor` 47, `StructuredOutput` 32,
`TaskStop` 12, `ListAgents` 9, `ScheduleWakeup` 5, `Artifact` 3, `SendFeedback` 3,
`TaskOutput` 3, `SendUserFile` 2, 39 MCP calls.

---

## 3. Success / failure evidence

| Signal | Presence |
| --- | --- |
| `tool_result.is_error` **present and `false`** | 20,269 (Bash 20,206, Workflow 60, SendFeedback 3) |
| `tool_result.is_error` **present and `true`** | 496 |
| `tool_result.is_error` **absent** | ~4,380 (Read, Edit, Write, Agent, WebFetch, WebSearch, Skill, MCP, …) |

**`is_error` is emitted as an explicit boolean essentially only by `Bash`.** Every other
tool omits it on success and sets `true` on failure. The correct rule is
`is_error === true` is recorded failure evidence. Reviewer correction (root): the worker
concluded that an absent flag means success; that is an inference from this sample, not
recorded evidence. An absent `is_error` records nothing and the outcome is `unknown`
unless another recorded field establishes it.
Failure counts in sample: Bash 395, Agent 34, Read 13, Write 8, Edit 6, Skill 4,
AskUserQuestion 4, Monitor 2, and 3 MCP calls (servers not named).

Other outcome fields:

- `toolDenialKind` — top-level on `user` records, **48 occurrences, sole value
  `"user-rejected"`.** This is the only *structured* permission-denial signal. It is a
  sibling of `message`, not inside the tool_result.
- `interruptedMessageId` — top-level on `user` records, 71 occurrences: the assistant
  message whose turn the user interrupted.
- `toolUseResult.interrupted` — Bash only; `false` in all 18,597 observations in the
  sample. Corpus-wide, `"interrupted":true` appears in **1 of 2,732 files**.
- `isAbortedMidStream` (3), `truncatedAfterOutput` (4), `isApiErrorMessage` (38),
  `apiErrorStatus` (5, number), `error` (26, string) — all on `assistant` records.
- Hook outcomes surface as `attachment.type` values: `hook_success` 56,349,
  `hook_non_blocking_error` 45, **`hook_blocking_error` 1**. There is no per-tool-call
  hook-block field; the block is a separate attachment record that must be correlated by
  position/`parentUuid`.

**Must be reported `unknown`:** process exit codes; whether a Bash failure was a
non-zero exit vs a timeout vs a sandbox denial (only free text distinguishes them);
whether a non-Bash tool "succeeded" in a semantic sense; and whether a denial was a
permission prompt vs a hook block, except for the 48 `toolDenialKind` cases. Free-text
matching on denial phrasing is unreliable — the strings "rejected"/"permission" occur in
hundreds of ordinary tool outputs with `is_error: false`.

---

## 4. Identity and lineage

| Field | Where | Observation |
| --- | --- | --- |
| `sessionId` | all message records | Exactly **one distinct value per file**, in 336/336 files. For parent files it **always equals the filename stem** (159/159). Resume/fork does **not** append to an existing file. |
| `forkedFrom` | `assistant` 735 / `user` 419 (1,485 records) | `{ sessionId, messageUuid }` — **this is the resume/fork link**, pointing at the ancestor session and the exact message forked from. Cross-file lineage must be built from this, not from multiple `sessionId`s in one file. |
| `uuid` / `parentUuid` | all message records | DAG within a file; `parentUuid: null` at roots (348). No duplicate `uuid` in any file. |
| `leafUuid` | `last-prompt` records only (7,798) | Resume pointer to the conversation leaf. |
| `isSidechain` | all message records | **`true` in 0 parent-file records**; `false` 121,406 / absent 48,928 in parents; `true` in 50,154/50,154 subagent-file records. |
| `agentId` | subagent files only | Present on 100% of subagent records, **absent from 100% of parent records** (170,334). Format: `a` + 16 hex chars, uniform. |
| `cwd`, `gitBranch`, `version` | all message records | 171,560 / 171,560 / 100%. |
| `requestId` | `assistant` 50,145 | API request id. |
| `slug` | `assistant` 18,872 / `user` 10,784 | |
| `promptId` (28,352), `promptSource` (`typed` 1858 / `system` 2220 / `queued` 244 / `sdk` 538), `permissionMode` (2,428), `origin.kind` (`human` 1109 / `task-notification` 1130 / `coordinator` 21 / `peer` 2) | `user` | Distinguishes human input from injected/auto prompts — directly useful for an activity view. |

### Subagent storage — the decisive finding

For **every client version observed (2.1.220 – 2.1.276)**, subagent transcripts live in
**separate files**, never inline in the parent:

```
<slug>/<session-id>/subagents/agent-<agent-id>.jsonl            (+ .meta.json)
<slug>/<session-id>/subagents/workflows/wf_<id>/agent-<id>.jsonl (+ .meta.json)
```

`agent-<agent-id>.meta.json` is a flat object (key presence censused over all 2,518 meta
files; typing sampled over 400):

| Key | Type | Notes |
| --- | --- | --- |
| `agentType` | string | subagent type name — always present |
| `spawnDepth` | number | always present; enables nesting depth |
| `model` | string | resolved model |
| `description` | string | short task description (may be absent) |
| `toolUseId` | string | **`toolu_*` id of the parent's `Agent` tool_use** — the join key |
| `parentAgentId` | string | present for nested subagents (agent-spawns-agent) |
| `isFork`, `requestNonInteractive`, `requestShape`, `spawnedWithWorktree`, `worktreeBranch`, `worktreePath`, `stoppedByUser` | mixed | optional |

**What the parent records about the child.** The parent's `Agent` tool_use `input` has
`description` (593), `prompt` (593), `subagent_type` (572), `model` (532),
`run_in_background` (121), `isolation` (7). The paired `toolUseResult` has `agentId`,
`status`, `resolvedModel`, `isAsync`, `outputFile`, `canReadOutputFile`.

**But `status` is `async_launched` in 553 of 554 cases** (`completed` once). The parent's
tool_result therefore contains **the launch, not the outcome** — no result text, no
usage, no tool counts. `outputFile` points at `…/tasks/<agent-id>.output` outside
`~/.claude/projects`. The subagent's actual work is only in its own JSONL file.

**So: a parent-only read can name subagent activity but cannot see it.** It gets the
subagent type, description, model and `agentId` per spawn; it gets nothing about what the
subagent did, how long it took, whether it succeeded, or what it returned. 503 of 554
`agentId`s in the sample resolve to an existing
`<session-dir>/subagents/agent-<id>.jsonl`; 51 do not (older/pruned sessions) — so an
activity view must tolerate dangling agent ids.

Subagent results reach the parent later as separate records —
`user` records with top-level `origin.kind = "task-notification"` (1,130; carrier corrected by root re-check — `attachment.origin.kind` carries only `human`/`peer`) and `SendMessage` tool results —
not as the `Agent` tool_result.

---

## 5. Sidecars and large outputs

### Persisted output

254 `toolUseResult` objects carry `persistedOutputPath` + `persistedOutputSize`
(all on `Bash`). Every observed path has the shape
`<slug>/<session-id>/tool-results/<9-char-id>.txt`; **251 of 254 target files still
exist** on disk (3 missing). Corpus-wide, the literal token `persisted-output` appears in
444 of 2,732 files.

In-transcript marker: the `tool_result` text contains a bare `<persisted-output>` tag
(270 occurrences in the sample; no attributes were observed on the tag). The path itself
is **not** in the tool_result text — it is only in the sibling
`toolUseResult.persistedOutputPath`. An activity view that reads only
`message.content[type=tool_result]` will see the marker and have no way to resolve it.

Other sidecars: `tool-results/pdf-<uuid>/*.jpg` (46 rendered PDF pages),
`tool-results/*.pdf` (1), `<session-id>/workflows/wf_<id>.json` + `workflows/scripts/*.js`.

### Tool result payload sizes (characters, per `tool_result` block)

Overall (n=25,146): p50 889, p90 7,879, p99 162,338, **max 681,794**.

| Tool | n | p50 | p90 | p99 | max |
| --- | --- | --- | --- | --- | --- |
| `Read` | 1,431 | 20,706 | 201,762 | 416,559 | **681,794** |
| `Bash` | 20,601 | 884 | 6,080 | 20,942 | 29,937 |
| `WebFetch` | 285 | 1,047 | 2,557 | 45,038 | 45,038 |
| `mcp__<server>__<tool>` (one MCP read tool) | 5 | 9,280 | 24,660 | — | 24,660 |
| `WebSearch` | 136 | 2,494 | 3,043 | 3,874 | 6,017 |
| `Agent` | 593 | 1,084 | 1,099 | 1,119 | 3,248 |
| `Edit` | 1,002 | 210 | 254 | 356 | 490 |

Bash output is effectively capped near 30 KB (overflow goes to `tool-results/`); `Read`
is not capped and dominates memory cost. The word `truncated` appears in 189 tool_result
payloads, but **no structured truncation field was found** — none of
`<truncated`, `[truncated`, `... (truncated`, `Tool output truncated` matched.
Structured truncation signals that do exist are
`attachment.type = "read_truncation_notice"` (31) and the assistant-level
`truncatedAfterOutput` (4).

---

## 6. Session metadata

- **Models.** `message.model` values: `claude-opus-5` 28,522, `claude-fable-5-1` 11,359,
  `claude-fable-5` 7,544, `claude-sonnet-5` 2,798, `<synthetic>` 38 (error/placeholder
  records). **Model changes mid-session are real:** of 159 parent files, 133 use 1 model,
  12 use 2, 5 use 3, 9 have none. All 171 subagent files use exactly 1.
  `effort` is a top-level assistant field: `high` 35,819, `medium` 7,564, `xhigh` 6,834,
  `low` 8 (plus `perTurnEffort`, 5,821, nullable).

- **Streaming duplication — a real double-counting hazard.** Assistant records are
  written **one per content block**, carrying `apiBlockIndex` (25,303) and repeating the
  same `message.id`. Of 23,715 `(file, message.id)` groups, **17,027 have >1 record** and
  only 6,688 are singletons. `message.usage` is present on all 50,261 assistant records,
  so summing usage naively over-counts by roughly 2x. **Deduplicate on
  `(sessionId, message.id)` before aggregating usage.**

- **`message.usage` fields** (n=50,261): `input_tokens`, `output_tokens`,
  `cache_creation_input_tokens`, `cache_read_input_tokens` (all number, 100%);
  `cache_creation` (object, 100%); `service_tier` (string, 50,223 / null 38);
  `inference_geo` (string, same split); `output_tokens_details` (object 36,837 / null 33);
  `server_tool_use` (object 39,791); `iterations` (array 39,753 / null 38);
  `speed` (string 39,753 / null 38). Also `message.diagnostics` (object-or-null, 50,173)
  with `cache_miss_reason.{type, cache_missed_input_tokens}` (620).

- **`stop_reason`**: `tool_use` 36,164, `null` 10,470, `end_turn` 3,589,
  `stop_sequence` 38. No `max_tokens` observed.

- **Thinking blocks.** 16,748 `thinking` blocks. **Only 830 (5.0%) carry non-empty
  `thinking` text; 15,918 (95.0%) are signature-only.** 0 `redacted_thinking` blocks.
  An activity view must not assume reasoning text is available.
  `attachment.type = "thinking_stripped"` (6) marks where it was removed.

- **Compaction.** `isCompactSummary: true` on 20 `user` records (corpus-wide: 9 of 2,732
  files), paired with `system` / `subtype: compact_boundary` (20) whose `compactMetadata`
  keys are `trigger`, `preTokens`, `postTokens`, `durationMs`, `preservedMessages`,
  `preservedSegment`, `preCompactDiscoveredTools`, `cumulativeDroppedTokens`. Compacted
  records also carry `isVisibleInTranscriptOnly: true` (20). A `compact_file_reference`
  attachment (41) points at externalised pre-compaction content.
  **No `type: "summary"` record exists anywhere in the 2,732-file corpus.**

- **`system` records** always have `subtype`; `level` (`info` / `warning` / `notice` /
  `suggestion`) only on some subtypes; `content` is always `string` when present and is
  absent entirely on `stop_hook_summary`, `turn_duration` and `agents_killed`.

- **`attachment.type` (44 values, 87,914 records)** — the richest metadata channel.
  Top: `hook_success` 56,349, `total_tokens_reminder` 17,211, `batching_reminder_sent`
  5,232, `bash_output_audience_note` 3,372, `environment` 696, `queued_command` 738,
  `deferred_tools_delta` 446, `silent_turn_reminder` 427, `skill_listing` 422,
  `mcp_instructions_delta` 261, `edited_text_file` 254, `date` 246, `agent_listing_delta`
  245, `session_context` 233, `prompt_snapshot` 204, `nested_memory` 201, `output_style`
  186, `instructions` 185, `auto_mode` 183, `task_reminder` 160, `model` 150,
  `remote_session_change` 100, `deferred_tools_record` 52, `hook_non_blocking_error` 45,
  `compact_file_reference` 41, `file` 33, `read_truncation_notice` 31, `date_change` 25,
  `ultra_effort_enter` 19, `invoked_skills` 11, `structured_output` 7, `plan_mode` 7,
  `task_status` 7, `thinking_stripped` 6, `ultra_effort_exit` 3, `sandbox_instructions` 3,
  `output_style_instructions` 2, `workflow_keyword_request` 1, `hook_blocking_error` 1.

- **Attribution fields on `assistant` records** (useful for an activity view, absent from
  the research packet): `attributionAgent` 16,101, `attributionSkill` 9,800,
  `attributionMcpServer` / `attributionMcpTool` 82, `attributionPlugin` 22,
  `advisorModel` 373.

- **Slash commands** appear as `user.message.content` **strings** containing
  `<command-name>` (130 files) / `<local-command-stdout>` (70), and as
  `system` / `local_command` records (40) — there is no structured slash-command record type.

---

## 7. Deltas vs the research packet

Checked `…/reference/research/session-fidelity-2026-09-10/schemas/native/claude-code-record.schema.json`.
(`10-schema-guide-and-coverage.md` contains no occurrence of "claude", so it makes no
Claude-specific claim to contradict.)

**Claimed but not observed here (2,732 files, 2.1.220–2.1.276):**
- `sessionID` and `session_id` — only `sessionId` exists.
- `summary` property / `type: "summary"` records — **zero** corpus-wide.
- `model` as a *top-level* record property — model lives at `message.model`;
  top-level `attachment.model` exists on `attachment.type: "model"` records only.

**Confirmed:** `toolUseResult.answers` keyed by full question text (a genuine PII hazard
the packet correctly flags), `toolUseResult.annotations`, `toolUseResult.agentId`,
`operation` / `content` on `queue-operation`, `attachment.type: "queued_command"`,
`isCompactSummary`, `leafUuid`, `isMeta`, `permissionMode`, `slug`, `entrypoint`,
`userType`, `cwd`, `gitBranch`.

**Missing from the packet's schema but load-bearing for an activity view:**
`isSidechain`, `agentId`, `subtype` (all `system` records), `forkedFrom`,
`toolDenialKind`, `interruptedMessageId`, `sourceToolAssistantUUID`, `sourceToolUseID`,
`requestId`, `apiBlockIndex`, `effort` / `perTurnEffort`, `attribution*`, `promptSource`,
`promptId`, `origin`, `mcpMeta`, `message.diagnostics`, `isApiErrorMessage` / `apiErrorStatus`,
`isAbortedMidStream`, `truncatedAfterOutput`, `queuePriority`, `scheduledTaskId`.

**Three findings the packet does not cover at all, each of which changes the design:**
1. Subagent transcripts are **separate files** under `<session-id>/subagents/`, with a
   `.meta.json` whose `toolUseId` is the join key to the parent's `Agent` call. The packet
   describes only a `toolUseResult.agentId` "sidecar extraction path".
2. `Agent` tool results are `status: async_launched` 553/554 — the parent never records
   the subagent's outcome.
3. ~~Records can span multiple physical lines.~~ Withdrawn: reader artifact (see the reviewer note in section 0a). Records are one per LF-terminated line.

---

## Not observed

Each of the following was searched for and **not observed in the stated corpus**; this is
an absence of evidence on this machine, not a statement that the field cannot exist.

- `type: "summary"` / a `summary` top-level property — not observed in 2,732 files.
- `type: "progress"` — not observed in 2,732 files.
- Any `isSidechain: true` record inside a parent `<session-id>.jsonl` — not observed in
  159 parent files / 170,334 parent records.
- Any `agentId` on a parent-file record — not observed in 170,334 parent records.
- A file containing more than one `sessionId` — not observed in 336 files.
- Duplicate `uuid` within a file — not observed in 220,566 records.
- A `tool_use` receiving two `tool_result`s — not observed in 25,149 tool uses.
- A `tool_result` with no `tool_use` in the same file — not observed.
- Any numeric exit code / `exitCode` / `returnCode` field — not observed in 22,551
  `toolUseResult` carriers.
- `redacted_thinking` blocks — not observed in 16,748 thinking blocks.
- `stop_reason: "max_tokens"` — not observed in 50,261 assistant records.
- A structured truncation field or a `<truncated>`-style marker token — not observed in
  25,146 tool_result payloads.
- `toolDenialKind` values other than `user-rejected` — not observed in 48 occurrences.
- A server/namespace field on MCP `tool_use` blocks — not observed in 39 MCP calls.
- `toolUseResult.interrupted: true` — not observed in 18,597 Bash results in the sample;
  observed in 1 of 2,732 files corpus-wide.
- Version-gated record *shapes* — every record class spans 2.1.220–2.1.276; only
  low-frequency host-specific classes (`bridge-session`, `frame-link`, `artifact-*`,
  `custom-title`) have narrower observed ranges, which sampling alone explains.

---

## Fixture-capture checklist

Each row: the shape worth a sanitized fixture, its discriminator, and a predicate that
selects an exemplar record (usable as `jq -c 'select(<predicate>)' <file>`). All fixtures
must be sanitized before being committed; rows 32 and 33 hold private keys by design.

| # | Shape | Discriminator | Predicate |
| --- | --- | --- | --- |
| 1 | Assistant turn split across blocks (usage duplication) | `apiBlockIndex` | `.type=="assistant" and .apiBlockIndex>0` |
| 2 | Bash success with structured carrier | Bash | `(.toolUseResult\|type)=="object" and (.toolUseResult\|has("stdout"))` |
| 3 | Bash failure | `is_error` | `.type=="user" and ([.message.content[]?\|select(.type=="tool_result" and .is_error==true)]\|length>0)` |
| 4 | Bash with persisted output | persisted | `.toolUseResult.persistedOutputPath? != null` |
| 5 | Bash background task | bg | `.toolUseResult.backgroundTaskId? != null` |
| 6 | Bash git-operation enrichment | gitOperation | `.toolUseResult.gitOperation? != null` |
| 7 | `toolUseResult` as a bare string | type mismatch | `(.toolUseResult\|type)=="string"` |
| 8 | `toolUseResult` as an array | type mismatch | `(.toolUseResult\|type)=="array"` |
| 9 | Edit with structuredPatch | Edit | `.toolUseResult.structuredPatch? != null` |
| 10 | Read image / parts variants | Read | `[.toolUseResult.type?]-["image","parts","file_unchanged"] \| length==0` |
| 11 | Agent async launch (the common case) | Agent | `.toolUseResult.status?=="async_launched"` |
| 12 | Agent synchronous result with usage/toolStats | Agent (rare) | `.toolUseResult.toolStats? != null` |
| 13 | Parent `Agent` tool_use with subagent_type | Agent call | `.type=="assistant" and ([.message.content[]?\|select(.type=="tool_use" and .name=="Agent")]\|length>0)` |
| 14 | Subagent record (separate file) | sidechain | `.isSidechain==true and (.agentId\|type)=="string"` |
| 15 | Nested subagent | meta.json | `.parentAgentId != null` (on `agent-*.meta.json`) |
| 16 | Subagent spawn metadata join key | meta.json | `.toolUseId != null and .agentType != null` (on `agent-*.meta.json`) |
| 17 | Session fork / resume link | `forkedFrom` | `.forkedFrom? != null` |
| 18 | Resume leaf pointer | `last-prompt` | `.type=="last-prompt"` |
| 19 | User tool denial | `toolDenialKind` | `.toolDenialKind? != null` |
| 20 | Interrupted turn | `interruptedMessageId` | `.interruptedMessageId? != null` |
| 21 | Aborted mid-stream assistant | assistant | `.isAbortedMidStream==true or .truncatedAfterOutput==true` |
| 22 | API error record | assistant | `.isApiErrorMessage==true` |
| 23 | Compaction pair | compact | `.isCompactSummary==true` ; `.type=="system" and .subtype=="compact_boundary"` |
| 24 | Hook blocking error | attachment | `.type=="attachment" and .attachment.type=="hook_blocking_error"` |
| 25 | Read truncation notice | attachment | `.type=="attachment" and .attachment.type=="read_truncation_notice"` |
| 26 | MCP call + structured content | MCP | `([.message.content[]?\|select(.type=="tool_use" and (.name\|startswith("mcp__")))]\|length>0)` ; `.mcpMeta? != null` |
| 27 | Multi-block tool_result (text / image / tool_reference) | tool_result | `([.message.content[]?\|select(.type=="tool_result" and (.content\|type)=="array")]\|length>0)` |
| 28 | Signature-only thinking block | thinking | `([.message.content[]?\|select(.type=="thinking" and (.thinking\|length)==0)]\|length>0)` |
| 29 | Thinking with text | thinking | `([.message.content[]?\|select(.type=="thinking" and (.thinking\|length)>0)]\|length>0)` |
| 30 | Slash-command turn | user string | `.type=="user" and (.message.content\|type)=="string"` (text contains `<command-name>`) |
| 31 | Queue operation lifecycle | queue | `.type=="queue-operation" and .operation=="dequeue"` |
| 32 | File-history snapshot (dynamic path keys — sanitize) | snapshot | `.type=="file-history-snapshot"` |
| 33 | AskUserQuestion answers (question-text keys — sanitize) | AskUser | `.toolUseResult.answers? != null` |
| 34 | Workflow subagent + journal | workflow | `.toolUseResult.workflowName? != null` ; journal: `.type=="started" or .type=="result"` |
| 36 | Task-notification delivery of subagent result | user | `.type=="user" and .origin.kind=="task-notification"` |
| 37 | Mid-session model change | model | two distinct `.message.model` values within one `sessionId` |

## Verification addendum (independent reviewer, 2026-09-18)

Structure-only re-checks made while verifying the docs pages against this report:

- `.meta.json` `toolUseId` is present on 723 of 723 plain `subagents/*.meta.json` files
  and on 0 of 1,801 workflow-spawned meta files (2,524 meta files in total). The
  `tool_use.id` → `meta.toolUseId` join therefore covers directly spawned subagents
  only; workflow-spawned children join to their parent by directory containment.
- Subagent results: top-level `user.origin.kind == "task-notification"` 753 in the 300
  newest files; `attachment.origin.kind` carried `human` / `coordinator` / `peer` and
  zero `task-notification`.
- `is_error` present-and-false is emitted by `Bash`, `Workflow`, and `SendFeedback` only;
  absent is dominated by `Edit` / `Read` / `Agent` / `Write`.
- `toolUseResult.persistedOutputPath` always appears with `persistedOutputSize`
  (267 of 267).
