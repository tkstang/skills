---
id: bl-3a88
title: 'Tool-based verdict submission for consensus peers (future reliability hardening)'
status: open
priority: medium
scope: feature
scope_estimate: L
labels: [consensus, provider-cli, structured-output, reliability, primitive]
assignee: null
created: '2026-06-13T16:53:33Z'
updated: '2026-06-19T23:16:53Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

**Status update (2026-06-19): still open, narrowed.** The provider CLI now owns
the peer-invocation boundary and local validation/retry path, so this item is no
longer about replacing an external backend. It remains a future reliability
hardening design: give peers an explicit validated verdict submission surface
instead of relying only on final-message JSON plus orchestrator validation.

Augment the provider CLI's "emit a final JSON message that matches this schema" mechanism with a **tool/CLI the deliberating agent calls to submit its verdict**, e.g. `consensus submit --verdict REVISE --artifact-file …` or a registered MCP tool. The tool validates the verdict against the mode-appropriate schema and returns a clear, in-context error the agent can immediately self-correct.

**Why:** "get the model to end its message with valid schema-matching JSON" is fragile — it is prompt-and-parse-and-retry, not a hard contract. Live dogfooding (2026-06-13) repeatedly hit this class of problem: OpenAI rejecting `oneOf`/draft-2020/untyped properties, OpenAI emitting all fields always, and the synthesizer "finishing without a structured output message." Tool-calling is a first-class, well-trained agent capability; a validated submit-tool co-locates schema enforcement with the agent, gives it the validation error in-context, and lets it retry itself instead of the wrapper re-prompting from outside the provider turn. This would likely have prevented most of the structured-output failures and is the natural foundation for reliable parallel/synthesized modes.

**Scope note:** this is a deliberate hardening pass for the peer-invocation layer and deserves its own design pass — not a quick patch. Captured from a user idea during the consensus-iteration-modes dogfood; not a ship blocker for v0.2 (the schema+prompt approach was made to work), but the leading candidate to harden the deliberation primitive.

**Project packaging (2026-06-20):** run in a **provider-cli-hardening OAT
project** alongside [[bl-3291]] (provider-exit retry classification) — both harden
the owned CLI's reliability boundary and share the `src/consensus/provider-cli/`
surface, which is **disjoint from the consensus-family lane** (`consensus-loop`
core), so the two projects run concurrently without churn. **Do the design pass
first**: the verdict-submission decision should be made before the synthesized-mode
family wrappers (`bl-b9b9`/`bl-87ef`/`bl-0cb8`) fan out, since this de-risks their
structured output. The `bl-2ed7` gate + `bl-b9b9` sectioning design provide the
runway to land this design (and ideally the build) before the wrappers ship.

**Cross-link (2026-06-19):** follows [[bl-bb7e]] (provider CLI), which now owns the peer-invocation boundary. Cursor still has no native schema flag, so the operator-lean provider set (claude + codex + cursor) still needs the soft validation path. A verdict-submission tool is the mechanism that could normalize all three onto one robust, self-correcting contract.

## Acceptance Criteria

- A design pass evaluating: an MCP tool vs. a CLI the sandboxed agent runs; how the orchestrator captures the submitted verdict; how it composes with stateless-per-turn agents and the deterministic engine.
- The mechanism validates against the per-mode schema and returns actionable errors the agent can self-correct, reducing wrapper retry churn.
- Demonstrated reliability improvement vs. `--output-schema` on the cases that were flaky (synthesizer structured output; codex strict output).
- Keeps the engine deterministic and the artifact-as-audit-trail contract intact.

## Source

User idea during consensus-iteration-modes live dogfood, 2026-06-13.
