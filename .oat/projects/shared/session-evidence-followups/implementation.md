---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-20
oat_current_task_id: null
oat_generated: false
---

# Implementation: session-evidence-followups

## Progress Overview

| Phase | Status  | Tasks | Completed |
| ----- | ------- | ----- | --------- |
| p00   | complete | 1     | 1/1       |
| p01   | complete | 2     | 2/2       |
| p02   | complete | 2     | 2/2       |
| p03   | complete | 1     | 1/1       |
| p04   | complete | 1     | 1/1       |

**Total:** 7/7 tasks completed.

## Orchestration Runs

### Run 1 — 2026-09-20

One branch/PR: backlog-review-2026-09-20. Native Sol phase implementation, user-selected Opus through Consensus Review. High ceiling, no parallel product phases because shared generated payload/version ownership overlaps. Read-only recon ran concurrently. IMPLEMENT-03: final checkpoint p04, autonomous continuation authorized by user. Additional requested timeout adjustment executes first as p00.

### p00 — completed

Request `evidence-p00-20260920`; native `/root/p00_timeout` accepted and completed. Exact materialized role `oat-phase-implementer-gpt-5-6-sol-medium`; High policy, default-implementation class, medium effort selected for a bounded default change; candidates Sol medium/high. Runtime identity is configured invocation evidence, not independently observed.

`Dispatch: scope=p00 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium`

Base `f7298f35195ff305ec2d223f3873845444dc2317`; task commit `852be12cf67f5231f481dd97ce741e057d841937`; self-review passed. Root verified bounded files and clean worktree. Recovery attempts 0. No nested workers.

Independent Consensus Review requested `claude:opus --effort high`, run `8c84e955-3f2e-4817-afd8-a7d08531875b`, passed with 0 Critical/High, one Medium and one Low. [Canonical review](reviews/archived/p00-opus-review.md) is preserved unchanged. Consensus replaces the OAT-native reviewer contract by user selection; its own validated structured envelope supplies provenance, and no OAT reconnaissance claim is fabricated. Requested model/effort are configured controls; wrapper reports actual model/effort unobserved.

Disposition: M1 accepted as host-budget documentation guidance; same native handle continued as `evidence-p00-fix1-20260920`, commit `37f2832f387c1b5559a32c40396b1d92013b0fa9`, root inspected the exact docs-only diff. L1 declined: default dispatch assertion already fails meaningfully and duplicating the test adds no coverage. Reviewer question about why 900 seconds: explicit user-selected budget after observed 600-second cutoff, not a claimed latency percentile. No further review needed for this bounded nonblocking documentation clarification; final integration review still covers it.

Validation: focused run.test.ts 25/25, type-check, build, build:check, scoped lint/format, skill-version validation from baseline, documentation production build and diff check passed. Docs follow-up repeated build freshness, scoped format, version validation, production docs build and self-review. Global installs remain unchanged until merge.

### p01 — complete and independently reviewed

Request `evidence-p01-20260920`, native `/root/p01_watcher` accepted/completed as `oat-phase-implementer-gpt-5-6-sol-high`; High policy, hard-reasoning class, high effort for cross-runtime signal and checkpoint semantics; candidates Sol medium/high, high selected. No nested workers, recovery 0/10.

`Dispatch: scope=p01 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-high`

Base `73e1752b57e03878a908f506622142a5115b41e2`; p01-t01 `c1b68367b3cb143654f095e308b3f1cc81ba4788`; p01-t02 `83b36bf602c26a7309ed1e2b6e173ccf83a0798a`. Root verified exactly two in-scope task commits and clean worktree. Self-review passed. Observer 1.0.73, collab 1.0.61, export 2.0.24 and fork 0.2.38 include required transitive version closure.

Verification: watcher 60/60; shared terminal/activity 32/32; full collaboration directory 199/199 across 13 files; typecheck, build/freshness, baseline skill versions, validate, scoped lint/format, diffcheck and docs production build (58 pages) passed. Claude watch integration checks pre-checkpoint pointer join, explicit-abort suppression and body omission. Subprocess audit: comparable cleanup tests wait for ownership/startup; max-runtime tests use virtual clocks or intentionally test timeout behavior, so no matching fixed-lifetime event-count race remains.

Final-tree stress: [log](evidence/p01-final-stress.log), [temporary harness retained as evidence](evidence/p01-stress-harness.sh). Exactly 50 consecutive passes, 30 loaded iterations (11–40), clean process teardown. Root independently checked sequence/count and SHA256 `e3b9a6ad30da3f00d02c65b2c2d5db71daa7fcd6a3e348c1f67a8a7fa44b1e82`. Initial test-only log also passed 50/50, but final acceptance uses the final-tree evidence. Three fixing-PR validate successes still pending; no ticket closed.

Review routing: exact Opus reviewer under High policy, `--effort high` user-selected Consensus route. The base-branch selector's 2 MiB whole-file snapshot cap is exceeded by duplicated generated bundles. Preserve authored before/after diff including deletions, immutable base/head and hashes of every changed file in a bounded external review packet; verify generated units with build:check and version validation. Keep entire checkout stable. This changes review transport only, not review scope or acceptance requirements; final review uses the same method if needed.

### p01 review disposition — fixes verified

Independent Opus review run `446cd7d0-bd2c-4b53-b1f4-6b62e1bdd9c4` passed with zero Critical/High, two Medium and one Low; [canonical result](reviews/archived/p01-opus-review.md), [immutable reviewed packet](evidence/p01-review-packet.md), captured packet SHA256 `465a369170673c235b4f99923648479223b6db86c7600965bf96fa948d9ef8ec`. Requested `claude:opus --effort high`; actual model/effort unobserved by wrapper. No OAT-native reconnaissance claim is fabricated for this user-selected external review.

M1 accepted: preserve meaningful aborted/truncated assistant output; suppress provider API-error bodies only with explicit filtered accounting and documented behavior. M2 accepted: native Claude message IDs span records; fold explicit-abort evidence across prior same-session blocks, with tests for non-final abort flags and later-only/orphan references. Root additionally observed that the existing map could join a future assistant record, contrary to the plan's prior-record requirement; fix in the same join scope. L1 accepted: stop/heartbeat documentation and printed label must describe delivered delta plus terminal events. Retry suffix whitespace question declined: strict observed grammar is intentional; no unsupported locale/whitespace inference is required. Cursor metadata frames already lack narrative content, so preserving meaningful Claude partial output resolves the apparent asymmetry.

