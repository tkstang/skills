---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-13
oat_generated: true
oat_summary_last_task: prev1-t17
oat_summary_revision_count: 1
oat_summary_includes_revisions: [p-rev1]
---

# Summary: coding-session-handoff

## Overview

This project produced an experimental, read-only workflow for continuing a selected
Codex or Claude Code session in an existing destination Git worktree. The public skill
discovers and previews source sessions, validates the destination, and emits guarded
commands for the user to run in the destination tab. It does not execute providers,
create or track sessions, manipulate IDE tabs, write transcript stores, or reuse the
separate portable `session-handoff` packet workflow.

The original automated executor was retained for evidence and future work but remains
incomplete, unverified, paused, and unreachable from the public guidance bundle.
Historical live-provider gates remain evidence, not a release claim.

## What Was Implemented

- Added the public experimental `coding-session-handoff` skill and dependency-free
  generated runtime with `discover`, `preview`, and `prepare` commands.
- Added explicit Claude/Codex provider selection, provider-qualified session keys,
  canonical source and destination checks, bounded sanitized previews, and shell-safe
  destination-tab instructions.
- Added exact-all, zero-persistence transcript discovery with 50,000-entry, 512 MiB
  aggregate bounded-I/O, 256 KiB per-entry, and 30-second limits.
- Preserved exact metadata and cwd attribution from continuing transcripts larger than
  256 KiB or 128 records for guidance while strict observer and executor consumers
  remain fail closed.
- Scoped preview and prepare to the selected provider, isolated strict and summarize
  cache entries, reported stable path-free failure provenance, and summarized unrelated
  missing or stale cwd evidence without exposing paths.
- Kept Cursor fail closed because its current store lacks independent exact cwd
  evidence. Removed `--provider all` as the recommended workflow while documenting its
  fail-closed behavior.
- Regenerated all affected runtimes and advanced `coding-session-handoff` to 0.1.12,
  `session-observer` to 1.0.33, and `export-session-transcript` to 1.0.10.

## Key Decisions

- **Separate forks and handoffs.** Provider-native destination-worktree continuation
  remains distinct from portable `session-handoff` packets. The public product emits
  guidance for a user-controlled destination tab; the automated executor stays paused.
  Guidance may retain internally consistent metadata from a continued bounded prefix,
  but observer and executor defaults reject incomplete reads, and discovery never
  presents a partial set as complete. Failures expose stable path-free provider/reason
  codes. This is recorded in `DR-260912-separate-forks-and-handoffs`.

## Design Deltas

- The accepted p-rev1 revision superseded the planned automated-execution product after
  native identity and exact-version gates remained inconclusive. The revised product is
  destination-tab guidance, with provider execution explicitly outside the public
  runtime.
- Codex aggregate discovery accounting uses bounded metadata I/O rather than full file
  stat size. The design now records the provider-specific charging rule.
- Large continued prefixes are accepted only through the guidance summarize policy;
  downstream Codex projection and preview use the same guidance boundary while the
  retained exact extractor remains strict.

## Notable Challenges

- Repeated live-provider work showed that successful process execution was insufficient
  proof of exact parent/child identity, lineage, cwd, cleanup ownership, or source
  resume. The project preserved those failures rather than promoting inferred support.
- Early bounded-reader fixes passed small fixtures but failed realistic stores because
  projection, preview, cache reuse, and aggregate accounting had separate strict seams.
  Final regressions therefore exercise generated bundles with transcripts over both
  byte and record limits.
- Multiple independent reviews found progressively deeper store-scale behavior. The
  final standard re-review passed with zero findings, and the configured Cursor Fable
  exit gate passed at the Important threshold.

## Tradeoffs Made

- Exact-all discovery favors bounded, deterministic failure over partial or recent-only
  results. This makes Codex guidance unavailable when a large flat store exhausts the
  512 MiB aggregate budget.
- Users perform native provider commands themselves. This gives up one-click automation
  while avoiding unverified session mutation, cleanup, and IDE-control claims.
