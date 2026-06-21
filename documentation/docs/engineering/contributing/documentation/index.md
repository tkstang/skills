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
Every content directory is mapped by an `index.md` with a `## Contents` section,
and the root manifest at `documentation/index.md` is generated — never
hand-edited.

The authoritative runtime contract for **agents** working inside the docs app is
`documentation/AGENTS.md`. It covers the same conventions documented here from
the agent's point of view — adding pages, restructuring navigation, the
audit/apply flow, and what not to do. The pages below are the
human-and-agent-shared reference; `AGENTS.md` is the agent runtime entry point.
When the two ever disagree, `AGENTS.md` wins and these pages should be corrected
to match.

## Contents

- [Authoring](authoring.md) — The navigation contract (`index.md` + `## Contents`), the `.md`-link convention, the generated-index discipline, and the local preview/build workflow.
- [Markdown Features](markdown-features.md) — Supported Markdown and MDX patterns grounded in what this app actually renders: frontmatter, GFM alerts, Mermaid, code blocks, full-text search, and dark/light mode.
- [Review Checklist](review-checklist.md) — What to verify before committing a docs change: frontmatter, `## Contents` updates, link resolution, the untouched generated manifest, a green build, and sane nav order.
