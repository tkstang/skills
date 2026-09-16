---
title: 'Development'
description: 'The local development workflow for this repo: Node >=22, pnpm dev dependencies, and the verification command set you run before pushing.'
---

# Development

How to set up and verify a local change to this repo. Runtime plugin code uses
Node ESM and the Node standard library only; developer tooling uses
pnpm-managed dev dependencies.

## Prerequisites

- Node.js 22 or newer.
- pnpm for developer dependencies. Install with `pnpm install`. Git hooks install
  automatically on `pnpm install`.

## Change, generate, verify, release

Edit the canonical owner and its distribution declaration, bump `metadata.version`, run `pnpm run build`, then verify. The live-provider check is an independent manual gate: no workflow invokes it and the release workflow does not require it.

```mermaid
flowchart TD
  subgraph change["1 · Change canonical source"]
    OWN["src/skills/&lt;name&gt;/<br/>SKILL.md, runtime, build.json"]
    SH["src/shared/ · src/plugins/"]
    DECL["src/distributions.ts<br/>declare every supported target"]
    VER["Bump metadata.version<br/>in the canonical SKILL.md"]
  end
  BUILD["2 · pnpm run build<br/>writes skills/ and plugins/ payloads"]
  subgraph static["3 · Static verification · no provider calls"]
    TC["pnpm run type-check"]
    TEST["pnpm test<br/>incl. generated-output drift guard"]
    BC["pnpm run build:check<br/>inventory, bytes, exec modes"]
    VAL["pnpm run validate<br/>structure, manifests, docs"]
    SMOKE["pnpm run smoke<br/>mocked consensus wrapper flow"]
    SV["pre-push: validate:skill-versions<br/>changed skill must bump"]
  end
  subgraph release["4 · Release · outside the build"]
    BUMP["scripts/bump-version.ts<br/>writes the new plugin version"]
    MAN["Provider manifests and<br/>marketplace catalogs<br/>updated before tagging"]
    PRT["pluginReleaseTargets<br/>independent plugin versions"]
    TAG["Tag consensus-v* / session-v*"]
    VERIFY["Release workflow reruns the static suite<br/>and checkTagVersion verifies the tag<br/>against the already-written manifests"]
  end
  LIVE["Independent manual gate<br/>pnpm run test:live-e2e, or the Live Provider E2E<br/>workflow_dispatch — no workflow invokes it,<br/>and the Release workflow does not require it"]

  OWN --> BUILD
  SH --> BUILD
  DECL --> BUILD
  VER --> BUILD
  BUILD --> TC
  BUILD --> TEST
  BUILD --> BC
  BUILD --> VAL
  BUILD --> SMOKE
  BUILD --> SV
  BC -.->|"drift: fix source, rebuild"| BUILD
  SMOKE --> BUMP
  SV --> BUMP
  BUMP --> MAN
  BUMP --> PRT
  MAN --> TAG
  PRT --> TAG
  TAG --> VERIFY
```

_Mermaid updated 2026-09-16_

## Verification command set

Run:

```bash
pnpm run type-check
pnpm test
pnpm run build:check
pnpm run validate
pnpm run smoke
```

- `pnpm run type-check` — checks canonical TypeScript, development scripts, and tests without emitting runtime files.
- `pnpm test` — the full Vitest suite, including the generated-output drift guard.
- `pnpm run build:check` — compares every declared committed installation unit
  with a freshly staged payload, including file inventory, bytes, and executable
  modes, without mutating tracked files.
- `pnpm run validate` — repository structure, manifest, and docs invariants.
- `pnpm run smoke` — the mocked end-to-end consensus wrapper flow.

## Contribution workflow

For the contribution rules — canonical `src/skills/` ownership, distribution
declarations, plugin-manifest constraints, sole `metadata.version`, and the
cross-provider testing release requirement — see
[`CONTRIBUTING.md`](https://github.com/tkstang/skills/blob/main/CONTRIBUTING.md).

## Minimum sufficient testing

Match proof to the boundary changed: owner behavior, shared code, packaging,
or installed execution. [Testing](testing.md) provides the selection table,
focused commands, and the distinction between deterministic checks and live
acceptance. [TypeScript & Build Tooling](typescript-and-build-tooling.md)
explains why type checking and runtime generation are separate steps.

## Contents

- [TypeScript & Build Tooling](typescript-and-build-tooling.md) — Understand the compiler, script runner, bundler, imports, and authored JavaScript exception.
- [Adding a skill or distribution](adding-a-skill.md) — Add prompt-only or executable owners, new targets, workflow references, or a new plugin without creating parallel sources.
- [Testing](testing.md) — Choose focused tests, verify installed artifacts, and distinguish mocked checks from live acceptance.
- [Conventions](conventions.md) — Repository conventions: dependency-free shipped skills, canonical owners, generated distributions, skill version bumps, and worktrees.
- [Commit conventions](commit-conventions.md) — Conventional Commits format, common types, and how it is enforced.
- [Hooks and safety](hooks-and-safety.md) — Git hooks, lint-staged, skill version-bump enforcement, and lint/format exclusions.
