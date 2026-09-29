# Delegation and authorization

Read this when a skill dispatches workers or relies on independent review. Keep
workflow-specific roles, boundaries, and fallback effects in the authored skill.

## Before dependent work

Determine whether delegation is required for correctness or an optional way to
complete a bounded task. Probe actual host capabilities and governing instructions.
Distinguish available, authorization required, unresolved, and unsupported states.
A missing permission is not evidence that dispatch is unavailable.

Reuse authorization covering the same run and roles. If authorization is required
and missing, ask once for the concrete delegation scope. Do not re-ask per worker
or phase within that scope. Optional missing preferences need not block unrelated
work. Required independence or unresolved authorization must block dependent writes
and side effects; read-only preparation may continue.

## Describe the selected execution mode

When the choice affects assurance or deliverables, state the mode, reason, roles,
and material limitations before dependent work. Numeric tiers and a fixed status
string are optional. For example:

“Use two independent reviewers; dispatch is available and covered by this run's
authorization. The coordinator owns integration.”

“Use sequential research because dispatch is unavailable. Results have no
independent review; do not describe them as independently verified.”

An acceptable fallback must still meet the task's correctness requirements. If no
fallback does, stop the dependent workflow and explain what is missing. Never
silently downgrade required review or autonomy guarantees.

Keep the agreed mode stable. If capabilities fail or scope changes, report the
change and reassess dependent work. Do not continue under a known false assumption
just to preserve a locked tier; obtain new authorization only when the revised
scope requires it.

## Bound the work

Give workers an exact objective, source revision/context, owned output, verification
expectations, and escalation conditions. Avoid overlapping writes. The coordinator
retains cross-worker judgment and verifies load-bearing findings. Use the installed
orchestration guidance for model selection; do not embed a dated model ladder here.

Use capability-based provider language. Prefer the host's structured question or
dispatch tooling when available, with conversational questions as a fallback.
Never invent tool names or infer permission from a skill's frontmatter.
