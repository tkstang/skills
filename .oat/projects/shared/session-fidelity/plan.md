---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-09-19
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ['p06']
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: quick
oat_generated: false
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_template: false
---

# Implementation Plan: session-fidelity

> Execute with `oat-project-implement` once the plan review disposition and frontmatter mark this plan ready.

**Goal:** expose trustworthy opt-in activity in observer/exporter, and correct native Codex session selection and unsafe cursor reuse.

**Architecture:** shared detailed reading, native extraction, exact correlation, range selection and bounded projection; consumers own delivery and rendering. Existing default conversation behavior remains intact, except the explicitly authorized identity and Claude-provenance corrections.

**Tech stack:** dependency-free Node >=22 TypeScript runtime; pnpm, Vitest, esbuild, oxlint/oxfmt as development tooling.

## Delivery and existing work

The user selected `gh stack` in this order:

1. **Schema documentation:** existing commit `c970c876`, with native schema pages, dated evidence, navigation, inventory script and privacy canaries. This is completed preparatory work, not a pending implementation task.
2. **Identity/cursor correction:** phase p01; independently buildable and reviewable.
3. **Activity support:** phases p02–p06; depends on the identity layer.

Task p00-t01 registers the bottom docs layer with the current initial planning/schema history, then code layers are added as they begin. Keep `.oat/projects/**` bookkeeping with the layer being worked on. This preserves the three-layer story without rewriting planning history or creating a second worktree. Use distinct branch names without a `session-fidelity/` prefix while the `session-fidelity` branch exists. Publication, merge, installation and live provider execution are outside this planning invocation.

Record each code layer's exact base as `IDENTITY_BASE` or `ACTIVITY_BASE` in implementation evidence before changing it; use that actual ref for version validation. These names below are shell variables bound to those verified refs, never guessed placeholders. No source changes have been implemented.

## Resolved provenance and fixture scope

The user explicitly chose to fix Claude `origin.kind` now (Fable human record 1850). The identity layer includes native provenance for ordinary human messages and task notifications, preserving absent/unknown-field behavior and collaboration wake-envelope semantics. This is an intentional second change to default output, alongside Codex identity correction.

The user also waived fixture approval and requested light obscuring (records 1850/1874). Use small recorded slices with practical redaction of credentials, private paths/identifiers and third-party personal content, plus removal of encrypted reasoning. Preserve useful ordinary commands and native semantics where safe. No mandatory human checkpoint, separate reviewer, cross-model gate, all-values-synthetic sanitizer or staging workflow is added. Inventory privacy canaries and the structure-only documentation snapshot remain unchanged.

## Approved scope refinement — 2026-09-19

The user approved the p01-t04/p01-t05 split and deferral of new detailed-reader byte ranges. Keep physical line/record-index locators, original carriers and parse diagnostics, existing Cursor byte offsets/continuity, source-size metadata, UTF-8 output budgets and framing regressions. Reintroduce per-record byte ranges only for a concrete consumer. The focused amendment review at `e3c25f3a` found no substantive issues. Its one Minor table-formatting finding was corrected. Earlier gate receipts remain historical evidence for the pre-amendment scope.

## Parallelism

`oat_plan_parallel_groups: []`. p01 establishes identity for every later consumer. p02 establishes the activity contract. p03/p04/p05 share transcript imports, version fan-out, generated bundles and regression coverage; their changes are intentionally serial even where individual authored modules differ. p06 validates the integrated result. Bounded read-only review can run concurrently; file mutation remains owned by one implementation phase.

## Task execution contract

Before source/tests read `src/AGENTS.md`; before tooling read the generated-runtime architecture contract; before docs read `documentation/AGENTS.md`. Never hand-edit `skills/`, generated plugin skill payloads or provider mirrors.

Each task below defines its authored files, behavior and verification. Test behavioral changes with a focused failing regression, implement, then rerun the named check. Keep fixtures small and lightly obscured, with provenance in their README. No whole sessions, credentials, private personal content or private raw locators enter tracked fixtures; ordinary commands and safe native content may remain. Existing captured schemas establish shape, not universal provider behavior.

**Format every task:** run `pnpm exec oxfmt --write` with only that task's changed authored TypeScript/JavaScript/JSON/Markdown paths. Then run `pnpm exec oxlint` with only its changed authored TypeScript/JavaScript paths (omit when none). Never pass generated outputs, AGENTS files or the whole repository. For authored project Markdown only, use the same documented formatter with a temporary config outside the repository (for example, an automatically cleaned OS temporary directory), removing only the `.oat/**` ignore. Run `pnpm exec oxfmt --write --config <temporary-config>` on exact authored project paths. Do not format generated OAT indexes, dashboards, synced tooling, provider views or agent-instruction files. This is a file-scoped invocation satisfying the planning artifact hygiene contract; it does not change repository-wide formatting policy.

**Generated outputs and versions:** any changed canonical skill directory requires its `metadata.version` increase and matching Unreleased changelog entry. Build with `pnpm run build` before CLI tests because they execute generated entrypoints. The validator’s `allowedSourceRoots` rule is authoritative: changes anywhere under `src/shared/transcript/**` require version bumps and Unreleased changelog entries for every owner declaring that root (currently observer, collaboration, exporter and fork), even if a bundle is byte-identical. Also inspect generated diffs for additional affected owners. Build and check generated freshness whenever a task changes bundled source, and bump affected owners before the layer is complete. Include the corresponding generated outputs in the same task commit when they change; do not install the branch globally. Never replace a whole plugin root.

**Commit every task:** stage only the named authored changes, necessary version/changelog updates and their owned generated outputs; use the exact Conventional Commit message listed. Record task results and commit in `implementation.md`. The listed commands are planned checks, not current pass claims.

## Planning setup

User selected managed **High** dispatch, **Disabled** additional phase gates, and **Keep** for both configured lifecycle gates (`oat-project-quick-start` plan review and `oat-project-implement` final review). The full candidate ladder resolves from configuration; only the named High ceiling is stored in project state. Phase-gate frontmatter remains absent by contract. Both lifecycle overrides remain absent, preserving the configured gates.

## Phase 0: Arrange the local stack

**Owner:** root only. **Depends on:** finished planning and parked peer edits.

### Task p00-t01: Arrange and verify the three review layers

**Files/state:** local Git refs and `gh stack` metadata; project implementation evidence. No product source edits.

