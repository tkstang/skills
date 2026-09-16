# Sources and reproducibility

**Research snapshot: September 10, 2026.** Source and documentation audit of the pinned revisions below. Exact default-branch refs were checked through the connected GitHub reader. No user session corpus, provider process, or upstream test suite was executed.

## Repository snapshots

| Repository | Ref | Commit |
|---|---|---|
| `yigitkonur/cli-continues` | `main` | `e486cd22a592d89d890cff056624647fbe9cbe80` |
| `tkstang/skills` | `main` | `f5395a3568fd1b605501f550ea6ad78ee2f773ad` |
| `neilberkman/ccrider` | `main` | `6f384a6343998cb6e8354ed9fffd6b1f6ecdc025` |
| `lingtaolf/cxresume` | `master` | `71225c58f1420f73f3c98f9cd44f1fa4ba690b67` |

## Evidence rules

Implementation facts are linked to source files at the pinned commit. Declared interfaces explain the subset an adapter understands; they are not automatically complete vendor specifications. Older research notes are secondary to the inspected implementation. Recommendations and new contracts are explicitly proposed. Field meanings that cannot be established are marked opaque or version-dependent.

Code was retrieved through the connected GitHub reader. Repository archives/clones were unavailable in the execution environment, so the audit inspected the relevant source paths and functions directly. Source links identify the complete upstream file for follow-up; the packet does not claim every line in every repository was reviewed.

## Source file index

