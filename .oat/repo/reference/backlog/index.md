# OAT Backlog Index

> Generated backlog table lives inside the managed section below. Keep curated narrative updates in the overview section so CLI regeneration stays safe.

## Curated Overview

- **Consensus Phase 2 + family (seeded 2026-06-12; modes shipped 2026-06-13; evaluate shipped 2026-06-17):** the iteration-mode items (bl-5d49, bl-7af0) are now **done and merged to `main`** (PR #9) — both parallel modes, synthesizer selection, and the agency-gated escalation ladder, and the synthesis-mediation design gate resolved as a two-tier model (DR-018). `consensus-evaluate` (bl-5174) is now **done** as the first family skill after refine. The remaining family-skill items build on the same wrapper pattern, with synthesized-mode wrappers depending on `parallel_synthesized` (see `../roadmap.md`, consensus lane).
- **Dev tooling — TypeScript + vitest (seeded 2026-06-14; toolchain delivered 2026-06-15; runner retirement 2026-06-18):** bl-853a and bl-bfb4 are both now **done**. PR4 (`repo-tooling-vitest-final-cleanup`) retired the `node:test` runner: all repo/tooling `.test.mjs` suites converted to Vitest `.test.ts`, `node:assert` harmonized to `expect` across session-observer suites, `pnpm test` simplified to Vitest-only, and a guard (`tests/tooling/no-node-test-runner.test.ts`) added to enforce the single-runner policy. Shipped skills remain dependency-free/install-free via the generated-runtime and provider-CLI policy in DR-020/DR-022. A follow-on **test-organization cleanup** (branch-implemented, pending its PR) reorganized the Vitest suite for maintainability — shared `tests/helpers/`, domain directories (`tests/consensus/{core,refine,evaluate}/`, `tests/repo/`, `tests/release/`, `tests/tooling/`), and two oversized suites split — behavior-preserving, no runtime changes. Deferred and promotable on demand: a deeper typed-test-fixture pass for residual `as any` shims, and per-domain Vitest projects / coverage reporting if the suite grows.
- **Release:** bl-d85f (v0.1 verification + tag) is in progress on the release-verification branch. Current automated gates, release workflow parity, version/tag checks, and local Claude/Codex install evidence are refreshed; PR #9 remains reused evidence for live `consensus-refine` mode/escalation dogfood. Remaining gates are interactive provider permission prompts, Cursor locked-keychain/provider-error resolution, and post-tag skills.sh/public discovery verification before public claims.
- **Provider CLI / peer invocation (seeded 2026-06-13; shipped 2026-06-19):** bl-bb7e is now **done**. Refine/Evaluate new runs use the owned `consensus` provider CLI for provider inventory, preflight, bounded subprocess execution, provider-neutral diagnostics, schema delivery, and retry/cap/timeout ownership. Remaining follow-ups are narrower: bl-3a88 for a future submit-tool/self-validation path and bl-f0b6 for authenticated Cursor end-to-end verification through the provider CLI. Two further follow-ups were seeded 2026-06-19 from the project's design deferrals: **bl-3291** (refine `PROVIDER_EXIT` retry classification — transient vs terminal via stderr/signature matching, `design.md:564`) and **bl-3ca6** (low-priority seed to define the reserved host-native dispatch / safe-packet protocol before any adapter sets `supports_host_native_dispatch: true`, `design.md:159`).

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
| bl-bb7e | Investigate in-house peer-invocation CLI to reduce/replace the external peer-run dependency | done | medium | initiative | L |
| bl-bfb4 | Migrate consensus + tests to real TypeScript types | done | medium | initiative | L |
| bl-3291 | Refine provider-exit retry classification (transient vs terminal) | open | medium | task | M |
| bl-853a | Stand up TypeScript + vitest build toolchain (bundle-to-mjs) | done | medium | feature | M |
| bl-3a88 | Tool-based verdict submission for consensus peers (future reliability hardening) | open | medium | feature | L |
| bl-f0b6 | Verify cursor-as-peer end-to-end through provider CLI (authenticated cursor-agent) | open | medium | task | S |
| bl-645c | Add consensus-research skill (investigate question, synthesized findings) | open | low | feature | M |
| bl-9ed4 | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts | open | low | feature | S |
| bl-ef38 | Add similarity heuristic for near-converged deliberation states | open | low | feature | S |
| bl-e39a | Add whole-document harmonization pass after section convergence | open | low | feature | M |
| bl-3ca6 | Define host-native dispatch / safe-packet protocol (reserved seam) | open | low | initiative | L |
<!-- END OAT BACKLOG-INDEX -->

## Notes

- Active item files live in `backlog/items/`
- Archived item files live in `backlog/archived/`
- Historical completions are summarized in `backlog/completed.md`
