---
title: 'Documentation'
description: 'The docs authoring contract for this Fumadocs site: navigation rules, supported Markdown, and the review checklist agents and humans follow.'
---

# Documentation

The contract for authoring this docs site itself. Documentation should ship with
the code it explains, so this section treats the docs app the same way the rest
of Engineering treats runtime code: a small set of conventions, enforced by
tooling, that keep both audiences served. Humans read the rendered site; agents
read the Markdown source and the navigation structure.

This site is a [Fumadocs](https://fumadocs.dev/) app (Next.js + MDX). Content
lives under `documentation/docs/`, and the app is rooted at `documentation/`.
Every content directory is mapped by an `index.md` with a `## Contents` section.
Adjacent `meta.json` files control rendered sidebar order/grouping; the root
manifest at `documentation/index.md` is a generated file-tree inventory, never
hand-edited. Keep the authored maps and sidebar metadata aligned, then regenerate
the inventory.

`documentation/AGENTS.md` is the concise routing and safety contract for agents;
the pages below are the shared detailed reference. Update both when their
contract changes. If a factual claim disagrees with the app's source or
configuration, correct the stale guidance together rather than treating either
prose surface as proof of implementation behavior.

## Contents

- [Authoring](authoring.md) — The navigation contract (`index.md` + `## Contents`), the `.md`-link convention, the generated-index discipline, and the local preview/build workflow.
- [Markdown Features](markdown-features.md) — Supported Markdown and MDX patterns grounded in what this app actually renders: frontmatter, GFM alerts, Mermaid, code blocks, full-text search, and dark/light mode.
- [Review Checklist](review-checklist.md) — What to verify before committing a docs change: frontmatter, `## Contents` updates, link resolution, the untouched generated manifest, a green build, and sane nav order.
