---
oat_generated: true
oat_generated_at: 2026-09-19T14:45:00Z
oat_review_scope: p01
oat_review_type: code
oat_review_invocation: subagent
oat_project: .oat/projects/shared/agent-messaging
oat_review_head_sha: 67b811def41104d75a05d6175229e6e5539ccc9d
oat_review_range: 8866df01da3041e49d8b530e7e5d005059783330..67b811def41104d75a05d6175229e6e5539ccc9d
oat_prior_review_artifact: .oat/projects/shared/agent-messaging/reviews/code-p01-review-2026-09-19T140258Z.md
oat_prior_review_head_sha: 8866df01da3041e49d8b530e7e5d005059783330
---

# Code Review: p01 Re-review Round 2

**Reviewed:** 2026-09-19T14:45:00Z
**Scope:** Phase p01, tasks p01-t01 through p01-t05; full implementation through the settled reviewed head, with the prior-review fix delta re-reviewed independently
**Full phase range:** `91f5f2383883e6dd5f4506ebf6371d26099f59ad..67b811def41104d75a05d6175229e6e5539ccc9d`
**Re-review range:** `8866df01da3041e49d8b530e7e5d005059783330..67b811def41104d75a05d6175229e6e5539ccc9d`
**Files reviewed:** 38 changed files plus the quick-mode requirements and repository contracts
**Commits:** 9 after the phase base, including 5 task commits, 1 recovery, 1 review fix, and bookkeeping
**Verdict:** Blocking

## Summary

The normal verification gates are green and six of the eleven prior findings are fully resolved, but Phase 1 is not ready to advance. The fix leaves three prior contracts only partially resolved and introduces takeover and path-containment regressions: a 65th binding bricks the member, a stale original join is reported as a successful join to the successor binding, preserved pre-takeover mail is mislabeled inert, and log rendering can escape the configured root through an intermediate symlink.

Findings: 0 critical, 6 important, 1 medium, 0 minor

## Review Scope and Dispatch Evidence

- Workflow mode: quick.
- Evidence sources used: `discovery.md`, approved `design.md`, `plan.md`, `implementation.md`, `state.md`, `src/AGENTS.md`, `documentation/AGENTS.md`, `documentation/docs/engineering/architecture/generated-runtime.md`, and the prior p01 review artifact.
- Tasks: p01-t01, p01-t02, p01-t03, p01-t04, p01-t05.
- Exact ancestry verified: `91f5f2383883e6dd5f4506ebf6371d26099f59ad` → `8866df01da3041e49d8b530e7e5d005059783330` → `e46e0f717a998f7afa82c16480a3de3fff6e6b38` → `7bf347f309a0fc63d40e246513e3bd96f2622c45` → `67b811def41104d75a05d6175229e6e5539ccc9d`.
- Dispatch policy / ceiling: `high` / `high`.
- Selected reviewer target: `oat-reviewer-gpt-5-6-sol-high`.
- Model / effort axes: `selected:gpt-5.6-sol` / `selected:high`.
- Dispatch stamp: `Dispatch: scope=p01-review-2 action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-reviewer-gpt-5-6-sol-high`.
- Reconnaissance was not delegated; the narrowed re-review and all load-bearing source verification were completed inline.

## Findings

### Critical

None.

### Important

- **The 65th binding is published successfully and then makes the member unreadable** (`src/shared/collaboration/membership.ts:388`)
  - Issue: `resolveMember` accepts at most 64 binding files, but `takeOverMembership` never checks that writer-side limit before publishing the next generation. A direct probe created generations 0–63, then generation 64 returned success; the next `resolveMember` failed with `CAPACITY_EXCEEDED: record directory exceeds 64 entries`.
  - Impact: A supported takeover can strand the stable alias and its inbox permanently. V1 has no broad cleanup command, so this crosses the declared soft capacity boundary by reporting success and then bricks every operation that resolves the member.
  - Fix: Before publication, reject a successor when the current binding already occupies generation 63 / the directory already contains 64 records. Preserve the documented concurrent soft-overrun semantics, and add boundary, one-over, and competing-successor tests that prove the winning operation never makes the member unreadable.
  - Requirement: p01-t01 bounded enumeration/writer behavior and p01-t02 explicit session succession.

