# Documentation app

This file scopes work in `documentation/` and inherits the root instructions. The site is a Fumadocs/Next.js app; authored content is under `docs/`.

## Audience and ownership

- Start at [the docs map](docs/index.md). Keep consumer workflows in `docs/user-guide/` and internals/contribution guidance in `docs/engineering/`.
- Prefer improving the existing canonical page over duplicating it. Installation matrices, architecture contracts, and authoring procedures each have one detailed home.
- Use `.md` with `title` and `description` frontmatter. Use `.mdx` only when embedded JSX is needed.
- Repository facts come from current source/configuration. Correct stale instructions and human docs together; do not make code conform to an obsolete prose claim.

## Navigation: three different surfaces

1. **Authored local maps:** each content directory has `index.md` with useful `## Contents` links to its immediate pages/child directories.
2. **Rendered sidebar:** adjacent `meta.json` files control page order and grouping. Keep them aligned with the local maps when adding, moving, removing, or reordering pages.
3. **Generated inventory:** app-root `documentation/index.md` lists the file tree. Regenerate it; never hand-edit it or treat its order as sidebar order.

Sidebar groups may borrow pages or folders from other directories through native
Fumadocs relative references or link entries. Preserve canonical URLs rather
than copying guides to match navigation. Local `## Contents` maps must still
cover their immediate physical pages/child directories; they may also link
cross-directory reader destinations. Capability subheadings inside Contents are
allowed, but only `meta.json` separators define rendered sidebar groups.

Use relative `.md` links, including `subdir/index.md`; the rendering transform normalizes them. Update both source and destination maps/sidebar metadata in the same change when moving a page. Do not introduce `overview.md` entrypoints or another navigation framework.

## Commands and verification

Run from this directory:

```bash
pnpm dev
pnpm build
```

Both run the configured `predev`/`prebuild` generation. To refresh only the inventory:

```bash
oat docs generate-index --docs-dir docs --output index.md
```

For approved changes, verify local links, local maps/sidebar coherence, and the production build. Inspect affected Mermaid diagrams and sidebar rendering; a successful build alone does not establish visual quality. Format only changed authored docs using the repository formatter; never format AGENTS/CLAUDE files or generated inventories.

## Analysis and application

Use `oat-docs-analyze` for an audit and `oat-docs-apply` for approved bulk updates. During project lifecycle work, `oat-project-document` proposes project-derived updates. Analysis does not authorize application, commits to remote, or publication.

## Diagrams

Mermaid is the source of truth for diagrams. Inline fenced `mermaid` blocks render with the site palette (`components/mermaid.tsx`); do not add `%%{init}%%`, `style`, or `classDef` colour overrides. Prefer Mermaid over an authored SVG whenever the diagram type is expressible.

When a polished SVG counterpart exists in `public/diagrams/`, wrap the SVG and the Mermaid source in a `===` tab group, SVG first, with an italic date caption on each tab so drift is visible. See [Markdown features](docs/engineering/contributing/documentation/markdown-features.md) for the exact syntax and the SVG authoring rules.

- Every node and labelled edge must be verifiable against source code, not only prose. The per-node evidence lives in `.oat/repo/reference/evidence/diagrams/`; update that record when you add or change a diagram. Draw the code, not the docs, when they disagree, and fix the docs.
- Bump the Mermaid date caption when you edit Mermaid for a behaviour change.
- Do not regenerate or restyle an SVG unless you know the diagram workflow.
- When a diagram, the theme (`app/globals.css`), or the diagram wrappers (`components/mermaid.tsx`, `components/image.tsx`) change, view the affected pages in a browser at desktop and phone widths in both themes, including Mermaid inside tabs. The static export cannot prove Mermaid parse errors, tab content, hydration validity, or label legibility. Prose-only edits need only the build and link checks.

## References

- [Authoring](docs/engineering/contributing/documentation/authoring.md) — page creation, sidebar metadata, inventory generation, and local workflow.
- [Markdown features](docs/engineering/contributing/documentation/markdown-features.md) — supported Mermaid and MDX rendering.
- [Review checklist](docs/engineering/contributing/documentation/review-checklist.md) — pre-commit docs checks.
- [Development](docs/engineering/contributing/development/index.md) — repository setup and verification.
