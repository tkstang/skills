---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-13
oat_generated: false
oat_template: false
oat_template_name: design
---

# Design: Skill Source Organization and Plugin Packaging

Draft complete; holistic user review pending. This is a lightweight quick-mode design, not implementation approval. Discovery is the requirements baseline; issue #74 supplies the detailed migration invariants.

## Overview

Separate authored ownership from installation layout. Each skill has one complete authored directory; a small build-time catalog declares its standalone output and plugin membership/local name. Generate the install-facing skills and plugins from those owners. Preserve the existing TypeScript/esbuild approach, dependency-free installed Node ESM, provider manifests, and CLI behavior.

Introduce the session plugin and move observer/observer-collab into the consensus distribution without making code ownership follow plugin grouping. Shared transcript and consensus helpers remain single-source code, included within each installation unit that needs them. A real workflow prerequisite is different: it remains a declared installed-skill requirement with an early, actionable safeguard.

This is a packaging and ownership migration. Preserve the merged fork-guidance behavior and the current portable handoff contract. Do not add a new session engine, updater, package manager, test framework, or generalized runtime skill registry.

## Architecture

### Authored and generated boundaries

```text
src/
  skills/<canonical-name>/
    SKILL.md
    references/ and assets/       only when useful
    src/                         executable skills only; TS and owned tests
    build.json                   executable entrypoints only
  plugins/<plugin>/              plugin declarations and non-skill CLI source
  shared/                        genuine cross-skill runtime and owned tests

skills/<canonical-name>/          declared generated standalone payloads
plugins/<plugin>/                 declared generated plugin installation units
  skills/<local-name>/            generated skill payloads
  scripts/                       generated plugin-shared runtime, where needed
```

Keep canonical identity independent of the plugin-local name. Existing consensus-only skills can retain their present authored identity if unambiguous; assign full canonical names only where necessary to avoid collisions or support a declared standalone form. Do not rename all consensus skills merely for symmetry.

Use one small repository distribution declaration, owned by the build tooling, for standalone selection and plugin membership/aliases. Plugin-specific authored manifests and CLI entrypoints stay with their plugin owner. Resolve declarations into one in-memory target list consumed by build, validation, versioning, release, and changed-file tooling. Do not persist a second registry/cache of that derived list.

### Build flow

Authored owners and declarations → resolve target names and runtime dependency closure → copy permitted resources and bundle declared entrypoints → validate staged installation units → compare for freshness or safely replace owned output.

The existing generated-output pipeline remains the command owner. During migration, a temporary explicit legacy-owner mapping supports old paths and version baselines. Remove obsolete file-by-file mappings once all consumers move; do not retain two permanent builders.

## Component Design

### 1. Source inventory and target declarations

Inventory the final merged baseline before moving files. Record authored owner, old path/name/version, declared outputs, shared imports, required skill workflows, optional integrations, and installed resource paths. A compact migration inventory is sufficient; it is dated evidence, not a new runtime database.

The distribution declaration needs only canonical owner, optional standalone target, plugin/local-name membership, and required/optional skill references where generation uses them. Executable owners additionally declare entrypoints, following issue #74's small runtime list. Prompt-only skills need no per-skill build manifest or empty source directory.

Use the dependency graph emitted by the existing bundler to establish actual runtime consumers. No hand-maintained shared-code consumer list and no custom graph framework.

### 2. Payload generation and naming

Render target-specific frontmatter names and only explicit install-relative references. Prefer narrowly defined reference slots or target metadata over global string replacement of ordinary prose. Fail if a declared reference cannot resolve within its supported installation contract. Keep canonical semantic instructions in one place.

Standalone entrypoints include shared runtime closure and resolve assets from their installed location. Complete plugins can share generated helpers inside the plugin root. A configured standalone consensus skill must also include the CLI/helper capabilities it actually invokes; simply copying its SKILL.md does not establish standalone support.

Generate only distributable instructions, references, assets, provider metadata, and dependency-free runtime. Reject TS/tests/build manifests, undeclared executable resources, runtime package dependencies, source escapes, symlinks unless explicitly supported, duplicate targets, and entrypoint basename collisions. Preserve executable bits.

Stage complete owned trees and validate before replacement. Failed compilation leaves the prior distribution unchanged. Replacement failures restore the previous tree or retain/report a recovery copy if rollback fails. Never wipe a whole plugin containing independently owned manifests/hooks. Freshness compares full inventory, content, and relevant modes without overwriting committed payloads; deleted resources must become detected/removed generated orphans.

### 3. Plugin manifests and release ownership

Declare both consensus and session across the repository's supported provider/catalog surfaces. Derive validation and release targets from plugin ownership instead of the current consensus-only constants. Preserve existing consensus install paths and the pinned recovery installer contract.

