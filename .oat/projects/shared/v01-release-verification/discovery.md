---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-06-19
oat_generated: false
---

# Discovery: v01-release-verification

## Initial Request

Verify and package the current consensus feature set for v0.1 without mixing in test-organization cleanup. Start from latest `main`, avoid creating a new worktree if the current checkout is already the intended release-verification worktree, and run backlog item `bl-d85f`.

## Current Checkout

- Current checkout: `/Users/tstang/Code/consensus-release`.
- Current branch: `consensus-release`.
- `git fetch origin main --prune` completed; `HEAD` equals `origin/main` at `d1bb916eef45a270d15c9f22ad1fbb5374f9e362`.
- The current checkout is already the intended release-verification worktree, so no new worktree is needed.

## Scope

- Execute release-gate verification for backlog item `bl-d85f`.
- Focus on provider install and permission smoke checks, README install-matrix accuracy, CHANGELOG/version/tag readiness, release workflow readiness, and public-claim gating for post-tag `skills.sh` or directory discovery.
- Refresh release notes and provider QA around both shipped v0.1 consensus skills: `consensus:refine` and `consensus:evaluate`.
- Reuse still-valid evidence from PR #9 where it remains applicable instead of repeating all live dogfood from zero.

## Out of Scope

- Test organization cleanup.
- Adding new consensus family skills.
- Hand-editing generated `.mjs` runtime files.
- Claiming public marketplace, Plugin Directory, or `skills.sh` availability before those live discovery paths are verified.

## Prior Evidence

- PR #9, merged 2026-06-13, records live Claude+Codex dogfood for `consensus-refine` across `alternating`, `parallel_revision`, `parallel_synthesized`, and escalation flows.
- The backlog item records PR #9's automated checks and live dogfood as prior release evidence to reuse after re-auditing against the TypeScript/Vitest substrate.
- TypeScript/Vitest migration is complete on current `main`; current verification must rerun the automated release gate commands against that substrate.

## Key Decisions

1. **Worktree:** Use the existing `consensus-release` worktree because it is clean and starts at current `origin/main`.
2. **Evidence Strategy:** Reuse PR #9 live dogfood only where the behavior and shipped skill scope remain unchanged; rerun current automated gates and release-specific provider/install checks.
3. **Release Claims:** Keep public discovery and marketplace claims gated until live provider/discovery checks pass.
4. **Code Scope:** Prefer documentation, release checklist, manifest/version readiness, QA evidence, and backlog/project-task capture over runtime changes. If a release blocker requires code, record it explicitly before broadening scope.

## Success Criteria

- Required automated verification passes or failures are recorded with command evidence: `pnpm run build`, `pnpm run type-check`, `pnpm run build:check`, `pnpm run test`, `pnpm run validate`, and `pnpm run smoke`.
- `RELEASING.md` is current and evidence-backed, including which evidence was reused from PR #9 and which checks were rerun now.
- README install matrix and provider-facing QA notes are accurate for both shipped consensus skills.
- CHANGELOG/version/tag readiness is accurate, including `scripts/bump-version.mjs` checks.
- Any release-blocking issue is explicit as a backlog/project task or release checklist blocker.
- PR body summarizes verified checks, reused evidence, and remaining pre-tag or post-tag work.
