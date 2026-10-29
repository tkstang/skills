---
oat_template: true
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-10-29
oat_phase: plan
oat_phase_status: in_progress
oat_plan_hill_phases: [] # [] = none for brief modes
oat_plan_parallel_groups: [] # groups of phases that run concurrently in worktrees; [] = fully sequential
oat_plan_source: brief
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Project Brief: session-toolkit

## Goal

Create `@tkstang/session-toolkit` with the `seshtk` CLI as the maintained owner of provider/session identity, transcript discovery, parsing and reads, historical search, export, and structured activity extraction shared by Skills and ORC. Remove duplicated authored provider logic while preserving the capabilities each repository already provides.

## Outcomes

1. **A public library and CLI install independently of this checkout.** Evidence: an inspected npm tarball installs in a clean temporary location; its public API imports without side effects; installed `seshtk --version`, help, machine-readable capabilities, and a representative controlled-fixture operation work on supported Node 22 and 24 versions. Packed dependencies contain no private workspace packages or unresolved workspace specifications.
2. **Shared provider facts preserve the complementary strengths of both donors.** Evidence: representative Claude Code, Codex, and Cursor fixtures demonstrate exact identity, ambiguity/unavailability, lineage, discovery, detailed source coordinates, bounded reads, and incomplete/malformed input behavior. ORC's fail-closed evidence and revalidation combine with observer lineage; heuristic historical selection remains distinct from exact current identity.
3. **The toolkit provides the requested search, export, and activity capabilities.** Evidence: CLI behavior checks cover the existing stateless search tiers and widening/scan-limit outcomes; sanitized Markdown retains safe defaults and explicit tool inclusion; complete activity output preserves provenance, usage, and coverage without being described as sanitized/shareable. Lossy digest projections do not become the sole source for search or activity.
4. **Skills and ORC use one authored session engine.** Evidence: the consumer inventory maps each migrated callsite to the toolkit API, CLI, or bundled package source; selected skills and hooks pass their integration checks; ORC passes integration checks with a declared published semver dependency. Duplicate authored provider engines and redundant generic `orc session-log` command entrypoints are removed after parity, with updated callers and routing documentation. Enriched ORC `self-identify` and host integrations continue to work.
5. **Interactive CLI users learn when a newer release is available.** Evidence: controlled version-check cases demonstrate a notice for a newer stable release, no notice for a current version, and successful session commands when the lookup fails. Notices preserve stdout contracts and remain quiet for unattended hooks and machine-oriented invocations.
6. **The package and migrated consumers reach the agreed delivery endpoint.** Evidence: merged Skills and ORC PRs, an installed published npm release matching the validated archive, applicable skill/plugin releases, and recorded consumer verification against that release. CI and release documentation describe the package's independent version, first-publication bootstrap, and subsequent trusted publishing.

## Approach

### Package and consumer boundaries

Use a small pnpm workspace with one public library + CLI package at `packages/session-toolkit/`. Keep root repository tooling private, existing canonical skills and generated distributions in place, and the separately locked documentation app outside workspace globs. Use the Foundations ESM/TypeScript library and agent-facing CLI conventions, including command factories and boundary validation where appropriate; donor CLIs currently parse arguments manually, so the new CLI boundary is new work.

Expose an intentional typed library API and the `seshtk` bin from the same package. Library imports must not scan stores, parse process arguments, run a CLI main function, exit the process, or write state. Keep raw/detailed provider evidence separate from conversation, digest, search, and activity projections. Preserve provider-specific coordinates and coverage states rather than flattening them into one message count. Public exports are deliberate semver commitments; internal search stages need not become public APIs.

ORC imports the published library. Keep its observation bridge, `RuntimeSessionObservation`, action policy, live Orca/T3 probes, terminal-attention policy, and host enrichments in ORC. The dependency direction is ORC → toolkit; the toolkit must not depend on ORC or its private packages. Preserve existing consumer state ownership and formats initially. Shared readers can support watch/catch-up without introducing a new shared state store.

Interactive skills invoke compatible `seshtk` commands. A missing or incompatible executable produces a clear prerequisite choice: persistent installation or fetched execution of an explicitly selected version using `npx --package=@tkstang/session-toolkit@<approved-version> seshtk ...`. Skills check version and required capabilities and reuse valid checks within the session. They never silently fetch `@latest`. Unattended hook entrypoints bundle the functions they need from this same authored package source at build time, retaining offline execution without prompts or runtime downloads. No copied-parser fallback is maintained.

