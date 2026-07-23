---
oat_generated: false
oat_last_updated: 2026-07-23
---

# Project Summary: wave-2-execution

Wave 2 of the 2026-07-22 repo-audit execution program: four external plans as a
write-disjoint parallel group of three plus one ungrouped sequential lane
(AGENTS.md overlap), all merged conflict-free.

## What shipped

1. **Consensus subprocess hardening** — both `runProviderCliCommand` twins gain
   the stdin failed-spawn guard, optional deadline with SIGTERM→SIGKILL
   escalation, and a final-resolution safety net that destroys stdio handles
   when a descendant holds the pipes after kill. Behavior unchanged when no
   timeout is set; primitive is inert until a caller wires `timeoutMs` (noted
   for a future default-timeout policy decision). refine 0.1.7, evaluate 0.1.8,
   panel 0.1.2.
2. **Watch-loop classification cache** — `(path, mtimeMs, size)`-keyed cache
   holding classification + meta from one `readRecords` pass, threaded through
   watch-loop discovery; unchanged transcripts are no longer re-read every 2s
   tick. LRU cap 5000 (workload-sized). session-observer 1.0.7,
   export-session-transcript 1.0.4 (shared runtimes source).
3. **SKILL_FILES disk derivation** — `bump-version.mjs` derives its skill list
   via the new shared `scripts/lib/discover-skills.mjs` (same contract as the
   validators); completeness pinned by an independent-glob test + snapshot that
   provably fails on skill-set changes.
4. **Import-rewrite derivation + ignore-list guard** — all 14 hand-written
   `importRewrites` arrays replaced by TS-compiler-API derivation (0 mismatches
   across 27 mappings; byte-equivalent generated tree); loud-throw failure
   modes; the plan's guard-test ask was satisfied by pre-existing coverage in
   `generated-output-sync.test.ts` (stale plan premise, reviewer-verified).

Net: 1134 tests passing (+20 this wave). Zero merge conflicts.

## Review chain

Plan gate: 4 findings (incl. a real YAML break and a group-composition
correction forcing p04 ungrouped) → all fixed → passed. Phase reviews: p01 PASS
(Opus; 2 Codex rounds verified; 3 scope expansions judged within-outcome;
double-settle probe), p02 PASS (Codex meta-read Important verified; torn-read
race judged self-healing), p03 PASS, p04 PASS (stale-premise deviation verified
legitimate). 6 real defects fixed pre-merge via cross-model rounds.

## Workflow Observations

- All wave-1 adopted rules earned out (no pnpm `--` failures, no false gate
  Criticals, codex fallback unused-but-ready).
- New rule adopted: MAX TWO codex rounds per lane; the phase reviewer owns fix
  verification (p01 entered a third round before being capped).
- The plan gate's group-composition catch (shared-file lanes must be in
  separate groups) prevented a contract violation the orchestrator had
  rationalized as "sequenced merges" — gates reviewing the wrapper earn their
  cost.
- Stale plan premises surfaced twice and were handled as evidence-backed
  bounded deviations; plan-authoring signal: inventory existing tests for a
  mandated property before requiring new test files.

## Follow-ups

- Optional: directory-mtime short-circuit for watch discovery (carried in
  BL-260718-cache-transcript archive summary).
- Optional: structural enforcement for import-rewrite fan-out proximity
  assumption (p04 review F1, informational).
