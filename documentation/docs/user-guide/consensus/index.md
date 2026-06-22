---
title: 'Consensus'
description: 'How the consensus plugin deliberates two AI peers over artifacts, briefs, options, and goals, including create, decide, plan, refine, evaluate, iteration modes, and current limitations.'
---

# Consensus

The consensus plugin runs **two provider-CLI-backed AI peers** that deliberate
over an artifact toward a converged result, leaving an audit trail you can
review. The peers are invoked through the generated consensus CLI; the wrappers
parse your document, run the peers through structured verdict rounds, and write a
markdown deliberation artifact with the final output, resolution metadata, and a
deliberation log.

The scope is intentionally narrow. v0.1 ships five skills:

- **[`create`](create.md)** — creates a new artifact from a brief with
  `independent_draft`, `parallel_synthesized`, maximum agency, a deliberation
  log, and a `consensus-resolution` block.
- **[`decide`](decide.md)** — chooses between documented options with
  `independent_draft`, `parallel_synthesized`, minimal agency, required decision
  headings, explicit `## Dissent / Unresolved Disagreement`, and a
  `consensus-resolution` block.
- **[`plan`](plan.md)** — turns a goal and inline constraints into a structured
  markdown plan with `independent_draft`, `parallel_synthesized`, moderate
  agency, required `## Steps`, `## Dependencies`, and `## Risks` headings, and a
  `consensus-resolution` block.
- **[`refine`](refine.md)** — refines a markdown draft by asking two peers to
  deliberate toward a converged artifact with an audit trail.
- **[`evaluate`](evaluate.md)** — judges an artifact against a rubric, with
  unified findings, per-peer reasoning, and dissent preserved in the
  deliberation log.

For the deepest reference — operator-QA walkthroughs, exact commands, and example
inputs — see the
[consensus plugin README](https://github.com/tkstang/skills/blob/main/plugins/consensus/README.md).

## Iteration modes

The shipped consensus skills support three iteration modes, selected with
`--iteration`:

- **`alternating`** (default for `refine`) — one peer revises and the other
  responds, turn by turn. Lowest cost: one peer call per round.
- **`parallel_revision`** (default for `evaluate`) — both peers revise the same
  input simultaneously each round, each critiquing its own and the peer's
  previous revision; the run converges on emergent agreement. Costs **2x peer
  calls** per round.
- **`parallel_synthesized`** — parallel revision plus a per-round synthesis call
  that merges both revisions into the next round's shared input. Costs **2x peer
  calls plus one synthesis call** per round.

Parallel modes disclose their per-round call multiplier in the `run_started`
JSONL event (`calls_per_round`) and report actual `peer_calls` /
`synthesis_calls` totals at completion.

## Synthesizer, agency, and escalation

- **Synthesizer** — in `parallel_synthesized` mode, a synthesis call merges both
  peers' revisions each round. It defaults to the first configured peer's
  provider and can be overridden with `--synthesizer <provider-id>`. The
  synthesizer must be present in the provider inventory, and the flag is
  warned-and-ignored outside `parallel_synthesized`.
- **Agency** — `--agency` controls who resolves a stuck section. At `minimal`
  agency, unresolved peer disagreement is surfaced to the user rather than
  silently decided.
- **Escalation** — when a parallel-mode section gets stuck (persistent
  disagreement, oscillation, budget exhaustion, or near-done drift), the wrapper
  emits an `escalation_required` JSONL event routed by `--agency` to the user or
  the host. A user decision re-enters with `--user-direction`; a host decision
  re-enters with `--host-direction` and records as an attributed orchestrator
  round.

See [Configuration](configuration.md) for peer selection, the provider floor,
diagnostics, and permissions, and the per-skill pages for the full command set.

## Limitations

- v0.1 ships the `create`, `decide`, `plan`, `refine`, and `evaluate` skills.
  The standalone `session-observer` and `export-session-transcript` skills ship
  alongside the consensus plugin but are not part of it.
- Remaining consensus-family skills are future work: `consensus-research`.
- Three iteration modes ship (`alternating`, `parallel_revision`,
  `parallel_synthesized`); `parallel_revision` and `parallel_synthesized`
  disclose their per-round call multiplier (2x peer calls, plus 1 synthesis call
  for synthesized) and escalate stuck states through the agency-gated ladder.
- The independent-draft cold-start strategy is exposed through `create`,
  `decide`, and `plan`. `refine` and `evaluate` remain shared-input only.
- Sections converge independently; whole-document harmonization and deliberation
  metrics / cost caps remain deferred.
- Cursor is supported as a host runtime and as a first-floor peer when its local
  CLI is authenticated. Treat `auth_required` inventory/preflight results as a
  local setup issue, not a retryable consensus failure.
- Codex public marketplace submission is not assumed; Git/local install is the
  v0.1 path.
- skills.sh listing should not be claimed until indexing has been verified after
  publication.
- Prompt injection inside input artifacts is mitigated by prompt framing,
  filtering, and schema validation where applicable, but peer CLIs may still
  produce structurally valid bad advice. Review the audit trail before
  publishing outputs.
- This plugin adds no telemetry. Configured provider CLIs may have their own
  behavior; review those tools separately.

## Contents

- [Create](create.md) - `create` usage: brief inputs, `independent_draft` defaults, output contract, and input handling.
- [Decide](decide.md) - `decide` usage: options input, minimal-agency defaults, required headings, dissent surfacing, and output contract.
- [Plan](plan.md) - `plan` usage: goal and inline constraints, moderate-agency defaults, required headings, and output contract.
- [Refine](refine.md) - `refine` usage: sequential default, iteration modes, resume, escalation, and host-mediated parallel sections.
- [Evaluate](evaluate.md) - `evaluate` usage: artifact-vs-rubric command, defaults, output contract, and guided rubric creation.
- [Configuration](configuration.md) - Shared configuration: peer selection, provider floor, diagnostics, synthesizer, agency, and permissions.