### Behavior and runtime

Support Node 22 and 24. Determine the exact minimum Node 22 patch and compatible dependency versions from actual APIs and dependencies, then declare and verify that floor. Run release tooling on Node 24 independently of the consumer minimum. Keep the existing repository package-manager/toolchain pins unless a concrete package requirement necessitates a scoped change.

Exact self-identification requires exact evidence and explicit ambiguity/unavailability states. Historical discovery/search may rank candidates, but a unique same-cwd or newest transcript does not become exact current identity. Merge donor identity strengths without treating parent/grouping IDs as interchangeable session/thread IDs.

Preserve stateless history → metadata → content → deep/tool-output search, with current redaction, widening, deadlines, and scan controls. Preserve safe conversational export defaults, explicit tool inclusion, and the separate sensitive rich-activity output contract. Transcript operations remain read-only; explicit export destinations and existing consumer state are separate write boundaries.

CLI machine mode emits one stable JSON envelope on stdout; diagnostics use stderr, errors expose stable codes and actionable hints, and commands support noninteractive operation. Ship version and machine-readable capabilities. Update notifications are best-effort and cached, appear on interactive invocations through stderr, and never cause session commands to fail. Suppress notices and automatic update checks in hook and machine contexts. No automatic upgrades are introduced; cache/check details are phase-local choices.

### Release and migration

Adapt Exhibit's single-package validation and exact-archive handoff, plus OAT's inspection of packed metadata and non-public workspace dependency names. Use separate validation, release dry-run, and publication responsibilities with npm trusted publishing after the first-publication bootstrap. Use one independent toolkit SemVer and curated changelog; retain existing independent skill/plugin version semantics. Choose a package-specific tag namespace that coexists with existing release tags. Do not copy OAT's five-package release coordinator.

Package publication precedes production consumer cutover requiring that version. Test unreleased ORC integration through a locally packed tarball and an uncommitted override; no local paths or development overrides enter release commits. ORC's 24-hour `minimumReleaseAge` hold remains in force: wait for eligibility unless the user explicitly chooses a narrow exemption. Publishing alone does not prove consumer migration or installation acceptance.

Migrate the actual workflows described by ORC's skill guidance, including the observer path, alongside API consumers. Inventory the existing `locate/select/read/catch-up/export/forget` operations and their selection-state semantics. Remove redundant generic commands only once replacement behavior and affected callers are verified. Preserve ORC's enriched `self-identify`. Do not silently discard or reinterpret existing selection/cursor state; a material state-contract change requires realignment.

ORC changes receive an independent ad-hoc `oat-review-provide <base>..<head>` review executed in the ORC checkout before merging. Record explicit scope, ORC checkout path, base/head SHAs, PR links, review artifact location, and per-finding dispositions in the p05 journal; the final integrated review receives that ORC checkout path and range alongside the Skills phase anchors, so it can inspect both repositories directly. Do not pass ORC SHAs to the Skills-only project range resolver. Before each p04 merge or publication, independently review the relevant publish-ready release or migration candidate on its explicit commit range; publication also requires verification that the archive is the reviewed release artifact. These pre-action reviews supplement the built-in anchored phase review; merge, publish, and install receipts become exit evidence only after the respective reviews and checks pass. When p04 becomes concrete, document a branch strategy that preserves earlier phase heads as ancestors across squash-only merges (for example, retain the project branch and merge `main` back after each squash merge), and record the strategy and review anchors in the journal.

## Constraints and Out of Scope

- Preserve one authored provider implementation across CLI and bundled-hook distributions. Generated shipped copies are acceptable; independently maintained engine copies are not.
- Keep Node 22 consumers supported and verify Node 22 and 24. Hook bundling does not supply a different Node runtime.
- Respect existing sanitization, provider-fidelity, stateless-search, source-coordinate, ambiguity, and bounded-read contracts. Avoid live transcript contents in fixtures, logs, and public release artifacts.
- Update canonical skill versions, generated payloads, affected plugin releases, changelogs, human documentation, and governing instructions alongside their changes. Package-source edits bundled into skills must participate in version-impact checks.
- Amend the dependency/no-install instructions explicitly for migrated interactive skills; preserve the self-contained hook promise. Revise or supersede the relevant parts of DR-260514-session-observer-is-standalone and DR-260604-shared-transcript-knowledge through the decision workflow; retain behavioral plugin grouping in DR-260914-session-and-consensus-plugin and build contracts in DR-260616-build-time-import-rewrites where they still apply.
- No compatibility aliases, redundant wrapper commands, or old-name fallbacks are selected. The user selected removal after verified parity.
- Out of scope: Stoa adapter migration, a persistent search index, remote synchronization, a daemon, a plugin registry, unified consumer state storage, automatic upgrades, new host integrations, terminal-attention extraction, and changes to native import/fork behavior beyond consuming shared read primitives where necessary.
- Do not close BL-260619-shared-session-log-substrate: it concerns stateless multi-session activity merge, not this package extraction. Other backlog items close only if their own acceptance criteria are actually met.

