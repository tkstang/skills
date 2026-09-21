---
title: 'Session Export Transcript'
description: 'Export the current coding-agent session to a sanitized, branch-named Markdown transcript.'
---

# Session Export Transcript

`session-export-transcript` exports the current agent session to a sanitized
Markdown transcript. Install it standalone under that full name or through the
session plugin as `export-transcript`; both generated forms share one authored
owner and one `metadata.version`.

## What it does

- Exports the **current** conversation (yours — Claude Code, Codex, or Cursor)
  to a sanitized Markdown transcript.
- Names the output after the current git branch (`/` replaced with `-`) and
  writes it by default to `~/Downloads`.
- Supports Claude Code, Codex, and Cursor transcript stores.
- Optionally appends bounded, source-attributed activity with
  `--include-activity`.
- Optionally writes a complete sensitive activity JSON artifact for one exact
  native session with `--activity-output <path>`.

Only visible user/assistant messages survive: tool calls, tool results,
system/developer instructions, environment/AGENTS.md/skill payloads, subagent
notifications, automatic-control wake envelopes, and the session-marker line are
all excluded. Wake envelopes carry lease ids and pinned peer-session identity, so
they are dropped on their structural provenance tag rather than by matching their
payload text.

Ask-user exchanges are the one exception. Every runtime asks the operator
questions through a tool call (`AskUserQuestion`, `request_user_input`,
`AskQuestion`), and the question plus any answer the runtime recorded is visible
conversation rather than tool mechanics, so it is exported. What gets recorded
differs by runtime: Claude Code records the answer; Codex records it but cannot
distinguish an operator choice from an `autoResolutionMs` timeout; Cursor
records only the question, and the export says the selected option is
unrecorded.

## The session-marker mechanism

The hard problem is identifying **which** transcript is _this_ live
conversation. To solve it, the agent announces a unique random-hex session
marker to the user; the marker lands in the transcript, and the export script
greps cwd candidates for it to select the current session unambiguously. If the
marker has not yet been flushed, it falls back to the newest transcript for the
cwd with a warning — re-run with `--session <id>` if the fallback picked the
wrong session.

## Modes and flags

- `--match <marker>` selects the current session by the announced marker (with
  newest-for-cwd fallback).
- `--session <id>` exports a specific session id.
- `--all` exports every session for the cwd, one file each.
- `--include-activity` appends a labelled activity report to each selected
  export; it is off by default.
- `--activity-output <path>` writes a complete sensitive JSON artifact paired
  with one exact `--session <id>`; it rejects `--all`, `--match`, and discovery
  fallback.
- `--runtime <claude-code|codex|cursor|auto>` selects the runtime (default
  `auto`: env hint, then best-effort detection).
- `--out <path>` overrides the output file or directory (also accepted
  positionally).

For ordinary exports, selection is evaluated with precedence `--all` >
`--session` > `--match` > no selector. The highest-precedence flag present wins
and lower-precedence flags are ignored. Complete structured capture validates
its exact-session contract first: when `--activity-output` is present, any
`--all` or `--match` flag is rejected, including `--session <id> --match
<marker>`. With no selector, exactly one cwd candidate is selected; multiple
candidates exit with an ambiguity message that asks for `--match`, `--session`,
or `--all`.

## Optional activity appendix

`--include-activity` leaves the sanitized conversation pipeline intact and
adds a separate **Sensitive activity/debug data** section. Each selected
session is captured once, and both the conversation and activity sections are
derived from that snapshot. Export is stateless: it does not read or advance
Session Observer offsets, and `--all` does not change output filenames.

The export activity budget is 64 MiB for the rendered report, with no
invocation-count cap and a 2 KiB preview per value. The shared projection also
reserves 256 bytes for late-call context, although a normal full-session export
starts at zero and includes the call itself. Source and delivery ranges,
locators, captured/delivered/displayed counts, omissions, coverage, and
diagnostics remain explicit.

The report keeps native tool names and adds typed skill evidence when the
transcript supplies it. Claude Code attribution, structured `Skill`
invocations, and names-only skill attachments stay distinct. A native `Skill`
call retains caller-supplied input under the normal preview cap; attachment
instruction content is not copied. Available source names are deduplicated by
name at their latest locator, invoked names remain per occurrence, and
`source-skill-names` coverage counts both carrier types and distinguishes valid
empty `skill_listing.names` or `invoked_skills.skills` arrays from absent
carriers. Cursor `Read` and
`ReadFile` calls can supply inferred `SKILL.md` file-load evidence from their
structured `path`. Historical Codex transcripts can supply the inference only
from the exact experimental `read_file.file_path` carrier; upstream removed the
tool in March 2026, and it is absent from the recent local sample. Shell
commands, aliases, and prose are never treated as skill loads. Source-wide skill
names are labelled `captured-source` and participate in the report byte budget
with explicit omission counts. Optional source metadata is trimmed before
delivered calls and results are removed.

The supported runtimes do not record a skill version. A timestamp-relevant
installed-file or Git lookup is inferred context, can remain unknown, and is
not proof of the revision that executed.

Captured-source token metadata preserves the runtime's semantics rather than
combining unlike counters. Claude Code repeats of one `message.id` are
deduplicated within the exact native session, conflicts are diagnosed, and
missing IDs remain uncertain. Codex cumulative, last-turn, and
response-joinable records stay separate; counter decreases mark reset segments,
and samples retain `owned`, `inherited`, or `unknown` lineage. Reset state and
model joins cannot cross an ownership boundary. Response records match the
native thread through `thread_id`, while their separate `session_id` remains
root-session context. Models are attached only through recorded turn evidence
with matching ownership. Cursor usage is `not-recorded`, not zero. The report
emits token fields without pricing or cost estimates and explicitly counts
usage metadata omitted by its byte budget. A source-wide usage extraction
failure is `not-read` with a content-free `USAGE_EXTRACTION_ERROR` diagnostic,
distinct from genuine `not-recorded` runtime evidence.

