# Astra audit re-review — 2026-09-11

## Authority, baseline and ownership

Thomas authorized planning and separate publication for Pass A/B, then explicitly requested Astra re-review/improvement. This record belongs only to Pass B. No source fixes, dependency upgrades, machine-wide installs, provider setup, live messages/hooks, deployment, merge, plan execution or new worktrees were performed.

- Recorded source/base `origin/main`: `f5395a3568fd1b605501f550ea6ad78ee2f773ad`; live GitHub main matched at preflight. Existing B branch/HEAD: `docs/improve-audit-2026-09-07` / `1ff91ed5648dc7a08b730258c94dd4031c6e0c19`.
- Source checkout and other worktrees were not edited. The owned worktree was created by Thomas's approved CLI workaround, not the native app task tool.
- Initialization was already completed before the original skill runs. Do not rerun bootstrap merely to refresh this record. Its incidental sync drift remains isolated in the preserved bootstrap stash.
- Coordinator-authorized PJM scaffold repair belongs to Pass A: its configuration declaration and restored decisions instructions are not duplicated into B. B's independent base still reports `partial-initialization` / missing `reference/decisions/AGENTS.md` from `oat pjm doctor --json` (exit 2). No PJM writes occur in B; external audit plans remain outside that gate. The pre-existing `explainers` layout warning remains.
- OAT active project was unset. Four pre-existing stashes were preserved. No user WIP was restored, reset, archived or deleted.
- Pass A is independently published at `f2619d46c6b5d829c82f3fa9c99cb7ad18d2866f` in [PR #72](https://github.com/tkstang/skills/pull/72), four plans with open source items. B remains [PR #73](https://github.com/tkstang/skills/pull/73); no stacked base or cherry-pick of A's plan/scaffold files.
- Prior external-plan inventory: 15 July plans plus their index and execution-program artifact, with completed outcomes checked before reuse/disposition; original B contributes three plans/index. A's four plan identities were retained for cross-branch outcome comparison.
- Open PR inventory at review: #70 handoff/shared transcript changes, #71 complexity-review, #57/#58/#76/#77 action updates, and campaign #72/#73. No other PR's state was changed.

## Scope and dispatch controls

Every lane locked the same exclusions at every depth: `.agents/`, `.claude/`, `.codex/`, `.cursor/`; no extra user exclusions. Product `skills/` and `plugins/` remain eligible. Credentials, private runtime stores, dependency directories and generated output were outside broad content scans. Bounded instruction reads were context-only.

The installed `oat-repo-improve` audit playbook and `oat-dispatch-subagents` machinery governed bounded recon, model/route selection and evidence. The source-project `subagent-orchestration` Codex provider guidance was read. Its July 25 named-model guidance is review-required; Thomas's explicit Astra choice was intersected with the live native catalog exposing `gpt-6-astra` and `high`. No durable provider policy or installation changed.

Three sequential read-only lanes used one active child at a time. Read-only authority was prompt-enforced; the harness did not expose a separately selectable filesystem sandbox. Exact accepted selectors are launcher evidence, not independently confirmed runtime identity. No tier selector was available (catalog advertised priority). The old Terra dossier remains immutable and partial; these newly authorized Astra lanes do not retroactively validate it as a complete standard audit or replace a failed child.

## Runtime-plan review dispositions

| Review ID | Severity | Root verification and correction                                                                                                                                                                                                                                                                                                      |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01      | P2       | `adapters.ts:279-333` can copy stderr into a failure message. The redaction plan now covers fixed code-derived safe display messages while preserving internal classification/retries.                                                                                                                                                |
| B-02      | P2       | `structured-output.ts:185-193,228-240,314-324` and `subprocess.ts:341-345` duplicate command args in diagnostics. Exclusion applies after merging and tests inspect the complete serialized envelope.                                                                                                                                 |
| B-03      | P2       | `loop-provider.ts:316-329,365-379`, CLI default at `structured-output.ts:134`, and `provider-retry-boundary.test.ts:115-139` establish provider-owned schema retries. The schema plan now pins direct submit, sidecar fallback, exact invocation counts and the intentional earlier default failure; no hidden budget multiplication. |
| B-04      | P3       | The July subprocess plan accepted stdin/timeouts, not adding a panel cap. Corrected the plan/index/review to treat the cap as a new disparity, preserving honest completion history.                                                                                                                                                  |

All abbreviated runtime source paths above are under `src/consensus/provider-cli/` except `loop-provider.ts` under `src/consensus/core/`; the retry test is under `tests/consensus/core/`.

Root also pinned cap-triggered held-pipe settlement **without** timeout, byte boundaries, fixture teardown, supported-schema keyword inventory (17 shipped schemas), and complete type-check/smoke/version gates. The runtime reviewer returned changes requested; corrections are root-verified, not a claimed second independent approval.

## Product findings and plan review

- **PRODUCT-01, selected:** exporter `src/transcript/export-session/export-session-transcript.ts:271-276,376,391-408,626` admits unresolved-cwd candidates into marker-miss and mixed-all selection. Root read those functions and executed their actual source with filesystem primitives stubbed in memory. All three combinations reproduced unresolved-project selection; no transcript file was read or exported. Known-different-cwd candidates remained excluded.
- **PRODUCT-02, selected:** `src/transcript/core/runtimes.ts:1146-1159,1339-1355` drops completion distinctions; `skills/session-observer-collab/scripts/lib/completion-selection.mjs:283-324,408-411` promotes assistant progress. Root directly imported normalization and authored selection and passed invented Codex commentary/function-call and Claude tool-use records through a synthetic digest envelope. Both returned continuation true, completed record 1 and peer cursor 2 without terminal evidence. This verifies normalization/selection, not a full digest or live hook run.
- Both plans include raw-record → digest → selection → mocked-hook/CLI regression requirements appropriate to their boundaries. Root-authored plans were checked through the same accepted product handle. Verdict: **approve with limits**. Synthetic fixtures must encode established provider semantics, not invent them. The completion plan's first-step evidence contract and STOP for broader lifecycle/lease redesign remain mandatory.
- PR #70's file inventory and targeted `runtimes.ts` patch hunks show metadata/bounded-read work, not fixes to normalization or exporter selection. Full PR diff retrieval exceeded GitHub's line limit; targeted file patches provided the needed evidence. Shared-file coordination remains mandatory at execution.

## Deferred candidates and honest negative coverage

| Candidate                          | Verified evidence                                                                                                                                                                                                                                                                                                                                   | Disposition                                                                                                                                                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TOOL-01: incremental TS/TSX checks | `.lintstagedrc.mjs:42` selects only JS/MJS; `.github/workflows/validate.yml:135,145` omits TS/TSX from lint/format diff filters. `tests/tooling/generated-output-sync.test.ts:369` tests exclusion through that JS key, not authored TypeScript inclusion.                                                                                          | Valid medium-value/small-effort/low-risk follow-up; deferred below selected five. Completed generated-ignore plan explicitly excluded local/CI selectors, so this is not a duplicate. Future change must preserve generated/instruction exclusions and incremental adoption. |
| TOOL-02: sidebar consistency       | `documentation/docs/user-guide/consensus/meta.json` omits phone-a-friend and the rest marker; the local index links the page. `documentation/docs/engineering/contributing/documentation/authoring.md:107` incorrectly promises fallback sidebar placement. Existing navigation test at `tests/repo/docs-presence.test.ts:408` protects panel only. | Valid low–medium-value/small-effort/low-risk follow-up; deferred. Source-contract evidence, not a rendered-site claim. PR #71 touches a different skill navigation surface.                                                                                                  |
| Dependency advisories              | Read-only root/docs ecosystem audit and manifest/lock/build-path inspection completed in the tooling lane. Shipped runtime is dependency-free; docs are a static export.                                                                                                                                                                            | No confirmed vulnerability plan without demonstrating the affected build/runtime invocation. Do not equate audit severity or a Next server advisory with deployed exposure; do not install/upgrade to investigate under this campaign.                                       |
| Observer cache/atomicity           | Current cache threading, bounded-cache tests and prior execution summaries support the completed outcome.                                                                                                                                                                                                                                           | Reuse unchanged completed history; no new performance claim without measurement.                                                                                                                                                                                             |
| Broad product expansion            | Existing backlog/project ownership for N>2, idle integration, shared log and messaging.                                                                                                                                                                                                                                                             | Leave with existing owners; no invented mega-plan or competing outcome.                                                                                                                                                                                                      |

The sidebar interpretation is supported by the primary [Fumadocs page-conventions contract](https://www.fumadocs.dev/docs/headless/page-conventions): explicit page lists omit unlisted entries unless the rest item is included. Current primary documentation corroborates the source interpretation; the pinned docs app was not rendered or installed for this audit.

See the [refreshed standard audit](./2026-09-07-standard-repo-audit.md) for all nine category boundaries and the [five-plan index](../external-plans/2026-09-07-repo-audit-plan-index.md) for value/effort/risk and shared-file ordering. No backlog items were closed or created.

## Validation and publication boundary

Node `v24.18.0` satisfies the repository's >=22 floor; pnpm `10.13.1` matches the pin. No dependency versions changed. The earlier clean-tree `pnpm run worktree:validate` passed install/build/type-check/generated checks, 121 suites / 1,604 tests, validation and smoke; one opt-in live suite/test was skipped. Source surfaces remain unchanged from the recorded base.

Pass B's current `pnpm run premerge` passed: build, type-check, generated-output check, 121 suites / 1,604 tests (one opt-in live suite/test skipped), structural validation and smoke. Five plans/eight artifacts passed YAML frontmatter, source/base, relative-link and fence checks; all eight changed planning/review files were explicitly formatted with a temporary configuration because normal hooks exclude `.oat/`. `git diff --check` passed, and source/product/test/docs/tooling content remains identical to the recorded base. Caller-owned commit/push hooks must run normally; no hook bypass or source fixes are authorized. A final clean-tree worktree check and PR checks will be reported separately. The docs-app build and live-provider gate are not claimed: these changes touch only external planning/review artifacts.

## Structured dispatch records

The records below retain exact selector/handle/outcome evidence and compact objective/scope payload summaries, not private transcripts or runtime output. Service tier and runtime confirmation remain explicitly unavailable/unreported.

```json
{
  "request_id": "skills-astra-review-b-runtime-2026-09-11",
  "caller": "oat-repo-improve",
  "scope": "Pass B three runtime plans and directly implicated provider-cli/panel source and schemas",
  "objective": "Re-review the three runtime audit findings and plans, verifying profile completeness, privacy semantics and prior-plan disposition",
  "action": "analysis",
  "role_name": "plan-review-scout",
  "role_class": "recon",
  "task_class": "consequential",
  "model_class_floor": "consequential",
  "classification_source": "caller",
  "classification_reason": "Independent final review of release-safety plans and backlog disposition; silent misses could authorize incorrect future work.",
  "floor_satisfaction": "satisfied",
  "provider": "codex",
  "dispatch_context": "root-native",
  "catalog_snapshot": {
    "id": "native-2026-09-11",
    "source": "agents.spawn_agent live tool schema",
    "observed_at": "2026-09-11T13:11:25.175Z"
  },
  "authority": "read-only; no writes, no subprocess provider calls, no further delegation",
  "role_selector": "default",
  "model_selector": "gpt-6-astra",
  "model_selector_granularity": "exact",
  "effort_selector": "high",
  "reasoning_mode_selector": null,
  "service_tier_selector": null,
  "guidance_reference": "subagent-orchestration/references/provider-codex.md",
  "guidance_version": "2026-07-25",
  "guidance_verified_at": "2026-07-25",
  "guidance_status": "review-required",
  "selection_source": "native-default",
  "candidates_considered": ["gpt-6-astra"],
  "selection_reason": "native-catalog",
  "selected_route": "native",
  "deadline_seconds": 600,
  "retry_limit": 0,
  "fallback": {
    "mode": "block",
    "allow_below_task_class_floor": false
  },
  "authorization_scope": "Thomas explicitly requested Astra re-review and improvements, resumed 2026-09-11; planning only",
  "launch_status": "accepted",
  "child_outcome": "completed",
  "configured_invocation_evidence": [
    "Current user explicitly selects Astra; live tool describes gpt-6-astra as most capable and exposes high effort. No durable model guidance changed.",
    "fork_turns:none; prompt-only read-only authority; dangerous filesystem tools exist but no child writes authorized; nesting prohibited.",
    "Service tier independently not selectable; catalog advertises priority. No runtime identity claimed."
  ],
  "runtime_confirmation": "not-reported",
  "diagnostics": [],
  "continuation_events": [],
  "dispatch_mode": "background",
  "dispatch_mode_reason": "Multi-minute review while root checks source evidence",
  "child_handle": "/root/skills_astra_review_b_runtime",
  "payload": {
    "agent_type": "default",
    "model": "gpt-6-astra",
    "reasoning_effort": "high",
    "fork_turns": "none",
    "task_name": "skills_astra_review_b_runtime",
    "objective": "Re-review the three runtime audit findings and plans, verifying profile completeness, privacy semantics and prior-plan disposition",
    "scope": "Pass B three runtime plans and directly implicated provider-cli/panel source and schemas"
  },
  "review_verdict": "changes-requested",
  "findings": ["B-01", "B-02", "B-03", "B-04"]
}
```

```json
{
  "request_id": "skills-astra-audit-tooling-2026-09-11",
  "caller": "oat-repo-improve",
  "scope": "Build/release tooling, hooks, CI, docs-app build configuration and dependency manifests/locks; no product runtime sweep",
  "objective": "Complete bounded standard-audit coverage of dependency posture, CI/build performance, release/DX verification and docs navigation/build contracts",
  "action": "analysis",
  "role_name": "plan-review-scout",
  "role_class": "recon",
  "task_class": "intelligent-recon",
  "model_class_floor": "intelligent-recon",
  "classification_source": "caller",
  "classification_reason": "Interpret build/distribution reachability and test contracts; detect silent coverage gaps.",
  "floor_satisfaction": "satisfied",
  "provider": "codex",
  "dispatch_context": "root-native",
  "catalog_snapshot": {
    "id": "native-2026-09-11",
    "source": "agents.spawn_agent live tool schema",
    "observed_at": "2026-09-11T13:16:16.476Z"
  },
  "authority": "read-only; no writes, no subprocess provider calls, no further delegation",
  "role_selector": "default",
  "model_selector": "gpt-6-astra",
  "model_selector_granularity": "exact",
  "effort_selector": "high",
  "reasoning_mode_selector": null,
  "service_tier_selector": null,
  "guidance_reference": "subagent-orchestration/references/provider-codex.md",
  "guidance_version": "2026-07-25",
  "guidance_verified_at": "2026-07-25",
  "guidance_status": "review-required",
  "selection_source": "native-default",
  "candidates_considered": ["gpt-6-astra"],
  "selection_reason": "native-catalog",
  "selected_route": "native",
  "deadline_seconds": 600,
  "retry_limit": 0,
  "fallback": {
    "mode": "block",
    "allow_below_task_class_floor": false
  },
  "authorization_scope": "Thomas explicitly requested Astra re-review and improvements, resumed 2026-09-11; planning only",
  "launch_status": "accepted",
  "child_outcome": "completed",
  "configured_invocation_evidence": [
    "Current user explicitly selects Astra; live tool describes gpt-6-astra as most capable and exposes high effort. No durable model guidance changed.",
    "fork_turns:none; prompt-only read-only authority; dangerous filesystem tools exist but no child writes authorized; nesting prohibited.",
    "Service tier independently not selectable; catalog advertises priority. No runtime identity claimed."
  ],
  "runtime_confirmation": "not-reported",
  "diagnostics": [],
  "continuation_events": [],
  "dispatch_mode": "background",
  "dispatch_mode_reason": "Multi-minute review while root checks source evidence",
  "child_handle": "/root/skills_astra_audit_tooling",
  "payload": {
    "agent_type": "default",
    "model": "gpt-6-astra",
    "reasoning_effort": "high",
    "fork_turns": "none",
    "task_name": "skills_astra_audit_tooling",
    "objective": "Complete bounded standard-audit coverage of dependency posture, CI/build performance, release/DX verification and docs navigation/build contracts",
    "scope": "Build/release tooling, hooks, CI, docs-app build configuration and dependency manifests/locks; no product runtime sweep"
  },
  "review_verdict": "two-new-candidates",
  "findings": ["TOOL-01", "TOOL-02"]
}
```

```json
{
  "request_id": "skills-astra-audit-product-2026-09-11",
  "caller": "oat-repo-improve",
  "scope": "Three shipped standalone skills, canonical transcript/observer source, authored collaboration runtime, and their product docs/intent/tests",
  "objective": "Complete missing standard-audit sampling of standalone product correctness, safety, performance, architecture, tests and grounded direction",
  "action": "analysis",
  "role_name": "plan-review-scout",
  "role_class": "recon",
  "task_class": "intelligent-recon",
  "model_class_floor": "intelligent-recon",
  "classification_source": "caller",
  "classification_reason": "Interpret build/distribution reachability and test contracts; detect silent coverage gaps.",
  "floor_satisfaction": "satisfied",
  "provider": "codex",
  "dispatch_context": "root-native",
  "catalog_snapshot": {
    "id": "native-2026-09-11",
    "source": "agents.spawn_agent live tool schema",
    "observed_at": "2026-09-11T13:21:56.056Z"
  },
  "authority": "read-only; no writes, no subprocess provider calls, no further delegation",
  "role_selector": "default",
  "model_selector": "gpt-6-astra",
  "model_selector_granularity": "exact",
  "effort_selector": "high",
  "reasoning_mode_selector": null,
  "service_tier_selector": null,
  "guidance_reference": "subagent-orchestration/references/provider-codex.md",
  "guidance_version": "2026-07-25",
  "guidance_verified_at": "2026-07-25",
  "guidance_status": "review-required",
  "selection_source": "native-default",
  "candidates_considered": ["gpt-6-astra"],
  "selection_reason": "native-catalog",
  "selected_route": "native",
  "deadline_seconds": 600,
  "retry_limit": 0,
  "fallback": {
    "mode": "block",
    "allow_below_task_class_floor": false
  },
  "authorization_scope": "Thomas explicitly requested Astra re-review and improvements, resumed 2026-09-11; planning only",
  "launch_status": "accepted",
  "child_outcome": "completed",
  "configured_invocation_evidence": [
    "Current user explicitly selects Astra; live tool describes gpt-6-astra as most capable and exposes high effort. No durable model guidance changed.",
    "fork_turns:none; prompt-only read-only authority; dangerous filesystem tools exist but no child writes authorized; nesting prohibited.",
    "Service tier independently not selectable; catalog advertises priority. No runtime identity claimed."
  ],
  "runtime_confirmation": "not-reported",
  "diagnostics": [],
  "continuation_events": [
    {
      "at": "2026-09-11T13:30:53.585Z",
      "kind": "same-accepted-handle",
      "objective": "Review the two root-authored PRODUCT-01/02 plans against the same product findings; no new audit scope",
      "deadline_seconds": 300,
      "retry_limit": 0,
      "route": "native",
      "model": "gpt-6-astra",
      "effort": "high",
      "authority": "read-only; no nested dispatch; report only",
      "outcome": "completed; approve-with-limits; require supported provider evidence before completion contract implementation"
    }
  ],
  "dispatch_mode": "background",
  "dispatch_mode_reason": "Multi-minute review while root checks source evidence",
  "child_handle": "/root/skills_astra_audit_product",
  "payload": {
    "agent_type": "default",
    "model": "gpt-6-astra",
    "reasoning_effort": "high",
    "fork_turns": "none",
    "task_name": "skills_astra_audit_product",
    "objective": "Complete missing standard-audit sampling of standalone product correctness, safety, performance, architecture, tests and grounded direction",
    "scope": "Three shipped standalone skills, canonical transcript/observer source, authored collaboration runtime, and their product docs/intent/tests"
  },
  "review_verdict": "approve-with-limits",
  "findings": ["PRODUCT-01", "PRODUCT-02"]
}
```
