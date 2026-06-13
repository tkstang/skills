# Skills Repo Current State

**Last updated:** 2026-06-13 (consensus Phase 2 — parallel iteration modes + escalation ladder + unified v1 schema — implemented on `feat/consensus-iteration-modes`, final review in progress, merge pending. Prior baseline 2026-06-12: initial backfill covering consensus-plugin v0.1, session-observer + watch mode, export-session-transcript + shared transcript-core, and the OAT tooling user-scope move.)

## Overview

This repository is a personal Agent Skills home: standalone skills under `skills/`, packaged plugins under `plugins/<name>/`, shared libraries under `shared/`, and provider marketplace entries at the repo root. Runtime code is Node >= 22 ESM, standard library only, no build step. Status: v0.1 pre-release — local/Git install paths work; public marketplace claims are gated on the release checklist in `RELEASING.md`.

## Shipped Capabilities

### Consensus plugin (`plugins/consensus/`) — v0.1, unreleased

One skill, `refine` (invoked as `consensus:refine`): two Paseo-backed AI peers (default Claude + Codex) deliberate on a markdown draft toward a converged artifact with a full audit trail.

- **Iteration modes (Phase 2, branch-implemented):** three modes selected with `--iteration` — `alternating` (default; one peer revises, the other responds), `parallel_revision` (both peers revise simultaneously each round with own/peer critique, emergent same-round convergence, 2× peer calls), and `parallel_synthesized` (parallel revision plus a wrapper-driven per-round synthesis merge, 2× peer calls + 1 synthesis call). Per-round cost multiplier disclosed on the `run_started` event; `peer_calls`/`synthesis_calls` totals reported at completion.
- **Synthesizer:** `parallel_synthesized` synthesis defaults to the first peer; override with `--synthesizer <provider>` (must be in the peer inventory or preflight fails `SYNTHESIZER_UNAVAILABLE`; warned-and-ignored outside the mode). Synthesizer identity recorded per synthesis record and in the resolution block.
- **Escalation ladder (FR5):** parallel modes can emit a structured `escalation_required` event on deterministic triggers (persistent disagreement, oscillation, budget exhaustion, near-done drift) routed by `--agency` to user or host. Host decisions re-enter via `--resume … --host-direction "<text>"` (optionally `--host-decision-kind pick_a|pick_b|blend|direct|accept_impasse|extend_budget|defer_to_user`) and record as attributed `HOST_DECISION` orchestrator rounds; user decisions re-enter via `--user-direction`. Genuinely-stuck promotion: a re-fired trigger after a prior host decision (or an explicit `defer_to_user`) promotes to the user (`promoted_from: host`). HOST_DECISION routing metadata (`decision_kind`, `escalation_trigger`) persists in the canonical artifact block so promotion stays restart-safe across resumes.
- **Schema:** unified v1 verdict family across modes; per-record `schema_version: "v1"` plus an artifact-level `consensus_schema_version: "v1"`; OpenAI/codex strict structured output handled (draft-07 schemas, no `oneOf`, typed properties, verdict normalization that drops branch-disallowed fields); v0 artifacts rejected with no migration. Post-receive byte caps, normalized-hash convergence with ACCEPT-twice-same-hash guard, oscillation detection, per-section round budgets (default 12).
- **Orchestration:** sequential sections by default; opt-in host-mediated parallel dispatch (`--prepare-parallel` → host dispatches section runners per `agents/consensus-section-runner.md` → `--fan-in`); Codex subagent authorization fails closed. Each run gets a unique default run directory (no cross-run contamination).
- **Control surface:** `--goal`, `--peers`, `--max-rounds`, `--agency minimal|moderate|maximum`, `--iteration`, `--synthesizer`, `--host-direction`, `--host-decision-kind`, `--output`, `--allow-root`, `--run-dir`, `--fail-on-section-error`, `--resume`, `--user-direction`, corrupt-section skip flags.
- **Resume:** deliberation artifact is the canonical state; fail-closed on corruption; user direction recorded as a `USER_INTERVENTION` round, host decision as a `HOST_DECISION` round.
- **Safety:** four-domain path confinement with atomic writes; spawn-array subprocess hygiene; prompt-injection framing on untrusted input; JSONL stdout as the host coordination protocol, stderr for diagnostics.
- **Distribution:** provider manifests under the plugin (`.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`) plus repo-root marketplace entries; local marketplace install verified for Claude Code and Codex; Cursor loads session-scoped via `cursor agent --plugin-dir` (no marketplace/install commands in the Cursor CLI yet — fixed/documented 2026-05-24).
- **Prerequisite:** Paseo CLI on PATH (tested range 0.1.0–0.9.0); opt-in install assist via `scripts/install-paseo.mjs`.

