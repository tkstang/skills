---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-17
oat_current_task_id: null
oat_generated: false
---

# Implementation: first-party-standalone-installer

**Started:** 2026-09-16
**Last Updated:** 2026-09-17

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

| Phase   | Status      | Tasks | Completed |
| ------- | ----------- | ----- | --------- |
| Phase 1 | complete    | 3     | 3/3       |
| Phase 2 | complete    | 1     | 1/1       |

**Total:** 4/4 tasks completed

---

## Phase 1: Implement and verify the first-party installer

**Status:** complete
**Started:** 2026-09-16

### Phase Summary (fill when phase is complete)

**Outcome (what changed):**

- Added a dependency-free standalone installer for exact tagged generated skill payloads.
- Added explicit Codex, Claude Code, and Cursor destinations at both project and user scope.
- Preserved the zero-argument Consensus recovery installer and documented authority-gated live acceptance separately.

**Key files touched:**

- `install.sh` and `scripts/install-standalone.mjs` - command dispatch and safe pinned-source installation.
- `tests/tooling/standalone-installer.test.ts` and `tests/release/standalone-install-contract.test.ts` - isolated behavior and documentation contracts.
- `documentation/docs/user-guide/installation.md` and `RELEASING.md` - scoped procedures and release evidence.

**Verification:**

- Run: focused Vitest suites, both skill-version comparisons, `pnpm run premerge`, docs build, diff check, and PJM doctor.
- Result: passed; 65 focused tests and 2,029 full-suite tests passed, with one opt-in live test skipped.

**Notes / Decisions:**

- Standalone-specific assertions were moved out of `src/plugins/consensus` so tests do not falsely trigger seven shipped-skill version bumps.
- Live host discovery, invocation, real user-home mutation, publishing, and release remain explicitly pending.

### Task p01-t01: Adapt the proven installer core for public standalone installs

**Status:** completed
**Commit:** `4fc228e9f48da6426004dd8dddca7a9b6fc5e302`

**Outcome (required when completed):**

- `install.sh` now preserves the zero-argument Consensus recovery path and delegates explicit standalone flags to a dependency-free Node.js installer.
- Standalone installs require a skill, host, scope, and exact tag; read only generated payloads from a private bare Git repository; refuse unsafe or existing destinations; and verify the written inventory.

**Files changed:**

- `install.sh` - dispatches standalone arguments without changing zero-argument recovery behavior.
- `scripts/install-standalone.mjs` - implements pinned-source reading, safe scoped placement, inventory verification, and failure marking.
- `src/plugins/consensus/install-sh.test.ts` - covers the isolated-script missing-helper boundary.
- `tests/tooling/standalone-installer.test.ts` - covers scoped destinations, source/ref safety, fidelity, and injected failure behavior.

**Verification:**

- Run: `pnpm run test:vitest tests/tooling/standalone-installer.test.ts src/plugins/consensus/install-sh.test.ts src/plugins/consensus/install-contract.test.ts`
- Result: 42 focused tests passed; type-check, lint, formatting, and Bash syntax also passed.

**Notes / Decisions:**

- No real user home, network repository, or live provider was used.

**Issues Encountered:**

- Pre-commit lint findings were corrected within the four-file task boundary.

---

### Task p01-t02: Document both scopes and release acceptance

**Status:** completed
**Commit:** `1606a5c9a4816c96d058d5a6c7ea2bc4ed8d7a6f`

**Notes:**

- Added project- and user-scope examples for Codex, Claude Code, and Cursor, plus explicit release acceptance boundaries.
- 24 documentation/README contract tests, the production docs build, type-check, lint, and diff checks passed.
- Documentation-build changes to `.oat/config.json` and `documentation/index.md` were verified as generated drift and restored exactly.

---

### Task p01-t03: Run the full gate and record the pending live boundary

**Status:** completed
**Commit:** `0876525a9c540021a7c23fccfa21f877797ec0c1`

**Prior blocker:** `validate:skill-versions` treats the two planned test-file changes under `src/plugins/consensus` as changes to seven distributed skills. A mechanically bounded relocation passed 44 focused tests, but the validator unions committed and uncommitted paths, so it could not validate the cancellation before a candidate commit. Recovery attempt 1 was recorded as failed with no product-code commit.

**Resume:** The operator authorized recovery attempt 2 using candidate-tree proof before commit and authoritative version validation after commit. The scope remains limited to relocating the newly added standalone assertions and restoring the two Consensus test files to phase-base content.