**Implement:** Record the starting branch/HEAD, clean status and parked peer edits; create and verify a local recovery ref. Use `gh-stack` to register the current docs/planning history as the bottom layer. Create and register the identity branch from the verified bottom-layer head and record that exact commit as `IDENTITY_BASE` in implementation evidence. Preserve existing history and keep later bookkeeping with its owning layer. Activity branch creation belongs to the root-owned pre-step in p02-t01, not a later revisit of this task. Verify the bottom docs/planning diff and the identity branch parent. No checkout into a branch lacking the plan, no extra implementation worktree, no force-push or hidden history rewrite. Root owns Git operations.

**Format:** format only changed project evidence via the task execution contract; Git metadata is not a formatter input.

**Verify:** `gh stack view --json`; inspect each existing layer diff against its recorded parent and verify recovery-ref reachability. Confirm the bottom contains no runtime feature implementation. The docs build already passed on the committed baseline; rerun only if arrangement changes its content. Start code work on the identity layer with a clean tree.

**Commit:** `chore(p00-t01): record session fidelity stack boundaries` for project evidence; do not create empty source commits merely to populate branches.

## Phase 1: Native identity and safe state binding

**Layer:** identity. **Depends on:** p00 and committed schema documentation.

### Task p01-t01: Resolve native Codex identity and lineage

**Files:** `src/shared/transcript/runtimes.ts`, `runtimes.test.ts`; new synthetic header fixtures under `src/shared/transcript/fixtures/session-fidelity/codex/` with a provenance README. These identity regressions are authored from the documented native shapes; this task does not read real session stores.

**Implement:** Use the first physical session_meta payload.id, corroborated by a recognized rollout filename UUID. Keep root and parent lineage distinct; accept inherited parent headers later in the file. Preserve documented older shapes. Cover root/child, fork, duplicate sources, filename conflict, repeated parent header and independent call/message IDs. Do not infer child identity from nickname or recency.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, `pnpm run build:check`, then `pnpm run test:vitest src/shared/transcript/runtimes.test.ts`; assert first-header identity and explicit contradictory-evidence failures.

**Commit:** `fix(p01-t01): preserve native Codex thread identity`.

### Task p01-t02: Propagate exact identity through discovery and consumers

**Files:** `src/skills/session-observer/src/lib/locate.ts`, `rank.ts`, `types.ts`, `observe.ts`, `digest.ts`, `session-observer.ts`; observer `locate.test.ts`, `rank.test.ts`, `cli-session-override.test.ts`, `cli.test.ts`; exporter `src/session-export-transcript.ts`, `src/cli.test.ts` if identity metadata needs adaptation.

**Implement:** Invalidate/revalidate stale root-to-child cache mappings using native evidence. Explicit native pins select exactly one canonical file or report ambiguity; unpinned cwd lookup prefers roots while listing labelled children. Carry identity through whoami, digest and export metadata. Child digests/exports warn about inherited parent context even without activity, giving the ordinal boundary or unknown ownership; keep conversation entries intact. Fixture parent/child mtimes must prove an exact pin cannot change source when a child is newer. Add a whoami regression reproducing this session’s root/child collision under explicit harness identity; test the exact generated CLI as well as the helper.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-observer/src/locate.test.ts src/skills/session-observer/src/rank.test.ts src/skills/session-observer/src/observe.test.ts src/skills/session-observer/src/digest.test.ts src/skills/session-observer/src/cli-session-override.test.ts src/skills/session-observer/src/cli.test.ts src/skills/session-export-transcript/src/cli.test.ts`.

**Commit:** `fix(p01-t02): bind discovery and exact pins to native sessions`.

### Task p01-t03: Reject unsafe saved positions and watcher path changes

**Files:** `src/skills/session-observer/src/lib/state.ts`, `observe.ts`, `watch.ts`, `watch-state.ts`; `state.test.ts`, `observe.test.ts`, `watch.test.ts`, `watch-state.test.ts`; affected collab source/tests only if the corrected observer contract requires them.

**Implement:** Use the Codex first-header validator only for Codex; retain Claude session identity and Cursor source/frame continuity checks. Validate saved transcriptPath against the native pin and selected canonical path before nonzero reuse. Preserve valid legacy offsets. Missing/mismatched legacy bindings require explicit scoped reset; fresh zero state can bind. Watch mismatch emits one error to stdout, exits nonzero and leaves offsets unchanged. Ensure leases against mislabelled files fail closed and require owner re-arm. Cover mixed old/new writers, source replacement, ambiguity, shrink, review versus mark-read and no unrelated reset. Introduce no state schema, marker or receipt.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-observer/src/state.test.ts src/skills/session-observer/src/observe.test.ts src/skills/session-observer/src/watch.test.ts src/skills/session-observer/src/watch-state.test.ts src/skills/session-observer-collab/src`; compare state bytes before/after failed delivery.

**Commit:** `fix(p01-t03): guard saved cursors against source identity changes`.

### Task p01-t04: Correct native Claude provenance atomically

**Files:** `src/shared/transcript/runtimes.ts`, `runtimes.test.ts`; observer `src/lib/session-classifier.ts`, `src/session-classifier.test.ts`, `src/digest.test.ts`, `src/cli.test.ts`; `src/skills/session-export-transcript/src/sanitize.ts`, `src/sanitize.test.ts`; `src/skills/session-fork-to-destination/src/preview.ts`, `src/preview.test.ts`; `src/skills/session-observer-collab/src/lib/completion-selection.mjs`, its `.d.mts` if types change, `src/completion.test.ts`, `src/wake-envelope-contract.test.ts`; affected canonical skill `SKILL.md` versions and generated distributions; `CHANGELOG.md`.

**Implement:** Add a shared native Claude provenance helper for ordinary user records: explicit human evidence labels a message human, task-notification evidence labels a runtime notification; absent native values retain current behavior, while ordinary peer/unknown messages remain unmarked and explicit non-human/unknown records cannot be upgraded by the ask-user fallback. Audit every origin consumer so notifications never authorize collaboration or count as genuine human engagement, ordinary human messages never become ask-user answers, and automatic-control remains reserved for validated wake envelopes. Use a distinct runtime-notification origin rather than weakening the structured automaticControl contract. Exclude runtime notifications from human recovery pointers and injected-content export/fork previews; visibly label them in observer output. In collaboration, do not treat a notification-only tail as an incomplete human turn or classify it as an automatic wake; preserve substantive assistant completion behavior. Allow the existing Claude ask-user human branch only for native human or legacy absent provenance, with kind=message for ordinary humans. Reuse this helper in activity extraction. Add human/notification/absent/unknown fixtures and unchanged-existing-ranking regressions. Keep the shared helper and all coupled consumer changes atomic, including focused tests, affected skill versions, the Unreleased changelog entry and owned generated output. Determine version fan-out using the validator source-root rule plus bundle diffs. Identity-layer user/recovery documentation and full validation belong to p01-t05.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, `pnpm run build:check`, then `pnpm run test:vitest src/shared/transcript/runtimes.test.ts src/skills/session-observer/src/session-classifier.test.ts src/skills/session-observer/src/digest.test.ts src/skills/session-observer/src/cli.test.ts src/skills/session-export-transcript/src/sanitize.test.ts src/skills/session-fork-to-destination/src/preview.test.ts src/skills/session-observer-collab/src`.

