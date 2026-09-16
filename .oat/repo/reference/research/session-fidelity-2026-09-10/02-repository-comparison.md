# 02. Repository comparison

## Four repositories, different jobs

| Repository | Primary job | Data/interaction model | Best fit |
|---|---|---|---|
| `yigitkonur/cli-continues` | Discover sessions and continue work across tools | Provider adapters, metadata cache, deterministic context extraction, Markdown handoff, native/cross-tool launch | Cross-provider handoff and extraction patterns to borrow. |
| `neilberkman/ccrider` | Search, browse, and resume history | SQLite FTS5, Go importers, TUI, CLI, read-oriented MCP | Finding old work and reopening a native session. |
| `lingtaolf/cxresume` | Quickly reopen Codex sessions | Local file discovery, conversation preview, workspace ID file, native launch | Lightweight Codex/worktree picker. |
| `tkstang/skills` transcript subsystem | Observe peers or export a conversation | Shared TypeScript core, generated dependency-free scripts, identity/offset tracking, Cursor frame semantics | Existing integration point for your new activity view. |

Evidence: [C-API](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/index.ts) [C-INDEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/index.ts) [C-RESUME](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/resume.ts) [R-README](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/README.md) [X-README](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/README.md) [S-BUILD](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/scripts/build-generated.mjs) [S-OBSERVER-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/session-observer.md)

## cli-continues

The package exposes a genuine TypeScript API, including `getAllSessions`, `getSessionsBySource`, `findSession`, `extractContext`, `adapters`, and resume helpers. The public package is ESM and declares Node >=22.5. Its private helper files are not separately listed in the package export map, so importing arbitrary internal utilities is not the same as using a supported public API. [C-API](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/index.ts) [C-PACKAGE](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/package.json)

`UnifiedSession` is discovery metadata: ID, provider, cwd, optional repo/branch/SHA/model, dates, summary, size/count, and original source path. `SessionContext` is the richer but bounded handoff representation. The distinction matters for both `list --json` and `dump --json`. [C-TYPES](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/types/index.ts) [C-DUMP](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/commands/dump.ts)

The cache is JSONL metadata under `~/.continues`, not a full-text database. Its five-minute TTL and environment fingerprint reduce repeated scans. Global indexing tolerates rejected adapters by collecting fulfilled results, which is user-friendly for a picker but needs stronger coverage reporting for automated audits. Prefix lookup chooses a first match; use provider plus exact ID in automation. [C-INDEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/index.ts)

## ccrider

The current provider registry includes Claude, Codex, Copilot, OpenCode, Pi, Antigravity CLI, and Amp. It has native resume/fork builders, project-aware launch paths, and process-liveness integration. MCP tools include search, recent sessions, message retrieval, open sessions, and session anchors. [R-PROVIDER](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/core/session/provider.go) [R-MCP](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/cmd/ccrider/mcp/server.go)

Its persistent index is valuable, but index fidelity differs by importer. The Codex parser keeps conversation messages, not general function-call records. Claude keeps selected raw `message` objects alongside extracted text, not an untouched copy of every complete JSONL record and companion artifact. A `tool_uses` table in the schema must not be mistaken for proof that all providers populate a complete call/result graph. [R-CODEX](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/codexsessions/parser.go) [R-CLAUDE](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/ccsessions/parser.go) [R-DB](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/core/db/schema.go)

MCP message retrieval exposes text/type/timestamp/sequence, with a response budget. It is useful targeted recall, not a lossless event API. Large results are explicitly trimmed. [R-MCP](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/cmd/ccrider/mcp/server.go)

## cxresume

The modern parser reads Codex `event_msg` user/agent messages for preview and launches the native session ID. It does not rebuild the session from its preview. The repository's GitHub tagline mentioning compressed context/injection is not the behavior of the inspected native-resume code. [X-PARSER](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/utils/parser.js) [X-MAIN](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/index.js)

`cxresume cwd` tracks IDs in `.cxresume_sessions`; `cxresume .` is a cwd-based filter rather than that explicit registry. The latest-workspace shortcut uses the last recorded ID in the registry, which is different from sorting all matching sessions by latest activity. The TUI also has a confirmed permanent delete action, so this tool should not be your sole archive. [X-README](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/README.md) [X-MAIN](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/index.js)

## Your transcript scripts

Your source is TypeScript; the distributed `.mjs` copies are generated. The shared core is built into both standalone skills. This is already the right reuse boundary: extend the canonical source and generation mapping, not two divergent copies of the shipped scripts. [S-BUILD](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/scripts/build-generated.mjs) [S-PACKAGE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/package.json)

The observer solves identity, peer selection, catch-up, watch control, and lifecycle-aware presentation. The exporter solves current-session selection and sanitized publishing. Neither contract needs to be thrown out to add activity. [S-OBSERVER-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/session-observer.md) [S-EXPORT-GUIDE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/documentation/docs/user-guide/skills/export-session-transcript.md)

## Selection rule

Choose by operation, not by the largest feature list: **observe** with your observer; **publish conversation** with your exporter; **search history** with ccrider; **change provider** with continues; **pick a Codex workspace session** with cxresume. Treat richer evidence retrieval as a capability of the shared transcript core rather than a replacement UI for every tool.
