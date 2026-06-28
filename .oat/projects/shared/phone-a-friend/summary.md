---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-28
oat_generated: true
oat_summary_last_task: p03-t02
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
- The original review artifacts remained active after the final pass, so the
  final PR workflow archived them and rewrote project references to
  `reviews/archived/`.

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

- Consider a later docs/tooling cleanup for the stale documented
  `validate:skill-versions -- --base-ref` command form noted in the p02 review.
  This was a non-blocking repo-instruction cleanup, not part of the shipped
  phone-a-friend behavior.