**Commit:** `fix(p01-t04): preserve native Claude provenance across consumers`.

### Task p01-t05: Document and validate the identity layer

**Files:** `documentation/docs/user-guide/skills/session-observer.md`; `src/skills/session-observer/SKILL.md`, `references/transcript-formats.md`, `references/watch-design.md`; `src/skills/session-observer-collab/SKILL.md` and its `references/runtime-codex.md`, `runtime-claude-code.md`, `runtime-cursor.md` where reset/re-arm guidance changes; corresponding generated documentation payloads and any required canonical version/changelog updates; project implementation/review evidence. No new runtime behavior.

**Implement:** Document the tested identity and provenance behavior, inherited-context warnings, exact scoped reset/re-arm steps and observed client-version limits without hard-coded version gating. Keep docs aligned with all p01 changes; do not broaden the provenance implementation. Follow the existing source-root/version/changelog/generated-output contract for any canonical reference edits. Run the complete identity-layer validation against `IDENTITY_BASE`, record evidence, and complete its required review before activity begins. Include a complexity check of the actual identity diff in that existing review; do not add a new phase gate or human stop. Commit accepted fixes and bookkeeping before the root selects the activity base.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, `pnpm run type-check`, `pnpm run build:check`, `pnpm run test`, `pnpm run validate`, `pnpm run smoke`, `pnpm run validate:skill-versions -- --base-ref "$IDENTITY_BASE"`, and `pnpm --dir documentation build`; check `.oat/config.json` for the known docs-generator side effect. Root verifies the identity review disposition and recorded base/diff before p02-t01.

**Commit:** `docs(p01-t05): document and validate the identity layer`.

## Phase 2: Detailed reads and shared activity contract

**Layer:** activity. **Depends on:** p01. Establish a fresh `ACTIVITY_BASE` before this layer. Capture fixtures in p02-t01 before implementing extractors. Stable task IDs and sequential order remain unchanged; p02-t05 verifies the integrated shared pipeline against those captures.

### Task p02-t01: Add captured fixtures and LF-only detailed source reading

**Files:** `src/shared/transcript/runtimes.ts`, `runtimes.test.ts`; small captured fixtures and authored edge cases under `src/shared/transcript/fixtures/session-fidelity/`, with README provenance.

**Implement:** First, root verifies the completed identity layer and its review, creates and registers the activity branch with `gh stack` from the verified identity branch HEAD after review, accepted fixes and bookkeeping are committed, and records that full tip SHA as `ACTIVITY_BASE` in `implementation.md`. Require the p01-t04 and p01-t05 completion commits to be ancestors of that reviewed identity tip. Verify the identity-layer diff before source edits. Then return detailed records with one-based physical lines, unchanged zero-based logical decoded indices and diagnostics, preserving readRecords output/warnings. Do not add per-record byte ranges. First regression includes U+2028/U+2029 within strings, escaped carriage return, CRLF, blanks, malformed interior, valid no-newline and partial tail. Before building extractors, derive minimal slices from the approved local stores, with the user-requested light obscuring: remove credentials/tokens/encrypted reasoning and replace private paths/identifiers/third-party personal content while preserving useful safe native values and consistent IDs. Do not copy whole sessions or commit raw intermediate slices. Record client version/observation provenance, using unknown where no version is recorded. Inspect final fixture diffs and run practical private-term/credential checks as normal task verification, with no approval or independent review checkpoint. Use the existing snapshot inventory/canaries if needed; do not promote it to scripts/. Supplement captures with synthetic framing/error cases.

**Format:** follow the file-scoped task execution contract above.

**Verify:** Root checks `gh stack view --json` and the recorded `ACTIVITY_BASE` equals the reviewed identity branch tip, with p01-t04 and p01-t05 ancestors; then `pnpm run build`, `pnpm run build:check`, and `pnpm run test:vitest src/shared/transcript/runtimes.test.ts`; `node --test .oat/repo/reference/research/session-schemas-2026-09-18/inventory.canary.test.mjs` if the inventory is used; `pnpm run type-check`. Compare legacy decoded records and warnings byte-for-byte against pre-change expectations.

**Commit:** `feat(p02-t01): add detailed transcript provenance and schema fixtures`.

### Task p02-t02: Extract native Claude and Codex activity

**Files:** New `src/shared/transcript/activity/types.ts`, `extract.ts`, `claude-code.ts`, `codex.ts`, `extract.test.ts`; fixture README and focused fixtures.

**Implement:** Implement versioned source-attributed events, metadata, coverage and diagnostics. Cover Claude multiblock calls/results, top-level toolUseResult string/array/object, unread persisted output, origin.kind task notifications through the shared provenance helper from p01-t04, empty errors and absent-error unknowns. Cover Codex function/custom/web-search carriers and item_completed evidence; native child IDs, statuses, model/lifecycle/compaction markers and output cap warnings. Exclude reasoning/instruction bodies. Preserve raw native arguments internally before presentation budgets. Per-record extraction failures degrade narrowly with ACTIVITY_EXTRACTION_ERROR; core reads and identity failures still fail closed.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run test:vitest src/shared/transcript/activity/extract.test.ts`; `pnpm run type-check`. Assert no sidecar read or provider execution occurs.

**Commit:** `feat(p02-t02): extract source-attributed Claude and Codex activity`.

### Task p02-t03: Correlate calls and classify activity without guessing

**Files:** New `src/shared/transcript/activity/correlate.ts`, `classify.ts`, `correlate.test.ts`; shared activity types/extractors.

**Implement:** Pair only explicit native IDs in the same source scope; preserve repeated calls, ambiguous reuse, unmatched/multiple outputs and independent poll invocations. Inherited ordinal ranges are excluded from child invocation counts; absent/conflicting boundaries remain unknown. Cross-stream item outcomes remain standalone unless corroborated IDs link them. Do not infer cross-stream associations from turn/order/text. Exact corroborated native-ID links are allowed; otherwise item evidence stays standalone. Process handles establish pending evidence, not success; do not link polling calls into a process lifecycle in v1. Response-stream call counts and standalone item evidence counts remain separate. In `classify.ts`, add the small native-name lookup for shell/read/write/edit/grep/glob/search/fetch/task/ask/MCP/other categories, preserving exact native names. Unknown tools and unrecognized MCP names retain generic evidence rather than guessed semantics. Do not add derived command/path/URL enrichments or a grouped tool index.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run test:vitest src/shared/transcript/activity/correlate.test.ts src/shared/transcript/activity/extract.test.ts`; include native category lookup and unknown MCP-name assertions in `correlate.test.ts`, plus late results, duplicates, process polls, inherited records and cross-stream ID nonmatches.

