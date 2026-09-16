---
oat_generated: true
oat_generated_at: 2026-09-16T23:10:57Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/first-party-standalone-installer
oat_gate_headless: true
oat_gate_run_id: 8526c3ae-9e24-42fd-b0c2-bf22639824df
oat_gate_target: claude-fable-skip-permissions
oat_gate_runtime: claude
oat_invocation_model: fable
oat_invocation_reasoning_effort: provider-default
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-09-16T23:10:57Z
**Scope:** `plan.md` for first-party-standalone-installer (quick mode), aligned against `discovery.md` and `design.md`
**Files reviewed:** 3 (`plan.md`, `discovery.md`, `design.md`), plus repository context (`install.sh`, `src/plugins/consensus/install-contract.test.ts`, `src/plugins/consensus/install-sh.test.ts`, `documentation/docs/user-guide/installation.md`, `RELEASING.md`, `vitest.config.ts`, `scripts/run-vitest.mjs`, git tag inventory)
**Commits:** n/a (artifact review)

Dispatch: scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:fable effort_axis=not-applicable dispatch_policy=frontier dispatch_ceiling=fable target=fable

Gate route: inline (runtime=claude, cliRoot=/Users/tstang/Library/pnpm/store/v11/links/@open-agent-toolkit/cli/0.2.77/d9bcf1efab193b3f50b4a9c1dd921b1d2a818293c9e44f3789f0f41ed09b7842/node_modules)

## Summary

The plan is complete, sequential, and closely mirrors the design's integrity and refusal contract; every discovery key decision maps to a task step. Two gaps need resolution before implementation: the plan requires deterministic race and failure-injection tests against the real `install.sh` process but never declares the test seam that makes them possible in a shipped installer, and the documentation task assumes a pinned release tag with current standalone payloads when the only existing tag (`v0.1.0`) carries only two legacy-named payloads. Remaining items are format conformance and small coverage drift between design test scenarios and the plan's test list.

Findings: 0 critical, 1 important, 3 medium, 4 minor

## Findings

### Critical

None

### Important

- **Race and failure-injection tests have no declared seam in the shipped helper** (`plan.md:66-69`, `plan.md:87-88`)
  - Issue: Task p01-t01 Step 2 requires tests for "deterministic post-preflight directory and symlink collision", "post-reservation competing directory, regular-file, symlink, FIFO ... creation", and "injected post-reservation copy or inventory failure", all exercised through "the real `install.sh` process" (`plan.md:56`). Preflight, exclusive reservation, and population happen inside one Node process with no pause point, so a test cannot create a competitor "after preflight but before reservation" or "after reservation" without a control surface in `scripts/install-standalone.mjs`. Neither `design.md:179-193` nor the plan names that surface. An implementer will either add an undocumented test hook to a security-sensitive installer, or silently downgrade these to unit tests of internal functions, contradicting the stated process-level test contract.
  - Fix: In Step 3, declare the seam explicitly. For example, a single environment variable such as `INSTALL_STANDALONE_TEST_HOOK=<phase>:<path>` that pauses (waits for a file) or injects failure at named phases (`after-preflight`, `after-reservation`, `during-populate`, `before-verify`), documented as test-only, refused unless an accompanying opt-in variable is set, and covered by a test asserting it is inert by default. State in Step 2 that these scenarios use the hook, and add the `--help` text or code comment that names it so the surface is reviewable in the p01 code review.

### Medium

- **Documentation task assumes a release tag that carries current standalone payloads, but none exists** (`plan.md:129`, `plan.md:122`)
  - Issue: Step 2 says "Show a pinned-tag checkout/install workflow" and Step 1 protects an "explicit pinned tag" in the guide. The only tag on origin is `v0.1.0`, whose `skills/` tree contains only `export-session-transcript` and `session-observer`; the former is a historical name that discovery decision 3 (`discovery.md:45`) forbids resolving. So no documented example can succeed against a real tag today. The repository precedent is the not-yet-released `v0.1.2` pin in `install.sh:18` and `installation.md:187-191`, and `install-contract.test.ts:52-56` forbids the literal `<tag>` placeholder in the guide. The plan does not say which tag the docs will name or how to phrase the "usable once released" caveat.
  - Fix: Add a decision to Step 2: document `--ref v0.1.2` (matching the Consensus pin) with the same "becomes usable once `v0.1.2` is released" wording already used at `installation.md:187`, and note that the standalone contract test must reject placeholder refs the same way the existing `<tag>` assertion does. Alternatively, state that the example uses `--repository /path/to/clone` with a locally created tag, and say so in the guide.

- **Streamed-script refusal from the design has no plan step or test** (`plan.md:78`, `design.md:91`)
  - Issue: The design's Argument Dispatcher must "preserve clear errors when standalone mode is invoked from a streamed script with no adjacent helper", because the documented Consensus path is `curl ... | bash` and users will try `curl ... | bash -s -- --skill ...`. The plan's Step 3 bullet only says "delegate standalone arguments to `scripts/install-standalone.mjs`", and the Step 2 test list has no case for a missing adjacent helper.
  - Fix: Add a Step 3 bullet: when `--skill` (or any standalone flag) is present and `$(script_dir)/scripts/install-standalone.mjs` does not exist, fail with an `install.sh:` message that names the checkout-based procedure. Add a Step 2 test that copies `install.sh` alone into a temp directory and asserts the refusal creates no host directory.

- **Plan frontmatter still declares `oat_template: true`** (`plan.md:14`)
  - Issue: The plan is fully authored, yet its frontmatter keeps the scaffold's `oat_template: true`. `design.md:7` already flips to `false`, and every archived plan in `.oat/projects/archived/*/plan.md` records `oat_template: false`. Lifecycle tooling that keys on this flag may treat the plan as unfilled.
  - Fix: Set `oat_template: false` when the plan is finalized after review receipt.