- The implementation reports stable aggregate diagnostics rather than private source
  paths or transcript content, limiting troubleshooting detail by design.

## Integration Notes

- Canonical TypeScript under `src/transcript/` generates committed dependency-free
  `.mjs` runtimes. Change canonical source, run `pnpm run build`, and bump every changed
  canonical skill version.
- The user-level installation must continue to track `main`; this branch has not been
  installed or globally synced.
- Final verification at `10d901e8` passed 1,923 tests with one skip. The final reviewer
  repeated 1,055 focused tests plus type-check, generated parity, validation, and skill
  version checks.
- No feature-branch push, PR refresh, installation, publication, merge, or release was
  performed during implementation closeout.

## Autonomous Execution Learnings

### Workflow issues

- Preserve independent review boundaries for session tooling that combines transcript
  privacy, Git worktree identity, provider behavior, and active-writer concerns. See
  [2026-08-31T00:53:14Z — decision — Use spec-driven review density](oat-execution-learnings.md).
- Keep remote, PR, install, and release actions separate from local implementation
  authorization. See
  [2026-08-31T00:53:14Z — decision — Keep closeout local-only](oat-execution-learnings.md).

## Follow-up Items

- Consider packaging `session-observer`, `export-session-transcript`, `session-handoff`,
  and a renamed `session-fork-to-destination` skill as a coherent `session` plugin.
- Improve Codex discovery for flat stores above roughly 2,048 maximum-prefix entries,
  likely through a small first-record cwd filter before the full bounded metadata read;
  until then, the stable byte-budget failure remains fail closed.
- Preserve provider/reason provenance when preview's second-stage rediscovery fails.
- Keep the four executor-only review deferrals visible until any future executor
  activation, which requires fresh review and live-provider evidence.
- Complete provider-path, installation, publication, and release checks separately;
  current results do not claim marketplace availability or live native-fork support.

## Explainer Outcome

The implementation-tail project recap was skipped by explicit interactive decision on
2026-09-13. No explainer run, generated recap artifact, provider call, publication, or
installation change occurred.

## Workflow Observations

### 2026-08-31 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important exit=1 status=review_failed

### 2026-08-31 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:0,minor:2 exit=0 status=ok artifact=.oat/projects/synced/coding-session-handoff/reviews/artifact-plan-review-2026-08-31T034519Z.md

### 2026-08-31 · structural · oat-project-implement · p01

Phase p01 passed fresh root-owned re-review at 3b60b06623e8ca533f7ae4298f751fddb8d95ebf; review evidence is archived in reviews/archived/p01-review-2026-08-31T042628Z.md and reviews/archived/p01-review-2026-08-31T044051Z.md.

### 2026-08-31 · structural · oat-project-implement · p03

Phase p03 ended BLOCKED after 2 authorized fix loops; final review reviews/archived/p03-review-2026-08-31T223047Z.md reports critical:1,important:1,medium:3,minor:0 at 304ec8618b8dd9377c06f226d19ffbf8473c85c4.

### 2026-08-31 · structural · oat-project-implement · p03-stop

Stopped before p04 because the final authorized p03 review found unresolved exact Codex native-identity propagation and unknown-ID cleanup-truthfulness blockers; resume through oat-project-review-receive after explicit user authorization.

### 2026-08-31 · structural · oat-project-review-receive · p03

Authorized receive advanced reviews/archived/p03-review-2026-08-31T223047Z.md from received to fixes_added; C1 and I1 became p03-t07 and p03-t08, while M1-M3 remain explicitly deferred under the user-authorized blocking-finding scope.

### 2026-09-01 · structural · oat-project-implement · p03

Phase p03 remains BLOCKED at review cycle 3 of 3; reviews/archived/p03-review-2026-08-31T235826Z.md reports critical:0,important:1,medium:3,minor:0 at a20c138b349e2afbfb4251b51edf1c338cca2783.

### 2026-09-01 · structural · oat-project-implement · p03-stop

