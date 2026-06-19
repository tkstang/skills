# OAT Backlog Index

> Generated backlog table lives inside the managed section below. Keep curated narrative updates in the overview section so CLI regeneration stays safe.

## Curated Overview

- **Consensus Phase 2 + family (seeded 2026-06-12; modes shipped 2026-06-13; evaluate shipped 2026-06-17):** the iteration-mode items (bl-5d49, bl-7af0) are now **done and merged to `main`** (PR #9) — both parallel modes, synthesizer selection, and the agency-gated escalation ladder, and the synthesis-mediation design gate resolved as a two-tier model (DR-018). `consensus-evaluate` (bl-5174) is now **done** as the first family skill after refine. The remaining family-skill items build on the same wrapper pattern, with synthesized-mode wrappers depending on `parallel_synthesized` (see `../roadmap.md`, consensus lane).
- **Dev tooling — TypeScript + vitest (seeded 2026-06-14; toolchain delivered 2026-06-15; runner retirement 2026-06-18):** bl-853a and bl-bfb4 are both now **done**. PR4 (`repo-tooling-vitest-final-cleanup`) retired the `node:test` runner: all repo/tooling `.test.mjs` suites converted to Vitest `.test.ts`, `node:assert` harmonized to `expect` across session-observer suites, `pnpm test` simplified to Vitest-only, and a guard (`tests/tooling/no-node-test-runner.test.ts`) added to enforce the single-runner policy. Shipped skills remain dependency-free/install-free via the generated-runtime and provider-CLI policy in DR-020/DR-022. A follow-on **test-organization cleanup** (branch-implemented, pending its PR) reorganized the Vitest suite for maintainability — shared `tests/helpers/`, domain directories (`tests/consensus/{core,refine,evaluate}/`, `tests/repo/`, `tests/release/`, `tests/tooling/`), and two oversized suites split — behavior-preserving, no runtime changes. Deferred and promotable on demand: a deeper typed-test-fixture pass for residual `as any` shims, and per-domain Vitest projects / coverage reporting if the suite grows.
- **Release:** bl-d85f (v0.1 verification + tag) is in progress on the release-verification branch. Current automated gates, release workflow parity, version/tag checks, and local Claude/Codex install evidence are refreshed; PR #9 remains reused evidence for live `consensus-refine` mode/escalation dogfood. Remaining gates are interactive provider permission prompts, Cursor locked-keychain/provider-error resolution, and post-tag skills.sh/public discovery verification before public claims.
- **Provider CLI / peer invocation (seeded 2026-06-13; shipped 2026-06-19):** bl-bb7e is now **done**. Refine/Evaluate new runs use the owned `consensus` provider CLI for provider inventory, preflight, bounded subprocess execution, provider-neutral diagnostics, schema delivery, and retry/cap/timeout ownership. Remaining follow-ups are narrower: bl-3a88 for a future submit-tool/self-validation path and bl-f0b6 for authenticated Cursor end-to-end verification through the provider CLI. Two further follow-ups were seeded 2026-06-19 from the project's design deferrals: **bl-3291** (refine `PROVIDER_EXIT` retry classification — transient vs terminal via stderr/signature matching, `design.md:564`) and **bl-3ca6** (low-priority seed to define the reserved host-native dispatch / safe-packet protocol before any adapter sets `supports_host_native_dispatch: true`, `design.md:159`).
- **Multi-agent collaboration substrate (vault Ideas cluster, 2026-06-19; seeded to backlog 2026-06-19):** a proposed lane *beneath* the consensus deliberation engine — how agents observe and talk to each other on one project, extending the shipped `session-observer` skill. **bl-4e2e** (foundation: become-observable daemon + merged shared session log) → **bl-f59f** (inter-agent direct messaging, depends on bl-4e2e). Orchestration (work-claiming, dependency DAGs, message bus) stays a vault stub until messaging hits real limits. Source notes live under `02 - Projects/Skills/Ideas/2026-06-19-*` with `cass` prior-art in `…/Research/`. Sequenced **after** TS/test foundation hardening — promote priority when that lands. See `../roadmap.md` Later lane.
- **v3 cold-start prerequisite + reserved extension (seeded 2026-06-19):** **bl-2ed7** pulls the deferred `independent_draft` cold-start strategy out of bl-b9b9 into its own shared-`consensus-loop` item because create/decide/plan (bl-b9b9/bl-87ef/bl-0cb8) all default to it and it gates all three. **bl-f8cb** is a low-priority seed for the parked v3 "3+ peer" extension so the two-peer constraint is explicit.

<!-- OAT BACKLOG-INDEX -->
| ID | Title | Status | Priority | Scope | Estimate |
| --- | --- | --- | --- | --- | --- |
| bl-5d49 | Add parallel-revision iteration mode to consensus-loop | done | high | feature | M |
| bl-7af0 | Add parallel-synthesized iteration mode (synthesis-mediation design gate) | done | high | feature | L |
| bl-d85f | Complete v0.1 release verification and tag | open | high | task | M |
| bl-b9b9 | Add consensus-create skill (artifact from brief) | open | medium | feature | M |
| bl-87ef | Add consensus-decide skill (recommend among options) | open | medium | feature | S |
| bl-5174 | Add consensus-evaluate skill (artifact vs rubric) | done | medium | feature | S |
| bl-0cb8 | Add consensus-plan skill (structured plan from goal) | open | medium | feature | S |
| bl-2ed7 | Implement independent_draft cold-start strategy in consensus-loop | open | medium | feature | M |
| bl-f59f | Inter-agent direct messaging (addressable, prioritized) | open | medium | feature | M |
| bl-bb7e | Investigate in-house peer-invocation CLI to reduce/replace the external peer-run dependency | done | medium | initiative | L |
| bl-bfb4 | Migrate consensus + tests to real TypeScript types | done | medium | initiative | L |
| bl-3291 | Refine provider-exit retry classification (transient vs terminal) | open | medium | task | M |
| bl-4e2e | Shared session log substrate (become-observable daemon + merged log) | open | medium | initiative | L |
| bl-853a | Stand up TypeScript + vitest build toolchain (bundle-to-mjs) | done | medium | feature | M |
| bl-3a88 | Tool-based verdict submission for consensus peers (future reliability hardening) | open | medium | feature | L |
| bl-f0b6 | Verify cursor-as-peer end-to-end through provider CLI (authenticated cursor-agent) | open | medium | task | S |
| bl-645c | Add consensus-research skill (investigate question, synthesized findings) | open | low | feature | M |
| bl-9ed4 | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts | open | low | feature | S |
| bl-ef38 | Add similarity heuristic for near-converged deliberation states | open | low | feature | S |
| bl-e39a | Add whole-document harmonization pass after section convergence | open | low | feature | M |
| bl-3ca6 | Define host-native dispatch / safe-packet protocol (reserved seam) | open | low | initiative | L |
| bl-f8cb | Multi-peer (3+) deliberation extension (reserved / v3+ concern) | open | low | idea | L |
<!-- END OAT BACKLOG-INDEX -->

## Notes

- Active item files live in `backlog/items/`
- Archived item files live in `backlog/archived/`
- Historical completions are summarized in `backlog/completed.md`
