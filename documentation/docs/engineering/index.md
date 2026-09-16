---
title: 'Engineering'
description: 'How this repo works, how its generated runtime is built, its layout, and how to contribute.'
---

# Engineering

Internals and contribution guidance for people working **on** this repo rather
than consuming it. If you just want to install and use the skills, see the
[User Guide](../user-guide/index.md).

The repo's defining engineering constraint: shipped skills need no dependency
installation step. Some skills are instruction-only; executable runtime uses
dependency-free Node ESM and the standard library, with provider CLI subprocesses
as the external execution boundary where needed. Canonical skill owners live
under `src/skills/`; TypeScript, Vitest, and bundling are developer tooling that
produce committed standalone and plugin installation units under `skills/` and
`plugins/`.

## Contents

- [Development](contributing/development/index.md) — Set up the checkout, change a skill, and verify the relevant boundaries.
- [Architecture](architecture/index.md) — Shared transcript-core, Cursor collaboration reliability, and the canonical-owner to generated-installation-unit build contract.
- [Documentation](contributing/documentation/index.md) — Authoring, supported Markdown, navigation, and review guidance.
- [Operations](operations/index.md) — CI, docs deployment, release evidence, and independent skill/plugin versioning.
- [Decisions](decisions.md) — Where durable architecture/product decisions are recorded.
- [Repository Layout](repository-layout.md) — Find canonical source, generated packages, and developer tooling.
- [Contributing](contributing/index.md) — Browse development and documentation contribution guidance.
