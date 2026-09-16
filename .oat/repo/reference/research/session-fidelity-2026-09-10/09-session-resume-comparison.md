# 09. Resuming sessions: continues, ccrider, and cxresume

## Native resume versus handoff

A native resume asks a provider to reopen its original session. A cross-provider handoff starts a new session with selected context. The lossy preview shown by a picker does not necessarily limit native resume, because the original CLI reopens its own store. [C-RESUME](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/resume.ts) [R-PROVIDER](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/core/session/provider.go) [X-MAIN](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/index.js)

| Capability | cli-continues | ccrider | cxresume |
|---|---|---|---|
| Main strength | Broad discovery and cross-provider context transfer | Indexed history search, browsing, native resume | Small Codex workspace picker |
| Providers in inspected registry | 16, with uneven operation support | 7, including Pi; no Cursor | Codex |
| Claude/Codex native resume | Yes | Yes | Codex only |
| Native fork abstraction | Not comparable to ccrider in inspected contract | Claude, Codex, OpenCode, Pi | Not a documented feature |
| Full-text indexed recall | Metadata cache, not FTS history | SQLite FTS5 and MCP | File-content search |
| Workspace tracking | cwd metadata/filtering | Project-aware indexed history | Explicit `.cxresume_sessions` registry |
| Cross-provider handoff | First-class | Not the reviewed native-resume workflow | No |
| Missing-source recovery | Source/context dependent | Explicit Claude new-session recovery using cached history | Native source dependent |

Evidence: [C-REGISTRY](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/registry.ts) [C-INDEX](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/index.ts) [R-PROVIDER](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/core/session/provider.go) [R-README](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/README.md) [R-TUI](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/interface/cli/tui.go) [X-README](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/README.md)

## cli-continues

For Claude and Codex, the registry constructs `claude --resume <id>` and `codex resume <id>`. It also launches Cursor's agent CLI with a selected ID. Other adapters are less exact: Gemini's inspected mapping invokes `--resume` without the selected ID, and several editor mappings simply open the editor. A registered provider is not a guarantee of exact selected-session continuation. [C-REGISTRY](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/registry.ts)

Cross-tool mode extracts Markdown, writes `.continues-handoff.md` into the cwd, saves a global copy, and injects inline context or a file reference. The receiving tool's skills, instructions, credentials, tool set, and context policy are not automatically transferred as native runtime state. [C-RESUME](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/resume.ts)

The fixed local filename is a concurrency consideration when two handoffs use the same worktree. Also, the Codex cross-tool initialization path supplies reasoning-related defaults unless overridden. The behavior is more than a provider-neutral file opener. [C-RESUME](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/resume.ts)

**Recommendation:** Use it for an explicit change of provider, inspect the handoff when the task is sensitive, and avoid assuming its summary is a complete execution archive.

## ccrider

The current provider builders support native resume, several native fork commands, and per-provider configured flags. The TUI can launch in the appropriate working directory and includes a Claude-specific recovery path when the original file is missing. That recovery creates a new session and points it to retained history through MCP; it is not restoration of lost native state. [R-PROVIDER](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/core/session/provider.go) [R-TUI](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/interface/cli/tui.go)

The MCP server includes `search_sessions`, `list_recent_sessions`, `get_session_messages`, `list_open_sessions`, and `generate_session_anchor`. Search and retrieval can include prepared resume commands and liveness hints. Process detection is advisory, not proof that launching another session is safe or that the current process is idle. [R-MCP](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/cmd/ccrider/mcp/server.go)

Message retrieval targets an approximately 36,000-byte serialized response budget based on a 9,000-token estimate. It trims messages to fit, reports ranges/truncation, and can return an empty truncated result for oversized remaining messages. Targeted `last_n` or `around_sequence` queries are better than treating a single response as the whole history. [R-MCP](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/cmd/ccrider/mcp/server.go)

Its index is still not full execution evidence: Codex tool-call/result items are not imported as conversation; Claude raw retention is narrower than a complete source/sidecar archive. Preserve native files separately for both resume and forensic review. [R-CODEX](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/codexsessions/parser.go) [R-CLAUDE](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/ccsessions/parser.go)

Amp is a special acquisition path: ccrider's documented integration is opt-in and uses authenticated CLI exports during sync, then serves cached data to MCP. Continues' inspected Amp adapter instead reads local thread JSON. Do not assume those paths have equivalent availability or coverage. [R-README](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/README.md) [R-AMP](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/pkg/ampsessions/amp.go) [C-AMP](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/amp.ts)

**Recommendation:** The most useful everyday complement for your Claude/Codex history among the three, especially when you need indexed recall and native forks.

## cxresume

Its modern parser builds previews from `event_msg` entries whose payload type is `user_message` or `agent_message`. Tool activity is not part of that preview. It still launches `codex resume <sessionId>`, so preview loss is not a new compressed-session format. [X-PARSER](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/utils/parser.js) [X-MAIN](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/index.js)

`cxresume cwd` uses `.cxresume_sessions` as a workspace registry. The latest shortcut reads the last stored ID. `cxresume .` instead filters by recorded cwd and can widen when nothing matches, so an automation should not assume it is a strict identity pin. The TUI's delete operation removes the original log after confirmation. [X-MAIN](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/index.js) [X-README](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/README.md)

The launcher uses a shell command string, while continues' ordinary Unix launch uses an argument array. That is an integration consideration for untrusted paths/arguments, not a claim of an exploited vulnerability. [X-LAUNCH](https://github.com/lingtaolf/cxresume/blob/71225c58f1420f73f3c98f9cd44f1fa4ba690b67/src/utils/launch.js) [C-RESUME](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/utils/resume.ts)

**Recommendation:** Choose it for the smaller Codex-only workspace registry, not for multi-provider history analysis or full tool evidence.

## For your worktree-heavy workflow

Prefer exact provider/session identity and the recorded project directory. Keep a distinction between opening a second process on an existing session, forking that session, and handing selected context to a new provider. None of these actions inherently reconstructs missing working-tree files or guarantees the codebase is at the revision used in the old conversation.
