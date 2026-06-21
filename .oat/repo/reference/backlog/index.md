# OAT Backlog Index

> Generated backlog table lives inside the managed section below. Keep curated narrative updates in the overview section so CLI regeneration stays safe.

## Curated Overview

- **Consensus Phase 2 + family (seeded 2026-06-12; modes shipped 2026-06-13; evaluate shipped 2026-06-17):** the iteration-mode items (bl-5d49, bl-7af0) are now **done and merged to `main`** (PR #9) — both parallel modes, synthesizer selection, and the agency-gated escalation ladder, and the synthesis-mediation design gate resolved as a two-tier model (DR-018). `consensus-evaluate` (bl-5174) is now **done** as the first family skill after refine. The remaining family-skill items build on the same wrapper pattern, with synthesized-mode wrappers depending on `parallel_synthesized` (see `../roadmap.md`, consensus lane).
- **Dev tooling — TypeScript + vitest (seeded 2026-06-14; toolchain delivered 2026-06-15; runner retirement 2026-06-18):** bl-853a and bl-bfb4 are both now **done**. PR4 (`repo-tooling-vitest-final-cleanup`) retired the `node:test` runner: all repo/tooling `.test.mjs` suites converted to Vitest `.test.ts`, `node:assert` harmonized to `expect` across session-observer suites, `pnpm test` simplified to Vitest-only, and a guard (`tests/tooling/no-node-test-runner.test.ts`) added to enforce the single-runner policy. Shipped skills remain dependency-free/install-free via the generated-runtime and provider-CLI policies in DR-020/DR-023. A follow-on **test-organization cleanup** (branch-implemented, pending its PR) reorganized the Vitest suite for maintainability — shared `tests/helpers/`, domain directories (`tests/consensus/{core,refine,evaluate}/`, `tests/repo/`, `tests/release/`, `tests/tooling/`), and two oversized suites split — behavior-preserving, no runtime changes. Deferred and promotable on demand: a deeper typed-test-fixture pass for residual `as any` shims, and per-domain Vitest projects / coverage reporting if the suite grows.
- **Release:** bl-d85f (v0.1 verification + tag) is **done** — all gates closed on 2026-06-20. Automated suite re-run green at tag time (72 files / 726 tests), CHANGELOG `[0.1.0]` dated + `bump-version.mjs 0.1.0` applied with `--check-tag v0.1.0` clean, README install matrix re-confirmed against live provider CLIs, and interactive provider permission/runtime smokes completed (Claude Code + Cursor approved a `node` exec prompt; Codex ran under its sandboxed exec path, which by design does not prompt for read-only commands). Deliberation-behavior gates were reused from PR #9 + suite-confirmed, not re-run. v0.1.0 tagged from `main`; post-tag skills.sh/public discovery remains a non-claim until verified after publication (recorded in `current-state.md`).
- **Provider CLI / peer invocation (seeded 2026-06-13; shipped 2026-06-19):** bl-bb7e is now **done**. Refine/Evaluate new runs use the owned `consensus` provider CLI for provider inventory, preflight, bounded subprocess execution, provider-neutral diagnostics, schema delivery, and retry/cap/timeout ownership. Cursor authenticated peer E2E through the provider CLI is now **done** (bl-f0b6): Refine and Evaluate both converged with `--peers cursor,codex` after the prompt-only schema-delivery fix. Remaining follow-ups are narrower: bl-3a88 for a future submit-tool/self-validation path. Two further follow-ups were seeded 2026-06-19 from the project's design deferrals: **bl-3291** (refine `PROVIDER_EXIT` retry classification — transient vs terminal via stderr/signature matching, `design.md:564`) and **bl-3ca6** (low-priority seed to define the reserved host-native dispatch / safe-packet protocol before any adapter sets `supports_host_native_dispatch: true`, `design.md:159`). **bl-e0e7** tracks the plugin-local shared generated-runtime cleanup, gated by an install-shape spike proving shared scripts work in Cursor, Copilot, Claude, and Codex plugin layouts.
- **Advisory peer utility (seeded 2026-06-20):** **bl-22d3** tracks a lightweight `phone-a-friend` / `phone-friend` skill that uses the provider CLI for a one-shot structured second opinion. This is intentionally advisory, not a full Refine/Evaluate deliberation loop.
- **Multi-agent collaboration substrate (vault Ideas cluster, 2026-06-19; seeded to backlog 2026-06-19):** a proposed lane *beneath* the consensus deliberation engine — how agents observe and talk to each other on one project, extending the shipped `session-observer` skill. **bl-4e2e** (foundation: become-observable daemon + merged shared session log) → **bl-f59f** (inter-agent direct messaging, depends on bl-4e2e). Orchestration (work-claiming, dependency DAGs, message bus) stays a vault stub until messaging hits real limits. Source notes live under `02 - Projects/Skills/Ideas/2026-06-19-*` with `cass` prior-art in `…/Research/`. Sequenced **after** TS/test foundation hardening — promote priority when that lands. See `../roadmap.md` Later lane.
- **v3 cold-start prerequisite + reserved extension (seeded 2026-06-19):** **bl-2ed7** pulls the deferred `independent_draft` cold-start strategy out of bl-b9b9 into its own shared-`consensus-loop` item because create/decide/plan (bl-b9b9/bl-87ef/bl-0cb8) all default to it and it gates all three. **bl-f8cb** is a low-priority seed for the parked v3 "3+ peer" extension so the two-peer constraint is explicit.
- **v3 "for discussion" seeds (2026-06-19):** two minor v3 open questions parked as undecided-if-needed so they are not lost — **bl-58b3** (first-class `type=edit` mid-loop user artifact edits vs the existing artifact-edit-then-resume path) and **bl-db5d** (opt-in `--sections auto-llm` LLM section auto-chunking vs the deterministic heading/marker fallback). Both may resolve `wont_do`; decide before building.
- **Skill authoring conformance + guided rubrics (shipped 2026-06-19):** consensus-rubric-guidance brought `refine` + `evaluate` to authoring best-practice parity (When NOT to Use / Examples / Success Criteria, `argument-hint`, validator-backed top-level `version` synced with `metadata.version` — DR-022, enforced by `validate.mjs` + `bump-version.mjs`), and added host-model-driven guided rubric creation plus four bundled example rubrics for `evaluate`. One ship-safe follow-up filed: bl-3913 (a test guarding the bundled examples at `<=12` parser-visible criteria).
- **Documentation site (seeded 2026-06-20):** **bl-ecaa** captures standing up a dedicated docs site and slimming the increasingly dense `README.md` to a lean entry point. Intended as a **single OAT project** in two phases — scaffold via the user-invoked `oat-docs-bootstrap` skill (Fumadocs vs MkDocs decision), then migrate/curate README content into the site via `oat-docs-analyze`/`oat-docs-apply` (the OAT docs skills carry the IA). Sequenced **after** bl-d85f so the doc restructure does not churn the tag-time README install-matrix gate.

<!-- OAT BACKLOG-INDEX -->
| ID | Title | Status | Priority | Scope | Estimate |
| --- | --- | --- | --- | --- | --- |
| bl-5d49 | Add parallel-revision iteration mode to consensus-loop | done | high | feature | M |
| bl-7af0 | Add parallel-synthesized iteration mode (synthesis-mediation design gate) | done | high | feature | L |
| bl-d85f | Complete v0.1 release verification and tag | done | high | task | M |
| bl-b9b9 | Add consensus-create skill (artifact from brief) | open | medium | feature | M |
| bl-87ef | Add consensus-decide skill (recommend among options) | open | medium | feature | S |
| bl-5174 | Add consensus-evaluate skill (artifact vs rubric) | done | medium | feature | S |
| bl-0cb8 | Add consensus-plan skill (structured plan from goal) | open | medium | feature | S |
| bl-22d3 | Add phone-a-friend advisory peer skill | open | medium | feature | M |
| bl-2ed7 | Implement independent_draft cold-start strategy in consensus-loop | open | medium | feature | M |
| bl-f59f | Inter-agent direct messaging (addressable, prioritized) | open | medium | feature | M |
| bl-bb7e | Investigate in-house peer-invocation CLI to reduce/replace the external peer-run dependency | done | medium | initiative | L |
| bl-bfb4 | Migrate consensus + tests to real TypeScript types | done | medium | initiative | L |
| bl-3291 | Refine provider-exit retry classification (transient vs terminal) | open | medium | task | M |
| bl-e0e7 | Share consensus generated runtime output at the plugin level | open | medium | task | M |
| bl-4e2e | Shared session log substrate (become-observable daemon + merged log) | open | medium | initiative | L |
| bl-ecaa | Stand up a documentation site and slim the README | closed | medium | initiative | M |
| bl-853a | Stand up TypeScript + vitest build toolchain (bundle-to-mjs) | done | medium | feature | M |
| bl-3a88 | Tool-based verdict submission for consensus peers (future reliability hardening) | open | medium | feature | L |
| bl-f0b6 | Verify cursor-as-peer end-to-end through provider CLI (authenticated cursor-agent) | done | medium | task | S |
| bl-3913 | Add a test guarding bundled rubric examples at <=12 parser-visible criteria | open | low | test | S |
| bl-645c | Add consensus-research skill (investigate question, synthesized findings) | open | low | feature | M |
| bl-9ed4 | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts | open | low | feature | S |
| bl-ef38 | Add similarity heuristic for near-converged deliberation states | open | low | feature | S |
| bl-e39a | Add whole-document harmonization pass after section convergence | open | low | feature | M |
| bl-3ca6 | Define host-native dispatch / safe-packet protocol (reserved seam) | open | low | initiative | L |
| bl-db5d | LLM section auto-chunking fallback (--sections auto-llm) — for discussion | open | low | idea | S |
| bl-58b3 | Mid-loop user artifact edits (type=edit intervention) — for discussion | open | low | idea | S |
| bl-f8cb | Multi-peer (3+) deliberation extension (reserved / v3+ concern) | open | low | idea | L |
<!-- END OAT BACKLOG-INDEX -->

## Notes

- Active item files live in `backlog/items/`
- Archived item files live in `backlog/archived/`
- Historical completions are summarized in `backlog/completed.md`
