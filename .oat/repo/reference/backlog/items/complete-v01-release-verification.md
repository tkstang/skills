---
id: bl-d85f
title: 'Complete v0.1 release verification and tag'
status: open
priority: high
scope: task
scope_estimate: M
labels: [release, distribution]
assignee: null
created: '2026-06-12T21:33:26Z'
updated: '2026-06-20T21:41:08Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

This is the **finishing pass** to tag v0.1 — most of the release verification is
already done. The authoritative live status lives in the `RELEASING.md` **v0.1
Readiness Snapshot** (last updated 2026-06-20); treat that snapshot plus the
reusable evidence below as the starting point, not a from-scratch project. The
remaining work is the short tail of release gates: refresh automated gates at tag
time only if something changed, finalize the CHANGELOG/version/tag, re-confirm
the README install matrix, complete the remaining interactive provider
permission/runtime smoke checks, tag, and verify post-tag public discovery.

Per repo conventions: do not document provider support, marketplace availability,
or skills.sh discovery as complete until the live provider path is verified.
Codex public Plugin Directory and skills.sh claims stay out until verified
post-publication.

## Verified Evidence to Reuse (do not redo)

Already green on `main` after PR #24 — reuse, do not restate as remaining work:

- **Automated gates** all passed (2026-06-20): `build`, `type-check`,
  `build:check`, `test` (72 files / 687 tests), `validate`, `smoke`, and
  `premerge`; the GitHub **Validate** workflow passed for PR #24. See the
  `RELEASING.md` snapshot for the table.
- **Cursor authenticated peer E2E is verified** through the owned provider CLI:
  direct Cursor provider smoke passed, Refine converged with `--peers
  cursor,codex`, and Evaluate converged with `--peers cursor,codex` (Cursor used
  `strategy_used: "prompt_only"` with first-attempt schema success). The
  reproducible runbook is `plugins/consensus/references/live-e2e.md`.
- **Provider CLI inventory** reports `claude`, `codex`, and `cursor` ready (after
  unlocking the SSH-session keychain for Cursor); default-peer preflight passed.
- **Claude Code** and **Codex** local plugin installs have prior evidence
  (marketplace add + install + skill/agent enumeration).
- **Live mode/escalation dogfood** reused from PR #9
  (`.oat/repo/reference/project-summaries/20260613-consensus-iteration-modes.md`):
  `alternating` / `parallel_revision` / `parallel_synthesized` and the escalation
  ladder (host decision re-entry, genuinely-stuck promotion) were exercised live.
- **Agent Skills source discovery** has prior evidence (`npx skills add` against
  the GitHub source); post-tag skills.sh **indexing** remains a non-claim until
  verified after publication.

## Acceptance Criteria (remaining gates only)

- **Automated gates** are green at tag time — refresh only what changed since the
  `RELEASING.md` snapshot rather than re-running a from-scratch verification pass.
- **CHANGELOG + version/tag:** CHANGELOG `[0.1.0]` entries finalized (the
  `Unreleased` heading dated); `node scripts/bump-version.mjs --version 0.1.0`
  applied across manifests + shipped skill metadata; `node
  scripts/bump-version.mjs --check-tag v0.1.0` clean.
- **README install matrix** re-confirmed accurate against the current provider
  CLIs at tag time.
- **Remaining interactive provider permission/runtime checks** completed (the
  install/E2E evidence already exists; only the interactive prompt shapes remain):
  - Claude Code: `Bash(node)` / `Bash(consensus)` (or equivalent) permission-prompt smoke in a live runtime.
  - Codex: `exec` / permission-prompt behavior in a live runtime.
  - Cursor: plugin install + `exec` permission shape (peer E2E is already verified; this is the install/permission-shape gate).
- **Deliberation-behavior gates** (resume, user-direction continuation, corrupt
  resume handling with skip controls, host-mediated parallel
  prepare/dispatch/fan-in) confirmed **only where not already covered** by
  reusable prior evidence (PR #9) or the current live E2E runbook
  (`plugins/consensus/references/live-e2e.md`). Record which were reused vs.
  re-run; do not re-verify covered paths from scratch.
- **Tag:** v0.1.0 tag pushed and the `release.yml` workflow green (tag/manifest
  consistency check passes).
- **Post-tag:** public discovery / `npx skills add` / skills.sh indexing verified
  **after** publication before any public listing claim; record the result in
  `current-state.md`.

## Live Status

The authoritative, dated verification snapshot (automated checks + per-provider
manual checks) lives in the **`RELEASING.md` v0.1 Readiness Snapshot** — refer to
it rather than maintaining a parallel status block here. As of 2026-06-20 it shows
all automated gates passed and each provider `partial`, with the residual gates
exactly as enumerated in the acceptance criteria above (interactive
permission/runtime prompts per provider, tag, and post-tag indexing).
