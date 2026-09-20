---
title: 'Cursor session schema'
description: 'The Cursor agent-transcript JSONL format as observed, for engineers building parsers on these files.'
---

# Cursor session schema

This page records the Cursor agent-transcript format **as observed**, so that a future
parser can be written against evidence rather than against an assumed Anthropic-shaped
schema. It is structural only: no message text, commands, paths, or tool payloads are
reproduced, and every JSON example is a skeleton with `"…"` placeholders. For siblings
see [Codex](codex.md) and [Claude Code](claude-code.md), and the
[session schemas index](index.md).

## Observation basis

One machine, one snapshot date: **2026-09-18**.

| Property                       | Value                                                                    |
| ------------------------------ | ------------------------------------------------------------------------ |
| Surface                        | `~/.cursor/projects/<encoded-project>/agent-transcripts/<id>/<id>.jsonl` |
| Top-level transcript files     | 1,269                                                                    |
| Subagent files                 | 26 (`<id>/subagents/<child>.jsonl`)                                      |
| Corpus                         | 1,295 files                                                              |
| Parsed sample                  | 350 files, 35,187 frames, ~43 MB                                         |
| Malformed / blank / unreadable | 0                                                                        |
| Negative greps                 | ran over all 1,295 files                                                 |

There is **no client version, no model field, and no timestamp anywhere in a
transcript**. Nothing in the file identifies the producing Cursor build. Every shape
below therefore carries a client version of `unknown`, and stratification had to fall
back on filesystem metadata: sampling was stratified by **file mtime only**, into
buckets of May 4 / Jun 17 / Jul 83 / Aug 103 / Sep 143 files. No shape drift was
observed across May → Sep 2026.

"Not observed" here never means "does not exist". It means the property did not appear
in this corpus on this machine at this date; an absence claim is only as strong as the
negative grep behind it. The evidence snapshot lives at
`.oat/repo/reference/research/session-schemas-2026-09-18/cursor/`.

Three headline claims were independently re-checked by a reviewer rather than taken from
the recon worker's own summary:

- **No tool results corpus-wide** — 0 of 1,295 files contain `tool_result`,
  `tool_use_id`, or `is_error`.
- **No call ids corpus-wide** — `tool_use` key sets are exactly `{input, name, type}`;
  a fresh 60-file re-check found 9,483/9,483 blocks with that key set.
- **`agent-tools/` file count** — 340 files.

## File layout and identity

```text
~/.cursor/projects/<encoded-project>/
  agent-transcripts/
    <id>/
      <id>.jsonl            # the transcript
      subagents/
        <child>.jsonl       # same schema, one per child agent
  agent-tools/
    <uuid>.txt              # off-transcript tool output (see below)
```

A transcript carries **no in-file identity field**. Identity is the path: the directory
id equals the file id in 1,269/1,269 top-level cases. A parser must take the session id
from the path and must not expect to confirm it from the contents.

Cursor's SQLite chat store is a separate surface and is **out of scope** for this
repository's tooling, which reads only the JSONL agent transcripts described here.

## Frame taxonomy

Each line is one JSON object. The top-level key sets are closed and small — three of
them across 35,187 sampled frames.

| Top-level key set       | Count  | Notes                                 |
| ----------------------- | ------ | ------------------------------------- |
| `{message, role}`       | 34,847 | `role`: assistant 26,917 / user 7,930 |
| `{status, type}`        | 331    | `type: turn_ended`, `status: success` |
| `{error, status, type}` | 9      | `status`: error 7 / aborted 2         |

The `error` key is present **iff** `status` is not `success`. There is no third
lifecycle shape.

`message.content` is always an array in the sample, and it holds exactly two block
types:

| Block      | Key set               | Count  |
| ---------- | --------------------- | ------ |
| `tool_use` | `{type, name, input}` | 44,041 |
| `text`     | `{type, text}`        | 19,794 |

Skeletons:

```json
{"role": "…", "message": {"content": [{"type": "text", "text": "…"}]}}
{"role": "…", "message": {"content": [{"type": "tool_use", "name": "…", "input": {}}]}}
{"type": "turn_ended", "status": "success"}
{"type": "turn_ended", "status": "…", "error": "…"}
```

## Tool calls

Cursor records **calls only**: a name, an input carrier, and a position.

- **No `id` on a `tool_use` block.** The key set is exactly `{input, name, type}`. There
  is no native call identifier of any kind.
