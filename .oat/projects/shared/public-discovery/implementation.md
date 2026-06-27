---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-27
oat_current_task_id: p04-t01
oat_generated: false
---

# Implementation: public-discovery

**Started:** 2026-06-26
**Last Updated:** 2026-06-27

> This document is used to resume interrupted implementation sessions.
>
> Conventions:
>
> - `oat_current_task_id` always points at the **next plan task to do** (not the last completed task).
> - When all plan tasks are complete, set `oat_current_task_id: null`.
> - Reviews are **not** plan tasks. Track review status in `plan.md` under `## Reviews` (e.g., `| final | code | passed | ... |`).
> - Keep phase/task statuses consistent with the Progress Overview table so restarts resume correctly.
> - Before running the `oat-project-pr-final` skill, ensure `## Final Summary (for PR/docs)` is filled with what was actually implemented.

## Progress Overview

| Phase                                  | Status      | Tasks | Completed |
| -------------------------------------- | ----------- | ----- | --------- |
| Phase 1 — Consensus standalone recovery | completed   | 5     | 5/5       |
| Phase 2 — Upstream handoff prompt       | completed   | 1     | 1/1       |
| Phase 3 — Verification & recording      | completed   | 2     | 2/2       |
| Phase 4 — Final review fixes            | in_progress | 1     | 0/1       |

**Total:** 8/9 tasks completed

---

## Phase 1: Consensus standalone recovery (cat 2)

**Status:** completed
**Started:** 2026-06-26

### Phase Summary

**Outcome (what changed):**

- Consensus skills now resolve a shared CLI from explicit path, `CONSENSUS_CLI_PATH`, plugin-relative install, then `~/.consensus/consensus.mjs`.
- All five consensus wrappers surface one actionable missing-provider-CLI error.
- `install.sh` provides a checkout-first and pinned-remote-capable alternative installer for standalone consensus skill installs.
- README documents the standalone recovery path and tests assert the README/install/resolver contract.

**Key files touched:**

- `src/consensus/core/consensus-loop.ts` - shared resolver and missing-CLI helper.
- `src/consensus/refine/consensus-refine.ts` - delegates refine preflight to shared helper.
- `plugins/consensus/skills/*` - skill versions and regenerated runtime outputs.
- `install.sh` - alternative installer.
- `README.md` - alternative-install documentation.
- `tests/consensus/**` - resolver, missing-message, installer, and contract coverage.

**Verification:**

- Run: `bash -n install.sh`; `pnpm run build:check`; `pnpm run validate`; `pnpm run validate:skill-versions --base-ref origin/main`; targeted p01 Vitest tests; `pnpm test`.
- Result: pass. Integration after fan-in also passed `pnpm test`, `pnpm lint`, `pnpm run type-check`, and `pnpm run build:check`.

**Notes / Decisions:**

- p01 re-review had 0 Critical and 0 Important findings. It recorded one Minor artifact-drift note; plan text was corrected during bookkeeping.
- `evaluate` was bumped to `0.1.3` because current `origin/main` already had `0.1.2`.

### Task p01-t01: Add `~/.consensus/` fallback to the shared CLI resolver

**Status:** completed
**Commit:** 31195d9

**Outcome (required when completed):**

- Consensus CLI resolution now falls back to `~/.consensus/consensus.mjs` when the plugin-relative shared CLI is absent.

**Files changed:**

- `src/consensus/core/consensus-loop.ts` - existence-aware resolver and shared path constant.
- `tests/consensus/core/resolve-consensus-cli-path.test.ts` - sandboxed resolver-order coverage.
- `plugins/consensus/skills/**` - regenerated outputs and version bumps.

**Verification:**

- Run: `pnpm run build`; resolver Vitest file; `pnpm run validate:skill-versions --base-ref origin/main`.
- Result: pass after the later p01 fix bumped `evaluate` for the current `origin/main`.

**Notes / Decisions:**

- Shared path is centralized so installer, tests, and runtime message stay aligned.

**Issues Encountered:**

- p01 review found `evaluate` needed a higher version against current `origin/main`; fixed in `6789eaa`.

---

### Task p01-t02: Centralize the actionable missing-CLI error across all five skills

**Status:** completed
**Commit:** 7bb662c

**Notes:**

- Shared missing-CLI error now covers refine/evaluate/decide/plan/create and points users to plugin install or pinned `install.sh`.

---

### Task p01-t03: Add the pinned-fetch `install.sh` alternative installer

**Status:** completed
**Commit:** dc7bce4

---

### Task p01-t04: Document the alternative-install path + assert the cross-file contract

