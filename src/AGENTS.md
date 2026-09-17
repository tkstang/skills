# Canonical source and colocated tests

Inherits the root instructions. Read this file before changing source or tests under `src/`. Commands below run from the repository root.

## Choose the owner

- `skills/<name>/` owns a skill's instructions, resources, runtime, and tests. Prompt-only skills need no empty runtime directory or `build.json`; executable owners declare entrypoints in `build.json`.
- `shared/` owns genuinely shared runtime and its tests. Importing code does not require installing another skill's workflow.
- `plugins/<plugin>/` owns non-skill plugin code and tests. Consensus CLI/core changes belong here; member-skill changes belong to their skill owner.
- `distributions.ts` is build-time configuration: canonical owners, selected standalone/plugin forms, permitted source roots, required/optional workflow references, and independent plugin release targets. A declaration is not proof of live provider discovery.

For a worked example, read [Adding a skill or distribution](../documentation/docs/engineering/contributing/development/adding-a-skill.md). Keep one editable owner when promoting a skill; preserve provenance and coordinate downstream ownership explicitly.

## Source to installation boundary

- Edit the owner, not `skills/` or `plugins/*/skills/` output. Keep workflow-reference slots explicit; do not globally replace ordinary prose to render another distribution name.
- Runtime code is bundled into the installation unit. A true required skill workflow must be declared, checked before dependent work, and linked to installation guidance; do not auto-install it. Optional integrations remain optional.
- Most executable owners use TypeScript. Collaboration deliberately authors `.mjs` with adjacent `.d.mts` contracts; the build bundles its entrypoints and does not ship declarations. Do not hand-edit generated MJS or convert the authored exception merely for symmetry.
- Shared-source or generated-output changes can require several canonical skill version bumps. Use the [version-impact rules](../documentation/docs/engineering/contributing/development/conventions.md#skill-version-bump-on-edit) and an explicit comparison base; plugin release versions remain separate.

## Consensus safety when changing its source

- For wrapper filesystem operations, use the relevant owner's existing confinement/path-resolution helpers and input-size caps. Create, decide, plan, refine, and evaluate each have their own wrapper contract; do not copy a different operation's path or schema assumptions.
- Read the operation's `schemas/` and wrapper under `skills/<name>/` before changing deliberation I/O. Provider CLI/core contracts live under `plugins/consensus/`; preserve their own boundaries rather than assuming a wrapper schema covers them.
- Keep peer invocation through the owned provider CLI. Local tests use deterministic fixtures; live provider execution needs explicit authorization.

## Tests and verification

- Use owner-colocated Vitest `.test.ts` tests; do not introduce `.test.mjs` or another runner. Shared behavior tests stay with the shared owner; repo/release/packaging tests stay under `tests/`.
- Import canonical source for unit behavior. Execute generated entrypoints when protecting the installed-artifact contract. Use temporary fixtures, clean up only their known paths, and leave tracked output unchanged.
- Extend the existing relevant suite. Test distinct failure or installation boundaries, not every skill × provider combination. Do not add prose snapshots, coverage quotas, or live calls merely to prove packaging.
- Run scoped tests with `pnpm run test:vitest <test-path>` and `pnpm run type-check` as appropriate. After intended payload changes, run `pnpm run build`, inspect the generated diff, then `pnpm run build:check` and `pnpm run validate`.
- When auditing existing freshness, run `pnpm run build:check` **before** a build that could repair drift. Never interpret an installed-artifact smoke as fresh-provider or native-session acceptance.

## References

- [Generated installation units](../documentation/docs/engineering/architecture/generated-runtime.md) — rendering, bundling, failure handling, and maintained release surfaces.
- [Development](../documentation/docs/engineering/contributing/development/index.md) — test ownership and minimum sufficient proof.
- [Repository test guidance](../tests/AGENTS.md) — root-suite fixtures and tooling checks.
