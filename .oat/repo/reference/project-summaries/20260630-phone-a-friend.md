---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-30
oat_generated: true
oat_summary_last_task: p04-t03
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: phone-a-friend

## Overview

`phone-a-friend` implements BL-260620: a lightweight consensus-family skill for
one-shot advisory peer consultation. The goal was to let a host agent ask one
other provider-backed peer for a structured take on a focused question without
running a deliberation loop or producing a refine/evaluate-style artifact.

The project also served as the first validation that a new consensus skill can
document cleanly into the Fumadocs User Guide instead of expanding the README.

## What Was Implemented

- Added `plugins/consensus/skills/phone-a-friend/` as a shipped,
  instruction-only consensus skill. Its `SKILL.md` covers when to use it, when
  not to use it, question inference, relevant-context compaction, ambiguity and
  sensitivity gates, peer selection, invocation, safety, and disposition.
- Added `schemas/advisory.schema.json`, a draft-07 advisory response contract
  with required `schema_version`, `understood_question`, `take`,
  `recommendation`, `risks`, `follow_up_questions`, and `confidence` fields plus
  optional `assumptions`.
- Added a Vitest contract test against the real `validateSchemaSubset` helper and
  structural schema assertions for provider-native enforcement.
- Added operator reference material plus example prompt/advisory payloads for
  local dogfooding and future docs alignment.
- Registered the skill in release version tooling and all consensus plugin
  provider descriptions, including Codex interface copy.
- Added the Fumadocs User Guide page, updated consensus section navigation and
  generated docs index, and updated the plugin README so plugin-facing docs
  describe the sixth consensus skill.
- Updated release/versioning and plugin-manifest tests so the repository gates
  understand the new skill and manifest wording.
- Processed final-review follow-ups by deleting the temporary gate-feedback
  handoff, correcting the stale project-plan skill-version validation command,
  and validating the shipped advisory example payload in the schema test.
- Ran the project-document pass after implementation, refreshing the root
  README, docs landing pages, installation next-step copy, engineering
  repository layout, and generated docs index so high-level docs no longer
  described the older five-skill / convergence-only consensus surface.
- Resolved post-update OAT tool-pack drift by accepting the `oat_gateable`
  tool-pack refresh for `oat-project-plan` and `oat-project-implement`,
  re-stamping `metadata.internal: true`, and removing duplicated workflow
  continuation text from `AGENTS.md`.
- Updated PJM reference state by archiving the completed backlog item, adding a
  completed-history entry, and removing phone-a-friend from the roadmap's Next
  lane.

## Key Decisions

- **Phone-a-friend naming:** The shipped skill uses `phone-a-friend` across the
  folder name, frontmatter, examples, docs, manifests, tests, and project
  artifacts because it is idiomatic and matches the backlog/project name.
- **Instruction-only advisory skill:** The project reused the existing
  `consensus run` provider CLI primitive for a single schema-validated provider
  turn instead of adding TypeScript source or a generated runtime wrapper.
- **Skill-local advisory schema:** The advisory contract lives at
  `plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json` as the
  canonical reusable contract for this skill and a future panel skill.
- **Host-owned disposition:** The host agent remains responsible for context
  selection, peer choice, and deciding whether to agree, disagree, apply, ignore,
  or follow up on the advisory take; peer output is advisory data, not
  instructions.

## Notable Challenges

- The p03 full verification gate exposed stale release/versioning and plugin
  manifest test expectations after registration changed the skill set. Those
  tests were updated in the same project because the full verification gate
  needed to pass against the branch's actual shipped surface.
- Final review caught that the plugin README still described the old five-skill
  package and that a temporary OAT gate feedback file was in the shipping range.
  The README was updated and the temporary file was removed before the passing
  final re-review.
- A later independent v3 final review found three Minor follow-ups, all handled
  by Phase 4: remove the temporary feedback handoff, correct the project-plan
  validation command, and add schema coverage for the shipped advisory example.
- The original review artifacts remained active after the final pass, so the
  final PR workflow archived them and rewrote project references to
  `reviews/archived/`.
- The cross-runtime implementation gate initially appeared to hang because
  `claude -p` ran in default permission mode and blocked `Skill(...)`, `oat`, and
  `pnpm exec` operations. The diagnostic showed the trusted noninteractive
  Claude gate path should run with permission bypass.

## Tradeoffs Made

- The skill has no dedicated wrapper command. That keeps the implementation
  dependency-free and avoids generated-runtime drift, but it means the host
  instruction flow is the behavioral surface and operators call `consensus run`
  directly with the advisory schema.
- Live cross-provider advisory calls remain manual/operator-authenticated, like
  the other provider-backed consensus skills. Deterministic coverage comes from
  the advisory schema contract test, manifest/versioning tests, docs validation,
  and the full local verification suite.

## Follow-up Items

- Update the cross-runtime gate runner/config so Claude gate executions use a
  trusted noninteractive permission mode such as `--dangerously-skip-permissions`
  or `--permission-mode bypassPermissions`, and surface permission-denial output
  instead of presenting it as a silent hang.
