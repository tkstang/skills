---
oat_status: complete
oat_ready_for: plan
oat_blockers: []
oat_last_updated: 2026-07-23
oat_generated: false
---

# Discovery: wave-2-execution

Quick-mode wrapper for Wave 2 of the 2026-07-22 execution program. Requirements
live in the four immutable external plans and the program artifact; discovery is
inherited (see wave-1's completed pattern, project summary
`.oat/repo/reference/project-summaries/20260723-wave-1-execution.md`).

## This wave's decisions

- Branch base: `wave-2-execution` from origin/main post-W1 merge, carrying the
  W1 wave-close program commit (established pattern: program bookkeeping rides
  in the wave PR).
- Ceiling 4; group 1 = p01–p03 (write-disjoint); p04 ungrouped-sequential
  after group 1 (AGENTS.md overlap with p03 → separate-group execution).
- Cross-model reviews on p01 (subprocess lifecycle) and p02 (behavior
  equivalence); p03/p04 are dev-tooling lanes with strong deterministic gates.
- Wave-1 adopted rules active: no bare `--` in DoD; codex `-o` fallback
  paragraph in briefs; gate prompts state that rule-1 addenda are
  skill-sanctioned; reviewers write artifacts via bash heredoc.
- Operator directive (2026-07-23) unchanged: autonomous execution, xhigh final
  gate (sol unavailable on this account — default Codex model substitutes,
  flagged per wave), full completion tail, PR → CI → merge → wave-close.
