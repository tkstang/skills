---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-21
oat_generated: false
---

# Discovery: docs-ia

## Initial Request

Stand up a dedicated documentation site for this repo and slim the dense
`README.md` down to a lean entry point. Tracked as backlog item **bl-ecaa**
("Stand up a documentation site and slim the README"), and sequenced as
**Phase 4 (Docs IA)** in `priority-alignment.md` — the immediate post-tag
priority that must land before the consensus-family project finishes.

Run as a **single OAT project, two phases**:

1. **Scaffold** the docs app via the user-invocable `/oat-docs-bootstrap`
   skill (wraps `oat docs init`). The skill is `disable-model-invocation: true`,
   so the **operator** runs it directly; the agent gathers inputs, resolves the
   framework decision with the operator, and verifies the build is green after.
2. **Migrate + slim.** Move dense reference content out of `README.md` into
   navigable docs pages using `oat-docs-analyze` / `oat-docs-apply`, then curate
   the proposed information architecture. The README reduces to: what the project
   is, the install matrix, and links into the site.

**Precondition (met):** v0.1 must already be tagged. Verified at kickoff —
`v0.1.0` is tagged locally and present on `origin` (`refs/tags/v0.1.0`). The
README install matrix is a tag-time gate in `RELEASING.md`; restructuring the
README right after the tag is the natural, low-churn slot.

## Solution Space

The one genuine architecture decision is the **docs framework**. The OAT docs
skills support two paths; the rest of the work (IA, migration) is tool-assisted
curation, not a from-scratch design.

### Approach 1: Fumadocs (full path) — _Chosen_

**Description:** Next.js + React + TypeScript docs app scaffolded by
`oat docs init --framework fumadocs`. Rich reader UX (client-side search,
generated nav, theming, social/OG metadata). The `oat-docs-bootstrap` skill is
purpose-built for this path, with automated post-patches (FP-11 Turbopack root,
FP-12 site metadata/title, FP-13 template content, FP-15 docs-app AGENTS.md,
FP-16 `## Contents` link extensions, FP-17 contributing cleanup) plus build
verification.

**When this is the right choice:** The repo is already a Node/pnpm/TypeScript
codebase, so Fumadocs stays inside one toolchain — no new language in dev/CI. It
is the CLI's primary, best-supported path, and gives a public-facing docs site
the richest reader experience.

**Tradeoffs:** Heaviest footprint — adds a nested Next.js app with its own
lockfile (single-package → `nested-standalone` shape) and a JS build step, and
carries the known scaffold gaps that the bootstrap post-patches exist to close.

### Approach 2: MkDocs (lean path)

**Description:** Python + Material-for-MkDocs scaffold with a defined minimum
contract. Simpler config (`mkdocs.yml` + markdown), no JS build complexity.

**When this is the right choice:** When minimizing the docs app's moving parts
matters more than toolchain consistency, and adding a Python toolchain to dev/CI
is acceptable.

**Tradeoffs:** Introduces **Python** to a repo that currently has none — a new
language and CI toolchain for contributors. Leaner output but less integrated
with the existing pnpm/Node tooling.

### Chosen Direction

**Approach:** **Fumadocs** (full path).
**Rationale:** Keeps documentation inside the repo's existing Node/pnpm/TS
toolchain (no Python in dev/CI), is the CLI's primary and best-tooled path, and
delivers the richer reader experience appropriate for a public-facing docs site.
**User validated:** Yes — operator selected Fumadocs explicitly at kickoff.

## Key Decisions

1. **Framework: Fumadocs.** Durable architecture choice — recorded as a
   decision-record candidate (see `decision-record.md` at completion). Resolves
   the bl-ecaa "Fumadocs vs MkDocs" question.
2. **Two-phase execution.** Phase A: operator-run scaffold via
   `/oat-docs-bootstrap` (agent gathers inputs, verifies build). Phase B:
   migrate + slim via `oat docs analyze` / `oat docs apply`, then curate.
3. **README becomes an entry point.** Final README = project description +
   install matrix + links into the docs site. All dense reference content moves
   into the site.
