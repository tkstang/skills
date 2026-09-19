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

## Revised-design read-back

Fable reviewed `3e16dd9c` at record 1677. Incorporated: an identity-layer inherited-context warning for no-flag child digests/exports; failure-priority for standalone failed Codex item events independently of canonical call outcomes; planning artifacts in the top stack layer; stateless pending Cursor calls; a 128 KiB review budget; a 64 MiB activity-export safety cap with size/omission notices; and runtime-specific path/identity validators. These revisions require peer read-back and projection tests. Default Claude conversation-origin labeling remains a separate follow-up; the activity path still uses native origin evidence now.

## Scope-choice correction

Fable's records 1718/1737 and human question at 1695 establish that default Claude task-notification provenance is still being discussed. The earlier driver note treating it as a deferred follow-up was premature. The design/plan now leave the choice open. Fable now leans toward narrow in-scope handling for consistent digest provenance and avoiding duplicated release work; no user selection is yet observed.

## Plan review and setup choices

Fable reviewed `795816fe` at record 1785. Added explicit root-owned stack task p00-t01, whoami CLI regression, independent captured-fixture derivation/review task p02-t05, preview deduplication without stronger outcome joins, and close-out follow-up offers. The original Option X at record 302 permitted review “by you or a careful reviewer”; the user selected it at 457. The later peer assertion that a human-only checkpoint was already required was too narrow. The plan now requires a separate reviewer before fixture promotion/commit, without adding a new human stop.

The user explicitly chose High dispatch, disabled additional phase gates, and kept both configured lifecycle gates in the driver session. These settings are recorded; the Claude provenance scope choice remains open.

## Final user scope decisions

Human-origin Fable records 1850/1874 resolve the remaining choices: fix `origin.kind` now; no fixture approval is needed; light obscuring is sufficient. These supersede the earlier open-choice and independent-fixture-gate notes. The plan includes shared native Claude provenance in the identity layer, with an origin-consumer audit to preserve wake-envelope semantics, and a small captured-fixture task with practical private-field/credential checks. No mandatory human or independent fixture review is retained. The structure-only research snapshot and its inventory canaries are unchanged.