**Commit:** `feat(p02-t03): correlate activity with explicit evidence and ownership`.

### Task p02-t04: Project bounded activity reports

**Files:** New `src/shared/transcript/activity/project.ts`, `render.ts`, `index.ts`, `project.test.ts`; shared activity types.

**Implement:** Apply 32KiB/80-invocation watch/catch-up and 128KiB/1024-invocation review limits, plus 2KiB previews and 256-byte late-call context. Export has no invocation-count limit and a 64MiB activity-section safety ceiling with a size/omission header. Use per-mode invocation limits, clipped previews and one final serialized-size guard; drop lowest-priority internal call/result groups, prioritize explicit failures and recent evidence, then render chronologically. Standalone failed Codex item events have priority without a guessed call association. Retain one preview for exact-ID-linked duplicate carriers; leave unlinked evidence separate. Emit global omitted call/result/failure counts, source locators and explicit count scopes. Do not add per-category omission tables, omitted-range compaction, inferred links, a grouped tool index, derived enrichments or a special fallback mode. Test late item-only failures and groups too large to fit under a tight cap.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run test:vitest src/shared/transcript/activity/project.test.ts`; assert UTF-8 byte size, deterministic serialization, failure retention, late-result context and independent conversation budget.

**Commit:** `feat(p02-t04): project bounded activity with honest omission counts`.

### Task p02-t05: Verify the shared pipeline against captured fixtures

**Files:** `src/shared/transcript/activity/index.ts` and new `integration.test.ts`; the p02-t01 fixture README where coverage evidence needs clarification.

**Implement:** Exercise detailed reading → extraction → exact correlation → delivered-range selection → projection as one shared pipeline using the already obscured captures. Cover a late result with earlier call context, an unlinked failed item event under a budget, inherited child history, malformed input and omitted counts. Connect the public shared entrypoint using the implemented modules; do not introduce another abstraction, provider runtime or inventory script. This task proves the shared seams before consumers integrate them.

**Format:** follow the file-scoped task execution contract.

**Verify:** `pnpm run test:vitest src/shared/transcript/activity/integration.test.ts`; `pnpm run type-check`; verify representative captured event identities and source/count scopes against the fixture README.

**Commit:** `test(p02-t05): verify captured activity through the shared pipeline`.

## Phase 3: Observer activity delivery

**Layer:** activity. **Depends on:** p02.

### Task p03-t01: Expose activity in observer review and catch-up

**Files:** `src/skills/session-observer/src/session-observer.ts`, `lib/types.ts`, `lib/digest.ts`, `lib/observe.ts`; `cli.test.ts`, `digest.test.ts`, `observe.test.ts`.

**Implement:** Parse --include-activity and reuse one captured decoded read for conversation/activity. Add the optional activity object without changing outer digest v1/v2. Correlate whole captured source, select delivered range, render mode-specific limits. Preserve default JSON/text and legacy flags where present, except authorized identity/provenance behavior. Stateless review does not move state; mark-read follows existing writes. Whole optional extraction failure preserves conversation with explicit unavailable coverage. In activity mode suppress duplicate legacy tool-call/result markers while preserving ordinary messages and operator questions/answers; retain ask-user human/automatic caveats. Derive counts from extracted invocations, not rendered markers. Apply existing conversation tail limits and `--max-turns`/`--max-bytes` to conversation only, before attaching independently budgeted activity.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-observer/src/cli.test.ts src/skills/session-observer/src/digest.test.ts src/skills/session-observer/src/observe.test.ts`; compare no-flag output against existing golden behavior; assert no duplicate legacy markers with `--include-tools --include-activity` and debug combinations, retained ask-user caveats, and independent conversation/activity limits.

**Commit:** `feat(p03-t01): expose opt-in activity in observer digests`.

### Task p03-t02: Deliver activity-only watch deltas safely

**Files:** `src/skills/session-observer/src/lib/watch.ts`, `watch-state.ts`, `observe.ts`, `types.ts`; `watch.test.ts`, `watch-state.test.ts`, `integration.test.ts`.

**Implement:** Emit activityOnly when no conversation content is new; quiet-empty must retain activity or new coverage. Deduplicate diagnostics by source change without new persistent activity state. Existing cursor/write path governs advancement even when display is truncated; turning the flag on does not replay consumed history. Preserve stdout delivery-before-write failures and metadata-only event logs. Never enable activity on collaboration watchers or let it authorize a wake.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-observer/src/watch.test.ts src/skills/session-observer/src/watch-state.test.ts src/skills/session-observer/src/integration.test.ts src/skills/session-observer-collab/src`; assert logs contain no transcript/activity content.

**Commit:** `feat(p03-t02): deliver activity-only watch updates without cursor drift`.

## Phase 4: Markdown exporter activity

**Layer:** activity. **Depends on:** shared contract and p03 integrated behavior.

### Task p04-t01: Add opt-in activity to Markdown export

**Files:** `src/skills/session-export-transcript/src/session-export-transcript.ts`, `src/cli.test.ts`; shared activity renderer; new exporter activity fixtures if needed.

**Implement:** Parse --include-activity, reuse the captured read, and append source-attributed activity with the export preview policy. Keep the exporter Markdown-only and stateless. Label activity/debug content and coverage, retain exact names/raw carriers only through bounded previews, and report external results/children as unread. Preserve source order and logical-to-physical locators without claiming a public range-selection flag. `--all --include-activity` labels every generated artifact as an activity export with rendered bytes, preview caps, the 64 MiB safety limit and omitted counts; preserve default filenames and `--all` semantics. Include the core default-sanitization regression alongside this feature; p04-t02 extends it with remaining adversarial cases.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-export-transcript/src/cli.test.ts src/shared/transcript/activity/project.test.ts`; verify exported activity counts/previews, each `--all --include-activity` artifact’s label/limits and unchanged filenames, and no observer state mutation.

