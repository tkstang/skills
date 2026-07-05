---
id: BL-260613-tool-based-verdict-submission
title: Tool-based verdict submission for consensus peers (future reliability
  hardening)
status: closed
priority: medium
scope: feature
scope_estimate: L
labels:
  - consensus
  - provider-cli
  - structured-output
  - reliability
  - primitive
assignee: null
created: 2026-06-13T16:53:33Z
updated: 2026-06-21T05:01:55Z
associated_issues: []
legacy_id: bl-3a88
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

**Status update (2026-06-21 — `provider-cli-hardening`):** verdict-submission is
now decided and built as an owned submit-CLI seam; see [[DR-024]]. The runner
injects `CONSENSUS_SUBMIT_COMMAND`, `CONSENSUS_SUBMIT_SCHEMA`, and
`CONSENSUS_SUBMIT_FILE`, plus `CONSENSUS_SUBMIT_MAX_BYTES`; peers submit verdict
JSON with the injected command. The command validates in-context, enforces the
submit byte cap, and writes a run-bound sidecar; the turn runner uses that
sidecar as the preferred verdict source while preserving final-message parse
fallback when no valid submission exists. Submit-enabled Codex turns avoid native
`--output-schema`, so strict-output rejection does not happen before the peer can
run the submit command. MCP was rejected for this repo because it adds a
server/config boundary and uneven provider support beyond the dependency-free
subprocess contract.

**Consensus-family track flag:** the verdict contract is now decided for the
synthesized-mode family. `bl-b9b9` / `bl-87ef` / `bl-0cb8` can plan against
submit-CLI plus parse fallback as the provider-CLI contract, rather than reopening
the MCP-vs-CLI question. Remaining hardening follow-ups are narrower: opt-in
strict require-submission semantics and Codex `read-only` support via capture-path
relocation under an allowed cwd/workspace path. Those follow-ups should not block
the family wrappers from using the decided contract.

## Acceptance Criteria

- Decision record captures submit-CLI as the selected mechanism, MCP as the
  rejected alternative, run-bound sidecar capture, no-submission fallback behavior,
  and evidence.
- The mechanism validates against the per-mode schema and returns actionable
  in-context errors the agent can self-correct, reducing wrapper retry churn.
- Deterministic fixtures demonstrate reliability improvement on the historical
  no-structured-output and Codex/OpenAI strict-output rejection cases.
- A gated live-provider E2E confirms prompt-driven submission with an available
  provider and records sandbox/tmpdir posture.
- The engine remains deterministic and the artifact-as-audit-trail contract stays
  intact: submitted verdicts flow through the unchanged `ConsensusCliRunEnvelope`.
- The consensus-family track (`bl-b9b9` / `bl-87ef` / `bl-0cb8`) is flagged that
  the verdict contract is decided.

## Source

User idea during consensus-iteration-modes live dogfood, 2026-06-13.
