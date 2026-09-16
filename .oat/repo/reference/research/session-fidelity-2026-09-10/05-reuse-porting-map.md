# 05. Reuse and porting map

## Preferred approach: selective, attributed adaptation

Borrow the machinery that earns its cost. Your scripts currently ship with no third-party runtime dependencies; the whole `continues` package brings CLI-facing and configuration dependencies plus a broader registry. Its public export map does not expose every private helper as a stable subpath. A narrow local adaptation is a better fit than importing internal package files or shelling out to `dump`. [S-OBSERVER](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/SKILL.md) [S-EXPORT](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/export-session/export-session-transcript.ts) [C-PACKAGE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/package.json) [C-API](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/index.ts)

This is not a recommendation to rewrite every parser. Reuse the actual parsing cases, category knowledge, and display logic with small changes at the fidelity boundary.

## Source-to-destination map

All destinations below are **proposed** unless identified as existing.

| Source in cli-continues | What to take | What to change | Suggested home in your repo |
|---|---|---|---|
| `src/utils/tool-extraction.ts`: `extractAnthropicToolData` | Two-pass Anthropic call/result pairing; per-category input recognition | Preserve all result blocks, original name/ID, unknown status, locators, and full in-memory payload before view truncation | New `src/transcript/core/activity/anthropic.ts` |
| `src/parsers/codex.ts`: tool extraction passes | `call_id` map for function/custom outputs; custom patch and web-search branches | Keep exact namespace/name; handle malformed arguments; do not truncate at 100 chars or group by shell executable as identity | New `src/transcript/core/activity/codex.ts` |
| Tool-name vocabulary used by extractor and shared types | Tool categories and recognized aliases | Add stable category enum separate from exact original name; unknown tool is retained | New `src/transcript/core/activity/categories.ts` |
| `src/utils/tool-summarizer.ts`: helpers and collector pattern | Concise shell/file/search/MCP presentation; count aggregation | Use category enum for limits; recent/error-aware sampling; stable sample references; do not silently infer success | New `src/transcript/core/activity/summarize.ts` |
| `src/utils/diff.ts` | Dependency-free edit/write display and output tail helpers | Compute stats before truncation; represent omitted lines outside patch text; distinguish a display diff from source patch | New `src/transcript/core/activity/display.ts` |
| `src/parsers/claude.ts`: notes/sidecar handling | Recorded usage/cache fields, compact summary, explicitly linked child/result metadata | Do not use same-cwd predecessor guessing; report unavailable sidecars; keep counters source-specific | New `src/transcript/core/activity/claude-notes.ts` after core tools |
| `src/utils/markdown.ts` | Section organization and category rendering ideas | Remove continuation directives; preserve chronological view and exact references; budget only at rendering | Observer/export-owned renderers or shared pure formatter |
| `src/types/index.ts` | Structured tool sample categories and session-note vocabulary | Minimize fields to actual v1 use; make status/provenance explicit; avoid copying unused universal types | New `src/transcript/core/activity/types.ts` |

Implementation references: [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts) [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts) [C-SUMMARIZER](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-summarizer.ts) [C-DIFF](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/diff.ts) [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts) [C-MARKDOWN](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/markdown.ts) [C-TYPES](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/index.ts)

## Reuse your own code first where it is stronger

Keep your session locating and identity resolution, source runtime names, state files, ask-user parsing, automatic-control provenance, command-message filtering, and Cursor frame/lifecycle logic. The new activity extractor should consume those decisions, not independently guess a session or reinterpret a typed human answer. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [S-OBSERVER-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/session-observer.md)

For Claude, your normalizer already joins **all text blocks** of a tool result when rendering a compact result. Do not regress that into continues' first-text-block behavior during the port. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts)

## Reuse options and tradeoffs

**Wrap the public continues API.** Fastest proof of concept for discovery or a separate handoff overview. However, `extractContext` has already applied lossy policies; `dump --json` is metadata-only; private helper imports are not a supported package boundary. This cannot supply complete native tool results without bypassing extraction. [C-API](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/index.ts) [C-DUMP](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/commands/dump.ts) [C-PACKAGE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/package.json)

**Adapt selected helpers into the shared transcript source. Recommended.** Small, dependency-free runtime footprint; keeps existing script distribution; lets you fix loss and status semantics exactly where needed. The cost is tracking an explicitly documented upstream origin for those helpers.

**Upstream a separate evidence/extraction API.** Worth considering after the local design is proven. It would require separating native parsing from policy, returning correlated events and coverage, and exposing a stable public module. Do not make upstream acceptance a prerequisite for the optional flag.

**Fork the whole product. Not recommended for this task.** You would inherit provider discovery, launch mappings, UI, caching, and stale-client issues unrelated to observing your three runtimes.

## A practical port sequence

Start with structured native tool calls/results and small enrichment helpers. Port the category vocabulary and display formatting second. Add session notes and explicit Claude sidecar summaries third. Only add new provider adapters when a real workflow needs them; use the provider catalog as the map.

During the first port, retain generic unknown payloads behind source references. That prevents every newly named MCP tool from requiring another parser branch. Provider-specific interpretation is necessary for call/result envelopes; a bespoke classifier for every tool is not.

## Attribution and provenance

The pinned continues license is MIT and carries `Copyright (c) 2025-2026 Yigit Konur`. Preserve its notice with any copied substantial code, record the source commit and original paths, and annotate local changes. The packet includes the license text for the contemplated reuse. This packet itself does not vendor the full upstream implementation. [C-LICENSE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/LICENSE)

A useful header in an adapted file is:

```ts
// Adapted from yigitkonur/cli-continues, commit e486cd22a592d89d890cff056624647fbe9cbe80.
// Original: src/utils/tool-extraction.ts. MIT notice: see THIRD_PARTY_NOTICES.
// Local changes: full block retention, exact call IDs, source locators,
// tri-state outcomes, and renderer-only truncation.
```

Record what was actually copied rather than adding this header indiscriminately to entirely new code.