## Decisions

- **Naming (accepted):** package `@tkstang/session-toolkit`, command `seshtk`, per DR-261028-session-toolkit-naming. `stk` and `sesh` were rejected after finding CLI conflicts.
- **Home (accepted):** one public package in a small workspace here. Co-locating engine and skill changes is worth bounded build/release tooling; separate-repository and ORC-owned publication were rejected.
- **Distribution (accepted):** CLI prerequisites for interactive skills; build-time bundling from the same package source for unattended hook entrypoints. This retains autonomous/offline hooks at the cost of rebuilding and updating bundled consumers for engine fixes. A preinstalled CLI requirement for every hook and bundling every skill were not selected.
- **Runtime (accepted):** support Node 22 and 24, with verification on both. Raising the consumer minimum to Node 24 solely to match CI/Foundations was rejected. OAT already separates its Node 22 consumer floor from Node 24 publication tooling.
- **CLI update notice (required):** notify interactive users of a newer release with cached best-effort checks, stderr notices, and quiet hook/machine behavior. This adds limited registry access and local cache state to interactive CLI operation; session operations remain usable when checks fail. No notification was rejected because it omits the requested behavior; uncached registry checks on every invocation were rejected because they add unnecessary network use and latency.
- **Scope (requested):** identity, discovery, parsing/reads, search, export, and activity belong in this delivery. Stage shared core before complementary features without declaring the requested toolkit complete early. Avoid unnecessarily broad public library exports.
- **ORC cutover (accepted):** remove redundant `orc session-log` entrypoints after parity and update callers/docs; retain enriched identity and host integrations. Keeping redundant command surfaces was rejected.
- **Release references (requested):** adapt Exhibit for one-package exact-artifact publication and OAT for workspace package validation, alongside Foundations. Multi-package lockstep and Changesets are unnecessary for this package.
- **Delivery (accepted):** merged, published, and migrated across Skills and ORC. Reviewed PRs alone are insufficient.
- **Review setup (accepted):** High managed dispatch ceiling. The user disabled the optional additional cross-runtime phase gate and kept both configured brief and implementation lifecycle gates. Built-in per-phase and final reviews remain required.
- **Workflow (selected):** brief fits one cross-repository delivery with settled architecture and phase-level evidence. Tasks remain execution records; no up-front task plan or additional discovery/spec/design document is required.

## Known Unknowns

- Exact supported Node 22 patch, dependency versions, CLI envelope/capability schema, and exported type boundaries — settled by p01 against donor contracts and clean packed-package checks.
- Caller-to-command mapping and selection/cursor-state dependencies, including actual ORC observer routing — inventoried in p01; verified and resolved within unchanged consumer contracts in p04/p05. Material state redesign triggers realignment.
- Provider-specific identity-variable semantics, parser/projection differences, malformed tails, and fidelity gaps — resolved in p02/p03 using donor fixtures and bounded representative evidence.
- npm publishing account rights, first-publish bootstrap, trusted-publisher configuration, package release tag namespace, and coexistence with existing CI — investigated in p01; executed and evidenced in p04. Missing credentials or human-only bootstrap steps are reported rather than bypassed.
- Exact skill/plugin release set and the propagation of bundled package changes into skill version checks — resolved in p01 inventory and p04 migration.
- ORC's fresh-version eligibility — resolved in p05 by waiting for the configured 24-hour hold unless a narrow exception is explicitly authorized.

## Delivery endpoint and authority

