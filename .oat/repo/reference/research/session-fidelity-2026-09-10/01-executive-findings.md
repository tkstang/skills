# 01. Executive findings

## Recommendation

Your proposed extension makes sense. There is no reason to rebuild a session-discovery system just to add tool context to an existing observer. The minimum useful change is an optional activity projection shared by your two skills, with deterministic extraction beneath it.

Use `cli-continues` as **reference implementation and selective code donor**, not as the authoritative storage model. Its tools are not summarized by another LLM: its code reads native data, joins calls/results, classifies operations, produces samples, and renders Markdown. The target agent reads that already-generated handoff. [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts) [C-SUMMARIZER](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-summarizer.ts) [C-MARKDOWN](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/markdown.ts) [C-RESUME](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/resume.ts)

## What it adds beyond your normal observer view

| Information | Useful addition | Qualification |
|---|---|---|
| Tool usage | Counts and representative command/file/search examples | Actual sample selection is frequently first-N, not intelligently representative. |
| Shell execution | Commands, recorded/parsed exit status, selected output, error evidence | Output tails and heuristically parsed exit codes are not authoritative process telemetry. |
| File operations | Read paths/ranges, edit replacement previews, patch input, files touched | An attempted write does not prove the filesystem changed. |
| MCP activity | Original tool identity where retained, argument/result excerpts | Some adapters truncate before rendering and some grouping changes names. |
| Subagents | Parent-visible requests, selected child final results, tool counts | Not an exhaustive child execution tree. |
| Session context | Model, recorded usage/cache fields, compaction material, lifecycle metadata | Provider-specific, incomplete, sometimes only retained internally rather than rendered. |
| Source navigation | Session path and selected provenance warnings | A path alone is weaker than a source event/block pointer. |

These capabilities come from the tool extractor, provider adapters, session-note types, and renderer. Support is not uniform across providers. [C-TYPES](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/index.ts) [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts) [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts) [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts) [C-MARKDOWN](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/markdown.ts)

## Three things to preserve from your implementation

**Identity and delivery semantics.** Exact session pins, project/worktree resolution, per-session catch-up positions, raw/rendered accounting, and Cursor continuity handling should remain in place. They are not replaced by the richer activity output. [S-OBSERVER-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/session-observer.md) [S-DIGEST](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/session-observer/lib/digest.ts)

**Human-decision handling.** Your ask-user handling is more deliberately modeled than a generic short `ask` sample. It preserves recorded answers, and it avoids claiming a recorded Codex timeout/default was necessarily a human decision. Do not replace this with `continues`' shorter ask summaries. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts)

**Default output.** The normal observer stays a low-noise peer-conversation view. The normal exporter stays sanitized conversation. Rich activity is explicitly requested; it is not silently turned on for existing callers. [S-OBSERVER](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/SKILL.md) [S-EXPORT-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/export-session-transcript.md)

## Corrections that affect the build

1. Your observer already has compact tool flags, but **Codex general tool results and custom tool calls are absent in the current normalizer**. Claude debug truncates inputs/results to 200/500 characters. Cursor's actual recorded surface and its separate v2 path impose additional limits. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts)
2. `continues --preset full` is still bounded. Its configuration includes 50 recent messages and a 200-event timeline window, and several adapter-local limits are smaller. [C-CONFIG](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/config/verbosity.ts) [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts)
3. `continues dump --json` serializes session metadata rather than a full trace. It is not a ready-made evidence-export endpoint. [C-DUMP](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/commands/dump.ts)
4. Some historical parser audits are out of date. Current inspected code supports Gemini JSONL replay, Kiro IDE/ACP/persisted envelopes, and broader Crush database discovery. Use implementation and specific fixtures as the baseline, not the April overview alone. [C-GEMINI](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/gemini.ts) [C-KIRO](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/kiro.ts) [C-CRUSH](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/crush.ts) [C-AUDIT-APRIL](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/docs/parser-documentation/00-overview.md)

## Minimum sufficient deliverable

Ship `--include-activity` on both skills, a dependency-free shared extraction/projection layer, faithful call/result IDs, structured tool data for JSON consumers, bounded Markdown rendering, and explicit source/truncation accounting. Add Codex function/custom result support. Keep Cursor output qualified when results are absent.

Defer a daemon, a cross-session event warehouse, an MCP server, all 17 provider implementations, automatic skill rewriting, and universal cost analytics. The provider schemas in this packet are reference material, not a commitment to implement all adapters now.

## Which external tool to adopt

For your mixed Claude/Codex workflow, `ccrider` is the best complementary history search/native-resume tool of these three. Its current registry does not include Cursor. Use `cli-continues` when deliberately moving context between providers. Use `cxresume` when the smaller Codex-only workspace registry is the specific feature you want. None should become the only record of tool execution for retrospective claims. [R-README](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/README.md) [R-PROVIDER](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/core/session/provider.go) [X-README](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/README.md) [C-RESUME](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/resume.ts)
