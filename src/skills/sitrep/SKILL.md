---
name: sitrep
description: Use when the user asks where the current work stands against its goal or plan, including what is complete, in progress, remaining, at risk, or awaiting a decision. Reports progress across the established scope; it does not recap an interval or recommend next actions.
license: MIT
compatibility: Agent Skills baseline; instruction-only, with no runtime or package dependencies.
user-invocable: true
metadata:
  author: Thomas Stang
  version: '1.0.0'
---

# Report where the work stands

Give the user a snapshot of the current work measured against its goal: what is
complete, what is in progress, what remains, and what is at risk or waiting on
them. This skill describes the present. It does not recount what happened over an
interval, recommend what to do, or change anything.

## Establish the scope

Use an explicit topic when one is supplied. Otherwise report on the goal the
session is working toward, including the user's latest corrections, and the
workstreams already established for it, such as subagents, background jobs,
branches, and pull requests. "Everything" means that scope, not every repository,
process, or possible task.

If neither an explicit scope nor an established goal is available, ask what the
report should cover instead of surveying the repository for one. For named ad-hoc
work, report against its existing commitments without inventing an overarching
goal. Describe progress in the terms the work already uses. Do not invent a plan,
a task breakdown, or a percentage when none exists.

## Gather the evidence

Start with the session history already visible. Then inspect, read-only, the
sources this session already uses or that the user names, reading what the report
needs and no more:

- git state for the repositories, branches, and worktrees the work is on, using
  any read-only git command, such as status, log, diff, branch and worktree
  listings, stash list, and ahead or behind counts;
- the plan, task list, or project record the work is following;
- the state of a known background job, subagent, or pull request check.

Keep git strictly read-only. Do not fetch, pull, or run a command that writes to
the working tree, the index, or refs, and say that a comparison with a remote
reflects the last fetch. Pass `--no-optional-locks` to git, as in
`git --no-optional-locks status`, so that a check cannot block a commit another
agent is making at the same moment.

Do not discover a project framework, survey the repository, run tests or builds,
start a review, query unrelated services, or update or repair a tracker. If a
source cannot be found within that boundary, report the gap instead of widening
the search.

Judge evidence claim by claim:

- A result is shown when its output is visible in the session or in what was just
  read. It is reported when an agent, a subagent, a summary, or a tracker asserts
  it without that output.
- A checked box shows that the tracker marks the item complete, not that it is
  complete. Committed is not verified, and a test result supports only what that
  test checked.
- When two sources disagree, show both instead of choosing one.
- For running work, say when its state was last observed. The report is a snapshot
  taken while answering, not a live view.

## Report the status

Open with one or two sentences naming the goal, where it came from when that is
not obvious, and the overall position. Then cover the following in this order,
omitting any that have nothing to report:

- **Complete:** what is done, with the basis for saying so.
- **In progress:** what is running now, what is running it, and when it was last
  observed.
- **Remaining:** commitments or acceptance criteria already agreed and not yet
  met. Report dependencies the plan records. Do not prioritize, add tasks, or
  resolve open choices.
- **At risk:** anything failing, stale, unverified, or contradicted by another
  source. Include work that exists only in the session or the working tree, such
  as uncommitted changes, unpushed commits, or a decision recorded nowhere, when
  the evidence shows it.
- **Waiting on the user:** questions and approval requests relevant to the
  selected scope, searched across the whole visible session and judged by their
  latest visible disposition. One is closed when the user answered it or the agent
  withdrew or replaced it. If the agent went ahead without an answer, distinguish
  an optional choice made under existing authorization from a required decision or
  approval that was bypassed, and report the latter as a risk. If missing history
  leaves the status unclear, say it is unknown. Keep an actual question separate
  from a risk you inferred, and do not manufacture an approval request.
- **Not checked:** sources that could not be read or that fall outside the
  boundary.

Put what contradicts the expected picture first within each group. Keep the report
short: when a group is long, name the few items that matter and count the rest.
Use plain outcome language instead of a command log or a copy of the tracker.

Finish with one line on the overall position. When work remains, add that the user
can ask what to do next, or use `{{skill:next-steps}}` when it is installed. Do not
invoke it.

## After reporting

A status request does not pause, stop, or redirect the work unless the user also
says so. After reporting, continue previously authorized work that was active when
the host permits it, and put the report before any further work. Do not start,
restart, or resume paused or completed work only because this skill was invoked.
If the turn ends or the work cannot continue, say so instead of implying that it
is still running.

## Examples

- Codex: `$sitrep`
- Claude Code: `/sitrep`
- Natural language: "Where are we on this? What's done and what's left?"
- Natural language: "Give me a status on the migration work only."

For a hypothetical session executing a four-phase plan:

> We are migrating the importer to the new parser, following the plan in
> `docs/importer-plan.md`. Phases 1 and 2 of four are reported complete and the
> third is running.
>
> - **Complete:** phases 1 and 2, as reported. Their commits are on the feature
>   branch and the importer tests are shown passing after phase 2. The phase 2
>   benchmark is unverified.
> - **In progress:** phase 3, the CSV adapter, in a background subagent. Last
>   observed ten minutes ago, with two of five files converted.
> - **Remaining:** phase 4, removing the old parser, which the plan makes
>   dependent on phase 3.
> - **At risk:** the plan marks the phase 2 benchmark as done, but no benchmark run
>   is visible in the session. Three commits are unpushed.
> - **Waiting on you:** whether the old parser's public export can be removed in
>   phase 4. Asked before phase 2 and not answered.
> - **Not checked:** the pull request's CI, which has not run since phase 1.
>
> Overall: on plan, with one unverified claim and one open question. Ask what to do
> next if you want a recommendation.

A request for what happened while the user was away belongs to a look back over
that interval. A request for a recommendation belongs to a forward-looking answer.
A request to audit a whole repository or reconcile its records is a larger task
than this report.
