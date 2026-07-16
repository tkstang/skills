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

Recent Session Observer Collaboration decisions record the sibling composition
layer, non-human wake-envelope authority boundary, bounded lifecycle
continuation, and acting-runtime setup selection. They preserve the N=2 scope
and evidence-gated provider posture without promoting documented behavior to
live validation.

This page is a deliberate slot, not a duplicate ledger. As projects document
themselves into this site (via `oat-project-document`), the rationale that's
worth surfacing to docs readers will land here. For example, this docs site uses
**Fumadocs** — chosen for toolchain consistency with the repo's Node/pnpm/TypeScript
stack (no new language in dev/CI) over the Python-based MkDocs path.