Stopped before p04 because the review-cycle cap is exhausted with one residual Important invalid Codex cleanup-ID boundary; no additional fix, review, or live-provider gate was launched.

### 2026-09-01 · structural · oat-project-review-receive · p03-override

User explicitly authorized one bounded review-cycle override: p03-t09 validates exact Codex cleanup IDs, preserves deferred Medium findings, and permits exactly one additional targeted independent review before p04.

### 2026-09-01 · structural · oat-project-implement · p03

Phase p03 passed after one explicit review-cycle override: reviews/archived/p03-t09-review-2026-09-01T211658Z.md reports critical:0,important:0,medium:0,minor:0 at 459abf31c1c160895d2498d545095f1d5276e77d; M1-M3 remain deferred and p04-t01 is the next separately authorized live-provider boundary.

### 2026-09-01 · structural · oat-project-implement · p04-t01-stop

Stopped p04-t01 before provider mutation: an isolated exact Codex 0.151.0 CLI is logged in, but the harness-required login status --json command is unsupported, so authentication remains unverified; behavior-verify was not invoked and no provider session, receipt, locator, cleanup, or quota-spending call occurred.

### 2026-09-01 · structural · oat-project-implement · p03-auth-override

User authorized one bounded p03-t10 fail-closed Codex 0.151.0 authentication-probe correction and one targeted independent review before retrying p04-t01; the implementer must not invoke login, provider sessions, cleanup, or quota-bearing operations.

### 2026-09-01 · structural · oat-project-implement · p03-t10

Task p03-t10 completed at 7693c044db7aaf5357d3cd6e7a6000dd02bfb464 with the exact three-file boundary; root verification passed 70 focused tests, type-check, generated parity, and diff hygiene, and the one authorized targeted review is pending before p04-t01.

### 2026-09-01 · structural · oat-project-implement · p03-t10-review

The one authorized targeted independent p03-t10 review passed at 7693c044db7aaf5357d3cd6e7a6000dd02bfb464 with critical:0,important:0,medium:0,minor:0; artifact reviews/archived/p03-t10-review-2026-09-01T221652Z.md permits the authorized p04-t01 retry.

### 2026-09-01 · structural · oat-project-implement · p04-t01-stop

Stopped p04-t01 before provider mutation after the post-fix plan still reported authentication required: Codex 0.151.0 exits 0 with empty stdout and the exact authenticated status only on stderr, while p03-t10 intentionally rejects stderr-only success; behavior-verify was not invoked and no provider session, receipt, locator, cleanup, or quota-spending call occurred.

### 2026-09-01 · structural · oat-project-implement · p03-stderr-override

User authorized one bounded p03-t11 correction for the observed exit-0, empty-stdout, exact-stderr Codex 0.151.0 authentication shape and one fresh targeted independent review before retrying p04-t01; no provider mutation is allowed from the implementer.

### 2026-09-01 · structural · oat-project-implement · p03-t11

Task p03-t11 completed at 4162366f70760d65b9aef9dfa162eedb37391b54 with the exact three-file boundary; root verification passed 72 focused tests, type-check, generated parity, and diff hygiene, and the one authorized fresh targeted review is pending before p04-t01.

### 2026-09-01 · structural · oat-project-implement · p03-t11-stop

Stopped before p04-t01 after the one authorized fresh p03-t11 review reported critical:0,important:1,medium:0,minor:0 at 4162366f70760d65b9aef9dfa162eedb37391b54; broad capability normalization accepts non-exact Codex auth shapes, and no additional fix, review, or provider mutation was launched.

### 2026-09-01 · structural · oat-project-review-receive · p03-t11

Authorized receive advanced reviews/archived/p03-t11-review-2026-09-01T224710Z.md from received to fixes_added; Important finding I1 became p03-t12, a bounded exact-output comparator repair, with one fresh targeted review authorized before p04-t01.

### 2026-09-01 · structural · oat-project-implement · p03-t12

