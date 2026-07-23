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
  - `skills/session-observer-collab/` — N=2 collaboration protocol, runtime references, and bounded lifecycle adapters. Its `.mjs` files are authored, dependency-free skill runtime; provider-visible mirrors are generated.
  - `skills/export-session-transcript/` — standalone session transcript export skill.
- `src/consensus/` — canonical TypeScript source for the consensus loop and each consensus wrapper (`config`, `core`, `create`, `decide`, `evaluate`, `panel`, `plan`, `provider-cli`, `refine`).
- `src/transcript/` — canonical TypeScript source for transcript-core, session-observer, and export-session runtime code.
- `shared/transcript-core/` — compatibility documentation pointer for the former shared transcript-core source path.
- `plugins/consensus/` — self-contained consensus plugin package.
- `.claude-plugin/`, `.cursor-plugin/`, `.agents/plugins/` — repo-root marketplace entries.
- `.oat/` and `.agents/` — project-management infrastructure, not required by plugin consumers.

The standalone skill directories under `skills/` are the canonical shipped
sources. `.agents/`, `.claude/`, and `.cursor/` provider views are generated
mirrors; update the canonical directory and run the repository sync workflow
instead of editing a mirror. The collaboration skill invokes the generated
`session-observer` CLI for transcript operations and keeps its own control and
lease state separate from observer read offsets.

Shipped runtime `.mjs` lives next to its manifests under `plugins/` and
`skills/`; it is generated from the canonical TypeScript in `src/` — see
[Generated runtime outputs](architecture/generated-runtime.md).

## Consensus plugin package layout

Inside `plugins/consensus/`:

- `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` — provider plugin manifests.
- `scripts/consensus.mjs` — generated provider CLI used for provider inventory, preflight, peer invocation, and submit-sidecar capture.
- `scripts/consensus-loop.mjs` — generated shared consensus loop runtime imported by the generated `create`, `decide`, `evaluate`, `plan`, and `refine` wrappers. Keep it beside `skills/` in the plugin root; wrappers import it with `../../../scripts/consensus-loop.mjs`.
- `skills/create/` — implementation directory for the shipped `create` skill.
  - `skills/create/references/operator-qa.md` — manual QA walkthrough of brief-to-artifact creation, with a runnable brief under `references/examples/`.
- `skills/decide/` — implementation directory for the shipped `decide` skill.
  - `skills/decide/references/operator-qa.md` — manual QA walkthrough of options-to-decision runs and dissent review, with a runnable options file under `references/examples/`.
- `skills/plan/` — implementation directory for the shipped `plan` skill.
  - `skills/plan/references/operator-qa.md` — manual QA walkthrough of goal-to-plan runs, with runnable goal and constraints examples under `references/examples/`.
- `skills/refine/` — implementation directory for the shipped `refine` skill.
  - `skills/refine/references/operator-qa.md` — manual QA walkthrough of the iteration modes and escalation ladder, with runnable example inputs under `references/examples/`.
- `skills/evaluate/` — implementation directory for the shipped `evaluate` skill.
  - `skills/evaluate/references/operator-qa.md` — manual QA walkthrough of artifact/rubric evaluation and dissent review.
  - `skills/evaluate/references/examples/` — four ready-to-adapt example rubrics (general-purpose, code review, technical writing, design/architecture) used by guided rubric creation.
- `skills/phone-a-friend/` — instruction-only advisory peer consultation skill.
  - `skills/phone-a-friend/schemas/advisory.schema.json` — structured advisory response contract.
  - `skills/phone-a-friend/references/operator-qa.md` — manual QA walkthrough of one-shot advisory calls, expected JSON, and host disposition.
  - `skills/phone-a-friend/references/examples/` — example advisory prompt and response payload.
- `references/live-e2e.md` — repeatable live provider E2E release-gate runbook for refine and evaluate.
- `references/e2e/` — small checked-in artifacts and rubrics used by the live E2E runbook.
- `agents/consensus-section-runner.md` — task contract for host-mediated parallel section runners.
