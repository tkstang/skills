---
oat_generated: true
oat_generated_at: 2026-09-16T23:21:40Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/first-party-standalone-installer
oat_gate_headless: true
oat_gate_run_id: 0a7568fc-1f95-49dd-90bc-3768c2c5fc2c
oat_gate_target: claude-fable-skip-permissions
oat_gate_runtime: claude
oat_invocation_model: fable
oat_invocation_reasoning_effort: provider-default
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-09-16T23:21:40Z
**Scope:** `plan.md` for first-party-standalone-installer (quick mode), aligned against `discovery.md` and `design.md`; re-gate after receipt of gate run `8526c3ae-9e24-42fd-b0c2-bf22639824df`
**Files reviewed:** 3 (`plan.md`, `discovery.md`, `design.md`), plus repository context (`install.sh`, `src/plugins/consensus/install-sh.test.ts`, `src/plugins/consensus/install-contract.test.ts`, `tests/repo/readme-scope.test.ts`, `tests/repo/layout.test.ts`, `tests/AGENTS.md`, `tests/helpers/git-env.mjs`, `tools/git-hooks/pre-push`, `vitest.config.mjs`, `scripts/run-vitest.mjs`, `scripts/validate-skill-versions.ts`, `package.json`, `documentation/package.json`, `.oxfmtrc.json`, `.oxlintrc.json`, `documentation/docs/user-guide/installation.md`, `RELEASING.md`, backlog item and kickoff handoff, git tag inventory, prior archived review `reviews/archived/artifact-plan-review-2026-09-16T231057Z.md`)
**Commits:** n/a (artifact review)

Dispatch: scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:fable effort_axis=not-applicable dispatch_policy=frontier dispatch_ceiling=fable target=fable

Gate route: inline (runtime=claude, cliRoot=/Users/tstang/Library/pnpm/store/v11/links/@open-agent-toolkit/cli/0.2.77/d9bcf1efab193b3f50b4a9c1dd921b1d2a818293c9e44f3789f0f41ed09b7842/node_modules)

## Summary

All eight findings from the prior plan gate are resolved in the artifact: the test seam is declared and inert by default, `v0.1.2` is the documented pin with an unreleased caveat, streamed-script refusal has a step and a test, `oat_template` is `false`, flag-validation cases are enumerated, the marker name is fixed, oxlint runs on changed files, and the quick-mode `spec` ledger row is explained. Every command the plan names resolves against the repository. One new gap blocks: the helper and its tests spawn Git in scratch directories but the plan never requires scrubbing inherited `GIT_*` environment, which this repository has already recorded as a prior corruption incident and encodes in `tests/helpers/git-env.mjs`. One medium and two minor items cover unspecified host-parent creation ordering and small command/contract wording drift.

Findings: 0 critical, 1 important, 1 medium, 2 minor

## Findings

### Critical

None

### Important

- **Git invocations have no environment-scrub requirement in the helper or its tests** (`plan.md:81`, `plan.md:83`, `plan.md:56`)
  - Issue: Step 3 says to "invoke Git with argv arrays" and to fetch `refs/tags/<ref>` into a private temporary repository, and Step 2 says tests "exercise the real `install.sh` process with isolated environment variables", but neither names the `GIT_*` scrub. Git honors `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_COMMON_DIR`, and the `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n`/`GIT_CONFIG_VALUE_n` injection family over cwd and `-C`. If an operator runs `install.sh --skill ...` from a git hook, an alias wrapper, or any shell that exports those variables, the helper's `init`/`fetch`/`checkout --detach` sequence operates on the ambient repository: the fetch lands tags in the operator's real repo and the detached checkout moves their real `HEAD` and work tree. That violates the design's "clean only the exact temporary directory created by this invocation" boundary (`design.md:115`) and the discovery constraint that refusals never damage anything outside owned paths. The repository already treats this as a prior-incident rule: `tests/helpers/git-env.mjs:1-22` documents the corruption that occurred when a temp-repo test inherited `GIT_DIR` inside a hook, and every existing temp-git test (`tests/release/skill-version-bumps.test.ts`, `tests/tooling/git-hooks.test.ts`, `tests/tooling/worktree-scripts.test.ts`) imports that helper. The new fixture builder and the shipped helper are both temp-repo Git spawners and inherit the same exposure.
  - Fix: In Step 3, add a bullet requiring the helper to spawn every Git process with an environment from which all `GIT_*`-prefixed variables are removed (whole-prefix scrub, not a named list), and to pass the temporary repository explicitly (`-C <tmp>` or `--git-dir`/`--work-tree`) so resolution never depends on ambient state. In Step 2, require fixture Git commands to use `tests/helpers/git-env.mjs` `gitEnv()` and add one test that sets `GIT_DIR`/`GIT_WORK_TREE` (and one `GIT_CONFIG_COUNT` injection) to a decoy repository in the process environment, then proves the install still resolves the fixture tag and the decoy repository's `HEAD`, refs, and config are byte-for-byte unchanged.