Same Sol handle receives bounded continuation `evidence-p01-fix1-20260920`, linked to `evidence-p01-20260920`; no replacement or target change. Review passed does not waive these accepted fixes or their verification. A bounded independent follow-up will verify the changes.

Fix continuation completed as `82ea5a103497aa8210035a889e256f07cb5cafa9`, exactly one append-only commit from `a3f782c4da52ab0a02cdd0869904e41e6f6e32ca`. Root inspected the native join and digest accounting diff; clean worktree verified. M1/M2/L1 implemented, including root's future-only pointer and double-accounting checks. Observer1.0.74, collab1.0.62, export2.0.25 and fork0.2.39. Watcher60/60, shared decoder/activity34/34, digest62/62, collab199/199; types, build/freshness, validate, version checks, scoped lint/format and docs build passed. Signal/rearm mechanics unchanged; retained 50-run stress proof remains applicable. One nonblocking fix round, no implementation recovery attempts. Focused independent verification review pending.

Bounded independent verification run `c47f8d9e-a43b-48e3-b790-fdf445abf041` passed: zero Critical/High/Medium, all original M1/M2/L1 fixes verified. [Canonical review](reviews/archived/p01-opus-fix-verification.md), [packet](evidence/p01-fix-review-packet.md), packet SHA256 `e62eeba813f08ef151da7ec6b7ea819e4d704db2867fdcc2bd21a9ae2dd9b359`; reviewed HEAD `c7b17f4455e20d2231c92caf210c252faefce822`. Requested Opus/high, actual model/effort unobserved by wrapper. One new Low changelog wording issue accepted and fixed by same Sol handle in `a9f409b28d916beef6105e2dc0fd369be349580a`; root inspected exact one-file diff, scoped formatting/self-review passed. It accurately distinguishes runtime changes from conservative transitive source version-validation bumps. No runtime change followed the passing review. Independent final integration review still covers the complete delta.

### p02 — implementation completed; independent review pending

Request `evidence-p02-20260920`, native `/root/p02_activity_metadata`, exact role `oat-phase-implementer-gpt-5-6-sol-high`; High policy, hard-reasoning class for native identity, source metadata budgets and usage semantics. Base `6d863965848d699afa09cd075d2295e57772be34`. User-selected Sol/high remains available in the live native catalog; dated guidance is review-required, incumbent retained with current user authorization and passing prior-phase evidence. Configured invocation evidence does not prove observed runtime identity. No nested workers, no recovery attempts. Root verified exactly two task commits and clean tree, and inspected skill projection/watch seams and usage extraction.

`Dispatch: scope=p02 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-high`

Task1 `47534bf965b04a15774ac2c993ca32d00b6a656f`: native Claude attribution/invocation and names-only available/invoked attachments; exact Cursor Read/ReadFile.path and historical Codex read_file.file_path inference. Shell/prose, aliases and wrong keys stay unclassified. Source metadata is captured-source, budgeted with omissions; watcher avoids replaying source-wide metadata. Focused activity77/77, relevant consumers863/863, final focused372/372; types, build/freshness, validate, version closure, scoped lint/format, docs production58 pages and self-review passed.

