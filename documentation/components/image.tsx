import defaultComponents from 'fumadocs-ui/mdx';
import type { ComponentProps } from 'react';

// Static export under a base path (production deploys to /skills) does not
// rewrite root-relative Markdown image sources: `![](/diagrams/x.svg)` is
// emitted verbatim and 404s on GitHub Pages. next/link prefixes links, but
// next/image does not prefix `src`, and it also demands width/height for
// string sources. This wrapper renders every string `src` as a plain <img>,
// prefixed with NEXT_PUBLIC_BASE_PATH, so authors keep writing
// `/diagrams/<name>.svg` (see docs/engineering/contributing/documentation/markdown-features.md).
// Non-string (imported) sources still go through the Fumadocs default.
//
// Diagram assets additionally get a horizontally scrollable wrapper so that on
// narrow screens the SVG keeps a readable minimum width instead of shrinking
// to the viewport; the rules live in app/globals.css under `.diagram-scroll`.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const BaseImage = defaultComponents.img;

export function Image(props: ComponentProps<typeof BaseImage>) {
  const { src, alt, ...rest } = props;
  if (typeof src !== 'string') {
    return <BaseImage {...props} />;
  }
  const prefixed =
    basePath && src.startsWith('/') && !src.startsWith(`${basePath}/`)
      ? `${basePath}${src}`
      : src;
  const isDiagram = src.includes('/diagrams/');
  // oxlint-disable-next-line nextjs/no-img-element -- static export with unoptimized images; plain img avoids next/image's width requirement for root-relative assets
  const img = (
    <img
      {...(rest as ComponentProps<'img'>)}
      src={prefixed}
      alt={alt ?? ''}
      loading="lazy"
      className="rounded-lg"
    />
  );
  if (!isDiagram) return img;
  // Markdown images sit inside a <p>, so the wrapper must be phrasing content;
  // app/globals.css turns these spans into block-level scroll regions.
  return (
    <span
      className="diagram-scroll"
      role="region"
      aria-label={alt ?? 'Diagram'}
      tabIndex={0}
    >
      {img}
      <span className="diagram-hint">
        Scroll sideways to see the whole diagram.
      </span>
    </span>
  );
}
