---
id: BL-260920-re-verify-install-matrix
title: Re-verify Install matrix Cursor claims against current cursor-agent
status: open
priority: medium
scope: task
scope_estimate: S
labels:
  - documentation
  - cursor
  - verification
assignee: null
created: 2026-09-20T22:40:22.429Z
updated: 2026-09-20T22:40:22.429Z
associated_issues: []
external_plans: []
---

## Description

The Install matrix section of documentation/docs/user-guide/installation.md carries two Cursor claims that are version-stamped 'Observed against Cursor Agent 2026.07.23' while the installed CLI is 2026.09.18: that --plugin-dir is session-scoped and writes nothing under ~/.cursor/, and that Cursor Agent surfaces plugins Claude Code has enabled via ~/.claude/settings.json enabledPlugins. PR #100 corrected the 'Updating an install' section and deliberately scoped its new text to be consistent with these claims rather than rewriting untested assertions. Re-verify both against a live cursor-agent run and update or re-stamp them.

## Acceptance Criteria

- `--plugin-dir` session-scoping is confirmed or corrected against cursor-agent 2026.09.18 or later, with evidence that nothing is (or is) written under `~/.cursor/` for that run.
- The claim that Cursor Agent surfaces Claude Code-enabled plugins from `~/.claude/settings.json` `enabledPlugins` is confirmed, corrected, or removed, based on an actual Cursor run rather than the bundle source alone.
- Each surviving claim carries a refreshed `Observed against Cursor Agent <version>` stamp matching the version actually tested.
- The Install matrix stays consistent with the "Updating an install" section added in PR #100, which routes refresh guidance by install mode (marketplace vs `--plugin-dir` vs Claude-discovered).
- Any claim that cannot be reproduced is removed rather than left version-stamped, consistent with the repo's no-backward-compat-shims preference for clean corrections over hedged legacy prose.
