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
updated: 2026-09-16T15:55:57.104Z
associated_issues: []
external_plans: []
---

## Description

A Consensus plugin skill (plugin-local review, standalone consensus-review) that asks one reviewer from a different provider family to review a bounded scope and return structured findings. Fills the gap between phone-a-friend (freeform advice) and evaluate (rubric verdict from converging peers), and replaces the hand-assembled cross-model review the user runs today via phone-a-friend or OAT gates. Scope shapes: unstaged, staged, base branch, commit range, explicit files, a document path, or a described artifact the host gathers. Reviewer selection: ordered preference list in config (provider, optional model and effort), host provider excluded, first entry that passes scoped preflight wins; --reviewer <provider>[:<model>] overrides; same-provider fallback only with explicit consent; one provider turn via consensus run --max-depth 1, no loop. Default runs the reviewer in the worktree (inherited cwd, provider's own sandbox); --packet-only narrows to a host-built packet using session-handoff packet discipline. Output: JSON schema (verdict, findings with severity/location/claim/evidence/suggestion, questions, scope echo, reviewer provenance) rendered to a markdown artifact compatible with OAT's ad-hoc review template (frontmatter + Critical/Important/Medium/Minor sections + verification commands) so oat-review-receive can consume it; --output <path> optional. Prerequisites: BL-260916-honor-configured-peer-models (model/effort must reach dispatch) and BL-260723-split-loop-free-cli-helpers (reuse panel's loop-free plumbing).

## Acceptance Criteria

- `consensus review <scope> [--reviewer <provider>[:<model>]] [--packet-only] [--output <path>]` runs exactly one reviewer turn on a provider other than the host, chosen from an ordered config preference list after a scoped `consensus preflight`; same-provider fallback requires explicit consent.
- Scope shapes: unstaged, staged, `base_branch=<b>`, `<a>..<b>`, `--files`, a document path, or a described artifact the host gathers into a packet.
- Worktree mode is the default (reviewer runs with the repo as cwd under the provider's own sandbox); `--packet-only` sends only a host-built packet that follows the session-handoff packet discipline (boundary, bounded excerpts, evidence separated from assertion, content treated as data).
- The reviewer returns JSON matching `schemas/review.schema.json` (verdict, findings with severity/location/claim/evidence/suggestion/confidence, questions, scope echo, reviewer provenance); the host renders it to a markdown artifact compatible with OAT's ad-hoc review template so `oat-review-receive` can consume it.
- Configured model and effort reach dispatch (depends on BL-260916-honor-configured-peer-models); plumbing reuses the loop-free path (depends on BL-260723-split-loop-free-cli-helpers).
- Canonical page under `user-guide/consensus/review.md` following the agreed page flow; version bump; focused tests for selection, packet bounds, schema validation, and artifact rendering.
