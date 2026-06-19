# Skills Repo Current State

**Last updated:** 2026-06-19 (v0.1 release verification refreshed automated gates, provider install evidence, release workflow parity, version/tag checks, and release notes. Test-organization cleanup is also branch-implemented on main context: shared test helpers under `tests/helpers/`, domain-organized test directories, and two oversized suites split; behavior-preserving, no runtime/generated `.mjs` changes. Prior: PR4 converted all repo/tooling test suites to Vitest `.test.ts`, retired `node:test`, and made `pnpm test` Vitest-only.)

## Overview

This repository is a personal Agent Skills home: standalone skills under `skills/`, packaged plugins under `plugins/<name>/`, canonical TypeScript source under `src/`, compatibility/reference material under `shared/`, and provider marketplace entries at the repo root. Shipped runtime code remains Node >= 22 ESM, standard library only, and install-free for users; developer tooling now includes TypeScript, Vitest, and a generated-output build step for committed `.mjs` artifacts. Status: v0.1 pre-release — local/Git install paths work; public marketplace claims are gated on the release checklist in `RELEASING.md`.

## Shipped Capabilities

### Consensus plugin (`plugins/consensus/`) — v0.1, unreleased

Two skills ship:

- `refine` (invoked as `consensus:refine`): two Paseo-backed AI peers (default Claude + Codex) deliberate on a markdown draft toward a converged artifact with a full audit trail.
- `evaluate` (invoked as `consensus:evaluate`): two Paseo-backed AI peers judge an artifact against a rubric/spec, defaulting to `shared_input` / `parallel_revision` / `minimal`, and produce a markdown evaluation with unified findings, embedded per-peer `consensus-verdict` records, and dissent or unresolved-dissent sections when disagreement remains.

- **Iteration modes (Phase 2, branch-implemented):** three modes selected with `--iteration` — `alternating` (default; one peer revises, the other responds), `parallel_revision` (both peers revise simultaneously each round with own/peer critique, emergent same-round convergence, 2× peer calls), and `parallel_synthesized` (parallel revision plus a wrapper-driven per-round synthesis merge, 2× peer calls + 1 synthesis call). Per-round cost multiplier disclosed on the `run_started` event; `peer_calls`/`synthesis_calls` totals reported at completion.
- **Synthesizer:** `parallel_synthesized` synthesis defaults to the first peer; override with `--synthesizer <provider>` (must be in the peer inventory or preflight fails `SYNTHESIZER_UNAVAILABLE`; warned-and-ignored outside the mode). Synthesizer identity recorded per synthesis record and in the resolution block.
- **Escalation ladder (FR5):** parallel modes can emit a structured `escalation_required` event on deterministic triggers (persistent disagreement, oscillation, budget exhaustion, near-done drift) routed by `--agency` to user or host. Host decisions re-enter via `--resume … --host-direction "<text>"` (optionally `--host-decision-kind pick_a|pick_b|blend|direct|accept_impasse|extend_budget|defer_to_user`) and record as attributed `HOST_DECISION` orchestrator rounds; user decisions re-enter via `--user-direction`. Genuinely-stuck promotion: a re-fired trigger after a prior host decision (or an explicit `defer_to_user`) promotes to the user (`promoted_from: host`). HOST_DECISION routing metadata (`decision_kind`, `escalation_trigger`) persists in the canonical artifact block so promotion stays restart-safe across resumes.
- **Schema:** unified v1 verdict family across modes; per-record `schema_version: "v1"` plus an artifact-level `consensus_schema_version: "v1"`; OpenAI/codex strict structured output handled (draft-07 schemas, no `oneOf`, typed properties, verdict normalization that drops branch-disallowed fields); v0 artifacts rejected with no migration. Post-receive byte caps, normalized-hash convergence with ACCEPT-twice-same-hash guard, oscillation detection, per-section round budgets (default 12).
- **Orchestration:** sequential sections by default; opt-in host-mediated parallel dispatch (`--prepare-parallel` → host dispatches section runners per `agents/consensus-section-runner.md` → `--fan-in`); Codex subagent authorization fails closed. Each run gets a unique default run directory (no cross-run contamination).
- **Control surface:** `--goal`, `--peers`, `--max-rounds`, `--agency minimal|moderate|maximum`, `--iteration`, `--synthesizer`, `--host-direction`, `--host-decision-kind`, `--output`, `--allow-root`, `--run-dir`, `--fail-on-section-error`, `--resume`, `--user-direction`, corrupt-section skip flags.
- **Resume:** deliberation artifact is the canonical state; fail-closed on corruption; user direction recorded as a `USER_INTERVENTION` round, host decision as a `HOST_DECISION` round.
- **Safety:** four-domain path confinement with atomic writes; spawn-array subprocess hygiene; prompt-injection framing on untrusted input; JSONL stdout as the host coordination protocol, stderr for diagnostics.
- **TypeScript/generated runtime slices (2026-06-15/17):** `consensus-loop` now has canonical TypeScript source at `src/consensus/core/consensus-loop.ts` with typed verdict, synthesis, record/status, agency, escalation, prompt-profile, and peer-invocation domains. `consensus-refine` has canonical TypeScript source at `src/consensus/refine/consensus-refine.ts`; `consensus-evaluate` has canonical TypeScript source at `src/consensus/evaluate/consensus-evaluate.ts`. The build rewrites canonical loop module specifiers to shipped sibling `./consensus-loop.mjs` runtimes without rewriting unrelated string literals. The committed provider-facing runtimes are `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`, `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`, `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs`, and `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs` with generated banners and drift guards.
- **Distribution:** provider manifests under the plugin (`.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`) plus repo-root marketplace entries; local marketplace install verified for Claude Code and Codex; Cursor loads session-scoped via `cursor agent --plugin-dir` when Cursor Agent is available, but the 2026-06-19 release-verification run could not verify Cursor because the macOS login keychain was locked and Paseo reported the Cursor provider as `error`.
- **Prerequisite:** Paseo CLI on PATH (tested range 0.1.0–0.9.0); opt-in install assist via `scripts/install-paseo.mjs`.