One canonical skill version supplies both standalone and plugin forms. Each plugin has its own release version; a session release must not rewrite consensus or unrelated skill versions. Verify local/qualified names against each supported host before publishing invocation or discovery claims. Recommend choosing either standalone or plugin form unless co-installation behavior has been verified.

### 4. Runtime code versus skill prerequisites

Materializing code is a build responsibility, not an installed-skill prerequisite. A standalone export/observer helper cannot require another skill installation just to obtain transcript parsing code.

For observer-collab, preserve the actual observer workflow prerequisite. The generated instructions declare its canonical identity, supported standalone/plugin forms, and maintained install link. Check the host's available skill surface or documented installed location before dependent operations; inability to establish availability is not success. Stop with: “This skill requires session-observer, which was not found. See [installation instructions] for setup.”

Use the existing host/skill invocation mechanisms, with a small local helper only if a concrete executable consumer needs it. Do not build a universal registry, recursively install dependencies, or copy another skill's workflow. Add a build-time check for broken/cyclic required references when introducing these declarations so unusable configurations fail early.

Portable handoff's observer and transcript export integrations remain optional. Missing them must not block a useful handoff; transcript export still requires separate acceptance. Update references to the renamed export skill in each distribution.

### 5. Promotion and ownership reconciliation

The inspected personal source is session-handoff 1.1.0 at personal-skills commit 80a5a76de093f812776efb5c90bdc40504dbedfb, containing SKILL.md and assets/handoff-template.md. Promote those authored resources, not generated/private plugin copies, into the new source owner. Preserve its read-only, privacy, optional transcript, and authorization boundaries; inspect public suitability and reconcile attribution/license before publication.

Coordinate the private repository's transition to the public source through its existing external-skill mechanism. Until that separately authorized cutover, mark any retained private source as transitional rather than inviting independent edits. Do not remove source or alter user installs as a side effect of packaging tests.

Complexity-review already exists publicly at 1.0.0, but personal-skills has newer 1.0.2 content and an evidence-guide reference. On 2026-09-13 the user chose to bring that newer content here and include a separate personal-skills removal PR in this project's plan. Carry over the complete useful source/resource change, preserving attribution and satisfying the version policy at execution. Once the public replacement has merged and is installable, open the private-repo PR to remove its independently authored copy, update declarations/docs, and regenerate affected outputs. Any continued personal distribution must consume the public owner through the existing external-skill mechanism. Link both changes; do not merge the removal PR or alter active installations automatically. This remains a prompt-only ownership reconciliation, not another skill promotion or behavior-evaluation project.

### 6. Version, tooling, and CI migration

Move to quoted stable metadata.version and reject legacy root/meta fields only when validators, source, release tooling, docs, and fixtures agree. During migration, read legacy baselines through the explicit old-to-new owner map. Conflicting historical versions require reconciliation. A move or rename must not reset an existing skill to “new.”

Require increases for changed authored skill content (including tests/resources), changed payloads, and all affected transitive shared-runtime consumers. Preserve removed-skill reporting. Resolve an explicit comparison base; handle staged/unstaged/untracked edits and fail on missing/shallow history rather than fetching or skipping. This closes the observed shared-consumer gap in BL-260723-guard-transitive-shared.

Port only affected repository-owned build/validation/smoke tooling to TS with developer-only tsx as issue #74 requires. Extend existing lint/format selection to authored TS and colocated tests. Derive generated exclusions from declared output where possible. Keep upstream OAT mirrors/internal flags outside product ownership.

Reuse current CI jobs and command names. Run non-mutating freshness before commands that regenerate payloads; use the actual PR base/head and a concrete rerun path when the base changes. Preserve pinned actions, frozen dependency installs, read-only permissions, and separate docs/release/live workflows. Avoid repeated full builds and full suites at every file-move task.

### 7. CLI availability and documentation

Preserve or add early local preflight only for helpers/providers selected by the operation. Resolve relative to the installed unit, check reliable minimum versions and required capabilities, and stop with supported installation guidance if unavailable. Do not infer a capability solely from a version or test unrelated provider authentication.

Known-newer compatible release advice may use existing evidence/cache when available. Do not introduce a new update service merely for optional warnings, or require network for an otherwise compatible local run.

Update maintained user/engineering docs, the lean README, release/contributor instructions, authoring roots, examples, renames, and required-skill install links. Keep dated migration evidence here, not in current product navigation.

## Testing Strategy

### Minimum sufficient proof

Keep the current source unit/integration tests and move skill-owned tests with their owners. Extend existing packaging, version, manifest, and layout suites; do not clone the same assertions into a new suite for every skill. Use one reusable temporary-install setup outside the checkout with fake HOME/config and deterministic provider stubs.

