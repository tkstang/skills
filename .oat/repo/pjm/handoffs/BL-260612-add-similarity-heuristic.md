# Handoff: Add Similarity Heuristic for Near-Converged Deliberation States

**Backlog item:** [`BL-260612-add-similarity-heuristic` — Add similarity heuristic for near-converged deliberation states](../backlog/items/BL-260612-add-similarity-heuristic.md)
**Mode:** `/oat-project-quick-start` — the second item in the current **loop-quality** project and worktree, immediately after [`BL-260612-add-deliberation-metrics` — Add deliberation metrics](../backlog/items/BL-260612-add-deliberation-metrics.md). The generated-runtime dedup work is already shipped; no packaging-window gate remains.

## Mission

Allow the consensus loop to recognize narrowly near-converged states without weakening strict deterministic convergence. The measure must use a fixed, reproducible algorithm and threshold; minimal agency remains hash-only; every similarity-driven decision is visible in turn records and the resolution block.

## Authoritative inputs

- The backlog item and `.oat/repo/reference/research/consensus/architecture-v3.md` — the near-match confirmation idea and intended scope.
- `.oat/repo/reference/decisions/DR-260502-normalized-hash-convergence.md` and `.oat/repo/reference/decisions/DR-260613-unified-v1-verdict-schema.md` — normalization, strict deterministic defaults, agency, and audit expectations.
- `src/consensus/core/consensus-loop.ts` — convergence and oscillation logic for alternating and parallel modes.
- `tests/consensus/core/` — threshold-boundary and audit-trail coverage belongs here.

## Sequencing and scope

- Start only after the metrics pass in the same worktree; share the generated-output and artifact-schema validation arc.
- The work may overlap [`BL-260612-add-consensus-research-skill` — Add consensus-research skill](../backlog/items/BL-260612-add-consensus-research-skill.md) only while research remains in a design/DR phase. Do not overlap two loop-changing builds.
- Do not incorporate whole-document harmonization; [`BL-260612-add-whole-document` — Add whole-document harmonization pass](../backlog/items/BL-260612-add-whole-document.md) is the next separate project.

## Repo conventions and gates

- Edit canonical TypeScript, run `pnpm run build`, and verify `pnpm run build:check`; never hand-edit generated runtime output.
- Bump every changed canonical skill version and maintain top-level/metadata version parity.
- Verify with `pnpm test`, `pnpm run build:check`, `pnpm run validate`, and `pnpm run smoke`. Add operator-facing documentation via Fumadocs if threshold or disclosure semantics become user-configurable.

## Close-out — same shipping PR

Follow the **Backlog Lifecycle** in `.oat/repo/pjm/AGENTS.md`: close and archive [`BL-260612-add-similarity-heuristic` — Add similarity heuristic](../backlog/items/BL-260612-add-similarity-heuristic.md), update `backlog/completed.md`, regenerate `backlog/index.md`, and refresh the operating picture if needed. Delete this handoff with `git rm .oat/repo/pjm/handoffs/BL-260612-add-similarity-heuristic.md` in that same PR. If the project ships both current loop-quality items, delete the paired metrics handoff there too.
