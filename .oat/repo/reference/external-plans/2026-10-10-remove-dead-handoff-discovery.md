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
- Live guidance still reads shared Codex identity through `guidance-discovery.ts:142`; the shared metadata rules are not retired with the old wrapper. Existing shared-reader and observer keepers are named in the protection ledger below.
- `preview.test.ts:166` preserves qualified-key ordering; `preview.test.ts:191` preserves the literal mixed-case/punctuation/non-ASCII ordering. `session-observer/src/locate.test.ts:671` preserves exact transcript cwd for colliding Claude slugs; `session-observer/src/lib/locate.ts:794` supplies it.
- Correction to the source description: the discovery **function** is absent from shipped bundles, but the unused `HANDOFF_DISCOVERY_OPTIONS` initializer remains at line 3249 in both `skills/session-fork-to-destination/scripts/session-fork-to-destination.mjs` and `plugins/session/skills/fork-to-destination/scripts/session-fork-to-destination.mjs`. Regeneration should remove it.
- No matching external plan outcome was found. The incidental handoff reference in `2026-09-11-preserve-project-isolation-in-export-selection.md` concerns export selection, not this cleanup. `gh pr list --state open` returned `[]`. Available project files, worktree/branch inventory, and the existing execution program showed no ownership of this outcome; machine-local files outside this worktree were not inspected.
- Planning verification is file-level and read-only. No baseline test run or failure injection was performed; the gates below are required during execution.

## Dependencies

| Type | Dependency | Required state | Current state |
| --- | --- | --- | --- |
| Satisfied predecessor | Retirement in PR #87 | Old executor removed | Merged; changelog and current caller search agree |
| Satisfied coverage | Shared metadata, observer discovery and preview ordering keepers | Existing tests available for execution-time baseline and specified mutation checks | Named in the protection ledger and present in the inspected tree; runtime checks deferred |

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
git diff --stat 9c95f0194e2770f1cedf26f95f3cc93af3b45563..HEAD -- src/skills/session-fork-to-destination src/skills/session-observer/src/lib/locate.ts src/skills/session-observer/src/locate.test.ts src/shared/transcript/runtimes.test.ts src/distributions.ts CHANGELOG.md .oat/repo/reference/decisions/DR-260912-separate-forks-and-handoffs.md skills/session-fork-to-destination plugins/session/skills/fork-to-destination
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
- A dated follow-up annotation to `.oat/repo/reference/decisions/DR-260912-separate-forks-and-handoffs.md` when the helper is actually deleted; preserve the original record. Regenerate its managed index through the owning command if required by decision-record guidance.
- Temporary, restored keeper mutations in `preview.ts`/`discovery.ts` and observer `locate.ts`, solely to prove retained coverage during execution.

Out of scope: shared transcript implementation, observer product changes, guidance
discovery/CLI behavior, new provider support, import/fork design, adjacent dead types
or schema cleanup, provider config, runtime stores, unrelated tests, and a broad
pruning campaign. Preserve `types.ts` contracts and `guidance-discovery.ts`. No permanent
observer edit is expected; if one becomes necessary, stop rather than broadening this cleanup.

## Implementation steps

### 1. Establish baseline and prove the named keepers

Run the four suites before deletion, including the shared metadata keepers:

