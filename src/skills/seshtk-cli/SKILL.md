---
name: seshtk-cli
description: Use when the user asks to use or understand seshtk, the Session Toolkit CLI, for local coding-agent session identity, discovery, search, transcript reads, Markdown export, activity capture, or Codex evidence. Also use for CLI capability checks and troubleshooting. Keep explanation-only questions independent of CLI availability.
metadata:
  author: Thomas Stang
  version: '1.0.0'
license: MIT
compatibility: Instruction-only skill; executing workflows requires Node.js 22+ and the external @tkstang/session-toolkit CLI. Verified baseline 0.1.0.
disable-model-invocation: false
user-invocable: true
---

# {{distribution.name}}

Turn a session task into a small, verified `seshtk` workflow. Use the installed
CLI's capabilities and command help for current options; this skill does not
bundle the CLI or require another skill.

## Choose the task

Infer the requested operation, provider, project/time scope, known session ID or
transcript path, and output destination from the conversation. Ask only when a
missing input or competing candidate changes which data you would read or write.
Do not ask the user to repeat information already supplied.

- For an explanation, command example, or comparison, answer without executing
  session operations. CLI installation is unnecessary for a documentation-only
  answer; label suggested commands as examples when they have not been run.
- For execution, complete the preflight below before reading session data or
  preparing dependent actions. Work only on the authorized host and scope.
- This skill does not resume providers, watch peers, send messages, or maintain
  consumer checkpoints. A request only to explain a programming concept or save a
  note to a vault does not trigger this workflow.

## Preflight before execution

Check executable availability and Node compatibility first:

```sh
command -v node
node --version
command -v seshtk
```

