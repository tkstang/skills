# Session fidelity transcript fixtures

These small JSONL slices preserve native record structure observed in local transcript
stores on 2026-09-19. They are test evidence, not provider specifications and not whole
sessions. The repository's dated structure-only inventory remains the broader evidence
source at `.oat/repo/reference/research/session-schemas-2026-09-18/`.

| Runtime | Fixture | Observed client version | Covered record classes |
| --- | --- | --- | --- |
| Claude Code | `claude-code/captured-activity.jsonl` | 2.1.278 | Multiblock assistant tool calls, string/array/object result carriers, explicit error evidence, persisted-output reference, and `origin.kind: task-notification` |
| Codex | `codex/captured-activity.jsonl` | 0.154.0 | Child and inherited headers, function/custom calls and outputs, turn context, failed command/MCP items, web search, subagent activity, and compaction |
| Cursor | `cursor/captured-activity.jsonl` | unknown | Text plus parallel tool calls, object and string inputs, MCP wrapper, subagent call, and terminal error |

## Capture and obscuring

The slices were selected by native record class from the approved local Claude Code,
Codex, and Cursor stores. Raw sessions and intermediate slices were not copied into this
repository. Every message, command, result, patch, query, path, session/call/message id,
agent name, and other private identifier was replaced with a fixture value while keeping
joins internally consistent. Claude account, email, cwd, branch, and API identifiers were
removed or remapped. Codex instruction and reasoning bodies, Git metadata, workspace
roots, token/account data, and encrypted content were omitted; the retained cwd is a
fixture-only path. Cursor records no client version, so its version is explicitly
`unknown`. No sidecar file was read.

The Codex capture deliberately places inherited parent activity before
`subagent_history_start_ordinal: 5` and child-owned activity at or after that boundary.
Tests must count the latter as child activity and keep the earlier calls only as inherited
context. The non-rollout fixture filename avoids implying a native filename/session-id
binding after identifier remapping.

The older files under `codex/rollout-*.jsonl` are authored identity fixtures documented
in `codex/README.md`; they are synthetic rather than captured activity evidence.
