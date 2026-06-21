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

## Verification command set

Run:

```bash
pnpm run type-check
pnpm test
pnpm run build:check
pnpm run validate
pnpm run smoke
```

- `pnpm run type-check` — type-checks the canonical TypeScript source.
- `pnpm test` — the full Vitest suite, including the generated-output drift guard.
- `pnpm run build:check` — verifies committed generated `.mjs` runtime output
  matches its canonical TypeScript source without mutating tracked files.
- `pnpm run validate` — repository structure, manifest, and docs invariants.
- `pnpm run smoke` — the mocked end-to-end consensus wrapper flow.

## Contribution workflow

For the contribution rules — where standalone skills versus plugin-bundled skills
live, plugin-manifest constraints, additive skill frontmatter, and the
cross-provider testing release requirement — see
[`CONTRIBUTING.md`](https://github.com/tkstang/skills/blob/main/CONTRIBUTING.md).

## Contents

- [Conventions](conventions.md) — Repository conventions: dependency-free shipped skills, pnpm dev tooling, generated-runtime discipline, skill version bumps, and worktrees.
- [Commit conventions](commit-conventions.md) — Conventional Commits format, common types, and how it is enforced.
- [Hooks and safety](hooks-and-safety.md) — Git hooks, lint-staged, skill version-bump enforcement, and lint/format exclusions.
