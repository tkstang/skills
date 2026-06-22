# Changelog

## [Unreleased]

### Added

- `consensus-create` skill for generating a new artifact from a brief with v3 defaults (`independent_draft`, `parallel_synthesized`, `maximum`), optional templates, generated runtime output, bundled brief examples, a deliberation log, and `consensus-resolution` metadata including peer and synthesis call counts.
- `consensus-decide` skill for choosing between documented options with v3 defaults (`independent_draft`, `parallel_synthesized`, `minimal`), required markdown headings including `## Dissent / Unresolved Disagreement`, generated runtime output, bundled options examples, a deliberation log, and `consensus-resolution` metadata.
- `consensus-plan` skill for turning a goal and inline constraints into a structured markdown plan with v3 defaults (`independent_draft`, `parallel_synthesized`, `moderate`), required `## Steps`, `## Dependencies`, and `## Risks` headings, generated runtime output, bundled goal examples, a deliberation log, and `consensus-resolution` metadata.

## [0.1.0] - 2026-06-20

### Added

- Initial `consensus` plugin package scaffold.
- `consensus-refine` skill instructions and section-runner contract.
- Multi-provider plugin manifests and repo-root marketplace entries.
- Baseline documentation, structural validation, and CI scaffolding.
- Alternating-mode deliberation loop with hash convergence, impasse handling, section parsing, and publishable deliberation artifacts.
- Sequential wrapper flow plus host-mediated parallel prepare/fan-in orchestration.
- Resume support for canonical artifact state, corrupt-section fail-closed handling, skip flags, and user intervention records.
- Provider CLI setup and verification guidance for local provider availability.
- Mocked smoke test coverage for dependency-free end-to-end validation.
- Node.js 22+ runtime and CI baseline.
- `consensus-evaluate` skill for judging an artifact against a rubric/spec with v3 defaults (`shared_input`, `parallel_revision`, `minimal`), unified findings, embedded per-peer `consensus-verdict` records, and dissent/unresolved-dissent surfacing.
- Generated TypeScript runtime outputs for `consensus-evaluate` and its shared consensus loop copy, with plugin manifests, skill docs, README status, and generated-output drift guards updated.

### Iteration modes

- Two parallel iteration modes selectable with `--iteration`: `parallel_revision` (both peers revise simultaneously each round, converging on emergent agreement; 2x peer calls) and `parallel_synthesized` (parallel revision plus a per-round wrapper-driven synthesis merge; 2x peer calls + 1 synthesis call). `alternating` remains the default and is regression-locked.
- Configurable synthesizer via `--synthesizer` (defaults to the first peer; validated against the provider inventory) so routine merging can run on a cheaper model; synthesizer identity is recorded in every synthesis record and the resolution block.
- Agency-gated escalation ladder: deterministic triggers (persistent disagreement, oscillation, budget exhaustion, near-done drift) emit a structured `escalation_required` event routed by `--agency` to the user or the host. Host decisions re-enter with `--resume --host-direction "<text>"` (and optional `--host-decision-kind`) as attributed orchestrator rounds; genuinely-stuck host escalations promote to the user.
- Unified v1 deliberation record schema across all three modes (mode-aware verdicts, synthesis records, attributed intervention rounds, extended byte caps); v0 artifacts are rejected fail-closed on resume with no migration.
- Cost disclosure: `run_started` carries `iteration_mode` and `calls_per_round`; `run_completed` and the resolution block report `peer_calls` and `synthesis_calls`. Routine events carry no deliberation content — `escalation_required` is the only content-bearing event.
- Resume and host-mediated parallel-section orchestration extended to the new modes and interruption points (mid-pair, pending-synthesis, pending-escalation).

### Release validation

- Local automated verification passed on 2026-06-20: `pnpm run build`, `pnpm run type-check`, `pnpm run build:check`, `pnpm run test` (72 files / 726 tests), `pnpm run validate`, and `pnpm run smoke`.
- Provider CLI local check passed; `consensus provider ls --json` reported `claude`, `codex`, and `cursor` ready.
- Claude Code local marketplace install from the release-candidate checkout passed and exposed both shipped consensus skills (`evaluate`, `refine`) plus the section runner; Codex local install passed from the configured local `skills` marketplace.
- Live provider E2E passed with Cursor as an authenticated peer: direct provider smoke, Refine, and Evaluate all converged with `--peers cursor,codex` (`strategy_used: "prompt_only"`, first-attempt schema success).
- Interactive provider permission/runtime smokes completed on 2026-06-20 against live runtimes: Claude Code and Cursor surfaced and approved a `node` exec prompt before running the wrapper, and Codex ran the wrapper under its sandboxed exec path (no prompt for the read-only command by design, even under `on-request`); all returned `ok: true`. See `RELEASING.md` for the per-provider snapshot.
