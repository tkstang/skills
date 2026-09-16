# Astra rendered diagram review — 2026-09-16

Reviewed the actual local app in isolated headless Chrome, at 1440px desktop and 390px phone widths, dark and light themes. These are rendered findings, not source-verification failures. Screenshots live beside this file.

## Required before final acceptance

1. **Keep diagrams readable at display size.** Architecture SVG viewBox width 830 renders at 324px on a phone (5–7px labels). The same failure affects Mermaid: readiness is 1832 units rendered at 836px; Session is 1557 units rendered at 358px. Use a readable minimum canvas inside a keyboard-accessible horizontal scroll region (without page-level overflow), with a visible scroll/expand affordance. Do not merely set min-width on the page itself.

2. **Simplify the oversized comparison chart.** Consensus's refine/panel/phone chart has a 5011-unit viewBox compressed to 836px (about 2.7px text). A 5000px horizontal scroll is not a good reader experience either. Shorten node labels, move detailed caveats into the adjacent prose, and use top-to-bottom columns or separate compact diagrams. Similarly the fork qualification chart is over 3300 units tall; its nodes currently carry whole explanatory paragraphs. Preserve the gate order but move explanations out of nodes. The source evidence can remain in the companion audit.

3. **Correct the trust boundary.** Verified `src/plugins/consensus/provider-cli/invocation.ts:77–88,149–170`: Claude gets prompt via argv; Codex/Cursor via stdin. Use `prompt payload`, qualify the split. Diagram describes a local provider-process boundary, not an enforced machine/network boundary. Files being stored locally does not mean selected contents cannot be sent to provider services, nor that child CLIs cannot read their working directory. Existing qualified plugin-only telemetry prose is accurate and can stay.

4. **Keep catalog copyable syntax equal to rendered example.** The SVG/Mermaid recipe currently shows a tiny 4-node Mermaid but the rendered pair below contains the full architecture diagram. Either use the same full source in both, or explicitly label the first as abbreviated and link to the complete copyable canonical source; the catalog's opening promise should remain true. Prefer the same source.

5. **Use alpha consistently.** Session chooser's fork node reintroduces `Experimental same-provider fork guidance`; use `Alpha same-provider fork guidance`, retaining concrete limitations in prose.

## Evidence / positives

- No page-level horizontal overflow observed in those renders (1440/390 matched document scrollWidth).
- The architecture SVG is readable on desktop, in light and dark themes.
- Readiness, fork, architecture's alternate Mermaid tab, Session, and Consensus comparison all compiled/rendered without browser exceptions.
- Native tab activation works; inactive Mermaid panels mount when selected.
- The smaller prose/nav typography and new audience groups look clear at desktop and phone widths.

Files: `distribution-dark-390.png`, `distribution-light-1440.png`, `readiness-dark-1440.png`, `fork-dark-1440.png`, `distribution-mermaid-dark-1440.png`, `session-light-390.png`. The trust screenshot was taken during active edits and is not evidence of a stable broken asset.
