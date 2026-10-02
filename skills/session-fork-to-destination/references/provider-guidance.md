# Provider guidance evidence

This guidance is based on official public documentation and provider-owned source
retrieved 2026-09-12. These original capability rows describe documentation evidence; the separate
import experiment below records later executable checks. Commands may differ from
the installed version.

Codex and Claude Code transcript discovery can associate candidates with an exact
source worktree. Current Cursor transcript discovery is unavailable because its store
layout does not provide independent exact cwd evidence. A matching Cursor store
returns a path-free `discovery-incomplete` result; no Cursor candidate can be selected
or previewed. The Cursor capability rows below are future-facing evidence and do not
imply that a candidate is currently available.

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

## Import limits and evidence

Cross-provider `import` reconstructs a Claude or Codex CLI seed in an existing,
canonical destination worktree. The user subsequently runs the returned native fork
command there. The seed is not a provider-native child of the source; only the later
fork creates target-provider native lineage.

First-release limits:

- Inactive, completed CLI sources only; no live `source-current` import, Cursor,
  same-worktree import, worktree creation, file transfer, or desktop registration.
- Conventional source homes only. Target homes may be explicit, environment-selected,
  or default. The printed command preserves that routing; default routing requires
  the target-home variable to remain unset.
- Target provider homes must sit outside both selected worktrees, so importing a
  seed cannot itself invalidate the reviewed Git state.
- Raw input/output at most 32 MiB, 100,000 source records, and 4 MiB per raw line.
  Oversized embedded media can therefore refuse before placeholder conversion.
- Preserve supported text and matched completed function/custom tool exchanges.
  Tool IDs and names use the conservative supported ASCII letters/digits/underscore/
  hyphen profile, 1–128 characters. Incompatible identifiers refuse; they are not renamed.
- Omit reasoning and recognized provider runtime envelopes; show omission counts.
  Media becomes placeholders. This is not sanitization of raw text or tool results.
- Follow the active Claude parent chain and supported Codex replacement history.
  Refuse unresolved tool calls, rollback, ambiguous context, unknown active structures,
  queued Claude input, Claude attachment records, and Codex summary-only or opaque compaction. The source must
  end in a completed assistant reply, not a synthetic error or interruption row.
- Claude destination project keys longer than 200 characters refuse. Store descendant
  symlinks and overwrites refuse. Existing exact seed bytes are reusable; changed or
  archived seeds are preserved and refused. Failed apply may leave empty store
  directories; only owned staging files are removed.

Completion checks refuse final Codex commentary and trailing pending, aborted, or errored
lifecycle state. Claude checks the assistant row that contributes the final retained text
and assistant rows after it in the active chain, so omitted trailing context cannot hide
error, interruption, or synthetic markers.
These structural checks do not prove that a source is inactive: stop its writer before
importing. Historical failed turns followed by a supported completed turn remain usable.
Unrecognized slash-command wrapper order refuses rather than guessing.

Historical isolated prototype evidence (2026-09-29): Codex **0.157.1** loaded an imported
seed through app-server `thread/fork`, continued twice across restart, and preserved
native tool structures. A separate interactive `codex fork` created a child but made
no model turn. Claude Code **2.1.284** completed native `--resume --fork-session`,
continuation and restart. These tests used synthetic history, disposable homes,
dummy credentials and a loopback-only network sandbox. They do not prove production
model-service acceptance, GUI placement, arbitrary transcripts, or future clients.
Generated-importer checks on 2026-09-30 passed for **Codex 0.159.2** through the
app-server fork/continuation/restart path and **Claude Code 2.1.284** through CLI
fork/resume with additional noninteractive flags. Both used preinitialized isolated
homes, a destination containing spaces and underscores, and verified native tool
payloads, persisted replies, distinct children, and unchanged source/seed bytes.

Follow-up checks on 2026-10-01 passed with the 0.3.1 importer, Codex **0.159.2**
and Claude Code **2.1.285** through those same isolated native-client paths.
The exact printed Codex terminal command also passed fork creation, an interactive
turn, process restart and resume, including native tool payloads and unchanged
source/seed bytes. This used the supported fixture-local
`CODEX_EXEC_SERVER_URL=none` embedded-server configuration and a synthetic loopback
model service. Default-daemon acceptance remains blocked because the sandbox
refuses execution of the setuid `/bin/ps` binary.

Claude Code **2.1.285** exact interactive terminal acceptance remains unverified:
startup attempted to reach `api.anthropic.com` and stopped under the external-network
block before child creation. The successful noninteractive CLI checks do not cover
that path. Neither direction claims production model-service acceptance or GUI
placement.

Conversion is informed by [Claude Session Teleporter 1.2.0](https://github.com/aviadr1/claude-session-teleporter/tree/39fd13ae4e4f1c7b484872561226da3764ab5a21).
The runtime uses Node standard library APIs, not Python or an installed Teleporter.
See the [upstream MIT notice](teleporter-license.txt).
