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
updated: '2026-06-12T21:33:26Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

v0.1 tagging is gated by `RELEASING.md`: manual provider runtime install and permission smoke checks for Claude Code, Cursor, Codex, and the Agent Skills baseline. Local plugin install fixes already landed (marketplace manifest `source` shape, Cursor `--plugin-dir` loading — 2026-05-24); the remaining work is executing the checklist on real provider runtimes, filling CHANGELOG release entries, and tagging.

Per repo conventions: do not document provider support, marketplace availability, or skills.sh discovery as complete until the checklist verifies the live provider path. Codex public Plugin Directory and skills.sh claims stay out until verified post-publication.

## Prior Evidence to Reuse

PR #9 (`feat: add parallel iteration modes and escalation ladder to consensus refine`, merged 2026-06-13) and `.oat/repo/reference/project-summaries/20260613-consensus-iteration-modes.md` already record release-relevant dogfood:

- `npm test` passed with 526 tests, `npm run validate` passed, and `npm run smoke` passed.
- Live claude+codex runs covered `alternating`, `parallel_revision`, and `parallel_synthesized`.
- The escalation ladder was exercised, including host decision re-entry and genuinely-stuck promotion behavior; deterministic smoke/unit coverage backed the harder-to-trigger escalation cases.
- Phase 7 live dogfood fixed provider/schema/run-dir issues that would otherwise have been release blockers.

When this release item runs, treat that as prior evidence rather than starting from zero. Re-audit it after the TypeScript/vitest work lands, rerun stale or changed behavior, and focus the remaining checklist on true release gates: provider install/permission prompts, README install-matrix accuracy, CHANGELOG/version/tag checks, release workflow, and post-tag skills.sh discovery before public claims.

## Acceptance Criteria

- `RELEASING.md` checklist executed and evidence recorded (install + permission prompts verified per provider).
- CHANGELOG v0.1.0 entries finalized; `node scripts/bump-version.mjs --version 0.1.0 --check-tag` clean; tag pushed and release workflow green.
- README install matrix verified accurate against live provider CLIs at tag time.
- Post-tag: `npx skills add` / skills.sh discovery verified before any public listing claims (record result in `current-state.md`).