**Status:** completed
**Commit:** 97e3040

---

### Task p01-t05: Final phase validation (build + version + full suite)

**Status:** completed
**Commit:** none - final validation was clean with nothing to stage.

---

## Phase 2: Upstream handoff prompt (cat 3)

**Status:** completed
**Started:** 2026-06-26

### Phase Summary

**Outcome (what changed):**

- Added a self-contained `open-agent-toolkit` handoff prompt for upstreaming `metadata.internal: true` on OAT tooling skills.

**Key files touched:**

- `.oat/projects/shared/public-discovery/handoff/open-agent-toolkit-internal-flag-prompt.md` - upstream implementation prompt and verification instructions.

**Verification:**

- Run: manual content check by implementer; p02 code review.
- Result: pass, 0 findings.

**Notes / Decisions:**

- Actual downstream hiding remains deferred until the upstream OAT change lands and syncs back.

### Task p02-t01: Author the `open-agent-toolkit` internal-flag handoff prompt

**Status:** completed
**Commit:** 3de1f28

---

## Phase 3: Verification & recording (cat 1 + skills.sh)

**Status:** completed
**Started:** 2026-06-26

### Phase Summary

**Outcome (what changed):**

- Recorded the live `skills@1.5.13` discovery surface, including full parsed proof that the only standalone `skills/` entries are `session-observer` and `export-session-transcript`.
- Verified both standalone skills install and run from isolated HOME/cache/XDG directories.
- Simulated standalone consensus recovery and verified `install.sh` provisions `~/.consensus/consensus.mjs` for the copied `refine` skill.
- Recorded skills.sh hosted-index checks, no-current-listing strategy, and cat-3 deferral in the backlog item.

**Key files touched:**

- `.oat/projects/shared/public-discovery/verification/cli-discovery.md` - CLI discovery, standalone install/run, and recovery evidence.
- `.oat/repo/pjm/backlog/items/BL-260621-control-public-skill-discovery.md` - hosted-index findings and listing strategy.

**Verification:**

- Run: isolated `npx -y skills@1.5.13 add tkstang/skills --list`; standalone installs and entrypoint `--help`; local consensus recovery simulation; `skills find` and skills.sh URL checks; p03 review/re-review.
- Result: pass. p03 re-review had 0 findings.

**Notes / Decisions:**

- Unversioned `npx skills ...` shadows the local package from this checkout, so the evidence uses explicit `skills@1.5.13`.
- Hosted `tkstang/skills` is not indexed yet; do not claim skills.sh listing until post-cat-3 verification.

### Task p03-t01: Verify CLI discovery — standalone entries + consensus recovery

**Status:** completed
**Commit:** 558ce1b

---

### Task p03-t02: Verify and record skills.sh crawl/submission behavior

**Status:** completed
**Commit:** e8ab87a

---

## Phase 4: Final review fixes

**Status:** in_progress
**Started:** 2026-06-27

### Phase Summary

**Outcome (what changed):**

- Pending. Final review receive converted one Minor coverage gap into a review-fix
  task and deferred one release-tag coordination note to the existing release
  checklist/backlog follow-up.

**Key files touched:**

- `tests/consensus/install-contract.test.ts` - pending extension for the
  user-guide installation page.

**Verification:**

- Pending: `pnpm exec vitest run tests/consensus/install-contract.test.ts` and
  `pnpm --dir documentation run build`.

**Notes / Decisions:**

- Final review had 0 Critical, 0 Important, and 0 Medium findings.
- Minor `m2` (`v0.1.2` release-tag coordination) is accepted as a release
  checklist / `BL-260621` follow-up because it depends on the actual release tag
  cut and cannot be fully verified pre-release.

### Task p04-t01: Extend installer contract coverage to user-guide install docs

**Status:** pending
**Commit:** pending

---

## Orchestration Runs

_Each run from `oat-project-implement` appends an entry below with:_
_- Run header (number, timestamp, branch, tier, policy, phase counts)_
_- Phase Outcomes table_
_- Parallel Groups list_
_- Outstanding Items_

<!-- orchestration-runs-start -->

_Orchestration runs from `oat-project-implement` are appended here, most-recent-first within the file but append-only at the bottom of the log._

### Run 2 — 2026-06-26 18:19

**Branch:** feat-public-discovery
**Tier:** 1
**Policy:** merge-strategy=merge, retry-limit=2
**Phases:** 1 executed, 1 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p03   | DONE        | pass   | 1/2            | merged      |

#### Parallel Groups

- p03: sequential on orchestration branch.

#### Dispatch Notes

