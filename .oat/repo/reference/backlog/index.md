# OAT Backlog Index

> Generated backlog table lives inside the managed section below. Keep curated narrative updates in the overview section so CLI regeneration stays safe.

## Curated Overview

- **Consensus Phase 2 + family (seeded 2026-06-12; modes shipped 2026-06-13; evaluate shipped 2026-06-17):** the iteration-mode items (bl-5d49, bl-7af0) are now **done and merged to `main`** (PR #9) — both parallel modes, synthesizer selection, and the agency-gated escalation ladder, and the synthesis-mediation design gate resolved as a two-tier model (DR-018). `consensus-evaluate` (bl-5174) is now **done** as the first family skill after refine. The remaining family-skill items build on the same wrapper pattern, with synthesized-mode wrappers depending on `parallel_synthesized` (see `../roadmap.md`, consensus lane).
- **Dev tooling — TypeScript + vitest (seeded 2026-06-14; toolchain delivered 2026-06-15):** bl-853a is now **done**: the repo has pnpm-based TypeScript, Vitest, generated `.mjs` build output, drift guards, CI/worktree validation, and the `consensus-loop` proof slice. bl-bfb4 remains **in progress**, not complete: the loop, refine wrapper, transcript-core, and export-session transcript/Vitest slices are now complete, while remaining `node:test` suites, selected long-tail runtime/test modules, and eventual `node:test` compatibility retirement remain follow-up. This still keeps shipped skills dependency-free/install-free per DR-002 (committed generated `.mjs` + drift guard).
- **Release:** bl-d85f (v0.1 verification + tag) should run after this TypeScript/vitest branch lands so tag-time checks match the source/test substrate that will ship. PR #9 already recorded substantial live claude+codex coverage across alternating, `parallel_revision`, `parallel_synthesized`, and escalation flows; reuse that as prior evidence and focus later reruns on stale/gap checks plus provider install/permission gates.
- **Paseo dependency / peer invocation (seeded 2026-06-13; updated 2026-06-15):** bl-bb7e and bl-3a88 are best treated as one later "own the peer-invocation layer" initiative. Operator lean is now toward owning the narrow claude/codex/cursor path, porting/narrowing the proven Stoa provider-adapter/final-JSON-contract approach, rather than relying on Paseo for one per-turn `run` capability. Not the immediate post-TS project; release verification and remaining typed migration slices come first.
- **Skill authoring conformance + guided rubrics (shipped 2026-06-19):** consensus-rubric-guidance brought `refine` + `evaluate` to authoring best-practice parity (When NOT to Use / Examples / Success Criteria, `argument-hint`, validator-backed top-level `version` synced with `metadata.version` — DR-022, enforced by `validate.mjs` + `bump-version.mjs`), and added host-model-driven guided rubric creation plus four bundled example rubrics for `evaluate`. One ship-safe follow-up filed: bl-3913 (a test guarding the bundled examples at `<=12` parser-visible criteria).

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
| bl-bb7e | Investigate in-house peer-invocation CLI to reduce/replace the Paseo dependency | open | medium | initiative | L |
| bl-bfb4 | Migrate consensus + tests to real TypeScript types | in_progress | medium | initiative | L |
| bl-853a | Stand up TypeScript + vitest build toolchain (bundle-to-mjs) | done | medium | feature | M |
| bl-3a88 | Tool-based verdict submission for consensus peers (robust structured output) | open | medium | feature | L |
| bl-f0b6 | Verify cursor-as-peer end-to-end through Paseo (authenticated cursor-agent) | open | medium | task | S |
| bl-3913 | Add a test guarding bundled rubric examples at <=12 parser-visible criteria | open | low | test | S |
| bl-645c | Add consensus-research skill (investigate question, synthesized findings) | open | low | feature | M |
| bl-9ed4 | Add deliberation metrics (tokens, wall-clock, rounds) to artifacts | open | low | feature | S |
| bl-ef38 | Add similarity heuristic for near-converged deliberation states | open | low | feature | S |
| bl-e39a | Add whole-document harmonization pass after section convergence | open | low | feature | M |
<!-- END OAT BACKLOG-INDEX -->

## Notes

- Active item files live in `backlog/items/`
- Archived item files live in `backlog/archived/`
- Historical completions are summarized in `backlog/completed.md`
