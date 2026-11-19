---
name: kim
description: 'Use when the user says "kim" or "keep it moving", optionally with decisions such as "kim high" or "kim B2", to continue the current work. Moves everything that does not need the user, stops only on real blockers, explains each in plain terms with a confidence-rated recommendation, carries open blockers forward, and holds irreversible or outward-facing actions for confirmation. Not for status, recaps, or advice without action.'
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
kim continues work already in scope. It grants no new authority: it does not
widen scope, settle a decision the user has not made, or approve an
irreversible or outward-facing action except through the confirmation in
Step 5.

## Step 1: Establish what is in play

Use the work currently underway, including the user's latest corrections,
accepted decisions, existing authorization, and established workstreams such
as tasks, subagents, background jobs, branches, and pull requests. Read only
what you need to act; kim is not a status report.

Recover the open blocker list from the most recent kim run or stop in this
session, then apply what the user has said since. If nothing is in progress,
say so and ask what to work on. Do not invent work.

## Step 2: Read the argument

Anything after `kim` is a decision on open blockers or steering for this run:

| Argument                                    | Meaning                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| none                                        | Move what can move. Blockers stay open.                                               |
| `high`, `very high`, "high confidence recs" | Apply every recommendation rated at or above that level. `high` includes `very high`. |
| `B2`, `B2 B4`                               | Apply the recommendation for each named blocker.                                      |
| `B1 option C`                               | Apply that option instead of the recommendation.                                      |
| `confirm`, or "yes" to a held list          | Confirm exactly the held list from Step 5.                                            |
| free-form, such as "but skip X"             | Steer or limit this run.                                                              |

Resolve the argument to specific blockers and state the result in one line
before acting, for example: "Applying B2 and B4 (high). B3 stays open
(medium)." If part of the argument does not resolve, such as an unknown label
or no blockers at that level, say so and continue without it. Do not guess
which irreversible action an ambiguous argument meant. Applying a decision
closes that blocker, except that irreversible or outward-facing actions go
through Step 5.

## Step 3: Sort the work

Sort each remaining piece of work:

- **Moves:** within existing scope and authorization. Make routine choices
  that have a sensible default and are cheap to reverse, and report the
  consequential ones as decided without the user.
- **Blocked:** needs the user. Check it before stopping (below).
- **Partly blocked:** split it. Move the parts whose value does not depend on
  how the blocker is decided, or that are cheap to redo whichever option wins.
  Stop where the work depends on the decision. Do not build work the likely
  answer would throw away.

Before treating anything as a blocker, test it:

- What exactly cannot proceed, and what evidence says so?
- Is it required for the requested outcome, or an optional improvement or
  implementation choice you can make?
- Does an instruction, approval boundary, or enforced gate actually prevent
  proceeding? Name its source; your interpretation of a rule is not the rule.
- If you choose and are wrong, what does it cost to redo?

These are real blockers:

- a decision that changes the goal, scope, or approach in a way the user has
  not settled;
- credentials, access, or information only the user has;
- an irreversible or outward-facing action not yet confirmed, such as a merge,
  publish, deploy, release, external message, deletion, force-push, or spend;
- a failed gate or contradicting evidence whose resolution changes direction;
- conflicting instructions or a genuinely unclear goal.

These are not: a choice with a sensible, cheaply reversible default; a
preference you can pick and report; a flaky check you can rerun; a question the
user already answered. Never bypass or weaken a gate, hook, or required review,
and never reopen a decision the user already made.

## Step 4: Say what is moving, then move

Before starting the work, state the position in a short block:

> **Still blocked on:** B1 <short name>, B3 <short name>. Options below.
> **Since you said keep it moving, I'm going ahead with:** X, Y, Z.
> **On hold until you decide:** <work the blockers hold up>.

With no blockers, one line is enough: "Nothing is blocking. Continuing with X."
Then do the work until it is finished or everything left is blocked. When a new
blocker appears mid-run, add it to the list and keep moving the rest.

## Step 5: Hold irreversible and outward-facing actions

