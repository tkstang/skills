---
title: 'Reorient'
description: 'Rebuild the big picture of a long or compacted thread from its full transcript, check what changed since, and get a recommendation.'
---

# Reorient

`reorient` is for coming back to a thread you have lost track of. You may have
been away for a day, or the thread may have compacted several times and gone
down side paths until nobody remembers why it started. That applies to the agent
as much as to you, so the agent can invoke it on itself.

It is generated as the standalone `reorient` skill and as `reorient` in the
Session plugin. Both forms share one canonical owner and version.

## How it differs from nearby skills

| Skill                       | Covers                                     | Reads                                                 | Recommends     |
| --------------------------- | ------------------------------------------ | ----------------------------------------------------- | -------------- |
| [Debrief](debrief.md)       | Since your last message                    | Visible session history only                          | No             |
| [Sitrep](sitrep.md)         | Progress against the goal, now             | Session plus the artifacts it already uses, read-only | No             |
| [Next Steps](next-steps.md) | The next action and why                    | The conversation, plus sources to resolve gaps        | Yes            |
| **Reorient**                | The whole thread, assuming time has passed | The full transcript, plus read-only git and PR state  | Yes, then asks |

Use Debrief for a short absence and Reorient when you have lost the big picture.

## What it does

1. **Recovers the whole thread.** After compaction, the agent's context holds
   only a summary of earlier turns, but the transcript on disk still has them.
   Reorient exports the current session with
   [Session Export Transcript](session-export-transcript.md) to a private
   temporary directory. Under about 60 KB, the agent reads it directly. Larger
   exports go to one subagent, which returns a structured arc so the main
   context stays free. The export is deleted afterwards unless you ask to keep
   it.
2. **Checks what changed since.** It looks, read-only, at the git state of the
   branches the thread worked on and at the pull requests it opened, and flags
   anything that no longer matches what the thread last said. It does not fetch,
   run tests, or survey the repository.
3. **Reorients.** It reports the arc (the original goal, then each scope change
   or side quest with its status), the recent exchanges, where the work stands,
   questions still waiting on you, and the recommended next action.
4. **Recommends, then asks.** When you invoke it, it asks before acting on the
   recommendation. When the agent invokes it on itself during work you already
   authorized, it states the corrected understanding and carries on.

The report closes with a short status block:

- **Goal:** the current intended outcome.
- **Done:** what the latest stretch of work completed, when anything.
- **Now:** where things stand: finished, running, blocked, or unverified.
- **Next:** the immediate action and who takes it, when anything remains.
- **Needs you:** what is required from you, or "nothing".

## Shown versus reported

The transcript records what was said, not what is true now. A compaction summary
is treated as a report about earlier turns. The exporter omits tool results by
default, so a test pass or merge the transcript only mentions counts as reported
unless its output is still visible or the git and PR check confirms it.

## End-of-run status instruction

Reorient's closing block uses the same fields as a standing instruction you can
add to your own agent instructions. With it, every agent that hands back after a
long autonomous run, roughly 20 minutes or more, several steps without your
input, or delegated work, ends with that block. Reading it when you return often
saves a full reorientation.

The versioned text ships with the skill as
[`references/end-of-run-status.md`](https://github.com/tkstang/skills/blob/main/skills/reorient/references/end-of-run-status.md),
along with the reasons for its shape. To adopt it, copy the instruction into
your user-level instructions: the user `CLAUDE.md` for Claude Code, the user
`AGENTS.md` for Codex, and User Rules in Cursor's settings. A user `.mdc` rule
with `alwaysApply: true` also works in Cursor, but only for projects inside your
home directory. Reorient does not install it or prompt you to.

## Examples

Invoke `$reorient` in Codex or `/reorient` in Claude Code. Natural language
works too:

> I've been away for a day. Where were we and what was the point of all this?

> We've gone down a few side paths. Reorient us on the original goal.

## Installation and validation

The generated payloads are
[`skills/reorient`](https://github.com/tkstang/skills/tree/main/skills/reorient)
and the Session plugin member `reorient`. The skill is instruction-only. Reading
history past compaction requires Session Export Transcript (standalone
`session-export-transcript`, Session `export-transcript`). Without it, Reorient
says the full history is unavailable and works from the visible context only.

Static packaging proves the metadata and payload are valid. Fresh provider
discovery and a useful live reorientation remain separate evidence.

## Limitations

- It does not execute the recommendation, modify files, or change workflow state.
- Its freshness check covers only the branches and pull requests the thread
  touched, and remote comparisons reflect the last fetch.
- A subagent summary of a large export is itself a report; the main agent keeps
  the recent exchanges from its own context.
