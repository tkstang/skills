---
title: 'Build & Distribution'
description: 'The build contract from canonical src/skills owners and distribution declarations to complete standalone and plugin payloads.'
---

# Build & Distribution

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

TypeScript, Vitest, and esbuild are developer tooling only. Installed skills
with bundled runtime still run committed Node ESM with no dependency installation
step. The instruction-only `seshtk-cli` skill instead uses the external
`@tkstang/session-toolkit` CLI (verified baseline 0.1.0); that execution
prerequisite is installed separately and is not part of its generated payload.

### Build and shipping topology

```mermaid
flowchart LR
  accTitle: Build and shipping topology
  accDescr: Skill owners, shared runtime, plugin source and distribution declarations feed pnpm run build, which writes standalone units and plugin payloads that providers load with no install step. build:check compares the generated output with the expected payload.
  subgraph authoring["Canonical authoring"]
    SKILLS["Skill owners<br/>src/skills/name/"]
    SHARED["Shared runtime<br/>src/shared/"]
    PLUGINS["Plugin source<br/>src/plugins/"]
    DECL["Distribution declarations<br/>src/distributions.ts"]
  end

  BUILD["pnpm run build"]
  RELEASE["Release-owned provider manifests<br/>and marketplace catalogs"]
  STANDALONE["Declared standalone units<br/>skills/canonical-name/"]
  PLUGINOUT["Generated plugin skills and runtime<br/>plugins/consensus and plugins/session"]
  CHECK["pnpm run build:check<br/>and generated-output-sync test"]
  RUNTIME["Provider install or local-load runtime<br/>no install step"]

  SKILLS --> BUILD
  SHARED --> BUILD
  PLUGINS --> BUILD
  DECL --> BUILD
  BUILD --> STANDALONE --> RUNTIME
  BUILD --> PLUGINOUT --> RUNTIME
  RELEASE --> RUNTIME
  SKILLS -.->|expected payload| CHECK
  SHARED -.->|dependency closure| CHECK
  DECL -.->|target inventory| CHECK
  STANDALONE -.->|checked output| CHECK
  PLUGINOUT -.->|checked output| CHECK
```

The build owns declared skill payloads and generated plugin runtime. Provider
manifests and shared marketplace catalogs remain independently maintained
release surfaces; a generated plugin target does not register or release a
plugin by itself.

## Canonical owner to generated forms