**Outcome:** Recovery commit `372a69c0a2eeb7a2b83a0c39441af6a7862fdb3e` relocated the standalone assertions and restored both Consensus tests to phase-base content. Both authoritative skill-version comparisons then passed with zero changed skills. The task commit recorded all automated evidence and kept six live host/scope checks pending.

---

## Phase 2: Resolve final review findings

**Status:** complete
**Started:** 2026-09-17

### Phase Summary (fill when phase is complete)

**Outcome (what changed):**

- The documented bootstrap now fetches only the fully qualified release tag
  and checks out its peeled commit before selecting the installer.
- An offline local regression proves a divergent same-named branch cannot
  substitute different installer bytes.

**Verification:**

- Three focused release-contract tests, changed-file lint/format checks, the
  documentation production build, and authoritative-range whitespace checks
  passed.
- Independent p02 review passed with zero findings and reproduced both the old
  failure mode and corrected behavior without executing the fixture installer.

### Task p02-t01: (review) Pin the bootstrap checkout to the fully qualified release tag

**Status:** completed
**Commit:** `f0879afabb0556f836eae1849edafd3393dd90e7`

**Review finding:** M1 from the auto final review. The documented
`git clone --branch v0.1.2` bootstrap can prefer a divergent same-named branch
over the promised annotated tag.

**Outcome:** Replaced the ambiguous clone command with an explicit qualified
tag fetch and detached peeled-commit checkout, with a temporary local Git
collision regression covering checkout identity and installer bytes.

---

## Orchestration Runs

_Each run from `oat-project-implement` appends an entry below with:_
_- Run header (number, timestamp, branch, tier, policy, phase counts)_
_- Phase Outcomes table_
_- Parallel Groups list_
_- Outstanding Items_

<!-- orchestration-runs-start -->

_Orchestration runs from `oat-project-implement` are appended here, most-recent-first within the file but append-only at the bottom of the log._

### Run 1 — 2026-09-16

- Branch: `standalone-installer`
- Tier: 1 — subagent
- Dispatch policy: `frontier`; cap `xhigh`; selected `gpt-6-astra/high`
- Phase outcomes: 0 passed, 0 failed review, 1 blocked

| Phase | Outcome | Tasks | Commits | Review | Fix iterations |
| ----- | ------- | ----- | ------- | ------ | -------------- |
| p01 | blocked | 2/3 | `4fc228e9`, `1606a5c9`, ledger `e5a9c971` | not started | 0 |

#### Dispatch record — p01 implementation

- Request ID: `impl-first-party-standalone-installer-p01-20260917T0042Z`
- Caller / role: `oat-project-implement` / `oat-phase-implementer`
- Role class / task class: `worker` / `default-implementation`
- Provider / context / route: `codex` / `root-native` / native materialized role
- Authority: phase-scoped repository writes; one commit per planned task; no push, release, live provider, or real-home mutation
- Target: `oat-phase-implementer-gpt-6-astra-high-5b14a55346`
- Model axis: `selected:gpt-6-astra`
- Effort axis: `selected:high`
- Selection source / reason: `native-default` / `native-catalog`
- Candidates considered: `gpt-6-astra/high`, `gpt-5.6-sol/medium`, `gpt-5.6-sol/high`
- Launch status / child outcome: `accepted` / `BLOCKED`
- Phase base / returned head: `01e459687e33459357774a4aa584c44d6a64a9a2` / `e5a9c9717a313590803633930855af9784adb5c2`
- Continuation events: `cont-first-party-standalone-installer-p01-recover-2` — same accepted handle, `mode: implement`, operator-authorized bounded recovery attempt 2 followed by the remaining `p01-t03` work; exact target and dispatch axes unchanged
- Optional children: none
- Dispatch stamp: `Dispatch: scope=p01 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-6-astra effort_axis=selected:high dispatch_policy=frontier dispatch_ceiling=xhigh target=oat-phase-implementer-gpt-6-astra-high-5b14a55346`

#### Recovery Event p01-recovery-001

- Phase/task: p01 / p01-t01; related p01-t02 test changes
- Original request: `impl-first-party-standalone-installer-p01-20260917T0042Z`
- Original commit: `4fc228e9f48da6426004dd8dddca7a9b6fc5e302`
- Defect class: composition
- Discovered by: `pnpm run validate:skill-versions -- --base-ref origin/main`
- Disposition: failed-attempt
- Authorization: phase-standing
- Attempt: 1/10
- Dispatch target: `oat-phase-implementer-gpt-6-astra-high-5b14a55346`
- Recovery commit: -
- Verification: relocated coverage passed 44 focused tests; the pre-commit version validation remained blocked by committed-path unioning.
- Reason: the validator cannot observe the proposed net cancellation until a new commit exists; bounded files were restored and only the failed ledger transition was committed.

