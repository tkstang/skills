---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-09-16
oat_generated: false
oat_template: false
oat_template_name: discovery
---

# Discovery: Consensus Review

## Initial Request

Add a bounded cross-model review skill between freeform Phone a Friend advice and convergent Evaluate. The user selected `oat-project-quick-start consensus-review` after merging planning PR #84, then requested: "Just draft the whole design and then point out areas you want my judgement on, that way fable can easily review it all at once."

The substantive description comes from the agreed backlog item and kickoff handoff, not the slug. This project covers **BL-260916-add-consensus-review-cross — Add consensus-review: cross-model review of a bounded scope**. Astra drives; Fable provides independent review. This invocation authorizes discovery and a complete lightweight design draft, not implementation or publication.

## Clarifying Questions

### One mode or multiple isolation modes?

The user chose one worktree-based mode. The reviewer can inspect context with its tools but may not edit reviewed or user-owned files. Packet-only execution and full filesystem/network isolation are out of scope. A scratch directory does not confine a tool-enabled child.

### Where do reviewer defaults belong?

Use a distinct ordered `defaults.reviewers` list with provider and optional model/effort. `defaults.peers` remains the two-participant convergence configuration. Invocation settings win over project, user, and built-in defaults; exact override/fallback details are proposed in the design.

### How should planning proceed?

Quick workflow with lightweight design. The user selected draft-and-review, then approved proceeding after the holistic review. Reconcile Fable's corrections and generate the plan; resolve execution policy and review gates before marking it runnable.

## Solution Space

- **One worktree reviewer invocation — chosen.** Useful repository context with a bounded request and traceable output; requires honest read-only controls and mutation-detection limits.
- **Packet-only isolation — deferred.** Potential future confined reviewer; a scratch cwd would not enforce that boundary. A second mode multiplies security and UX contracts.
- **Reuse convergent Evaluate — rejected here.** Appropriate for rubric deliberation, not a single independent inspection. Review must not require loop maintenance.

## Key Decisions

1. One canonical owner ships standalone `consensus-review` and Consensus plugin `review`.
2. Exactly one selected reviewer turn through the owned runner, one attempt, maximum dispatch depth one. Provider-internal tools are not extra host dispatches.
3. Prefer a provider different from the host; same-provider dispatch requires explicit consent. Different provider does not prove different model family.
4. Approved smaller v1: base-branch diff, explicit files, and document only. A document may be external or materialized conversation text. Preserve request, Git identities and selected diff/content hashes; staged-only, unstaged-only and committed ranges are deferred until a concrete need appears.
5. Distinguish requested scope, reviewer-reported inspected context, and reported/observed checks. Unknown evidence is not success.
6. Own the JSON schema and deterministic OAT Markdown adapter. OAT is an optional consumer, not a shipped dependency.
7. Runtime maintenance stays independent. Reconcile Fable's shared-source changes before implementation; do not duplicate them.
8. Review state persists outside the worktree under the XDG state root (home fallback), keyed by canonical worktree path. Only explicit `--output` exports a finished review into the repository after drift checking. No in-worktree runtime allowance list or automatic cleanup promise.
9. Host-owned author provenance distinguishes detected, declared, and unknown identity and partial coverage. Findings carry complete repository-relative paths and source-version line ranges; artifact handoffs always name full absolute paths.
10. Both distributions invoke the same skill-owned executable; no `consensus review` dispatcher integration. Drift comparison is HEAD/index/status plus selected-path hashes, not whole-worktree content hashing; explicitly disclose content changes outside the selected set may go undetected with unchanged status.
11. With no scope supplied, the host agent presents Branch diff / Selected files / Document or plan and gathers ref/paths before dispatch. A supplied unambiguous scope needs no repeat question. The non-interactive executable returns usage error/options and zero invocations on missing scope.
12. Delivery is seven tasks across three sequential phases. High ceiling remains selected; keep ordinary OAT reviews and configured planning/final gates, with no additional phase gates.

## Constraints

- Node >=22, canonical TypeScript runtime, Node standard library only in shipped payloads.
- Use supported read-only controls; skip unsupported automatic candidates or fail explicit selection. Never silently weaken permissions.
- Host request/output and documented runtime capture files do not authorize reviewer tools to change user files.
- No live provider acceptance, global installation, push, publication, or merge under this planning request.
- Declare generated distributions; bump edited skills and verify transitive version impact from shared-source changes.
- Commit artifacts before pausing. Plan readiness requires design feedback, dispatch policy, artifact review, and configured gates.

## Success Criteria

- Every scope resolves deterministically and within bounds without silent truncation.
- Ordered selection, overrides, capabilities, host exclusion, and consent are tested before dispatch.
- Model and effort reach the runner independently of convergence-wrapper changes.
- Deeply validated output preserves findings, confidence, questions, scope echo, request, and provenance; incomplete runs cannot look clean.
- OAT Markdown preserves four severities, locations/anchors, evidence, suggestions, and verification evidence without automatic receipt or fixing.
- Docs explain configuration types/examples, scope semantics, controls, limits, and both installation forms.

## Out of Scope

Convergence, multi-reviewer synthesis, repairs, packet-only mode, universal isolation, messaging/observer/fidelity changes, installer work, live-submit diagnosis, broad runner refactoring, and a separate spec document.

## Open Questions

Product judgments and complexity reductions are resolved in the [design](design.md), including external state, three selectors, interactive missing scope and narrower drift coverage. High dispatch policy and no optional phase gates are selected. Runtime-maintenance PR #86 was open at the last check; recheck before implementation rather than assuming its helper extraction is merged.

Fable's four source-backed corrections remain incorporated: provider-specific no-sidecar transport, one explicit host context for preflight/dispatch, both capture readers bounded, and packaging proved first. The complexity-revised bundle needs Fable's re-check, formal plan review and the configured planning gate; the eventual independent OAT receipt exercise remains outstanding.

## Assumptions

Merged planning commit `08f59459` is the baseline. No Review implementation exists yet. Adapter declarations and fixtures do not establish current live behavior. Fable's maintenance work may change shared helpers and version fan-out before implementation.

## Risks

- **Result capture:** current runner prompts a peer-written submit sidecar; propose a per-request terminal-response-only path rather than loosening permissions.
- **Validation:** shared schema checker is shallow; Review needs deep and semantic checks.
- **Attribution:** before/after state detects drift, not all authorship, transient write/revert activity, or writes outside coverage.
- **Compatibility:** OAT receive is instruction-driven, not a stable machine parser; fixtures and an independent receipt exercise prove different things.

## Next Steps

Re-check the complexity-revised bundle, complete formal plan review and the configured planning gate. Implementation remains blocked until that plan is ready and the user starts execution. Discovery was already completed through the CLI; no implementation is implied by this update.

## References

- [Backlog item](../../../repo/pjm/backlog/items/BL-260916-add-consensus-review-cross.md)
- [Kickoff handoff](../../../repo/pjm/handoffs/BL-260916-add-consensus-review-cross.md)
- [Design](design.md)
