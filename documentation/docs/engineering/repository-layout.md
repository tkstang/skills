---
title: 'Repository Layout'
description: 'Where everything lives — repo-wide structure and the consensus plugin package layout.'
---

# Repository Layout

The single structural reference for the repo. Skill consumers only need the
plugin/skill directories; the rest is source and project-management
infrastructure.

## Repository structure

- `skills/` — standalone personal skills.
  - `skills/session-observer/` — standalone peer transcript review and catch-up skill.
  - `skills/export-session-transcript/` — standalone session transcript export skill.
- `src/transcript/` — canonical TypeScript source for transcript-core, session-observer, and export-session runtime code.
- `shared/transcript-core/` — compatibility documentation pointer for the former shared transcript-core source path.
- `plugins/consensus/` — self-contained consensus plugin package.
- `.claude-plugin/`, `.cursor-plugin/`, `.agents/plugins/` — repo-root marketplace entries.
- `.oat/` and `.agents/` — project-management infrastructure, not required by plugin consumers.

Shipped runtime `.mjs` lives next to its manifests under `plugins/` and
`skills/`; it is generated from the canonical TypeScript in `src/` — see
[Generated runtime outputs](architecture/generated-runtime.md).

## Consensus plugin package layout

Inside `plugins/consensus/`:

- `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` — provider plugin manifests.
- `skills/refine/` — implementation directory for the shipped `refine` skill.
  - `skills/refine/references/operator-qa.md` — manual QA walkthrough of the iteration modes and escalation ladder, with runnable example inputs under `references/examples/`.
- `skills/evaluate/` — implementation directory for the shipped `evaluate` skill.
  - `skills/evaluate/references/operator-qa.md` — manual QA walkthrough of artifact/rubric evaluation and dissent review.
  - `skills/evaluate/references/examples/` — four ready-to-adapt example rubrics (general-purpose, code review, technical writing, design/architecture) used by guided rubric creation.
- `references/live-e2e.md` — repeatable live provider E2E release-gate runbook for refine and evaluate.
- `references/e2e/` — small checked-in artifacts and rubrics used by the live E2E runbook.
- `agents/consensus-section-runner.md` — task contract for host-mediated parallel section runners.
