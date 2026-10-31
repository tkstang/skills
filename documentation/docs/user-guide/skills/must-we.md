---
title: 'Must We?'
description: 'Decide whether a blocker, requirement, or proposed action is necessary and identify the smallest sufficient path.'
---

# Must We?

`must-we` tests whether a claimed blocker, requested approval, review
requirement, or proposed addition is actually necessary. It is instruction-only,
available standalone or as Session `must-we`. It is as willing to answer
“yes, and here is why” as it is to reject excess work and recommend a smaller
path.

“Do we need to do this?” is a natural-language invocation cue. There is no
`do-we-need-to` installed skill, alias, or compatibility wrapper.

## How it decides

The skill separates the underlying problem from the proposed solution. A bug
may require a fix without requiring a new framework. A real approval boundary
may justify stopping without justifying extra implementation.

It checks:

- the evidence for the claimed blocker or requirement;
- whether the proposal is required for the requested outcome or is an optional
  improvement or implementation choice;
- the concrete consequence of skipping or deferring it, separating observed
  failures, credible risks, and speculation;
- whether a smaller action meets the same requirement with sufficient proof;
- whether an instruction, approval boundary, or enforced gate actually
  prevents progress; and
- whether the agent can act under existing authority.

The verdict is one of: necessary, unnecessary, useful but deferrable, or a real
problem with an excessive proposed solution. If evidence cannot settle the
question, the skill names the unknown and recommends the smallest check that
would change the decision.

An available skeptical claim-review skill can help verify a disputed fact.
[`complexity-review`](complexity-review.md) can assess an identifiable
artifact with several interacting additions. Both are optional. The skill
checks actual availability and host invocation rules, continues its own direct
evaluation when either is unavailable or manual-only, and never treats optional
analysis as a prerequisite. Complexity Review remains standalone; installing
Session does not include it.

The evaluation ends with a recommendation. It preserves existing authority when
explaining who can act, without asking again for approval already granted for
that scope. It does not execute the recommendation or bypass a real gate.

## Related decisions

[Next Steps](next-steps.md) recommends what should happen next overall.
[Explain Options](explain-options.md) explains choices the agent already offered.
Must We investigates whether the proposed work or reason for stopping is
justified. None automatically carries out its recommendation.

## Examples

For a standalone install, invoke `$must-we` in Codex or `/must-we` in Claude Code.
The Claude Code Session member is `/session:must-we`:

> Do we need this test framework to address the review finding?

A smaller-path verdict might explain that the empty-input bug needs one focused
regression test, while the proposed fixture framework adds no necessary proof.
A justified verdict might explain that publication approval is still required
because the existing instruction authorizes preparing a release but reserves
publishing for the user.

## Installation and validation

Choose standalone `must-we` or the Session member `must-we` through the
[installation guide](../installation.md). Both forms share one canonical owner
and version. The generated standalone payload is
[`skills/must-we`](https://github.com/tkstang/skills/tree/main/skills/must-we).
It has no runtime or package dependencies.

For behavior checks, use an unnecessary stop, an excessive solution to a real
problem, a justified blocker, a claim with insufficient evidence, and an
optional analysis skill that is present but manual-only. Confirm that the
answer neither rubber-stamps the agent's original position nor assumes the
user's skepticism proves the verdict.

Static packaging does not prove fresh-provider discovery or live invocation.

## Limitations

- Evaluation does not authorize code changes, new tests, bypasses, or execution
  of the recommendation.
- A real technical or approval gate remains real even when its design is
  questionable.
- The skill does not force a smaller alternative when the original action is
  already the minimum justified one.
