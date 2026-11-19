---
name: kim
description: 'Use when the user tells the agent to "kim" or "keep it moving", optionally with decisions such as "kim high" or "kim B2", to continue the current work. Moves everything that does not need the user, stops only on real blockers, explains each in plain terms with a confidence-rated recommendation, carries open blockers forward, and holds irreversible or outward-facing actions for confirmation. Not for status, recaps, or advice without action.'
license: MIT
compatibility: Agent Skills baseline; instruction-only, with no runtime or package dependencies.
user-invocable: true
metadata:
  author: Thomas Stang
  version: '1.0.0'
---

# Keep it moving

Continue the current work. Move everything that does not need the user, stop
only the threads that do, and say plainly what is moving and what is waiting.

kim continues work already in scope and grants no new authority. It does not
widen scope, settle a decision the user has not made, or take an irreversible
or outward-facing action without the confirmation described under Held actions.

Run kim only when the user invokes it: an explicit invocation, a message that
starts with "kim" as an instruction, or a direct "keep it moving". A question
about kim, or Kim as a person's name, is not an invocation. Never invoke it
yourself. Each invocation is one run: its argument applies to that run only.
Afterwards only the blocker list carries forward, and an ordinary later request
does not apply a level from an earlier kim.

## Step 1: Establish what is in play

Use the work currently underway: the user's latest corrections, accepted
decisions, existing authorization, and established workstreams such as tasks,
subagents, background jobs, branches, and pull requests. Read only what you need
to act; kim is not a status report. Work the user paused, cancelled, or replaced
stays stopped unless the argument names it.

Recover the open blocker list from earlier messages in this session. On the
first kim run in a session, also collect every question or approval request
still unanswered anywhere in the visible session, test each with Step 3, and
label the real ones. Say which of the others you are now deciding yourself.

If there is no unfinished in-scope goal and no open blocker the argument
addresses, say so and ask what to work on. Do not invent work.

## Step 2: Read the argument

Anything after `kim` is a decision on open blockers or steering for this run:

| Argument                                    | Meaning                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| none                                        | Move what can move. Blockers stay open.                                          |
| `high`, `very high`, "high confidence recs" | Apply recommendations rated at or above that level. `high` includes `very high`. |
| `B2`, `B2 B4`                               | Apply each named blocker's recommendation, or confirm its held action.           |
| `B1 option C`                               | Apply that option instead of the recommendation.                                 |
| `confirm`                                   | Confirm exactly the held list last shown.                                        |
| free-form, such as "but skip X"             | Steer or limit this run.                                                         |

Resolve the argument against blockers as last shown to the user:

- A level covers only recommendations the user has seen with that rating and
  that still fit the authorized scope. A blocker that is new this run, or whose
  recommendation or rating has changed since it was shown, is not covered:
  brief it and leave it open. A recommendation that widens scope stays open
  for the user to name.
- A level skips blockers that need something only the user can supply.
- Read a blocker and its option together. If the option does not exist, leave
  that blocker open and list its options; never fall back to the
  recommendation.
- `high` and `very high` are levels only when they refer to recommendations or
  confidence. When an argument could be steering or a decision, treat it as
  steering and say how to approve.
- A bare "yes" answers only the last question you asked.
- If a selection's meaning cannot be recovered, for example after compaction,
  ask about that blocker and keep moving the rest. Do not guess.

State the result in one line before acting, for example: "Applying B2 and B4
(high). B3 stays open (medium)." Applying a decision closes the blocker, except
that an irreversible action is held first and a missing prerequisite stays open
until it is actually satisfied.

## Step 3: Sort the work

Before treating anything as a blocker, name what actually prevents it and the
evidence. When that is an instruction, approval boundary, or enforced gate, name
its source; your interpretation of a rule is not the rule. These are real
blockers:

- a decision that changes the goal, scope, or approach in a way the user has
  not settled;
- credentials, access, or information only the user has;
- an irreversible or outward-facing action not yet confirmed (see Held
  actions);
- a failed gate or contradicting evidence whose resolution changes direction;
- conflicting instructions or a genuinely unclear goal.

These are not: a routine choice with a sensible, cheaply reversible default; a
failure you can fix within scope; a flaky check, which you rerun once (a second
failure is real); a question the user already answered. Never bypass or weaken
a gate, hook, or required review, and never reopen a decision the user made.

Then sort the work. Make routine choices and report any the user may want to
revisit. Move everything else that is not blocked. Split partly blocked work:
continue the parts that are useful whichever option wins, and do not start work
that only one option needs.

## Step 4: Say what is moving, then move

Before starting the work, state the position in a short block:

> **Still blocked on:** B1 <short name>, B3 <short name>. Options at the end.
> **Since you said keep it moving, I'm going ahead with:** X, Y, Z.
> **On hold until you decide:** <work the blockers hold up>.

With no blockers, one line is enough: "Nothing is blocking. Continuing with X."
Then work until everything is finished or everything left is blocked. When a
new blocker appears, add it to the list and keep moving the rest.