Task p03-t12 completed at 07d0165157ffd468c5603cab1b3c5674e3500aeb with the exact three-file boundary; root verification passed 82 focused tests, type-check, generated parity, and origin/main ancestry. The p03-t11 review advanced to fixes_completed, and one authorized targeted p03-t12 review remains before p04-t01.

### 2026-09-01 · structural · oat-project-review-receive · p03-t12

The fresh targeted review at reviews/archived/p03-t12-review-2026-09-01T234310Z.md passed with zero Critical, Important, Medium, or Minor findings at 07d0165157ffd468c5603cab1b3c5674e3500aeb. Phase p03 is complete at 12/12; p04-t01 may resume from a fresh mutation-free plan check.

### 2026-09-01 · structural · oat-project-implement · p04-t01-stop

The single authorized exact Codex 0.151.0 live gate returned inconclusive with reporting-failed; redacted receipt digest 951a74c1c9d63d27c7bb0f018a4611e1b14a67ab2e2a2bd120e8f56eaf73a21b. Git fixture cleanup succeeded, provider-state cleanup failed, no required successor evidence was observed, and no automatic retry or manual cleanup was attempted.

### 2026-09-02 · structural · oat-project-implement · p04-t01-diagnosis

User-authorized diagnosis found no transcript or state-database thread for the failed fixture and therefore no exact cleanup UUID; a parent-only ephemeral Codex 0.151.0 probe passed with one exact thread.started event and no persistence. One fresh manual full-gate retry is authorized; the original inconclusive receipt remains preserved.

### 2026-09-02 · structural · oat-project-implement · p04-t01-retry-stop

The user-authorized manual Codex 0.151.0 retry reproduced inconclusive reporting-failed before any exact parent ID was observed. The second receipt digest is f69f4949d1da2393f289f9f3dc397206c34d108a367300cd9b5adfea2c22db0e; no matching transcript or state-database thread exists, no manual deletion target was inferred, and no third gate attempt was launched.

### 2026-09-02 · structural · oat-project-implement · p03-t13

User authorized one bounded p03-t13 repair to preserve a stable redacted live-gate failure stage plus exactly one fresh targeted independent review. No further live behavior gate, provider-session mutation, p04-t02, or p05 work is authorized in this run.

### 2026-09-02 · structural · oat-project-implement · p03-t13-implementation

Task p03-t13 completed at 0e5bc879a7f68c50d69b5207ce07efd631462fb5 with the exact five-file boundary. Root verification passed 82 focused tests, type-check, generated parity, diff hygiene, and current origin/main ancestry; one authorized targeted independent review remains, and no live provider operation was run.

### 2026-09-02 · structural · oat-project-implement · p03-t13-review-stop

The one authorized targeted p03-t13 review completed at 0e5bc879a7f68c50d69b5207ce07efd631462fb5 with critical:0,important:0,medium:1,minor:0. M1 found that OS-level launch exceptions such as ENOENT are mislabeled provider-nonzero-exit; the gate remains fail-closed and redacted. No fix task, second review, or live provider operation was launched pending explicit direction.

### 2026-09-02 · structural · oat-project-review-receive · p03-t14

User authorized review finding M1 as bounded task p03-t14: classify null-exit/no-signal/no-timeout provider results as provider-call-exception while preserving fail-closed redaction and all other stages. The user explicitly waived re-review; after verified implementation the existing p03-t13 event may advance only to fixes_completed, not passed.

### 2026-09-02 · structural · oat-project-implement · p03-t14

Task p03-t14 completed at eae373b80bf8175cfe29de7ccfd7e682779c9d57 with the exact three-file boundary. Root verification passed 83 focused tests, type-check, generated parity, diff hygiene, and fresh origin/main ancestry; the p03-t13 review advanced only to fixes_completed under the explicit re-review waiver, and no live provider operation or new review was launched.

### 2026-09-02 · structural · oat-project-implement · p04-t01-diagnostic-stop

