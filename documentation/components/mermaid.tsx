'use client';

// Local replacement for `Mermaid` from @open-agent-toolkit/docs-theme.
// The upstream component hardcodes `theme: 'dark' | 'default'`, so site
// colours never reach diagrams. This copy uses Mermaid's `base` theme with
// `themeVariables` derived from the same palette as app/globals.css. Delete
// this file and restore the upstream import in app/[[...slug]]/page.tsx once
// docs-theme accepts a Mermaid config prop.
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif';

const dark = {
  background: '#0d1117',
  mainBkg: '#1c232c',
  primaryColor: '#1c232c',
  primaryTextColor: '#d9e0e8',
  primaryBorderColor: '#2a323d',
  secondaryColor: '#161b22',
  secondaryTextColor: '#d9e0e8',
  secondaryBorderColor: '#2a323d',
  tertiaryColor: '#161b22',
  tertiaryTextColor: '#8b96a7',
  tertiaryBorderColor: '#2a323d',
  lineColor: '#7ddce0',
  textColor: '#d9e0e8',
  nodeBorder: '#2a323d',
  nodeTextColor: '#d9e0e8',
  clusterBkg: '#161b22',
  clusterBorder: '#2a323d',
  titleColor: '#8b96a7',
  edgeLabelBackground: '#0d1117',
  actorBkg: '#1c232c',
  actorBorder: '#7ddce0',
  actorTextColor: '#d9e0e8',
  actorLineColor: '#2a323d',
  signalColor: '#d9e0e8',
  signalTextColor: '#d9e0e8',
  labelBoxBkgColor: '#161b22',
  labelBoxBorderColor: '#2a323d',
  labelTextColor: '#d9e0e8',
  loopTextColor: '#8b96a7',
  noteBkgColor: '#161b22',
  noteBorderColor: '#f0b878',
  noteTextColor: '#d9e0e8',
  fontFamily,
};

const light = {
  background: '#fbfcfd',
  mainBkg: '#ffffff',
  primaryColor: '#ffffff',
  primaryTextColor: '#1c232c',
  primaryBorderColor: '#c9d1da',
  secondaryColor: '#f1f4f8',
  secondaryTextColor: '#1c232c',
  secondaryBorderColor: '#c9d1da',
  tertiaryColor: '#f1f4f8',
  tertiaryTextColor: '#5b6675',
  tertiaryBorderColor: '#c9d1da',
  lineColor: '#0b7076',
  textColor: '#1c232c',
  nodeBorder: '#c9d1da',
  nodeTextColor: '#1c232c',
  clusterBkg: '#f1f4f8',
  clusterBorder: '#c9d1da',
  titleColor: '#5b6675',
  edgeLabelBackground: '#fbfcfd',
  actorBkg: '#ffffff',
  actorBorder: '#0b7076',
  actorTextColor: '#1c232c',
  actorLineColor: '#c9d1da',
  signalColor: '#1c232c',
  signalTextColor: '#1c232c',
  labelBoxBkgColor: '#f1f4f8',
  labelBoxBorderColor: '#c9d1da',
  labelTextColor: '#1c232c',
  loopTextColor: '#5b6675',
  noteBkgColor: '#fff7ea',
  noteBorderColor: '#b9741f',
  noteTextColor: '#1c232c',
  fontFamily,
};

export function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: resolvedTheme === 'dark' ? dark : light,
        // Render at intrinsic size instead of shrinking to the column; the
        // container scrolls horizontally (see .mermaid in app/globals.css).
        flowchart: { useMaxWidth: false },
        sequence: { useMaxWidth: false },
        state: { useMaxWidth: false },
      });
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      const { svg: rendered } = await mermaid.render(id, chart);
      if (!cancelled) setSvg(rendered);
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart, resolvedTheme]);

  return (
    <div
      className="mermaid"
      role="region"
      aria-label="Diagram; scroll sideways if it is wider than the page"
      tabIndex={0}
      // oxlint-disable-next-line react/no-danger -- mermaid renders SVG from trusted chart definitions
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
