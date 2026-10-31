---
title: 'Seshtk CLI'
description: 'Ask an agent to explain or run Session Toolkit commands for local session identity, search, reads, export, activity, and evidence.'
---

# Seshtk CLI

`seshtk-cli` helps an agent turn a session question into a small, verified
[Session Toolkit](../session-toolkit/index.md) command workflow. Use it to find
an earlier conversation, inspect a transcript, export Markdown, or understand
what a `seshtk` command does.

Install it standalone as `seshtk-cli` or through the Session plugin as
`session:seshtk-cli`. Both forms share this guide. The skill is instruction-only: it
uses an external CLI and does not bundle or automatically download it.

## Try a request

You can ask naturally:

> Use seshtk to find last week's session about the release script in this repo.

> Read the session codex:SESSION_ID and explain which tools failed. Keep the
> answer focused and report any missing evidence.

> What is the difference between seshtk read and parse?

For an explicit invocation, use the syntax for your installed form:

| Form                       | Example                                                      |
| -------------------------- | ------------------------------------------------------------ |
| Codex standalone           | `$seshtk-cli list sessions in this repo`                     |
| Claude Code standalone     | `/seshtk-cli export codex:SESSION_ID to a new Markdown file` |
| Claude Code Session plugin | `/session:seshtk-cli list sessions in this repo`             |

Replace `SESSION_ID` with a native session ID. Other hosts use their own skill
selection syntax; these examples do not establish live discovery or permissions
for every provider. See [Installation](../installation.md) for installation forms
and verification limits.

## Prerequisites

Explaining a command or showing an example requires no CLI installation and
reads no session data. Executing a workflow requires:

- Node.js **22 or later** on the host where the operation will run.
- The external `@tkstang/session-toolkit` CLI. The verified baseline is **0.1.0**;
  another version must pass version, schema, provider, and capability checks.

Installing the skill does not install this package. If the CLI is missing, the
agent reports the prerequisite and offers the pinned installation command:

```sh
npm install --global @tkstang/session-toolkit@0.1.0
```

An explicitly selected one-off alternative is:

```sh
npx --package=@tkstang/session-toolkit@0.1.0 -- seshtk capabilities --json
```

Both installation and `npx` can download packages. The agent uses existing
authorization for that action or asks before downloading, installing, or
upgrading. It does not force a freshness check or upgrade a compatible install.

## How execution works

The agent checks Node and CLI availability, then verifies the installed command
before reading session data:

```sh
seshtk --version --json
seshtk capabilities --json
seshtk --help
seshtk search --help
```

It checks the JSON contract and the capabilities needed for the chosen operation,
uses that command's help for current options, and reuses successful checks for
the same host and executable during the session. Machine operations use
`--json`, which also disables CLI update lookups.

| Your goal                            | Workflow                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Identify this conversation           | Require authoritative `self-identify` evidence; historical recency cannot identify the current session.         |
| Find a past session                  | Use `list` or `search` with the supplied directory/time hints; report search widening and competing candidates. |
| Read known data                      | Use `read` with a provider-qualified native ID, or `parse` with an explicit file and provider.                  |
| Save a conversation                  | Use `export` with a new destination and inspect each written file's coverage.                                   |
| Inspect full recorded tools or usage | Use sensitive `activity` capture; report provider support gaps.                                                 |
| Inspect exact Codex evidence         | Use returned cutoff and expansion references with `read --evidence`.                                            |

A directory, newest transcript, or parent/grouping ID never substitutes for exact
current identity. When selection remains ambiguous, the agent reports the
candidates or asks for the missing choice. Large scans need authorization based
on the returned estimate; the skill does not silently enable `--allow-large-scan`.

## Results, files, and privacy

The response gives the selected provider/native identity, the useful answer or
a small ranked candidate list, and material coverage gaps or uncertainty.
For artifacts, it reports paths confirmed by the command. It does not resume a
provider, send messages, watch sessions, or maintain checkpoints.

Reads and exports default to 4,000,000 source bytes. Exit 0 can mean an empty
search or a partial result. The agent checks coverage and diagnostics before
claiming completeness. Export omits read diagnostics, so a completeness claim
also needs a matching `read --json` check. An export has no continuation: if a
byte limit omitted needed content, retry with a larger budget and a new file.
Existing destinations and symlinks are never overwritten.

Markdown sanitization removes recognized hidden instruction/control payloads;
it does not guarantee removal of all hidden instructions or audit visible text
for secrets. Review before sharing. Raw reads, evidence, and activity remain
sensitive. Requested activity analysis prefers a new private artifact (`0600`)
over pasting raw JSON into chat.

For command options and exact output fields, use the [CLI reference](../session-toolkit/cli.md),
[transcript and export contracts](../session-toolkit/transcripts.md), and
[activity reference](../session-toolkit/activity.md).

## Choose between related skills

| Skill                                                     | Choose it when                                                                                                                             | Runtime prerequisite                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **Seshtk CLI**                                            | You want the broad toolkit command surface, help with CLI usage, or a workflow combining discovery, reads, export, activity, and evidence. | External Session Toolkit CLI and Node.js 22+.                              |
| [Session Search](session-search.md)                       | You want a focused search from a fuzzy description, with ranked candidates and resume hints.                                               | Its bundled Node.js 22+ runtime; no Session Toolkit installation required. |
| [Session Export Transcript](session-export-transcript.md) | You want the current conversation saved through its dedicated naming and default-destination workflow.                                     | Its bundled Node.js 22+ runtime; no Session Toolkit installation required. |

These are independent choices. `seshtk-cli` requires neither related skill, and
their focused workflows remain available in standalone and Session forms.
