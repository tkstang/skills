# consensus plugin

Scoped guidance for `plugins/consensus/`. Inherits the root `AGENTS.md`; this file adds only the consensus-specific delta. For usage, install paths, and iteration-mode behavior, read the package README and the shipped skill docs — do not duplicate them here.

## Architecture

`plugins/consensus/` is a self-contained plugin: provider CLI-backed AI peers create, decide, plan, refine, evaluate, answer panel questions, provide one-shot advisory takes, and observe coding-agent sessions with an audit trail. It currently ships nine skills: `create`, `decide`, `plan`, `refine`, `evaluate`, `panel`, `phone-a-friend`, `observer`, and `observer-collab`. See `README.md` for the iteration modes (`--iteration`: `parallel_synthesized` default for create/decide/plan, `alternating` default for refine, `parallel_revision` default for evaluate), the synthesizer/escalation/agency flags, panel/advisory behavior, session observation, and install paths.

## Non-Negotiables

- **The owned provider CLI is the only sanctioned external boundary.** Shipped consensus code stays dependency-free Node stdlib — do not add other external/network dependencies.
- **Generated runtime output is not source.** Canonical consensus plugin code lives under `src/plugins/consensus/`; canonical member-skill instructions, wrappers, and tests live under `src/skills/<name>/`. The committed files under `plugins/consensus/skills/*/` are generated installation payloads; regenerate them with `pnpm run build` and verify with `pnpm run build:check` instead of hand-editing them.
- **All filesystem writes must go through the confinement helpers.** Use `confineWrite` / `resolveOutputPath` / `resolveRunDir` and respect the `INPUT_SIZE_CAP_BYTES` (1 MiB) read cap in the relevant canonical wrapper under `src/skills/refine/src/` or `src/skills/evaluate/src/`. Do not write to arbitrary paths or read unbounded input — bypassing these is a path-traversal / resource regression.
- **Deliberation I/O is schema-bound.** Verdict and synthesis output conform to the contracts in `src/skills/refine/schemas/` and `src/skills/evaluate/schemas/` (parity-checked); keep changes to that output aligned with these schemas.

## References

- `README.md` — plugin scope, install paths, iteration modes, flags.
- `skills/*/SKILL.md` — shipped skill contracts and operation.
- `src/skills/refine/src/consensus-refine.ts` and `src/skills/evaluate/src/consensus-evaluate.ts` — canonical wrapper sources for path-safety helpers (`confineWrite`, `resolveOutputPath`, `resolveRunDir`, `readInputFile`, `INPUT_SIZE_CAP_BYTES`).
- `src/plugins/consensus/provider-cli/` — canonical provider CLI source and its colocated tests, including the opt-in live E2E under `e2e/`.
