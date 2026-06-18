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
- Paseo install assist via `scripts/install-paseo.mjs`; tested Paseo range 0.1.0 to 0.9.0.
- Mocked smoke test coverage for dependency-free end-to-end validation.
- Node.js 22+ runtime and CI baseline.
- `consensus-evaluate` skill for judging an artifact against a rubric/spec with v3 defaults (`shared_input`, `parallel_revision`, `minimal`), unified findings, embedded per-peer `consensus-verdict` records, and dissent/unresolved-dissent surfacing.
- Generated TypeScript runtime outputs for `consensus-evaluate` and its shared consensus loop copy, with plugin manifests, skill docs, README status, and generated-output drift guards updated.

### Iteration modes (v0.2)

- Two parallel iteration modes selectable with `--iteration`: `parallel-revision` (both peers revise simultaneously each round, converging on emergent agreement; 2x peer calls) and `parallel-synthesized` (parallel revision plus a per-round wrapper-driven synthesis merge; 2x peer calls + 1 synthesis call). `alternating` remains the default and is regression-locked.
- Configurable synthesizer via `--synthesizer` (defaults to the first peer; validated against the provider inventory) so routine merging can run on a cheaper model; synthesizer identity is recorded in every synthesis record and the resolution block.
- Agency-gated escalation ladder: deterministic triggers (persistent disagreement, oscillation, budget exhaustion, near-done drift) emit a structured `escalation_required` event routed by `--agency` to the user or the host. Host decisions re-enter with `--resume --host-direction "<text>"` (and optional `--host-decision-kind`) as attributed orchestrator rounds; genuinely-stuck host escalations promote to the user.
- Unified v1 deliberation record schema across all three modes (mode-aware verdicts, synthesis records, attributed intervention rounds, extended byte caps); v0 artifacts are rejected fail-closed on resume with no migration.
- Cost disclosure: `run_started` carries `iteration_mode` and `calls_per_round`; `run_completed` and the resolution block report `peer_calls` and `synthesis_calls`. Routine events carry no deliberation content — `escalation_required` is the only content-bearing event.
- Resume and host-mediated parallel-section orchestration extended to the new modes and interruption points (mid-pair, pending-synthesis, pending-escalation).

### Release validation

- Local automated verification passed on 2026-05-04: `npm test`, `node scripts/validate.mjs`, and `node scripts/smoke-test.mjs`.
- Paseo local check passed with `paseo 0.1.63`; `paseo provider ls --json` reported `claude` and `codex` available.
- Public v0.1 tagging remains blocked until manual provider runtime install and permission checks are completed for Claude Code, Cursor, and Codex Git/local paths.
