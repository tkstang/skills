---
title: 'Debrief'
description: 'Get a concise account of what happened in a session while you were away, without gathering fresh state.'
---

# Debrief

`debrief` is a standalone, instruction-only skill for the moment when you return
to a session and face a long stretch of output you did not watch. It reports
what the work produced and what it left open, instead of replaying the
transcript in order. It looks back; it does not recommend or carry out what
comes next.

## What it covers

By default the account covers everything after your most recent message and
before the request. Only messages you wrote count as that boundary. Task and
subagent notifications, hook output, scheduled wakeups, and messages from other
agents do not, even when the host places them in the user role. Name a
different scope, such as the whole session or one topic, to override the
default.

A useful account includes, where each applies:

- the goal and where the work stood at the last visible event;
- what changed, including files, commits, pull requests, and messages sent;
- what was decided and by whom, calling out decisions the agent made alone;
- what went wrong or was unexpected;
- what is still running or unfinished; and
- a brief assessment of what looks sound and what remains unverified or risky.

It then lists every question or approval request addressed to you that is still
unanswered anywhere in the visible session, not only in the default interval. A
later unrelated message does not close an earlier question. One the agent
withdrew or replaced is closed, and one the agent proceeded past without an
answer is reported as a decision made without you.

The account ends with one line on what is waiting on you. When work remains
open it also points to [Next Steps](next-steps.md) for a recommendation. That
skill is optional and is never invoked for you.

## Shown versus reported

The skill uses only the session history already visible. It does not run
commands, read files, or query services, so it cannot describe anything that
changed outside the session.

Within that history it separates what is shown from what is only reported. A
result is shown when its output is visible, such as a test run or a diff. It is
reported when an agent, a subagent, or a summary asserts it without that
output. The agent's own closing summary is treated as a report.

## Examples

Invoke `$debrief` in Codex or `/debrief` in Claude Code. Natural language works
too:

> I stepped away. What happened while I was gone?

For a session where you asked for a bug fix and left, a useful answer says that
the fix is committed locally and not pushed, names the one decision the agent
made without you, notes that the tests are shown passing while a subagent's
claim about other callers is only reported, and ends with the one question
still waiting on you.

## Installation and validation

The generated standalone payload is
[`skills/debrief`](https://github.com/tkstang/skills/tree/main/skills/debrief).
It has no runtime or package dependencies.

Static packaging proves that the metadata and complete payload are valid. For a
behavior check, try a long autonomous stretch, an interval where nothing
happened, and a session with an old unanswered question. Confirm that the
account is short, separates shown results from reports, and surfaces the open
question. Fresh provider discovery and useful invocation remain separate live
evidence.

## Limitations

- The skill reports; it does not modify files, run checks, or resume work.
- It cannot see changes made outside the session, such as a pull request merged
  by someone else.
- When compaction prevents finding the interval boundary, it says so and
  covers only the history still visible, treating summary claims as reported.
- In a resumed or forked session with no earlier message of yours, it says no
  boundary exists and covers the inherited history that is visible.
- It lists open questions but does not recommend answers.
