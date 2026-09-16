---
title: 'Repository Layout'
description: 'Where authored skills, distribution declarations, shared/plugin source, and generated standalone and plugin payloads live.'
---

# Repository Layout

The single structural reference for the repo. Skill consumers only need the
plugin/skill directories; the rest is source and project-management
infrastructure.

## Repository structure

- `src/skills/<canonical-name>/` — the single authored owner for each product
  skill: instructions, references/assets, runtime source, skill-owned tests, and
  `build.json` when it has executable entrypoints.
- `src/distributions.ts` — standalone selection, plugin membership/local names,
  skill prerequisites, shared-source roots, and independent plugin release
  targets.
- `src/plugins/consensus/` — non-skill consensus CLI, loop, configuration, and
  plugin-owned tests.
- `src/shared/transcript/` — genuine cross-skill transcript runtime source and
  its owned tests.
- `skills/<canonical-name>/` — generated complete standalone installation units
  for explicitly declared skills only.
- `plugins/consensus/` — generated complete consensus installation unit,
  including peer workflows plus local `observer` and `observer-collab` skills.
- `plugins/session/` — generated complete session installation unit with local
  `handoff`, `export-transcript`, and `fork-to-destination` skills.
- `.claude-plugin/`, `.cursor-plugin/`, `.agents/plugins/` — repo-root marketplace entries.
- `.oat/` and `.agents/` — project-management infrastructure, not required by plugin consumers.

The trees under `skills/`, `plugins/*/skills/`, `.agents/`, `.claude/`, and
`.cursor/` are generated outputs or provider views. Edit the canonical
`src/skills/` owner and distribution/build declarations, then rebuild. Prompt-only
skills need no empty source or build scaffolding.

Shipped runtime `.mjs` lives next to its manifests under `plugins/` and
`skills/`. Most is generated from canonical TypeScript in `src/`; the
collaboration owner also has authored `.mjs` entrypoints with adjacent `.d.mts`
declarations. Both forms are bundled into generated runtime, and declarations
are not shipped. See
[Generated installation units](architecture/generated-runtime.md).

## Distribution and dependency rules

Canonical identity is separate from plugin-local identity. For example,
`session-export-transcript` becomes `export-transcript` inside the session
plugin, while both forms inherit one authored `metadata.version`. The consensus
and session plugin manifest versions are independent from each other and from
member skill versions.

Shared runtime code is bundled or copied into every installation unit that
needs it; an installed standalone skill never imports another installed skill,
the checkout, or developer dependencies. A declared workflow prerequisite is
different. `session-observer-collab` requires the `session-observer` workflow,
recognizes its standalone and consensus plugin-local identities, and stops with
an install link instead of installing it automatically.

The rename from `export-session-transcript` to `session-export-transcript` and
from `coding-session-handoff` to `session-fork-to-destination` is a clean break.
Old payloads, script entrypoints, aliases, and redirects are absent; historical
mapping exists only for version comparison.

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
- `skills/observer/` — plugin-local form of `session-observer`.
- `skills/observer-collab/` — plugin-local form of
  `session-observer-collab`, with its declared observer prerequisite.

## Session plugin package layout

Inside `plugins/session/`:

- `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` — independently
  versioned provider manifests.
- `skills/handoff/` — plugin-local form of `session-handoff`.
- `skills/retro/` — plugin-local form of `session-retro`.
- `skills/export-transcript/` — plugin-local form of
  `session-export-transcript`, including its generated dependency-free CLI.
- `skills/fork-to-destination/` — plugin-local form of the experimental
  `session-fork-to-destination` guidance workflow and generated CLI.
