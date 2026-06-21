---
title: 'Engineering'
description: 'How this repo works, how its generated runtime is built, its layout, and how to contribute.'
---

# Engineering

Internals and contribution guidance for people working **on** this repo rather
than consuming it. If you just want to install and use the skills, see the
[User Guide](../user-guide/index.md).

The repo's defining engineering constraint: **shipped skills run with no install
step** — dependency-free Node ESM using only the standard library, with the owned
provider CLI as the single external boundary. TypeScript, Vitest, and bundling
are developer tooling that produces committed `.mjs` runtime output; they never
become a runtime dependency of a shipped skill.

## Contents

- [Architecture](architecture/index.md) — The shared transcript-core source of truth and the canonical-TypeScript → committed-`.mjs` generated-runtime build contract.
- [Repository Layout](repository-layout.md) — Where everything lives, repo-wide and inside the consensus package.
- [Contributing](contributing/index.md) — Development workflow and conventions, plus the docs authoring contract.
- [Decisions](decisions.md) — Where durable architecture/product decisions are recorded.
