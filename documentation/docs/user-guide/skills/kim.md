---
title: 'Kim'
description: 'Keep it moving: continue the current work, stop only on real blockers, explain them with confidence-rated recommendations, and hold irreversible actions for confirmation.'
---

# Kim

`kim` (keep it moving) tells the agent to continue the current work. It
moves everything that does not need you and stops only the work that does. It
says plainly what is moving and what is waiting, and keeps open blockers on a
list until you resolve them. It is instruction-only, available standalone or as
Session `kim`. Unlike the other Session skills, which report or recommend, kim
acts.

kim continues work already in scope. It grants no new authority: it does not
widen scope, decide what you have not decided, or take an irreversible or
outward-facing action without your confirmation.

## When to use it

Use it at a stopping point when you want the work to continue, such as after a
sitrep, a debrief, or the end of a turn. Invoke it explicitly, start a message
with "kim", or say "keep it moving". The agent does not invoke it on its own,
and a plain "continue" stays an ordinary request.

Add decisions on open blockers after `kim`:

| You say                                  | The agent                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `kim`                                    | Moves everything it can; blockers stay open.                             |
| `kim high` or "kim high confidence recs" | Applies every recommendation rated high or very high, then keeps moving. |
| `kim very high`                          | Applies only very-high recommendations.                                  |
| `kim B2`                                 | Applies the recommendation for blocker B2.                               |
| `kim B1 option C`                        | Applies the option you chose for B1.                                     |
| `kim confirm`                            | Confirms the held list of irreversible actions.                          |
| "kim, but skip the docs"                 | Takes the steering for this run.                                         |

Before acting, it states in one line what the argument resolved to, such as
"Applying B2 and B4 (high). B3 stays open (medium)."

## What you get

1. **What is moving and what is not**, before the work starts: "Still blocked
   on B1 and B3. Since you said keep it moving, I'm going ahead with X, Y, Z."
2. **The work itself.** Partly blocked work is split, and the parts that do not
   depend on the decision keep moving.
3. **A plain-language brief for each blocker**: what is blocked and what it
   holds up, why it needs you, the options with their trade-offs and
   reversibility, and a recommendation rated low, medium, high, or very high.
4. **Held actions.** Merges, publishing, external messages, deletions, and
   other irreversible or outward-facing steps are listed with what makes each
   irreversible, and run only after you confirm them by name or with
   `kim confirm`. A bulk approval such as `kim high` never runs them directly.
5. **A short report**: what moved, choices made without you, the open blocker
   list, and what is waiting on you.

When everything left is blocked, it says so: "I can't keep it moving without a
decision on one of the blockers. My recommendation to unblock us is B2 …" It
leads with the recommendation it is most confident in.

Before stopping on anything, the agent checks whether it is a real blocker,
using the same tests as [Must We?](must-we.md). A choice with a sensible,
cheaply reversible default does not stop the work; an unsettled change of
direction, missing access, or an unconfirmed irreversible action does.

## Blockers carry forward

Blockers keep their labels (`B1`, `B2`, …) until you decide, dismiss, or the
agent withdraws one because the evidence changed. Moving past a blocker or
sending an unrelated message does not close it. Every later stop in the session
repeats the open list, so you can address blockers whenever suits you. The list
lives in the conversation, not in a file; if compaction loses it, the agent says
so.

## Related skills

[Sitrep](sitrep.md), [Debrief](debrief.md), and [Next Steps](next-steps.md)
report or recommend without acting; kim pairs with them when you are ready to
continue. [Explain Options](explain-options.md) explains one pending decision
without acting, and [Must We?](must-we.md) evaluates a disputed stop in depth.
kim applies their tests inline and does not invoke them.

## Examples

For a standalone install, invoke `$kim` in Codex or `/kim` in Claude Code. The
Claude Code Session member is `/session:kim`. Natural language works too:

> kim

> kim high confidence recs

> Keep it moving, but leave the migration for now.

## Installation and validation

Choose standalone `kim` or the Session member `kim` through the
[installation guide](../installation.md). Both forms share one canonical owner
and version. The generated standalone payload is
[`skills/kim`](https://github.com/tkstang/skills/tree/main/skills/kim). It has
no runtime or package dependencies.

Static packaging proves that the metadata and payload are valid. For a behavior
check, try a run with no blockers, one where a choice looks like a blocker but
has a cheap default, partly blocked work, everything blocked, `kim high` with an
irreversible step in the set, and a later stop that must repeat an older
blocker. Fresh provider discovery and useful live behavior remain separate
evidence.

## Limitations

- It continues existing work; it does not start new work or widen scope.
- It never bypasses a gate, hook, or required review.
- The blocker list lives only in the conversation.
