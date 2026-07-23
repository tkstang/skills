---
oat_generated: true
oat_external_plan_index: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
created: '2026-07-17T23:39:00Z'
---

# External Plan Index: 2026-07-17 repository audit

This index records selection and ordering. It is not an executable plan and is
not an `oat-project-import-plan` target.

## Selection

- Source: fresh six-lane repo audit (correctness, security, tests, architecture, deps/DX, docs/direction) at commit `8309623`, standard effort, full-repo scope excluding `.agents/`, `.claude/`, `.codex/`, `.cursor/` at any depth. All load-bearing findings were re-verified against live code by the orchestrator before planning.
- Selected: the operator selected all vetted candidates (C1–C13 as plans; C14 as an escalation, below). Highest-leverage set: the four verified correctness/security fixes (recursion guard, atomic records, observer state, subprocess hardening) plus the docs staleness sweep.
- Deferred/rejected (recorded, not planned): TEST-05 smoke-scope labeling (overlapping coverage exists; one optional doc sentence noted inside the docs-sweep plan); TEST-06 classifier unit tests (diagnosability nicety, indirect coverage exists); DEPS-01/DEPS-02 dependency-version alignment and routine updates (no security signal; DEPS-01 partially mitigated by the docs PR gate plan's scope note); DIR-01–DIR-04 direction findings — each maps onto an existing open backlog item (`BL-260612-add-consensus-research-skill`, `BL-260713-stronger-cursor-collaboration`, `BL-260619-shared-session-log-substrate`, `BL-260612-add-deliberation-metrics`); plan those by running `oat-repo-improve` in `backlog-item`/`backlog-review` mode so tracking is not duplicated.
- Unaudited or lighter coverage (lane-reported): `consensus-refine.ts` body beyond spot checks (correctness lane); `src/transcript/session-observer/lib/{watch,observe,locate}.ts` full-depth security pass; `scripts/worktree/*` internals (deps/DX lane); the ~40 uncited decision records (docs lane). Agent-config directories were excluded by scope policy.

## Escalation review (C14 — resolved 2026-07-18)

- **C14 — Split the god modules** (`src/consensus/core/consensus-loop.ts`, 3,961 lines / `src/consensus/refine/consensus-refine.ts`, 3,890 lines; ~6-7× repo median): originally escalated as project-sized. On operator review, downgraded to two bounded external plans (rows 14–15 below): the work is a behavior-preserving mechanical refactor with a single coherent verification boundary (existing deep test suites + `build:check` + `smoke`), the module seams are already visible in the code, and the single-shared-output build mapping for `consensus-loop.ts` means a re-export facade leaves every consumer untouched. The residual non-mechanical cost (build-mapping fan-out) is handled by sequencing after plan 8. What a project would have added — deliberated boundary design — is pinned instead by each plan's inventory/cluster-map step and verbatim-move constraints.

## Recommended order

| Order | Plan | Source finding | Depends on | Tracking | Rationale |
| --- | --- | --- | --- | --- | --- |
| 1 | [Atomic consensus records writes](./2026-07-17-atomic-consensus-records-writes.md) | CORR-01 | — | BL-260718-make-consensus-records | Smallest fix for the worst failure mode (permanent session loss); touches `consensus-loop.ts` first in the serial chain |
| 2 | [Consensus subprocess hardening](./2026-07-17-consensus-subprocess-hardening.md) | ARCH-02, CORR-03 | after 1 (same file) | BL-260718-harden-consensus-wrapper | Removes indefinite-hang risk on the wrapper path before consolidation churns the same code |
| 3 | [Consolidate consensus CLI helpers](./2026-07-17-consolidate-consensus-cli-helpers.md) | ARCH-01 | after 2 (same files) | BL-260718-consolidate-duplicated | Dedup after the hardening pattern exists once; reconciles confirmed `parsePeers` drift |
| 4 | [Cross-provider recursion guard](./2026-07-17-cross-provider-recursion-guard.md) | SEC-01 | — (parallel lane) | BL-260718-enforce-recursion-depth-across | Security-consequential; independent of the consensus-loop chain (provider-cli subsystem) |
| 5 | [Session-observer state robustness](./2026-07-17-session-observer-state-robustness.md) | CORR-02, CORR-04 | — (parallel lane) | BL-260718-session-observer-stale-lock | Independent subsystem; unwedges a silent persistence failure |
| 6 | [Watch-loop classification cache](./2026-07-17-watch-loop-classification-cache.md) | PERF-01 | after 5 (same files) | BL-260718-cache-transcript | Same lib as 5; rebases trivially on it |
| 7 | [SKILL_FILES disk derivation](./2026-07-17-skill-files-disk-derivation.md) | ARCH-05, TEST-03 | — | BL-260718-derive-bump-version-skill-list | Small, closes a silent release-metadata trap |
| 8 | [Derive generated ignore lists](./2026-07-17-derive-generated-ignore-lists.md) | ARCH-04, ARCH-06, DX-04 | — | BL-260718-guard-generated-ignore-lists | Locks the lockstep-config trap before plan 3 adds new generated outputs (if run before 3, its guard test protects that change too) |
| 9 | [Docs staleness sweep](./2026-07-17-docs-staleness-sweep.md) | DOCS-01–05, DX-01, ARCH-07 | — | BL-260718-sync-stale-top-level | Cheap accuracy catch-up; do before the next release cuts a changelog |
| 10 | [Docs PR CI gate](./2026-07-17-docs-pr-ci-gate.md) | DX-02 | — | BL-260718-add-pr-time-ci-gate | Stops post-merge-only docs breakage |
| 11 | [Supply-chain/CI hardening](./2026-07-17-supply-chain-ci-hardening.md) | SEC-02, SEC-03, DX-03 | — | BL-260718-harden-install-and-ci-supply | Three separable steps bundled; coordinate action-pin style with 10 |
| 12 | [Worktree and hook tests](./2026-07-17-worktree-and-hook-tests.md) | TEST-01, TEST-02, DX-05 | — | BL-260718-execute-worktree-scripts | Behavioral safety net for the documented pre-merge tooling |
| 13 | [Live-provider E2E visibility](./2026-07-17-live-provider-e2e-visibility.md) | TEST-04 | — | BL-260718-surface-the-live-provider-e2e | Makes the stub-vs-reality gap a deliberate release decision |
| 14 | [Split consensus-loop module](./2026-07-18-split-consensus-loop-module.md) | ARCH-03 | after 3 (chain A); ideally after 8 | BL-260718-split-consensus-loop-into | Facade split, leaf-cluster-first, one green commit per extraction |
| 15 | [Split consensus-refine module](./2026-07-18-split-consensus-refine-module.md) | ARCH-03 | after 3 (same file); ideally after 8 | BL-260718-split-consensus-refine-into | Same method; independent of 14; requires `refine` SKILL.md bump |

## Dependency notes

- **Serial chain A (consensus-loop):** plans 1 → 2 → 3 all edit `src/consensus/core/consensus-loop.ts` (3 also edits the five command modules). Execute in order; each leaves the tree green independently.
- **Serial chain B (session-observer lib):** plans 5 → 6 both edit `src/transcript/session-observer/lib/locate.ts`. Execute in order.
- **Workflow-file overlap:** plans 10 and 11 both touch `.github/workflows/`; either order works, but the second should adopt the first's action-pinning style.
- Everything else is parallelizable across worktrees. Plans touching generated outputs (1–6) each carry their own skill-version-bump steps; landing them in separate PRs avoids version-bump collisions on the same SKILL.md files (1, 2, 3 all bump `refine`/`evaluate` — if executed in one worktree/PR, bump once per skill for the combined change instead).
- **God-module splits (14, 15):** hard-sequenced after chain A completes (plans 1–3 edit the same files; the consolidation plan also shrinks both split inventories). Soft-sequenced after plan 8, which removes the hand-written import-rewrite burden the splits would otherwise multiply. 14 and 15 are independent of each other and can run in parallel worktrees.
