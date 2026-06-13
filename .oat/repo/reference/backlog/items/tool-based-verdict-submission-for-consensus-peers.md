---
id: bl-3a88
title: 'Tool-based verdict submission for consensus peers (robust structured output)'
status: open
priority: medium
scope: feature
scope_estimate: L
labels: [consensus, paseo, structured-output, reliability, primitive]
assignee: null
created: '2026-06-13T16:53:33Z'
updated: '2026-06-13T16:53:33Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

Replace (or augment) paseo's `--output-schema` "emit a final JSON message that matches this schema" mechanism with a **tool/CLI the deliberating agent calls to submit its verdict**, e.g. `consensus submit --verdict REVISE --artifact-file …` or a registered MCP tool. The tool validates the verdict against the mode-appropriate schema and returns a clear, in-context error the agent can immediately self-correct.

**Why:** "get the model to end its message with valid schema-matching JSON" is fragile — it is prompt-and-parse-and-retry, not a hard contract. Live dogfooding (2026-06-13) repeatedly hit this class of problem: OpenAI rejecting `oneOf`/draft-2020/untyped properties, OpenAI emitting all fields always, and the synthesizer "finishing without a structured output message." Tool-calling is a first-class, well-trained agent capability; a validated submit-tool co-locates schema enforcement with the agent, gives it the validation error in-context, and lets it retry itself instead of paseo blindly re-prompting. This would likely have prevented most of the structured-output failures and is the natural foundation for reliable parallel/synthesized modes.

**Scope note:** this is a deliberate rework of the peer-invocation layer (how we drive paseo), touching the DR-002 "shell out to paseo" boundary, and deserves its own design pass — not a quick patch. Captured from a user idea during the consensus-iteration-modes dogfood; not a ship blocker for v0.2 (the schema+prompt approach was made to work), but the leading candidate to harden the deliberation primitive.

## Acceptance Criteria

- A design pass evaluating: an MCP tool registered with paseo vs. a CLI the sandboxed agent runs; how the orchestrator captures the submitted verdict; how it composes with stateless-per-turn agents and the deterministic engine.
- The mechanism validates against the per-mode schema and returns actionable errors the agent can self-correct, reducing paseo retry churn.
- Demonstrated reliability improvement vs. `--output-schema` on the cases that were flaky (synthesizer structured output; codex strict output).
- Keeps the engine deterministic and the artifact-as-audit-trail contract intact.

## Source

User idea during consensus-iteration-modes live dogfood, 2026-06-13.
