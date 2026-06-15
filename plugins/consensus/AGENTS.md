# consensus plugin

Scoped guidance for `plugins/consensus/`. Inherits the root `AGENTS.md`; this file adds only the consensus-specific delta. For usage, install paths, and iteration-mode behavior, read the package README and the `refine` skill — do not duplicate them here.

## Architecture

`plugins/consensus/` is a self-contained plugin: two Paseo-backed AI peers deliberate over a markdown artifact toward a converged result with an audit trail. It currently ships one skill, `refine`. See `README.md` for the iteration modes (`--iteration`: `alternating` default, `parallel_revision`, `parallel_synthesized`), the synthesizer/escalation/agency flags, and install paths.

## Non-Negotiables

- **Paseo is the only sanctioned external boundary** (DR-002). Shipped consensus code stays dependency-free Node stdlib — do not add other external/network dependencies.
- **All filesystem writes must go through the confinement helpers.** Use `confineWrite` / `resolveOutputPath` / `resolveRunDir` and respect the `INPUT_SIZE_CAP_BYTES` (1 MiB) read cap from `skills/refine/scripts/consensus-refine.mjs`. Do not write to arbitrary paths or read unbounded input — bypassing these is a path-traversal / resource regression.
- **Deliberation I/O is schema-bound.** Verdict and synthesis output conform to the contracts in `skills/refine/schemas/` (`verdict-alternating.schema.json`, `verdict-parallel.schema.json`, `synthesis.schema.json`); keep changes to that output aligned with these schemas.

## References

- `README.md` — plugin scope, install paths, iteration modes, flags.
- `skills/refine/SKILL.md` — the `refine` skill contract and operation.
- `skills/refine/scripts/consensus-refine.mjs` — path-safety helpers (`confineWrite`, `resolveOutputPath`, `resolveRunDir`, `readInputFile`, `INPUT_SIZE_CAP_BYTES`).