| Key | Pinned implementation or documentation |
|---|---|
| `C-README` | [yigitkonur/cli-continues / README.md](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/README.md) |
| `C-PACKAGE` | [yigitkonur/cli-continues / package.json](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/package.json) |
| `C-API` | [yigitkonur/cli-continues / src/index.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/index.ts) |
| `C-INDEX` | [yigitkonur/cli-continues / src/utils/index.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/index.ts) |
| `C-TYPES` | [yigitkonur/cli-continues / src/types/index.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/index.ts) |
| `C-SCHEMAS` | [yigitkonur/cli-continues / src/types/schemas.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/schemas.ts) |
| `C-CONFIG` | [yigitkonur/cli-continues / src/config/verbosity.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/config/verbosity.ts) |
| `C-TOOLS` | [yigitkonur/cli-continues / src/utils/tool-extraction.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-extraction.ts) |
| `C-SUMMARIZER` | [yigitkonur/cli-continues / src/utils/tool-summarizer.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/tool-summarizer.ts) |
| `C-DIFF` | [yigitkonur/cli-continues / src/utils/diff.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/diff.ts) |
| `C-MARKDOWN` | [yigitkonur/cli-continues / src/utils/markdown.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/markdown.ts) |
| `C-RESUME` | [yigitkonur/cli-continues / src/utils/resume.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/resume.ts) |
| `C-REGISTRY` | [yigitkonur/cli-continues / src/parsers/registry.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/registry.ts) |
| `C-DUMP` | [yigitkonur/cli-continues / src/commands/dump.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/commands/dump.ts) |
| `C-INSPECT` | [yigitkonur/cli-continues / src/commands/inspect.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/commands/inspect.ts) |
| `C-CLI` | [yigitkonur/cli-continues / src/cli.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/cli.ts) |
| `C-CLAUDE` | [yigitkonur/cli-continues / src/parsers/claude.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/claude.ts) |
| `C-CODEX` | [yigitkonur/cli-continues / src/parsers/codex.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/codex.ts) |
| `C-CURSOR` | [yigitkonur/cli-continues / src/parsers/cursor.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/cursor.ts) |
| `C-COPILOT` | [yigitkonur/cli-continues / src/parsers/copilot.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/copilot.ts) |
| `C-GEMINI` | [yigitkonur/cli-continues / src/parsers/gemini.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/gemini.ts) |
| `C-OPENCODE` | [yigitkonur/cli-continues / src/parsers/opencode.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/opencode.ts) |
| `C-AMP` | [yigitkonur/cli-continues / src/parsers/amp.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/amp.ts) |
| `C-KIRO` | [yigitkonur/cli-continues / src/parsers/kiro.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/kiro.ts) |
| `C-CRUSH` | [yigitkonur/cli-continues / src/parsers/crush.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/crush.ts) |
| `C-CLINE` | [yigitkonur/cli-continues / src/parsers/cline.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/cline.ts) |
| `C-KIMI` | [yigitkonur/cli-continues / src/parsers/kimi.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/kimi.ts) |
| `C-QWEN` | [yigitkonur/cli-continues / src/parsers/qwen-code.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/qwen-code.ts) |
| `C-ANTIGRAVITY` | [yigitkonur/cli-continues / src/parsers/antigravity.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/antigravity.ts) |
| `C-AUDIT-APRIL` | [yigitkonur/cli-continues / docs/parser-documentation/00-overview.md](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/docs/parser-documentation/00-overview.md) |
| `C-FIX-AUDIT` | [yigitkonur/cli-continues / agent-docs/2026-04-27-p1-parser-debug-audit.md](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/agent-docs/2026-04-27-p1-parser-debug-audit.md) |
| `C-LICENSE` | [yigitkonur/cli-continues / LICENSE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/LICENSE) |
| `S-CORE` | [tkstang/skills / src/transcript/core/runtimes.ts](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts) |
| `S-OBSERVER` | [tkstang/skills / skills/session-observer/SKILL.md](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/SKILL.md) |
| `S-OBSERVER-GUIDE` | [tkstang/skills / documentation/docs/user-guide/skills/session-observer.md](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/session-observer.md) |
| `S-DIGEST` | [tkstang/skills / src/transcript/session-observer/lib/digest.ts](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/session-observer/lib/digest.ts) |
| `S-EXPORT` | [tkstang/skills / src/transcript/export-session/export-session-transcript.ts](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/export-session/export-session-transcript.ts) |
| `S-EXPORT-GUIDE` | [tkstang/skills / documentation/docs/user-guide/skills/export-session-transcript.md](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/export-session-transcript.md) |
| `S-FORMATS` | [tkstang/skills / skills/session-observer/references/transcript-formats.md](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/skills/session-observer/references/transcript-formats.md) |
| `S-BUILD` | [tkstang/skills / scripts/build-generated.mjs](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/scripts/build-generated.mjs) |
| `S-PACKAGE` | [tkstang/skills / package.json](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/package.json) |
| `S-BACKLOG` | [tkstang/skills / .oat/repo/pjm/backlog/items/BL-260619-shared-session-log-substrate.md](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/.oat/repo/pjm/backlog/items/BL-260619-shared-session-log-substrate.md) |
| `R-README` | [neilberkman/ccrider / README.md](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/README.md) |
| `R-PROVIDER` | [neilberkman/ccrider / internal/core/session/provider.go](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/core/session/provider.go) |
| `R-MCP` | [neilberkman/ccrider / cmd/ccrider/mcp/server.go](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/cmd/ccrider/mcp/server.go) |
| `R-TUI` | [neilberkman/ccrider / internal/interface/cli/tui.go](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/interface/cli/tui.go) |
| `R-CLAUDE` | [neilberkman/ccrider / pkg/ccsessions/parser.go](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/ccsessions/parser.go) |
| `R-CODEX` | [neilberkman/ccrider / pkg/codexsessions/parser.go](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/codexsessions/parser.go) |
| `R-PI` | [neilberkman/ccrider / pkg/pisessions/parser.go](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/pisessions/parser.go) |
| `R-ANTIGRAVITY` | [neilberkman/ccrider / pkg/antigravitysessions/parser.go](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/antigravitysessions/parser.go) |
| `R-AMP` | [neilberkman/ccrider / pkg/ampsessions/amp.go](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/ampsessions/amp.go) |
| `R-DB` | [neilberkman/ccrider / internal/core/db/schema.go](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/core/db/schema.go) |
| `X-README` | [lingtaolf/cxresume / README.md](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/README.md) |
| `X-PARSER` | [lingtaolf/cxresume / src/utils/parser.js](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/utils/parser.js) |
| `X-MAIN` | [lingtaolf/cxresume / src/index.js](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/index.js) |
| `X-LAUNCH` | [lingtaolf/cxresume / src/utils/launch.js](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/utils/launch.js) |
| `C-DROID` | [yigitkonur/cli-continues / src/parsers/droid.ts](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/droid.ts) |

## Attribution and reuse

The packet is an authored research/design reference, not a vendored copy of the upstream project. The TypeScript contract, schemas, and examples are new proposal/reference artifacts. Where an implementation later copies or substantially adapts continues code, retain its MIT copyright/permission notice, pin the origin commit/path, and describe local changes. Do not apply an upstream-origin header to unrelated newly authored code.

[Pinned upstream MIT notice](cli-continues-LICENSE.txt) · [Machine-readable evidence catalog](evidence.json) · [Provider coverage](provider-coverage.json)

## Verification boundaries

The local report distinguishes artifact checks from unperformed live tests. Passing synthetic examples validates the consistency of this packet, not production provider compatibility. Before implementing, capture sanitized fixtures from the exact clients used on your machines and retain their version and source surface.

[Validation report](../validation/REPORT.md) · [Packet index](../README.md)