- **Endpoint:** merged — Skills and ORC changes merged, the toolkit published, applicable migrated skill/plugin releases delivered, and actual consumers verified against the published version. Package publication precedes consumer cutover that depends on it.
- **Authority:** the user approves the reviewed brief once. After approval and invocation of implementation, the agent may implement, verify, open and merge required PRs, publish the agreed package/releases, and migrate consumers subject to required checks and independent reviews. Root retains credential and irreversible-action execution; request any needed secret through the host secret mechanism. Material changes to outcomes, approach, constraints, endpoint, or authority require realignment. Brief authoring does not activate implementation.
- **Acceptance:** the agent accepts phases from recorded exit evidence and review dispositions within the approved scope. Registry/package settings requiring unavailable account access remain explicit blockers. General provider certification and untested marketplace paths are never inferred from fixture or local-install results.

## Milestones

## Phase p01: Establish the package boundary and release contract

**Intent:** Add the minimal workspace and one public library/CLI package; settle intentional contracts, consumer mapping, runtime floor, package checks, and the scoped instruction/build changes needed for a shared engine. Establish validation and a release dry run using the applicable Exhibit/OAT patterns without publishing or cutting consumers over prematurely.
**Exit evidence:** The API and command/capability contract and consumer/state inventory are recorded; the package builds and type-checks; a clean tarball install imports its API and runs version/help/capabilities on the declared Node 22 floor and Node 24; packed contents/dependencies are validated; scoped repository checks pass; release/bootstrap/tag strategy and prerequisites are documented; no production skill requires an unpublished package version.
**Provisional:** no

## Phase p02: Consolidate identity, discovery, reads, and safe export

**Intent:** Merge donor provider knowledge and complementary identity/lineage behavior into the package, with bounded detailed reads and explicit safe export projections. Remove replaced donor source only as consumers transition, retaining a traceable migration inventory.
**Exit evidence:** Representative provider regression fixtures and parity evidence cover exact/ambiguous/unavailable identity, discovery/ranking separation, lineage, source coordinates, incomplete/malformed tails, sanitization and opt-in tools. Import safety and Node 22/24 checks pass; any discovered behavior difference has an explicit disposition.
**Provisional:** yes

## Phase p03: Add search, activity, and CLI update notices

**Intent:** Bring the requested stateless search and rich activity behavior into the package with a narrow public surface and consistent CLI outcomes. Add interactive version notifications without altering hook or machine contracts.
**Exit evidence:** Search acceptance covers tiered widening, no matches, partial/deadline results, redaction and scan confirmation; activity/export evidence preserves tool/usage/provenance/coverage semantics; public search and activity outputs preserve known fixture detail absent from a lossy digest, proving that a digest is not their sole evidence source; version-notice checks cover current/newer/offline behavior, stdout isolation, and the absence of both notices and network checks in hook and machine contexts; the built tarball operates without donor-repository sources on Node 22 and 24.
**Provisional:** yes

## Phase p04: Publish the toolkit and migrate Skills consumers

**Intent:** Merge and publish the validated toolkit release through the agreed bootstrap/trusted-publishing flow, then migrate interactive skills and bundled hooks to the package source. Update consumer versions, generated payloads, instructions, docs, and applicable plugin releases; remove replaced Skills engine source. Before interactive consumer cutover, amend the AGENTS.md dependency/no-install rule for migrated interactive skills and revise or supersede the relevant parts of DR-260514-session-observer-is-standalone and DR-260604-shared-transcript-knowledge through the decision workflow, retaining the self-contained hook contract.
**Exit evidence:** Independent explicit-range reviews and required checks passed before each p04 merge/publication, and the reviewed candidate/archive identities are recorded; p04 records the completed dependency/no-install instruction amendments and scoped DR revisions before interactive consumer cutover; npm contains the validated release; a fresh published install imports the API and executes the CLI; interactive prerequisite paths and bundled hooks work without runtime downloads; affected Skills verification, generated freshness, version/changelog and documentation checks pass; required PRs are merged and applicable releases/install acceptance are recorded. Duplicate-source inventory shows one authored provider engine for migrated Skills paths.
**Provisional:** yes

## Phase p05: Migrate ORC and verify integrated delivery

