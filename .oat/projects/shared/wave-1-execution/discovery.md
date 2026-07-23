---
oat_status: complete
oat_ready_for: plan
oat_blockers: []
oat_last_updated: 2026-07-23
oat_generated: false
---

# Discovery: wave-1-execution

Quick-mode wrapper project for Wave 1 of the 2026-07-22 execution program
(`.oat/repo/reference/external-plans/2026-07-22-execution-program.md`). Discovery
is inherited, not re-derived: the requirements live in the four immutable external
plans and the program artifact.

## Inherited contract

- Each phase's entire implementation contract is its external plan; the wrapper
  adds only ordering, gates, and bookkeeping (see `plan.md` execution contract).
- External plans are immutable inputs — reviewers review the code against them,
  never the plans themselves.
- Program layer (`oat-wave-program`) owns the wave map; this project reports back
  via `wave-close wave-1` at closeout.

## This wave's decisions

- **Branch base deviation:** `wave-1-execution` branches from `repo-improve-2`
  tip `36e37fb` (= origin/main + the execution-program commit) rather than
  origin/main directly, so the program artifact rides into main with this wave's
  PR. Logged in `orchestration-log.md`.
- **Concurrency ceiling 4** (operator-approved program sizing) — one group of
  four write-disjoint lanes rather than the skill-default 3.
- **Cross-model reviews** on p01 (write durability), p02 (security/containment),
  p03 (locking); p04 is docs-only.
- **Operator directive (2026-07-23):** full autonomous program execution — per
  wave: docs updated where necessary, final Codex sol xhigh review gate on the
  wave's final code (manual `codex exec` fallback), full `oat-project-complete`,
  PR, CI green, merge, then `wave-close` and the next wave. Program recap at
  program end with an Opus subagent involved. (The sol xhigh gate is an
  operator-pinned closeout gate, out of band of the plan's Dispatch Profile;
  lane dispatch remains runtime-resolved under the managed policy.)
