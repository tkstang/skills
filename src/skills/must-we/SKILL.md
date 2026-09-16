---
name: must-we
description: Use when the user questions whether a claimed blocker, requested approval, review requirement, or proposed extra work is actually necessary, and wants an evidence-based recommendation and a simpler alternative when warranted.
license: MIT
compatibility: Agent Skills baseline; instruction-only, with no runtime or package dependencies. Optional analysis skills may be unavailable or manually invoked.
user-invocable: true
metadata:
  author: thomas.stang
  version: '1.0.0'
---

# Must we do this?

Evaluate whether the proposed work or reason for stopping is justified. Explain
the conclusion in plain language and recommend what to do instead when the current
proposal is unnecessary or excessive. Be willing to uphold a real requirement.
The user's skepticism is a reason to investigate, not evidence for a verdict.

## Identify the disputed requirement

Use the supplied blocker, proposal, or approval request. Otherwise infer it from
the current conversation and most recent stop. Recover the user's actual goal,
accepted constraints, and existing authorization. If there is no identifiable
target, ask one focused question rather than auditing unrelated work.

Separate the underlying problem from the proposed solution. A reported bug may
need a fix without needing a new test framework. A required review may prevent
progress without justifying every addition suggested by the reviewer.

## Evaluate what is necessary

Start with the conversation and the narrowest relevant evidence. Check the cited
rule, review finding, tool behavior, or artifact when the conclusion depends on
it. Do not treat the last agent's assertion, a plan's own justification, or a
"best practice" as sufficient proof.

Determine:

- What is supposedly blocking progress, and what evidence supports that claim?
- Is the proposed work necessary for the requested outcome, or is it an optional
  improvement, an implementation choice, or a mistaken interpretation?
- What concrete consequence follows if we skip or defer it? Distinguish observed
  failures, credible risks, and speculation. A serious risk can justify prevention
  before a failure occurs.
- Could a smaller action meet the same requirement with sufficient evidence that
  it works? Account for the cost and risk of simplifying, including later rework.
- Does an applicable instruction, approval boundary, or enforced gate actually
  prevent proceeding? Identify its source and distinguish the rule from the
  agent's interpretation. A technical gate can be real even if its design is
  questionable; evaluating it does not authorize bypassing or changing it.
- Is the user's input needed, or can the agent handle the recommended action under
  existing authority? Do not ask again for approval already granted for that scope.

Use deeper analysis only when it resolves a material unanswered question:

- Use `skeptic` for a disputed factual claim requiring adversarial verification,
  such as whether a tool really requires a flag or a stated failure can occur.
- Use `{{skill:complexity-review}}` when an identifiable artifact contains several
  interacting additions that require evaluating the whole proposal to find the
  minimum sufficient solution. Keep conversation-only proposals in direct evaluation.

These are optional skills, not bundled requirements. Check actual availability and
host invocation rules. If a skill requires manual user invocation or the host blocks
its use, do not work around that restriction by loading and reproducing its workflow.
Continue this skill's own direct evaluation, state the limitation, and mention manual
invocation only when it would help resolve the question.

When routing is permitted, load the selected skill's current instructions and give it the specific claim or
proposal, relevant evidence, and this evaluation-only scope. Follow its analysis
workflow, then bring the findings back into the answer below. Do not automatically
chain both skills, route back to this skill, or broaden the task merely because
another capability exists. If a skill is unavailable, evaluate directly with
accessible evidence and state any resulting limitation. Do not claim independent
verification or certainty that the fallback did not provide.

## Give a verdict and an action

Lead with a clear conclusion: the work is necessary, unnecessary, useful but
deferrable, or the problem is real but the proposed solution is excessive. If the
evidence cannot settle it, say exactly what is unknown and recommend the smallest
check that would change the decision.

Briefly explain the evidence and the consequence of skipping the work. Then state
the recommended action, why it is sufficient, and who needs to act. If the original
stop was mistaken, correct it explicitly and outline how to proceed. If a smaller
alternative exists, describe it concretely. If deferring, name the condition that
would make the work necessary later. Do not force an alternative when the original
action is already the smallest justified one.

Keep the answer proportional to the disputed issue. Return a short explanation,
not an unexplained review ledger. Cite the specific evidence behind material
claims; distinguish verified facts from inference and unresolved questions.

This invocation authorizes evaluation, including necessary read-only analysis.
It does not itself authorize code changes, new tests, workflow-state edits, gate
bypasses, external messages, or execution of the recommendation. Preserve any
existing implementation authority when describing who can proceed, but finish
this evaluation with the recommendation rather than automatically resuming work.

## Examples

- Codex: `$must-we`
- Claude Code: `/must-we add these regression cases?`
- Natural language: “Do we need to do this, or is there a smaller path?”

For a hypothetical excessive proposal:

> We need to check that the empty-input bug is fixed, but the proposed fixture
> framework is unnecessary. One focused test can exercise the failure directly.
> I recommend adding that test and continuing through the required review. I can
> handle the fix and test under the existing request; no new decision is needed.

For a hypothetical justified stop:

> Yes, approval is still needed. Your instruction allows preparing the release but
> reserves publication for your decision. The release is prepared; the next step
> is to approve or decline publishing it. No extra implementation is needed.

A wording-only clarification does not need this evaluation. A request to review
an entire artifact's complexity should go directly to that broader review.