Activity previews can contain commands, paths, identifiers, tool inputs, and
tool outputs even though the conversation section remains sanitized. The
exporter does not open Claude persisted-output sidecars, Cursor `agent-tools/`
files, or Claude, Codex, or Cursor child transcripts. Schema v1 emits explicit
`not-read` coverage for persisted-output references recorded by Claude and child
IDs recorded by Claude or Codex. Cursor `agent-tools/` and child-transcript
surfaces have no dedicated per-reference schema-v1 coverage entry. Extraction
failure appears as `record-activity: not-read` with an
`ACTIVITY_EXTRACTION_ERROR` diagnostic.

Cursor activity is retrospective. It includes settled calls and calls visible
in the snapshot with `pending-lifecycle`, identifies them by frame and block
position, reports results as not recorded, and leaves per-call outcome unknown.

## Complete structured activity capture

Use `--activity-output <path>` when a retrospective analysis needs the complete
captured activity graph rather than the bounded Markdown appendix:

```bash
node skills/session-export-transcript/scripts/session-export-transcript.mjs \
  --runtime codex \
  --session <exact-native-session-id> \
  --out session.md \
  --activity-output session.activity.json
```

This mode is explicit and independent from `--include-activity`. It requires one
exact native session pin and rejects every `--match` combination before ordinary
selector precedence is applied. It reads the selected source once and derives
both files from that snapshot. Claude Code and Codex must corroborate the requested identity
from native records captured in that read; Cursor uses its documented native
session directory/file path. The paired Markdown header and JSON carry the same
capture timestamp and native identity. Each Markdown narrative entry gains a
stable anchor plus source/consumption coordinates and recorded provenance;
missing origin remains `unknown`, so a `role: user` record alone is never called
human. Cursor coordinates remain physical frame indexes even when blank or
malformed frames precede a decoded record.

For Codex, the primary identity carrier is the first
`session_meta.payload.id`. A headerless capture can use the native
`token_usage_record.payload.thread_id` carrier when present and consistent.
`session_id`, legacy top-level aliases, message/item IDs, and the filename are
context or selection evidence rather than native thread identity, so they
cannot authorize the structured capture.

The JSON envelope is labelled `sensitive: not-publish-safe` and carries the
existing `ActivityReport` in `complete-capture` mode. There is no total-byte or
invocation-count eviction, while every input/output preview keeps the normal 2
KiB cap. Narrative entry metadata contains coordinates and provenance without
copying full message bodies. Malformed or partial source reads preserve honest
coverage, diagnostics, and source/decoded counts. “Complete” means every
supported invocation in the captured bytes; it does not prove the session was
stopped or that the provider recorded every runtime action.

The paired Markdown adds a **Structured Activity Capture Index** with one stable
invocation key for each captured call. This index appears only in the opt-in
`--activity-output` workflow and can be large; the sensitive JSON remains the
source of truth for the captured activity graph.

An absent activity destination is created, and an existing ordinary file is
replaced atomically through a temporary sibling. Directories, symlinks, special
files, aliases to the transcript or narrative output, and paths in both Observer
checkpoint/watch roots — the effective `STATE_DIR` root and the fixed default
`~/.local/state/session-observer` — are rejected before either output is written.
External hardlink aliases to ordinary files recursively under either existing
Observer state root are also rejected; symlinks under those roots are not
followed.
Independently relocated collaboration roots are outside this guard. The command
returns failure without a success claim when a file operation fails; the two
files are not presented as a filesystem transaction, so an activity JSON
failure can leave the narrative at the path named in the error. No Observer
checkpoint or marker is read or written.

## Selection and sanitization flow

```mermaid
flowchart TB
  Start[Transcript candidates for the cwd]
  Start --> Mode{Highest-precedence selection flag?}
  Mode -->|--all| All[Select every session]
  Mode -->|--session id| Session[Select the requested session]
  Mode -->|--match marker| Marker[Look up marker in cwd candidates]
  Mode -->|none| Default{One candidate?}
  Marker -->|found| Selected[Selected transcript or transcripts]
  Marker -->|not found| Fallback[Use newest-for-cwd transcript and warn]
  Fallback --> Selected
  All --> Selected
  Session --> Selected
  Default -->|yes| Selected
  Default -->|no| Ambiguous[Stop: choose --match, --session, or --all]
  Selected --> Structural[Structural pass: normalizeEntries]
  Structural --> Content[Content sanitizer: sanitizeEntries]
  Content --> Strip[Strip marker lines and empty entries]
  Strip --> Render[Render Markdown transcript]
```

## Sanitization

Sanitization is two layers:

1. A **structural pass** (`normalizeEntries` in transcript-core) drops tool
   calls/results and command-message records, except ask-user exchanges, which
   it keeps as visible conversation.
2. An **export-owned content sanitizer** (`sanitizeEntries`) drops hidden-payload
   messages surviving as ordinary text — environment-context wrappers,
   AGENTS.md/SKILL.md/skill-body payloads, system/developer instruction records,
   subagent notifications, and `turn_aborted` markers.

The session-marker line and empty entries are stripped before render.

## Limitations

- Cursor agent transcript JSONL is the supported store; the Cursor SQLite
  chat-history store is out of scope for the session skills.
- Prompt injection inside input transcripts is mitigated by prompt framing and
  filtering, but review exported output before publishing it.
- This repository adds no telemetry. Configured provider CLIs may have their own
  behavior; review those tools separately.