Do not take an irreversible or outward-facing action on a bulk approval such as
`kim high`. Hold it and list it with what makes it irreversible:

> **Held for your confirmation:**
>
> - **B3: merge PR #170 to main** (very high). Irreversible because other
>   branches and CI pick it up at once; undoing it takes a revert PR.
>
> Reply `kim confirm` for the whole list, or name items, such as `kim B3`.

An action may proceed only when the user names it or confirms a list after you
have shown its irreversibility for that action. Confirmation covers exactly
what was listed; if an item changes materially before it runs, list it again.
Approval the user already gave for that exact action in this session counts.
Standing instructions that require confirmation still apply.

## Step 6: Explain each blocker in plain terms

Give each open blocker a short brief, scaled to the decision:

> **B2: <plain-language title>** (new, or open since <when>)
>
> - **Blocked:** <what cannot proceed>; it holds up <dependent work>.
> - **Why it needs you:** <the boundary or decision>.
> - **Options:** <A>: <what it means, its benefit and cost, reversibility>.
>   <B>: …
> - **Recommendation:** <option> (confidence: high). <Why, and what would
>   change it.>

Use plain words and define terms the user may not know. Give each option its
strongest case and do not present the recommendation as free. Rate each
recommendation on this scale:

- **very high:** the evidence settles it; only a preference you cannot see
  would change it.
- **high:** strong evidence, with one plausible unknown.
- **medium:** a real trade-off that depends on the user's priorities.
- **low:** an informed guess; the user's view is needed.

Confidence describes whether the recommendation is right, not what it costs if
wrong. State reversibility separately.

## Step 7: Carry blockers forward

Label blockers `B1`, `B2`, and so on, and keep each label until the blocker is
resolved; never reuse a label in the session. A blocker closes only when the
user decides it, dismisses it, or you withdraw it because the evidence changed,
saying why. An unrelated message, or moving past it, does not close it.

End this run, and every later stop in the session while blockers remain open,
with the full open list: new blockers marked, older ones with their labels.
Give the full brief for a blocker when it is new or has changed, and one line
otherwise. If earlier history was compacted and the list cannot be recovered,
say so instead of presenting a partial list as complete.

## Step 8: When nothing can move

When everything left is blocked, stop and say so:

> I can't keep it moving without a decision on <the blocker | one of the
> blockers>. My recommendation to unblock us is **B2: <option>** (confidence:
> very high), because <one line>. Want me to go ahead with that?

Lead with the recommendation you are most confident in; break ties by how much
work it unblocks. List the remaining blockers after it. Do not choose for the
user.

## Report

Finish the turn with a short report, even if you sent the Step 4 block earlier,
because an early message may be collapsed:

- what moved, keeping shown results distinct from reported ones;
- choices you made without the user that they may want to revisit;
- the open blocker list (Step 7) and any held actions (Step 5);
- one line on what is waiting on the user, or that nothing is.

## Boundaries

- A status snapshot without action is `{{skill:sitrep}}`, a look back is
  `{{skill:debrief}}`, and a recommendation without action is
  `{{skill:next-steps}}`.
- Explaining one pending decision without acting is `{{skill:explain-options}}`;
  disputing a stop in depth is `{{skill:must-we}}`. kim applies their tests
  inline and does not invoke them.
- A plain "continue" without kim or "keep it moving" is an ordinary request,
  not this skill.

## Examples

- Codex: `$kim`, `$kim high`
- Claude Code standalone: `/kim`, `/kim B2`
- Claude Code Session plugin: `/session:kim`, `/session:kim B1 option C`
- Natural language: "kim", "kim high confidence recs", "keep it moving, but
  skip the docs for now"

For a hypothetical run with one blocker:

> **Still blocked on:** B1, whether the old parser export is public API.
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
> - **Options:** **Remove it** now: simpler code, but any outside caller breaks,
>   and restoring it needs a new release. **Deprecate it** first: no breakage,
>   but the old code lives one more release.
> - **Recommendation:** deprecate (confidence: medium). It is safe either way;
>   if you know nothing outside uses it, remove it.
>
> Waiting on you: B1 only.
