import type { ComponentProps } from 'react';

import defaultComponents from 'fumadocs-ui/mdx';

// Static export under a base path (production deploys to /skills) does not
// rewrite root-relative Markdown image sources: `![](/diagrams/x.svg)` is
// emitted verbatim and 404s on GitHub Pages. next/link prefixes links, but
// next/image does not prefix `src`, and it also demands width/height for
// string sources. This wrapper handles the string-src case with a plain
// <img>, prefixed with NEXT_PUBLIC_BASE_PATH, so authors keep writing
// `/diagrams/<name>.svg` (see docs/engineering/contributing/documentation/markdown-features.md).
// Imported/relative images still go through the Fumadocs default.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const BaseImage = defaultComponents.img;

export function Image(props: ComponentProps<typeof BaseImage>) {
  const { src, alt, ...rest } = props;
  if (typeof src !== 'string') {
    return <BaseImage {...props} />;
  }
  const prefixed =
    basePath && src.startsWith('/') && !src.startsWith(`${basePath}/`) ? `${basePath}${src}` : src;
  // oxlint-disable-next-line nextjs/no-img-element -- static export with unoptimized images; plain img avoids next/image's width requirement for root-relative assets
  return <img {...(rest as ComponentProps<'img'>)} src={prefixed} alt={alt ?? ''} loading="lazy" className="rounded-lg" />;
}