**Intent:** Move ORC's typed consumers to the published toolkit, update its actual skill routing and documentation, and remove redundant generic session-log commands after parity. Preserve host enrichment and consumer state, then audit the whole delivery.
**Exit evidence:** ORC has a normal published semver dependency and clean lockfile with no development override; package age policy is satisfied; API/routed-skill parity and enriched self-identify checks pass; redundant commands/callers and duplicate provider code are removed; ORC checkout path, base/head SHAs, PR links, ad-hoc explicit-range review artifact location, and root dispositions are recorded in p05 before ORC PRs are merged. The final integrated review inspects the supplied ORC checkout and range alongside the Skills phase anchors; the review and required gates pass, with all numbered Outcomes mapped to observed release/consumer evidence.
**Provisional:** yes

## Parallelism

No parallel phase groups are declared (`oat_plan_parallel_groups: []`). Package contracts, source moves, the shared lockfile/build outputs, publication, and consumer cutovers impose dependencies. Implementation may delegate bounded independent slices when they satisfy the brief contract; do not parallelize overlapping generated outputs or lockfiles.

## Reviews

| Scope | Type     | Status          | Date       | Artifact                                                    | Reviewed Head                            | Invocation | Gate Target          |
| ----- | -------- | --------------- | ---------- | ----------------------------------------------------------- | ---------------------------------------- | ---------- | -------------------- |
| plan  | artifact | passed          | 2026-10-29 | structured                                                  | a28f2037c2c38c5d665e863129aa794e856ef3fd | auto       | -                    |
| p01   | code     | pending         | -          | -                                                           | -                                        | -          | -                    |
| final | code     | pending         | -          | -                                                           | -                                        | -          | -                    |
| plan  | artifact | fixes_completed | 2026-10-29 | reviews/archived/artifact-plan-review-2026-10-29T031602Z.md | 02b1f285928e22357f6a8b66a9ddffecb6f3b43e | gate       | claude-opus-5-5-high |
| plan  | artifact | passed          | 2026-10-29 | structured                                                  | 77599b3deb3bf460225e952900ac8676939e960e | auto       | -                    |
| plan  | artifact | received        | 2026-10-29 | reviews/archived/artifact-plan-review-2026-10-29T032603Z.md | -                                        | -          | -                    |
| plan  | artifact | fixes_completed | 2026-10-29 | reviews/archived/artifact-plan-review-2026-10-29T033029Z.md | 95f5d507325fe66d4437799057002780ee92e0ed | gate       | claude-opus-5-5-high |
| plan  | artifact | passed          | 2026-10-29 | structured                                                  | e3111ad79d813d44af10e815947673e5102496ae | auto       | -                    |

Initial Codex artifact review passed with no findings. The configured Opus brief gate passed its High threshold with M1 (Medium) and L1/L2 (Low); the user approved all three amendments, now applied. Fresh read-only Codex artifact re-review passed with zero findings at `77599b3deb3bf460225e952900ac8676939e960e`. The configured Opus gate rerun passed its High threshold at `95f5d507325fe66d4437799057002780ee92e0ed` (0 Critical/High/Medium, 4 Low). All original M1/L1/L2 amendments were confirmed. The user approved all four new Low clarifications; they are applied and passed fresh structured artifact review with no findings at `e3111ad79d813d44af10e815947673e5102496ae`. The configured gate rerun and final brief approval remain pending. The archived `032603Z` review was not receive-eligible and is superseded by the validated `033029Z` gate event.

## Implementation Complete

Pending implementation. Five phases are planned: p01 is concrete; p02–p05 are provisional. No implementation has started or been accepted.

## References

- Journal: [implementation.md](implementation.md).
- Research: `references/research/`.
- Release CI comparison: [release-ci-reference.md](references/research/release-ci-reference.md).
- Reconnaissance: [shared-session-toolkit brainstorm](../../../repo/reference/brainstorms/2026-10-28-shared-session-toolkit.md).
- Independent proposal review: [Opus review](../../../repo/reference/brainstorms/2026-10-28-shared-session-toolkit-opus-review.md); this covered the original proposal and does not replace review of this brief.
- Accepted naming: [DR-261028-session-toolkit-naming](../../../repo/reference/decisions/DR-261028-session-toolkit-naming.md).
- Brief contract: `/Users/tstang/.agents/skills/oat-project-brief/references/brief-contract.md`.
- Project log: `project-log.md` when enabled.
- Formatting: use the documented `pnpm exec oxfmt --write <owned authored paths>` form. Lifecycle files under `.oat/` are excluded by repository formatter globs; format their contents through `pnpm exec oxfmt --stdin-filepath <basename>` and save stdout to the owned file. Never format generated distributions or agent instructions.
