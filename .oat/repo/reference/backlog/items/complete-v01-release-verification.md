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

## Acceptance Criteria

- `RELEASING.md` checklist executed and evidence recorded (install + permission prompts verified per provider).
- CHANGELOG v0.1.0 entries finalized; `node scripts/bump-version.mjs --version 0.1.0 --check-tag` clean; tag pushed and release workflow green.
- README install matrix verified accurate against live provider CLIs at tag time.
- Post-tag: `npx skills add` / skills.sh discovery verified before any public listing claims (record result in `current-state.md`).
