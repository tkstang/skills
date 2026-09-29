---
name: align
description: Use when the user explicitly asks to align on their goals and underlying problems, at the start of work or when an ongoing session or project feels off course.
license: MIT
compatibility: Agent Skills baseline; instruction-only, with no runtime or package dependencies.
disable-model-invocation: true
user-invocable: true
metadata:
  author: thomas.stang
  version: '1.0.0'
---

# Align

Core instruction, expressed as the user's request:

> Restate your understanding of my current goals, the problems I’m trying to solve,
> and what success looks like. If work is already underway, assess whether its
> direction still serves those goals. Identify assumptions and uncertainty, invite
> my assessment, and refine your understanding through focused questions until we
> agree it is sufficient.

Use this skill only when the user explicitly invokes it. Suspected drift alone does
not activate it. It works
at any point in a conversation or project, including after substantial work.

## Step 1: Restate the current intent

Use the supplied topic, or the work currently being discussed. Start with the
conversation, including the user's latest corrections and accepted decisions. Read
only relevant artifacts needed to resolve a material gap. If no topic is established,
ask what to align on; do not search for a project or invent a goal.

In your own words, concisely state:

- the outcome the user wants;
- the underlying problem or problems motivating it;
- what success would look like, including relevant constraints or priorities;
- any assumptions you have added beyond what the user explicitly said.

When work is underway, also explain the direction it has taken and any apparent
divergence from the current goal. Distinguish verified facts, reported progress,
inferences, and unknowns. Completed work does not prove that its direction was right.
Allow for misunderstanding, changed goals, or gradual drift; do not assume which
occurred or defend earlier choices merely because effort was spent on them.

Keep the restatement easy to correct. Do not bury it in a session recap, propose a
solution before understanding the problem, or ask the user to repeat available
context. If the user is still discovering their goals, present a provisional reading
and name what remains undecided.

## Step 2: Explain your confidence

Give a rough confidence score from 0–100 for your understanding, with a brief reason
and the specific gaps that could materially change it. Label it as a subjective
estimate, not a measured probability. Differentiate clear goals from uncertain
details when useful; avoid false precision.

Always expose material uncertainty, even above 90. No score establishes alignment by
itself, and understanding the user's intent does not establish that a proposed
solution will work.

## Step 3: Invite the user's assessment

Before detailed clarification questions, ask:

> How closely does this match your intent, from 0–100? What did I miss or distort?

Wait for the response. Accept corrections or plain-language confirmation without
requiring a numeric score. Treat the user's assessment as their judgment of the
restatement, distinct from your confidence in understanding it. Do not average the
two scores or infer confirmation from silence.

## Step 4: Clarify and revise

Incorporate the feedback before asking anything else. Drop questions already answered
and ask the most useful remaining question, normally one at a time. Focus on gaps
that would change the understood goal, problem, success criteria, or direction.
Use choices when helpful, while allowing the user to answer in their own words.

Make question origins clear with natural labels when applicable:

- “An uncertainty in my initial reading was…” for a gap identified before feedback.
- “Your correction raises another question…” for a gap introduced by the response.

Do not claim a question was prepared earlier unless it was. No hidden question bank,
temporary file, or formal provenance ceremony is required.

After an answer, revise the affected part of the restatement and say what changed.
Update your confidence when it meaningfully changes; do not demand another rating
after every reply. Continue until the understanding is sufficient. If progress stalls,
name the unresolved interpretations and ask which better fits, or whether the user
wants to leave the issue open. Do not expand this into a full design or brainstorming
exercise unless requested.

## Step 5: Confirm the shared understanding

Finish when the user confirms the current understanding and no unresolved ambiguity
materially changes the task. A high score alone does not erase a conflicting correction
or consequential unknown. The user may also end the loop at any time; if a material
gap remains, state it without claiming full alignment.

Close with a concise statement of the agreed goal, problem, success criteria, and any
unknowns that can remain open. Include a confirmed correction to the direction when
applicable. Keep understanding intent separate from endorsing a solution.

This skill establishes understanding. Do not modify project artifacts, change workflow
state, or execute a course correction as part of it. Preserve prior authorization;
alignment does not grant new execution authority or require the user to reapprove
work already authorized. Apply existing authorization only where it still covers the
corrected scope; do not continue a superseded direction or infer permission for newly
introduced actions. A separate instruction to continue work still applies within that
scope after the alignment exchange ends.

## Examples

- Codex: `$align`
- Claude Code: `/align`
- Initial topic, supplied with `$align` or `/align`: “Before we start, restate what
  you think I’m trying to achieve.”
- Mid-session topic, supplied with `$align` or `/align`: “We’ve done a lot, but this
  direction feels wrong. Align with me on the problem we’re actually solving.”