Refine verified live with claude+codex across all three modes and the escalation ladder; QA walkthrough in `skills/refine/references/operator-qa.md`. Evaluate has mocked end-to-end coverage and operator QA docs in `skills/evaluate/references/operator-qa.md`; live provider verification remains part of v0.1 release checks. Cursor-as-peer remains opt-in (custom ACP provider) and unverified end-to-end.

Not yet implemented (see `roadmap.md`): the other four family skills (`consensus-create|decide|plan|research`), whole-document harmonization, deliberation metrics/cost caps, the deferred independent-draft cold-start strategy, a convergence similarity heuristic (deterministic-only triggers shipped; bl-ef38), tool-based verdict submission CLI (bl-3a88), and an in-house peer CLI (bl-bb7e).

### session-observer (`skills/session-observer/`)

Standalone skill for reviewing what a peer coding agent did in the same project. Supports Claude Code, Codex, and Cursor agent-transcript stores.

- **One-shot:** `review` (tool-free digest of the most relevant peer session), `catch-up` (only records since the per-session high-water mark), `locate` (ranked candidates as JSON), `state get/reset/clear`.
- **Selection:** deterministic tier ranking (exact cwd → bidirectional ancestor/descendant → explicit no-match widening), tie surfacing, `--session <runtime:id>` pinning.
- **Watch mode (shipped 2026-06-04, PRs #4/#5/#7):** foreground stat-polling watcher with debounce coalescing; emits catch-up digests to stdout for the active agent; `watch-ctl status|pause|resume|flush|stop`; lock-protected state with stale-PID cleanup; multi-watcher and duplicate-target safety; metadata-only `--event-log` hardened to the state directory; `--runtime both` (Claude Code + Codex).
- **TypeScript/generated runtime slice (2026-06-18):** canonical implementation source now lives under `src/transcript/session-observer/`, including typed state, candidate/ranking, digest/observe, watch, CLI/probe, and transcript-core interaction boundaries. The shipped dependency-free CLI, probe, and library `.mjs` files remain generated and committed under `skills/session-observer/scripts/`; session-observer tests now run as Vitest TypeScript while generated-entrypoint coverage still executes the shipped `.mjs` paths.
- **State:** `~/.local/state/session-observer/` (XDG), keyed `runtime:sessionId`, locked atomic writes.
- **Digests:** natural-language-only by default; `--include-tools` / `--debug` opt-ins; filter header always present.

### export-session-transcript (`skills/export-session-transcript/`) — shipped 2026-06-06, PR #6

Standalone skill exporting the current (or selected) session to sanitized markdown.

- **Selection:** announced random-hex session marker via `--match` (precedence `--all` > `--session` > `--match` > newest-for-cwd).
- **TypeScript/generated runtime slice (2026-06-17):** canonical source now lives at `src/transcript/export-session/export-session-transcript.ts` and `src/transcript/export-session/sanitize.ts`; generated shipped output remains at `skills/export-session-transcript/scripts/export-session-transcript.mjs` and `skills/export-session-transcript/scripts/lib/sanitize.mjs`, with import rewrites to local `./lib/*.mjs` dependencies.
- **Sanitization:** two layers — structural (`normalizeEntries`) plus export-owned content detectors (`sanitize.mjs`), drop-on-match; validated against 41k+ real store entries with zero hidden-payload survivors.
- **Output:** defaults to `~/Downloads/<branch>.md`; `--all` writes one file per session; exit codes 0/1/2/3 (success / hard error / no candidates / ambiguous).

### transcript-core (`src/transcript/core/`)

Canonical per-provider transcript knowledge (store locations, record parsing, structural filtering) lives at `src/transcript/core/runtimes.ts` and is consumed by session-observer and export-session-transcript via committed `// GENERATED` copies at each skill's `scripts/lib/runtimes.mjs`. `pnpm run build` regenerates the copies, `pnpm run build:check` and `tests/tooling/generated-output-sync.test.ts` enforce drift, and `pnpm run sync:transcript-core` remains a compatibility wrapper around the same build path.

## Validation Posture

- `pnpm run type-check` — TypeScript source check.
- `pnpm run build:check` — generated runtime drift guard.
- `npm test` / `pnpm test` — Vitest-only; all suites are `.test.ts` using `expect`. The `node:test` runner is retired. Tests are organized by domain: `tests/consensus/{core,refine,evaluate}/`, `tests/repo/`, `tests/release/`, `tests/tooling/`, `tests/session-observer/`, `tests/export-session-transcript/`, `tests/transcript-core/`, with shared setup helpers in `tests/helpers/`.
- `npm run validate` / `pnpm run validate` — repo structure, manifest, and docs invariants (including the plugin/OAT boundary from DR-001).
- `npm run smoke` / `pnpm run smoke` — mocked end-to-end consensus wrapper flow.
- CI: `validate.yml` on PR/main push now installs with a frozen lockfile, builds, type-checks, build-checks, tests, validates, and smokes; `release.yml` on tag push.

## Release Posture

- v0.1 automated gates passed locally on 2026-06-19: `pnpm run build`, `pnpm run type-check`, `pnpm run build:check`, `pnpm run test` (53 files / 572 tests), `pnpm run validate`, and `pnpm run smoke`.
- `node scripts/bump-version.mjs --check-tag v0.1.0` passed on 2026-06-19, and release tag workflow parity was updated to install with pnpm, build, type-check, build-check, test, validate, smoke, and check tag/manifest consistency.
- v0.1 tagging is still gated by `RELEASING.md`: Claude Code and Codex local installs are verified, but interactive permission prompts remain unverified; Cursor is blocked by locked keychain / provider `error`; Agent Skills source listing works but post-tag skills.sh indexing is not verified.
- Codex public Plugin Directory and skills.sh listing are explicitly not claimed until verified post-publication.

## Project Management Surfaces

- `roadmap.md` — active Now/Next/Later planning (this directory).
- `decision-record.md` — DR-001…DR-017 seeded 2026-06-12; append new decisions there.
- `backlog/` — file-per-item backlog (`oat-pjm-*` skills; `oat backlog regenerate-index`).
- `project-summaries/` — completion records; deep provenance is machine-local under `.oat/projects/archived/` (gitignored).
- `research/` — evidence inputs (consensus design lineage under `research/consensus/`).