Require Node 22 or later. If it is missing or older, report the unmet prerequisite
and point to [Node.js installation](https://nodejs.org/en/download). If `seshtk`
is missing, provide the selected baseline installation command:

```sh
npm install --global @tkstang/session-toolkit@0.1.0
```

An explicit alternative is:

```sh
npx --package=@tkstang/session-toolkit@0.1.0 -- seshtk capabilities --json
```

Installation and `npx` may download packages. Do not install, upgrade, or fetch a
package without the user's authorization. Existing authorization for that
installation carries forward; do not request it again. If the user chooses
`npx`, verify Node and `npx` availability and use that same pinned prefix in place
of `seshtk` for subsequent commands. Report registry or installation failures
honestly; do not assume publication from a repository version alone.

With the chosen executable available, inspect its version and capabilities:

```sh
seshtk --version --json
seshtk capabilities --json
```

Expect a JSON envelope with `ok: true`, `schema_version: 1`, and `data`.
The version command returns `data.version`. Capabilities returns
`data.package` (`@tkstang/session-toolkit`), `data.version`,
`data.schema_version` (`1`), `data.node`, `data.capabilities` (an array of
versioned IDs), and `data.providers`. Require the operation's capability below
and the selected provider where applicable. Version 0.1.0 is the verified
baseline; accept another version only after checking this contract and the
required capabilities. Missing/incompatible prerequisites block the dependent
operation. Give the [package's install/update guidance](https://github.com/tkstang/skills/tree/main/packages/session-toolkit#readme)
and the failing check.

Reuse successful checks on the same host and executable during this session.
Do not query the network for freshness or force an upgrade when a compatible
version works. Use `--json` for machine operations: it also disables CLI update
lookups. Read `seshtk --help`, then `seshtk <command> --help` for the chosen task
before composing flags. Subcommand help such as `seshtk search estimate --help`
provides details without scanning transcripts.

## Select an operation

| Goal                                               | Command           | Required capability            |
| -------------------------------------------------- | ----------------- | ------------------------------ |
| Establish this conversation's exact identity       | `self-identify`   | `identity.current.v1`          |
| Enumerate historical candidates                    | `list`            | `sessions.list.v1`             |
| Find a past session from remembered content        | `search`          | `search.v1`                    |
| Estimate a historical search's candidate bytes     | `search estimate` | `search.estimate.v1`           |
| Read one qualified session                         | `read`            | `transcript.read.v1`           |
| Parse a known JSONL file with an explicit provider | `parse`           | `transcript.parse.v1`          |
| Save sanitized conversation Markdown               | `export`          | `export.markdown.v1`           |
| Capture sensitive structured activity              | `activity`        | `activity.v1`                  |
| Inspect recorded Codex cutoff/expansion evidence   | `read --evidence` | `transcript.evidence.codex.v1` |

### Identity and selection

Keep exact current identity separate from historical selection. Use
`self-identify --json` for this conversation; only `status: 'authoritative'`
establishes exact identity. `corroborated`, `ambiguous`, `invalid`, and
`unavailable` do not. The CLI refuses non-authoritative identity; inspect its
error evidence and report exact identity as unresolved. A `list` or `search`
result is a historical candidate, even when it is newest or shares the current directory.
Never relabel a cwd/recency winner as the current session.

Use provider-qualified native IDs, such as `codex:<native-id>`,
`claude-code:<native-id>`, or `cursor:<native-id>`, for session selectors. Do not
substitute parent, grouping, item, or message IDs. If an unqualified ID is supplied,
establish its provider from evidence; ask only if competing matches remain.
For a successful `self-identify`, combine `data.runtime` and `data.runtimeId`.
A `list` candidate already provides `session`. A `search` hit provides
`runtime` and `sessionId`; combine them as `<runtime>:<sessionId>` for `--session`.
Do not assume every operation returns the same identity field.

`list --cwd` filters historical candidates and defaults to the invocation cwd.
`search --cwd` is a widening hint: a miss can search other directories. Include
explicit scope and report widening. Use distinctive patterns with `-p`; use
`--literal` for literal text. Inspect help for time, tier, tool-output, deadline,
and result-limit options. If `E_SCAN_CONFIRMATION` requires a larger scan, show
the returned estimate and obtain authorization before `--allow-large-scan`,
unless that scan scope is already authorized.

### Read and inspect

Use `read --session` for a selected native identity. Use `parse <path> --runtime`
when the user supplies a transcript file; parsing that file does not establish
current identity. Reads default to 4,000,000 source bytes; start with a bounded
page that fits the question. Add tool calls/results only when relevant; their
preview options are independent.

Inspect coverage, diagnostics, and returned continuation fields before claiming
completeness. Continue using returned cursors when needed; do not invent cursor
tokens or infer offsets from displayed message counts. A source change can
invalidate ordinary continuation: handle the reported error and re-read the
same selected identity rather than silently switching sessions. `--include-activity`
adds a captured-page summary; it does not capture complete session activity.

For Codex evidence, use `read --session 'codex:<native-id>' --evidence --json`.
Use only cutoff tokens and expansion references returned by the CLI. A cutoff
freezes a captured prefix across appends; expansion requires that cutoff.
Ordinary cursor/offset pagination conflicts with evidence mode. Follow live help
for expansion, related events, and redacted-field offsets. Other providers do
not support this evidence capability. Recorded evidence cannot prove an action
or output the provider never captured.

### Write an artifact

An export request authorizes creating the requested artifact. For a current-session
export, resolve exact identity first, then pass its qualified selector to
`export --session ... --out ... --json`. Historical marker selection (`--match`)
and bounded batch export (`--all`) are separate modes; do not combine them with
an exact selector. Batch export covers the returned bounded candidate set.

Export also defaults to 4,000,000 source bytes per transcript and can succeed
with a partial transcript. Check each `data.written[].coverage`, the Markdown
`Source coverage` line, and batch discovery coverage before describing an
export as complete. Coverage describes the captured range: malformed records can
be skipped even when it says complete. Export omits read diagnostics; inspect
`read --json` with the same selection and budget before claiming completeness.
Export returns no continuation. When a byte limit omitted
needed content, rerun with a larger `--max-bytes` and a new destination; do not
silently treat the earlier artifact as complete.

Honor the supplied destination or choose a descriptive new file for a single
export; `--all` takes a directory. Both Markdown export and `activity --out`
refuse existing files and symlinks. Choose an unused path on collision; do not
delete or overwrite a destination to make the command succeed.

Sanitized Markdown removes recognized hidden instruction/control payloads. It
does not guarantee removal of every hidden instruction, including those embedded
in tool results, or audit visible conversation and tool text for secrets. Review
before sharing.
Keep raw records, structured evidence, and sensitive activity out of shareable
reports. `activity` retains raw captured records and full recorded tool payloads;
it is not sanitized Markdown. Use it only when activity analysis is requested,
prefer a new private `--out` artifact over dumping raw JSON into chat, and report
the captured coverage and provider support gaps. The CLI creates activity files
with mode `0600`; do not loosen that mode for sharing.

## Interpret and report

Parse stdout as the single JSON envelope; keep stderr diagnostics separate.
`ok: false` provides `error.code`, `message`, `hint`, and optional `details`.
Use that evidence to correct arguments, resolve ambiguity, or explain unavailable
sources. Exit 0 includes empty search results and partial coverage; exit 1 signals
any reported error except `E_IO` and `E_INTERNAL`, which exit 2. Neither an
empty bounded search nor a successful exit proves complete history was examined.

Return the selected provider/native identity, the relevant answer or a small
ranked candidate list, and material bounds, omissions, widening, or uncertainty.
For writes, report only paths confirmed by the command, with clickable links
when supported. Do not claim live provider discovery, complete activity, or a
successful export from help output or a proposed command.

## Examples

- Natural language: “Use seshtk to find last week's session about the release
  script in this repo.” Preflight, inspect search help, search a bounded scope,
  and return ranked candidates with coverage.
- Natural language: “What is the difference between seshtk read and parse?”
  Explain identity selection versus an explicit file without installing or
  reading transcripts.
- Codex standalone: `$seshtk-cli export the session codex:<native-id> to a new
Markdown file in Downloads`.
- Claude Code standalone: `/seshtk-cli inspect activity for codex:<native-id>`.
- Claude Code session plugin: `/session:seshtk-cli list sessions in this repo`.
  Use the host's skill selection syntax for other installed forms.
- Outside scope: “Explain a Python traceback” or “Save this decision to my
  vault.” Neither requires Session Toolkit operations.
