---
oat_external_plan: true
oat_generated: true
oat_external_plan_source: backlog-review
oat_external_plan_sources:
  - .oat/repo/pjm/backlog/reviews/backlog-and-roadmap-review.md
  - .oat/repo/pjm/backlog/reviews/priority-alignment.md
  - .oat/repo/pjm/backlog/items/BL-260927-remove-dead-handoff-discovery.md
oat_external_plan_commit: 9c95f0194e2770f1cedf26f95f3cc93af3b45563
oat_external_plan_main_commit: 9c95f0194e2770f1cedf26f95f3cc93af3b45563
oat_external_plan_date: '2026-10-10'
created: '2026-10-11T00:16:47Z'
oat_execution_status: READY
oat_backlog_items:
  - BL-260927-remove-dead-handoff-discovery
oat_issue_url: null
---

# Remove retired handoff discovery and preserve live preview behavior

> This is an external implementation plan, not a canonical OAT project `plan.md`.
> Execute it directly after authorization, or optionally import it with
> `oat-project-import-plan .oat/repo/reference/external-plans/2026-10-10-remove-dead-handoff-discovery.md`.
> This planning wave does not authorize implementation or import.

**Execution status: READY.** No unsatisfied hard dependency remains. Retirement of
the old executor is merged; the live comparator and observer keeper already exist.

## Outcome

Remove `discoverHandoffCandidates`, its exclusive discovery machinery, and obsolete
test support from `session-fork-to-destination`. Preserve preview ordering and the
observer's exact-all Claude transcript-cwd behavior. The current guidance discovery,
preview, prepare, and import commands retain their behavior.

## Source and live evidence

