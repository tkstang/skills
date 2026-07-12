# Collaboration Closeout Runbook

Use this after the handoff packet is finalized and before removing the source
worktree.

## 1. Freeze and verify the handoff

1. Run one final stateless review or catch-up against every active peer.
2. Resolve any substantive pending response.
3. Have the peer reviewer inspect the current `prompt.md` and packet manifest.
4. Record a findings or no-findings verdict.
5. Verify the packet contains no secrets or unsanitized live lease data.

## 2. Finalize evidence logs

- Each primary collaborating agent completes its own
  `## Distilled Recommendations` footer.
- Bounded smoke-test logs may remain bounded when the packet manifest labels
  them as such; do not impersonate another runtime merely to add a footer.
- Preserve the append-only incident entries even when later evidence
  superseded an early conclusion. The prompt should carry only the final truth.

## 3. Stop observation processes

- Stop foreground watchers with `watch-ctl stop`, pinned by runtime/session/PID
  when more than one watcher exists.
- Stop Claude Monitor tasks through the Claude harness and verify they are no
  longer attached.
- Stop any scheduled polling process or Cursor continuation loop.
- Verify `watch-ctl status --json` reports no unintended active watcher.

## 4. Disarm continuation leases

- Set the current lease to `disarmed` or invoke the implementation's `disarm`
  control, then remove only that session's lease file.
- Verify no further automatic continuation fires at the next Stop boundary.
- Prune expired, missing-worktree, and missing-transcript leases without
  touching ambiguous valid sessions.

## 5. Retain or uninstall static hooks

Default: retain the trusted static hook for future collaboration sessions; an
absent lease makes it a fast no-op.

If the user requests uninstall:

1. Confirm no active lease depends on the script.
2. Remove only the exact Session Observer hook entry from the harness config.
3. Preserve all unrelated hooks and configuration.
4. Remove the hook script.
5. Verify the harness no longer lists or invokes it.

## 6. Transfer and verify

1. Copy the entire `.session-observer/` directory to the implementation
   worktree.
2. In the destination, open `README.md` and `prompt.md` and verify every linked
   relative artifact exists.
3. Confirm the implementation agent understands that prototype code is
   evidence, not canonical source.
4. Require the implementation agent to create file-backed backlog items for
   every deferred v2 item and include their IDs in its final handoff.
5. Only then remove the packet from the source worktree.