**Commit:** `feat(p04-t01): export bounded source-attributed activity`.

### Task p04-t02: Protect default sanitization and content boundaries

**Files:** `src/skills/session-export-transcript/src/cli.test.ts`, `src/sanitize.test.ts`, `src/fixtures/`; shared projection tests where output escaping is shared.

**Implement:** Extend p04-t01’s core sanitization regression with the remaining adversarial coverage; this is not a second feature implementation pass. Prove no-flag exports retain current sanitizer behavior and activity flag does not implicitly enable instruction bodies, reasoning, or hidden payloads. Recorded prompt/tool content remains data; escape Markdown structure/control sequences without suppressing declared activity evidence. Exercise malicious-looking tool text, secret-like synthetic strings, oversized output and unavailable tails. Do not describe opt-in output as publish-safe or alter default redaction policy.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-export-transcript/src/cli.test.ts src/skills/session-export-transcript/src/sanitize.test.ts`; `pnpm run type-check`.

**Commit:** `test(p04-t02): protect export sanitization and activity boundaries`.

## Phase 5: Cursor terminal-settled activity

**Layer:** activity. **Depends on:** p02–p04. Uses existing frame analysis and terminal checkpoints.

### Task p05-t01: Extract stable Cursor call evidence

**Files:** New `src/shared/transcript/activity/cursor.ts`, `cursor.test.ts`; `src/shared/transcript/cursor-analysis.ts` only for necessary additive accessors; existing Cursor fixtures and shared activity contract.

**Implement:** Use frame/block positional identity and terminal lifecycle. Expose calls only where recorded; do not invent IDs, results, client version, usage, per-call success or cancellation support from sample absence. Terminal error/abort is a turn outcome, not each call outcome. Defer open-turn activity in stateful delivery; stateless review/export includes valid open-frame calls as pending-lifecycle with separate pending counts and snapshot-scoped positional identity. Cover grow-in-place, repairs, safe prefix, malformed/replaced frames and source/delivery coordinate separation.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run test:vitest src/shared/transcript/activity/cursor.test.ts src/shared/transcript/cursor-analysis.test.ts src/shared/transcript/cursor-frames.test.ts src/shared/transcript/cursor-fixtures.test.ts`.

**Commit:** `feat(p05-t01): extract Cursor activity from settled frame evidence`.

### Task p05-t02: Integrate Cursor settlement with observer and export

**Files:** `src/skills/session-observer/src/lib/digest.ts`, `observe.ts`, `cursor-state.ts`, `watch.ts`; observer `digest.test.ts`, `cursor-state.test.ts`, `watch.test.ts`; exporter entrypoint/CLI tests.

**Implement:** Use previous/new terminal checkpoints to select settled activity, distinct from the conversation delivery range. A previously observed open turn settling emits one activity-only delta; read both checkpoints before the existing atomic update. No new receipt/schema/cursor is introduced. Flag-off settlement is not replayed later; review/export can recover it statelessly. Preserve early conversation delivery and strict collaboration confirmed-completion gating, including unsuccessful terminals.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-observer/src/digest.test.ts src/skills/session-observer/src/cursor-state.test.ts src/skills/session-observer/src/watch.test.ts src/skills/session-export-transcript/src/cli.test.ts src/skills/session-observer-collab/src`; assert no duplicate invocations across polls.

**Commit:** `feat(p05-t02): deliver Cursor activity through terminal checkpoints`.

## Phase 6: Documentation, distribution and acceptance

**Layer:** activity. **Depends on:** all feature phases.

### Task p06-t01: Document and build the tested feature

**Files:** `src/skills/session-observer/SKILL.md`, `src/skills/session-export-transcript/SKILL.md`, their transcript references; `documentation/docs/user-guide/skills/session-observer.md`, `session-export-transcript.md`; `documentation/docs/engineering/architecture/transcript-core.md`, schema pages where parser support is now proven; affected canonical versions, `CHANGELOG.md`, generated outputs.

**Implement:** Document flags, budgets, unavailable/unread evidence, late call context, Cursor settlement and retrospective review. Keep existing native-format sample qualifiers. Apply the validator source-root rule and inspect transitive generated changes; version all affected owners; include new runtime files through existing import closure, changing build declarations only if necessary. Check navigation/local maps when adding pages. Do not edit the dated research snapshot to reflect new behavior.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, `pnpm run build:check`, `pnpm run validate:skill-versions -- --base-ref "$ACTIVITY_BASE"`, and `pnpm --dir documentation build`; check `.oat/config.json` before/after documentation generation and restore only a proven command side effect without discarding other work.

**Commit:** `docs(p06-t01): document and package opt-in session activity`.

### Task p06-t02: Verify acceptance and close tracked work

**Files:** Project `implementation.md` and review records; `.oat/repo/pjm/backlog/` lifecycle outputs and `.oat/repo/pjm/current-state.md` only after acceptance; related project summary when lifecycle completion occurs.

**Implement:** Run the complete mocked/local acceptance suite, review both stack deltas, confirm no missing canonical/generated files and no raw session data. Complete required code/gate reviews through their lifecycle; record actual evidence. Offer follow-up backlog capture for the deferred external-output and child-trajectory sidecar reads and the observed oat 0.2.79 config rewrite; do not silently expand this implementation or claim a separate follow-up is already scheduled. Close/archive BL-260916-session-fidelity-opt only when every criterion passes, following PJM guidance and doctor adoption check. Do not label live provider support, PR publication, merge or installation complete. Do not archive project artifacts prematurely while review/delivery remains outstanding.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run type-check`, `pnpm run build:check`, `pnpm run test`, `pnpm run validate`, `pnpm run smoke`, `pnpm run validate:skill-versions -- --base-ref "$ACTIVITY_BASE"`, `git diff --check`, and changed-authored-file lint/format checks; `oat pjm doctor --json` before PJM writes. Run the full suite after the final source changes, not repeatedly without cause.

**Commit:** `chore(p06-t02): record session fidelity acceptance and backlog completion`.

## Phase 7: Final review fixes

