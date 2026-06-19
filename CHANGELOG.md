# Changelog

## [0.1.0] - Unreleased

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

- Local automated verification passed on 2026-06-19: `pnpm run build`, `pnpm run type-check`, `pnpm run build:check`, `pnpm run test` (53 files / 572 tests), `pnpm run validate`, and `pnpm run smoke`.
- Provider CLI local check passed; `consensus provider ls --json` reported `claude` and `codex` available.
- Claude Code local marketplace install from the release-candidate checkout passed and exposed both shipped consensus skills (`evaluate`, `refine`) plus the section runner; Codex local install passed from the configured local `skills` marketplace.
- Public v0.1 tagging remains blocked until interactive provider permission prompts are completed for Claude Code, Codex, and Cursor, and until Cursor's locked-keychain provider error is resolved or explicitly documented as unsupported for the tag.
