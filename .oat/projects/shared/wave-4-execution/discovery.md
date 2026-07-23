---
oat_status: complete
oat_ready_for: plan
oat_blockers: []
oat_last_updated: 2026-07-23
oat_generated: false
---

# Discovery: wave-4-execution

Quick-mode wrapper for Wave 4 of the 2026-07-22 execution program. Pattern per
waves 1-3 (summaries under `.oat/repo/reference/project-summaries/`).

## This wave's decisions

- p01 ungrouped-FIRST and merged before the group: its SHA-pin style is a
  content input to p02/p03's new workflow files (program ordering rule +
  recon confirmation).
- Cross-model review on p01 only (security/supply-chain surface); p02/p03 are
  config-plus-docs lanes with deterministic verification.
- RELEASING.md checklist is the one sequenced shared surface (p01 then p03).
- Scaffold-readiness ordering per W3 adopted rule: plan/state stay in_progress
  until the plan gate passes (atomic flip at gate pass).
- Adopted rules active (waves 1-3). Operator directive unchanged (autonomous;
  xhigh final gate, sol unavailable → default model, flagged; full completion
  tail; PR → CI green (poll until checks REGISTER, then watch — W3 lesson) →
  merge → wave-close).
