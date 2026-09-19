# Cursor agent-transcript schema — observed evidence (2026-09-18)

Structure-only evidence from local transcripts. No message text, commands, paths, or
tool payloads are reproduced. "Not observed" never means "does not exist".

Produced by a bounded recon worker; headline claims marked **[verified]** were
independently re-checked by the root reviewer with corpus-wide greps / key-set counts.

## Sample

- Surface: `~/.cursor/projects/<encoded-project>/agent-transcripts/<id>/<id>.jsonl`
  (1,269 top-level files) plus `<id>/subagents/<child>.jsonl` (26 files).
- Sample: 350 of 1,295 files, 35,187 frames, ~43 MB; 0 malformed/blank/unreadable.
  Negative greps ran over all 1,295 files.
- Stratification: by file mtime only (May 4 / Jun 17 / Jul 83 / Aug 103 / Sep 143).
  **No client version, model, or timestamp field exists in-transcript**, so version
  is `unknown` for every shape below.
- No shape drift observed May → Sep 2026.

## 1. Frame taxonomy (closed and small)

| Top-level key set         | Count  | Notes                                             |
| ------------------------- | ------ | ------------------------------------------------- |
| `{message, role}`         | 34,847 | `role`: assistant 26,917 / user 7,930             |
| `{status, type}`          | 331    | `type: turn_ended`, `status: success`             |
| `{error, status, type}`   | 9      | `status: error` (7) / `aborted` (2); `error` string present iff status ≠ success |

Content blocks (`message.content[]`, always an array in the sample):

| Block      | Key set               | Count  |
| ---------- | --------------------- | ------ |
| `tool_use` | `{type, name, input}` | 44,041 |
| `text`     | `{type, text}`        | 19,794 |

## 2. Tool activity

- **Tool results are never recorded [verified]:** 0 of 1,295 files contain
  `tool_result`, `tool_use_id`, or `is_error`. 0 of 44,041 calls have a result.
  Activity coverage for Cursor results is `not-recorded` by construction, not
  "frequently absent".
- **`tool_use` blocks carry no `id` [verified]** (key set is exactly
  `{input, name, type}`; 9,483/9,483 in a fresh 60-file re-check). There is no
  native call id. The only stable identity is positional: (file, frame index,
  block index).
- 25 native tool names observed (see `inventory.json` values at
  `$.message.content[type=tool_use].name`). Most frequent: `Shell`, `ReadFile`,
  `rg`, `ApplyPatch`, `Read`.
- MCP calls are wrapped, not namespaced: `CallMcpTool` / `CallDynamicTool` with
  `input.server`, `input.namespace`, `input.toolName`, `input.arguments`.
- `input` is an object for every tool except `ApplyPatch`, where it is a raw
  string (4,444/4,444).
- Parallel calls in one frame are routine (up to 39 `tool_use` blocks), all id-less.
- No per-call status, exit code, or duration anywhere.

## 3. Off-transcript tool output (sidecar surface)

- `~/.cursor/projects/<proj>/agent-tools/<uuid>.txt`: 340 files **[verified count]**,
  min ~15.6 KB / p50 ~59 KB / max ~1.4 MB.
- Referenced from transcripts only as a later call's `input.path` (63) or inside
  `input.command` (2) of read-type tools — never written by `Write`/`ApplyPatch`.
  Inference (not vendor-confirmed): the harness spills large tool outputs to disk
  above roughly 15 KB and the agent reads them back.
- These files are **not attributable to a specific call** from recorded evidence.
  For the v1 activity view they are an unread external surface (`not-read` when a
  read-back reference is recorded); they are also a privacy-relevant store of raw
  tool output.

## 4. Grow-in-place

- 25,494 consecutive assistant frame pairs: 99.1% unrelated, 0.8% exact duplicate,
  3 prefix-extensions, 11 reverse-prefixes (compared by block count/length only).
- Settled files show each message once: revision happens in place and leaves no
  residue, no message ids, and no partial/streaming markers. Revision behaviour
  cannot be characterised from static files; it needs live-capture or the existing
  synthetic fixtures.

## 5. Lifecycle and outcome