- **Retrying the original join after takeover silently returns the successor binding** (`src/shared/collaboration/membership.ts:183`)
  - Issue: The alias-conflict recovery path treats any pin matching `member.initialBinding.pin` as an idempotent initial join, then returns the current result from `resolveMember` without checking that generation zero and that same pin are still current. A direct probe took `reviewer` over from `cursor:old` to `cursor:successor`; retrying the old join returned success containing `cursor:successor`.
  - Impact: The old session receives a successful join response that silently redirects it to the newest session's binding, contradicting the exact-identity/no-silent-redirection contract. Later mutations fail, but the success envelope itself misstates ownership and exposes successor state to a stale actor.
  - Fix: Limit orphaned-initial-join recovery to an undeaparted generation-zero binding whose exact current pin matches the retry. Return `STALE_BINDING` or an explicit supersession result after takeover/departure, and add old-pin retries after takeover, departure, and concurrent recovery.
  - Requirement: p01-t02 exact idempotent join, no alias redirection, and superseded-session handling.

- **Takeover invalidates the preserved pending inbox instead of replaying it** (`src/shared/collaboration/messages.ts:365`)
  - Issue: `listInbox` labels every message whose addressed generation differs from the current binding as `recipient-superseded` and `inert: true`, even when the message was safely queued before the takeover. A direct probe sent ordinary pending mail, completed a later takeover, and the successor received that preserved message as inert. The same logic labels every historical message from a superseded sender inert, regardless of whether any send/takeover race occurred; exact-message reads also omit the race classification entirely.
  - Impact: The fix can tell successors to ignore the very pending mail that takeover is required to preserve and inspect. It also turns ordinary historical attribution into a race, so the reader cannot distinguish durable pre-takeover work from a true in-flight publication race.
  - Fix: Preserve old-generation mail as replayable pending work for the stable participant while retaining addressed-generation provenance. Represent closure separately as inert, define a truthful non-inert reassignment/race status for takeover, and make list, exact read, status, and ack behavior consistent. Add a pre-takeover pending-mail control beside deterministic in-flight race tests.
  - Requirement: p01-t02 stable inbox/pending-mail inheritance and p01-t03 stale-binding race reporting.

- **Rendered-log publication can escape the collaboration root through an intermediate symlink** (`src/shared/collaboration/log.ts:234`)
  - Issue: `writeView` checks only the final directory entry and calls `inspectRenderedView` with `path.dirname(path.dirname(file))`, not the configured root. It never verifies that the render directory's canonical path remains contained by `input.root`. A direct probe replaced `<root>/collaborations` with a symlink to an external temporary directory; `renderLog` succeeded and wrote `collaboration.md` outside the configured root.
  - Impact: The mutable render path can overwrite an unintended `collaboration.md` outside the selected store, violating the explicit symlink/owner/containment contract. The read-side symlink disclosure from the prior review is fixed, but the corresponding writer remains unsafe.
  - Fix: Pass the configured root into `writeView`, validate the canonical parent chain against that root immediately before temp creation and replacement, reject symlinked/intermediate escape paths, and add render/show probes for both final-entry and ancestor symlinks.
  - Requirement: p01-t01 path containment/symlink safety and p01-t04 safe regenerable view publication.

