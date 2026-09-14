# Coding session handoff

This directory contains two distinct experiments.

The new `session-fork-to-destination` skill provides **experimental, not released**,
read-only discovery, sanitized preview, and destination-tab fork guidance. It
prepares instructions only. It does not run Claude Code, Codex, or Cursor, and
no fork is created until the operator chooses to run a suggested command.

The older executor in `coding-session-handoff.mjs` remains experimental,
incomplete, unverified, and paused. Its reconcile and behavior-gate path is not
a prerequisite for the guidance skill and must not be presented as released
automation.

## Entry points

All entry points require an explicitly qualified source candidate when an exact
current identity cannot be corroborated.

- `source-current` prepares guidance while the operator is in the exact source
  session.
- `source-other` prepares guidance from another session after explicit source
  selection.
- `destination-fresh` prepares guidance from a fresh destination tab. When a
  provider has no documented in-session destination switch, the instructions
  tell the operator to exit that fresh session before running the terminal
  command from the canonical destination worktree.

The commands are:

```text
coding-session-handoff discover --source /synthetic/source --provider claude --json
coding-session-handoff preview --source /synthetic/source --session codex:cli:00000000-0000-4000-8000-000000000001 --json
coding-session-handoff prepare --source /synthetic/source --target /synthetic/destination --session claude:cli:00000000-0000-4000-8000-000000000002 --entry-point source-other --json
```

`--provider all` fails closed while Cursor lacks independent exact cwd evidence. Use
an explicit `--provider claude` or `--provider codex` discovery for the supported
guidance workflow.

`discover` and `preview` read bounded transcript evidence. `prepare` validates
the source and destination Git worktrees and emits quoted instructions guarded
by the canonical destination path. These operations do not authenticate,
modify provider stores, transfer dirty Git changes, or invoke a provider.

## Provider evidence

- Claude Code CLI has documented fork semantics for `--resume ID
--fork-session`.
- Codex CLI has documented `codex fork ID` semantics.
- Cursor CLI documents resume, while Cursor IDE documents Duplicate Chat.
  CLI fork semantics, CLI-to-IDE identity interoperability, and reliable
  cross-worktree placement are unsupported. Ambiguous Cursor candidates fail
  closed and receive no executable instruction.

The evidence is public-documentation-backed and dated 2026-09-12. It has not
been live verified for this experiment. Provider behavior may change, so the
prepared output reports its evidence status and limitations.
