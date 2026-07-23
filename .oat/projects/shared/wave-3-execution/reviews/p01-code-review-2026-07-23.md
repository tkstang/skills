# p01 Code Review — Consolidate consensus CLI helpers (wave-3/p01)

**Branch:** wave-3/p01 (b90ebac, dfcb9ea, 7674ed1, c31641d, ae8d951) vs base 06eaf60
**Contract:** `.oat/repo/reference/external-plans/2026-07-17-consolidate-consensus-cli-helpers.md`
**Reviewer:** read-only phase reviewer (Opus-class); artifact persisted by the orchestrator
**Disposition:** APPROVE — merge-ready. No findings requiring action.

## Headline ruling — the panel exclusion: ACCEPTED

Non-narrowing intentionally-divergent classification, guard-enforced. Verified:
(a) panel is genuinely decoupled (own PANEL_EXIT_CODES :27 / PanelError :198;
imports nothing from consensus-loop or the shared module); (b) the shared module
hard-depends on the loop (cli-helpers.ts:11 imports ConsensusError/EXIT_CODES) —
a panel import would transitively load the loop, regressing the decoupling;
(c) the plan's out-of-scope sanctions documented intentional divergence, and a
two-module redesign expands scope. Panel's ~10 duplicated helpers are trivial,
stable, and it never had the confineWrite/atomicWriteFile trio. The c31641d
guard ENFORCES the decoupling — a strengthening. Optional follow-up (backlog):
extract a loop-free `cli-helpers-core.ts` with the pure helpers; both panel and
the loop-coupled layer import it.

## Checklist verification (all PASS)

1. Purity bar: 6/17 spot-diffed byte-identical vs base originals; the one
   normalized annotation is type-only/emit-identical; build:check all in sync.
2. Step-2 tightening: loop imports the bounded/validated canonical parsers;
   loop-cli tests updated + new reject/pass cases; commit body documents the
   deliberate user-visible tightening and the not-load-bearing argument.
3. Name-collision: loop's private 2-arg atomicWriteFile untouched; loop imports
   only the two parsers from shared; no ambiguous scope.
4. Fan-out (Codex R1 fix): per-skill copies for the four commands + plugin-root
   copy for the loop; generated wrapper imports verified; ignore lists gained
   all five paths; sync + guard + loop-cli suites 42/42.
5. Guards effective: re-fork guard (redeclaration scan + surface assertion) and
   panel-decoupling guard (no loop/shared import in panel) both confirmed by
   reading.
6. Skill bumps: create/decide/plan 0.1.6, evaluate 0.1.9, refine 0.1.8 (both
   fields); panel correctly unbumped.
7. Build/test: build:check in sync; tests/consensus 600 passed / 1 skipped;
   tree clean.

## Codex round dispositions (verified)

R1 fan-out Important → fixed (c31641d, confirmed in R2). R1 panel Important →
rejected with reasons, hardened with the guard; ruling above ACCEPTS. R2 dead
imports Medium → fixed (ae8d951).

## Findings requiring action

None.
