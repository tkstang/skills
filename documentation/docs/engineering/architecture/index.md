---
title: 'Architecture'
description: 'The single-owner and generated-installation-unit architecture behind dependency-free shipped skills.'
---

# Architecture

This repo's architecture follows one defining constraint: **shipped skills run
with no install step**. The runtime files that provider manifests, docs, and
users execute are committed, dependency-free Node ESM that use only the standard
library, with the owned provider CLI as the single external boundary.

To keep those committed runtime files maintainable, every skill has one
**canonical authored owner under `src/skills/`**. Shared and plugin code lives
under explicit `src/shared/` and `src/plugins/` owners. A distribution catalog
renders complete standalone and plugin-local payloads, including compiled `.mjs`
where needed. TypeScript, Vitest, and bundling never become runtime dependencies
of a shipped skill.

The architecture favors one editable source with generated consumers because
manually maintained copies drift. Explicit targets avoid two opposite errors:
forcing every user to install a whole plugin when a standalone unit is enough,
and advertising every skill as standalone without boundary evidence. Runtime
dependencies are bundled into an installation unit; workflow prerequisites stay
explicit instead of growing into a universal installer. See
[Decisions](../decisions.md) for the accepted rationale.

Three pieces of this architecture have their own pages:

- **Generated installation units** — the build contract that maps canonical
  skill, shared, and plugin sources to complete standalone/plugin payloads, and
  the rule that those outputs are never hand-edited.

- **Shared transcript-core** — per-provider transcript knowledge has one source
  of truth, and each consuming skill ships a committed generated copy rather than
  importing across skills.
- **Cursor collaboration reliability** — exact identity, physical-frame
  observation, isolated continuity state, and lease-scoped completion keep
  availability separate from automatic continuation.

## Contents

- [Generated installation units](generated-runtime.md) — The canonical-owner → complete standalone/plugin payload build contract and the never-hand-edit rule.
- [Shared transcript-core](transcript-core.md) — One source of truth for per-provider transcript knowledge, with a committed generated copy per consuming skill.
- [Cursor collaboration reliability](cursor-collaboration-reliability.md) — Exact identity, content-first observation, state continuity, and lease-scoped completion for Cursor collaboration.
