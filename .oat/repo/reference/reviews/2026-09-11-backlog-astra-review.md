# Astra re-review: Pass A backlog plans — 2026-09-11

## Boundary and baseline

Planning corrections only; no source implementation, live provider run, new worktree, merge, global install, or priority reset. The owned worktree was originally created by Thomas's explicitly approved CLI workaround, not the native Codex task tool.

- Source/base: `f5395a3568fd1b605501f550ea6ad78ee2f773ad`; live GitHub main and recorded `origin/main` agree on 2026-09-11.
- Reviewed branch: `docs/improve-backlog-2026-09-07`; original PR head: `c32ced9163e8d77951c181632dd9e8e3e74a1d48`.
- PR: [#72](https://github.com/tkstang/skills/pull/72), open at recheck. Pass B remains independently based on the same source base.
- Initial owned worktree: clean; all four pre-existing stashes preserved, including bootstrap manifest drift and the historical recon backup. No source-checkout or other-worktree edits.
- OAT active project: unset. PJM doctor on A: `adoption.state=declared`, with only the pre-existing unknown-top-level `explainers` warning.
- Coordinator scaffold repair is preserved exactly: `.oat/config.json` adds PJM initialized/schemaVersion and `reference/decisions/AGENTS.md` supplies the missing guidance. No existing guidance replaced.
- Recorded initialization already completed; it was not repeated. The standard worktree validation invokes locked dependency installation and generation; it passed clean-tree checks before/after and produced no tracked source drift. Node v24.18.0 satisfies >=22; pnpm 10.13.1 matches the pin; this repo has no `.nvmrc`.
- Current PR inventory: #70 coding-session handoff, #71 complexity review, #72/#73 this campaign, #57/#58/#76/#77 action dependency updates. #70 can overlap future generated/transcript work; do not execute competing plans without a new drift/ownership check.

## Independent review and root disposition

Reviewer findings refer to the original A head above. The reviewer returned **changes requested**, not approval of the corrected text. Root reopened the load-bearing sources and applied these plan corrections.

| ID   | Severity | Evidence                                                                                                                           | Disposition                                                                                                                                                                                                                                                                       |
| ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | P2       | `src/consensus/core/loop-records.ts:66`; `consensus-loop.ts:307`; the shared CLI namesake has no fsync                             | Corrected: explicitly export/import the internal records helper, use `runConsensusLoop`, and seed from existing empty-array bytes to reach the failure path.                                                                                                                      |
| A-02 | P2       | Atomic/helper source ACs require full premerge; `package.json:14` includes type-check and smoke                                    | Corrected: require `pnpm run premerge` plus the separate version gate.                                                                                                                                                                                                            |
| A-03 | P2       | Live plan previously consumed its only live observation before a possible repair; test invokes current runtime then asserts submit | Corrected: distinct diagnostic and final-tree confirmation grants, no automatic retry, source item remains open when confirmation is pending. Root additionally required safe failure reporting before any live observation because the test currently prints an entire envelope. |
| A-04 | P2       | July 11 alignment and July 24 roadmap retain research/loop-quality Now priorities                                                  | Corrected: new ordering is a proposed order within the selected batch; it cannot override Thomas's operative kickoff stack.                                                                                                                                                       |
| A-05 | P3       | `roadmap.md:3,84` already includes July 13 collaboration follow-ups                                                                | Corrected: distinguish alignment's six newer items from the roadmap's four missing July 23 integrity follow-ups.                                                                                                                                                                  |

Root also tightened effective-export guard coverage in the helper plan, graph fan-out/removal/no-op source semantics in the version plan, and value/effort/risk ratings. The transitive guard is medium effort, not a trivial quick win. Existing source `external_plans` links are preserved; all four linked source items remain open.

## Backlog and prior-plan reconciliation

All 15 active item acceptance-criteria sections were read by the reviewer and root. All 15 remain catalogued. The four selected gaps are source-verified; nonselected dispositions are based on backlog/roadmap/decision records and are not an exhaustive proof that every implementation path remains absent.

The four July predecessor plans and July 22 execution program were reviewed. Atomic writes were explicitly outside the older records-write plan; transitive propagation is distinct from direct skill discovery; the live mismatch is later evidence than live-gate visibility. The helper plan originally included panel, but the [wave-3 summary](../project-summaries/20260723-wave-3-execution.md) records a reviewed exclusion and the loop-free follow-up. No earlier completed plan was reopened or superseded, and no duplicate plan was created.

Research, harmonization, shared-log, messaging, and N>2 mesh remain project/design-sized. Host-native dispatch, multi-peer, multi-round panel, and idle integrations remain demand/evidence-gated, not falsely closed. Metrics and similarity remain valid operator-aligned work outside this bounded planning selection.

## Validation

Baseline `pnpm run worktree:validate` passed: 121 suites / 1,604 tests passed, one live-provider test skipped; type-check, both generated-output consistency checks, repository validation, smoke, and final cleanliness passed. This is baseline evidence, not proof of future planned behavior. Publication checks for the corrected artifacts are reported by the caller after skill completion; no hook bypass is permitted.

Publication artifact checks passed: four plans / seven plan-index-review artifacts, seven relative links, YAML parsed with the existing installed YAML parser, commit/source paths and deduplicated open-source reverse links verified. Scoped oxfmt checked all seven changed plan/index/review Markdown files with a temporary configuration that removes the repository's `.oat/**` exclusion; `git diff --check` passed. Backlog source bodies were not formatted or altered. All four repository hooks remain enabled. The repository skill-frontmatter parser does not support array-valued external-plan fields, so it was not misreported as a passing validator; no parser/source fix was made.

## Configured dispatch evidence

The July provider guidance is review-required as of September 11. Thomas explicitly requested Astra; the live native tool schema exposes `gpt-6-astra` and high effort. Selection did not rely on the dated Terra/Sol examples and did not change machine-wide guidance. Prompt-enforced read-only authority was used; the host exposes no independent read-only sandbox selector. No nested workers, fallback, or replacement was permitted. Runtime identity was not independently reported; acceptance establishes configured invocation evidence only.

```json
{
  "request_id": "skills-astra-review-a-2026-09-11",
  "caller": "oat-repo-improve",
  "scope": "Pass A PR #72: four external plans, backlog review, linked source records and bounded implementation evidence",
  "objective": "Independently review Pass A planning correctness, acceptance-criteria coverage, duplicates and executable verification; return findings only",
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
    "observed_at": "2026-09-11T13:07:18.505Z"
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
  "child_handle": "/root/skills_astra_review_a",
  "payload": {
    "agent_type": "default",
    "model": "gpt-6-astra",
    "reasoning_effort": "high",
    "fork_turns": "none",
    "task_name": "skills_astra_review_a",
    "objective": "Independently review Pass A planning correctness, acceptance-criteria coverage, duplicates and executable verification; return findings only",
    "scope": "Pass A PR #72: four external plans, backlog review, linked source records and bounded implementation evidence"
  },
  "review_verdict": "changes-requested",
  "findings": ["A-01", "A-02", "A-03", "A-04", "A-05"]
}
```
