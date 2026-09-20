---
title: 'Native session schemas'
description: 'What Codex, Claude Code, and Cursor actually write to their session transcripts, as observed from recorded sessions, for anyone building a parser on them.'
---

# Native session schemas

These pages document the on-disk session transcript formats of the three runtimes
this repository reads: Codex CLI, Claude Code, and Cursor. They describe the
**providers' native formats**, not this repository's parsers. For how the repository
reads these files, see [Shared transcript-core](../transcript-core.md).

Everything here was derived from recorded sessions, not from provider documentation
or third-party parsers. None of the three providers publishes a stable schema for
these files, and they change between client releases.

## How to read these pages

- **Observed, not guaranteed.** Each page states its sample, date, and client-version
  range. "Not observed" means no sampled file contained the shape. It never means the
  shape does not exist.
- **Versioned where the transcript allows it.** Codex and Claude Code record a client
  version in the transcript, so shapes are tied to version ranges. Cursor records no
  version, model, or timestamp, so its shapes are tied to the observation date only.
- **Structure only.** The pages contain field paths, JSON types, enum vocabulary, and
  counts. Examples are skeletons with placeholders. No recorded content is reproduced.
- **Evidence strength is explicit.** A native id that links two records is strong
  evidence. A link inferred from turn, order, or position is weaker and is labelled as
  such. A missing field is never treated as proof of success.

## Cross-runtime comparison

| Question                     | Codex                                                                                                | Claude Code                                                                                                                                                           | Cursor                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Client version in transcript | Yes (`session_meta.payload.cli_version`)                                                             | Yes (`version` on records)                                                                                                                                            | No                                                                    |
| Timestamps                   | Yes                                                                                                  | Yes                                                                                                                                                                   | No                                                                    |
| File identity                | First `session_meta` `payload.id`, equal to the filename uuid                                        | `sessionId`; one per file                                                                                                                                             | The file path only                                                    |
| Native tool-call id          | `call_id`                                                                                            | `tool_use.id` / `tool_result.tool_use_id`                                                                                                                             | None; identity is positional                                          |
| Tool results recorded        | Yes                                                                                                  | Yes                                                                                                                                                                   | No                                                                    |
| Structured exit code         | Yes, in the separate `item_completed` stream only                                                    | No                                                                                                                                                                    | No                                                                    |
| Per-call failure flag        | `item.status` in the `item_completed` stream (attributing it to a specific call is an inferred join) | `is_error: true` on the result block                                                                                                                                  | None; turn-level `turn_ended.status` only                             |
| Subagent transcripts         | Separate rollout file; `id != session_id`                                                            | Separate file under `<session-id>/subagents/` plus `.meta.json`                                                                                                       | Separate file under `<session-id>/subagents/`                         |
| Parent names its children    | Yes, via `SubAgentActivity.agent_thread_id`                                                          | Yes for directly spawned subagents, via the `Agent` tool result's agent id and the child's `.meta.json` `toolUseId`; workflow-spawned children join by directory only | Partly; child id appears in the parent in a minority of pairs         |
| Oversized tool output        | Truncated in place at fixed byte caps, no marker                                                     | Persisted to `<session-id>/tool-results/`; path only in `toolUseResult.persistedOutputPath`                                                                           | Probably spilled to `agent-tools/` files, not attributable to a call  |
| Token usage                  | Cumulative and per-turn records                                                                      | Per message, repeated on every content-block record                                                                                                                   | None                                                                  |
| Skill evidence               | Historical experimental `read_file.file_path`; removed upstream March 2026 and absent locally        | Top-level `attributionSkill`, structured `Skill` calls, and names-only availability/invocation attachments                                                            | Inferred from structured `Read`/`ReadFile` paths ending in `SKILL.md` |

## Reader requirements that follow from the evidence

- Split records on the LF byte only. U+2028 and U+2029 occur unescaped inside string
  values; the abandoned scanner treated them as record boundaries and reported valid
  records as malformed, while LF-byte splitting parsed the sampled records.
- Do not assume one header per file (Codex child files can carry an inherited parent
  header) or one record per logical message (Claude Code writes one assistant record
  per content block).
- Do not use a message or item `id` where a call id is required. In Codex the two
  differ in almost every call.
- Treat inherited parent history in Codex child files as context, not as the child's
  own activity.
- Keep native skill attribution, recorded invocation, availability, and inferred
  direct file reads as separate evidence. Do not parse shell commands, prose, or
  instruction bodies to manufacture a skill load.

None of the three native transcript formats records a skill version. An
installed-file or Git revision selected for the transcript timestamp is inferred
context, may be unknown, and cannot prove the revision that executed.

The activity reader keeps usage as captured-source metadata. It deduplicates
Claude Code by exact session and `message.id`, keeps Codex cumulative,
last-turn, and response-joinable records separate, and reports Cursor usage as
`not-recorded`. It never treats a missing counter as zero or converts tokens to
money.

## Repository parser support

The repository now has tested opt-in activity readers for the three documented
transcript surfaces. This implementation status does not strengthen or extend
the native-format observations on these pages.

| Runtime     | Tested activity support                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | Recorded calls/results and native IDs, persisted-output and child references as explicit `not-read`; referenced sidecars and child trajectories are not read. |
| Codex       | Response/item carriers, exact recorded joins, ownership from native lineage and inherited-history boundaries; unknown ownership remains unknown.              |
| Cursor      | Positional frame/block calls, settled stateful delivery, pending-lifecycle stateless review, results `not-recorded`, per-call outcome unknown.                |

Session Observer and Session Export Transcript read each selected source once
when activity is enabled. Their reports preserve source/delivery locators,
bounded previews, omission counts, unread/unavailable coverage, and extraction
diagnostics. See [Shared transcript-core](../transcript-core.md) for budgets and
consumer semantics.

## Keeping these pages current

The evidence behind these pages is a dated snapshot under
`.oat/repo/reference/research/session-schemas-2026-09-18/`, produced with the
structure-only `inventory.mjs` script in that directory. The script emits only
human-reviewed vocabulary and ships with synthetic privacy canary tests. When a client
update changes a format, run a new inventory, add a new dated snapshot, and update the
affected page with the new version range. Do not edit an old snapshot.

## Contents

- [Codex session schema](codex.md) — Rollout JSONL: identity and subagent lineage, the
  two tool-activity streams, outcome evidence, and silent output caps.
- [Claude Code session schema](claude-code.md) — Project JSONL and sidecar layout:
  tool blocks and `toolUseResult`, subagent files, usage duplication, persisted output.
- [Cursor session schema](cursor.md) — Agent-transcript frames: calls without ids or
  results, turn lifecycle, and off-transcript tool output.
