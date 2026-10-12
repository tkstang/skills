---
title: 'Sitrep'
description: 'Get a snapshot of where the current work stands against its goal: complete, in progress, remaining, at risk, and waiting on you.'
---

# Sitrep

`sitrep` is a standalone, instruction-only skill for the moment when you look in
on a long-running session and want to know where everything stands. It measures
the current work against its goal and reports what is complete, what is in
progress, what remains, and what is at risk or waiting on you.

It describes the present. [Debrief](debrief.md) covers what happened over an
interval, and [Next Steps](next-steps.md) recommends what to do. Neither is
required, and `sitrep` never invokes them.

## What it covers

The report covers the goal the session is working toward and the workstreams
already established for it, such as subagents, background jobs, branches, and
pull requests. "Everything" means that scope, not every repository or process.
Name a topic to narrow it. When no goal is established, the skill asks what to
cover instead of surveying the repository.

A useful report includes, where each applies:

- the goal and the overall position;
- what is complete, and the basis for saying so;
- what is running now and when it was last observed;
- what remains, limited to commitments already agreed;
- what is at risk, including work that exists only in the session or the
  working tree;
- questions still waiting on you from anywhere in the visible session; and
- what could not be checked.

It does not invent a plan, a task breakdown, or a percentage, and it does not
prioritise or add to the remaining work.

## What it reads

The skill starts from the session history. Where a material gap remains, it
reads only the tracking artifacts and running work the session already uses or
that you name:

- the plan, task list, or project record the work is following;
- `git status` and a short log for the working branch; and
- the state of a known background job, subagent, or pull request check.

It does not survey the repository, run tests or builds, query unrelated
services, or update a tracker. A source it cannot find within that boundary is
reported as a gap.

Evidence is judged claim by claim. A checked box shows that the tracker marks an
item complete, not that it is complete. Committed is not verified. When two
sources disagree, both are shown.

## Running work

A status request does not pause or redirect the work. After reporting, the agent
continues previously authorised active work when the host permits it. Whether a
request interrupts or queues behind a running turn is decided by the host, so
the report is a snapshot taken while answering, not a live view. The skill never
restarts paused or completed work.

## Examples

Invoke `$sitrep` in Codex or `/sitrep` in Claude Code, optionally naming a
topic. Natural language works too:

> Where are we on this? What's done and what's left?

For a session executing a four-phase plan, a useful answer says that two phases
are complete with tests shown passing, the third is running in a subagent last
observed ten minutes ago, the fourth remains and depends on the third, one
benchmark the plan marks as done has no visible run, and one question from
earlier is still waiting on you.

## Installation and validation

The generated standalone payload is
[`skills/sitrep`](https://github.com/tkstang/skills/tree/main/skills/sitrep).
It has no runtime or package dependencies.

Static packaging proves that the metadata and complete payload are valid. For a
behavior check, try a session in the middle of a plan, one with a tracker that
disagrees with the visible results, and one with no established goal. Confirm
that the report stays within the established scope, separates shown results
from tracker claims, and does not recommend actions. Fresh provider discovery
and useful invocation remain separate live evidence.

## Limitations

- The skill reports; it does not modify files, run checks, or update trackers.
- It reads only sources the session already uses, so it is not a repository
  audit or a reconciliation of project records.
- It cannot guarantee that work continues after the report; that depends on the
  host.
- It lists what remains but does not recommend an order or an answer.