| Risk / contract | Smallest useful proof |
| --- | --- |
| Prompt-only packaging gains unwanted machinery | Complexity-review output has valid metadata/resources and no runtime/build/test files; manually inspect the instructions |
| Renamed executable relies on checkout paths | Run session-export-transcript's installed entrypoint against synthetic input; validate installed references |
| Shared code leaks across installation boundaries | Run a representative standalone shared-runtime consumer without sibling skills or checkout access |
| Actual workflow prerequisite is hidden | Observer-collab present/missing observer cases across supported installation forms; optional handoff integrations absent still permit core work |
| More than one plugin or target name breaks discovery/release | Validate full consensus and session inventories/manifests and one isolated smoke per distinct runtime layout; target-selective release fixture |
| Freshness/build failure loses or hides output | Extend existing generation tests with representative stale/missing/orphan, rejected-input, and failed-replacement cases |
| Version migration bypasses guards | Extend existing version fixtures for old/new owner mapping, shared fan-out, local edit states, and missing base |

Test each distinct installation contract, not the Cartesian product of every skill, alias, provider, and module. Cheap full-tree metadata/link/dependency scans can cover all declared outputs; executable fixtures cover distinct runtime boundaries. Use table-driven negative cases when they exercise different guard behavior, not separate harnesses.

Do not snapshot whole prompts/docs, add prose-string locks, fabricate golden transcripts, repeat paid native-session gates, or introduce coverage-percentage targets. A manual fresh-agent handoff example is useful behavioral evidence; no custom LLM evaluator is required. Preserve the private promotion record's still-pending readiness checks and obtain authorization before live/provider discovery work.

At implementation closeout run existing type-check, build:check, validate, source tests, and smoke commands against the migrated system. During individual tasks use the actual scoped Vitest invocation for affected files, not a package shortcut that runs the full suite. Live provider discovery/release remains a separately authorized gate.

## Complexity Review of This Draft

**Verdict:** Deletion-rule compliant at the design level; implementation must still justify concrete helpers and test additions.

### Contract

- Outcome: one authored owner, multiple plugin/standalone distributions, agreed names, and public handoff promotion.
- Hard constraints: issue #74 packaging/version safety; dependency-free shipped runtime; explicit workflow prerequisites; inactive planning now.
- Acceptance criteria: discovery's distribution, ownership, compatibility, and migration outcomes.
- Minimum proof: existing regression suites plus representative isolated installations and focused failure/version cases.

### Simplest Viable Solution

Extend the existing builder with a small target declaration and use its dependency graph. Keep prompt-only skills as prose/resources, bundle executable closure where needed, and express real workflow prerequisites in generated instructions. Reuse the existing test runner and fixtures.

### Complexity Ledger

| Item | Evidence / contract link | Ownership cost | Recommendation |
| --- | --- | --- | --- |
| Explicit target/name declaration and generated outputs | Hard requirement: user wants both plugin and standalone forms with different names | Small build-time schema and renderer | Keep; one declaration, no persisted derived registry |
| Shared-consumer version proof and safe output replacement | Hard requirement: issue #74; observed missed bumps in BL-260723-guard-transitive-shared | Focused graph/replacement fixtures | Keep; reuse current bundler and suites |
| Exhaustive skill-by-provider test matrix | Unsupported beyond representative installation contracts | Duplicated fixtures and slow CI | Delete from the proposed approach |
| Universal skill resolver/dependency installer | User requires a missing-skill safeguard, not a package manager | New host adapters and lifecycle state | Simplify to supported availability checks and install guidance |
| Separate spec, custom eval harness, extra standalone promotion | Existing discovery/issue establish scope; complexity-review already exists | Duplicate process and product ownership | Delete from this scope |
| Advanced tool-evidence handoff features | Related research, not required for packaging | New behavior and evaluation surface | Defer until a separate accepted behavior requirement |

### Risks and Reintroduction Triggers

Representative smokes must not miss a genuinely distinct runtime boundary; add a case when a new boundary or real regression appears. Introduce richer dependency resolution only if supported host layouts cannot be handled by the narrow checks. Revisit evidence enrichment under a separate handoff/observer behavior project, not opportunistically during source moves.

## Draft Self-Review

- Placeholders: no unresolved template content in discovery/design.
- Internal consistency: naming table, optional versus required dependencies, and version ownership agree.
- Scope: preserves issue #74 and accepted grouping/promotion; excludes session engine work and speculative testing.
- Ambiguity: remaining choices are bounded engineering details or kickoff evidence checks; no unresolved product-grouping question.

This is author self-review and complexity assessment, not an independent review or a configured gate pass.

## References

- [Discovery](discovery.md)
- [Issue #74](https://github.com/tkstang/skills/issues/74)
- Current build/discovery/release owners: scripts/build-generated.mjs, scripts/lib/discover-skills.mjs, scripts/bump-version.mjs
- Existing proof surfaces: tests/tooling/generated-output-sync.test.ts, tests/release/skill-version-bumps.test.ts, tests/release/versioning.test.ts, tests/repo/plugin-manifests.test.ts, tests/repo/marketplace-manifests.test.ts, tests/repo/layout.test.ts