| Canonical owner                                                                                                                  | Generated forms                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/skills/consensus-create`, `consensus-decide`, `consensus-plan`, `consensus-refine`, `consensus-evaluate`, `consensus-panel` | Matching plugin-only `plugins/consensus/skills/<short-name>/` payloads                  |
| `src/skills/phone-a-friend`                                                                                                      | `skills/phone-a-friend/` and `plugins/consensus/skills/phone-a-friend/`                 |
| `src/skills/consensus-review`                                                                                                    | `skills/consensus-review/` and `plugins/consensus/skills/review/`                       |
| `src/skills/session-observer`                                                                                                    | `skills/session-observer/` and `plugins/consensus/skills/observer/`                     |
| `src/skills/session-observer-collab`                                                                                             | `skills/session-observer-collab/` and `plugins/consensus/skills/observer-collab/`       |
| `src/skills/session-handoff`                                                                                                     | `skills/session-handoff/` and `plugins/session/skills/handoff/`                         |
| `src/skills/session-retro`                                                                                                       | `skills/session-retro/` and `plugins/session/skills/retro/`                             |
| `src/skills/session-export-transcript`                                                                                           | `skills/session-export-transcript/` and `plugins/session/skills/export-transcript/`     |
| `src/skills/session-fork-to-destination`                                                                                         | `skills/session-fork-to-destination/` and `plugins/session/skills/fork-to-destination/` |
| `src/skills/seshtk-cli`                                                                                                          | `skills/seshtk-cli/` and `plugins/session/skills/seshtk-cli/`                           |
| `src/skills/session-search`                                                                                                      | `skills/session-search/` and `plugins/session/skills/search/`                           |
| `src/skills/reorient`                                                                                                            | `skills/reorient/` and `plugins/session/skills/reorient/`                               |
| `src/skills/complexity-review`                                                                                                   | `skills/complexity-review/` only                                                        |
| `src/skills/author-skill`                                                                                                        | `skills/author-skill/` only                                                             |
| `src/skills/babysit-pr`                                                                                                          | `skills/babysit-pr/` only                                                               |
| `src/skills/land-pr`                                                                                                             | `skills/land-pr/` only; requires the babysit-pr workflow                                |
| `src/skills/align`                                                                                                               | `skills/align/` and `plugins/session/skills/align/`                                     |
| `src/skills/debrief`                                                                                                             | `skills/debrief/` and `plugins/session/skills/debrief/`                                 |
| `src/skills/sitrep`                                                                                                              | `skills/sitrep/` and `plugins/session/skills/sitrep/`                                   |
| `src/skills/next-steps`                                                                                                          | `skills/next-steps/` and `plugins/session/skills/next-steps/`                           |
| `src/skills/explain-options`                                                                                                     | `skills/explain-options/` and `plugins/session/skills/explain-options/`                 |
| `src/skills/must-we`                                                                                                             | `skills/must-we/` and `plugins/session/skills/must-we/`                                 |

Executable owners declare entrypoints in `build.json`; prompt-only skills do
not need one. The build follows actual imports into permitted shared roots,
bundles that closure into each installation unit, and rejects undeclared source
escapes, duplicate targets, or runtime package dependencies.

The authored collaboration `.mjs` and `.d.mts` modules live under
`src/skills/session-observer-collab/src/`. Their runtime is bundled into each
generated form by the same build rather than maintained as a second authored tree. An
authored `.mjs` entrypoint must have an adjacent `.d.mts` declaration, but the
builder bundles the `.mjs` dependency closure and does not ship declarations.

For the concrete authoring sequence, see
[Adding a skill or distribution](../contributing/development/adding-a-skill.md).

## Code and workflow relationships

Bundled code and workflow prerequisites solve different problems. A runtime
import enters the generated installation unit. A required workflow must already
be installed, while an optional integration may be absent without blocking the
core skill.

```mermaid
flowchart LR
  accTitle: Session skill runtime dependencies
  accDescr: Shared transcript code is bundled into session-observer, session-export-transcript and session-search. session-observer-collab, session-retro and reorient require installed workflows, and session-handoff integrates optionally with observer and export.
  TRANSCRIPT["Shared transcript code"] -->|bundled code| OBSERVER["session-observer"]
  TRANSCRIPT -->|bundled code| EXPORT["session-export-transcript"]
  TRANSCRIPT -->|bundled code| SEARCH["session-search"]
  EXPORT -->|"bundled code (sanitizer matchers)"| SEARCH
  COLLAB["session-observer-collab"] -.->|requires installed workflow| OBSERVER
  HANDOFF["session-handoff"] -.->|optional integration| OBSERVER
  HANDOFF -.->|optional integration| EXPORT
  RETRO["session-retro"] -.->|requires installed workflow| EXPORT
  REORIENT["reorient"] -.->|requires installed workflow| EXPORT
