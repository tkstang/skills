---
name: debrief
description: Use when the user returns to a session and wants a concise account of what happened while they were away, including what changed, what was decided, what is shown versus only reported, and what is waiting on them. Looks back; it does not recommend or execute next actions.
license: MIT
compatibility: Agent Skills baseline; instruction-only, with no runtime or package dependencies.
user-invocable: true
metadata:
  author: Thomas Stang
  version: '1.0.1'
---

# Explain what happened

Turn the session's recent history into a short account the user can act on. Report
what the work produced and what it left open instead of replaying the transcript in
order. This skill looks back; it does not recommend or execute what comes next.

## Find the interval

By default, cover what happened after the user's most recent message and before
this request. The request itself is outside the interval, and an earlier debrief
request is an ordinary user message that can be the boundary.

Only messages the user wrote count as a boundary. Task and subagent notifications,
hook output, scheduled wakeups, system reminders, tool results, and messages from
other agents are not user messages, even when the host places them in the user
role. A user message that quotes or mentions such content is still a user message.

Use an explicit scope when one is supplied, such as the whole session, a named
topic, or everything since a stated event.

If no earlier activity is visible, say that there is no session history to report.
A resumed or forked session can carry inherited history before its first user
message. When history is visible but no earlier user message marks a boundary, say
so and cover the visible history.

If earlier history was compacted or summarized so that the boundary cannot be
found, say so and cover only what is still visible. Treat a compaction summary as a
report, not as evidence of what happened.

## Work from the session history

Use only the conversation and session history already visible. Do not run commands,
read files, query services, or gather fresh state, and do not describe the current
state of anything beyond the last visible event. If something may have changed
outside the session, say that it would need checking instead of guessing.

Keep what the history shows separate from what it only reports. A result is shown
when its output is visible, such as a test run, a command result, or a diff. It is
reported when an agent, a subagent, or a summary asserts it without that output.
Do not assume the agent's own closing summary is accurate, and do not upgrade a
report to a confirmed result.

## Explain what happened

Open with one or two sentences on what the work was trying to accomplish and where
it stood at the last visible event. Then cover the following, omitting any that
have nothing to report:

- What changed: files, commits, branches, pull requests, messages sent, and other
  effects outside the conversation. Keep full URLs and identifiers.
- What was decided and by whom. Call out decisions the agent made without the user.
- What went wrong or was unexpected. Include a dead end only when it explains the
  current state.
- What is still running or unfinished.
- A brief assessment, marked as such: what looks sound and what remains unverified
  or risky. Describe confidence in the result; do not turn it into advice.

Then look across the whole visible session, not only the interval, for questions
and approval requests addressed to the user that remain unanswered. A later
unrelated message sets the interval boundary but does not close an earlier
question. Judge each by its latest visible disposition. It is closed when a later
user reply chooses an option, declines, grants or denies the approval, or otherwise
addresses it directly, and also when the agent withdrew it or replaced it with a
newer question. If the agent went ahead without an answer, report that as a
decision made without the user. If missing history leaves the status unclear, say
it is unknown instead of saying it is waiting. List each open one once with enough
context to answer it: what is being asked, why it matters, and the options. Do not
walk the user through them or recommend an answer.

Finish with one line saying what is waiting on the user, or that nothing is. When
work remains open, add that the user can ask what to do next, or use
`next-steps` when it is installed. Do not invoke it. Omit that pointer
when the work is finished and nothing is waiting.

Keep the account short and scale it to the interval. Prefer a few sentences and a
small list in plain outcome language over a chronology, a command log, or a list of
every tool call. If nothing happened in the interval and no question is open, say
so in one sentence. If nothing happened but an earlier question is still open,
report that question instead.

## Examples

- Codex: `$debrief`
- Claude Code standalone: `/debrief`
- Claude Code Session plugin: `/session:debrief`
- Natural language: "I stepped away. What happened while I was gone?"
- Natural language: "Debrief me on the whole session, not just the last stretch."

For a hypothetical session where the user asked for a bug fix and left:

> You asked me to fix the empty-input crash in the importer. That fix is committed
> on the feature branch and nothing has been pushed.
>
> - **Changed:** `importer.ts` now rejects empty input, with one new regression
>   test. Both are in a single local commit.
> - **Decided without you:** I returned an error for empty input instead of
>   treating it as an empty result, because two callers already expect an error.
> - **Shown versus reported:** the importer's own tests pass, with the run visible
>   above. The review subagent reported no other callers are affected; its search
>   output is not in the session.
> - **Assessment:** the fix is small and its tests are shown passing. Its effect
>   on other callers remains unverified.
>
> One question from earlier is still open: whether this should go out as its own
> pull request or ride with the importer refactor. A separate one ships the fix
> sooner; combining them means one review.
>
> That question is the only thing waiting on you. Ask what to do next if you want a
> recommendation.

A request to continue the work is an execution request, not an invocation of this
skill. A request for a recommendation belongs to a forward-looking answer, and a
request to review how the session went belongs to a retrospective.