- **Identity is positional**: the tuple `(file, frame index, block index)`, the only
  stable key available. See [Grow-in-place revision](#grow-in-place-revision) for when
  it is stable.
- **`input` is an object for every tool except `ApplyPatch`**, where it is a raw string
  (4,444/4,444 occurrences). A parser must branch on `(.input | type)`.
- **MCP calls are wrapped, not namespaced.** Instead of a namespaced tool name, Cursor
  emits `CallMcpTool` or `CallDynamicTool` whose `input` carries `server`, `namespace`,
  `toolName`, and `arguments`.
- **Parallel calls in one frame are routine** — up to 39 `tool_use` blocks in a single
  frame, all id-less. Pairing by name is therefore unsafe within a frame.
- **No per-call status, exit code, or duration** appears anywhere.

```json
{
  "type": "tool_use",
  "name": "CallMcpTool",
  "input": { "server": "…", "namespace": "…", "toolName": "…", "arguments": {} }
}
```

Observed native tool names, from the snapshot `inventory.json` value map at
`$.message.content[type=tool_use].name` (the 300 most recently modified transcripts; a
different sample from the findings report, which observed 25 names in 350 files):

`Shell` 15,417 · `ReadFile` 12,513 · `rg` 6,684 · `ApplyPatch` 5,447 · `Read` 3,800 ·
`StrReplace` 2,034 · `Grep` 1,427 · `Glob` 1,270 · `AwaitShell` 610 · `Subagent` 484 ·
`CallMcpTool` 435 · `TodoWrite` 404 · `Write` 221 · `Delete` 205 · `AskQuestion` 182 ·
`GetMcpTools` 151 · `CallDynamicTool` 113 · `GetDynamicTools` 106 · `WebFetch` 60 ·
`WebSearch` 56 · `Task` 34 · `ReadLints` 8 · `SwitchMode` 7 · `CreatePlan` 4.

The two samples do not list the same names. Tool names are an open set — a parser must
not reject an unknown name.

Cursor records no native skill-invocation or skill-version field. `ReadFile`
and `Read` calls can support inferred file-load evidence when their structured
input path ends in `SKILL.md`; a `Shell` command or prose mention does not.

## Tool results: not recorded

**Zero tool results exist in the corpus.** 0 of 1,295 files contain `tool_result`,
`tool_use_id`, or `is_error`; 0 of 44,041 recorded calls have a result.

Results are not-recorded by construction across the full 1,295-file corpus, and that changes what any
activity or outcome model can honestly say about Cursor:

| Model field      | Cursor value             | Reason                                          |
| ---------------- | ------------------------ | ----------------------------------------------- |
| Tool result      | `not-recorded`           | Absent by construction, not "frequently absent" |
| Per-call outcome | `unknown`                | No status, exit code, or duration is recorded   |
| Turn outcome     | from `turn_ended.status` | The only recorded outcome evidence              |

A model that distinguishes "missing" from "not recorded" must classify Cursor results as
`not-recorded`. Reporting them as absent-but-expected implies a recovery path that does
not exist.

## Off-transcript tool output (`agent-tools/`)

Large tool output does not live in the transcript. Alongside `agent-transcripts/` sits
`~/.cursor/projects/<proj>/agent-tools/<uuid>.txt`.

| Files                          | Min      | p50    | Max     |
| ------------------------------ | -------- | ------ | ------- |
| 340 (independently re-checked) | ~15.6 KB | ~59 KB | ~1.4 MB |

These files are referenced from transcripts only indirectly, as a **later** call's
`input.path` (63 occurrences) or inside `input.command` (2 occurrences) of read-type
tools. They are never written by `Write` or `ApplyPatch`.

The natural reading — that the harness spills large tool outputs to disk above roughly
15 KB and the agent reads them back — is an **inference, not vendor-confirmed**. It fits
the minimum observed size and the read-only reference pattern; nothing states it. Two
consequences:

- **Not attributable to a specific call.** Recorded evidence never links a sidecar file
  to the call that produced it; only a later read-back reference exists. The v1
  activity reader does not open this external surface and does not emit dedicated
  per-reference coverage for Cursor `agent-tools/` read-back paths.
- **Privacy-relevant.** They are a store of raw tool output outside the transcript, and
  any scrubbing or export policy that covers transcripts but not `agent-tools/` leaves
  that content exposed.

`agent-tools/` is a second sidecar class alongside `subagents/`. The v1 reader opens
neither surface and emits no dedicated per-reference coverage entry for either one;
only `subagents/` has any recorded identity at all.

## Lifecycle and outcome

A terminated turn ends with a `turn_ended` frame, and it is the final line in 339 of the
340 sampled files that contain one.

| `status`                        | Count                     |
| ------------------------------- | ------------------------- |
| `success` / `error` / `aborted` | 331 / 7 / 2               |
| `cancelled`                     | not observed in 350 files |

The `error` key is a string, present iff `status` is not `success`.

**11 sampled files contain no `turn_ended` at all.** Absence of the frame is the only
unterminated-turn signal available — there is no open/closed marker and no timestamp to
age a turn against. Turn-level status is the only outcome evidence in the format;
per-call outcome remains `unknown`.

The two counts above come from separate passes and differ by one file against the
350-file sample.

## Grow-in-place revision

Cursor revises a message in place. Static files cannot characterise that behaviour,
because a settled file shows each message exactly once.

Across 25,494 consecutive assistant frame pairs (compared by block count and length
only):

| Unrelated | Exact duplicate | Prefix extensions | Reverse prefixes |
| --------- | --------------- | ----------------- | ---------------- |
| 99.1%     | 0.8%            | 3                 | 11               |

What static files therefore do **not** reveal: there are no message ids, no
partial/streaming markers, and no residue of a superseded revision. Revision behaviour
needs live capture or the existing synthetic fixtures; it cannot be recovered from a
settled transcript.

The frame and continuity contract the shipped tooling uses to handle this — physical
frame streaming, prefix verification, and the separation of content availability from
lifecycle completion — is in
[Cursor Collaboration Reliability](../cursor-collaboration-reliability.md), with the
shared parsing layer in [Shared transcript-core](../transcript-core.md).

**Consequence for parsers:** because the only tool-call identity is positional, and
positions inside an open (still revisable) turn can shift, positional identities are
stable only once a turn has ended. Stateful activity delivery should therefore use the
terminal-settled prefix rather than the live tail. Stateless review and export can
still show calls visible in one source snapshot as snapshot-scoped
`pending-lifecycle` evidence for retrospective inspection.

## Subagents

A subagent transcript lives at `<session>/subagents/<child>.jsonl` and uses an
**identical schema** — same frame taxonomy, same block types, same absences.

Lineage is **directory containment**, not a recorded field. The child id appears inside
the parent transcript in only **9 of 24** parent/child pairs, so a parser that joins
parent to child by scanning parent content will miss most of them. Use the path.

Whether one file is one conversation or one turn is **undetermined**: 252 of 350 sampled
files have exactly one user frame, which is consistent with either reading.

## Metadata that does not exist

| Field                          | Status                                                            |
| ------------------------------ | ----------------------------------------------------------------- |
| Timestamps of any kind         | Absent — no per-frame time, no durations                          |
| Usage / token counts           | Absent                                                            |
| Model                          | Absent as metadata; only an _argument_ to `Subagent`/`Task` calls |
| Client version                 | Absent                                                            |
| Message id, in-file session id | Absent — identity is the path                                     |

The lack of timestamps is the sharpest constraint: a Cursor transcript cannot be placed
on a shared timeline with another runtime's transcript from its own contents, and file
mtime is the only time signal available.

## Payload sizes

Block payload length across the sample:

| p50 | p90   | p99   | max    | max including user text |
| --- | ----- | ----- | ------ | ----------------------- |
| 249 | 1,058 | 5,978 | 48,304 | 82,171                  |

No cap or cliff was observed, so a parser should not assume a maximum block size.
Occurrences of `[...]` (16) and `[truncated]` (9) out of 55,905 payloads look like
authored prose rather than harness truncation markers; they should not be treated as
elision signals.

## Known errors in earlier research and defensive code

The pre-existing research packet describes a Cursor frame that this corpus does not
support. `schemas/native/cursor-frame.schema.json` documents **ten properties, none of
which were observed**:

block `id`; `tool_use_id`; block `content`; `is_error`; `thinking`;
`message.timestamp`/`createdAt`/`model`/`usage`; top-level
`timestamp`/`createdAt`/`model`/`usage`; `content` as a bare string; and
`status: "cancelled"`. It appears to be derived from `cli-continues` plus
Anthropic-shaped assumptions. **Do not build Cursor extraction to that schema.**

In shipped code, `src/shared/transcript/cursor-analysis.ts` defensively handles string
`content`, `runtime_diagnostic`/`diagnostic` frames, and `cancelled` status. None of
those were observed. The branches are harmless, but their presence is not evidence that
a real variant exists — they should not be cited as proof of a shape. Its
`AskQuestion`-as-conversation special case, by contrast, is well founded: 144 hits with
structured `questions[]` / `options[]`.

`src/shared/transcript/cursor-frames.ts` is **uncontradicted** by this evidence. The two
Cursor claims in `10-schema-guide-and-coverage.md` are supported.

## Not observed / not determined

- `status: "cancelled"` — not observed in 350 files.
- Any tool result, call id, or per-call outcome — not present corpus-wide.
- Any timestamp, usage, model, or version metadata — not present.
- Streaming, partial, or superseded-revision markers — not present in settled files.
- Attribution of an `agent-tools/` file to the call that produced it — not recoverable.
- Whether a file is one conversation or one turn — undetermined.
- Whether the ~15 KB spill threshold is real — inferred, not confirmed.
- Shape drift across Cursor versions — untestable, since no version field exists.

## Fixture checklist

Structural predicates for capturing a representative fixture set. Scrub all text and
input values before committing any fixture.

- User frame · text-only assistant frame · single call · text and tool in one frame.
- Parallel calls: `[.message.content[] | select(.type=="tool_use")] | length > 3`
- `ApplyPatch` string input:
  `.message.content[] | select(.type=="tool_use" and (.input|type)=="string")`
- MCP wrapper: `select(.name=="CallMcpTool" or .name=="CallDynamicTool")`
- `AskQuestion` · `Subagent`/`Task` · background shell
  (`.input.run_in_background==true` or `AwaitShell`).
- Sidecar read-back: `.input.path | test("/agent-tools/")`
- `turn_ended` success / error / aborted, and a whole file with no `turn_ended`.
- A `subagents/` child file captured with its parent · a block over 30 KB.