- Dispatch: p03 implementation used effort_axis=selected:xhigh, model_axis=inherited, dispatch_ceiling=xhigh. Rationale: live CLI/network checks, local consensus recovery simulation, and backlog evidence recording.
- Dispatch: p03 review and re-review used `oat-reviewer-xhigh`; initial review found one Important evidence gap and one Minor backlog cleanup, fixed by `1184322`.

#### Outstanding Items

- None.

#### Artifact / Design Deltas

Run-scoped snapshot only. The durable record is `## Deviations from Plan / Design`; consolidate any non-`None` entries there at the next phase boundary.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| None | - | - | - | - | - | - |

### Run 1 — 2026-06-26 17:47

**Branch:** feat-public-discovery
**Tier:** 1
**Policy:** merge-strategy=merge, retry-limit=2
**Phases:** 2 executed, 2 passed, 0 failed, 0 stopped

#### Phase Outcomes

| Phase | Implementer | Review | Fix Iterations | Disposition |
| ----- | ----------- | ------ | -------------- | ----------- |
| p01   | DONE        | pass   | 1/2            | merged      |
| p02   | DONE_WITH_CONCERNS | pass   | 0/2            | merged      |

#### Parallel Groups

- Group 1 [p01, p02]: worktree-based, merged in order.

#### Dispatch Notes

- Dispatch: p01 implementation used effort_axis=selected:xhigh, model_axis=inherited, dispatch_ceiling=xhigh. Rationale: multi-file consensus runtime, generated outputs, installer, docs, and skill-version invariants.
- Dispatch: p02 implementation used effort_axis=selected:xhigh, model_axis=inherited, dispatch_ceiling=xhigh. Rationale: single-file upstream handoff deliverable with project-level maximum ceiling.
- Dispatch: p01 review and re-review used `oat-reviewer-xhigh`; initial review found one Important version-gate issue, fixed by `6789eaa`.
- Dispatch: p02 review used `oat-reviewer-xhigh`; no findings.

#### Outstanding Items

- p01 re-review recorded one Minor artifact-drift note. Plan text was updated during bookkeeping; no code follow-up remains.

#### Artifact / Design Deltas

Run-scoped snapshot only. The durable record is `## Deviations from Plan / Design`; consolidate any non-`None` entries there at the next phase boundary.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p01 review m1 | plan.md Phase 1 | `evaluate` target `0.1.2`; validator command with extra `--` | `evaluate` target `0.1.3`; validator command without extra `--` | `origin/main` advanced and repo validator rejects literal `--` | implementation + updated plan.md | Completed in bookkeeping |

<!-- orchestration-runs-end -->

---

## Implementation Log

Chronological log of implementation progress.

### 2026-06-26

**Session Start:** 17:07

- [x] p01-t01: Add `~/.consensus/` fallback - 31195d9
- [x] p01-t02: Centralize missing-CLI error - 7bb662c
- [x] p01-t03: Add installer - dc7bce4
- [x] p01-t04: Document installer contract - 97e3040
- [x] p01 review fix: bump evaluate for current main - 6789eaa
- [x] p02-t01: Author upstream handoff prompt - 3de1f28

**What changed (high level):**

- Consensus standalone recovery landed and passed p01 re-review.
- OAT upstream internal-flag handoff prompt landed and passed p02 review.
- Parallel worktrees merged back in plan order as `5c06e42` and `e542690`.

**Decisions:**

- Corrected plan text during bookkeeping for the accepted p01 review Minor: current target for `evaluate` is `0.1.3`, and the valid skill-version command omits the extra `--`.

**Follow-ups / TODO:**

- Continue with p03 verification and recording.

**Blockers:**

- None.

**Session End:** 17:47

---

### 2026-06-26 — Phase 3

**Session Start:** 17:50

- [x] p03-t01: Verify standalone install/run + consensus discovery and recovery - 558ce1b
- [x] p03-t02: Record skills.sh crawl/submission finding and cat-3 deferral - e8ab87a
- [x] p03 review fix: preserve complete discovery evidence and supersede stale backlog note - 1184322

**What changed (high level):**

- Added durable CLI discovery evidence under `verification/cli-discovery.md`.
- Updated the backlog item with dated hosted-index findings and the no-listing-until-cat-3 strategy.

**Decisions:**

- Use explicit `skills@1.5.13` for reproducible CLI checks because unversioned `npx skills` shadows this repo's package name from the checkout.
- Keep hosted-listing claims deferred until the OAT `metadata.internal` upstream work lands and syncs back.

**Follow-ups / TODO:**

- Run final verification and final review.

**Blockers:**

- None.

**Session End:** 18:19

