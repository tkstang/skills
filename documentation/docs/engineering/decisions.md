---
title: 'Decisions'
description: 'Where durable architecture and product decisions for this repo are recorded.'
---

# Decisions

Durable architecture and product decisions (with context and rationale) are
file-per-record documents under
[`.oat/repo/reference/decisions/`](https://github.com/tkstang/skills/tree/main/.oat/repo/reference/decisions),
with the generated [decision index](https://github.com/tkstang/skills/blob/main/.oat/repo/reference/decisions/index.md)
as the repository-wide inventory. Create records with `oat decision new`; do
not hand-edit the managed index section.

These accepted decisions explain the source and distribution model:

- [Canonical TypeScript sources](https://github.com/tkstang/skills/blob/main/.oat/repo/reference/decisions/DR-260615-canonical-typescript-sources.md)
  separates contributor feedback from dependency-free, committed runtime.
  Its original path examples are historical; use [Repository Layout](repository-layout.md)
  and [Build & Distribution](architecture/generated-runtime.md) for the current structure.

- [Declared skill distributions](https://github.com/tkstang/skills/blob/main/.oat/repo/reference/decisions/DR-260914-declared-skill-distributions.md)
  keeps one complete authored owner, declares each supported target, bundles
  runtime dependencies, and leaves workflow prerequisites explicit.
- [Session and consensus plugin boundaries](https://github.com/tkstang/skills/blob/main/.oat/repo/reference/decisions/DR-260914-session-and-consensus-plugin.md)
  groups products by behavior rather than shared-code location and keeps plugin
  releases independent.
- [Metadata version is the sole skill version](https://github.com/tkstang/skills/blob/main/.oat/repo/reference/decisions/DR-260914-metadata-version-is-the-sole.md)
  applies one owner version to every generated form while retaining old names
  only for clean-break historical comparison.

Together they reject manually maintained copies, mandatory whole-plugin
installation, automatic standalone exposure without evidence, and a universal
runtime dependency installer. Those choices preserve a source's provenance:
one editable owner remains identifiable even when several generated consumers
ship it.

Recent Collaborative Observer decisions separately record the sibling
composition layer, non-human wake-envelope authority boundary, bounded
lifecycle continuation, and acting-runtime setup selection. They preserve the
N=2 scope and evidence-gated provider posture without promoting documented
behavior to live validation.

This page highlights decisions that explain maintained documentation; it is not
a duplicate ledger. For example, this docs site uses **Fumadocs** — chosen for
toolchain consistency with the repo's Node/pnpm/TypeScript stack (no new
language in dev/CI) over the Python-based MkDocs path.