**Layer:** activity. **Depends on:** the received final lifecycle review at `bc066ea6`.

### Task p07-t01: (review) Reconcile final closeout records

**Files:** `.oat/projects/shared/session-fidelity/plan.md`; `.oat/repo/pjm/current-state.md`; `.oat/repo/pjm/backlog/index.md`.

**Step 1: Understand the issue**

The final review found that the plan completion rollup still reports 3/19 tasks and that the PJM current-state/backlog overview still describes the merged Consensus Review baseline as branch-only. These tracked closeout surfaces contradict the completed implementation and current `origin/main` at `d74abe671561053154d3012e1b8edd11fc079dcf`.

**Step 2: Implement fix**

Update the plan completion rollup to the actual task/review state, refresh the verified repository baseline and Consensus Review merge posture, and retain the accurate boundary that Session Fidelity remains unpublished, unmerged, unreleased, uninstalled and not live-provider-accepted. Update the backlog reference to its archived path while touching the plan.

**Step 3: Verify**

Run `oat pjm doctor --json`, `git diff --check`, and the applicable exact-file Markdown formatting check. Confirm `git rev-parse origin/main` equals the recorded baseline and that the three closeout surfaces agree.

**Step 4: Commit**

```bash
git add .oat/projects/shared/session-fidelity/plan.md .oat/repo/pjm/current-state.md .oat/repo/pjm/backlog/index.md
git commit -m "docs(p07-t01): reconcile final closeout records"
```

### Task p07-t02: (review) Preserve non-missing watch stat errors

**Files:** `src/skills/session-observer/src/lib/watch.ts`; focused watcher tests; affected canonical version/changelog/generated outputs required by repository ownership rules.

**Step 1: Understand the issue**

The final review confirmed that `pollTargets()` maps every non-Cursor `stat` failure to missing-path reset guidance. `ENOENT` and `ENOTDIR` need that path, while permission, descriptor-exhaustion and transient I/O failures must preserve their real cause and must not instruct the operator to reset valid state.

**Step 2: Implement fix**

Retain `WATCH_TRANSCRIPT_PATH_UNAVAILABLE` and reset/re-arm guidance only for `ENOENT` and `ENOTDIR`. For other failures, preserve the original error code/message and advise retry or filesystem repair without state reset. Keep the single error event, watcher exit and unchanged saved offset behavior.

**Step 3: Verify**

Add an injected-`stat` regression for a non-missing failure proving one error event, unchanged state and no reset guidance. Run the focused watcher suite, type checking, build/build freshness, repository validation, affected-owner version validation against `ACTIVITY_BASE`, formatting/linting and `git diff --check`.

**Step 4: Commit**

```bash
git add src/skills/session-observer CHANGELOG.md skills plugins
git commit -m "fix(p07-t02): preserve non-missing watch stat errors"
```

## Phase 8: PR #94 remote review fixes

**Layer:** schema documentation (`session-fidelity`). **Depends on:** the CodeRabbit review of PR #94 at `737d23e6211554864f401288e1d36ac2383c9c7b`. Apply these fixes to the bottom stack layer, then cascade-rebase `session-fidelity-identity` and `session-fidelity-activity` before publishing the stack.

### Task p08-t01: (review) Align completed planning status

**Files:** `.oat/projects/shared/session-fidelity/discovery.md`; `.oat/projects/shared/session-fidelity/design.md`; `.oat/projects/shared/session-fidelity/implementation.md`.

**Step 1: Understand the issue**

PR #94 review finding `m1` identified early summary statements that still describe Fable read-back and planning gates as pending, while later project records show both completed.

**Step 2: Implement fix**

Update only current-status summaries or label historical snapshots explicitly. Preserve the chronology and do not rewrite implementation, review, merge, release, installation, or live-provider boundaries.

**Step 3: Verify**

Run `rg -n 'read-back|read back|Plan review|planning review|pending|passed' .oat/projects/shared/session-fidelity/{discovery.md,design.md,implementation.md,plan.md,state.md,project-log.md}`, `pnpm run validate`, and `git diff --check`. Confirm the three summaries agree with the completed collaboration and planning receipts.

**Step 4: Commit**

```bash
git add .oat/projects/shared/session-fidelity/discovery.md .oat/projects/shared/session-fidelity/design.md .oat/projects/shared/session-fidelity/implementation.md
git commit -m "docs(p08-t01): align completed planning status"
```

### Task p08-t02: (review) Remove withdrawn multi-line recovery guidance

**Files:** `.oat/repo/reference/research/session-schemas-2026-09-18/claude-code/findings.md`.

**Step 1: Understand the issue**

PR #94 review finding `m2` found that the corrected LF-delimited evidence is followed by an obsolete paragraph prescribing escaped-newline record joining, and fixture row 35 repeats that withdrawn parser hazard.

**Step 2: Implement fix**

Delete the obsolete recovery paragraph and fixture row while retaining the evidence-backed LF-byte framing rule, Unicode-separator fixture requirement, and historical correction context.

**Step 3: Verify**

Run `rg -n -i 'joining consecutive|escaped-newline|multi-line record.*parser hazard' .oat/repo/reference/research/session-schemas-2026-09-18/claude-code/findings.md`, `pnpm run validate`, and `git diff --check`. The search must return no active recovery guidance or obsolete fixture row.

**Step 4: Commit**

```bash
git add .oat/repo/reference/research/session-schemas-2026-09-18/claude-code/findings.md
git commit -m "docs(p08-t02): remove withdrawn record recovery guidance"
```

### Task p08-t03: (review) Keep detached MCP results opaque

**Files:** `.oat/repo/reference/research/session-schemas-2026-09-18/inventory.mjs`; `.oat/repo/reference/research/session-schemas-2026-09-18/inventory.canary.test.mjs`.

**Step 1: Understand the issue**

PR #94 review finding `m3` showed that third-party opacity is determined only from the current object. A detached Claude `user.toolUseResult` can therefore expose allowlisted descendant paths and types even when its matching `tool_use` is an MCP call.

**Step 2: Implement fix**

Track MCP `tool_use.id` values within each file and recognize matching detached results through `tool_result.tool_use_id`. Count the carrier while suppressing the matched result subtree from path/type notes. Keep all correlation file-local and fail closed when no exact ID match exists.

**Step 3: Verify**

Add a canary with separate MCP call and result records proving the detached result subtree is absent from both allowlisted and discovery reports while the record remains counted. Run `node --test .oat/repo/reference/research/session-schemas-2026-09-18/inventory.canary.test.mjs`, `pnpm run validate`, and `git diff --check`.