---

## Deviations from Plan / Design

Document any intentional deviations from the original plan, spec, or design. Include accepted review findings where the shipped implementation is source of truth and a lifecycle artifact needs alignment.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p01 review m1 | plan.md Phase 1 | `evaluate` target `0.1.2`; validator command with extra `--` | `evaluate` target `0.1.3`; validator command without extra `--` | `origin/main` advanced and repo validator rejects literal `--` | implementation + updated plan.md | Completed in bookkeeping |

## Test Results

Track test execution during implementation.

| Phase | Tests Run | Passed | Failed | Coverage |
| ----- | --------- | ------ | ------ | -------- |
| p01/p02 fan-in | `pnpm test`; `pnpm lint`; `pnpm run type-check`; `pnpm run build:check` | yes | no | n/a |
| p03 | isolated `skills@1.5.13` discovery/install checks; consensus recovery simulation; skills.sh hosted checks | yes | no | n/a |
| final | `pnpm test`; `pnpm lint`; `pnpm run type-check`; `pnpm run build`; `pnpm run build:check`; `pnpm run validate`; `pnpm run smoke`; `pnpm run validate:skill-versions --base-ref origin/main` | yes | no | n/a |

## Review Received

**Final review:** passed on 2026-06-26.

- Artifact: `reviews/archived/final-review-2026-06-26.md`
- Findings: 0 Critical, 0 Important, 0 Medium, 0 Minor
- Next: project summary, documentation sync, and final PR.

### Review Received: final

**Date:** 2026-06-27
**Review artifact:** `reviews/archived/final-review-2026-06-27.md`

**Findings:**

- Critical: 0
- Important: 0
- Medium: 0
- Minor: 2

**New tasks added:** p04-t01

**Converted Findings:**

- m1 -> p04-t01: extend `tests/consensus/install-contract.test.ts` to cover
  `documentation/docs/user-guide/installation.md`.

**Deferred Findings (Minor):**

- m2: release-tag coordination for the `v0.1.2` installer pin is deferred to the
  release checklist / `BL-260621` because the remote one-liner can only be fully
  verified once the release tag is cut. The current branch keeps README,
  `install.sh`, and user-guide docs internally aligned; post-release validation
  must confirm the tag contains this branch's installer/resolver work.

**Next:** Execute fix task `p04-t01` via the `oat-project-implement` skill, then
update the final review row to `fixes_completed` and re-run final review.

## Final Summary (for PR/docs)

**What shipped:**

- Standalone consensus skills can recover a missing shared provider CLI through `~/.consensus/consensus.mjs`.
- All five consensus wrappers share the same actionable missing-provider-CLI error.
- `install.sh` provisions the shared consensus CLI in checkout mode and documents the pinned remote install path.
- The public-discovery verification record proves standalone skill install/run behavior and captures skills.sh hosted-index status.
- The `open-agent-toolkit` upstream handoff prompt captures the cat-3 `metadata.internal` follow-up.

**Behavioral changes (user-facing):**

- Users who install a consensus skill standalone get a clear recovery message instead of an opaque missing-provider-CLI failure.
- The README now gives a concrete alternative installer for standalone consensus skill installs.

**Key files / modules:**

- `src/consensus/core/consensus-loop.ts` - shared CLI resolution and error messaging.
- `src/consensus/refine/consensus-refine.ts` - refine preflight delegation to shared helper.
- `plugins/consensus/skills/**` - regenerated consensus runtimes and skill version bumps.
- `install.sh` - alternative installer.
- `README.md` - installation documentation.
- `.oat/projects/shared/public-discovery/verification/cli-discovery.md` - public discovery verification evidence.
- `.oat/repo/pjm/backlog/items/BL-260621-control-public-skill-discovery.md` - hosted-index findings and deferral strategy.

**Verification performed:**

- `pnpm test`, `pnpm lint`, `pnpm run type-check`, `pnpm run build:check`.
- `pnpm run validate`, `pnpm run validate:skill-versions --base-ref origin/main`, targeted consensus Vitest tests, `bash -n install.sh`.
- Isolated `skills@1.5.13` discovery/install checks, consensus recovery simulation, and skills.sh hosted checks recorded in `verification/cli-discovery.md`.

**Design deltas (if any):**

- p01 review required `evaluate` to bump to `0.1.3` because current `origin/main` already had `0.1.2`; plan text was updated.
- The valid skill-version command is `pnpm run validate:skill-versions --base-ref origin/main`; the earlier extra `--` form was corrected.

## References

- Plan: `plan.md`
- Design: `design.md`
- Spec: `spec.md`
