# Guidance capability evidence

Retrieved 2026-09-12 from official public documentation or provider-owned source. No
provider executable was invoked. “Documented” means the cited syntax or UI behavior is
described by that source; it does not mean this project has live-tested the behavior.

| Provider surface | Interactive launch | Resume                     | Fork                                | In-provider fork                  | Destination switch                            | Cross-worktree evidence  |
| ---------------- | ------------------ | -------------------------- | ----------------------------------- | --------------------------------- | --------------------------------------------- | ------------------------ |
| Claude Code CLI  | `claude`           | `claude --resume ID`       | `claude --resume ID --fork-session` | Not documented                    | Not documented                                | Unverified               |
| Codex CLI        | `codex`            | `codex resume ID`          | `codex fork ID`                     | `/fork` branches the current chat | No arbitrary-session switch documented        | Unverified               |
| Cursor CLI       | `cursor-agent`     | `cursor-agent --resume=ID` | Not documented                      | Not documented                    | Not documented                                | Unsupported for guidance |
| Cursor IDE       | Manual Agent UI    | Open from chat history     | Manual **Duplicate Chat**           | Manual **Duplicate Chat**         | No destination-tab/worktree switch documented | Unsupported for guidance |

Fork and resume are different operations. Resume continues the selected identity;
fork creates separate history and preserves the original. Guidance must never replace
an unavailable fork with resume.

## Sources and limits

- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-usage) — public
  reference for interactive launch, `--resume`, and `--fork-session`. The syntax is
  documented, while cross-worktree and ADE behavior remains unverified here.
- [Codex CLI source](https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs)
  and [Codex TUI tooltips](https://github.com/openai/codex/blob/main/codex-rs/tui/tooltips.txt)
  — provider-owned source for `fork`, explicit session selection, and `/fork` on the
  current chat. This is dated main-branch evidence, not an installed-version probe.
- [Cursor CLI overview](https://docs.cursor.com/en/cli/overview) — documents interactive
  launch and resume. It does not document a CLI fork, so none is emitted.
- [Cursor Duplicate Chat](https://docs.cursor.com/en/agent/chat/duplicate) and
  [Cursor chat history](https://docs.cursor.com/en/agent/chat/history) — document manual
  IDE duplication and history opening. They do not establish CLI identity compatibility,
  cross-worktree placement, or switching an existing destination chat.

The old automated executor’s exact-version behavior matrix is separate. This guidance
matrix neither changes nor verifies it.