**Outstanding items:**

- `p01-t03` requires operator direction on a candidate-tree verification strategy or a plan change. Phase review was not launched.

### Run 2 — 2026-09-16

- Branch: `standalone-installer`
- Tier: 1 — same accepted phase handle
- Dispatch policy: exact target and axes preserved from Run 1
- Phase outcome: implementation complete; independent phase review pending

| Phase | Outcome | Tasks | Commits | Review | Recovery attempts |
| ----- | ------- | ----- | ------- | ------ | ----------------- |
| p01 | implemented | 3/3 | recovery `372a69c0`, task `0876525a` | pending | 2/10 used |

#### Recovery Event p01-recovery-002

- Phase/task: p01 / p01-t01; related p01-t02 assertions
- Original request: `impl-first-party-standalone-installer-p01-20260917T0042Z`
- Continuation event: `cont-first-party-standalone-installer-p01-recover-2`
- Original commit: `4fc228e9f48da6426004dd8dddca7a9b6fc5e302`
- Defect class: composition
- Discovered by: `pnpm run validate:skill-versions -- --base-ref origin/main`
- Disposition: recovered
- Authorization: operator-extension
- Attempt: 2/10
- Dispatch target: `oat-phase-implementer-gpt-6-astra-high-5b14a55346`
- Recovery commit: `372a69c0a2eeb7a2b83a0c39441af6a7862fdb3e`
- Verification: candidate-tree equality and 65 focused tests passed before commit; after commit, focused tests, both version gates, full premerge, documentation build, diff check, and PJM doctor passed.
- Reason: standalone assertions moved outside the shared runtime source directory while both original Consensus tests returned exactly to phase-base content.

**Outstanding items:**

- Root-owned phase review, final lifecycle review, and configured closeout gates remain.

### Run 3 — 2026-09-16

- Branch: `standalone-installer`
- Phase review target: `oat-reviewer-gpt-6-astra-xhigh-d2ba02747a`
- Reviewed range: `01e459687e33459357774a4aa584c44d6a64a9a2..6800dcebee56689aa9045e0d471e815e564950f2`
- Verdict: passed under the phase contract with 0 Critical, 0 Important, 1 Medium, and 0 Minor findings
- Review artifact: `reviews/p01-review-2026-09-17T012147Z.md`
- Reconnaissance: not attempted
- Fix iterations: 0

**Outstanding items:**

- Medium M1: make the documented installer bootstrap resolve the fully qualified release tag rather than a same-named branch.
- Final lifecycle review and configured closeout gates remain.

### Run 4 — 2026-09-17

- Branch: `standalone-installer`
- Tier: 1 — subagent
- Dispatch policy: `frontier`; cap `xhigh`; selected `gpt-5.6-terra/high`
- Phase outcome: passed

| Phase | Outcome | Tasks | Commits | Review | Fix iterations |
| ----- | ------- | ----- | ------- | ------ | -------------- |
| p02 | passed | 1/1 | `f0879afa` | 0 Critical, 0 Important, 0 Medium, 0 Minor | 0 |

#### Dispatch record — p02 implementation

- Request ID: `impl-first-party-standalone-installer-p02-20260917T0138Z`
- Caller / role: `oat-project-implement` / `oat-phase-implementer`
- Role class / task class: `worker` / `default-implementation`
- Provider / context / route: `codex` / `root-native` / native materialized role
- Authority: `p02-t01` files and required implementation bookkeeping; no push, release, network, live provider, or real-home mutation
- Target: `oat-phase-implementer-gpt-5-6-terra-high`
- Model axis: `selected:gpt-5.6-terra`
- Effort axis: `selected:high`
- Selection source / reason: configured balanced candidate / bounded, strongly tested implementation floor
- Candidates considered: `gpt-5.6-terra/high`, `gpt-5.6-sol/medium`, `gpt-6-astra/high`
- Launch status / child outcome: `accepted` / `DONE`
- Phase base / returned head: `e2fe6c4106e2949b2ebefe1816cdae1622bc7b6c` / `f0879afabb0556f836eae1849edafd3393dd90e7`
- Optional children: none
- Dispatch stamp: `Dispatch: scope=p02 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-terra effort_axis=selected:high dispatch_policy=frontier dispatch_ceiling=xhigh target=oat-phase-implementer-gpt-5-6-terra-high`

#### Review record — p02