**Step 4: Commit**

```bash
git add .oat/repo/reference/research/session-schemas-2026-09-18/inventory.mjs .oat/repo/reference/research/session-schemas-2026-09-18/inventory.canary.test.mjs
git commit -m "fix(p08-t03): keep detached MCP results opaque"
```

### Task p08-t04: (review) Correct LF framing rationale

**Files:** `documentation/docs/engineering/architecture/session-schemas/index.md`; `documentation/docs/engineering/architecture/session-schemas/codex.md`; `documentation/docs/engineering/architecture/session-schemas/claude-code.md`; `.oat/repo/reference/research/session-schemas-2026-09-18/claude-code/findings.md`.

**Step 1: Understand the issue**

PR #94 review finding `m4` correctly notes that Node documents `readline` as recognizing LF, CR, and CRLF, not U+2028/U+2029. The LF-byte framing requirement remains correct, but the current explanation attributes the abandoned scanner result to unsupported Node behavior.

**Step 2: Implement fix**

Replace the unsupported `readline` claim across the maintained schema pages and source evidence with the observed fact: the earlier scanner treated Unicode separators as record boundaries, while LF-byte splitting parsed the sampled records. Retain the LF-only regression fixture without assigning the faulty split to Node.

**Step 3: Verify**

Run `rg -n 'readline.*U\\+2028|readline.*U\\+2029|breaks lines on U\\+2028' documentation/docs/engineering/architecture/session-schemas .oat/repo/reference/research/session-schemas-2026-09-18`, the file-scoped Markdown format check documented by the repository, `pnpm --dir documentation build`, `pnpm run validate`, and `git diff --check`.

**Step 4: Commit**

```bash
git add documentation/docs/engineering/architecture/session-schemas/index.md documentation/docs/engineering/architecture/session-schemas/codex.md documentation/docs/engineering/architecture/session-schemas/claude-code.md .oat/repo/reference/research/session-schemas-2026-09-18/claude-code/findings.md
git commit -m "docs(p08-t04): correct LF framing rationale"
```

## Phase 9: Final closeout record alignment

**Layer:** activity/closeout (`session-fidelity-activity`). **Depends on:** final review of the complete p08-rebased implementation at `11acfec58445850dea6adb99f860ec402f55fb59`.

### Task p09-t01: (review) Align the project summary with p08 and publication state

**Files:** `.oat/projects/shared/session-fidelity/summary.md`.

**Step 1: Understand the issue**

Final review finding `M1` identified that the generated summary still names p07-t02 as the last task and says publication was outside the implementation run, while authoritative project state records p08 as passed, PRs #94 through #96 as published and ready, and only the rewritten local heads as awaiting republication.

**Step 2: Implement fix**

Update the summary metadata to p09-t01 and revise the overview, implemented work, validation totals, design deltas, challenges, and integration notes to include the four p08 corrections. Distinguish the already-published remote stack from the locally rewritten heads that still await publication. Preserve merge, release, installation, global-sync, and live-provider boundaries.

**Step 3: Verify**

Run `rg -n 'p07-t02|outside this implementation run|p08|published|republication|2,232' .oat/projects/shared/session-fidelity/summary.md`, `oat project validate-plan --project-path .oat/projects/shared/session-fidelity --json`, `pnpm run validate`, and `git diff --check`. Confirm the summary agrees with `state.md`, `implementation.md`, and the live ready PR state without claiming that rewritten heads are already remote.

**Step 4: Commit**

```bash
git add .oat/projects/shared/session-fidelity/summary.md
git commit -m "docs(p09-t01): align project summary with p08"
```

## Reviews

Existing pending scaffold rows are preserved. Quick mode has no spec; that legacy placeholder does not imply a missing spec requirement. The design self-review and Fable collaboration are distinct from the formal plan artifact review below.

