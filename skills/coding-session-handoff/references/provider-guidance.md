# Provider guidance evidence

This guidance is based on official public documentation and provider-owned source
retrieved 2026-09-12. No provider executable was run. A documented command remains
unverified in this repository and may differ from the installed version.

| Surface         | Fork guidance                                                                     | Fresh destination session                                                                  |
| --------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Codex CLI       | Guarded `codex fork SESSION_ID` from the destination worktree                     | Exit and run the guarded terminal command; `/fork` applies only to the currently open chat |
| Claude Code CLI | Guarded `claude --resume SESSION_ID --fork-session` from the destination worktree | Exit and run the guarded terminal command; no arbitrary-session switch is documented       |
| Cursor CLI      | Unsupported: official CLI docs describe resume, not fork                          | No command is emitted                                                                      |
| Cursor IDE      | **Duplicate Chat** is documented as a manual fork                                 | Destination-worktree placement and IDE/CLI identity interoperability are unsupported       |

Fork preserves the original and creates separate history. Resume continues an
existing identity, so it is never used as fallback for an unavailable fork.

Sources:

- <https://code.claude.com/docs/en/cli-usage>
- <https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs>
- <https://github.com/openai/codex/blob/main/codex-rs/tui/tooltips.txt>
- <https://docs.cursor.com/en/cli/overview>
- <https://docs.cursor.com/en/agent/chat/duplicate>
- <https://docs.cursor.com/en/agent/chat/history>

The old automated executor and its behavior contracts are separate, incomplete,
unverified, and paused. Synthetic guidance tests do not activate or validate them.