- Target: `oat-reviewer-gpt-6-astra-xhigh-d2ba02747a`
- Reviewed range: `e2fe6c4106e2949b2ebefe1816cdae1622bc7b6c..f0879afabb0556f836eae1849edafd3393dd90e7`
- Verdict: passed with zero findings
- Review artifact: `reviews/p02-review-2026-09-17T014619Z.md`
- Reconnaissance: not attempted

**Outstanding items:**

- Final lifecycle re-review and configured closeout gates remain.

<!-- orchestration-runs-end -->

---

## Review Received: plan artifact gate

**Date:** 2026-09-16
**Review artifact:** `reviews/archived/artifact-plan-review-2026-09-16T231057Z.md`

**Findings:**

- Critical: 0
- Important: 1
- Medium: 3
- Minor: 4

**Disposition:** No implementation tasks were created because this was an artifact review. All findings were resolved directly in `discovery.md`, `design.md`, and `plan.md`:

- `I1` (`resolve_in_artifact`): declared the opt-in, bounded real-process test seam and its inert-by-default proof.
- `M1` (`resolve_in_artifact`): selected the planned `v0.1.2` pin with an explicit unreleased/current-payload caveat.
- `M2` (`resolve_in_artifact`): added streamed/isolated-script refusal behavior and a no-mutation test.
- `M3` (`resolve_in_artifact`): finalized `oat_template: false`.
- `m1` (`resolve_in_artifact`): enumerated unknown, duplicate, partial, and missing-value flag tests.
- `m2` (`resolve_in_artifact`): named `.standalone-install-incomplete` consistently.
- `m3` (`resolve_in_artifact`): added changed-file oxlint commands.
- `m4` (`resolve_in_artifact`): retained and explained the quick-mode `spec` ledger placeholder.

**Next:** The subsequent gate and user-approved simplification superseded the first draft. The first review row remains `fixes_completed`; no clean re-gate was run.

---

## Review Received: plan artifact gate (second pass)

**Date:** 2026-09-16
**Review artifact:** `reviews/archived/artifact-plan-review-2026-09-16T232140Z.md`

**Findings:**

- Critical: 0
- Important: 1
- Medium: 1
- Minor: 2

**Disposition:** No implementation tasks were created because this was an artifact review. The findings and the later user-approved simplification were resolved directly in the backlog item, handoff, discovery, design, and plan:

- `I1` (`resolve_in_artifact`): require the complete inherited `GIT_*` namespace to be removed before every Git subprocess.
- `M1` (`resolve_in_artifact`): define safe provider-parent creation after complete source validation for both project and user scope.
- `m1` (`resolve_in_artifact`): name `https://github.com/tkstang/skills.git` as the default repository.
- `m2` (`resolve_in_artifact`): keep focused documentation assertions in the existing installation contract test instead of an optional command path.
- User-approved scope revision: require `--scope <project|user>` and test user behavior only with a temporary `HOME`.
- User-approved complexity revision: adapt proven `personal-skills` patterns; remove the second staging copy, shipped race/failure checkpoints, and exhaustive concurrent-entry matrix; retain one direct injected failure test.

**Next:** The plan is ready for `oat-project-implement`. No further pre-implementation gate is required unless the user explicitly requests one; both gate rows remain `fixes_completed`, not `passed`.

---

### Review Received: final

**Date:** 2026-09-17
**Review artifact:** `reviews/archived/final-review-2026-09-17T012706Z.md`

**Findings:**

- Critical: 0
- Important: 0
- Medium: 1
- Minor: 0

**New tasks added:** `p02-t01`

**Finding disposition:**

- `M1` (`code_fix_required`, converted): pin the documented bootstrap to the
  fully qualified release tag and add a local divergent branch/tag regression.

**Deferred Medium ledger:** No Medium finding remains deferred. The prior p01
M1 is the same defect and is converted into `p02-t01` for correction now.

**Next:** `p02-t01` completed in `f0879afa`, its phase review passed, and this
event is now `fixes_completed`. Run the final code re-review.

---

### Review Received: final re-review

**Date:** 2026-09-17
**Review artifact:** `reviews/archived/final-review-2026-09-17T015346Z.md`

**Findings:**

- Critical: 0
- Important: 0
- Medium: 0
- Minor: 0

**New tasks added:** None.

**Deferred Medium ledger:** Resolved. The p01 and prior final M1 entries refer
to the same bootstrap defect, which `p02-t01` fixed in `f0879afa`; the p02
review and final re-review independently passed.

**Minor disposition:** No Minor findings exist in this event or remain
deferred from prior code reviews.

**Disposition:** The final review event passed. Continue to the configured
implementation exit gate and final HiLL closeout without performing the
separately authority-gated live host/user-home acceptance.

---