| Scope  | Type     | Status          | Date       | Artifact                                                    | Reviewed Head                            | Invocation | Gate Target |
| ------ | -------- | --------------- | ---------- | ----------------------------------------------------------- | ---------------------------------------- | ---------- | ----------- |
| p01    | code     | fixes_required  | 2026-09-19 | reviews/p01-review-2026-09-19T120500Z.md                    | 396307140acc10879e14a7df5307365a5dcb306c | auto       | codex-high  |
| p01    | code     | fixes_completed | 2026-09-19 | reviews/p01-review-2026-09-19T120500Z.md                    | 8affc30a56e8f4c33c6bc50a6d632d93d37baa01 | auto       | codex-high  |
| p01    | code     | passed          | 2026-09-19 | reviews/p01-review-2026-09-19T122907Z-round2.md             | d4069b773c3784b37da796ba40dbd5c3cbc6d228 | auto       | codex-high  |
| p02    | code     | fixes_required  | 2026-09-19 | reviews/p02-review-2026-09-19T141151Z.md                    | 0887c010eb37486f15fceafe5f6adf0d0e1202fa | manual     | -           |
| p02    | code     | fixes_completed | 2026-09-19 | reviews/p02-review-2026-09-19T141151Z.md                    | 4df1cdabd13b7752927eec6c4c7f690a9aad5910 | manual     | -           |
| p02    | code     | fixes_required  | 2026-09-19 | reviews/p02-review-2026-09-19T143548Z-round2.md             | 4df1cdabd13b7752927eec6c4c7f690a9aad5910 | manual     | -           |
| p02    | code     | fixes_completed | 2026-09-19 | reviews/p02-review-2026-09-19T143548Z-round2.md             | 30fc6f3504a7ca6317033167c5e9e4a5b16ec8ec | manual     | -           |
| p02    | code     | passed          | 2026-09-19 | reviews/p02-review-2026-09-19T145413Z-round3.md             | 30fc6f3504a7ca6317033167c5e9e4a5b16ec8ec | manual     | -           |
| final  | code     | fixes_completed | 2026-09-19 | reviews/archived/final-review-2026-09-19T180659Z.md         | c681e491892351785a080bef2b5b9e0bdfebe91b | auto       | -           |
| spec   | artifact | pending         | -          | -                                                           | -                                        | -          | -           |
| design | artifact | pending         | -          | -                                                           | -                                        | -          | -           |
| p03    | code     | passed          | 2026-09-19 | reviews/p03-review-2026-09-19T155150Z.md                    | 7ec1fba9aecc53d6e41ea091df0cfc4399057332 | auto       | codex-high  |
| p04    | code     | passed          | 2026-09-19 | reviews/p04-review-2026-09-19T163743Z.md                    | 7214653b859166fd2cdc55faebe2559afa85fb70 | auto       | codex-high  |
| p05    | code     | passed          | 2026-09-19 | reviews/p05-review-2026-09-19T172318Z.md                    | ef3c4c9b78b3f5218812e2a16f509253d4d3ef6f | auto       | codex-high  |
| p06    | code     | passed          | 2026-09-19 | reviews/p06-review-2026-09-19T175805Z.md                    | 0cd6a6fe6f1b16aa8cc0e5562097fe0688cd6900 | auto       | codex-high  |
| p07    | code     | passed          | 2026-09-19 | reviews/p07-review-2026-09-19T183857Z.md                    | c681e491892351785a080bef2b5b9e0bdfebe91b | auto       | codex-high  |
| plan   | artifact | passed          | 2026-09-19 | -                                                           | -                                        | -          | -           |
| p00    | code     | pending         | -          | -                                                           | -                                        | -          | -           |
| plan   | artifact | passed          | 2026-09-19 | reviews/archived/artifact-plan-review-2026-09-19T003400Z.md | -                                        | -          | -           |
| plan   | artifact | fixes_completed | 2026-09-19 | reviews/archived/artifact-plan-review-2026-09-19T004303Z.md | -                                        | -          | -           |
| plan   | artifact | passed          | 2026-09-19 | -                                                           | -                                        | -          | -           |
| p00    | code     | passed          | 2026-09-19 | reviews/p00-review-2026-09-19T014930Z.md                    | 1d650f130d7b56cb790fbed15733afd625990c20 | auto       | -           |
| final  | code     | passed          | 2026-09-19 | reviews/archived/final-review-2026-09-19T184703Z.md         | d14359fa7188655564275c52c4ddadfbd68055c9 | auto       | -           |
| final  | code     | passed          | 2026-09-19 | reviews/archived/final-review-2026-09-19T190056Z.md         | 9432104ee24f3e5d081049c489394b30ee65b6a5 | gate       | claude-fable-skip-permissions |
| github-pr #94 | code     | fixes_added     | 2026-09-19 | reviews/archived/remote-pr-94-review-2026-09-19T203657Z.md | 737d23e6211554864f401288e1d36ac2383c9c7b | -          | -           |
| github-pr #94 | code     | fixes_completed | 2026-09-19 | reviews/archived/remote-pr-94-review-2026-09-19T203657Z.md | edfbb685040769b6f564bdb2a9eba50160c412b5 | auto       | -           |
| p08    | code     | passed          | 2026-09-19 | reviews/p08-review-2026-09-19T211301Z.md                    | edfbb685040769b6f564bdb2a9eba50160c412b5 | auto       | codex-high  |
| final  | code     | fixes_completed | 2026-09-19 | reviews/archived/final-review-2026-09-19T213154Z.md         | 59549f2f273ff2fa62daad6c47bcd0aa5bd6883f | manual     | -           |
| p09    | code     | passed          | 2026-09-19 | reviews/p09-review-2026-09-19T215345Z.md                    | 59549f2f273ff2fa62daad6c47bcd0aa5bd6883f | auto       | codex-high  |
| final  | code     | passed          | 2026-09-19 | reviews/archived/final-review-2026-09-19T220057Z.md         | b51a106d14ee3d25884b5b24fa8f8949da301f90 | manual     | -           |
| final  | code     | received        | 2026-09-19 | reviews/final-review-2026-09-19T221544Z.md                  | 5dd3627c4552bc40e6b68122cf22b3824897c394 | gate       | claude-fable-skip-permissions |

Structured plan artifact review passed at `56e6b07f774ccba7d472cf4716460c6bf2b77dc5` (request `session-fidelity-plan-review-02`, inherited gpt-6-astra/high): no findings; both prior Medium findings resolved through already-authorized fixture simplification and removal of inventory promotion. The artifact row is the structured in-memory review disposition required by quick-start Step 3.6, which emits no review file; provenance is recorded here rather than in code-review-only columns. The first evaluated lifecycle gate passed its Important threshold, and its qualified handoff was received. Four Medium and three Minor findings were dispositioned in implementation.md and verified by the final gate. The final gate also passed (0 Critical/Important); its one Medium and three Minor precision corrections were applied and checked directly. The latest event remains `fixes_completed` rather than claiming a further independent re-review. No unresolved finding remains; detailed receipts and verification are in implementation.md. Gate scope provenance: legacy-plan-only; the reviewer also consulted discovery/design.

Focused amendment review: inherited gpt-6-astra/high reviewer, exact `7318b358..e3c25f3a` scope; 0 substantive findings, 1 Minor fixed directly by attaching the row to its table. All 19 tasks and retained boundary/budget contracts verified.

## Implementation and Review-Fix Status

**Planned total:** 10 phases, 26 tasks. All tasks and every phase review through p09 passed.

- p00: 1 task — root-owned local stack arrangement.
- p01: 5 tasks — native identity, provenance, documentation and validation.
- p02: 5 tasks — detailed reads and shared activity contract.
- p03: 2 tasks — observer integration.
- p04: 2 tasks — exporter integration and sanitization.
- p05: 2 tasks — Cursor settlement.
- p06: 2 tasks — docs/distribution and acceptance.
- p07: 2 tasks — final-review artifact alignment and watcher diagnostic correction.
- p08: 4 tasks — planning-status alignment, withdrawn parser-guidance cleanup, detached MCP-result opacity, and LF-framing documentation correction.
- p09: 1 task — align the generated project summary with p08 and the current publication boundary.

The schema documentation preparatory commit and all 26 implementation tasks are complete; phase reviews p00 through p09 passed. Phase p08 resolved all four PR #94 findings on the bottom layer and the two upper layers were cascade-rebased. Phase p09 aligned the generated summary with those changes and the current publication boundary. Final re-review, configured exit-gate processing, and stack republication remain. Merge, release, installation and live-provider acceptance are not claimed.

## References

- [Discovery](discovery.md)
- [Design](design.md)
- [Collaboration summary](references/collaboration-summary.md)
- [Native schema reference](../../../../documentation/docs/engineering/architecture/session-schemas/index.md)
- [Dated evidence snapshot](../../../repo/reference/research/session-schemas-2026-09-18/README.md)
- [Archived backlog brief](../../../repo/pjm/backlog/archived/BL-260916-session-fidelity-opt.md)
