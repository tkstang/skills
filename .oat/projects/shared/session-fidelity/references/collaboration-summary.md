# Collaborative design decisions

Astra drives design and planning; Fable provides feedback and coordinates the user-requested schema evidence lane. This is a durable synthesis, not an operational transcript or a claim of final peer consensus.

## User direction

- Draft the entire lightweight design for holistic review.
- Include the Codex native child-session locator fix in this project.
- Read no child/output sidecars in v1; preserve recorded child IDs, agent paths, nicknames, and unread coverage.
- Use reviewed sanitized fixtures from real local recorded sessions and document the observed schemas.
- Gather schema evidence now and store sanitized detail in project references.

## Feedback incorporated

- Independent activity/conversation budgets and independent activity schema version.
- Minimal out-of-range call context for late results, excluded from invocation counts.
- Explicit limits for inline stubs, external output tails, and unread child trajectories.
- Fixture/provenance work and native identity correction before activity integration.
- Parent/child collisions are a source-selection defect: exact pins must not use recency to choose a physical file, and state must reject source-path changes before advancing a cursor.
- Schema inventories must generalize arbitrary keys and restrict exported values by verified native paths; key names alone are not a privacy boundary.

## Work boundaries

Astra owns design/discovery/state/plan and this summary. Fable owned the durable research snapshot and schema docs, committed them as `c970c876`, and released the editing turn. Astra now owns project-artifact updates. Source implementation has not started. The operational collaboration log is machine-local and gitignored; watcher setup problems do not imply agreement on the final design.

## Completed review and schema corrections

Fable completed review of the first full draft and delivered three evidence reports. The revised design accepts existing saved-path validation instead of a new binding marker, mode-specific budgets and invocation-group selection, bounded degradation of optional activity failures, and terminal-settled Cursor activity without revision receipts. Native identity uses the first Codex header plus filename corroboration, allowing inherited parent headers. Claude extraction includes top-level toolUseResult and deduplicates usage by message ID. Codex reads both response and item streams while keeping unproven cross-stream outcome links advisory.

Two evidence limits remain explicit: cap-like payload lengths indicate possible source truncation, not proof; and a local sample's missing field does not establish permanent provider absence. Inherited child-history attribution needs a provenance boundary rather than a blanket assumption that every record belongs to the child. The schema inventory and reports are undergoing an additional bounded privacy/reproducibility check before commit.

## Documentation handoff and stack decision

Fable's completed handoff at Claude record 1590 reports the schema docs and research snapshot committed as `c970c876`; the worktree confirms those paths are committed and only driver-owned project artifacts remain modified. The user selected `gh stack` and inclusion of these docs: schema documentation, then identity/cursor corrections, then activity support. No stack or PR is published.

The handoff corrected Claude task results to `user` records with top-level `origin.kind == "task-notification"`, and retained unknown outcomes when `is_error` is absent. Codex spawn results can provide child identity when explicitly recorded, but occurrence varies by sample. Inherited-history attribution uses the first header's ordinal boundary where present. The observed `.meta.json.toolUseId` relationship is documented evidence, not permission to read sidecars in runtime v1.

Inventory allowlist mode now uses reviewed keys and values; discovery mode is explicitly unreviewed and local-only. Synthetic privacy canaries pass, and depth truncation is diagnosed. Fable reports its independent doc review fixes and successful docs build; the driver independently reran the canaries. Fable also observed `oat docs generate-index` with CLI 0.2.79 rewriting `.oat/config.json` and restored that unrelated change. Treat index generation as a command requiring a config diff check until that tooling behavior is resolved.

The design incorporates this handoff and awaits Fable's read-back. There is no design HiLL checkpoint in this quick-mode project; the user's full-draft request does not require another section-by-section or holistic approval prompt before plan drafting.
