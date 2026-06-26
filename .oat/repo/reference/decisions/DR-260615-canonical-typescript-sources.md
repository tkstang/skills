---
id: DR-260615-canonical-typescript-sources
title: Canonical TypeScript sources build committed generated runtime outputs
date: 2026-06-15
status: Accepted.
legacy_id: DR-020
---

### DR-020: Canonical TypeScript sources build committed generated runtime outputs

- **Date:** 2026-06-15
**Context:** The repo is adding TypeScript and Vitest for developer feedback while shipped skills/plugins must remain dependency-free and runnable from committed `.mjs` paths.
**Decision:** Canonical TypeScript source lives under the repo-level `src/` tree (for example, `src/consensus/core/` and `src/transcript/`), while provider-facing runtime entry points remain committed generated `.mjs` files under the existing `plugins/*/skills/*/scripts/` and `skills/*/scripts/` distribution paths. Generated outputs carry a `// GENERATED` banner, are never hand-edited, and are checked by `node scripts/build-generated.mjs --check` through `tests/generated-output-sync.test.mjs`.
**Rationale:** Keeping committed `.mjs` output preserves existing manifests, docs, tests, install copies, and user execution paths with no install step. Keeping canonical TypeScript out of `plugins/` makes the plugin tree the distribution surface rather than the developer source tree. TypeScript, Vitest, and bundling stay dev-only, while the drift guard prevents source/output divergence.
- **Status:** Accepted.
