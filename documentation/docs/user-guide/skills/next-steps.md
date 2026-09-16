---
title: 'Next Steps'
description: 'Turn the current situation into a justified recommendation without executing it.'
---

# Next Steps

`next-steps` is a standalone, instruction-only skill for the moment when the
state of the work is known but the path forward is not. It explains the goal and
current state, recommends the immediate action, and says what that action
resolves or enables. It answers the question without carrying out the work.

The skill is workflow-agnostic. It does not detect a project framework, run
lifecycle commands, or route the user to another skill. Existing plans, review
findings, and project records can be evidence, but they do not change the
workflow.

## What it considers

The conversation is the starting point, including the user's corrections,
accepted decisions, and authorization already given. When a material fact is
missing, the skill reads only the relevant cited source, such as a review,
document, or code section. It keeps confirmed facts, inferences, and unknowns
separate.

A useful recommendation includes:

- the outcome being pursued and where the work stands;
- the immediate next action and why it comes next;
- what the action resolves or enables;
- later steps only when they clarify dependencies or sequence; and
- what the agent can handle versus what requires the user's decision, access,
  or approval.

It does not invent more work when the evidence says the task is complete. When
the work is blocked, it names the actual dependency and the smallest action
that resolves it.

## Examples

Invoke `$next-steps` in Codex or `/next-steps` in Claude Code, optionally
naming the topic. Natural language works too:

> Given the review feedback, what do you recommend we do next and why?

For a review that found one empty-input bug, a useful answer explains that the
bug must be fixed before readiness, recommends the fix and one focused
regression test, and says that the agent can handle both under the existing
implementation request. The test is justified by that concrete regression
risk; tests are not a default recommendation for every task.

## Installation and validation

The generated standalone payload is
[`skills/next-steps`](https://github.com/tkstang/skills/tree/main/skills/next-steps).
It has no runtime or package dependencies.

Static packaging proves that the metadata and complete payload are valid. For a
behavior check, try a confusing status update, a real blocker, and completed
work. Confirm that the response supplies enough context, justifies each action,
and correctly distinguishes agent work from a user-only decision. Fresh
provider discovery and useful invocation remain separate live evidence.

## Limitations

- The skill recommends; it does not modify files or workflow state.
- It does not resume implementation automatically.
- It asks a focused question only when the answer would materially change the
  recommendation.