```

The distribution declaration carries required and optional workflow references
so generated instructions can use the right standalone or plugin-local name.
It does not install those workflows automatically.

## Target-specific names and versions

Canonical identity is independent from plugin-local identity. For example,
`session-export-transcript` becomes `export-transcript` inside the session
plugin. The generated frontmatter uses the target name, while every form
inherits the canonical owner's single quoted stable `metadata.version`.

Plugin releases are separate: `plugins/consensus/` and `plugins/session/` each
have their own provider and marketplace manifest version. Bumping a plugin does
not rewrite its member skill versions; bumping a skill does not rewrite either
plugin release version.

## Consensus plugin-local runtime layout

Consensus wrappers live under `plugins/consensus/skills/<name>/scripts/`, while
the shared loop and provider CLI live once under `plugins/consensus/scripts/`.
Generated wrappers keep plugin-root-relative imports, so a provider install or
local load must preserve `scripts/` beside `skills/`.

The plugin also contains `skills/observer/` and `skills/observer-collab/`.
Their shared transcript and observer runtime closure is materialized into the
plugin unit; they do not import the standalone `skills/` tree at runtime.

The standalone `phone-a-friend` unit bundles its provider helper and advisory
schema. It does not require the Consensus plugin or a helper under the user's
home directory. The plugin's six converging and panel workflows remain
plugin-only; Review carries its own bundled review runtime in both declared
forms.

## Session plugin-local runtime layout

The session plugin is a separate complete package. `export-transcript`,
`fork-to-destination`, and `search` each carry their own bundled runtime closure
inside their skill directory; `handoff`, `retro`, and `reorient` are instruction-only with
bundled templates or references. Their canonical standalone names stay
`session-export-transcript`, `session-fork-to-destination`, `session-search`,
`session-handoff`, `session-retro`, and `reorient`. The instruction-only
`seshtk-cli` member keeps that same name in standalone and plugin forms and
requires the external toolkit CLI only when executing a session operation.
`align`, `debrief`, `sitrep`, `next-steps`, `explain-options`, and `must-we` are
instruction-only members with the same standalone and plugin-local names. Debrief and Sitrep declare Next Steps
as an optional workflow reference: standalone payloads name `next-steps`, while
Session payloads resolve the plugin-local `next-steps` member. Neither workflow
invokes it automatically. Must We retains `complexity-review` as optional
analysis; Complexity Review remains standalone and is not included in Session.

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

## When build or check fails

| Failure                                                         | What it means                                                                           | Safe response                                                                                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing, stale, or orphan generated file                        | The committed unit differs from the complete staged inventory.                          | Inspect the canonical source and declaration first. If the change is intentional, run `pnpm run build`, inspect the generated diff, then rerun `pnpm run build:check`. |
| Source escapes its allowed roots or a runtime imports a package | The declared ownership boundary or dependency-free runtime contract was crossed.        | Fix the declaration or import. Do not repair the failure by installing a runtime dependency.                                                                           |
| Replacement failed; prior outputs restored                      | Publication failed after staging, but the reported rollback restored the prior outputs. | Fix the reported cause and rebuild.                                                                                                                                    |
| Replacement failed and rollback was incomplete                  | Some replacement or restoration operation failed.                                       | Treat the paths in the error's recovery details as authoritative and inspect them individually. Do not guess at cleanup targets.                                       |
| Distribution installed but backup cleanup failed                | New outputs were installed, but one or more reported recovery backups remain.           | Verify the installed output and inspect only the exact backup paths named by the error before cleanup.                                                                 |

The builder stages and validates complete units before replacing outputs. Its
errors distinguish restoration from incomplete recovery; they are not a
promise that every failed filesystem operation is losslessly reversible.

### The build as a staged transaction

The failure table above describes one transaction. The builder stages and validates the complete unit before touching anything, moves prior outputs aside, then installs; validation failure aborts before any mutation, and the three replacement outcomes need three different responses.

```mermaid
stateDiagram-v2
  accTitle: Staged build transaction
  accDescr: Units are staged and validated before any mutation. Validation failure aborts untouched. Otherwise prior outputs are backed up and staged units renamed into place, a failed rename rolls back fully or incompletely, and success ends with backups removed or a backup cleanup failure.
  [*] --> staged: build each declared unit into a staging root
  staged: paths asserted repo-relative and collision-free
  staged --> checked: staged replacements validated
  checked: validateBeforeMutation runs the complete-unit check
  checked: nothing on disk has been touched yet
  checked --> failed_validation: a unit fails validation
  failed_validation: Outcome 0 — build aborts before any mutation
  failed_validation: committed outputs are untouched
  checked --> backed_up: validation passed
  backed_up: each existing output is moved aside as a
  backed_up: recovery backup beside it, a missing prior file is fine
  backed_up --> installed: rename each staged unit onto its output path
  installed: staged unit renamed into place

  backed_up --> rolling_back: a rename throws
  installed --> rolling_back: a rename throws
  rolling_back: reverse order — remove installed, restore backups
  rolling_back --> restored: every recovery step succeeded
  rolling_back --> incomplete: any recovery step failed
  restored: Outcome 1 — replacement failed, all prior outputs restored
  restored: fix the reported cause and rebuild
  incomplete: Outcome 2 — replacement failed and rollback was incomplete
  incomplete: the error's recovery details are authoritative

  installed --> cleanup: remove the recovery backup of every entry that had one
  cleanup --> done: all backups removed
  cleanup --> backups_left: a backup could not be removed
  done: Outcome 3a — build succeeded, orphan outputs removed
  backups_left: Outcome 3b — installed, but backup cleanup failed
  backups_left: inspect only the exact backup paths named by the error

  failed_validation --> [*]
  restored --> [*]
  incomplete --> [*]
  done --> [*]
  backups_left --> [*]
  note right of staged
    The staging root is removed in a finally block,
    so it is cleaned up on success and on failure.
  end note
```

_Mermaid updated 2026-09-20_
