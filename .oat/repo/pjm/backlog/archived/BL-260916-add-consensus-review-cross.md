---
id: BL-260916-add-consensus-review-cross
title: "Add consensus-review: cross-model review of a bounded scope"
status: open
priority: high
scope: feature
scope_estimate: M
labels:
  - consensus
  - review
  - cross-model
assignee: null
created: 2026-09-16T15:55:57.104Z
updated: 2026-09-16T23:47:24Z
associated_issues: []
external_plans: []
---

## Description

A Consensus plugin skill (plugin-local `review`, standalone `consensus-review`) that asks one reviewer to inspect a bounded worktree-related scope and return structured, attributable findings. Both forms ship the same skill-owned `scripts/review.mjs`; there is no `consensus review` dispatcher subcommand.

The user approved a smaller v1 after the complexity review: base-branch diff, explicit files, and document input only. A document can live in the repository or external state; materialized conversation context uses that same selector. With no supplied scope, the host agent asks the user to choose Branch diff / Selected files / Document or plan and gathers the ref/paths before dispatch. The executable itself remains non-interactive and returns a scope-required usage error with zero invocations.

Reviewer defaults use a distinct ordered `defaults.reviewers` list (provider, optional model/effort). Precedence is invocation > project > user > built-in, whole-list replacement. Automatic choice excludes the host and selects the first candidate passing scoped preflight; explicit reviewer selection is pinned, and same-provider use requires actual user consent. Exactly one owned invocation, one attempt and max depth one; no convergence, repair, or post-dispatch provider fallback. Different provider is not necessarily different model family.

## Acceptance Criteria

- Both generated installation forms execute the skill-owned CLI outside the checkout without OAT or runtime package dependencies. No plugin-runtime import of skill implementation or Review addition to the generic dispatcher.
- Exactly one selector: `base_branch=<ref>`, `--files <paths...>`, or `--document <path>`. Base review includes tracked staged/unstaged changes from merge base to current worktree; untracked files require explicit selection. External documents are explicit bounded inputs.
- Missing scope causes the host agent to present the three choices interactively, collect details and wait. Do not ask again for an unambiguous supplied scope; do not guess if unanswered/cancelled. Direct CLI calls missing scope return usage exit 2 with supported options and invocation count zero, without waiting on stdin.
- One reviewer invocation under a supported read-only policy, with identical explicit host/depth context in preflight and dispatch. Unsupported automatic candidates skip with reasons; pinned candidates fail. Model and effort reach the existing provider runner; no convergence-wrapper dependency.
- Disable Review submit-sidecar behavior without changing existing caller defaults; preserve Claude provider validation and Codex prompt-only capture. Bound both capture readers. Reviewer tools are not authorized to edit reviewed/user files or run tests/builds/network operations by default. Provider controls are not universal isolation.
- Preserve the exact request and captured diff/source identities. Compare HEAD, index identity, Git status and before/after hashes of selected paths only. Report unexplained differences without claiming authorship; observed unauthorized writes are defective. Explicitly disclose that unselected content changes with unchanged status, ignored/external paths and transient writes can escape detection. No whole-worktree hashing engine.
- Store private request/capture/result state outside the worktree under the XDG state root/home fallback, keyed by canonical worktree path. Only explicit `--output` exports completed Markdown into the repository after comparison, without overwrite. No automatic retention/cleanup or replay feature.
- Own `schemas/review.schema.json` and deep validation for verdict, findings (severity/location-or-anchor/claim/evidence/suggestion/confidence), questions, scope echo, inspected context, checks and reviewer claims. The host owns provenance, coverage, status and author attribution; detected/declared/unknown evidence remains distinguished.
- Deterministically render valid completed results to OAT-compatible Markdown, independently exercised against `oat-review-receive`. Failed/incomplete/defective runs remain diagnostics, never clean receipts. No automatic triage or fixing.
- Findings use complete repository-relative paths with source-version line ranges, or captured-document anchors; record the absolute worktree root. Human/JSON/chat handoffs include full absolute paths to artifacts actually written.
- Canonical guide at `user-guide/consensus/review.md`, typed configuration examples and updated installation/navigation references. Focused tests, both installed-output proofs, version/build/structure/type/test gates and honest live-acceptance status.

## Approved Scope Reduction and Follow-up Triggers

The three-selector release and narrower selected-file drift detection replace the earlier seven-selector / whole-worktree-hashing proposal; these are explicit product/detection reductions, not equivalent guarantees.

Staged-only, unstaged-only and committed-range targeting are deferred until a concrete review cannot be expressed adequately with the v1 selectors. There is no separate artifact selector: the host materializes conversation text externally and uses document input.

Delivery is seven tasks in three phases, High dispatch ceiling, normal OAT reviews and configured planning/final gates only. Additional phase gates are not enabled. The independent receipt exercise is interoperability proof.

Adjacent maintenance remains separate: BL-260916-honor-configured-peer-models — Honor configured peer models and effort in convergence workflows — and BL-260723-split-loop-free-cli-helpers — Split loop-free cli-helpers core for panel sharing — are not added to Review scope. Check their current disposition before implementation.
