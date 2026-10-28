# Shared session toolkit: Skills and ORC

Date: 2026-10-28. Status: proposal for discussion, not an accepted architecture decision or implementation commitment.

## Recommendation

Create one published npm package in this repository with both a typed library API and a CLI. The requested product scope is provider/session identity, transcript-store discovery, reading/parsing, historical search, rendering/export, and structured activity extraction. ORC imports its API; interactive skills can invoke its CLI. Evaluate build-time bundling from the same package for unattended hooks and offline installations. Keep conversational workflows and host orchestration in their current owners.

Use a small pnpm workspace with `packages/session-kit/` as the working package location. Keep existing skill sources and generated distributions where they are. One package can expose both `exports` and `bin`; a separate CLI package, Turborepo, a repository rename, and moving every skill into a workspace are unnecessary for this extraction.

After review, my preferred working pair is **`@tkstang/session-kit` / `session-kit`**, subject to the operator's choice and npm publish-rights verification. **`@tkstang/agent-sessions`** remains the more descriptive package-name alternative, but I would choose a distinct bin name rather than `agent-sessions`: that unscoped npm package already exists. Every `npx` instruction must name the intended scoped package explicitly with `--package`.

ORC is further along in typed package structure and a common CLI envelope, not published distribution: its packages are private, its CLI is checkout-linked, and it has no published release channel or `--version`. Both repositories have exact-identity code. ORC adds bounded, fail-closed evidence and revalidation; Skills adds richer lineage but also mixes exact and heuristic sources in one result type. Merge those strengths. Skills is further along in historical content search and rich transcript/activity processing; neither donor is a complete replacement for the other.

## Request and evidence boundary

The operator asked to evaluate consolidating repeated session tooling into a maintained npm dependency, potentially in this repository, including self-identify, search, parsing and export. They explicitly want the CLI to follow `~/Code/foundations`, and requested this brainstorm plus an Opus 5.5 High review.

Read-only reconnaissance covered:

