# consensus plugin

Scoped guidance for `plugins/consensus/`. Inherits the root `AGENTS.md`; this file adds only the consensus-specific delta. For usage, install paths, and iteration-mode behavior, read the package README and the shipped skill docs — do not duplicate them here.

## Architecture

`plugins/consensus/` is a self-contained plugin: two Paseo-backed AI peers deliberate over an artifact toward a converged result with an audit trail. It currently ships `refine` for markdown draft refinement and `evaluate` for artifact-vs-rubric evaluation. See `README.md` for the iteration modes (`--iteration`: `alternating` default for refine, `parallel_revision` default for evaluate, `parallel_synthesized`), the synthesizer/escalation/agency flags, and install paths.

## Non-Negotiables

- **Paseo is the only sanctioned external boundary** (DR-002). Shipped consensus code stays dependency-free Node stdlib — do not add other external/network dependencies.
- **Generated runtime output is not source.** Canonical TypeScript for generated consensus runtime files lives under `src/consensus/`. The committed `.mjs` files under `plugins/consensus/skills/*/scripts/` remain the shipped runtime paths; regenerate them with `pnpm run build` and verify with `pnpm run build:check` instead of hand-editing generated output.
- **All filesystem writes must go through the confinement helpers.** Use `confineWrite` / `resolveOutputPath` / `resolveRunDir` and respect the `INPUT_SIZE_CAP_BYTES` (1 MiB) read cap in the relevant canonical wrapper source under `src/consensus/`. Do not write to arbitrary paths or read unbounded input — bypassing these is a path-traversal / resource regression.
- **Deliberation I/O is schema-bound.** Verdict and synthesis output conform to the contracts in the shipped skill schemas (`skills/refine/schemas/` and `skills/evaluate/schemas/`, parity-checked); keep changes to that output aligned with these schemas.

## References

- `README.md` — plugin scope, install paths, iteration modes, flags.
- `skills/refine/SKILL.md` — the `refine` skill contract and operation.
- `skills/evaluate/SKILL.md` — the `evaluate` skill contract and operation.
- `src/consensus/refine/consensus-refine.ts` and `src/consensus/evaluate/consensus-evaluate.ts` — canonical wrapper sources for path-safety helpers (`confineWrite`, `resolveOutputPath`, `resolveRunDir`, `readInputFile`, `INPUT_SIZE_CAP_BYTES`).
