# Standard Repository Audit Review — 2026-09-07, refreshed 2026-09-11

**Requested profile:** Standard repository audit. **Achieved:** standard-profile bounded sampling after the authorized Astra extension, not exhaustive verification.

**Source baseline:** `f5395a3568fd1b605501f550ea6ad78ee2f773ad`. **Scope lock:** product `skills/`, `plugins/`, canonical `src/`, and relevant authored tests/tooling/configuration/documentation. Exclude `.agents/`, `.claude/`, `.codex/`, `.cursor/` at every depth; no additional user exclusions. Credentials, private runtime stores, dependency directories and generated output remain outside broad scans. Instruction reads are context only, never findings.

## Historical dispatch and authorized extension

The original native Terra-high worker was accepted as `/root/skills_audit_runtime`, initially rejected an incomplete envelope, then continued through that same handle with the coordinator-authorized complete packet. Its validated dossier and terminal **partial** outcome remain unchanged at `.oat/repo/reference/evidence/skills-standard-audit-2026-09-07-run-01/raw/dossiers/runtime-gather-lane-01.json`. Its obsolete `--runInBand` suggestion is not a repository validation command and was not used.

Thomas subsequently authorized native subagents and explicitly requested Astra re-review/improvement. Three sequential native Astra-high lanes reviewed the runtime plans and sampled tooling and standalone products. These form a separately authorized extension, not automatic recovery/replacement of the old Terra run. The root verified load-bearing claims, reproduced product defects with synthetic inputs, selected outcomes and authored all plans. See the [Astra review and dispatch record](./2026-09-11-audit-astra-review.md).

## Verified selected findings

| ID            | Outcome                                              | Value                                   | Effort | Risk       | Root verification                                                                                                                                                                                                   |
| ------------- | ---------------------------------------------------- | --------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RUNTIME-001` | Enforce shipped schema profile                       | High contract integrity                 | Medium | Medium     | Shipped nested/enum/const/array/additional-property constraints exceed the subset validator; direct submit and retry ownership also need coverage. Downstream domain checks already reject many malformed verdicts. |
| `RUNTIME-002` | Bound panel output                                   | High reliability                        | Small  | Low–medium | Panel string accumulation is unbounded; core has per-stream caps and cap-triggered held-pipe settlement.                                                                                                            |
| `RUNTIME-003` | Honor envelope redaction                             | Medium minimization/API integrity       | Small  | Medium     | Flags parse but output ignores them; diagnostics and failure-message aliases also need exclusion.                                                                                                                   |
| `PRODUCT-01`  | Keep export fallback/all selection project-qualified | High privacy/correctness                | Small  | Medium     | Synthetic marker-miss and mixed-all cases select an unresolved-project candidate.                                                                                                                                   |
| `PRODUCT-02`  | Require positive peer completion evidence            | High automatic-continuation correctness | Medium | High       | Synthetic Claude tool-use and Codex commentary records select a “completed” turn without final response evidence.                                                                                                   |

All have high defect confidence. The completion plan has a contract-design STOP gate; no general lifecycle platform or lease migration is authorized.

## Standard-profile coverage

| Category                  | Bounded evidence sampled                                                                        | Result / limit                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Correctness               | Consensus schema/envelopes/subprocesses; exporter selectors; digest/collaboration selection     | Five selected findings; no live-provider claims.                                                        |
| Security                  | Envelope minimization, project isolation, lease/identity guards, provider environment filtering | Concrete boundary findings only; not security certification.                                            |
| Performance               | Capture bounds; observer classification cache/Cursor pinned discovery; CI caching/cancellation  | Panel cap selected; existing cache work remains valid; no benchmark-backed speed claim.                 |
| Test coverage             | Raw-record versus normalized completion fixtures; selector combinations; local/CI filters       | Boundary regressions in selected plans; TypeScript selector gap deferred.                               |
| Architecture / debt       | Shared normalization/automatic-consumer boundary; generated source and helper ownership         | Preserve layers; no broad refactor or competing Pass A helper plan.                                     |
| Dependencies / migrations | Root/docs manifests/locks, read-only ecosystem audits, static-export build/deploy paths         | Exact vulnerable invocation/reachability remains unverified; no automatic upgrade plan.                 |
| DX / tooling              | Five workflows, premerge/worktree gates, incremental file filters, release checks               | Authored TS/TSX omitted from incremental selectors; lower-priority candidate deferred.                  |
| Docs                      | Authored navigation maps, explicit sidebar metadata, source-linked contracts                    | Phone-a-friend sidebar omission/wrong fallback rule deferred. No rendered-site or docs-app build claim. |
| Direction                 | Current product contracts, backlog/project ownership and open PRs                               | Repair existing boundaries; N>2/idle/messaging/shared-log expansion remains with existing owners.       |

## Existing-plan and overlap disposition

- Retain the original three plans with corrected requirements; no replacement duplicates.
- The July 17 subprocess-hardening plan accepted stdin handling and optional timeout escalation; it assumed caps existed. Its shipped acceptance criteria remain completed. The new panel cap is a distinct disparity.
- The archived exporter fix covered bare all/no-selector cwd filtering and left marker/session paths unchanged. `PRODUCT-01` is the uncovered combination. `PRODUCT-02` is a newly reproduced non-Cursor gap, not the completed Cursor reliability plan.
- Prior observer atomicity/cache outcomes remain implemented; no evidence supports reopening them. Backlog statuses and priority alignment remain unchanged.
- Pass A's four outcomes do not compete, but helper extraction/generated-version propagation touch common surfaces. Coordinate files instead of claiming no overlap of any kind.
- PR #70 owns handoff/shared transcript metadata, not these selector/completion outcomes at reviewed head `d15fd662d1baf5ff26cc6ccd09925212a8f9ff46`; recheck before execution. PR #71 and action-update PRs remain with their owners.

## Selection and deferrals

The [five-plan index](../external-plans/2026-09-07-repo-audit-plan-index.md) records ordering and risks. `TOOL-01` (authored TypeScript incremental gates) and `TOOL-02` (sidebar/authoring consistency) are worthwhile but below the selected five; no extra plans or tracker entries were created. Advisory matches without verified vulnerable operation remain verification follow-ups, not confirmed exposure findings. No implementation, live execution, or merge is part of this audit.
