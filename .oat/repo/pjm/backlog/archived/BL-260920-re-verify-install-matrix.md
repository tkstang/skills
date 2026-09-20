---
id: BL-260920-re-verify-install-matrix
title: Re-verify Install matrix Cursor claims against current cursor-agent
status: closed
priority: medium
scope: task
scope_estimate: S
labels:
  - documentation
  - cursor
  - verification
assignee: null
created: 2026-09-20T22:40:22.429Z
updated: 2026-09-20T23:05:00.000Z
associated_issues: []
external_plans: []
---

## Description

The Install matrix section of documentation/docs/user-guide/installation.md carries two Cursor claims that neither PR #100 nor its two reviewers tested against a running Cursor:

1. `--plugin-dir` is session-scoped: the plugin loads for that run only and nothing is written under `~/.cursor/`. This claim carries NO version stamp and no observation note - it is asserted flatly.
2. Cursor Agent lists plugins Claude Code has enabled, matching `enabledPlugins` in `~/.claude/settings.json`, so consensus is picked up with no separate Cursor install. This one is stamped 'Observed against Cursor Agent 2026.07.23'; the installed CLI is 2026.09.18.

These are not merely old: PR #100's new 'Updating an install' section routes refresh guidance by install mode, and two of its three modes rest on exactly these claims ('the pull is the whole update - just start a new run' for --plugin-dir, and 'refreshing it is the Claude Code procedure' for Claude-discovered plugins). If either claim is stale, the new guidance is wrong in the same way the old guidance was. The PR scoped its text to be consistent with them rather than retiring them, so it inherited their risk.

## Acceptance Criteria

- `--plugin-dir` session-scoping is confirmed or corrected against cursor-agent 2026.09.18 or later, with evidence that nothing is (or is) written under `~/.cursor/` for that run.
- The claim that Cursor Agent surfaces Claude Code-enabled plugins from `~/.claude/settings.json` `enabledPlugins` is confirmed, corrected, or removed, based on an actual Cursor run rather than the bundle source alone.
- Each surviving claim carries a refreshed `Observed against Cursor Agent <version>` stamp matching the version actually tested.
- The Install matrix stays consistent with the "Updating an install" section added in PR #100, which routes refresh guidance by install mode (marketplace vs `--plugin-dir` vs Claude-discovered).
- Any claim that cannot be reproduced is removed rather than left version-stamped, consistent with the repo's no-backward-compat-shims preference for clean corrections over hedged legacy prose.

## Outcome

Both claims were settled empirically on cursor-agent 2026.09.18-9a7762b, in the
same PR that filed this item (#100).

**Claim 2 — confirmed.** With `consensus@skills` and `session@skills` enabled in
`~/.claude/settings.json`, the Cursor plugin picker lists both tagged
`(Claude Code)`, alongside `codex`. Observed directly in the interactive picker.
Version stamp refreshed from 2026.07.23 to 2026.09.18-9a7762b.

**Claim 1 — corrected.** "Nothing is written under `~/.cursor/`" was too broad.
A `--plugin-dir` run was measured against a before/after snapshot: it modified
six files under `~/.cursor/` (`chats/…/meta.json`, `chats/…/store.db`,
`cli-config.json`, `projects/…/agent-transcripts/….jsonl`,
`skills-cursor/.sync-manifest.json`, `statsig-cache.json`) and **zero** under
`~/.cursor/plugins/`. The substantive point — `--plugin-dir` installs nothing —
holds; the literal wording did not, and would have misled anyone auditing the
directory for writes. The claim now scopes to `~/.cursor/plugins/` and names the
session state that is still written.