The single authorized Codex 0.151.0 live-gate attempt returned inconclusive reporting-failed with the new stable failure stage native-identity-unresolved; redacted receipt digest 9a42096799993af38b07374dbc765d214aff9768175d067b645f71cc99987166. Receipt validation and Git fixture cleanup passed, provider-state cleanup failed because no exact parent native ID was observed, no cleanup target was inferred, and no automatic retry or manual deletion was launched.

### 2026-09-02 · structural · oat-project-implement · p03-t15-review-boundary

p03-t15 completed at 9db197fe765e18c4c925a9792097c473437f2e84 with 88 focused tests, type-check, generated parity, exact five-file scope, and clean history; parked before the standard independent review and any p04-t01 live retry because neither is authorized.

### 2026-09-05 · structural · oat-project-implement · p03

Phase p03 passed after 1 bounded fix iteration; attempted review orchestration is recorded in reviews/p03-review-2026-09-05T202836Z.md and the fresh narrowed review passed at reviews/p03-review-2026-09-05T204213Z.md.

### 2026-09-05 · structural · oat-project-implement · p04-t01

STOP before provider mutation: the exact Codex 0.151.0 behavior-plan passed version/syntax/bounds but requires ChatGPT authentication; behavior-verify was not invoked and no receipt or provider cleanup target exists.

### 2026-09-07 · structural · oat-project-implement · p04-auth-wait

Authorized live-gate continuation reached provider authentication boundaries: exact Codex 0.151.0 device auth is awaiting user completion, while exact Claude Code 2.1.251 is installed temporarily but logged out; no successor session or cleanup operation ran.

### 2026-09-08 · structural · oat-project-implement · p04-t01-native-identity-stop

The user-authorized exact Codex 0.151.0 live gate authenticated and matched all reviewed plan bounds, then returned inconclusive at native-identity-missing; redacted receipt digest e28aa884c4239c2e73dc97f441859dd7bb7b85febd7e19144a0731f7641a43ff. Git fixture cleanup succeeded, provider cleanup could not run without an exact parent ID, and no automatic retry or inferred deletion target was used.

### 2026-09-08 · structural · oat-project-implement · p04-t02-auth-stop

Stopped p04-t02 before provider mutation: the isolated exact Claude Code 2.1.251 preflight reports loggedIn false with no authentication method; behavior-plan and behavior-verify were not invoked, and no Claude session, receipt, locator update, cleanup, credential capture, or quota-spending call occurred.

### 2026-09-08 · structural · oat-project-implement · p04-t02-auth-recovery-stop

A fresh exact Claude Code 2.1.251 subscription login opened but remained at its one-time-code prompt without persisting authentication and was cancelled cleanly; exact and system Claude still report loggedIn false. p04-t02 remains stopped before behavior-plan or provider mutation, and no token or code was captured.

### 2026-09-08 · structural · oat-project-implement · p04-t02-context-stop

Correction to p04-t02-auth-stop and p04-t02-auth-recovery-stop: exact Claude 2.1.251 authenticates outside the sandbox; prior file-based credential checks did not prove login persistence failure. The mutation-free plan instead lacks its execution-context fingerprint because the 197171680-byte native executable exceeds the 134217728-byte limit in providers.ts. Stopped before behavior-verify; see implementation.md Run 21.

### 2026-09-08 · structural · oat-project-implement · p03-t16

Phase outcome: p03-t16 passed targeted independent review with zero findings at d15fd662d1baf5ff26cc6ccd09925212a8f9ff46; review artifact reviews/archived/p03-t16-review-2026-09-08T220043Z.md; fix-loop count 0.

### 2026-09-08 · structural · oat-project-implement · p04-t02-evidence-stop

Stopped after the single authorized Claude 2.1.251 live attempt: inconclusive at evidence-validation because child identity and target cwd were unobserved; exact Git-fixture and provider-state cleanup passed; receipt digest 7a0fd46916f182f08aecb3bd2dbcb3cb97b7344f648bbf53709e9f057e7f869b; no retry or p05-t02 review launched.