### Minor

- **Flag-validation scenarios from the design are missing from the plan test list** (`plan.md:60`, `design.md:184`)
  - Issue: The design requires that "unknown flags, missing values, invalid skill names, unsupported agents, and partial standalone inputs do not create host directories" and that duplicates are rejected (`design.md:101`). The plan lists only required-flag parsing, `--help`, malformed name, and unsupported host.
  - Suggestion: Extend the Step 2 bullet to name unknown flags, duplicate flags, missing values, and partial flag sets, each asserting no host directory is created.

- **Reserved marker name is never fixed** (`plan.md:87`, `plan.md:133`)
  - Issue: Task p01-t01 tests reject "the reserved marker name" and Task p01-t02 docs must explain recovery from a marked partial destination, but neither task names the marker. The two tasks can drift.
  - Suggestion: Name the marker once in the plan (for example `.oat-install-incomplete`) and reference it from both tasks.

- **Lint is not run on the new files** (`plan.md:90-102`, `plan.md:169-189`)
  - Issue: The plan formats with `oxfmt` and runs `premerge`, but `premerge` does not include `oxlint`, and CI lints changed files. The pre-commit hook covers this only when hooks are installed.
  - Suggestion: Add `pnpm exec oxlint scripts/install-standalone.mjs tests/tooling/standalone-installer.test.ts src/plugins/consensus/install-sh.test.ts` to Step 4 of p01-t01 and the equivalent for p01-t02.

- **Reviews table carries a `spec` artifact row that quick mode cannot satisfy** (`plan.md:235`)
  - Issue: Quick mode has no `spec.md` (`state.md` records "Spec: N/A"), so the pending `spec | artifact` row will never bind to an artifact.
  - Suggestion: Leave the row in place (do not delete rows); it is harmless. Optionally note in the row's Artifact cell that spec is not produced in quick mode.

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md` (key decisions, success criteria, out of scope, risks), `design.md` (component responsibilities, API, error handling, testing strategy), `plan.md`; repository files listed above for verification of commands and existing contracts. Workflow mode: quick.

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| D1 CLI activation: zero args unchanged; `--skill/--agent/--ref` required | covered | p01-t01 Step 3 bullets 1-2; Step 2 legacy compatibility case |
| D2 Pinned source: exact tag; local-repo fixtures | covered | p01-t01 Step 3 bullet 3 (qualified `refs/tags`, peel, detached HEAD check); annotated-tag and branch/tag fixtures |
| D3 Payload boundary: `skills/<name>/` only, never `src/skills/` | covered | p01-t01 Step 3 bullet 4; authored-source-only fixture test |
| D4 Project destinations per host | covered | p01-t01 Step 3 bullet 6 |
| D5 Invocation output per host | covered | p01-t01 Step 2 host destinations and invocation output |
| D6 Refuse existing destination, no force/merge | covered | p01-t01 Step 3 bullet 7; existing-destination test |
| D7 Integrity semantics (inventory, stage, exclusive mkdir, marker, `wx`) | covered, with gap | p01-t01 Step 3 bullets 8-11; race and injection tests need a declared seam (Important) |
| D8 Authenticity wording distinguishes exact tag and copy fidelity from provenance | covered | p01-t02 Step 2 bullet 5 |
| D9 Sibling skills not auto-installed | covered by omission | Out of scope in discovery; plan adds nothing |
| D10 Acceptance boundary: live host evidence is a separate authority-gated step | covered | p01-t02 Step 2 bullets 6-7; p01-t03 Step 2 |
| Design: streamed-script clear error | partial | No plan step or test (Medium) |
| Design: unknown/duplicate/missing-value flag rejection | partial | Not in plan test list (Minor) |
| Design: Node.js 22 for both contracts, dependency-free | covered | p01-t01 Step 3 bullet 1; helper is standard-library `.mjs` |
| Discovery risk: docs contract collision with single raw URL assertion | covered | p01-t02 Step 1 preserves the Consensus pin; tag choice unresolved (Medium) |
| Success: Consensus contract tests stay green | covered | Baseline and post-change runs of `install-sh.test.ts` and `install-contract.test.ts` |
| Success: docs and release checklist updated | covered | p01-t02 |
| Success: scoped tests use temp fixtures, no network | covered | p01-t01 Step 2 |
| Dispatch Profile named ceiling | not applicable | No `## Dispatch Profile` section; omission is normal |

### Extra Work (not in requirements)

None. Verification commands were checked against the repository: `scripts/run-vitest.mjs` passes file filters through to `vitest run`; `documentation/package.json` defines `build` with a generate-index prebuild; `premerge` covers build, type-check, build:check, test, validate, and smoke.

## Plan Format Conformance

- Task IDs `p01-t01` through `p01-t03` are stable and monotonic.
- Reviews, Implementation Complete, and References sections are present and non-placeholder.
- Reviews table is the widened eight-column form; existing rows preserved.
- `oat_plan_parallel_groups: []` matches the sequential dependency argument in the Parallelism section.
- Commit messages follow Conventional Commits.

## Verification Commands

```bash
# After plan revisions
grep -n 'oat_template' .oat/projects/shared/first-party-standalone-installer/plan.md
grep -n -i -E 'hook|seam|inject|streamed|adjacent helper|marker name|v0\.1\.2' .oat/projects/shared/first-party-standalone-installer/plan.md
# Existing contract the docs task must respect
pnpm run test:vitest src/plugins/consensus/install-contract.test.ts
git ls-remote --tags origin
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