```sh
pnpm run test:vitest src/skills/session-fork-to-destination/src/discovery.test.ts src/skills/session-fork-to-destination/src/preview.test.ts src/skills/session-observer/src/locate.test.ts src/shared/transcript/runtimes.test.ts
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
For comparator proof, temporarily replace `compareQualifiedSessionIds`'s body with
`return left.localeCompare(right);`, then run:

```sh
pnpm run test:vitest src/skills/session-fork-to-destination/src/preview.test.ts -t 'orders mixed-case, punctuation, and non-ASCII qualified IDs by code unit'
```

Expected: the literal `['codex:Z', 'codex:_', 'codex:a', 'codex:é']` assertion fails
because locale-sensitive order differs from the required UTF-16 code-unit order.
The separate provider-order keeper at `preview.test.ts:166` need not fail under this
mutation; keep it and run it normally. Restore exact source bytes and rerun the
preview suite successfully. A setup error is not a valid mutation failure.

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

Only when the helper is actually deleted, append a follow-up dated with the execution
date to [DR-260912](../decisions/DR-260912-separate-forks-and-handoffs.md). Explain that
its September 16 follow-up described support retained for the now-removed discovery
suite, and that this later cleanup retires that support because its only consumer is
gone. Preserve the September 16 text, original decision, and two-skill boundary; do
not imply provider authorization or passed live gates. Read the decisions `AGENTS.md`
and index, verify declared PJM adoption before writing, and run
`oat decision regenerate-index` after the annotation; never hand-edit its managed
index. This plan correction does not update the decision or claim deletion happened.

**Verify:** repeat the symbol/import scan from the drift check; expect no retired
symbols in canonical source or tests. Generated options may remain until the build.
Run `pnpm run type-check` and the retained-keeper focused command below; expect pass.
Inspect the dated decision annotation against the helper deletion and confirm the
original historical paragraphs remain unchanged.

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

The public boundaries are shared `extractMeta`/`extractMetaFromRecords` identity,
observer `discover` exact-all evidence and enumeration, and `previewHandoffCandidates`
ordering. No new tests are planned. Each row covers the named cases in
`src/skills/session-fork-to-destination/src/discovery.test.ts`; line anchors refer to
the inspected baseline.

| Cases / location | Protection and disposition | Proof / keeper |
| --- | --- | --- |
| `projects exact Codex payload.id instead of legacy or root IDs` (84); `keeps the first physical Codex payload.id authoritative over later inherited metadata` (139) | Retired wrapper projection/native invocation is Obsolete; shared native-ID precedence and first-header authority are Covered | PR #87 for wrapper retirement; shared metadata keepers M1–M4 below preserve the live rules |
| `refuses a Codex transcript with late conflicting cwd evidence` (191) | Retired wrapper error translation is Obsolete; shared late-cwd conflict refusal and path-free diagnostics are Covered | PR #87 for translation retirement; observer keeper D1 below asserts both refusal and absence of target/transcript paths |
| `returns exact Claude sessions from direct and unexpected slugs only` (245); `separates colliding Claude slugs using exact transcript cwd evidence` (331) | Wrapper filtering is Obsolete; live unexpected-slug enumeration and transcript-cwd evidence are Covered | Observer keepers D2 and D3 below; colliding-slug mutation proof above |
| `returns only exact canonical cwd candidates from both providers` (404) | Obsolete projection/canonicalization and private-path omission | PR #87; current guidance discovery is a separate implementation and stays |
| `keeps provider-native ID collisions distinct and sorts by provider then native ID` (433); `orders mixed-case, punctuation, and non-ASCII qualified IDs by code unit` (455) | Retired projection is Obsolete; live ordering is Covered | `preview.test.ts:166` and `:191`; localeCompare mutation specifically proves `:191` guards code-unit ordering |
| `includes old Codex sessions and never marks current from candidate active/recency fields` (475); `marks current only from exact direct identity and ignores unrelated signals` (495) | Retired candidate/current-identity projection is Obsolete; live old-session enumeration in exact-all is Covered | PR #87 for wrapper projection retirement; observer keeper D4 below; current guidance identity behavior stays |
| `deduplicates identical provider records without selecting the most recent copy` (520); `projects shared epoch-second mtimes to the millisecond schema contract` (532) | Obsolete retired discovery deduplication and time projection | PR #87; preserve live schema definitions/tests |
| `refuses conflicting duplicates and incomplete provider discovery` (548); `refuses the complete set when discovered cwd canonicalization returns %s` (both null/throw rows, 575); `refuses the complete set when a discovered candidate has no recorded cwd` (601); `refuses invalid projected candidate fields instead of returning a partial set` (619) | Obsolete retired wrapper fail-closed paths and diagnostics | PR #87; no production callers; current guidance and observer refusal contracts stay |

Named live keepers (paths and lines refer to the inspected baseline):

| ID | Existing test | Assertion that preserves the live protection |
| --- | --- | --- |
| M1 | `src/shared/transcript/runtimes.test.ts:842` — `uses the first Codex header identity instead of a legacy caller id` | Native `payload.id` wins over a distinct top-level legacy `sessionId` and root `payload.session_id`; literal native/root/fork-parent identities remain distinct |
| M2 | `src/shared/transcript/runtimes.test.ts:774` — `uses the first physical session header for a root rollout` | Literal session/native/root IDs and recorded cwd come from the physical root header |
| M3 | `src/shared/transcript/runtimes.test.ts:791` — `keeps child, root, and direct parent identity distinct from inherited headers` | Literal child, root and direct-parent IDs remain distinct despite inherited headers |
| M4 | `src/shared/transcript/runtimes.test.ts:990` — `accepts inherited parent headers after the physical Codex identity header` | Two headers with IDs `one` then `two` yield session/native ID `one` |
| D1 | `src/skills/session-observer/src/locate.test.ts:578` — `codex exact-all rejects %s path-free`, especially `late top-level conflict` and `late payload conflict` rows | Real discovery throws `DISCOVERY_TRANSCRIPT_INCOMPLETE`; diagnostic text contains neither target cwd nor transcript path |
| D2 | `src/skills/session-observer/src/locate.test.ts:761` — `claude-code exact-all enumerates unexpected project slugs after a direct hit` | A direct hit and an unexpected slug both yield the literal session IDs and transcript-record cwd evidence |
| D3 | `src/skills/session-observer/src/locate.test.ts:671` — `claude-code exact-all uses exact transcript cwd evidence, not the colliding direct slug` | Colliding slug candidates keep their distinct literal transcript cwd values; prove with the mutation above |
| D4 | `src/skills/session-observer/src/locate.test.ts:1150` — `codex exact-all includes old sessions while default discovery remains recent-only` | The same stale transcript is absent in default discovery and present under exact-all |

The [September 26 pruning campaign](../reviews/2026-09-26-session-observer-test-pruning-campaign.md)
explicitly withdrew deletion of the late-conflicting-cwd case because its proof was
not airtight. That withdrawal is not deletion permission. This plan separates the
retired wrapper translation from the still-live shared refusal and points to D1's
same late-evidence inputs and path-free assertions; execution must retain and baseline
those keeper rows before deletion. If the mapping no longer holds, retain the case
and stop. M1 already covers native-ID precedence over legacy/root IDs; no missing
coverage or speculative replacement test is claimed.

The first case's `buildNativeInvocation` assertion does not justify keeping the test-only
behavior-contract helper after the executor retirement. The helper's entire export set
has been searched, not just that one function. Do not use a passing remaining suite as
the deletion proof; use retirement evidence only for wrapper-specific behavior, the
explicit shared-behavior keeper mappings, and the specified mutation proofs.

After deletion, run:

```sh
pnpm run test:vitest src/skills/session-fork-to-destination/src/preview.test.ts src/skills/session-observer/src/locate.test.ts src/shared/transcript/runtimes.test.ts
```

Expected: all three retained suites pass unchanged. The full repository suite additionally covers
current guidance discovery, CLI and import paths. Never add live-provider calls for this cleanup.

## Done criteria

- Retired discovery symbols and the test-support module have no remaining source, test, or generated-runtime reference; historical records may retain their names.
- `compareQualifiedSessionIds` and its live preview import remain, with the same code-unit ordering.
- The mixed-case preview keeper fails under `localeCompare`, and the observer colliding-slug keeper fails under the wrong-cwd mutation; both pass after exact restoration. The separate provider-order keeper and all named shared/observer keepers pass normally.
- Every deleted test protection matches the ledger; no unclassified live protection is lost.
- The dated DR-260912 follow-up records the actual helper retirement while preserving its historical text and two-skill boundary; its managed index is regenerated through the owner.
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