Verified live with claude+codex across all three modes and the escalation ladder; QA walkthrough in `skills/refine/references/operator-qa.md`. Cursor-as-peer remains opt-in (custom ACP provider) and unverified end-to-end.

Not yet implemented (see `roadmap.md`): the other five family skills (`consensus-create|evaluate|decide|plan|research`), whole-document harmonization, deliberation metrics/cost caps, the deferred independent-draft cold-start strategy, a convergence similarity heuristic (deterministic-only triggers shipped; bl-ef38), tool-based verdict submission CLI (bl-3a88), and an in-house peer CLI (bl-bb7e).

### session-observer (`skills/session-observer/`)

Standalone skill for reviewing what a peer coding agent did in the same project. Supports Claude Code, Codex, and Cursor agent-transcript stores.

- **One-shot:** `review` (tool-free digest of the most relevant peer session), `catch-up` (only records since the per-session high-water mark), `locate` (ranked candidates as JSON), `state get/reset/clear`.
- **Selection:** deterministic tier ranking (exact cwd → bidirectional ancestor/descendant → explicit no-match widening), tie surfacing, `--session <runtime:id>` pinning.
- **Watch mode (shipped 2026-06-04, PRs #4/#5/#7):** foreground stat-polling watcher with debounce coalescing; emits catch-up digests to stdout for the active agent; `watch-ctl status|pause|resume|flush|stop`; lock-protected state with stale-PID cleanup; multi-watcher and duplicate-target safety; metadata-only `--event-log` hardened to the state directory; `--runtime both` (Claude Code + Codex).
- **State:** `~/.local/state/session-observer/` (XDG), keyed `runtime:sessionId`, locked atomic writes.
- **Digests:** natural-language-only by default; `--include-tools` / `--debug` opt-ins; filter header always present.

### export-session-transcript (`skills/export-session-transcript/`) — shipped 2026-06-06, PR #6

Standalone skill exporting the current (or selected) session to sanitized markdown.

- **Selection:** announced random-hex session marker via `--match` (precedence `--all` > `--session` > `--match` > newest-for-cwd).
- **Sanitization:** two layers — structural (`normalizeEntries`) plus export-owned content detectors (`sanitize.mjs`), drop-on-match; validated against 41k+ real store entries with zero hidden-payload survivors.
- **Output:** defaults to `~/Downloads/<branch>.md`; `--all` writes one file per session; exit codes 0/1/2/3 (success / hard error / no candidates / ambiguous).

### shared/transcript-core (`shared/transcript-core/`)

Canonical per-provider transcript knowledge (store locations, record parsing, structural filtering) consumed by session-observer and export-session-transcript via committed `// GENERATED` copies. `npm run sync:transcript-core` regenerates; a drift-guard test in `npm test` fails on divergence. Edit only the canonical file.

## Validation Posture

- `npm test` — full Node test suite (≈370+ tests across consensus, session-observer, export, transcript-core, repo invariants).
- `npm run validate` — repo structure, manifest, and docs invariants (including the plugin/OAT boundary from DR-001).
- `npm run smoke` — mocked end-to-end consensus wrapper flow.
- CI: `validate.yml` on PR/main push; `release.yml` on tag push.

## Release Posture

- v0.1 tagging is gated by `RELEASING.md`: manual provider runtime install + permission smoke checks (Claude Code, Cursor, Codex, Agent Skills baseline) are still outstanding.
- Codex public Plugin Directory and skills.sh listing are explicitly not claimed until verified post-publication.
- Local automated verification last recorded green 2026-05-04 (and continuously via CI since).

## Project Management Surfaces

- `roadmap.md` — active Now/Next/Later planning (this directory).
- `decision-record.md` — DR-001…DR-017 seeded 2026-06-12; append new decisions there.
- `backlog/` — file-per-item backlog (`oat-pjm-*` skills; `oat backlog regenerate-index`).
- `project-summaries/` — completion records; deep provenance is machine-local under `.oat/projects/archived/` (gitignored).
- `research/` — evidence inputs (consensus design lineage under `research/consensus/`).