- Source: [BL-260927-remove-dead-handoff-discovery](../../pjm/backlog/items/BL-260927-remove-dead-handoff-discovery.md), open with settled acceptance criteria.
- Inspected HEAD and fetched `origin/main`: `9c95f0194e2770f1cedf26f95f3cc93af3b45563`; merge-base is the same. Planning date: October 10, 2026 (operator timezone).
- `git status --porcelain` was empty before plan writes.
- The September 20 living review and priority alignment did **not** consider this September 27 item. Selection comes from the approved single-item outline plus independent verification, not from a stale review ranking.
- `src/skills/session-fork-to-destination/src/discovery.ts:28` owns `compareQualifiedSessionIds`; `preview.ts:9` imports it and `preview.ts:222` calls it.
- `discovery.ts:217` exports the retired discovery function. Searches in `src/`, `scripts/`, `tests/`, and generated `skills/`/`plugins/` find only its declaration, internal references, and `discovery.test.ts` callers. Other exported discovery-specific symbols have no outside consumer.
- `discovery.test.ts:20` is the only importer of `helpers/behavior-contracts.ts`; that helper's opening comment explicitly identifies it as support retained for this suite after executor retirement. Its exported symbols have no other caller in the searched surfaces.
- [PR #87](https://github.com/tkstang/skills/pull/87) merged on September 17, 2026 (`d3ad2848051f348aba6fb8390cf88f657303b716`), deleting the old executor. `CHANGELOG.md:510` records the retirement. The [test-pruning report](../reviews/2026-09-26-session-observer-test-pruning-campaign.md) names this cleanup as deferred work.
- `preview.test.ts:166` preserves qualified-key ordering; `preview.test.ts:191` preserves the literal mixed-case/punctuation/non-ASCII ordering. `session-observer/src/locate.test.ts:671` preserves exact transcript cwd for colliding Claude slugs; `session-observer/src/lib/locate.ts:794` supplies it.
- Correction to the source description: the discovery **function** is absent from shipped bundles, but the unused `HANDOFF_DISCOVERY_OPTIONS` initializer remains at line 3249 in both `skills/session-fork-to-destination/scripts/session-fork-to-destination.mjs` and `plugins/session/skills/fork-to-destination/scripts/session-fork-to-destination.mjs`. Regeneration should remove it.
- No matching external plan outcome was found. The incidental handoff reference in `2026-09-11-preserve-project-isolation-in-export-selection.md` concerns export selection, not this cleanup. `gh pr list --state open` returned `[]`. Available project files, worktree/branch inventory, and the existing execution program showed no ownership of this outcome; machine-local files outside this worktree were not inspected.
- Planning verification is file-level and read-only. No baseline test run or failure injection was performed; the gates below are required during execution.

## Dependencies

| Type | Dependency | Required state | Current state |
| --- | --- | --- | --- |
| Satisfied predecessor | Retirement in PR #87 | Old executor removed | Merged; changelog and current caller search agree |
| Satisfied coverage | Preview ordering and observer colliding-slug keepers | Existing tests available for execution-time baseline and mutation checks | Present in the inspected tree; runtime checks deferred |

No unsatisfied hard dependency remains. Ordinary local test tools are available from
repository development dependencies; their availability is not live-provider acceptance.

## Landing-event impact

| Event | Affected | Files in common | Required update |
| --- | --- | --- | --- |
| A new PR or project claims this cleanup | Ownership | `discovery.ts`, `discovery.test.ts` | Stop and coordinate; do not duplicate its work |
| Guidance/import or preview changes land | Caller and version evidence | Fork skill, generated bundles | Repeat caller scan and select a version above the new base |
| Observer discovery changes land | Keeper proof | `locate.ts`, `locate.test.ts` | Re-anchor and rerun the colliding-slug mutation proof |

## Drift check

Before edits, fetch the intended base, inspect the exact execution HEAD, and run:

```sh
git diff --stat 9c95f0194e2770f1cedf26f95f3cc93af3b45563..HEAD -- src/skills/session-fork-to-destination src/skills/session-observer/src/lib/locate.ts src/skills/session-observer/src/locate.test.ts src/distributions.ts CHANGELOG.md skills/session-fork-to-destination plugins/session/skills/fork-to-destination
rg -n 'discoverHandoffCandidates|HANDOFF_DISCOVERY_OPTIONS|HandoffDiscoveryError|HandoffDiscoveryDependencies|readExactCodexNativeId|buildNativeInvocation|behavior-contracts' src scripts tests skills plugins
```

Expected: discovery still has no production caller, comparator remains live, and helper
imports remain exclusive to the removed tests. Also repeat ownership/plan checks. A
new caller, keeper loss, or materially changed contract is a STOP condition. Within a
later execution wave, repeat this comparison after predecessor integration against
that exact execution HEAD; preserve the authored provenance above.

## Repository conventions

Read root `AGENTS.md`, `src/AGENTS.md`, `src/skills/author-skill/SKILL.md`, and
`deliberate-testing` before implementation. Node >=22 and pnpm 10.13.1 are the
inspected package requirements. Edit canonical source, then use `pnpm run build`;
never hand-edit generated payloads. Changed skill sources/tests require an increased
quoted `metadata.version` and a matching Unreleased changelog entry. Current fork
version is `0.3.3`; choose the next patch above the actual execution base.

Use `pnpm run test:vitest <paths>` for focused tests, `pnpm run type-check` for types,
`pnpm run test`, `pnpm run validate`, `pnpm run build:check`, `pnpm run smoke`, and
`pnpm run validate:skill-versions -- --base-ref origin/main` for repository gates
(substitute the actual PR base for a stack). Run non-mutating `oxlint` and
`oxfmt --check` over changed authored code and Markdown according to the repository's
incremental policy; exclude generated and `.oat` paths. Use Conventional Commits.
Do not install global skills, run providers, publish, merge, or alter runtime stores.

## Scope

In scope:

- `src/skills/session-fork-to-destination/src/discovery.ts`: retain the comparator and its `SessionCandidate` type import; remove exclusive discovery code and imports.
- `src/skills/session-fork-to-destination/src/discovery.test.ts`: remove only after every protection below is accounted for.
- `src/skills/session-fork-to-destination/src/helpers/behavior-contracts.ts`: delete after repeating its exclusive-consumer check; no remaining suite should import it.
- The fork skill's `SKILL.md` version, `CHANGELOG.md`, and build-generated standalone/plugin copies of that skill.
- Temporary, restored keeper mutations in `preview.ts`/`discovery.ts` and observer `locate.ts`, solely to prove retained coverage during execution.

Out of scope: shared transcript implementation, observer product changes, guidance
discovery/CLI behavior, new provider support, import/fork design, adjacent dead types
or schema cleanup, provider config, runtime stores, unrelated tests, and a broad
pruning campaign. Preserve `types.ts` contracts and `guidance-discovery.ts`. No permanent
observer edit is expected; if one becomes necessary, stop rather than broadening this cleanup.

## Implementation steps

### 1. Establish baseline and prove the named keepers

Run the three suites before deletion:

```sh
pnpm run test:vitest src/skills/session-fork-to-destination/src/discovery.test.ts src/skills/session-fork-to-destination/src/preview.test.ts src/skills/session-observer/src/locate.test.ts
pnpm run build:check
```

Expected: pass, or record any baseline failure and resolve its cause without deleting
a failing keeper. Prove the observer keeper by temporarily changing only the direct
Claude candidate's `recordedCwd` expression at `locate.ts:794` to `targetCwd`, then run:

```sh
pnpm run test:vitest src/skills/session-observer/src/locate.test.ts -t 'claude-code exact-all uses exact transcript cwd evidence'
```

Expected: failure because `cc-colliding` reports the wrong cwd. Restore the exact
pre-mutation bytes and rerun; expect pass. These tests import canonical source, so no
bundle rebuild is needed for this mutation. Do not mutate while a runner is active.
For comparator proof, temporarily reverse its ordering result; the two named preview
ordering keepers must fail with wrong key order. Restore and rerun both successfully.
A setup error is not a valid mutation failure.

### 2. Remove only retired implementation and support

Keep `compareQualifiedSessionIds` in `discovery.ts` with unchanged semantics and import
path. Remove `discoverHandoffCandidates`, `readExactCodexNativeId`, discovery options,
discovery-only exported types/error/dependency seams, `PROVIDER_RUNTIME`,
`DEFAULT_DEPENDENCIES`, and private `candidateSignature`, `identityMap`,
`validateProviders`, `projectCandidate`, plus their now-unused imports.

Delete the discovery suite only after its protection ledger below is satisfied.
Delete `helpers/behavior-contracts.ts` as exclusively obsolete test support; its native
invocation assertion belongs to the retired executor, not the current guidance command.
Do not keep compatibility wrappers or create replacement helper-level tests.

**Verify:** repeat the symbol/import scan from the drift check; expect no retired
symbols in canonical source or tests. Generated options may remain until the build.
Run `pnpm run type-check` and the preview/locate focused command below; expect pass.

### 3. Version, regenerate, and validate

Bump only `session-fork-to-destination` as required by this source delta. Add a Removed
entry naming its new version and retired discovery/test support; do not claim changes
to current provider discovery behavior. Regenerate with `pnpm run build`, inspect the
diff, and verify the dead options initializer is gone from both owned bundles. Plugin
release versions are independent; this cleanup does not invent a plugin release.

**Verify:** `pnpm run build:check`, `pnpm run test`, `pnpm run validate`,
`pnpm run smoke`, `pnpm run type-check`, and the actual-base skill-version guard all
exit 0. Run changed-authored-file lint/format checks and `git diff --check`. Report
production versus test/support line deltas separately. Do not repair unrelated drift.

## Test protection ledger

The public boundaries are `previewHandoffCandidates` ordering and observer `discover`
exact-all cwd evidence. No new tests are planned. Each row covers the named cases in
`src/skills/session-fork-to-destination/src/discovery.test.ts`; line anchors refer to
the inspected baseline.

| Cases / location | Protection and disposition | Proof / keeper |
| --- | --- | --- |
| `projects exact Codex payload.id instead of legacy or root IDs` (84); `keeps the first physical Codex payload.id authoritative over later inherited metadata` (139) | Obsolete retired discovery projection and native invocation contract | PR #87 and changelog retirement; shared metadata readers remain untouched |
| `refuses a Codex transcript with late conflicting cwd evidence` (191) | Obsolete retired wrapper's refusal/redacted diagnostics | PR #87; do not infer that shared observer refusal is obsolete or delete its tests |
| `returns exact Claude sessions from direct and unexpected slugs only` (245); `separates colliding Claude slugs using exact transcript cwd evidence` (331) | Obsolete wrapper filtering; underlying transcript-cwd protection is Covered | Observer `locate.test.ts:671` named colliding-slug keeper; required mutation proof above |
| `returns only exact canonical cwd candidates from both providers` (404) | Obsolete projection/canonicalization and private-path omission | PR #87; current guidance discovery is a separate implementation and stays |
| `keeps provider-native ID collisions distinct and sorts by provider then native ID` (433); `orders mixed-case, punctuation, and non-ASCII qualified IDs by code unit` (455) | Retired projection is Obsolete; live ordering is Covered | `preview.test.ts:166` and `:191`; required reverse-order mutation proof |
| `includes old Codex sessions and never marks current from candidate active/recency fields` (475); `marks current only from exact direct identity and ignores unrelated signals` (495) | Obsolete retired candidate projection/current-identity API | PR #87; current identity behavior in guidance code stays |
| `deduplicates identical provider records without selecting the most recent copy` (520); `projects shared epoch-second mtimes to the millisecond schema contract` (532) | Obsolete retired discovery deduplication and time projection | PR #87; preserve live schema definitions/tests |
| `refuses conflicting duplicates and incomplete provider discovery` (548); `refuses the complete set when discovered cwd canonicalization returns %s` (both null/throw rows, 575); `refuses the complete set when a discovered candidate has no recorded cwd` (601); `refuses invalid projected candidate fields instead of returning a partial set` (619) | Obsolete retired wrapper fail-closed paths and diagnostics | PR #87; no production callers; current guidance and observer refusal contracts stay |

The first case's `buildNativeInvocation` assertion does not justify keeping the test-only
behavior-contract helper after the executor retirement. The helper's entire export set
has been searched, not just that one function. Do not use a passing remaining suite as
the deletion proof; use the retirement evidence and the two explicit keeper proofs.

After deletion, run:

```sh
pnpm run test:vitest src/skills/session-fork-to-destination/src/preview.test.ts src/skills/session-observer/src/locate.test.ts
```

Expected: both suites pass unchanged. The full repository suite additionally covers
current guidance discovery, CLI and import paths. Never add live-provider calls for this cleanup.

## Done criteria

- Retired discovery symbols and the test-support module have no remaining source, test, or generated-runtime reference; historical records may retain their names.
- `compareQualifiedSessionIds` and its live preview import remain, with the same code-unit ordering.
- Both named preview keepers and the observer colliding-slug keeper fail for the intended injected defect and pass after exact restoration.
- Every deleted test protection matches the ledger; no unclassified live protection is lost.
- The skill version is greater than the actual base and its changelog entry is present; generated outputs are fresh and dead options are absent.
- Focused tests and all repository gates above pass; any platform limits are explicit.
- `git diff --check` passes and no unexplained or out-of-scope file remains changed.

## STOP conditions

Stop and report if a production caller or independently documented live API is found;
another owner claims the outcome; a keeper is absent, fails on baseline, or survives
the intended mutation; permanent observer/shared/runtime changes are needed; generation
requires unrelated version or output changes; or a gate fails twice after one bounded
in-scope correction. Missing prerequisite tools must be reported with repository setup
guidance. Do not turn a baseline failure into a deletion rationale.

## Revalidation Before Execution

Repeat provenance, caller and ownership checks when time passes, base advances, any
landing event above occurs, or cited lines drift. Re-read the backlog criteria and
all changed relevant contracts. A new matching plan is a coordination event, not
permission to supersede it. Refresh against exact execution HEAD after any predecessor
integration; preserve this plan's original inspected SHA.

## Review focus

Review the separation between the retired wrapper and current guidance discovery,
the complete deletion-protection ledger, exact restoration of temporary mutations,
comparator preservation, and generated initializer removal. Confirm no live provider,
installation, publication, or runtime-store acceptance is implied by synthetic tests.