### 2026-09-08 · project · friction · Claude successor identity mismatch

Observation: the exact Claude 2.1.251 successor call returned a valid session ID that differed from the pre-generated child ID, so the gate discarded it and stopped before cwd, lineage, or source-resume evidence capture. Impact: p04-t02 remains inconclusive even though authentication, resource bounds, and cleanup passed. Recommendation: revalidate the native --resume/--fork-session/--session-id contract without another live retry before changing the harness. (observed on Claude Code 2.1.251)

### 2026-09-12 · structural · oat-project-implement · p03-t18-bookkeeping

Recorded p03-t17 (2c3a835) and p03-t18 (42803fc) retroactively; root verified 42803fc with 204/204 handoff tests, full suite 1860/1861 (one unrelated consensus timing flake passing in isolation), type-check, build parity, validate, smoke, and diff hygiene. No review artifact exists for either task, no gate-evidence directory remains, and no live provider operation ran.

### 2026-09-12 · structural · oat-project-implement · run-27

run-27-pre-review aligned observed Claude identity contracts and reconciled task records after merging main; independent t17/t18 review pending, no live provider operation.

### 2026-09-12 · structural · oat-project-implement · run-27

run-27-review-boundary stopped after targeted t17/t18 review requested changes (I1 UUID casing, m1 formatting); aligned contracts and merged-main verification retained; formal receipt and bounded fix/re-review authorization required, no live provider operation.

### 2026-09-12 · structural · oat-project-implement · run-28

run-28-bounded-cycle-complete: p03-t19 fixed I1/m1 at 12cf6edf; one independent re-review passed with zero findings; aggregate 1866 passed and 1 skipped. Stopped at fresh live-provider authorization boundary; no provider operations, activation, feature push, PR mutation, or portable-packet scope expansion.

### 2026-09-12 · structural · oat-pjm-decision · DR-260912-separate-forks-and-handoffs

handoff-split-decision-20260912: Recorded the accepted two-skill split in .oat/repo/reference/decisions/DR-260912-separate-forks-and-handoffs.md; portable activity enrichment and migration remain future work. p04-t02 remains at fresh authorization for isolated exact Claude 2.1.251 staging and mutation-free preflight/behavior-plan, followed by separately authorized behavior-verify; no provider operation or live retry ran.

### 2026-09-13 · structural · oat-project-revise · p-rev1

handoff-guidance-revision-20260913: Recorded accepted destination-tab guidance scope for three entry points and Codex/Claude/Cursor; created prev1-t01 through prev1-t05, updated discovery/spec/design/state/summary and revision-handoff.md, and paused/superseded original automation work without marking its gates passed. Independent structured plan review has no blocking findings and one offered Medium verification suggestion. Stop at user-requested planning handoff to Sol; no implementation, provider operations, feature push, or PR mutation.

### 2026-09-13 · structural · oat gate review · final

target=cursor-fable-5-1-high threshold=important findings=critical:0,important:1,medium:2,minor:2 exit=1 status=blocked artifact=.oat/projects/synced/coding-session-handoff/reviews/final-review-2026-09-13T042209Z.md run=d0d1b97a-1990-47ce-a35f-2b985f1116ce

### 2026-09-13 · structural · oat gate review · final

target=cursor-fable-5-1-high threshold=important findings=critical:0,important:1,medium:2,minor:1 exit=1 status=blocked artifact=.oat/projects/synced/coding-session-handoff/reviews/final-review-2026-09-13T051014Z.md run=e9e2ae8f-1305-4774-bf31-775a0f24e067

### 2026-09-13 · structural · oat gate review · final

target=cursor-fable-5-1-high threshold=important findings=critical:0,important:0,medium:1,minor:2 exit=0 status=ok artifact=.oat/projects/synced/coding-session-handoff/reviews/final-review-2026-09-13T134826Z.md run=40318b14-539a-49c6-ad8b-167fac333457