Native evidence: [Cursor aggregate receipt](evidence/p02-cursor-carrier-scan.txt), SHA256 `d15ca623c59aa0c525aaedb7a3f4669a787b67ae9936f71313afca1114b07b87`, surveys1297 JSONL files,45481 structured Read/ReadFile carriers,3091 SKILL.md paths. Root verified official Codex [removal commit](https://github.com/openai/codex/commit/14c35a16a8a41cc16c5e36c2c4287b7b2db6e975), parent `c6ffe9abab04bd3349ecc49fffc0fbf9551826e6`: exact experimental read_file function schema required file_path. [Retained upstream schema receipt](evidence/p02-codex-read-schema.json). Carrier was removed2026-03-25 and absent from recent local samples. Historical native decoding satisfies the direct-read criterion without claiming current shell reads are classified; no speculative tool aliases or command parsing were added.

Optional parallel preparation: same Sol/medium handle `/root/p00_timeout` produced read-only p04 draft `/tmp/evidence-p04-retro-draft.md` (SHA256 b872aabb96b383adde61bcc92048d23930f6861e81e990bdf63159767bf5fb77) under request `evidence-p04-draft-20260920`, then p03 preflight `/tmp/evidence-p03-preflight.md` (SHA25640e3fba73549a2d131ad4ee76271aa454abd871d258999cb7005ddfe0c6efc9d) under `evidence-p03-preflight-20260920`. A prior fresh optional draft worker launch was rejected before start for host thread limit; no child started, and existing exact Sol/medium handle performed the bounded preparation. These preparations made no repo mutations and are not phase implementation. Root rejected preflight suggestions to substitute filename identity for Claude/Codex native-record evidence and to fail every partial capture; corrected artifact requires native-record identity and honest partial coverage. Product phases stay sequential.

Task2 `92b688f9fa95cd5bd8bc9d4d6267c995134ecdfa`: native Claude exact-session/message dedup with conflict/uncertainty diagnostics; Codex separate cumulative, last-turn and response samples, reset segmentation and evidenced model joins; Cursor not-recorded, no prices or computed totals. Full phase verification: activity80/80; relevant activity/observer/export/collaboration866/866; types, build/freshness, repository validate, baseline version closure, scoped lint/format, diff check and docs production58 pages passed. No uncommitted changes or concerns reported. Independent Opus phase review pending.

## Task Records

### Task p00-t01: Give Consensus Review fifteen minutes by default

**Status:** completed
**Commit:** 852be12cf67f5231f481dd97ce741e057d841937
**Outcome:** Provider dispatch defaults to 900 seconds with explicit internal overrides retained; host budget guidance added in 37f2832f.
**Verification:** 25 focused tests, typecheck, build/freshness, version gate, docs build and independent Opus pass; details in p00 above.

### Task p01-t01: Stabilize SIGTERM re-arm evidence

**Status:** completed
**Commit:** c1b68367b3cb143654f095e308b3f1cc81ba4788
**Outcome:** Condition-based delta/checkpoint wait replaces fixed120ms lifetime; runtime shutdown unchanged.
**Verification:** 50 consecutive final-tree passes including30 loaded; full watch suite and subprocess audit. Three PR CI successes remain ticket acceptance.

### Task p01-t02: Emit unsuccessful terminal metadata

**Status:** completed
**Commit:** 83b36bf602c26a7309ed1e2b6e173ccf83a0798a
**Outcome:** Claude/Codex/Cursor metadata-only terminal watch events, existing checkpoint dedup and bounded inferred retry fragments. Accepted review fixes are implemented and independently verified above.
**Verification:** Watcher60, decoder/activity32, collaboration199 tests and phase gates passed; independent review pass with accepted follow-up findings.

### Task p02-t01: Attribute skill activity without instruction bodies

**Status:** completed
**Commit:** 47534bf965b04a15774ac2c993ca32d00b6a656f
**Outcome:** Native and inferred skill evidence, names-only source metadata, budgeted projection and watch delivery integration.
**Verification:** Focused and consumer suites, native carrier evidence, generated/version/docs gates and self-review passed; independent phase review pending.

### Task p02-t02: Preserve honest token accounting

**Status:** completed
**Commit:** 92b688f9fa95cd5bd8bc9d4d6267c995134ecdfa
**Outcome:** Captured-source native usage samples retain separate semantics, model evidence and diagnostics without invented totals or pricing.
**Verification:** Activity80/80, relevant consumers866/866 and generated/version/docs gates; self-review passed, independent phase review pending.

### Task p03-t01: Export complete sensitive JSON from one snapshot

**Status:** completed
**Commit:** 190e5a51f20b5560be458655dd8dfda2284747f0
**Outcome:** Exact-session paired narrative and complete sensitive activity JSON share one read/scan, timestamp, native identity and provenance. Complete projection has no invocation or total-byte eviction; preview caps remain. Output guards protect source, paired files and both observer state roots; JSON replacement is atomic.
**Verification:** Focused capture/activity134/134; runtime/observer202/202; full suite2499 passed, one expected skip; types, validate, build freshness, baseline skill versions, scoped lint/format and docs58 pages passed. Self-review complete; independent phase review pending.

### Task p04-t01: Review frozen activity with provenance

**Status:** completed
**Commit:** c97f65db49a08af556f14a8a151e54a23d4f86bf
**Outcome:** Session Retro1.0.1 requires distinct exact reviewing/target identities and complete paired frozen exports, preserves coverage/origin/usage limitations, separates observed evidence from interpretation/proposal, and declares the required exporter workflow. Template, guide and generated forms updated.
**Verification:** [Manual two-fixture acceptance](evidence/p04-acceptance.md), unchanged [frozen captures](evidence/p04-fixtures/README.md), seven-state type comparison; build/freshness, structure, types, phase-base versions, scoped lint/format and docs production passed. No new runtime or prose-equality tests. Independent phase review pending.

## Implementation Log

- Plan committed and reviewed; initial response-format failures preserved as diagnostics, not passes. Valid review found one High native retry-grammar issue; bounded fix verification passed with zero findings.
- Root complexity pass complete, no material runtime simplification required. Baseline generated-output freshness passed.
- Task-specific evidence and commits will be recorded here after each child returns. Root does not mutate the checkout while a child owns implementation or while Consensus reviews it.

## Deviations from Plan / Design

| Task / Review    | Planned                    | Actual                                                                                     | Reason                                                                                    |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| User addition    | Six backlog tasks          | Added p00-t01: review default 600→900 seconds                                              | Explicit user request during planning; no extra wave                                      |
| Review transport | Installed Consensus Review | Temporary copy strips unsupported JSON Schema dialect annotation only at Claude invocation | CLI rejected annotation; original schema and deep validation unchanged, no shipped change |

## Test Results

| Scope    | Command              | Result                                                 |
| -------- | -------------------- | ------------------------------------------------------ |
| Baseline | pnpm run build:check | Passed; /tmp/session-evidence-baseline-build-check.log |

## Final Summary (for PR/docs)

All seven tasks across p00–p04 are implemented, self-reviewed by the user-selected Sol implementers and independently reviewed through requested Opus/high Consensus invocations. Final integration review remains pending; implementation stays in progress through closeout.

The wave stabilizes SIGTERM watcher re-arm and emits deduplicated metadata-only unsuccessful native terminal events without peer-continuation authority. Shared activity adds native/inferred skill evidence and honest per-runtime usage semantics, ownership, resets and coverage. Exact-session export can write one frozen sanitized narrative plus complete sensitive structured activity JSON, with native identity/provenance, bounded previews, guarded source/state destinations and atomic JSON replacement. Retro requires the installed exporter workflow and a distinct reviewing session; it analyzes frozen evidence only, preserves all seven coverage states and separates observations, interpretations and proposals.

Canonical changes live in shared transcript/activity and terminal decoding, Observer watch/digest, Exporter's CLI, Retro instructions/template and distribution dependencies. User/engineering docs, generated standalone/plugin payloads and version/changelog closure match. Current changed skills: Review 0.1.17, Observer 1.0.81, Collab 1.0.69, Exporter 2.0.33, Fork 0.2.47 and Retro 1.0.2. Main4150cfe2(PR100/101) is merged; its Consensus0.2.1 Draft-07 schemas,900-second Review default and CLI timeout override are retained, with branch host-poll guidance. No temporary schema shim ships.

[Final integration checks](evidence/final-checks-complete.json):170 test files/2521 tests passed,1 expected opt-in skip; types,build:check,validate,smoke,changed-authoredlint/format,origin/main skillversions and diffcheck passed. Docs production58pages and actual desktop/phone light/dark diagram inspection passed. Watcher evidence retains50consecutive local passes including30CPU-loaded and3successful fixing-PR CI attempts. [Acceptance audit](evidence/final-acceptance-audit.md) maps all29ticket criteria; its stale packaging assertion was corrected and verified. Two frozen synthetic retro exercises retain honest limits.

All accepted phase findings are implemented. Latest corrections protect every direct ordinary-file state inode, clarify supported exporter identities, classify usage extraction failure as content-free not-read (including compact omission and quiet-empty handling), and document the opt-in narrative invocation-key index. Final review explicitly covers these bounded deltas. Recovery1/10 fixed the outdated packaging assertion append-only. Source/version closure and a required diagram proof caused no scope expansion. PR99 remains the single delivery PR; six-ticket lifecycle closeout, final review/gate and summary/document/PR sequencing remain before ready status. No merge, release, global install or provider-wide acceptance is claimed.

## References

- [Plan](plan.md)
- [Discovery](discovery.md)
- [Review dispositions](reviews/archived/plan-review-disposition.md)
- [Complexity review](reviews/archived/complexity-review.md)

## Progress PR

Draft PR #99 opened on branch backlog-review-2026-09-20 against main at remote head90086e6e. Pre-push validate/buildfreshness/types/version/internalflags passed. Conventional Commit title: `feat(session): add reliable activity evidence for retros`. Progress artifact is local `pr/progress-p01-2026-09-20.md`. Implementation remains in progress. CI at this fixing-PR head can qualify for watcher acceptance; no CI pass is yet claimed.

## Watcher CI acceptance proof

PR #99 Validate workflow `35540437989`, attempts 1, 2 and 3, all completed successfully at fixing head `90086e6e2c857185e14d6c57af624fd31737b550`. Each validate job passed; [machine-readable receipt](evidence/p01-ci-proof.json) retains exact job URLs, timestamps and conclusions. Two deliberate successful-run reruns provide three consecutive executions on the same watcher implementation. No failed run was hidden or retried. The later changelog-only wording correction does not change watcher behavior. This satisfies the three-run stability criterion alongside the final-tree50-run local stress proof. Ticket closeout will be finalized with the full wave acceptance audit; any subsequent validation failure must be investigated and the current success streak re-established.

## p02 independent review disposition

Consensus run `af48661b-3642-4447-8bec-cd81881f0bea` completed validly with changes_requested: zero Critical, two High, two Medium, two Low. [Canonical review](reviews/archived/p02-opus-review.md), [immutable packet](evidence/p02-review-packet.md), packet SHA256 `11b52f6b3b71afedbb5f7a0fc923351a001319c92f07ba6e72e2e370a0e5767c`; reviewed HEAD `8094b2dff14d9f2bea6f0b03f2ec82857e7d1898`. Requested `claude:opus --effort high` via user-selected Consensus route, model/effort unobserved by wrapper; no OAT-native reconnaissance claim fabricated. Root verified valid envelope and stable diff.

All six findings accepted within the existing p02 scope:
- H1: response usage must compare native thread_id, not originating session_id, against nativeSessionId. Root independently inspected a local2026-09-04 rollout:114/114 usage records have thread_id matching native header id while session_id differs. Use native-shaped regression fixtures.
- H2: bound new optional source metadata before it can evict delivered calls/results. Preserve captured-source semantics and explicit omitted counts; do not relabel range-filtered metadata as complete source. Root confirmed event-first reduction currently reaches metadata trimming only with an empty event set. Add mixed events plus oversized metadata regression.
- M1: apply existing Codex ownership evidence to cumulative/last-turn usage, preventing inherited parent context from appearing as child-owned usage or a reset across ownership boundaries. Preserve unknown evidence honestly; reuse narrow existing ownership rules.
- M2: restore Skill invocation arguments under the existing preview cap. Caller args are not attachment instruction bodies; keep names-only attachment extraction. No silent redaction beyond the existing contract.
- L1: make coverage explicitly describe source-level skill-name carriers, distinct from per-event evidence; update consumers/docs and distinguish absent carrier from a valid empty listing.
- L2: deduplicate available names within captured source retaining a documented representative locator; keep invoked occurrences distinct. Test repeated names and invocation occurrences.

Same exact Sol/high handle receives `evidence-p02-fix1-20260920`, linked to original request `evidence-p02-20260920`; bounded one-commit fix, self-review and focused checks, then independent Opus verification. Review-fix round1 of2, no implementation recovery attempts. p03 remains gated on this review resolution.

### p02 fix outcome — verification pending

Same Sol/high handle completed `evidence-p02-fix1-20260920` in exactly one commit `b58fd28ff6172ffdead3317c8b3ed5530a72f3c1` from `6d7ec63c9d42feb6a9423bc301e64127428969a2`; clean tree verified. All six accepted findings implemented. Native response identity uses thread_id; optional source metadata is trimmed before delivered events; Codex usage carries existing owned/inherited/unknown semantics with ownership-separated reset/model state; Skill caller arguments restored; source-skill-names coverage distinguishes native carrier availability; available names dedup with latest locator, invoked occurrences preserved. Root inspected priority search, response identity and ownership/model logic.

Pre-fix regressions failed eight focused cases; final activity83/83, relevant consumers869/869, types, build/freshness, validate, baseline version closure, scoped lint/format, diff check and docs production58 pages passed. Self-review passed, no unresolved concerns. Versions observer1.0.77, export2.0.28, collab1.0.65, fork0.2.42. No implementation recovery used; one review-fix round. Independent bounded Opus verification pending; requested Opus/high remains exact user-selected route, actual runtime identity is unobserved.

Additional optional Sol/medium preparation `evidence-p04-fixtures-20260920` produced external synthetic Claude/Cursor native inputs under `/tmp/evidence-p04-fixtures/` (combined sorted-content hash6e8a68cd60df099a950f23e8f57cb5bf32622543eeaa7fd7618d86c53f1526a6) and `/tmp/evidence-p04-fixture-checklist.md` (SHA25637e9d5e510bc2ef260ec877aa62bcc1f567836cd3af1931600cbff65ae74d4c7). JSON parsing passed; no repo writes, builds, exports or provider calls. Fixtures cover a subset of coverage states; p03/p04 acceptance remains pending actual frozen exports.

### p02 independent verification — passed with bounded Low follow-ups

Consensus run `c79c4062-1531-457e-9b7e-79049cd55942` passed with zero Critical/High/Medium. All original six fixes independently verified. [Canonical review](reviews/archived/p02-opus-fix-verification.md), [immutable packet](evidence/p02-fix-review-packet.md), packet SHA256 `43f1202ac8aa64c11369f05256a04c318e82a345da73cd5010ac016d205a389c`; reviewed HEAD `9a74ed1d8b6ca5bc7354e6bdc45bdae052ac0487`. Requested Opus/high, actual model/effort unobserved. Valid envelope and stable checkout confirmed. Reviewer independently sampled1931 response records across39 rollouts, corroborating native thread identity; no tests were claimed as run by reviewer.

Five new Low findings accepted as bounded polish: (L1) final metadata fallback should continue using already-trimmed optional metadata instead of reintroducing it ahead of locator-less coverage; (L2) replace the vacuous old body sentinel assertion with real attachment sentinels across the whole extraction; (L3) add a mixed-event forced group-eviction regression with omission reconciliation; (L4) require the ownership events argument instead of defaulting it to an empty array; (L5) cover both source-level carriers, including invoked-only and valid empty invoked lists, with a count matching source-name evidence rather than availability-only count. Root verified the fallback and carrier predicates. Same Sol/high handle will implement one bounded follow-up `evidence-p02-fix2-20260920`. No unresolved blocking finding; the next p03 independent review will explicitly include this Low follow-up diff, and final integration review remains required, avoiding a duplicate standalone phase review for this polish.

Reviewer's statement that64MiB export is a complete uncapped capture is not adopted: existing bounded export remains capped until p03 explicitly implements nullable maxBytes. This is already a separate approved requirement, not an acceptance waiver.

### p02 terminal outcome

Low follow-up `evidence-p02-fix2-20260920` completed in exactly one commit `9a3c11fc45fd374ab37202f980fdec50af312176` from `5ebc608671445c2f16aa5266a9cbd45ba5ceeb8b`. Root inspected the complete narrow runtime diff and verified clean tree. All five Low findings addressed: already-bounded metadata remains bounded through final fallback; real whole-extraction body sentinels; forced4KiB group-eviction omission reconciliation; required ownership input; both source-name carriers count correctly including valid empty arrays. Activity85/85 and affected consumers871/871, types, build/freshness, validate, baseline version closure, scoped lint/format, diffcheck and docs production58 pages pass. Versions observer1.0.78, export2.0.29, collab1.0.66, fork0.2.43. Self-review passed, no unresolved findings. Two bounded review-fix rounds used; no implementation recovery. p03 review will include the final Low follow-up starting at base5ebc608, as well as its own phase diff. p02 is complete; p03 may proceed.

## p03 implementation outcome — independent review pending

Request `evidence-p03-20260920`, native `/root/p03_full_capture`, exact role `oat-phase-implementer-gpt-5-6-sol-high`; base `e753522e9d5bd51fe8b2611595ef29ad9a8af49c`, sole task commit `190e5a51f20b5560be458655dd8dfda2284747f0`. Root verified one commit,43 owned files and a clean released checkout. High policy, hard-reasoning/high selected for capture identity, provenance and destination semantics. Configured invocation identity only; no observed-runtime claim. No nested dispatches or recovery attempts (0/10).

`Dispatch: scope=p03 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-high`

Root's pre-commit review rejected generic Codex sessionId/session_id aliases as native identity proof. Sol narrowed the headerless route to consistent token_usage_record.payload.thread_id, grounded in the maintained Codex schema and p02 native usage fixtures. Response connection/root session_id alone is rejected; a valid native header still permits inherited parent usage. This is an in-scope correctness correction, not a compatibility feature. Claude requires captured record sessionId; Cursor uses canonical native path evidence. Partial captures retain diagnostics, not a false session-complete claim.

Verification: capture/activity7 files134 tests; runtime/observer2 files202 tests; full169-file suite2499 passed with one expected opt-in skip. Type-check, validate, build:check, baseline version closure, scoped lint/format and58-page docs build passed. Post-commit focused suite and build:check passed. Versions: export2.0.30, observer1.0.79, collab1.0.67, fork0.2.44. Independent p03 review will include p02's final Low follow-up from base5ebc608671445c2f16aa5266a9cbd45ba5ceeb8b.

Main advanced to1d63bc19759dacb76661fead3ad1f390bdb2333c (PR101) while Sol owned the checkout. Read-only Sol/medium reconciliation report `/tmp/evidence-main-reconcile.md`, SHA2564fdee4bfdfd3372554da2b5be33b2000b6aa8cfe09addd1e0f0bfc18c064a2c7, identifies overlap with p00. Root owns integration: retain upstream Draft-07/schema fixes, timeout CLI,900 default and newer versions, while preserving accepted host polling guidance. No global installation or release is authorized by this reconciliation.

## Main reconciliation

Root integrated origin/main4150cfe2232ec203183d41f8d89f6f7fa434d6e1 (PR100 installation refresh documentation and PR101 Consensus schema/timeout changes) in merge commit14b7bd1e70924615bb3a8adf1e914fc5a042897d. User explicitly requested the merge. Retained both PRs, regenerated the backlog index from current items, and combined curated context and changelog entries. Preserved main's Review runtime/tests/schema/timeout CLI exactly; removed superseded0.1.14 timeout wording and redundant dispatch test. Retained accepted host background/poll guidance, bumping canonical Review0.1.16→0.1.17 and regenerating its instructions. Consensus plugin remains0.2.1. This is root-owned integration, not a new product phase.

Focused Consensus/provider75/75, types, build/freshness, structure and scoped formatting passed. Skill-version validation against current main passed for5 changed skills after the merge commit. Its preliminary pre-commit run reported incoming-main skills as unchanged-version edits because its merge-base...HEAD scope still used the pre-merge HEAD; no source/version workaround was made, and the committed-merge rerun passed. Root verified generated Review scripts and schemas remain byte-equivalent to main. Current tree clean. Remaining reviews now use the canonical shipped Draft-07 runner directly; the temporary schema-annotation shim is retired for future invocations. No global install or release performed. Final integration comparison base is current main4150cfe2; p03 phase packet still includes p02 Low delta from5ebc608 and explicitly distinguishes incoming-main changes.

## p03 independent review — passed; bounded follow-ups

Canonical shipped Consensus Review completed run `c2caa5fb-17ba-437d-8041-892c34d6f261` with pass: zero Critical/High/Medium, five Low. [Canonical review](reviews/archived/p03-opus-review.md), [immutable packet](evidence/p03-review-packet.md), SHA256 `c3510ebfd5f2534a3fc4ae4b86baaafd957716efa7a55c02e8eda60cd3d04f56`; reviewed HEAD `72bbc1c6f7866d1a8f451c0083fa484f04c0782e`, comparison base5ebc608. Requested Opus/high under High ceiling via the user-selected Consensus route. Valid envelope, one invocation, stable drift; model/effort unobserved by wrapper. No OAT-native reconnaissance claim fabricated. Reviewer verified all p02 final Low follow-ups and main integration. Reviewer performed source inspection and a read-only ENOTDIR probe, not tests/builds. New Draft-07 runner completed without the old schema shim.

Root dispositions, all within p03:
- L1 accepted: add an actual bounded-export versus complete projection key-subset assertion using the same correlated source. Existing Markdown index/JSON equality remains explicitly a self-consistency test, not bounded projection proof.
- L2 accepted: exercise an actual atomic-writer failure after temporary creation, assert cleanup, nonzero/no success claim and the surviving narrative. Use a deterministic test-only filesystem failure injection through existing CLI test mechanics rather than permission-sensitive tests or a public runtime flag.
- L3 accepted as documentation scope clarification: the guard protects Session Observer checkpoint/watch state rooted at STATE_DIR and its fixed default. Collaboration has a separate root contract; do not expand this exporter into a collaboration-state filesystem framework. Name the checkpoint/watch roots explicitly in the skill and guides.
- L4 accepted: include current watch.json, lock/control and temporary names in the inode alias set, with focused external-hardlink regression. Root verified exact watch-state.ts names; default/effective containment remains unchanged.
- L5 accepted: state that JSON failure can leave the already-written narrative. Independent [Sol/medium docs audit](evidence/docs-audit-p00-p03.md) also found the stronger contradictory exit-1 table statement, rated Medium; correct both paragraph and table.

Same exact Sol/high handle gets `evidence-p03-fix1-20260921`, one bounded commit. One review-fix round of2; no implementation recovery. No blocking finding. p04 independent review will explicitly include this follow-up diff and final integration review remains required; no duplicate standalone review for nonblocking polish. Existing synthetic frozen captures remain valid unless an export-content behavior change is introduced.

Parallel read-only preparation by Sol/medium exercised the generated CLI on synthetic Claude and Cursor inputs, producing frozen paired files and `/tmp/evidence-p04-capture-preflight.md` SHA256272e3fcde9da410843c0cc2a2b673fc37ff11c37b6ff4decece0abf2da630e25. Pairing/identity/origin/skill/usage assertions passed; only available/not-recorded were observed, all seven type states compared. Static Codex AskUser origin rules verified. No source-store reads were mixed into frozen findings. This remains preparation, not p04 acceptance; p04 will perform the final template/report exercise.

## p03 terminal outcome

Same Sol/high handle completed `evidence-p03-fix1-20260921` in sole commit `fad824d7aa3c0ab754a970da66fe4f4a0594f525` from50404fa3. Root inspected the complete runtime/test delta and confirmed clean released tree. All five Low dispositions and overlapping Medium exit1-table correction are addressed. Actual bounded export call keys form a nonempty subset of complete keys under eviction; deterministic rename failure reaches temporary creation and proves cleanup plus surviving narrative/nonzero/no success output; watch/control/temporary state names receive inode protection; docs name STATE_DIR checkpoint/watch roots and partial-write behavior. No broader collaboration filesystem scope added.

Focused7-file exporter/activity135/135, types, build/freshness, validate, skill versions against merged main4150cfe2, scoped lint/format and docs58 pages passed. Post-commit focused/freshness passed; full suite reserved for final integration. Successful capture serialization unchanged; all four synthetic frozen artifact hashes retained. Versions export2.0.31, observer1.0.80, collab1.0.68, fork0.2.45. One bounded review-fix round, no recovery or unresolved findings. p04 review will include this delta from base50404fa3 and final integration review remains mandatory. p03 complete; p04 may proceed.

## p04 implementation outcome — independent review pending

Request `evidence-p04-20260921`, native `/root/p00_timeout`, exact role `oat-phase-implementer-gpt-5-6-sol-medium`; default-implementation/medium under High policy. Reused the same Sol handle that prepared the draft and frozen fixtures. Base `f1c2a7a5b3ee2f8e1bba25c645c905f5168e954c`; sole task commit `c97f65db49a08af556f14a8a151e54a23d4f86bf`. Root verified one commit,10 owned files and clean released tree. Configured invocation identity only, no nested workers/recovery or unresolved issues.

`Dispatch: scope=p04 action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:medium dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-medium`

Session Retro1.0.1, canonical template, user guide, generated standalone/plugin forms and generated docs inventory updated. Root authorized the required exporter workflow declaration in the existing distribution catalog entry; this replaces optional Observer enrichment with the approved complete-capture dependency, not a new runtime. Root pre-commit inspection corrected a malformed template table and made unknown reviewing identity fail closed. The manual report removes unsupported fixture intentionality and records reviewing identity from CODEX_THREAD_ID metadata.

[Manual acceptance](evidence/p04-acceptance.md) SHA256 `e120ea1528e50f2e47dfb4d85fe27d923deb3b99ea0f54a1dadb168751a30c27` applies the final instructions/template to unchanged synthetic Claude/Cursor frozen pairs. [Capture preflight](evidence/p04-capture-preflight.md) and [retained examples](evidence/p04-fixtures/README.md) preserve exact hashes/commands. All seven states match the type union; only available/not-recorded are observed in these two fixtures. Codex human-origin limits are checked against native normalization, not claimed exercised by a Codex fixture. Captured examples support no completed-session or proven recovery claim. No raw source reads were mixed into findings.

Build/freshness, validate, types, skill versions against phase base, scoped lint/format, generated target-name/seven-state assertions,58-page docs production and diffcheck passed before/after commit. No new test harness/runtime/prose-equality tests, no providers/global installs/pushes/PJM edits by child. p04 independent review will include p03's bounded fix from50404fa3.


## p04 review attempt and integration recovery

Consensus invocation `0ecf71ae-229f-4378-8d02-2562a676f090` requested Opus/high against HEAD `0fdf33d6d017b0b90ed843186f58efa6b85233ae`. The provider returned within the 900-second limit, but Review rejected its reply: `reply.verdict pass forbids critical/high findings and failed checks`. [Diagnostic](evidence/p04-review-diagnostic.json) confirms stable drift and one invocation. This is a defective result, not a pass, and supplies no validated findings artifact. No reviewer substitution or fabricated verdict. [Packet](evidence/p04-review-packet.md) SHA256 `ba06ec8521273b87696a511b7adf02dfd9ed5f9f28accd1ec0482e71e60e75fa` remains immutable. After the independently discovered test correction, a new review round of the corrected scope is required before phase completion.

Root final checks found one stale installed-boundary assertion at `tests/tooling/skill-packaging.test.ts:1293`: it still expects Retro's optional Observer sentence after p04 made exact-session export required. Full suite: 2519 passed, 1 failed, 1 opt-in skip. Types, build:check, validate, smoke, changed-authored lint/format (44/27 files), skill versions (6 against current main) and diff check passed. [Initial check receipt](evidence/final-checks-initial.json) retains log hashes. This mechanically derived integration test belongs to p04; public behavior and task scope remain unchanged. Same accepted Sol/medium handle will recover it under phase-standing authorization; implementation recovery accounting is separate from review rounds.

Parallel read-only Sol/high [acceptance audit](evidence/final-acceptance-audit.md) maps all 29 criteria to source/tests/retained evidence, finds no product gap and identifies the same stale assertion. Sol/medium drafted PJM updates outside the tree; no closeout has yet been claimed. Final review and current-head remote checks remain required.


### Recovery Event evidence-p04-recover1-20260921

- Phase/task: p04 / p04-t01
- Original request: evidence-p04-20260921
- Original commit: c97f65db49a08af556f14a8a151e54a23d4f86bf
- Defect class: test
- Discovered by: root pnpm run test at 0fdf33d6
- Disposition: recovered
- Authorization: phase-standing
- Attempt: 1/10
- Dispatch target: oat-phase-implementer-gpt-5-6-sol-medium
- Recovery commit: f3dea62b62d756fbb3e27b0a19a4805b4921d643
- Verification: precommit and postcommit focused test passed; all 41 packaging tests, build:check, type-check, scoped lint/format, and diff check passed
- Reason: Replaced the stale optional Observer assertion with bounded standalone `session-export-transcript` and plugin-local `export-transcript` rendering assertions plus required-capability stop behavior.

Root verified the exact two-file commit, immutable original task ancestry, clean returned checkout and matching committed completed marker. Cleared pending marker only after reconciliation, preserving used_attempts1. No product source or generated output changed. Same accepted handle, exact Sol/medium target, mechanically derived test boundary; no provider fallback or review-fix budget consumption. Full-suite rerun and valid corrected-scope review follow.


## p04 independent review — valid pass; accepted follow-ups

Run `18554a9f-ef54-4394-91f0-0f08a00d8d16` completed with valid pass, zero Critical/High, two Medium and three Low. [Canonical review](reviews/archived/p04-opus-review.md) retained unchanged; [corrected packet](evidence/p04-corrected-review-packet.md), SHA256 `f2c01a5b5bbf2cfe08abdeb29f84b728881eb77cefae6797742c36dfd6a53c78`, reviewed HEAD `c8d5572399d0ac98b1eb268101f23821c3cd80dd`, base50404fa3. Requested Opus/high via the same configured route; actual model/effort remain wrapper-unobserved despite self-reported provider identity. One invocation, stable drift, no test execution claimed. The earlier defective result is not a pass. This valid corrected-scope round independently verifies p03's prior follow-ups, p04 frozen-evidence semantics and recovery assertions.

Root accepts all five findings:
- M1: recognize every declared exporter install identity through the existing skill-identities renderer; link canonical install guidance when no supported form exists. This reuses current distribution forms, not compatibility machinery or implicit installation.
- M2: update the engineering dependency diagram to show Retro requires the installed exporter.
- L1: update both skills-index references to the required capture workflow.
- L2: root verified Cursor state and backup-temporary files in the same protected roots are omitted from the filename list. Replace the brittle list with ordinary-file inode inspection of existing direct entries in each already-resolved Observer state root. No recursive filesystem/framework expansion or relocated collaboration-root promise. Add Cursor/backup/temp/unknown-ordinary-file hardlink regressions. This p03 guard correction returns to its original Sol/high handle, review-fix round2/2, not implementation recovery.
- L3: explicitly name removal of optional Observer enrichment in the Changed changelog entry.

Product fixes remain sequential: p03 guard first; p04 dependency/docs second, through their original exact Sol handles. Root owns dispositions and tracking. Final integration review will verify these bounded nonblocking follow-ups; no redundant phase-only round is required after their passing checks. [Final local check receipt](evidence/final-checks.json) records2520 tests passing/1 opt-in skip; [current CI receipt](evidence/p04-ci-proof.json) records Validate35549545686 passing atc8d55723, with Docs35549545620 also successful. New guard/code changes require relevant rechecks before final review.


## p03 second bounded follow-up — complete

Same original Sol/high handle completed `evidence-p03-fix2-20260921` from46ce490c in sole commit `0ca7ad65857caf0c446ad30e0bc8577af58b01c5`; root verified exact11-file scope and clean released tree. L2 now checks ordinary-file inodes for all direct entries in the two existing Observer state roots, removing the drifting filename list. Nonrecursive, missing roots allowed only forENOENT, other I/O failures propagate. Existing hardlink regression adds Cursor state/lock/temp/backup, backup.tmp and arbitrary future ordinary file, with unchanged source/state sentinels. No output serialization or default CLI change.

Exporter2.0.32 and Fork0.2.46 carry required version closure. Phase-base validation correctly detected Fork's declared dependency on exporter source; root explicitly authorized this mechanical addition rather than waiving the gate. Fork runtime bytes are unchanged. Exporter97/97,types,build/freshness,validate,phase-base versions(2),scopedlintformat and self-review passed before/after commit. Review-fix round2/2, recovery0, no provider/install/push/PJM activity. p04's remaining four dependency/docs findings are next; final integration review verifies both follow-ups.


## p04 terminal outcome

Same original Sol/medium handle completed `evidence-p04-fix1-20260921` from44640397 in sole7-file commit `8ac3ba9e81a13fbcea622e1bfda7cc7d97d7f188`. M1/M2/L1/L3 are addressed: all declared exporter identities and canonical install guidance, correct required-workflow diagram and index entries, and explicit optional-Observer removal under Changed. Retro1.0.2 and generated forms agree; fixture/report-template hashes unchanged. Root inspected the exact diff, commit scope and clean release. Review-fix1/2; prior recovery1/10 remains settled, no additional recovery.

Packaging41/41,focused1/1,types,build/freshness,validate,phase-baseversions,scopedlintformat,58-page docs production and self-review passed before/after commit. CUA reported no browser, so root used the installed Chrome in an isolated temporary profile through DevTools protocol for the required real-browser proof. [Visual receipt](evidence/p04-visual/receipt.md) and8screenshots retain desktop1440 and phone390 in both themes plus mobilepan positions; required-exporter edge/labels/sidebar readable, contained horizontal scrolling, no pageoverflow and zero runtime exceptions. This is actual visual proof, not an unavailable-proof waiver. Child docsserver and root-owned Chrome stopped; transient pnpm tempfile self-cleaned.

All phases now complete with valid independent reviews. Final integration review will explicitly verify both latest bounded follow-ups0ca7ad65 and8ac3ba9e. No release/globalinstall/merge has occurred.


## Final integration review — invalid reply retained

Consensus run `30f3bf0c-a928-4f56-8ef3-acb086cce479` at `e514e7f83b25abdc7754291b36cda6460f7d3e42` returned `defective / invalid_review_reply`: `reply.verdict pass forbids critical/high findings and failed checks`. This was a returned invalid reply, not a timeout or a passed review. [Diagnostic](evidence/final-review-diagnostic.json) confirms one invocation and stable HEAD/index/status/selected packet. [Immutable packet](evidence/final-review-packet.md), SHA256 `100728b82e8e6a2f76ed9ab329428bec5429c2dcabda43af3e7df15226e225e4`, covers the full wave against main `4150cfe2`. No valid finding artifact was produced. Final review remains pending while the exact contradiction is diagnosed; no result is fabricated or silently retried. The user-authorized final review route remains Opus/high through Consensus Review.

Current-head Validate `35551116605` and Docs CI `35551116588` both passed at `e514e7f8`; local final receipt [final-checks-complete.json](evidence/final-checks-complete.json) remains current for unchanged product `8ac3ba9e`. Read-only documentation closeout audit identified one prose clarification for external hardlinks into Observer state roots; the existing runtime and regressions already enforce it.


## Final diagnostic corrections — completed and rechecked

The [exact native-reply diagnosis](evidence/final-defective-reply-analysis.md) proved the invalid final response paired a pass verdict with two failed checks, despite zero Critical/High and two Low candidates. Root accepted those candidates after inspecting the cited source; no valid verdict was manufactured. Native source-count framing differences and exact-pin input are intentional: runtime/index-base fields identify coordinates, and the exporter corroborates a supplied exact native pin while Retro requires a distinct known reviewer. No additional product change follows from those questions.

Request `evidence-final-correction1-20260921`, exact existing Sol/high handle `/root/p03_full_capture`, completed from `0641fb4dd340dd5a8e93f8641f638968c3dcc37f` in `931f81dbb299dc777fd128584267a3298a9028c5`. This is final-correction round one, not a reset of prior phase review-fix/recovery counters. Root authorized the mechanical watch consumer widening when the honest source-wide diagnostic made its locator optional.

`Dispatch: scope=final action=implementation role=implementer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-phase-implementer-gpt-5-6-sol-high`

Usage extraction exceptions now retain `not-read` and `USAGE_EXTRACTION_ERROR`, with no invented record coordinate or exception text. Genuine absence remains `not-recorded`. A deterministic failure regression verifies compact/complete projections, rendering and byte-pressure diagnostic omission; the watcher retains the status signal under quiet-empty. The exporter guide documents the opt-in potentially large per-call invocation-key index and the JSON graph's authority. Four dependent skill versions and generated forms were bumped atomically. Separate preceding docs commit `0641fb4d` documented external hardlink state aliases and passed the 58-page docs build.

Root inspected the complete authored correction and exact 37-file closure, then reran the full suite: 170 files, 2521 tests passed and one opt-in test skipped. Origin/main version validation passed for all six changed skills. Child scoped checks, type-check, build/freshness, validate, lint/format, docs and self-review passed. [Current check receipt](evidence/final-checks-complete.json) supersedes its retained predecessor. Product remains stable for a fresh final Opus/high review; the corrected request explicitly permits an honest inconclusive verdict when failed checks prevent pass and forbids severity inflation. No duplicate configured exit gate is launched.


## Final integration review — valid pass and disposition

Consensus run `a0d67b6b-d460-42c9-b1a6-5d7c6da06367` returned a validated pass with zero Critical, High or Medium findings and three Low observations. [Canonical review](reviews/archived/final-opus-review.md) is retained unchanged. Reviewed HEAD `39aeee12d0f2fca58d3bf568b427e8eaf3bb4cdd`, main baseline `4150cfe2232ec203183d41f8d89f6f7fa434d6e1`; [immutable product packet](evidence/final-corrected-review-packet.md), SHA256 `3e26e5346e63a90ef022d004adb58687ff6ed30f43e952727fd2153c3721a4cf`. One Opus/high invocation through Consensus, stable drift. Model/effort are requested controls; actual identity is wrapper-unobserved. All dynamic checks in the review are correctly labelled not-run; static checks passed. The review explicitly verified both prior diagnostic corrections and the integrated producer/consumer contracts.

`Dispatch: scope=final action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:opus effort_axis=not-applicable dispatch_policy=high dispatch_ceiling=opus target=opus`

- L1 declined after root checked `watch.ts:pollTargets`: unchanged signatures do not enqueue legacy runtime work. Every subsequent change-detected legacy delta has a new source signature, so the suggested signature comparison would still report that persistent source-wide failure on that new snapshot. Cursor's same-signature deadline/recovery paths currently use not-recorded usage and cannot reach this exception state. The claimed difference was not demonstrated; preserving source-wide not-read on each newly captured changed source is intentional. No runtime change. The hypothetical future Cursor metadata coordinate concern likewise needs a real producer before a guard is useful.
- L2 accepted: mirror the maintained guide's one-sentence invocation-index/size/JSON-authority contract in the installed exporter SKILL instructions. Same Sol/high handle owns the narrow instruction/version/generated closure; a focused Opus verification will establish the final instruction basis without repeating the passed full product audit.
- L3 accepted as an evidence erratum: the immutable packet's helper-generated acceptance paragraph under-reports one test. The canonical receipt and root execution both show **2521 passed, 1 skipped, 2522 total across 171 files (170 passed files and one skipped)**. The packet remains byte-for-byte preserved; this correction supersedes its narrative count and is not a changed test result.

[Current product CI](evidence/final-product-ci.json) records Validate `35552803128` and Docs CI `35552803118` both successful at the reviewed HEAD. Push hooks also passed type-check, build freshness, validate, six-owner versions and internal flags on that head. Final closeout waits for the narrow accepted instruction follow-up; no duplicate configured gate or merge is authorized.
