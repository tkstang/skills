# Handoff: Add Deliberation Metrics (Tokens, Wall-Clock, Rounds) to Artifacts

**Backlog item:** [`BL-260612-add-deliberation-metrics` — Add deliberation metrics (tokens, wall-clock, rounds) to artifacts](../backlog/items/BL-260612-add-deliberation-metrics.md)
**Mode:** `/oat-project-quick-start` — run this first in the single **loop-quality** project and worktree with [`BL-260612-add-similarity-heuristic` — Add similarity heuristic for near-converged deliberation states](../backlog/items/BL-260612-add-similarity-heuristic.md). The generated-runtime dedup work is already shipped; no packaging-window gate remains.

## Mission

Make consensus artifacts consistently report total rounds, per-section rounds, wall-clock, and token/cost figures only where provider signals are actually available. Preserve explicit unavailable semantics rather than estimating or guessing. Record whether `--max-cost-per-section` or `--max-cost-total` can become a real follow-up.

## Authoritative inputs

- The backlog item and `.oat/repo/reference/research/consensus/architecture-v3.md` — resolution-block requirements and the cost-cap question.
- `src/consensus/core/consensus-loop.ts` — existing `LoopStatus` cost fields and canonical loop records.
- `src/consensus/provider-cli/types.ts` plus `src/consensus/provider-cli/adapters.ts` — the owned provider-CLI run envelope and actual provider signals; do not revive historical Paseo assumptions.
- `src/consensus/{create,decide,evaluate,plan,refine}/` and `tests/consensus/` — wrapper rendering, resume, and artifact-schema coverage that must stay consistent.

## Sequencing and scope

- This project is **now**. It may run while [`BL-260612-add-consensus-research-skill` — Add consensus-research skill](../backlog/items/BL-260612-add-consensus-research-skill.md) is in its design/DR phase, but not while a research-wrapper build is changing the shared loop.
- Complete metrics before the similarity heuristic; keep both in one worktree and one regeneration arc.
- Do not pull in whole-document harmonization; [`BL-260612-add-whole-document` — Add whole-document harmonization pass](../backlog/items/BL-260612-add-whole-document.md) is the next separate project.

## Repo conventions and gates

- Canonical TypeScript is under `src/`; run `pnpm run build` to regenerate committed runtime output, then `pnpm run build:check`. Never hand-edit generated files.
- A changed canonical skill needs its `SKILL.md` version bumped and its top-level and metadata versions kept in sync. Add any new shipped skill to `scripts/bump-version.mjs` when applicable.
- Verify with `pnpm test`, `pnpm run build:check`, `pnpm run validate`, and `pnpm run smoke`. Document user-facing behavior in the Fumadocs site via `oat-project-document` when needed.

## Close-out — same shipping PR

Follow the **Backlog Lifecycle** in `.oat/repo/pjm/AGENTS.md`: close and archive [`BL-260612-add-deliberation-metrics` — Add deliberation metrics](../backlog/items/BL-260612-add-deliberation-metrics.md), update `backlog/completed.md`, regenerate `backlog/index.md`, and refresh the operating picture if needed. Delete this handoff with `git rm .oat/repo/pjm/handoffs/BL-260612-add-deliberation-metrics.md` in that same PR. If the project ships both current loop-quality items, delete the paired similarity handoff there too.