### Implementation Exit Gate: generation initialized

**Date:** 2026-09-17
**Resolution:** Configured semantic cross-family final review, `onFailure:
block`, maximum 2 remediation attempts.
**Reviewed basis:** `9538fa57917e636982eb4a59aafa2be8c3b7517a`
against `origin/main` with
`sha256:effective-delta-v1:55c4802746154f37fd53f7204855a079da1ae289fc412973d854cc4eeb9fb418`.
**State:** Pending; no gate process has launched yet.

---

## Implementation Log

Chronological log of implementation progress.

- `p01-t01` completed in `4fc228e9`; focused behavior, type-check, lint, formatting, and Bash syntax passed.
- `p01-t02` completed in `1606a5c9`; documentation contracts and production docs build passed.
- `p01-t03` blocked during the version gate. Full premerge otherwise passed with 2,029 tests passed and 1 skipped; build freshness, validation, smoke, docs build, diff check, and PJM doctor passed.
- Recovery attempt 1 made no product-code commit and preserved immutable task history.
- Operator direction resumed `p01-t03` for recovery attempt 2 with exact-target continuity and candidate-tree proof; no unrelated version bumps or validator changes are authorized.
- Recovery attempt 2 completed in `372a69c0`; `p01-t03` completed in `0876525a`; all planned static verification passed.
- Independent phase review passed with one non-blocking Medium bootstrap-tag finding recorded in `reviews/p01-review-2026-09-17T012147Z.md`.
- Auto final review converted the unresolved bootstrap-tag finding into `p02-t01`; no Medium finding remains deferred.
- `p02-t01` completed in `f0879afa`; independent p02 review passed with zero findings and resolved the bootstrap-tag defect.
- Final re-review passed with zero findings; all prior Medium and Minor dispositions are closed.

---

## Deviations from Plan / Design

Document any intentional deviations from the original plan, spec, or design. Include accepted review findings where the shipped implementation is source of truth and a lifecycle artifact needs alignment.

| Task / Review | Source Artifact | Planned / Documented | Actual / Accepted | Reason | Source of Truth | Follow-up |
| ------------- | --------------- | -------------------- | ----------------- | ------ | --------------- | --------- |
| p01-t03 / p01-recovery-001 | `plan.md` | Existing Consensus test files can hold standalone assertions while the version gate confirms no skill bump is needed. | Standalone assertions live in `tests/tooling/standalone-installer.test.ts` and `tests/release/standalone-install-contract.test.ts`; the original Consensus tests match the phase base. | The validator treats every changed path under `src/plugins/consensus` as a distributed-skill change, so test-only assertions belong outside that runtime source root. | Implementation and passing committed-HEAD version gates | Reflected in recovery commit `372a69c0`; no validator or skill-version change required. |

## Test Results

Track test execution during implementation.

| Phase | Tests Run | Passed | Failed | Coverage |
| ----- | --------- | ------ | ------ | -------- |
| 1     | Focused installer/docs suites; `premerge`; docs build; both version comparisons; diff/PJM checks | 65 focused tests; 2,029 full-suite tests; all gates | 0 | No coverage metric configured |
| 2     | Release-contract suite; lint/format; docs build; independent command reproduction; diff check | 3 focused tests; all gates | 0 | Targeted regression for branch/tag ambiguity |

## Final Summary (for PR/docs)

**What shipped:**

- Exact-tag installation of generated standalone skill payloads from a private bare Git repository.
- Explicit project or user installation for Codex, Claude Code, and Cursor without cross-provider mirrors.

**Behavioral changes (user-facing):**

- `install.sh` accepts explicit standalone flags while preserving its existing zero-argument Consensus recovery behavior.
- Existing destinations and symlinked ancestors are refused; partial failures retain a marked destination for inspection.

**Key files / modules:**

- `scripts/install-standalone.mjs` - dependency-free installer implementation.
- `tests/tooling/standalone-installer.test.ts` - isolated behavior coverage.
- `tests/release/standalone-install-contract.test.ts` - stable documentation/release assertions.

**Verification performed:**

- Focused and full Vitest suites, type-check, lint/format checks, build freshness, repository validation, smoke, docs production build, both skill-version comparisons, diff check, and PJM doctor.

**Design deltas (if any):**

- Only test placement changed: standalone assertions moved outside `src/plugins/consensus` to avoid false shipped-skill version impact. Runtime design is unchanged.
- The phase-review bootstrap finding was resolved in `f0879afa` with an explicit qualified-tag fetch and local collision regression.

## References

- Plan: `plan.md`
- Design: `design.md`
- Spec: `spec.md`
