---
oat_status: complete_with_concerns
oat_phase: p04
oat_last_updated: 2026-09-14
oat_generated: false
---

# Validation: Public Skill-Source Organization Milestone

This record covers the public implementation range from `origin/main` at
`20bb893ef6bcdd30704c681e12c60702b7c89bb8` through review-fix iteration 2 in
the commit containing this file. Its final evidence was gathered from the
bounded diff based on reconciled review receipt
`8e3bd863dea4ead0e780181da10f1529a7b0f2f2` and repeated against the committed
head before handoff. Publication, merge, live provider validation, user-level
installation, and the private p05 ownership cutover remain outside this local
milestone.

## Static Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Changed-skill version gate | pass | 12 changed skills verified against `origin/main` |
| TypeScript type-check | pass | `pnpm run type-check` |
| Generated-output freshness | pass | all declared generated outputs in sync through `pnpm run build:check` |
| Repository validation | pass | `pnpm run validate` |
| Complete Vitest suite | pass | 135 files passed, 1 skipped; 1,988 tests passed, 1 skipped |
| Mocked end-to-end smoke | pass | `pnpm run smoke` |
| OAT internal flags | pass | 72 `.agents/skills/**/SKILL.md` files carry `metadata.internal: true` |
| Diff whitespace | pass | `git diff --check` |
| Documentation build | pass | current review-fix basis produced 38 static routes |
| Original focused documentation checks | pass | 56 tests across docs-presence, README scope, and layout at p04-t01 |
| Review-fix focused suite | pass | 50 tests across generated-output, docs-presence, plugin-manifest, and marketplace-manifest suites |

The complete sweep first found three stale references to the renamed
`session-fork-to-destination.md` guide. Follow-up p04-f01 corrected those
references, incremented the canonical skill version from `0.2.0` to `0.2.1`,
regenerated both distribution copies, and passed 21 focused tests. Review-fix
iteration 1 aligned active maintenance and nine-skill manifest descriptions
and added the custom-root regression. Iteration 2 completed the maintained-path
sweep and refreshed this evidence basis.

## Isolated Artifact Evidence

`pnpm exec vitest run tests/tooling/skill-packaging.test.ts` passed 40/40
tests. The suite exercises representative prompt-only, executable, shared-code,
required-skill, standalone, and complete-plugin installations outside the
checkout with isolated home/config directories. It verifies fresh output,
atomic replacement, symlink containment, declared resources, and installable
plugin payloads without adding a second packaging test framework.

## Behavioral Evidence

- The complete Vitest suite passed after both review-fix iterations.
- The existing mocked consensus smoke passed.
- Required local skill and CLI prerequisite guards, the session and consensus
  plugin manifests, and all six declared standalone distributions are covered
  by the existing source, packaging, layout, and release tests.
- The clean-break migration emits no `coding-session-handoff` or
  `export-session-transcript` compatibility skill, alias, wrapper, or redirect.
- The transitive shared-source guard is implemented and backlog item
  `BL-260723-guard-transitive-shared` is closed and archived.
- The custom-root declared-output regression writes a nonempty fixture, checks
  it cleanly, and detects stale, missing, and orphaned fixture content.

## Live and Release Evidence

No live or paid provider gate ran. Static manifests and isolated installations
do not prove marketplace publication, fresh provider discovery, permissions,
or production readiness for the session plugin. The public progress PR is not
published and merge approval has not been requested. User-level installs were
not changed. The separate private p05 cutover remains blocked on the public
merge and its own authorization.

## Complexity Review

**Verdict:** deletion-rule compliant. The effective migration has one
distribution catalog, one existing build/version pipeline, and one installed
artifact suite. No duplicate builder, version source, or test framework remains.

**Simplest viable solution:** one canonical owner per skill under `src/skills`,
shared modules under `src/shared`, plugin code under `src/plugins`, and a single
`src/distributions.ts` catalog driving complete generated installation units.
Existing build, validation, version, and Vitest infrastructure proves that
contract.

| Component | Decision | Contract and cost |
| --- | --- | --- |
| `src/distributions.ts` and `scripts/lib/packaging.ts` | keep | Required one-owner/multi-target install contract; medium maintenance cost |
| Generated standalone and plugin payloads | keep | Self-contained installations cannot import siblings or checkout sources; high file volume but fully derived |
| 40-case installed-boundary suite | keep | Protects atomicity, symlinks, freshness, resources, and isolated installs using existing Vitest helpers |
| Historical `legacySkillOwners` map | keep | Used only for version comparison; negligible cost and no compatibility output |
| Independent plugin release targets | keep | Session and consensus plugins release separately; low additional manifest/tooling cost |
| Approved documentation breadth | keep | Records installation and ownership decisions on existing user and engineering surfaces; no new docs section |

No removable machinery or deferred simplification was identified.

## Review and Publication Disposition

Independent review cycles 1 and 2 identified the bounded fixes represented by
this record. Cycle 3 reviewed `9d9c1e8607941999b0baeed9e8d8d7749a96730f`
and passed with zero Critical, Important, Medium, or Minor findings. The local
public milestone is ready for the authorization-bound progress-PR step. PR
creation, push, merge, live or paid provider validation, global installation,
private-repository access, and p05 were not performed.