- **Authoritative integrity validation still omits core membership and receipt records** (`src/shared/collaboration/records.ts:140`)
  - Issue: Structural validators now reject empty schema-v1 records and message/log hashes are recomputed, but collaboration, member, binding, departure, closed, and acknowledgment records still have no record-level canonical content hash. A structurally valid hand-written generation-one binding was accepted as the current owner. Separately, an acknowledgment with a valid-looking but incorrect message hash was accepted by `readJsonRecord`; `listInbox` silently treated it as pending instead of failing the affected operation closed.
  - Impact: Valid-shape corruption can silently redirect current membership or alter lifecycle history, and corrupt receipts are reinterpreted rather than diagnosed. This remains contrary to the approved canonical-hash and malformed-authority contract, even though the original unsupported-kind/message-hash probe is now rejected.
  - Fix: Add and verify canonical content hashes for every authoritative record shape (excluding the hash field itself), validate nested initial bindings consistently, and cross-check acknowledgment hashes against their messages with an explicit malformed-record failure. Add valid-shape forged binding/closed/ack fixtures, not only empty-object schema fixtures.
  - Requirement: p01-t01 schema-v1 validation, canonical payload hashes, and fail-closed authoritative reads.

- **The required process-isolation and crash proof remains incomplete** (`src/shared/collaboration/records.test.ts:166`)
  - Issue: The new fault-hook tests improve coverage, but the child-kill test executes a hand-written `fs` script rather than the collaboration publisher and covers only before/after link. It does not kill the actual runtime around temp sync, link, and directory sync. The required multi-process sender test remains two promises in one Vitest process (`src/shared/collaboration/messages.test.ts:46`), so no process-isolated contention is exercised.
  - Impact: The evidence still cannot fail for the exact cross-process publication and sender-contention behavior declared by the p01 proof strategy. This is material because the review's direct probes found boundary bugs despite the 87 focused tests and full suite passing.
  - Fix: Spawn child processes that run the actual source or copied bundled runtime, coordinate deterministic barriers at every publication stage, kill at each barrier, and assert retry/visibility/uncertainty outcomes. Run concurrent senders in separate processes against one recipient and verify all complete immutable records survive.
  - Requirement: p01-t01 and p01-t03 Implementation and Proof Strategy.

### Medium

- **Current project tracking still says implementation has not started** (`.oat/projects/shared/agent-messaging/state.md:195`)
  - Issue: The state frontmatter and opening sections correctly say p01 is implemented and awaiting re-review, but the live `Blockers` and `Next Milestone` sections still say no product implementation has started and instruct the next agent to begin p01-t01. `implementation.md:548` and `implementation.md:559` likewise retain a current-looking “No product tests run” / “Not implemented” summary after recording Phase 1 tests and commits.
  - Impact: Agents reading the normal state/implementation routing surfaces can restart completed work or misreport the phase despite correct frontmatter.
  - Fix: Preserve historical planning-review notes as dated history, but update the current blockers, next milestone, test-results summary, and implementation summary to the settled p01/re-review state.

### Minor

None.

## Prior Finding Disposition

| Prior finding                                      | Disposition                         | Evidence                                                                                                                     |
| -------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Missing standalone/session inventories             | Resolved                            | Layout, plugin-manifest, release-versioning, and generated-output checks pass; maintained inventories include the new forms. |
| Structurally invalid/hash-forged record acceptance | Partial                             | Empty/invalid message/log records now fail, but I5 documents missing integrity for membership/lifecycle/ack records.         |
| Join crash strands alias                           | Resolved with regression            | Initial orphan recovery works; I2 documents stale initial retries being redirected after takeover.                           |
| Missing writer/history bounds                      | Partial                             | Member/message/log and combined inbox bounds work; I1 documents the unbounded binding writer.                                |
| Ignored `--reply-to`                               | Resolved                            | CLI, copied standalone, and copied Session plugin tests preserve validated reply references.                                 |
| Wrong closed/inactive exit class                   | Resolved                            | Command tests verify exit 3 for closed/departed and exit 2 for stale identity.                                               |
| Missed close/recipient takeover races              | Partial                             | Send rechecks and list labels exist; I3 documents overbroad inert classification that breaks normal takeover replay.         |
| Symlinked rendered-view disclosure                 | Resolved with related writer defect | `log show` rejects unsafe views; I4 documents render-time ancestor-symlink escape.                                           |
| Incomplete adversarial proof                       | Partial                             | Several deterministic fixtures were added; I6 documents the remaining process/kill gaps.                                     |
| Missing log creation context/status staleness      | Resolved                            | Render includes label/task/creation time and status reports digest/staleness.                                                |
| Fail-open closed-marker inspection                 | Resolved                            | Status returns open only for `ENOENT` and propagates unsafe/invalid marker failures.                                         |

