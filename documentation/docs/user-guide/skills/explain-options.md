---
title: 'Explain Options'
description: 'Understand choices an agent already offered, with background, trade-offs, and a recommendation, without choosing or acting for you.'
---

# Explain Options

`explain-options` helps when an agent has offered a choice and you need context
to decide. It is instruction-only, available standalone or as Session
`explain-options`. It explains the background that creates the choice, what each option means and
costs, what actually separates them, and which one it would pick. Then it asks
you to decide. It does not choose for you or act on the choice.

## When to use it

Use it right after the agent offers two or more choices, in any form: a
question, a list, "A or B", or a structured question prompt such as Claude
Code's AskUserQuestion. Ask "explain the options", "what are the trade-offs", or
"why would I pick one over the other". Asking for more detail straight after the
choices works too.

By default it explains the most recent choice. Name an earlier one, such as "the
options about the cache", to target it. When several decisions are open and you
don't say which, it lists them and asks, or covers each briefly when they are
small. With no choices in the conversation, it says so and asks what decision
you mean.

## What you get

1. **The decision**, in one sentence: what is being chosen and what happens next.
2. **Background**: the few facts you need before the options make sense, such as
   how things work today and the constraint that creates the choice.
3. **Each option**: what it means concretely, its benefits, its costs and risks,
   how easy it is to reverse later, and effort when that differs.
4. **What actually decides it**: the one to three factors that separate the
   options, and when each favors which.
5. **Choose A if… / Choose B if…**, tied to what you may care about, such as
   speed, safety, cost, or keeping options open.
6. **A recommendation** with its reasoning, confidence, and what would change
   it. When a staged or hybrid path is clearly better than every offered option,
   it says so and labels the path as new.
7. **A question back to you.**

A side-by-side table can replace the per-option sections when it is shorter.
The answer stays proportional: a small choice gets a few lines. When a small
picture explains the choice faster, such as where each option changes a system or
a staged path over time, it adds a diagram or chart drawn only from known facts,
where the host can render one.

The conversation is the main source. When an option rests on a load-bearing
claim nobody verified, such as "this would break X", it makes one bounded check
of the code, docs, or configuration, and it says which claims it could not
verify. It keeps facts apart from opinions and gives each option a fair case,
including the ones it does not recommend.

## Related skills

Explain Options covers one pending decision the agent already offered.
[Next Steps](next-steps.md) answers what should happen next overall. Other
questions need a different kind of answer: a from-scratch comparison of tools or
approaches nobody has offered yet, why a system is built the way it is, or a
re-pitch of a concept or explanation that did not land, even while a choice is
pending. The skill names these boundaries in its own instructions so an agent
with comparison, design-history, or re-explanation skills installed can tell
them apart.

[Must We?](must-we.md) instead evaluates whether a claimed requirement, blocker,
or proposed addition is necessary. All three skills can be used standalone or
through Session; none executes its recommendation.

## Examples

For a standalone install, invoke `$explain-options` in Codex or
`/explain-options` in Claude Code. The Claude Code Session member is
`/session:explain-options`. Natural language works too:

> I don't have enough context to choose. Explain the options.

> What are the trade-offs between the two approaches you just gave me?

## Installation and validation

Choose standalone `explain-options` or the Session member `explain-options`
through the [installation guide](../installation.md). Both forms share one
canonical owner and version. The generated standalone payload is
[`skills/explain-options`](https://github.com/tkstang/skills/tree/main/skills/explain-options).
It has no runtime or package dependencies.

Static packaging proves that the metadata and payload are valid. For a behavior
check, try a two-option choice whose answer depends on a future condition, three
options with one clearly weak, two open decisions at once, no options at all,
an option that rests on an unverified claim, and a host that does not render
diagrams. Fresh provider discovery and a
useful live answer remain separate evidence.

## Limitations

- It explains and recommends; it does not choose, modify files, or resume work.
- It does not research beyond a bounded check of a load-bearing claim.
- It adds no new options except a clearly better staged or hybrid path, labelled
  as new.
