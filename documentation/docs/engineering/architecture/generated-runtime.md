---
title: 'Generated installation units'
description: 'The build contract from canonical src/skills owners and distribution declarations to complete standalone and plugin payloads.'
---

# Generated installation units

Every product skill is authored once under `src/skills/`. The distribution
catalog renders complete committed installation units under `skills/` and
`plugins/`, including target-specific names, references/assets, and bundled
dependency-free `.mjs` runtime where needed. Edit the canonical owner or shared
source, never a generated payload.

## The build contract

- `pnpm run build` runs `tsx scripts/build-generated.ts` and writes all
  declared installation units through staged validation and replacement.
- `pnpm run build:check` runs the same owner with `--check`, comparing complete
  file inventories, content, and executable modes without mutating tracked
  files.
- `tests/tooling/generated-output-sync.test.ts` runs the drift guard as part of
  `pnpm test`.
- `pnpm run sync:transcript-core` is a compatibility command for the same
  generated-output build.

TypeScript, Vitest, and esbuild are developer tooling only. Installed skills
still run committed Node ESM with no dependency installation step.

### Build and shipping topology

```mermaid
flowchart LR
  subgraph authoring["Canonical authoring"]
    SKILLS["Skill owners<br/>src/skills/name/"]
    SHARED["Shared runtime<br/>src/shared/"]
    PLUGINS["Plugin source<br/>src/plugins/"]
    DECL["Distribution declarations<br/>src/distributions.ts"]
  end

  BUILD["pnpm run build"]
  STANDALONE["Declared standalone units<br/>skills/canonical-name/"]
  PLUGINOUT["Complete plugin units<br/>plugins/consensus and plugins/session"]
  CHECK["pnpm run build:check<br/>and generated-output-sync test"]
  RUNTIME["Provider install or local-load runtime<br/>no install step"]

  SKILLS --> BUILD
  SHARED --> BUILD
  PLUGINS --> BUILD
  DECL --> BUILD
  BUILD --> STANDALONE --> RUNTIME
  BUILD --> PLUGINOUT --> RUNTIME
  SKILLS -.->|expected payload| CHECK
  SHARED -.->|dependency closure| CHECK
  DECL -.->|target inventory| CHECK
  STANDALONE -.->|checked output| CHECK
  PLUGINOUT -.->|checked output| CHECK
```

## Canonical owner to generated forms

| Canonical owner                                                                        | Generated forms                                                                         |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/skills/create`, `decide`, `plan`, `refine`, `evaluate`, `panel`, `phone-a-friend` | Matching `plugins/consensus/skills/<name>/` payloads                                    |
| `src/skills/session-observer`                                                          | `skills/session-observer/` and `plugins/consensus/skills/observer/`                     |
| `src/skills/session-observer-collab`                                                   | `skills/session-observer-collab/` and `plugins/consensus/skills/observer-collab/`       |
| `src/skills/session-handoff`                                                           | `skills/session-handoff/` and `plugins/session/skills/handoff/`                         |
| `src/skills/session-export-transcript`                                                 | `skills/session-export-transcript/` and `plugins/session/skills/export-transcript/`     |
| `src/skills/session-fork-to-destination`                                               | `skills/session-fork-to-destination/` and `plugins/session/skills/fork-to-destination/` |
| `src/skills/complexity-review`                                                         | `skills/complexity-review/` only                                                        |

Executable owners declare entrypoints in `build.json`; prompt-only skills do
not need one. The build follows actual imports into permitted shared roots,
bundles that closure into each installation unit, and rejects undeclared source
escapes, duplicate targets, or runtime package dependencies.

The authored collaboration `.mjs` and `.d.mts` modules live under
`src/skills/session-observer-collab/src/`. They are copied into each generated
form together with the required shared runtime rather than maintained as a
second authored tree.

## Target-specific names and versions

Canonical identity is independent from plugin-local identity. For example,
`session-export-transcript` becomes `export-transcript` inside the session
plugin. The generated frontmatter uses the target name, while every form
inherits the canonical owner's single quoted stable `metadata.version`.

Plugin releases are separate: `plugins/consensus/` and `plugins/session/` each
have their own provider and marketplace manifest version. Bumping a plugin does
not rewrite its member skill versions; bumping a skill does not rewrite either
plugin release version.

The historical mapping for `export-session-transcript` and
`coding-session-handoff` exists only so the version guard can compare renamed
owners. The builder emits no legacy payload, alias, redirect, wrapper, or old
script entrypoint.

## Consensus plugin-local runtime layout

Consensus wrappers live under `plugins/consensus/skills/<name>/scripts/`, while
the shared loop and provider CLI live once under `plugins/consensus/scripts/`.
Generated wrappers keep plugin-root-relative imports, so a provider install or
local load must preserve `scripts/` beside `skills/`.

The plugin also contains `skills/observer/` and `skills/observer-collab/`.
Their shared transcript and observer runtime closure is materialized into the
plugin unit; they do not import the standalone `skills/` tree at runtime.

Standalone copies of peer wrappers remain supported only where declared and
through the existing pinned provider-CLI recovery path at
`~/.consensus/consensus.mjs`.

## Session plugin-local runtime layout

The session plugin is a separate complete package. `export-transcript` and
`fork-to-destination` each carry their own bundled runtime closure inside their
skill directory; `handoff` is instruction-only with a bundled template. Their
canonical standalone names stay `session-export-transcript`,
`session-fork-to-destination`, and `session-handoff`.

## Import rewriting

Canonical TypeScript uses normal `.js` specifiers. The build derives import
rewrites from actual source imports and resolves them against declared outputs.
An unresolvable or ambiguous specifier fails loudly. This keeps generated local
`.mjs` paths correct without a hand-maintained second consumer graph.

## Never hand-edit generated output

Files under declared `skills/` and `plugins/*/skills/` installation units are
produced by the build, including rendered `SKILL.md`, references/assets,
schemas, and executable runtime. Change the canonical owner under `src/skills/`,
shared code under `src/shared/`, or plugin source under `src/plugins/`, then run
`pnpm run build`. `pnpm run build:check` and the generated-output-sync test flag
inventory, content, or executable-mode drift.
