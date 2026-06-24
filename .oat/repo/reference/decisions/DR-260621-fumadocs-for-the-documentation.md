---
id: DR-260621-fumadocs-for-the-documentation
title: Fumadocs for the documentation site
date: 2026-06-21
status: proposed
legacy_id: DR-025
---

### DR-025: Fumadocs for the documentation site

- **Date:** 2026-06-21
**Context:** The docs-ia project (bl-ecaa) stood up a documentation site to slim the dense README. OAT docs tooling supports two frameworks: Fumadocs (Next.js, primary path) and MkDocs (Python, lean path). (Originally drafted as DR-024; renumbered to DR-025 on merge to `main` because provider-CLI hardening landed DR-024 first.)

**Decision:** Use Fumadocs.

**Reasoning:** Toolchain consistency — the repo is already Node/pnpm/TypeScript, so Fumadocs keeps documentation in one toolchain with no new language in dev/CI (MkDocs would add Python). Fumadocs is the OAT CLI's primary, best-tooled path and gives the public-facing site richer reader UX (client-side search, generated nav).

**Alternatives considered:** MkDocs (Material) — leaner output but introduces a Python toolchain to a repo that has none.

**Implications:** The docs app lives at `documentation/` (nested-standalone Fumadocs, `output: 'export'`), static-exports to GitHub Pages via `.github/workflows/deploy-docs.yml` (basePath `/skills`). Future projects document into the site via `oat-project-document`, not the README.
