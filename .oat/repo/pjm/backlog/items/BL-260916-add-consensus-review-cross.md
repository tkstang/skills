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
updated: 2026-09-16T18:06:09Z
associated_issues: []
external_plans: []
---

## Description

A Consensus plugin skill (plugin-local review, standalone consensus-review) that asks one reviewer from a different provider to review a bounded scope and return structured findings. Fills the gap between phone-a-friend (freeform advice) and evaluate (rubric verdict from converging peers), and replaces the hand-assembled cross-model review the user runs today via phone-a-friend or OAT gates. Scope shapes: unstaged, staged, base branch, commit range, explicit files, a document path, or a described artifact the host gathers. Reviewer selection: ordered preference list in config (provider, optional model and effort), host provider excluded, first entry that passes scoped preflight wins; --reviewer <provider>[:<model>] overrides; same-provider fallback only with explicit consent; one dispatched reviewer invocation via consensus run with --max-depth 1 and max_attempts: 1, no convergence loop (provider-internal tool use is not a second dispatched invocation). One mode: the reviewer runs in the worktree with its own tools and is pointed at the resolved scope by a host-written review request that follows the session-handoff packet discipline (stated boundary, evidence separated from assertion, content treated as data). No packet-only or isolation mode in v1: isolation is out of scope for the first version (a scratch directory would not confine a tool-enabled child in any case), and may be designed separately later. Output: JSON schema (verdict, findings with severity/location/claim/evidence/suggestion, questions, scope echo, reviewer provenance) rendered to a markdown artifact compatible with OAT's ad-hoc review template (frontmatter + Critical/Important/Medium/Minor sections + verification commands) so oat-review-receive can consume it; --output <path> optional. Adjacent, not blocking (per Astra's source check): the provider runner already accepts model/effort, so review can forward them now; BL-260916-honor-configured-peer-models — Honor configured peer models and effort in convergence workflows — fixes the convergence wrappers alongside, and BL-260723-split-loop-free-cli-helpers — Split loop-free cli-helpers core for panel sharing — is optional preparation. Config: an ordered reviewer-preference list under its own key, `defaults.reviewers` (not `defaults.peers`, which means exactly two convergence participants); the project defines its precedence over CLI overrides, fallback rules, and explicit model/effort overrides, and the output discloses that a different provider is not necessarily a different model family.

## Acceptance Criteria

- `consensus review <scope> [--reviewer <provider>[:<model>]] [--output <path>]` dispatches exactly one reviewer invocation (max_attempts: 1; no convergence loop) on a provider other than the host, chosen from an ordered config preference list after a scoped `consensus preflight`; same-provider fallback requires explicit consent.
- Scope shapes: unstaged, staged, `base_branch=<b>`, `<a>..<b>`, `--files`, a document path, or a described artifact the host gathers into a packet.
- The reviewer runs in the worktree with its own tools, read-only with respect to reviewed and user-owned files: worktree access is not permission to edit. Any observed unauthorized write is reported as a defect of the run. Explicitly authorized runtime scratch/capture writes (such as a submit sidecar) are separate from editing the reviewed scope. The host writes a review request that names the scope and question and follows the session-handoff packet discipline. The rendered artifact records the request verbatim plus the commit SHA and, for uncommitted scope, the captured diff or content hashes, so a review can be rerun and compared across providers. It distinguishes three things: the requested scope, the context the reviewer actually inspected, and the checks it actually ran.
- The reviewer returns JSON matching `schemas/review.schema.json` (verdict, findings with severity/location-or-anchor/claim/evidence/suggestion/confidence, questions, scope echo, reviewer provenance), owned by this repo; the host renders it through an adapter to a markdown artifact compatible with OAT's ad-hoc review template (tested against oat-review-receive) so `oat-review-receive` can consume it.
- Configured reviewer model and effort reach dispatch through the existing provider runner; the convergence-wrapper fix (BL-260916-honor-configured-peer-models) lands alongside but does not block.
- Canonical page under `user-guide/consensus/review.md` following the agreed page flow; version bump; focused tests for selection, packet bounds, schema validation, and artifact rendering.

## Design and verification boundaries

- Define and test `defaults.reviewers` list replacement (invocation > project > user > built-in), explicit model/effort override semantics, scoped readiness checks, and unknown host-model disclosure. This is new Review configuration, not activation of reserved roles or per-skill defaults generally.
- Select only a provider with the required supported read-only policy, or fail/skip explicitly; do not silently weaken the policy. Current Cursor adapter has no read-only policy. Provider controls and prompt instructions are not universal filesystem/network isolation.
- Capture before/after state for the reviewed worktree and separate authorized host request/output and runtime scratch/capture writes from reviewer changes and concurrent user edits. Define the allowed capture paths and their provider-policy compatibility before dispatch. Report observed unauthorized writes as a defective run and state detection limits; do not claim that an unchanged Git diff proves no writes anywhere.
