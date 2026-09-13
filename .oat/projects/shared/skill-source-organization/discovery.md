---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-09-13
oat_generated: false
oat_template: false
---

# Discovery: Skill Source Organization and Plugin Packaging

## Initial Request

Prepare an inactive follow-up to coding-session-handoff, for execution after that project merges. Implement [issue #74](https://github.com/tkstang/skills/issues/74): colocate authored skill sources and generate declared installable payloads. Include multiple plugins, optional standalone distributions of plugin skills, the agreed session renames, and promotion of session-handoff from personal-skills. Use the already-public complexity-review as the prompt-only standalone example; do not promote another skill merely to fill a test case.

The user authorized discovery/design on 2026-09-13, permitted spec-driven promotion if useful, and requested no deep design interview or unnecessary tests. Requirements are well established by the conversation and issue. Use quick mode with draft-and-review lightweight design instead of duplicating them in a separate spec. Keep the existing handoff project's active pointer unchanged.

## Clarifying Questions

Settled answers from the conversation, not outstanding questions:

- **Grouping:** Session management operations belong in session; observing and collaborating across providers belong in consensus. Group by behavior, not shared code ownership.
- **Individual installation:** Any plugin skill may be explicitly configured for standalone installation. Preserve descriptive standalone names while allowing short plugin-local names.
- **Dependencies:** Materialize shared script logic into each installation unit that needs it. Genuine dependencies on another skill's workflow are allowed, declared, documented, and checked; missing dependencies stop dependent work with installation guidance. No automatic installation.
- **Promotion example:** complexity-review already covers the simple standalone case. session-handoff is the actual new promotion.
- **Complexity-review ownership (confirmed 2026-09-13):** Bring the newer personal-skills 1.0.2 source/resources here. After the public replacement merges and is installable, open a separate personal-skills PR removing its independently authored copy and updating affected distribution/docs. Do not merge that PR or change active installations implicitly.
- **Process/tests:** Draft from the existing decisions. Avoid speculative frameworks, duplicated suites, arbitrary coverage targets, and tests of incidental prose. Protect stable contracts and costly regressions.

## Chosen Direction

One authored owner per skill, explicit distribution membership, and target-specific names. Generate complete standalone and plugin payloads. Adapt the current bundler and CI rather than introduce a competing packaging framework.

Manually maintained copies would drift; mandatory whole-plugin installation contradicts the standalone requirement; automatically advertising every skill as standalone would promise unverified support. A runtime dependency installer or universal host registry is unnecessary.

## Key Decisions

### Product and naming map

| Existing skill/source | Canonical / standalone name | Plugin | Plugin-local name |
| --- | --- | --- | --- |
| personal-skills session-handoff | session-handoff | session | handoff |
| export-session-transcript | session-export-transcript | session | export-transcript |
| coding-session-handoff after its current project merges | session-fork-to-destination | session | fork-to-destination |
| session-observer | session-observer | consensus | observer |
| session-observer-collab | session-observer-collab | consensus | observer-collab |
| complexity-review | complexity-review | none | not applicable |

Qualified invocation follows each host's supported namespace; this table specifies packaging names, not universal invocation syntax. Existing consensus-local names remain unchanged. Other consensus skills can opt into standalone output through configuration, but support is claimed only when that output is generated and verified.

1. **Ownership:** Colocate instructions, resources, implementation, and skill-owned tests. Real shared code and non-skill plugin CLI code retain explicit separate owners. Upstream OAT tooling is not a product source to copy or promote.
2. **Distribution:** Standalone runtime must not import another installed skill, the checkout, or developer dependencies. A complete plugin may share runtime internally. Declared skill-workflow prerequisites are a separate, valid dependency type.
3. **Safeguards:** observer-collab explicitly requires observer today. Preserve that workflow prerequisite, recognize supported standalone/plugin installations, and stop with the canonical skill name and install link when unavailable. Do not copy the other skill's workflow or guess availability.
4. **Promotion:** Move portable handoff ownership to this public repo, preserving attribution, useful assets, version lineage, and behavior. Coordinate the personal-skills consumer through its existing external-source mechanism; do not leave two editable owners or silently replace user installations.
5. **Versions:** Migrate to issue #74's quoted stable metadata.version as the sole authored field. One skill version applies across its generated forms. Plugin release versions are independent. Renames must preserve historical comparison; shared-code changes must reach all affected owners.
6. **Compatibility:** Cover old names/install paths, references, provider manifests, discovery, pinned recovery installation, and releases together. Prefer a narrow deprecation bridge where needed, not duplicate maintained implementations. Do not assume plugin-plus-standalone installations are deduplicated by hosts.
7. **Behavior:** Portable handoff remains agent-to-agent context transfer. Fork-to-destination preserves the guidance contract actually merged by the current project. Packaging does not resurrect native-identity automation or claim unsupported Cursor fork capabilities.

## Constraints

- No activation or implementation before coding-session-handoff merges and the user starts this project. Refresh the merged baseline before task ranges and versions are chosen.
- Shipped runtime stays dependency-free Node 22+ ESM, without an install step or tsx. TypeScript/esbuild and any tsx used for migrated repository tooling are developer-only.
- Preserve compatible pinned Node/pnpm/Vitest versions, CI jobs, hooks, documentation site, and release boundaries. No unrelated formatter sweep or hook manager.
- Stage and validate complete declared output before replacement; preserve prior output on failure. Reject escaping, colliding, dependency-bearing payloads and detect stale/missing/orphaned files without repairing them during freshness checks.
- Version checks use an explicit resolved base, include local changes, and fail closed on missing history. No implicit fetch or unrelated version bumps.
- CLI preflight stays bounded and local to the selected operation/provider. Missing capability gets guidance. No paid probes, mandatory network, auto-update, unrelated-provider checks, or new background update/cache service.
- README and maintained docs explain distribution choices, names, prerequisites, promotion provenance, and build patterns. Static checks do not establish live provider discovery.
- This planning task authorizes no live sessions, transcript capture, credentials, global installation changes, personal-repo mutation, publication, or merge.

## Success Criteria

- Every authored skill has one source owner; every generated installation unit has an explicit owner and target name.
- Consensus and session have coherent manifests/catalog entries and independent release handling; configured standalone forms retain descriptive names.
- The naming table is implemented. Complexity-review remains prompt-only without artificial runtime/build scaffolding.
- Shared code is included wherever needed without sibling-install runtime imports. Missing genuine skill prerequisites produce documented stops and install links.
- Existing runtime behavior is preserved. Representative outside-checkout checks cover prompt-only, executable, shared-code, prerequisite, and complete-plugin packaging.
- Freshness/version checks catch distribution drift, renamed-owner version resets, and missed transitive consumers. Existing suites are reused instead of cloned by skill/provider.
- Promotion records the source revision, public-safe contents, attribution/version history, and explicit personal-skills ownership cutover. No active installation is replaced merely to prove packaging.
- Complexity-review's newer content is owned here, and a linked personal-skills removal PR is opened with its disposition recorded. Any retained personal distribution consumes the public source; no second editable owner remains after that PR is merged.
- Documentation distinguishes static packaging, artifact execution, and live release verification. Experimental behavior remains labeled experimental.

## Existing Evidence and Related Work

Dated local baseline: skills commit 10d901e8afb3217db9855fa48c7e83f4f02c8e6c, inspected 2026-09-13. Revalidate at execution.

- scripts/lib/discover-skills.mjs treats skills/* and plugins/*/skills/* as authored roots.
- scripts/build-generated.mjs already owns deterministic esbuild output.
- scripts/bump-version.mjs discovers skills but hardcodes consensus provider manifests; multi-plugin release handling needs an explicit owner.
- skills/session-observer-collab/SKILL.md declares the observer workflow prerequisite; its authored .mjs/.d.ts runtime remains an exception targeted by issue #74.
- skills/complexity-review/SKILL.md is already public, MIT, prompt-only, version 1.0.0. The personal copy has newer divergent content: reconcile ownership and useful changes, not another promotion or silent overwrite.
- Personal-skills source at commit 80a5a76 contains session-handoff 1.1.0 as two authored files: src/skills/session-handoff/SKILL.md and assets/handoff-template.md. Observer/export are optional integrations, not mandatory prerequisites. Promotion is still a dogfooding candidate; packaging success must not imply its behavioral readiness gates passed.
- Issue #74 is the primary migration contract. Its prohibition on another skill installation is interpreted as applying to shared runtime code, not the explicitly accepted workflow prerequisite case.
- BL-260723-guard-transitive-shared overlaps the shared-consumer version guard and records an observed missed-bump incident. Keep it open until implementation meets its acceptance criteria, then close it in that implementation change.

## Out of Scope

- New session-fidelity algorithms, richer tool-call evidence, or automatic agent conversion. Research can inform later portable handoff improvements, not additional packaging requirements.
- [Issue #75](https://github.com/tkstang/skills/issues/75): exact own-session review and bounded detailed observer evidence.
- Fork executors, worktree creation, ADE tab control, child identity receipts, paid provider gates, or superseded handoff automation.
- Another standalone promotion, custom dependency installer, universal host registry, marketplace service, or new test/evaluation framework.

## Assumptions and Open Questions

- Names/grouping are settled. Exact manifest spelling and rendering mechanics are engineering choices, not another product interview.
- Kickoff must verify final merged fork behavior and the promotion source; installed user copies are not canonical baselines.
- Derive compatibility bridges from actual published contracts. If a host cannot resolve a prerequisite across package forms, document the supported route and stop rather than invent success.
- Public promotion needs attribution/license reconciliation and an explicit separate personal-skills cutover before its authored owner is retired.

## Risks

- **Broken installs hidden by checkout paths:** use isolated artifact execution/resource checks at the installation boundary.
- **Version identity loss:** use explicit legacy-owner mapping and actual shared dependency analysis with focused existing tests.
- **Scope growth:** preserve required invariants, but justify each new test/helper by a concrete failure not already covered.

## Next Steps

The user accepted the design as a planning basis and authorized plan authoring on 2026-09-13. The plan now has 14 tasks across five sequential phases, including a post-public-merge private-repo cutover. The predecessor PR #70 merged at 20bb893ef6bcdd30704c681e12c60702b7c89bb8; this project's planning commits are now on feat/skill-source-organization based on that merge. The user explicitly activated this project and authorized self-review and the plan gate. Finish those reviews before claiming implementation readiness; refresh the execution inventory at p01-t01.