- Skills at `ce7ba8fc3400a88e4179da053789e2f22c0f5a80` on the current `feat/session-toolkit-package` worktree.
- ORC at `cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b`, local `main`, in `/Users/tstang/Code/orc`.
- Foundations at `6cab2bbb0413fe3a644ad6d7711a72a52bb1cd0d`, in `/Users/tstang/Code/foundations`.
- Installed `self-identify` skill 1.3.0, which already delegates to ORC.
- [Skills PR #147](https://github.com/tkstang/skills/pull/147), merged: `reorient`, an instruction-only consumer of the transcript-export workflow.
- One bounded Stoa lookup plus one memory refinement. No prior shared npm-package decision was found. A relevant release-validation lesson warns that packing can rewrite `workspace:*` while leaving dependencies on unpublished internal packages; validation must inspect dependency names in the actual tarball.

The Opus review also identified Stoa's own Claude/Codex adapters under `apps/server/src/client/adapters/`. They are a possible later consumer, outside this two-repository comparison. No Stoa extraction or migration is proposed. The existing `@open-agent-toolkit/*` release flow is the publishing template cited by Foundations; ORC is a structural donor, not a proven npm-release template.

No real session transcripts were opened, provider stores changed, packages installed, or live-provider acceptance tests run. Capability findings below describe inspected source, not fresh-provider certification. Registry observations are point-in-time reads, not reservations.

## What exists today

| Capability | Skills | ORC | Extraction implication |
| --- | --- | --- | --- |
| Current-session identity | Observer `whoami` reads exact harness IDs, reports ambiguity, preserves native/root/parent/fork/subagent lineage; also permits configured overrides and unique same-cwd fallback | `orc self-identify --json`; exact provider IDs, bounded metadata checks, ambiguity refusal and filesystem revalidation; adds a Cursor identity variable | Merge strict identity evidence with Skills' lineage; validate variable semantics rather than blindly unioning ID names. Split exact identity from heuristic selection. |
| Discover/locate | Observer ranking plus exporter and search store enumeration | Provider adapters, cwd/worktree tiers, engagement, explicit selection | Consolidate store and identity facts; keep operation-specific selection policies explicit. |
| Historical keyword search | History → metadata → content → deep/tool-output tiers; deadlines, scan estimates/guards, redacted snippets, optional `rg`/`sqlite3` | No content-search command/API found in session-log | Skills is the donor. `locate` is not content search. |
| Parse/read | Detailed source coordinates, malformed/tail diagnostics, lineage, bounded reads, Cursor frames and turn semantics | Streaming JSONL, normalized entries, raw-record offsets and diagnostics | Reconcile semantics using existing fixtures; preserve raw evidence and purpose-specific projections. |
| Markdown export | Sanitized conversation export, marker/exact-session/all selection | Sanitized Markdown export with explicit destination | Both contribute; sanitization and selection are not currently interchangeable. |
| Tools/activity/usage | Optional bounded activity appendix and complete sensitive activity JSON; extraction, correlation, usage and coverage | Compact tool/command markers; raw tool arguments/results excluded from digest entries | Do not flatten rich evidence into ORC's lossy digest representation. |
| Catch-up and state | Observer delivery offsets, watch and controls, collaboration consumers | Raw-record offset catch-up, pagination, selection persistence and shrink recovery | Share read/cursor primitives; keep existing consumer state ownership through initial migration. |
| Terminal attention | Broader activity evidence, but not the same ORC detector contract | Structural questions/approval/completion detection with bounded reads and deadlines; live adapter consumer | Keep in ORC initially; a later transcript-only extraction is possible without moving runtime binding or decisions. |
| Fork/import | Alpha Claude↔Codex seed import; native fork remains a host action; Cursor discovery unavailable for this workflow | Not a session-log equivalent | Later extraction candidate with current limitations preserved, not a prerequisite for the first package. |
| Reorient/retro/handoff | Agent workflows using exporter/observer evidence | Consumer workflows around CLI | Keep as skills. Package supplies evidence and deterministic operations. |

Both codebases implement Claude Code, Codex and Cursor paths, but provider labels are not feature parity. Cursor filesystem layouts, frame semantics and missing recorded answers need specific coverage. Neither source inspection nor extracting code establishes support for every client version, database layout or host.

### Duplication: three different problems

1. **Generated copies:** Skills already has one canonical `src/shared/transcript/` owner. Observer/export/search runtime wrapper files re-export it, and builds bundle it into independently installable outputs. This duplicates shipped bytes, not independently maintained provider code. Runtime CLI consumption removes those shipped copies for migrated skills; build-time bundling from the package retains them with one authored owner. Both still require installed-artifact updates.
2. **Overlapping source inside Skills:** exporter enumeration, observer discovery and search adapters separately navigate provider stores. Some selection/classification differences are intentional. Shared storage and identity primitives can remove repetition without forcing every operation through one lossy normalizer.
3. **Cross-repository implementations:** ORC has separate discovery, parsing, filtering, identity and digest machinery. This is the clearest maintenance duplication and the strongest reason for a published dependency.

The installed `self-identify` skill demonstrates a thin CLI prerequisite: check ORC capability, invoke `orc self-identify --json`, interpret evidence, and ship no second parser. It currently depends on an unversioned checkout-linked binary, so it does not establish that published semver distribution or version checks already work.

## Proposed ownership

### Package

- Provider identity and transcript location: exact-ID evidence, canonical path matching, ambiguity/unavailability, lineage and revalidation.
- Provider-store enumeration and metadata reads, with injected home/environment/root inputs for tests and callers.
- Raw/detailed reads with source coordinates, partial-read and malformed-tail reporting, plus provider-specific extraction.
- Separate conversation, search, activity and compact-digest projections. Share provider facts; do not make a sanitized conversation view the sole search input.
- Stateless tiered search and estimates, including existing widening, redaction and scan-limit behavior.
- Sanitized Markdown rendering/export and explicit rich activity extraction/output.
- Bounded read primitives that consumers can use for incremental processing. Terminal-attention extraction is optional later scope; its current ORC consumer can continue using the shared reads. Signals remain evidence, not permission to act.

The first API should be small and intentional. Existing internal exports are donor material, not a public API promise. Keep the library import safe: no CLI argument parsing, `main()` execution, `process.exit`, store scans or state writes at module import.

Distinguish **package ownership** from **public library exports** and **first-release scope**. Search can live in this package behind its public CLI without exposing every internal search stage as a library API. The operator explicitly requested search in the toolkit; having one current search consumer is a reason to keep its API narrow, not an automatic reason to exclude it. A staged extraction can establish shared identity/enumeration/reads/export first, then add search and activity before calling the requested toolkit complete. Attention and alpha import/fork are not required in that first product release.

### Skills

Keep intake, translating fuzzy requests into search patterns, presenting results, retrospective judgment, reorientation, handoff composition, user-facing permission decisions and host workflow instructions.

The operator's preferred direction is thin CLI-backed workflows with an explicit missing-prerequisite choice. Recommend that for interactive search/export/self-identify. Separately evaluate deterministic build-time bundling from the same package for observer/collaboration hooks and offline installations. Hooks must never fetch through `npx` or introduce a prerequisite conversation when they fire; use a preinstalled compatible executable or a deliberately bundled artifact. This distribution choice remains open, not an accepted exception to the operator's preference.

Either form must have one authored provider implementation. Bundling the package into a hook is not retaining a second source implementation; an undocumented copied-parser fallback would be. Required skill-to-skill references still make sense where the dependency is another workflow, but a deterministic export operation should be callable through the package without requiring a second installed skill merely to locate its runtime.

For example, PR #147's `reorient` can eventually call the package exporter directly while retaining its own full-history, ambiguity and evidence rules. It does not need its own transcript engine. Whether it continues composing the export skill is a workflow choice, not a package requirement.

### ORC and host integrations

Keep `RuntimeSessionObservation`, detector/action policy, the observation bridge, Orca/T3 live probes, host reports, SSH orchestration and `~/.orc` selection state in ORC.

Move neutral session contracts out of `@orc/core` into the package, and make ORC depend on them. The dependency must point **ORC → toolkit**, never toolkit → ORC. ORC's full `self-identify` report currently composes transcript identity with Git, Orca and T3 evidence; extracting transcript identity does not reproduce every host-specific field. ORC can continue adding those enrichments around the shared result.

Do not take over observer/collaboration cursor files during the initial extraction. Shared offset math is useful; a unified state store is a separate migration with its own behavior and recovery implications. The broad eventual scope can include watch/catch-up commands after that ownership is resolved.

ORC's own skill guidance currently routes transcript discovery, offsets, catch-up and watch to `session-observer`. Migrating only `orc session-log` would miss that actual user path. The migration must update canonical ORC `orc-cli`/`orc` references and the skills README alongside the selected observer path.

Recommended command disposition, subject to caller inventory: retire the redundant generic `orc session-log` namespace (`locate`, `select`, `read`, `catch-up`, `export`, `forget`) when equivalent toolkit/observer workflows are verified and documented. Keep ORC's enriched `self-identify` and internal typed consumers. Do not leave three separately implemented export CLIs or introduce compatibility aliases by default. Do not delete or silently translate `~/.orc` selection state; any required state transfer needs an explicit design before removing an active workflow. A consumer discovery may justify retaining an ORC-specific operation, but it should not own a second provider engine.

## Existing decisions affected

This proposal changes established distribution policy. It does not modify or supersede a decision merely by being written:

- [DR-260514-session-observer-is-standalone](../decisions/DR-260514-session-observer-is-standalone.md) rejects a runtime dependency on Stoa and says that porting small adapters beats coupling. Independence from the Stoa service remains useful; the rationale for maintaining copied adapters would be superseded by adopting the toolkit. A runtime CLI requirement also narrows its no-install portability promise for whichever skills migrate.
- [DR-260604-shared-transcript-knowledge](../decisions/DR-260604-shared-transcript-knowledge.md) retains the durable rule to share only provider knowledge and ship self-contained generated copies. Broader package ownership revises the first part; runtime CLI consumers revise the second. Bundled consumers can retain the self-contained distribution promise.
- [DR-260914-session-and-consensus-plugin](../decisions/DR-260914-session-and-consensus-plugin.md) retains behavioral grouping and independent plugin versions. Its generated/shared-runtime consequence needs a scoped update for external-CLI consumers; package sharing alone does not require changing plugin membership.
- [DR-260616-build-time-import-rewrites](../decisions/DR-260616-build-time-import-rewrites.md) describes the generated-runtime implementation. Keep it for unaffected and bundled units; update the relevant build contract when sources move. No need to retire generation across the repo.
- Root `AGENTS.md`'s shipped-runtime/no-install rule and `src/AGENTS.md`'s bundling contract need explicit scoped amendments in the implementation change. Any adoption record should name migrated skills, retained bundled hooks and the Node prerequisite rather than claiming every shipped skill now requires npm.

If accepted, record the new decision through the repository decision workflow and link affected historical records. This brainstorm leaves their current status intact.

## The contract differences that matter

**Exact identity versus historical selection.** `self-identify` must not infer the current session from the newest log or a similar cwd. Discovery/search may rank historical candidates, with evidence and explicit selection. A unique same-cwd candidate does not become exact current-session identity. Preserve these as distinct operations and result states.

**Rich evidence versus safe presentation.** ORC intentionally discards raw tools from its digest model; Skills search needs tool output on its deep rung, and structured activity exports preserve much richer evidence. Keep a detailed source/extraction layer plus explicit output policies. Retain safe conversational defaults, require explicit rich-output choices, and never describe sensitive activity JSON as sanitized/shareable. Public raw record access must not cause ORC to start returning that content accidentally.

**Source coordinates and delivery.** JSONL physical lines, decoded record indexes, Cursor frame indexes, provider event IDs and stateful delivery offsets are different coordinates. Preserve provenance and typed distinctions rather than translating everything into a single message count. Keep provider-specific missing-data/coverage states.

**Performance.** ORC catch-up skips normalization before an offset but still streams/counts the file. Some discovery paths read full candidates to classify engagement. Skills search deliberately avoids an index and searches cheap stores first. Consolidation does not by itself deliver byte-seek tailing, indexed search or lower memory. Preserve current bounds and measure representative fixture workloads before claiming improvements.

**CLI contracts.** Existing skills and ORC use differing schemas, exits and flag meanings. Define the new package's contract once, then update callers together. Preserve meaningful outcomes such as no matches, ambiguity, partial results and large-scan confirmation even if exit numbers change. This repository prefers a clean cutover; aliases/wrappers or backward compatibility need explicit approval rather than becoming the default migration plan.

## Repository options

| Option | Benefits | Cost / limitation | Assessment |
| --- | --- | --- | --- |
| Keep bundled runtimes and improve shared source | Retains no-install skills; smallest packaging change | Cross-repo ownership still needs a shared release artifact; independent installed bundles retain drift | Useful baseline, does not meet the requested dependency model. |
| Publish one package and bundle it into selected skills at build time | ORC gets the npm dependency; hooks/offline installs remain self-contained; removes cross-repo authored duplication | Generated bytes and installed-version drift remain; package changes must propagate to skill versions/builds | Serious hybrid alternative, especially for unattended hooks; can coexist with runtime CLI skills. |
| One npm package at this repository root | Minimal package nesting | Root becomes both private skill build/distribution tooling and public library/CLI; harder publish allowlist and ownership boundary | Possible, but weaker separation than a child package. |
| Small workspace here, one published package | Co-locates skill/engine changes and fixtures; explicit public boundary; ORC consumes semver | Add workspace/build/release support and revise no-runtime-dependency instructions deliberately | **Recommended.** |
| Publish from ORC | Reuses existing library/CLI structure | Core type/bridge coupling must still be removed; Skills contains important missing capabilities; ORC becomes the owner of a broader independent toolkit | Technically viable, not the preferred product home given the operator's intent. |
| Separate repository | Clear independent identity/release ownership | Three-repo migration and coordinated changes while API is still being consolidated | Reconsider if maintainers/release cadence diverge; unnecessary now. |

Workspace cost is bounded but real: update package-source allowances in distribution declarations/build validation, package type-check/test discovery, version-impact tracking, npm packing/release validation and the CI gates that select changed files. Review root `tsconfig.json`, `vitest.config.mjs`, `scripts/run-vitest.mjs`, lint-staged and CI exclusions for the new source roots; not every file necessarily needs an edit. Bundled package changes must trigger affected skill version bumps. Runtime consumers need a documented compatibility range and an update when they require new behavior. Keep the separately locked documentation app outside workspace globs.

Suggested layout, not an instruction to move current owners yet:

```text
package.json                  # private repository tooling
pnpm-workspace.yaml           # packages/*; docs app stays separately managed
packages/session-kit/
  package.json                # one published library + bin
  src/index.ts                # intentional typed API
  src/cli.ts                  # thin command entry
  src/<domain>/               # identity, stores, read, search, activity, export
src/skills/                   # canonical skill instructions/workflows
src/shared/                   # only shared code still owned outside the package
skills/                       # existing generated standalone distributions
plugins/                      # existing generated/maintained plugin surfaces
documentation/                # existing docs app
```

Use a package `files` allowlist and generated `dist` for npm publication; do not publish repo fixtures, local state, or private workspace dependencies. Existing committed generated skill payloads remain governed by this repository, even though Foundations generally prefers uncommitted build output.

## Foundations alignment

Apply the **library + agent-first CLI** conventions, not a fresh scaffold over the entire repository:

- ESM, strict TypeScript, a deliberate `src/index.ts` API; split into subpath exports only when distinct consumers justify it.
- `--json`: exactly one stable envelope on stdout; diagnostics on stderr; versioned machine-readable `E_*` codes and actionable hints/next actions; every operation runnable without interactive prompts.
- Commander command factories and boundary validation following the Foundations defaults; dependencies must earn their place. Neither donor uses Commander, so this boundary is new code rather than an unchanged extraction. A published package may legitimately use Commander/Zod instead of cloning them to preserve an absolute zero-dependency rule.
- Domain errors as typed results; CLI errors handled centrally. Read-only commands stay read-only; adopting the house CLI contract does not authorize writes.
- Co-located Vitest coverage, Oxc formatting/linting, packed-artifact validation, npm OIDC trusted publishing after first-publish bootstrap. No Changesets or new task orchestrator needed for one published package.
- One independently versioned npm package initially. Existing skill versions and plugin release versions keep their established meanings. Foundations lockstep applies if multiple public npm packages are later introduced, not automatically to every plugin and skill here.

Choose the package runtime baseline explicitly: Skills currently supports Node 22+, while ORC/self-identify and Foundations use Node 24. Prefer Node 24 for the new package if the operator accepts raising the prerequisite of migrated skills; otherwise verify a Node 22 implementation instead of assuming ORC code is compatible. Revalidate compiler/package-manager/dependency pins before implementation. Do not bundle a repo-wide TypeScript/pnpm upgrade into extraction solely because the Foundations defaults differ.

Relevant Foundations sections: `conventions/archetype.md:26` (library), `:47` (CLI), `conventions/structure.md:19` (workspace choice), and `conventions/code-style.md:230` (CLI behavior).

## Installation and version checks

For runtime CLI consumers, replace mandatory bundled copies with an explicit prerequisite:

1. Ship `--version` and a machine-readable capabilities command; check executable availability, supported version and required capabilities before dependent work. Reuse a valid same-host/session check. ORC's current help-only probe is not sufficient for the new package contract.
2. If absent/incompatible, state the package, supported version and installation source. Offer either a persistent installation or execution through `npx` at an explicit approved version.
3. When installation/network execution was already authorized in the session, use that authorization. Otherwise obtain the user's choice before installing or fetching executable code. The CLI itself stays noninteractive; the skill handles the conversation.
4. After selection, invoke the exact chosen executable/version. Do not silently run `@latest` or add a hidden install to each command.
5. Give ORC a normal declared semver dependency and lockfile. Its library import does not need a global installation or `npx`.

Illustrative commands only, pending package/name/version selection and publication:

```sh
npm install --global @tkstang/session-kit@<approved-version>
npx --package=@tkstang/session-kit@<approved-version> session-kit search ... --json
```

This exchanges offline/no-install execution for one runtime release and a visible prerequisite. `npx` still needs a compatible Node runtime and network on a cache miss; global installs can still go stale. Semver compatibility checks and explicit upgrade guidance are therefore part of the skill contract, not incidental setup prose.

Never shorten that to `npx agent-sessions`: it resolves an unrelated existing package. Require the explicit scoped `--package` form in every skill, reference and example even if a distinct command name is chosen.

## Names

| Candidate | Fit | Concern |
| --- | --- | --- |
| `@tkstang/agent-sessions` | Clearly describes coding-agent sessions; broad enough for identity, search and activity | Longer command; unscoped `agent-sessions` already exists, so scoped package and executable must be distinguished. |
| `@tkstang/session-kit` | Compact umbrella for library + CLI; matching `session-kit` command | Less explicit about coding agents; could sound like web/auth sessions without a good description. |
| `@tkstang/sessions` | Short, broad | Generic package/command identity and ambiguous domain. |
| A new project scope such as `@session-kit/core` | Room for a future package family | Scope ownership/setup and unnecessary split/family assumptions for one package. |
| `@orc/session-log` | Matches the current ORC implementation | Anchors a cross-tool product to ORC and suggests log parsing rather than identity/search/export. |

Public registry GETs on 2026-10-28 returned 404 for `@tkstang/agent-sessions`, `@tkstang/session-kit`, `@tkstang/sessions`, and `session-kit`. `agent-sessions` returned 200 with latest `0.0.0`. These observations do not establish publish permission, name acceptance, scope ownership, trademark clearance or command availability on an execution host. Verify the selected name and npm account before publication; reserve nothing during this evaluation.

The reviewer also found packages maintained by npm account `tkstang`, including OAT. Account existence is encouraging but is not a substitute for checking the intended publishing identity and selected scope's rights.

## Suggested implementation sequence

1. **Confirm scope and contracts.** Choose the name, Node floor, public ownership and command outcomes; map existing fixtures/behavior for exact identity, discovery, safe export, activity, search and catch-up. Record an accepted decision separately if the operator selects this proposal.
2. **Establish the package.** Add the minimal workspace and one library/CLI package. Move neutral contracts and selected primitives; remove `@orc/core` coupling. Separate CLI main functions from importable APIs. Prove a packed install can import the library and run help/version without repo source or private packages.
3. **Bring over complementary features in bounded slices.** Merge exact identity using ORC's fail-closed states/revalidation and Skills' lineage, then shared enumeration/detailed reads and safe export. Add the requested search and activity capabilities without publishing internal pipeline stages. Preserve specialized projections and current privacy/coverage semantics. Keep ORC-only bridge/state and attention outside initially.
4. **Publish and migrate actual consumers.** Use the OAT release workflow as the template. First-publish bootstrap and OIDC release wiring precede requiring the public package in installed skills. Migrate ORC imports, selected skill execution paths and ORC's routing guidance together, with explicit command disposition. Remove duplicate authored implementations and update required versions, docs, instructions and impacted skill/plugin releases. The bootstrap can require a package-first publish followed by a consumer PR; make that dependency visible rather than landing an unpublished runtime prerequisite.
5. **Migrate broader stateful features only as needed.** Observer/watch/collaboration and alpha import/fork follow after their state/host contracts are mapped. Do not add daemons, a persistent search index, remote session synchronization, a plugin registry or a new state migration framework to justify extraction.

Plan the update loop before cutover. For unreleased cross-repo work, ORC can test a locally packed tarball through an uncommitted override, with its private lockfile changes reverted before the published-version PR; no absolute local paths or links should enter a release. Runtime skills can use an explicitly selected development executable during fixture tests. Production prerequisites point only at published releases.

ORC currently sets `minimumReleaseAge: 1440` and exempts only selected OAT versions. Either wait 24 hours after publishing or deliberately authorize a narrow exact-version exemption for the toolkit; do not silently disable the hold or assume a fresh version installs immediately. Provider-format hotfixes may require package publication, a declared consumer bump, a skill/plugin release, and a runtime upgrade. Bundling trades that runtime upgrade for a generated-artifact reinstall; neither delivery form eliminates rollout work. Prefer capability/compatible-version ranges over pinning every routine invocation to a new exact version, while keeping fetched `npx` versions explicit.

Acceptance evidence should include purpose-specific regression fixtures (including tool output and Cursor incomplete turns), ambiguity/identity failures, search/no-match/partial/scan-confirmation responses, consumer behavior, and a clean installed-tarball smoke. Inspect packed dependency **names**, not only `workspace:*` strings, to catch private dependency leakage. Choose exact tests during implementation using `deliberate-testing`; this proposal does not add tests or initiate a pruning campaign.

The existing `BL-260619-shared-session-log-substrate` is now a **stateless multi-session activity merge** proposal. It is related future consumption, not a ticket for this package extraction, and this document does not satisfy or close it. The accepted stateless-search and provider-fidelity decisions remain constraints; do not silently replace them with an index or generic message model.

## Source evidence

Paths and line numbers refer to the snapshot commits above. Skills links are repository-relative; ORC links pin its inspected commit.

- [Distribution declarations](../../../../src/distributions.ts): shared transcript source allowances and standalone/plugin forms, especially observer/export/search/fork declarations.
- [Shared runtime](../../../../src/shared/transcript/runtimes.ts), [activity contracts](../../../../src/shared/transcript/activity/types.ts), [activity pipeline](../../../../src/shared/transcript/activity/index.ts): detailed reads, source coordinates, coverage and structured activity.
- [Exporter](../../../../src/skills/session-export-transcript/src/session-export-transcript.ts): flags at line 8, enumeration at 372/430/505, and unconditional CLI `main()` at 1743.
- [Observer identity](../../../../src/skills/session-observer/src/lib/observe.ts): `resolveSelfIdentity` at line 185. [Discovery](../../../../src/skills/session-observer/src/lib/locate.ts): line 1981 onward.
- [Search pipeline](../../../../src/skills/session-search/src/lib/pipeline.ts): `runSearch` at line 215. [Search decision](../decisions/DR-261002-stateless-tiered-session.md) and [classification decision](../decisions/DR-261002-adapter-owned-record.md): stateless tiers and why search cannot consume a lossy conversation normalizer.
- [ORC package manifest](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/packages/session-log/package.json): private package, `@orc/core` dependency.
- [ORC CLI session-log](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/packages/cli/src/commands/session-log.ts#L731): command list; export/persistence/envelope implementation in the same file.
- [ORC CLI prerequisites](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/src/skills/orc-cli/references/cli-prerequisites.md#L10): help-only checks, checkout linking and no published release channel. [ORC transcript routing](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/src/skills/orc-cli/SKILL.md#L228) and [release-age policy](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/pnpm-workspace.yaml).
- [ORC self-identify composition](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/packages/cli/src/commands/self-identify.ts#L24) and [transcript identity](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/packages/session-log/src/identity.ts#L61): exact evidence versus host enrichments.
- [ORC sanitization](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/packages/session-log/src/sanitize.ts#L50), [reader](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/packages/session-log/src/jsonl.ts#L65), and [bridge](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/packages/session-log/src/bridge.ts#L17): safe projection, performance limits and ORC coupling.
- [ORC terminal attention](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/packages/session-log/src/terminal-attention.ts#L25) and [live adapter consumer](https://github.com/tkstang/orc/blob/cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b/packages/adapters/src/live/superengineering.ts#L590).
- Local installed skill: `/Users/tstang/.agents/skills/self-identify/SKILL.md:16`; explicitly calls `orc self-identify --json` and prohibits a second parser.
- [Existing multi-session merge backlog](../../pjm/backlog/items/BL-260619-shared-session-log-substrate.md): separate scope, no extraction commitment.

## Review outcome and open choices

[Opus 5.5 High's complete review](2026-10-28-shared-session-toolkit-opus-review.md) covers original proposal commit `fac5f11`. It supports one authored package here and identifies factual corrections and distribution/migration tradeoffs. This revision has not had a second independent review.

Root-agent dispositions:

| Feedback | Disposition |
| --- | --- |
| ORC publishing maturity overstated | Corrected: package structure/envelopes are useful; publication, version probing and release workflow are still to build. |
| Skills identity understated | Corrected: merge lineage and exact evidence from both. Preserve the distinction between Codex thread IDs and parent/grouping IDs rather than unioning names blindly. |
| Existing decisions not identified | Added the exact decisions and scoped policy changes; none superseded during evaluation. |
| Missing hybrid option / unattended hooks | Added one-package build-time bundling as a real alternative. Recommend evaluating it for hook/offline paths, while preserving the operator's runtime-CLI direction for interactive skills. Selection remains open. |
| ORC docs route to observer; redundant commands remain | Added coordinated routing migration and recommended clean removal of the generic namespace after equivalent workflows are verified. No compatibility wrappers assumed. |
| Release age, bootstrap and local development absent | Added the package-first bootstrap, unpublished tarball development loop and explicit ORC 24-hour hold choice. |
| First release too broad; defer single-consumer search | Partially accepted: stage the shared core first and defer attention. Keep requested search/activity in the intended toolkit release; avoid exposing single-consumer internals as public APIs. A second consumer is not required to justify the CLI product the operator asked for. |
| Name/install collision | Changed preferred pair to `@tkstang/session-kit` / `session-kit`; require scoped `npx --package`, plus version/capability probes. Name remains unselected. |
| Workspace/Foundations work understated | Added build/version/test/CI integration scope and called out the new Commander layer. Avoided assuming every inspected tooling file requires a change. |
| Stoa adapters outside comparison | Noted as a possible later consumer without widening this task. |

Before implementation, the material choices are package/bin name; Node 22 versus 24; runtime versus bundled execution for unattended/offline consumers; exact first-release scope and public exports; retirement of the ORC generic commands; and release cadence/age exemptions. The recommendation is concrete enough to discuss, but these are not decisions made on the operator's behalf. The requested reconnaissance, document and one review are complete; no implementation or publication has begun.
