---
title: 'Architecture'
description: 'The single-source-of-truth and generated-runtime philosophy behind this repo: shipped skills run with no install step, built from canonical TypeScript that is developer tooling only.'
---

# Architecture

This repo's architecture follows one defining constraint: **shipped skills run
with no install step**. The runtime files that provider manifests, docs, and
users execute are committed, dependency-free Node ESM that use only the standard
library, with the owned provider CLI as the single external boundary.

To keep those committed runtime files maintainable, the source of truth for the
non-trivial ones lives in **canonical TypeScript under `src/`**. That TypeScript
is developer tooling, not a runtime dependency: a build step compiles it into the
committed `.mjs` outputs that ship. TypeScript, Vitest, and bundling never become
a runtime dependency of a shipped skill.

Two pieces of this architecture have their own pages:

- **Shared transcript-core** — per-provider transcript knowledge has one source
  of truth, and each consuming skill ships a committed generated copy rather than
  importing across skills.
- **Generated runtime outputs** — the build contract that maps canonical
  TypeScript sources to their committed `.mjs` outputs, and the rule that those
  outputs are never hand-edited.

## Contents

- [Shared transcript-core](transcript-core.md) — One source of truth for per-provider transcript knowledge, with a committed generated copy per consuming skill.
- [Generated runtime outputs](generated-runtime.md) — The canonical-TypeScript → committed-`.mjs` build contract and the never-hand-edit rule.
