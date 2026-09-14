---
title: 'Engineering'
description: 'How this repo works, how its generated runtime is built, its layout, and how to contribute.'
---

# Engineering

Internals and contribution guidance for people working **on** this repo rather
than consuming it. If you just want to install and use the skills, see the
[User Guide](../user-guide/index.md).

The repo's defining engineering constraint: **shipped skills run with no install
step** — dependency-free Node ESM using only the standard library, with an owned
provider CLI as the external boundary where needed. Canonical skill owners live
under `src/skills/`; TypeScript, Vitest, and bundling are developer tooling that
produce committed standalone and plugin installation units under `skills/` and
`plugins/`.

## Contents

- [Architecture](architecture/index.md) — Shared transcript-core, Cursor collaboration reliability, and the canonical-owner to generated-installation-unit build contract.
- [Repository Layout](repository-layout.md) — Canonical skill owners, distribution declarations, and the generated consensus/session package layouts.
- [Contributing](contributing/index.md) — Development workflow and conventions, plus the docs authoring contract.
- [Decisions](decisions.md) — Where durable architecture/product decisions are recorded.