- `turn_ended` is the final line in 339/340 files that contain one.
  `status`: success 331 / error 7 / aborted 2. `cancelled` not observed in 350 files.
- 11 sampled files contain no `turn_ended` — the only unterminated-turn signal.
- Turn-level status is the only outcome evidence; per-call outcome is always `unknown`.

## 6. Identity, lineage, metadata

- No in-file identity: identity is the path; directory id == file id in 1,269/1,269.
- No timestamps of any kind (no durations, no cross-runtime time axis), no usage or
  token fields, no model field. `model` appears only as an *argument* to
  `Subagent`/`Task` calls.
- Subagents: `<session>/subagents/<child>.jsonl`, identical schema. The child id
  appears inside the parent transcript in only 9 of 24 parent/child pairs — lineage
  is directory containment, not a recorded field.
- Whether one file is one conversation or one turn is undetermined (252/350 files
  have exactly one user frame).

## 7. Payload sizes

- Block payload length: p50 249 / p90 1,058 / p99 5,978 / max 48,304 chars
  (82,171 including user text). No cap or cliff observed.
- `[...]` (16) and `[truncated]` (9) occurrences out of 55,905 payloads look like
  authored prose, not harness truncation markers.

## 8. Contradictions with existing material

- Research packet `schemas/native/cursor-frame.schema.json` documents ten properties
  **none of which were observed**: block `id`, `tool_use_id`, block `content`,
  `is_error`, `thinking`, `message.timestamp`/`createdAt`/`model`/`usage`, top-level
  `timestamp`/`createdAt`/`model`/`usage`, `content` as a bare string, and
  `status: "cancelled"`. It appears derived from `cli-continues` plus
  Anthropic-shaped assumptions.
- `src/shared/transcript/cursor-analysis.ts` defensively handles string `content`,
  `runtime_diagnostic`/`diagnostic`, and `cancelled` — none observed (harmless, but
  not evidence of a real variant). Its `AskQuestion`-as-conversation special case is
  well-founded (144 hits with structured `questions[]`/`options[]`).
- `src/shared/transcript/cursor-frames.ts` is uncontradicted.
- `10-schema-guide-and-coverage.md`: its two Cursor claims are supported.

## 9. Design implications (reviewer notes)

1. Cursor activity is **calls only**: name, input carrier, position. Results
   `not-recorded`; per-call outcome `unknown`; turn outcome from `turn_ended.status`.
2. With no call ids, event keys must be positional, and positional keys inside an
   open (revisable) turn are unstable. This favours delivering Cursor activity only
   for the terminal-settled prefix in v1.
3. `agent-tools/` is a second sidecar class alongside `subagents/`; both are
   `not-read` in v1, and only `subagents/` has (partial) recorded identity.
4. Do not build Cursor extraction to the research packet's schema.

## 10. Fixture-capture checklist (structural predicates; scrub all text/input values)

- user frame · text-only assistant frame · single call · text + tool in one frame
- parallel calls: `[.message.content[] | select(.type=="tool_use")] | length > 3`
- `ApplyPatch` string input: `.message.content[] | select(.type=="tool_use" and (.input|type)=="string")`
- MCP wrapper: `select(.name=="CallMcpTool" or .name=="CallDynamicTool")`
- `AskQuestion` · `Subagent`/`Task` · background shell (`.input.run_in_background==true` or `AwaitShell`)
- sidecar read-back: `.input.path | test("/agent-tools/")`
- `turn_ended` success / error / aborted · a file with no `turn_ended`
- a `subagents/` child file with its parent · a block > 30 KB

## Verification addendum (independent reviewer, 2026-09-18)

Corpus-wide structure-only re-checks (all 1,295 transcripts, 139,312 `tool_use` blocks):
every block has exactly the key set `{input, name, type}` and none has an `id`; zero
`tool_result` / `tool_use_id` / `is_error`; exactly three frame key sets
(`{message, role}` 96,484 · `{status, type}` 1,182, all `success` ·
`{error, status, type}` 89: `error` 68 / `aborted` 21); string `input` occurs only on
`ApplyPatch` (14,255); 29 distinct tool names corpus-wide, so tool names are an open set.
