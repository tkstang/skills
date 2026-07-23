---
oat_status: complete
oat_ready_for: plan
oat_blockers: []
oat_last_updated: 2026-07-23
oat_generated: false
---

# Discovery: wave-3-execution

Quick-mode wrapper for Wave 3 of the 2026-07-22 execution program. Requirements
live in the two immutable external plans; pattern per waves 1-2 (summaries in
`.oat/repo/reference/project-summaries/`).

## This wave's decisions

- Two lanes, one group (recon-verified disjoint); ceiling 4 (2 used).
- Cross-model review on p01 only (high blast-radius refactor); p02 has
  deterministic behavioral-test gates.
- Adopted rules active (waves 1-2): no bare `--` DoD; codex `-o` fallback + MAX
  TWO rounds; sanctioned-addenda gate context; reviewers may return artifacts
  for orchestrator persistence; GIT_* scrub per `gitEnv()` precedent.
- Operator directive unchanged: autonomous, xhigh final gate (sol unavailable —
  default model substitutes, flagged), full completion tail, PR → CI → merge →
  wave-close.
