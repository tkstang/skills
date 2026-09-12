---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: backlog-review
oat_external_plan_sources:
  - .oat/repo/pjm/backlog/reviews/backlog-and-roadmap-review.md
  - .oat/repo/pjm/backlog/items/BL-260723-guard-transitive-shared.md
oat_external_plan_commit: f5395a35
oat_backlog_items:
  - BL-260723-guard-transitive-shared
oat_issue_url: null
created: '2026-09-08T00:16:29Z'
updated: '2026-09-11T13:15:47.721Z'
oat_external_plan_reverified_commit: f5395a35
---

# Require version bumps for every skill affected by shared generated-runtime changes

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`. Execute it directly, or import it with `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Stop on a stated STOP condition instead of improvising.

## Outcome

The PR skill-version gate detects changed shipped shared generated-runtime output and requires every transitive consumer's `SKILL.md` version to increase. The consumer set is derived from the build mapping/import graph, so adding a shared output or consumer cannot silently escape a hand-maintained list. Source-only edits that emit identical runtime bytes do not create an extra transitive bump requirement; the existing generated-output consistency gate separately rejects stale output.

## Source and live evidence

- Planned at commit `f5395a35` on 2026-09-07.
- Related item: `BL-260723-guard-transitive-shared` (Guard transitive shared-runtime skill version bumps).
- `scripts/validate-skill-versions.mjs:134-233` only checks whether files changed directly beneath each canonical skill directory.
- `scripts/build-generated.mjs:484-555` already derives import rewrites by resolving emitted relative imports against `generatedOutputs`.
- `tests/release/skill-version-bumps.test.ts` provides isolated Git-repository fixtures for the version gate.
- Existing plan `2026-07-17-skill-files-disk-derivation.md` covers direct skill discovery, not this transitive consumer relationship.

## Drift check

```bash
git diff --stat f5395a35..HEAD -- scripts/validate-skill-versions.mjs scripts/build-generated.mjs tests/release/skill-version-bumps.test.ts tests/tooling/generated-output-sync.test.ts
```

Material changes to mapping identity, import-rewrite derivation, or version-gate inputs are a STOP condition until this plan is reconciled.

## Repository conventions

- Node: 22 or newer; pnpm: pinned by `packageManager`.
- Generated output: edit canonical TypeScript/build tooling and run `pnpm run build`; never hand-edit generated `.mjs` files.
- Required gates: `pnpm run build:check`, `pnpm run validate`, `pnpm run validate:skill-versions -- --base-ref <ref>`, and focused Vitest suites.
- Conventional Commits; do not push or publish without authorization.

## Scope

### In scope

- `scripts/validate-skill-versions.mjs` and a small shared helper under `scripts/lib/` if needed.
- Reuse/export of build mapping and dependency derivation from `scripts/build-generated.mjs` without duplicating its graph.
- `tests/release/skill-version-bumps.test.ts` and `tests/tooling/generated-output-sync.test.ts`.
- Hook/CI wiring only if the existing `validate:skill-versions` entry does not automatically cover the new check.

### Out of scope

- Changing skill-version semantics or automatically editing versions.
- Changing generated runtime behavior.
- Maintaining a manual producer-to-consumer list.
- Repository-wide release redesign.

## Implementation steps

### 1. Expose one deterministic generated-output dependency graph

Refactor the existing mapping/import-resolution logic just enough for the version validator to ask which canonical skill outputs consume a changed shared source/output. Preserve current ambiguity and unresolved-import failures.

Use `generatedOutputs`, `collectRelativeModuleSpecifiers`, and the actual rewrite semantics (`mapping.importRewrites ?? deriveImportRewrites`) to identify output-to-output edges; do not treat all copies of the same TS source as interchangeable. Keep graph construction read-only and rooted in the supplied validator `root`, not the module's ambient repository. Walk reverse edges with a visited set. Scope the first implementation to statically mapped outputs; unresolved dynamic consumers require a STOP decision, not a silent skip.

**Verify:** `pnpm exec vitest run tests/tooling/generated-output-sync.test.ts` passes.

### 2. Extend changed-skill calculation transitively

After collecting Git-changed paths, add every canonical skill directory whose generated wrapper depends on a changed shared generated source/output. Feed this derived set through the existing base/current SemVer comparison and keep directly changed skill behavior unchanged.

Seed transitive traversal from changed emitted output paths, not every TS edit. Account for removed/renamed outputs and removed import edges using base and current graph evidence; alternatively fail with an explicit unsupported-change diagnostic before reporting success. Do not execute historical build scripts from the base to construct a graph. Retain the current new-skill/deleted-skill and SemVer rules. A one-line no-op source edit must not demand consumer bumps when emitted bytes are identical.

**Verify:** `pnpm run validate:skill-versions -- --base-ref origin/main` reports no findings on an unchanged compliant branch.

### 3. Add the wave-gap regression fixture

Create a fixture where a shared generated runtime changes while one importing skill bumps and sibling consumers do not. Assert all missing consumers are named. Add the passing counterpart and a mapping-added case proving no list update is required.

Also cover multi-hop imports, duplicate source fan-out, explicit rewrite overrides, cycles, deleted/renamed shared outputs, removed edges, source-only/no-output change, and an isolated temporary repository proving no ambient source checkout is read or mutated. A fixture whose graph cannot be resolved must fail closed, not silently fall back to direct-directory detection.

**Verify:** `pnpm exec vitest run tests/release/skill-version-bumps.test.ts` passes.

## Test plan and done criteria

- [ ] Directly changed skills retain current behavior.
- [ ] A shared-runtime change with stale consumer versions fails and names every consumer.
- [ ] Bumping every derived consumer passes.
- [ ] A newly mapped consumer is discovered mechanically.
- [ ] `pnpm run build:check`, `pnpm run validate`, and `pnpm test` pass.
- [ ] `pnpm run premerge` passes. `pnpm exec oxlint scripts/validate-skill-versions.mjs scripts/build-generated.mjs <new-helper>` and targeted `pnpm exec oxfmt --check <changed-authored-files>` pass; substitute only the exact helper actually added and exclude generated/instruction files.
- [ ] `git status --short` contains only explained implementation/test/version files.

## STOP conditions

- The consumer graph cannot be derived without a second hand-maintained mapping.
- Import resolution differs from the build's actual rewrite semantics.
- The proposed check requires changing generated runtime or bumping unrelated skills.
- Baseline tests or validation fail before implementation changes.

## Review focus

Review graph completeness, deletion/rename behavior, monorepo path normalization, and error messages that tell an author exactly which consumer versions are stale.
