# 11. Corrections, confirmed findings, and limitations

## Corrections to the earlier thread

**Your Codex debug path is less complete than the earlier broad description implied.** It emits normal function-call markers but ignores ordinary `function_call_output` except ask-user answers, and it has no custom-tool call/output branch. The activity work adds genuine coverage. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts)

**The right first step is not a new universal evidence platform.** Your request is well served by an opt-in activity view and shared deterministic extraction. Snapshotting and source references improve later retros, but a daemon, merged multi-agent log, and 17-provider implementation should not become prerequisites.

**The older continues parser overview is not the current implementation.** The inspected Gemini parser handles JSONL mutations and legacy JSON. Kiro handles IDE storage, ACP-style logs, and persisted envelopes, while its ordinary SQLite store remains unresolved. Crush has environment/project-index/cwd-ancestor discovery, not only a single global path. [C-GEMINI](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/gemini.ts) [C-KIRO](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/kiro.ts) [C-CRUSH](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/crush.ts) [C-AUDIT-APRIL](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/docs/parser-documentation/00-overview.md)

**A typed `SessionEvent` is not proof of complete event coverage.** Claude and Codex timeline construction is narrower than the shared interface permits. Copilot contains a more explicit tool timeline. [C-TYPES](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/index.ts) [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts) [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts) [C-COPILOT](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/copilot.ts)

**cxresume's native code is the source of truth over its tagline.** The reviewed flow resumes the original Codex ID rather than injecting a new compressed session. [X-MAIN](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/index.js) [X-PARSER](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/utils/parser.js)

## Source-confirmed implementation limitations

| Finding | Evidence | Consequence |
|---|---|---|
| Continues full preset is bounded | Configuration and adapter-local slices | Not a lossless export mode. |
| JSON dump writes session metadata | `dumpCommand` JSON branch | Cannot be used as a raw tool-trace exporter. |
| Shared result extraction takes first text block | Anthropic tool first pass | Later blocks omitted in that projection. |
| Head truncation precedes output-tail rendering | Shared tool first pass and shell branch | Tail may not be the actual end of original output. |
| Collector samples first-N with key-based limits | `SummaryCollector` | Late failures and category cap mismatches matter. |
| Diff display statistics can include truncation marker | Diff helpers and extraction call site | Display counts are not verified code-change metrics. |
| Claude predecessor selection uses cwd/time | Chained-history helper | Risk of attributing unrelated parallel work. |
| Observer record reader skips malformed/blank lines | `readRecords` | Logical indices and physical lines are not interchangeable. |
| ccrider Codex parser is conversation-oriented | Codex import switch | Indexed history is not a complete execution archive. |
| ccrider MCP output is budgeted | Response-trimming functions | One get call may not return all stored messages. |

Sources: [C-CONFIG](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/config/verbosity.ts) [C-DUMP](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/commands/dump.ts) [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts) [C-SUMMARIZER](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-summarizer.ts) [C-DIFF](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/diff.ts) [C-CLAUDE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts) [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) [R-CODEX](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/codexsessions/parser.go) [R-MCP](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/cmd/ccrider/mcp/server.go)

## Source-level edge cases, not live reproductions

The Codex user-retention tail branch can select a user prompt plus early following assistant messages while omitting the actual final answer. A fixed local handoff filename can be overwritten by concurrent same-cwd handoffs. An empty error result can fail to populate the shared result map. These follow from the code paths, but no real provider process or session corpus was executed to reproduce them here. [C-CODEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts) [C-RESUME](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/resume.ts) [C-TOOLS](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts)

## Reproducibility boundary

All four default-branch commits were re-read for this packet and match the earlier audit's snapshots. The packet includes their exact SHAs, pinned source links, and the field/schema evidence catalog. It does not establish the versions installed on your machines or which client formats are currently active there.

Full repository clones were unavailable in the execution environment, so source was inspected through the connected GitHub reader. Upstream build/test suites, native CLI launches, and provider format capture were not run. The packet's authored JSON examples, JSON Schema definitions, internal links, and archive were checked locally; see [the validation report](validation/REPORT.md).

## Before implementing

Capture small, sanitized fixtures from the Claude, Codex, and Cursor versions you actually use. Include at least a successful command, a failed command, a patch, an ask-user exchange, a large result, and a stopped/incomplete turn. Pin those fixtures to client versions and expected outcomes. That is the shortest path from this source-backed design to a reliable optional flag.