### Medium

- **Creation and symlink-checking of a missing host parent chain is unspecified** (`plan.md:86-89`, `design.md:140-143`)
  - Issue: Reservation uses exclusive `mkdir` of the final path and staging is "same-parent", both of which require `.claude/skills/`, `.agents/skills/`, or `.cursor/skills/` to already exist. In a fresh project none of them do. The plan does not say which step creates the parent chain, whether that creation happens before or after the preflight refusals that must produce "no host-directory mutation" (`plan.md:71`, `plan.md:82`), or how the symlinked-ancestor check interacts with creation. Ordering matters: a recursive create follows symlinks in intermediate components, so if `.claude` is a symlink the parent would be created through it, defeating the ancestor refusal. An implementer can pick any of three orderings and each yields different observable behavior for the refusal and race tests.
  - Fix: Add a Step 3 bullet: after all argument, tag, payload, and entry validation succeed and before staging, walk the destination's ancestor components on the physical project root, refuse if any existing component is a symlink, then create each missing component one at a time with a non-following `mkdir`, and re-run the ancestor check immediately before reservation as already planned. State in Step 2 that every refusal test asserts the parent chain is absent afterwards when it did not pre-exist, and add one host-mapping test that starts from a project with no host directory at all.

### Minor

- **Default Git repository URL is never named** (`plan.md:83`, `design.md:166`)
  - Issue: Step 3 says "the default repository or `--repository` override" and the design says "the canonical Git repository", but neither gives the URL. `install.sh:20` pins the raw base to `raw.githubusercontent.com/tkstang/skills`; the Git origin for `fetch refs/tags/...` is a different URL, and the p01-t02 contract test that protects "the documented command shape" cannot pin a value the plan does not state.
  - Suggestion: Name the default (for example `https://github.com/tkstang/skills.git`) once in Step 3 and reference it from the p01-t02 contract assertion list.

- **p01-t02 Step 1 verification names the optional release test without the omit clause** (`plan.md:126`, `plan.md:132`, `plan.md:151`)
  - Issue: The file list marks `tests/release/standalone-install-contract.test.ts` as "Create or modify if needed", and Steps 3 and 4 say to omit it when not created, but the Step 1 command lists it unconditionally. Vitest treats an unmatched filter as a no-op so the command still passes, which means the "New documentation assertions fail before the guide is updated" expectation can be silently satisfied by running zero new tests.
  - Suggestion: Either decide the file is created (drop "if needed") or repeat the omit clause under Step 1 and state that the failing-first expectation applies to whichever file carries the new assertions.

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md` (key decisions, constraints, success criteria, out of scope, risks), `design.md` (component responsibilities, API, error handling, testing strategy), `plan.md`; repository files listed above for command and contract verification. Workflow mode: quick. Dispatch Profile advisory: no `## Dispatch Profile` section is present, which is normal and not a finding.

### Prior Gate Finding Resolution

