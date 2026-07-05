# Handoff: Add Deliberation Metrics (Tokens, Wall-Clock, Rounds) to Artifacts

**Backlog item:** `.oat/repo/pjm/backlog/items/BL-260612-add-deliberation-metrics.md`
(`BL-260612-add-deliberation-metrics` — Add deliberation metrics (tokens,
wall-clock, rounds) to artifacts)
**Mode:** `/oat-project-quick-start` — pre-populate spec from the v3
architecture's resolution-block requirements rather than re-deriving them.
Run this and `BL-260612-add-similarity-heuristic` (similarity heuristic for
near-converged states) as **one loop-quality project in one worktree** —
same loop-core neighborhood, one regeneration arc; see the loop-quality
grouping in `backlog/reviews/priority-alignment.md`.

**Sequencing gate:** do **not** start until
`BL-260620-share-consensus-generated` (share consensus generated runtime
output) lands or closes — this project regenerates loop output, and the
dedup project owns that surface first. On a dedup "go," you regenerate one
shared loop script; on a documented no-go, five per-skill copies.

## Mission

Make every consensus artifact's resolution block report total rounds,
per-section rounds, wall-clock, and token/cost figures where providers
expose them — with explicit "unavailable" semantics where they don't (omit
rather than guess). Metrics must be consistent across alternating and
parallel iteration modes and must survive resume. Also deliver the
feasibility note on `--max-cost-per-section` / `--max-cost-total` budget
caps (record in the item or split a successor).

## Authoritative inputs (populate spec from these)

- `.oat/repo/reference/research/consensus/architecture-v3.md` — the
  resolution-block metrics spec and the cost-cap open question.
- `src/consensus/core/consensus-loop.ts` — existing scaffolding:
  `LoopStatus` already carries turn/round counts and `cost_source`
  (`provider_cli|estimated|unavailable`) + `approximate_cost_usd` fields;
  records carry timestamps but no aggregated duration.
- `src/consensus/provider-cli/types.ts` — the run envelope
  (`ConsensusCliRunEnvelope`): today it exposes attempts + diagnostics
  (output bytes, timeout) but **no token or cost data from any adapter**.
  Half this project is investigating what the Claude/Codex/Cursor CLIs can
  actually emit per run (`src/consensus/provider-cli/` adapters) and wiring
  only what exists.
- Resume/corruption test suites under `tests/consensus/refine/` — metrics
  must survive the resume paths those tests cover.

## Repo conventions and gates

- Canonical TS under `src/`; `pnpm run build` regenerates committed `.mjs`;
  `pnpm run build:check` catches drift. Never hand-edit `// GENERATED`
  outputs.
- Metrics changes touch shipped skill output → **version bumps** for every
  affected consensus skill (`pnpm run validate:skill-versions -- --base-ref
  <ref>` enforces; top-level `version` and `metadata.version` in sync).
- Artifact/schema additions must stay inside the v1 record schema
  discipline (see `DR-260613-unified-v1-verdict-schema.md` for the shape of
  that contract) — additive fields, no breaking renames.
- Definition of done: `pnpm test`, `pnpm run build:check`, `npm run
  validate`, `npm run smoke`; docs updated in the Fumadocs site via
  `oat-project-document`, not README.

## Close-out (same PR — no exceptions)

Follow the **Backlog Lifecycle** in `.oat/repo/pjm/AGENTS.md`: set the item
`status: closed` + bump `updated`, append the `backlog/completed.md` entry,
`git mv` the item to `backlog/archived/`, run `oat backlog
regenerate-index`, refresh `current-state.md` and the curated overview.
**Then delete this handoff file
(`git rm .oat/repo/pjm/handoffs/BL-260612-add-deliberation-metrics.md`) in
the same PR** — it is consumed context, not documentation.
