---
title: 'TypeScript & Build Tooling'
description: 'How canonical TypeScript, NodeNext checking, tsx, esbuild, and generated Node 22 ESM installation units fit together.'
---

# TypeScript & Build Tooling

This repository separates contributor tooling from installed runtime. Contributors
work in strict TypeScript where practical, while users receive committed,
self-contained Node ESM without this repository's development dependencies.

Read [Build & Distribution](../../architecture/generated-runtime.md) for
the complete distribution, staging, replacement, and drift-detection contract.
This page focuses on the contributor-facing TypeScript and build-tool roles.

The executable references are [`tsconfig.json`](https://github.com/tkstang/skills/blob/main/tsconfig.json),
[`package.json`](https://github.com/tkstang/skills/blob/main/package.json), and
[`build-generated.ts`](https://github.com/tkstang/skills/blob/main/scripts/build-generated.ts).

## One authored source

Product skills have one editable owner under `src/skills/<name>/`. Shared runtime
belongs under `src/shared/`; non-skill plugin runtime belongs under
`src/plugins/<plugin>/`. `src/distributions.ts` maps those owners to standalone
and plugin installation targets and declares any additional source roots that a
bundle may read.

Do not edit generated files under `skills/` or `plugins/*/skills/`. A skill that
ships in more than one form still has one authored implementation. This prevents
provider-specific copies from becoming competing sources and lets one build
verify every declared installation form from the same inputs.

## What each tool does

| Tool    | Role                                                                                                                     | Writes product output?                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `tsx`   | Executes repository TypeScript tools such as `scripts/build-generated.ts` and `scripts/validate.ts` directly under Node. | Only when the invoked tool writes output.            |
| `tsc`   | Checks the configured TypeScript program with strict NodeNext rules.                                                     | No; the configuration and command both use `noEmit`. |
| esbuild | Transforms or bundles configured runtime entrypoints into Node 22 ESM `.mjs` files.                                      | Yes, through the repository build.                   |
| Vitest  | Runs behavior tests against canonical source and focused artifact contracts.                                             | No tracked product output.                           |

`tsx` is not the type checker and `tsc` is not the production emitter. The build
script runs through `tsx`, then calls esbuild for runtime output. Run the type
checker separately so bundling success is not mistaken for complete type safety.

## TypeScript configuration

`tsconfig.json` targets ES2024 and uses `module: "NodeNext"` with
`moduleResolution: "NodeNext"`. The repository is an ESM package, so canonical
TypeScript uses ESM syntax and relative imports use `.js` specifiers:

```ts
import { runGuidanceCli } from './guidance-cli.js';
```

That spelling describes the runtime module path. NodeNext resolves it to the
corresponding TypeScript source during checking. At generation time, esbuild
bundles the dependency closure; for generated outputs that retain relative
references, the build derives their `.mjs` destinations from the emitted `.js`
specifiers. Do not change canonical imports to generated paths.

The compiler enables `strict`, `isolatedModules`, and `verbatimModuleSyntax`.
Use explicit `import type` declarations where an import exists only at the type
level. `noEmit` makes type-checking non-mutating: emitted installation runtime is
always owned by the build, not by `tsc`.

The configured program includes TypeScript under `src/` and `scripts/`, root
tests, and any declaration inputs matched by `skills/**/*.d.ts`. JavaScript checking is
disabled (`allowJs: false`, `checkJs: false`).

## Declaring executable runtime

An executable skill declares its entrypoints in the owner's `build.json`:

```json
{
  "runtime": ["src/consensus-create.ts"]
}
```

The file accepts only a non-empty `runtime` string array. Each entry must be a
`.ts` or declared `.mjs` file below the owner's `src/` directory; test files and
declarations cannot be entrypoints. The output path is derived beneath the
installed unit's `scripts/` directory and ends in `.mjs`.

Do not add an empty `src/` directory or `build.json` to an instruction-only
skill. Without executable runtime, its authored instructions and resources are
enough; the packaging build still creates each declared installation form.

## Bundling and ownership boundaries

Each runtime entrypoint is bundled as ESM for Node 22. The bundler follows its
real import closure, but every input must remain inside the owner or an
`allowedSourceRoots` entry declared for that distribution. This makes shared
code reuse explicit without creating a second copy of the source.

Installed runtime may use `node:` built-ins. A bare runtime package import is a
build error. Source trees, tests, `build.json`, and declarations do not enter the
installed payload. The result is a self-contained installation unit that does
not require `pnpm install` on the user's machine.

## The authored MJS exception

Most executable owners use TypeScript. `session-observer-collab` deliberately
authors `.mjs` runtime modules with adjacent `.d.mts` declarations. Its
`build.json` lists the `.mjs` entrypoints, the builder requires each adjacent
declaration, bundles the JavaScript dependency closure, and omits declarations
from the installed payload.

This is a supported authoring exception, not the default for new runtime.
Because JavaScript checking is disabled, an adjacent `.d.mts` file describes the
module contract but does not prove that the `.mjs` body implements it correctly.
Behavior tests remain essential. Do not convert this owner merely for symmetry,
and do not assume a passing type check has examined those JavaScript bodies.

## Where tests belong

Keep unit and behavior tests beside their canonical owner as Vitest `.test.ts`
files. These tests should import canonical source. Shared-runtime tests belong
with `src/shared/`, and plugin-runtime tests belong with `src/plugins/`.

Use root `tests/` for repository-wide packaging, release, tooling, and installed
artifact contracts. Execute generated entrypoints only when the installed
artifact boundary is what the test protects. See [Testing](testing.md) for
minimum sufficient proof by change type.

## Build and verification workflow

When beginning a freshness audit, check before writing so a build cannot hide
pre-existing drift:

```bash
pnpm run build:check
```

After an intentional source or distribution change:

```bash
pnpm run type-check
pnpm run test:vitest src/skills/session-export-transcript
pnpm run build
git diff -- skills plugins
pnpm run build:check
pnpm run validate
```

`pnpm run build` executes the TypeScript generator through `tsx`, stages and
validates complete installation units, and updates committed generated output.
Inspect that diff rather than treating generation as review. `build:check` runs
the same model in comparison mode without repairing drift. Neither command
proves provider discovery, installation, or live behavior; those are separate
release or acceptance gates.
