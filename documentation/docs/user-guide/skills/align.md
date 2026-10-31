---
title: 'Align'
description: 'Check that the agent understands your goal, underlying problem, and success criteria before or during work.'
---

# Align

`align` checks whether the agent understands your goals, underlying problem,
and success criteria. It is instruction-only and available standalone or as
Session `align`. Invoke it explicitly at the start of a task or after work is
underway and its direction feels uncertain. Suspected drift alone does not
activate it.

For a standalone install, invoke `$align` in Codex or `/align` in Claude Code.
The Claude Code Session member is `/session:align`. Supply a topic when helpful:

> We have done a lot, but this direction feels wrong. Align with me on the
> problem we are actually solving.

## How the exchange works

The agent restates your desired outcome, the problem motivating it, and what
success would look like. It identifies assumptions it added. For work already
underway, it also describes the current direction and any apparent divergence
from your goal, separating verified facts from reported progress, inferences,
and unknowns.

It gives a rough 0–100 confidence score for **its own understanding**, with a
reason and material gaps. This is a subjective estimate. The agent then asks
how closely its restatement matches your intent on a 0–100 scale and what it
missed or distorted. **Your assessment is separate from its confidence**; you
can correct or confirm it in plain language without giving a number.

After your feedback, the agent revises its understanding and asks the most
useful remaining question, normally one at a time. The questions focus on
uncertainties that could change the goal, problem, success criteria, or
direction. It continues until you confirm that the understanding is sufficient
and no material ambiguity remains. You can end the loop sooner; the agent then
names any consequential gap without claiming full alignment.

The closing statement captures the agreed goal, problem, success criteria,
and any unknowns that can remain open. Alignment does not endorse a proposed
solution or itself change files, project state, or the direction of work.
Existing authorization remains in force where it covers the corrected scope;
new actions still need their own authorization.

## Installation and related skills

Use the [installation guide](../installation.md) to choose standalone `align` or
the Session plugin. Both forms share the same authored behavior and require no
runtime or package installation. Host discovery and invocation remain separate
live checks.

Align establishes intent through an explicit exchange. For current progress,
use [Sitrep](sitrep.md); for a recommendation, use [Next Steps](next-steps.md).
