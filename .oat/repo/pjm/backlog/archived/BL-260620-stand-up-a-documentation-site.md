---
id: BL-260620-stand-up-a-documentation-site
title: Stand up a documentation site and slim the README
status: closed
priority: medium
scope: initiative
scope_estimate: M
labels:
  - docs
  - documentation-site
  - readme
  - developer-experience
assignee: null
created: 2026-06-20T21:34:27Z
updated: 2026-06-21T20:30:00Z
associated_issues: []
legacy_id: bl-ecaa
---

## Description

The main `README.md` has grown dense to the point of being hard to read as the
consensus plugin, provider CLI, and skill surface area expanded. Stand up a
dedicated documentation site and reduce the README to a lean entry point.

Run this as a **single OAT project** spanning two phases (not split across
items):

1. **Scaffold** the docs app via the user-invocable `oat-docs-bootstrap` skill
   (wraps `oat docs init`; resolve the Fumadocs full-path vs MkDocs lean-path
   framework decision during bootstrap). Note: `oat-docs-bootstrap` is
   `disable-model-invocation: true` — the operator runs `/oat-docs-bootstrap`
   directly; an agent cannot auto-invoke it.
2. **Migrate + slim.** Move the dense reference content out of `README.md` into
   navigable docs pages and curate the resulting information architecture. The
   OAT docs skills (`oat-docs-analyze` / `oat-docs-apply`, and
   `oat-project-document`) do the IA heavy lifting — they propose structure and
   apply content — so this phase is **review/curation over the generated
   structure** rather than a from-scratch IA design. The README reduces to: what
   the project is, the install matrix, and links into the site.

**Sequencing:** sequence **after** `bl-d85f` (v0.1 release verification and tag).
The README install matrix is a tag-time gate in `RELEASING.md`, so a large doc
restructure should not churn that surface mid-release — right after the tag is
the natural slot. This is the **immediate post-tag priority**, not a "Later"
fill-in: it should land before the consensus-family project (`bl-2ed7` →
`bl-b9b9` → `bl-87ef`/`bl-0cb8`) finishes so that family completes by documenting
itself **into the docs site**.

**Relationship to other work — documentation is part of each project's
development:** once the docs site exists, a project's documentation step
(`oat-project-document`) targets the **docs site** rather than the README. So new
work (the family skills, then `bl-22d3` phone-a-friend) does **not** need to wait
on this item to *build* — but its documentation should land in the site, not the
dense README. Establishing the IA first means later projects document cleanly
instead of bloating the README and forcing a second migration. The OAT docs
skills (`oat-docs-analyze`/`oat-docs-apply`) propose the IA, so "figuring out the
IA" is largely tool-assisted curation, not a from-scratch design exercise.

## Acceptance Criteria

- Docs site scaffolded via `oat-docs-bootstrap`, with the framework decision
  (Fumadocs vs MkDocs) recorded and the build verified green.
- Dense reference content migrated from `README.md` into the docs site with a
  curated, navigable information architecture (via `oat-docs-analyze` /
  `oat-docs-apply`).
- README slimmed to an entry point — project description, install matrix, and
  links into the docs site — with no loss of information (everything removed has
  a home in the site).
- README install matrix remains accurate against live provider CLIs (does not
  regress the `bl-d85f` tag-time gate).
- Generated docs navigation/index contracts (`index.md` + `## Contents`) and the
  repo `validate`/build checks pass.
