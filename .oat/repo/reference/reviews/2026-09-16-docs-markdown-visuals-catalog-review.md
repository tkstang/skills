# Astra review: Markdown and visuals catalog

Reviewed commit `e91cd0bc` on top of the current navigation commit `8755cc6`.
Scope: catalog accuracy, copyable examples, relevant rendering code, and one
desktop dark-mode preview. Review only; no tracked source edits.

## Assessment

Good foundation: all five callouts render distinctly, the inline Mermaid sample
renders, and the tabs render in the actual page. The syntax-before-example
pattern is useful. Source-verification and image-path guidance belong here.
Do not consider the catalog complete until the corrections below are handled.

## Requested corrections

### R1 — Correct frontmatter effects (medium)

`markdown-features.md:27-29` says description drives social cards and sibling
summaries in Contents. Contents summaries are authored prose, not frontmatter
derived (`authoring.md:16-30`). `app/[[...slug]]/page.tsx:16-25` emits ordinary
title/description metadata; there is no app Open Graph card implementation.
Say title is the default page/navigation title, subject to metadata overrides;
description provides page metadata and searchable text. Mark requiring both as
our authoring convention, not a renderer requirement.

### R2 — Make the diagram pair a complete, rendered recipe (medium)

`markdown-features.md:137-152` is a schematic fragment with an ellipsis and a
currently untracked SVG dependency. There is no rendered paired example yet.
Deferring the asset until verification was right, but finish this when the
verified diagram is available. Include complete copyable syntax plus the actual
pair. The `Source` tab contains a `mermaid` fence, which remarkMermaid converts
into another rendered diagram, not raw source (`docs-transforms/dist/remark-mermaid.js:11-33`).
Either call the tab `Mermaid`, or expose an actual source code block as well.
The page should not imply readers can copy source out of a diagram-only tab.

### R3 — Verify the actual production base path (medium)

`markdown-features.md:192-195` points to the check below as proof of `/skills`
asset paths, but `:236-238` runs plain `pnpm build`. `next.config.js:3` reads
NEXT_PUBLIC_BASE_PATH without a production default. CI/deploy explicitly set
`/skills` (`docs-ci.yml:43`, `deploy-docs.yml:58`). Document separate default and
base-path builds, inspect emitted image URLs, and serve/check the production
export. A dev-page HTTP 200 is not proof of the production asset route.
Describe the app Image component's prefixing, not a generic Markdown build
rewrite. Coordinate builds because the pinned OAT prebuild's old config rewrite
has already caused unrelated local effects in this worktree.

### R4 — Name the actual search engine, or omit it (low)

`markdown-features.md:219` says FlexSearch, but `components/search.tsx:24` uses
`type: 'static'`; installed `fumadocs-core/dist/search/client.js:47-48` selects
`orama-static.js`, which imports `@orama/orama`. The server endpoint uses Orama
too. Merely having a FlexSearch module installed is not evidence it is active.
Prefer simply “client-side full-text search over a generated static index.”

### R5 — Cover the baseline or narrow the catalog's completeness claim (medium)

`:8-10` tells agents to assume anything absent is unsupported, yet common
supported features are absent: headings/anchors, relative `.md` links, lists,
tables, inline code/emphasis, and ordinary blockquotes. Add concise source +
rendered examples for those, or clearly position this as the app-specific
extensions catalog with a link to baseline syntax. The user asked for a full
discoverable feature catalog; expanding the baseline is my preference.

## Smaller improvements

- Put all five callout forms in the copyable block, not only NOTE/WARNING.
- The tabs sample reparses `pnpm install` into ordinary paragraph text. Show
  indented fenced shell blocks if this is meant to demonstrate copyable commands.
- The toy Mermaid `Read index.md -> Generate nav` is misleading for this repo:
  sidebar metadata is authored separately, not generated from Contents. Choose
  neutral labels or a source-verified process.
- SVG type sizes at `:172-184` are source-coordinate sizes. A 1240-wide diagram
  displayed in an approximately 834px content column shrinks 12px labels to
  about 8px. Require checks at actual desktop/mobile display size, not only a
  native-resolution raster on two backgrounds.
- Use the agreed visible label “Markdown & Visuals”; the URL can remain stable.
- Linking the authoring/review-checklist pages from the catalog would improve
  its usefulness as an entry point for agents.

## Evidence and limits

- Current preview returned HTTP 200.
- Inspected `tmp/collab/catalog-review-desktop.png`: five callouts, Mermaid,
  code blocks and tabs are visibly rendered in dark mode. The tall screenshot
  covers through the images section; not a full light/mobile interaction test.
- Read actual installed transforms and app component wiring; no external
  documentation assumptions required.
- Did not rerun the production build or mutate shared tracked files during review.
- No blocker against the overall design. These are focused corrections, not a
  request for another component framework or another documentation system.