## Blockers

Label blockers `B1`, `B2`, and so on, and keep each label until the blocker
closes; never reuse a label in the session. A blocker closes only when the user
decides or dismisses it, its prerequisite is actually satisfied, or you withdraw
it because the evidence changed, saying why. Moving past it, or an unrelated
message, does not close it. Keep the list in the conversation only; do not write
it to a file or tracker. If compaction lost part of it, say so rather than
presenting the rest as complete.

Brief a decision blocker in plain terms, scaled to the decision:

> **B2: <plain-language title>** (new, or open since <when>)
>
> - **Blocked:** <what cannot proceed>; it holds up <dependent work>.
> - **Why it needs you:** <the boundary or decision>.
> - **A, <name>:** <what it means, its benefit and cost, reversibility>.
> - **B, <name>:** …
> - **Recommendation:** B (confidence: high). <Why, and what would change it.>

Define terms the user may not know. Give each option its strongest case and do
not present the recommendation as free. Keep the option letters for the life of
the blocker. Rate each recommendation:

- **very high:** the evidence settles it; only a preference you cannot see
  would change it.
- **high:** strong evidence, with one plausible unknown.
- **medium:** a real trade-off that depends on the user's priorities.
- **low:** an informed guess; the user's view is needed.

Confidence describes whether the recommendation is right, not what it costs if
wrong; state reversibility separately.

A blocker that needs something only the user can supply, such as access, states
exactly what is needed and how you will know it worked. It has no options or
rating. A blocker that only confirms an action already in scope uses its held
entry as its brief.

## Held actions

An action is irreversible or outward-facing when it publishes, releases,
deploys, merges to a shared branch, force-pushes, sends a message to people
outside this session, spends money, or deletes something that cannot be
restored from this session or version control. Steps the authorized work has
already been taking, such as committing or pushing to its own working branch,
are not held.

Hold such an action until the user has seen what it does and how it is
irreversible, in its brief or a held list, and then names it or replies
`kim confirm`. If it was never shown, naming it or a level only adds it to the
held list:

> **B3: merge PR #170 to main** (very high). Irreversible because other branches
> and CI pick it up at once; undoing it takes a revert PR. Reply `kim B3`.

Confirmation covers exactly what was shown; if an action changes materially
before it runs, show it again. Approval the user already gave for that exact
action counts. Standing instructions that require confirmation still apply.

## Close the run

End every run with one report, even if the Step 4 block went out earlier,
because an early message may be collapsed. List each blocker once, in this
order:

1. What moved, keeping shown results distinct from reported ones.
2. Choices you made that the user may want to revisit.
3. Held actions.
4. Open blockers: a full brief for each one that is new or changed, and one line
   for the others, such as "B1 export removal: A remove / B deprecate;
   recommend B (medium)".
5. One last line. When everything left is blocked: "I can't keep it moving
   without a decision on <the blocker | one of the blockers>. My recommendation
   to unblock us is B2, <option> (confidence: very high). Go ahead with that?"
   Lead with the recommendation you are most confident in and break ties by how
   much work it unblocks; if it is irreversible, say how in the question.
   Otherwise, "Waiting on you: <labels>", or "Nothing is waiting on you."

At any later stop in this session while blockers remain open, end with steps 4
and 5 the same way.

## Boundaries

kim applies its tests inline and invokes no other skill. Nearby requests are
different: a status snapshot such as `sitrep`, a look back such as
`debrief`, a recommendation without action such as
`next-steps`, one pending decision explained without acting such as
`explain-options`, or a disputed stop examined in depth such as
`must-we`, when installed. A plain "continue" is an ordinary request.

## Examples

- Codex: `$kim`, `$kim high`
- Claude Code standalone: `/kim`, `/kim B2`
- Claude Code Session plugin: `/session:kim`, `/session:kim B1 option A`
- Natural language: "kim", "kim high confidence recs", "keep it moving, but
  skip the docs for now"

For a hypothetical run with one blocker:

> **Still blocked on:** B1, whether the old parser export is public API.
> Options at the end.
> **Since you said keep it moving, I'm going ahead with:** converting the
> remaining CSV adapters and their tests.
> **On hold until you decide:** removing the old parser.
>
> … work …
>
> Converted the last three adapters; their tests are shown passing. I named the
> new helper `parseRow` to match the existing module.
>
> **B1: Is the old parser export public?** (new)
>
> - **Blocked:** deleting `legacyParse`; it holds up phase 4.
> - **Why it needs you:** removing a public export breaks outside callers, and
>   only you know whether any exist.
> - **A, remove now:** simpler code, but any outside caller breaks and
>   restoring it needs a new release.
> - **B, deprecate first:** no breakage, but the old code lives one more
>   release.
> - **Recommendation:** B (confidence: medium). It is safe either way; if you
>   know nothing outside uses it, choose A.
>
> I can't keep it moving without a decision on the blocker. My recommendation
> to unblock us is B1, deprecate first (confidence: medium). Go ahead with that?