| Prior finding | Status | Evidence |
| --- | --- | --- |
| I1 race/failure seam undeclared | resolved | `plan.md:70`, `plan.md:91`; `design.md:104` |
| M1 docs tag assumption | resolved | `plan.md:139` pins `v0.1.2` with unreleased caveat and placeholder rejection |
| M2 streamed-script refusal | resolved | `plan.md:71`, `plan.md:82`; `design.md:164` |
| M3 `oat_template: true` | resolved | `plan.md:14` |
| m1 flag-validation scenarios | resolved | `plan.md:60` |
| m2 marker name unfixed | resolved | `.standalone-install-incomplete` at `plan.md:68`, `plan.md:90`, `plan.md:142` |
| m3 no oxlint | resolved | `plan.md:108`, `plan.md:161` |
| m4 quick-mode `spec` row | resolved | `plan.md:254` |

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| D1 CLI activation: zero args unchanged; `--skill/--agent/--ref` required | covered | p01-t01 Step 3 bullets 1-2; Step 2 legacy compatibility and flag cases |
| D2 Pinned source: exact tag; local-repo fixtures | covered, with gap | qualified `refs/tags`, peel, detached `HEAD` check (`plan.md:83`); Git environment isolation missing (Important) |
| D3 Payload boundary: `skills/<name>/` only, never `src/skills/` | covered | `plan.md:84`; authored-source-only fixture test |
| D4 Project destinations per host | covered, with gap | `plan.md:86`; parent-chain creation unspecified (Medium) |
| D5 Invocation output per host | covered | `plan.md:61`, `plan.md:92` |
| D6 Refuse existing destination, no force/merge | covered | `plan.md:65`, `plan.md:87` |
| D7 Integrity semantics (inventory, stage, exclusive mkdir, marker, `wx`) | covered | `plan.md:88-92` |
| D8 Authenticity wording | covered | `plan.md:143` |
| D9 Sibling skills not auto-installed | covered by omission | out of scope in discovery; plan adds nothing |
| D10 Live acceptance is a separate authority-gated step | covered | `plan.md:144-145`, `plan.md:208-218` |
| D11 Deterministic test seam opt-in and inert by default | covered | `plan.md:70`, `plan.md:91` |
| Design: streamed-script clear error | covered | `plan.md:71`, `plan.md:82` |
| Design: unknown/duplicate/missing-value flag rejection | covered | `plan.md:60` |
| Design: Node.js 22 for both contracts, dependency-free | covered | `plan.md:80`; helper is standard-library `.mjs` |
| Design: clean only the exact temporary directory this invocation created | partial | ambient `GIT_*` can redirect Git mutations outside that directory (Important) |
| Discovery risk: docs contract collision with single raw URL assertion | covered | `plan.md:130` preserves the Consensus pin; `install-contract.test.ts:48-57` verified |
| Success: Consensus contract tests stay green | covered | baseline and post-change runs of `install-sh.test.ts` and `install-contract.test.ts` |
| Success: docs and release checklist updated | covered | p01-t02 |
| Success: scoped tests use temp fixtures, no network | covered | `plan.md:56` |
| Backlog AC: test installs into a temp dir from a local checkout | covered | `--repository` against a temporary local Git fixture |

### Plan Format Conformance

- Task IDs `p01-t01` through `p01-t03` are stable and monotonic.
- Frontmatter is complete; `oat_template: false`, `oat_plan_parallel_groups: []` matches the sequential Parallelism argument.
- Reviews, Implementation Complete, and References sections are present and non-placeholder. Reviews table is the widened eight-column form; existing rows preserved.
- Commit messages follow Conventional Commits.
- Verification commands verified against the repository: `pnpm run test:vitest <files>` passes filters to `vitest run` (`scripts/run-vitest.mjs`), `tests/**/*.test.ts` and `src/**/*.test.ts` are included by `vitest.config.mjs`, `validate:skill-versions` accepts `--base-ref`, `premerge` covers build, type-check, build:check, test, validate, smoke, `documentation` `build` has a generate-index prebuild, and `.oxfmtrc.json`/`.oxlintrc.json` do not ignore any of the plan's named source, test, or doc paths.

### Extra Work (not in requirements)

None.

## Verification Commands

```bash
# After plan revisions
grep -n -i -E 'GIT_\*|gitEnv|git-env|scrub' .oat/projects/shared/first-party-standalone-installer/plan.md
grep -n -i -E 'parent|ancestor|mkdir' .oat/projects/shared/first-party-standalone-installer/plan.md
grep -n -E 'github\.com/tkstang/skills' .oat/projects/shared/first-party-standalone-installer/plan.md
# Existing prior-incident rule the plan must adopt
sed -n '1,22p' tests/helpers/git-env.mjs
# Existing contract the docs task must respect
pnpm run test:vitest src/plugins/consensus/install-contract.test.ts
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
