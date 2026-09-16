---
name: next-steps
description: Use when the user wants a clear recommendation for what to do next based on the conversation, with enough context and reasoning to understand the actions and who needs to take them.
license: MIT
compatibility: Agent Skills baseline; instruction-only, with no runtime or package dependencies.
user-invocable: true
metadata:
  author: thomas.stang
  version: '1.0.0'
---

# Explain what comes next

Turn the current conversation into a plain-language recommendation. Orient the user
before listing actions, and explain how each recommended action follows from where
the work stands. This skill answers the question; it does not execute the next steps.

## Ground the recommendation

Use an explicit topic or target when supplied. Otherwise use the work currently
being discussed, including the user's latest corrections, accepted decisions, and
existing authorization. Do not assume the last agent message accurately describes
the state or the need for user input. If neither a topic nor current work is
established, ask what the recommendation should cover instead of surveying the
repository for a task.

Start with the conversation. Read only relevant sources needed to resolve a material
gap, such as a cited review, document, or code section. Keep confirmed facts,
inferences, and unknowns distinct. If a fact cannot be checked, qualify the
recommendation instead of presenting it as verified. Ask one focused question only
when ambiguity would materially change the recommended action; do not ask the user
to restate context already available.

Work with any topic or workflow. Do not detect a project framework, run lifecycle
commands, or invoke other skills. Describe the recommended actions directly instead
of routing the user to a named skill. Treat any workflow artifacts already relevant
to the conversation as ordinary evidence.

## Explain the next steps

Give the user enough context to understand the recommendation:

- Briefly state what we are trying to accomplish and where things stand now.
- Recommend the immediate next action and explain why it comes next.
- Say what that action resolves or enables.
- Include subsequent steps only when they clarify the sequence or dependencies.
- Identify what the agent can handle and what, if anything, requires the user's
  decision, access, or approval. Honor approval already given for the same scope.

Prefer a short explanation followed by a small ordered list when several actions
are needed. Use concrete verbs and familiar terms. Do not substitute a status dump,
unexplained command, or menu of equally weighted options for a recommendation.
Explain a meaningful alternative only when it changes the user's decision.

If the available evidence shows that nothing remains to do, say so and identify that
evidence briefly. Attribute reported completion when it has not been verified;
do not turn an unverified report into a confirmed result. If blocked, name the actual dependency and the
smallest action that would resolve it. Do not invent follow-up work, tests, or an
approval request just to fill the response. Finish with the recommendation; do not
modify files, change workflow state, or automatically resume work.

## Examples

- Codex: `$next-steps`
- Claude Code: `/next-steps`
- Natural language: "Given all that, what do you recommend we do next and why?"

For a hypothetical review finding:

> The feature is implemented, but review found that it mishandles empty input. We
> need to correct that behavior before it is ready.
>
> I recommend fixing that case and adding one focused regression test. The fix
> addresses the bug; the test checks that later changes do not reintroduce it.
> Then rerun the affected checks and have the fix reviewed.
>
> I can handle those steps under the existing implementation request. There is no
> unresolved product decision that needs your input.

The test in this example addresses a specific bug; tests are not a default next
step for every task. A request to simplify wording alone does not need this
workflow. A request to start implementing is an execution request, not an invocation
of this explanatory skill.
