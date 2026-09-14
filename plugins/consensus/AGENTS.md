# consensus plugin

Scoped guidance for `plugins/consensus/`. Inherits the root `AGENTS.md`; this file adds only the consensus-specific delta. For usage, install paths, and iteration-mode behavior, read the package README and the shipped skill docs — do not duplicate them here.

## Architecture

`plugins/consensus/` is a self-contained plugin: provider CLI-backed AI peers create, decide, plan, refine, evaluate, answer panel questions, provide one-shot advisory takes, and observe coding-agent sessions with an audit trail. It currently ships nine skills: `create`, `decide`, `plan`, `refine`, `evaluate`, `panel`, `phone-a-friend`, `observer`, and `observer-collab`. See `README.md` for the iteration modes (`--iteration`: `parallel_synthesized` default for create/decide/plan, `alternating` default for refine, `parallel_revision` default for evaluate), the synthesizer/escalation/agency flags, panel/advisory behavior, session observation, and install paths.

## Non-Negotiables

- **The owned provider CLI is the only sanctioned external boundary.** Shipped consensus code stays dependency-free Node stdlib — do not add other external/network dependencies.
- **Generated runtime output is not source.** Canonical consensus plugin code lives under `src/plugins/consensus/`; canonical member-skill instructions, wrappers, and tests live under `src/skills/<name>/`. The committed files under `plugins/consensus/skills/*/` are generated installation payloads; regenerate them with `pnpm run build` and verify with `pnpm run build:check` instead of hand-editing them.
- **Route source changes to the canonical owner.** Read [source instructions](../../src/AGENTS.md) before editing wrappers, CLI/core code, or colocated tests. Plugin manifests and package docs are maintained surfaces; do not replace the entire plugin root as though every file were generated.
- **Preserve the relevant operation's filesystem safeguards.** Create, decide, plan, refine, and evaluate wrappers own confinement/path-resolution helpers and bounded input reads. Use the helper and cap in that operation's canonical source; do not write to arbitrary paths or read unbounded input.
- **Deliberation I/O is schema-bound.** Read the relevant skill owner's `schemas/` and wrapper before changing its output; refine/evaluate schemas are not universal contracts for the other operations.

## References

- `README.md` — plugin scope, install paths, iteration modes, flags.
- `skills/*/SKILL.md` — shipped skill contracts and operation.
- [Distribution catalog](../../src/distributions.ts) — resolves canonical member-skill owners from plugin-local names.
- Repo-root-relative `src/skills/<name>/src/` and `src/skills/<name>/schemas/` — the relevant wrapper's path-safety and I/O contracts.
- Repo-root-relative `src/plugins/consensus/provider-cli/` — canonical provider CLI source and its colocated tests, including the separately authorized opt-in live E2E under `e2e/`.