4. **Tool-assisted IA, not from-scratch.** The OAT docs skills propose the
   structure; this project is review/curation over the generated IA.

## Constraints

- **Do not regress the install-matrix tag-time gate.** The README install matrix
  must stay accurate against the live provider CLIs (`claude`, `codex`,
  `cursor`) per `RELEASING.md` (the bl-d85f gate).
- **No loss of information.** Every block removed from `README.md` must have a
  home in the docs site (traceable mapping).
- **Operator-run scaffold.** `/oat-docs-bootstrap` is `disable-model-invocation`
  — the agent cannot auto-invoke it; it gathers inputs and verifies afterward.
- **Generated contracts must pass.** Generated docs navigation/index contracts
  (`index.md` + `## Contents`) and the repo `validate`/build checks stay green.
- **Timing.** Must land before the consensus-family project finishes, so that
  family (and later phone-a-friend, bl-22d3) documents itself **into the site**
  via `oat-project-document` rather than into the README.

## Success Criteria

- Docs site scaffolded via `oat-docs-bootstrap`; framework decision recorded;
  build verified green.
- Dense reference content migrated from `README.md` into the site with a
  curated, navigable IA; nothing dropped (every removed section has a home).
- `README.md` slimmed to entry point — project description, install matrix,
  links into the site.
- README install matrix remains accurate against live provider CLIs (does not
  regress the bl-d85f gate).
- Generated docs nav/index contracts (`index.md` + `## Contents`) and repo
  `validate`/build checks pass.
- Closeout bookkeeping done: bl-ecaa status, `completed.md`, `current-state.md`
  (note the docs site + location), `roadmap.md`; framework decision in
  `decision-record.md`.

## Out of Scope

- Authoring family-skill (consensus-create/decide/plan/research) or
  phone-a-friend (bl-22d3) content — that belongs to those projects' own
  `oat-project-document` steps, targeting the new site.
- From-scratch IA design — the OAT docs skills propose structure; this is
  curation.
- Changing the install commands themselves — they are relocated/linked, not
  rewritten (accuracy against live CLIs is preserved, not re-derived).

## Open Questions

Resolved by the operator during the `/oat-docs-bootstrap` run (inputs to
pre-stage, not blockers for planning):

- **Site display title:** the worktree dir is `docs-ia`, but the canonical
  project is `skills`. The humanized-basename default would be wrong — the
  operator should set a real display title (e.g. "skills" / a product name) via
  the bootstrap site-name prompt (FP-12 concern).
- **Target directory:** single-package → `nested-standalone` shape for Fumadocs.
  Default app dir is `docs/`; `apps/docs/` is the other conventional location.
  Operator confirms during bootstrap preflight.
- **Lint / format modes:** bootstrap defaults (`lint: none`, `format: oxfmt`)
  are likely fine; confirm at scaffold time.

## Risks

- **Install-matrix regression.** _Likelihood: Low · Impact: High._ The README
  install matrix is a tag-time gate. Mitigation: migrate install content
  verbatim where it stays in the README; re-verify the matrix against live
  provider CLIs before closeout; do not rewrite install commands during the IA
  move.
- **Fumadocs scaffold gaps.** _Likelihood: Medium · Impact: Low._ The Fumadocs
  scaffold has known gaps (FP-11..FP-17). Mitigation: the `oat-docs-bootstrap`
  skill applies labeled, idempotent post-patches and runs build verification —
  the agent confirms the build is green after the operator's run.
- **Information loss during migration.** _Likelihood: Low · Impact: Medium._
  Mitigation: maintain a section-by-section mapping from removed README content
  to its destination page; verify the mapping before slimming the README.

## Next Steps

Quick mode → resolve design depth, then generate `plan.md`. The plan covers:
(A) operator-run scaffold via `/oat-docs-bootstrap` + agent build verification;
(B) analyze/apply migration + IA curation; (C) README slim + install-matrix
re-verification; (D) closeout bookkeeping + decision record.