## Requirements and Design Alignment

### Requirements Coverage

| Requirement                          | Status      | Notes                                                                                                                                                        |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| p01-t01 immutable storage primitives | Partial     | No-clobber publication and message/log validation work; binding-cap, all-record integrity, render containment, and crash-proof gaps remain.                  |
| p01-t02 membership/takeover/closure  | Partial     | Orphan recovery and close rechecks work; stale join retry, binding overflow, and pending-mail takeover semantics are incorrect.                              |
| p01-t03 messages/receipts            | Partial     | Reply support, combined bounds, acknowledgment, and send-side race checks work; takeover replay classification and process-isolated proof remain incomplete. |
| p01-t04 authoritative log/view       | Partial     | Context, digest, stale detection, and concurrent-render reporting work; ancestor-symlink render containment is broken.                                       |
| p01-t05 CLI/distributions/docs       | Implemented | Both copied forms execute a three-participant exchange; inventories, docs, version, changelog, full suite, and generated freshness pass.                     |

### Extra Work (not in declared requirements)

None. The fix remains within Phase 1 protocol, packaging, test, and bookkeeping surfaces.

## Verification Performed

```bash
git merge-base --is-ancestor 91f5f2383883e6dd5f4506ebf6371d26099f59ad 8866df01da3041e49d8b530e7e5d005059783330
git merge-base --is-ancestor 8866df01da3041e49d8b530e7e5d005059783330 e46e0f717a998f7afa82c16480a3de3fff6e6b38
git merge-base --is-ancestor e46e0f717a998f7afa82c16480a3de3fff6e6b38 7bf347f309a0fc63d40e246513e3bd96f2622c45
git merge-base --is-ancestor 7bf347f309a0fc63d40e246513e3bd96f2622c45 67b811def41104d75a05d6175229e6e5539ccc9d
git diff --check 91f5f2383883e6dd5f4506ebf6371d26099f59ad..67b811def41104d75a05d6175229e6e5539ccc9d
pnpm run test:vitest src/shared/collaboration/records.test.ts src/shared/collaboration/membership.test.ts src/shared/collaboration/messages.test.ts src/shared/collaboration/log.test.ts src/skills/agent-messaging/src/cli.test.ts src/skills/agent-messaging/src/packaging.test.ts tests/tooling/generated-output-sync.test.ts tests/release/versioning.test.ts tests/repo/layout.test.ts tests/repo/plugin-manifests.test.ts
pnpm run build:check
pnpm run validate
pnpm run type-check
pnpm exec tsx scripts/validate-skill-versions.ts --base-ref 91f5f2383883e6dd5f4506ebf6371d26099f59ad
pnpm exec oxfmt --check src/shared/collaboration src/skills/agent-messaging documentation/docs/user-guide/skills/agent-messaging.md CHANGELOG.md tests/repo/layout.test.ts tests/repo/plugin-manifests.test.ts
pnpm exec oxlint src/shared/collaboration src/skills/agent-messaging/src tests/repo/layout.test.ts tests/repo/plugin-manifests.test.ts
pnpm run test
pnpm run smoke
```

- Focused result: 10 files, 87 tests passed.
- Full result: 150 files passed, 1 skipped; 2,108 tests passed, 1 skipped.
- Build freshness, validation, type-check, skill-version validation, scoped formatting/lint, smoke, and diff checks passed.
- Targeted temporary-store probes reproduced all six Important findings without modifying repository source or tracked state.
- The documentation production build was not run because its prebuild writes generated inventory/build output and this reviewer was authorized to write only the declared review artifact. The changed docs were inspected, formatting passed, and repository validation passed.

## Recommended Next Step

Run `oat-project-review-receive` to convert the blocking findings into the second bounded p01 fix round. Re-run the direct takeover/cap/containment/integrity controls, true child-process crash and contention tests, and the complete repository gates before advancing to p02.
