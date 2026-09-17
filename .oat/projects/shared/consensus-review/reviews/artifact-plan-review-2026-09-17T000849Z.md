---
oat_generated: true
oat_generated_at: 2026-09-17T00:08:49Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/consensus-review
oat_gate_headless: true
oat_gate_run_id: 128cf9b8-0007-4de1-a310-ec5383e43c90
oat_gate_target: claude-fable-skip-permissions
oat_gate_runtime: claude
oat_invocation_model: fable
oat_invocation_reasoning_effort: provider-default
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-09-17T00:08:49Z
**Scope:** `plan.md` for the quick-mode Consensus Review project, checked against `discovery.md` and `design.md` (design present, so used as upstream), plus `state.md` and `implementation.md` for consistency.
**Files reviewed:** 5 project artifacts, plus source verification of every path and command the plan names
**Commits:** none (artifact review); plan revision at `52aab48a`

**Dispatch:** scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:opus effort_axis=not-applicable dispatch_policy=high dispatch_ceiling=opus target=opus
**Gate route:** inline (runtime=claude, cliRoot validated against `OAT_GATE_CLI_ROOT`). Inline execution on the gate-configured fable host meets the resolved opus reviewer ceiling.

## Summary

The plan is ready to execute. It is complete for quick mode, internally consistent, honestly scoped, and every source path, script, and test file it names exists in the repository at the reviewed revision. Design coverage is full: all twelve discovery decisions and every design section map to at least one of the seven tasks or to an explicit deferral. Two Medium findings concern plan metadata and one under-specified proof mechanism in p06-t02; neither blocks the gate. Verification commands were checked against `package.json` and `documentation/package.json`, `oat project validate-plan` passes, and the file-scoped formatter targets that already exist are oxfmt-clean, so the plan's per-task format commands will not produce unrelated diffs.

Findings: 0 critical, 0 important, 2 medium, 4 minor

## Findings

### Critical

None

### Important

None

### Medium

- **Plan frontmatter still carries the template flag** (`.oat/projects/shared/consensus-review/plan.md:14`)
  - Issue: `oat_template: true` remains set. The OAT CLI treats that value as a still-a-template signal and strips it from instantiated files; every other plan in this repository (all ten under `.oat/projects/archived/*/plan.md`) and this project's own `discovery.md` and `design.md` use `false`. `oat project validate-plan` does not reject it today, but tooling that consults the flag will read this fully authored plan as unfilled.
  - Fix: set `oat_template: false` in `plan.md` frontmatter.

- **p06-t02 does not say how the bundled runner is executed before any selector exists** (`.oat/projects/shared/consensus-review/plan.md:74`)
  - Issue: p06-t02 requires executing "the actual runner from each installed bundle outside the checkout" while forbidding a testing-only production CLI flag, and while the three scope selectors (p07-t01) and reviewer selection (p07-t02) do not yet exist. The design (`design.md:33`) is explicit that a help-only or unused-import check is insufficient. Without naming the mechanism, an implementer may either add the forbidden flag or pull p07 work forward. The existing precedent at `tests/tooling/skill-packaging.test.ts:913` executes standalone units by generating an entrypoint that imports the bundled module's exported CLI function and spawning it against fake provider binaries; the plan should state that the p06 proof follows that pattern (invoke an exported run entry of the bundled module, or a minimal fixed document request, with a fake provider) rather than leave it open.
  - Fix: add one sentence to p06-t02 **Build** naming the exercise mechanism, for example: "Prove execution by importing the bundled module's exported run entry from the copied install and driving it with the fake provider, as `skill-packaging.test.ts` does for other units; no new CLI surface."

### Minor

- **Prior plan review row records an invocation value for a non-code row** (`.oat/projects/shared/consensus-review/plan.md:164`)
  - Issue: the review ledger contract fills `Invocation` and `Gate Target` only for code reviews and uses `-` for artifact rows; the row for the automatic plan review records `auto`. The prose above the table already captures that provenance, so nothing is lost.
  - Suggestion: leave the row as is (do not rewrite bound rows); future artifact rows should use `-`.

- **p06-t02 file inventory omits the adapter capability table** (`.oat/projects/shared/consensus-review/plan.md:72`)
  - Issue: the design's provider transport policy (Claude read-only permission mode, Codex read-only sandbox with approval never, Cursor ineligible as reviewer) is declared in `src/plugins/consensus/provider-cli/adapters.ts:152`, `:201`, and `:252`, but p06-t02's **Files** and **Format** lists name only `types`, `structured-output`, `subprocess`, `invocation`, and `host-guard`. If the provider-specific strategy needs a capability marker there, the format command must be extended by hand.
  - Suggestion: add `adapters.ts` (and its test) to the "as needed" list, or state that adapter declarations are intentionally untouched.

- **p08-t02 commit type does not match its bookkeeping content** (`.oat/projects/shared/consensus-review/plan.md:144`)
  - Issue: the task archives the backlog item, regenerates the index, updates operating docs, and removes the consumed handoff, yet commits as `test(p08-t02): ...`. Conventional Commits is hook-enforced here; `test` is defensible for the fixtures but misdescribes the PJM lifecycle changes.
  - Suggestion: commit the receipt fixtures as `test(p08-t02)` and the PJM closeout as a separate `chore(oat)` commit, or use `chore` for the combined commit.

- **"Document the first supporting release" for `defaults.reviewers` is not named in p08-t01** (`.oat/projects/shared/consensus-review/plan.md:126`)
  - Issue: `design.md:63` requires documenting the first release that understands the additive `defaults.reviewers` key because older binaries reject unknown keys. p08-t01 lists the changelog and "config types/examples" but does not carry that specific requirement.
  - Suggestion: add "state the first supporting release for `defaults.reviewers` in the configuration guide and changelog" to p08-t01 **Build**.

## Requirements/Design Alignment

**Evidence sources used:** `discovery.md` (Key Decisions 1–12, Constraints, Success Criteria, Out of Scope), `design.md` (all sections), `state.md`, `implementation.md`, and direct source inspection of `src/distributions.ts`, `src/plugins/consensus/provider-cli/{structured-output,subprocess,invocation,host-guard,adapters}.ts`, `src/plugins/consensus/config/consensus-config.ts`, `tests/tooling/skill-packaging.test.ts`, `package.json`, `documentation/package.json`, and `.oxfmtrc.json`.

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| D1 One canonical owner, standalone + plugin-local `review` | implemented | p06-t01; `src/distributions.ts` already supports shared-owner outputs and `allowedSourceRoots` (session-observer → `plugins/consensus/skills/observer` precedent at `src/distributions.ts:137-150`) |
| D2 Exactly one reviewer turn, depth one | implemented | p06-t02 (host/depth at preflight and dispatch), p07-t03 (one attempt, invocation count); `host-guard.ts:60-80` supplies depth context |
| D3 Prefer different provider; same-provider consent | implemented | p07-t02 |
| D4 Three v1 selectors; deferred ranges fail clearly | implemented | p07-t01; deferred selectors listed in design "Proof and Deferred Scope" |
| D5 Requested vs inspected vs reported checks | implemented | p07-t03, p08-t01 rendering |
| D6 Owned JSON schema + deterministic OAT Markdown | implemented | p06-t01 creates schema, p07-t03 validates, p08-t01 renders |
| D7 Runtime maintenance independent; reconcile PR #86 | implemented | Boundaries and p08-t02; PR #86 verified still open at review time, plan already requires recheck |
| D8 External XDG state, explicit `--output` only | implemented | p07-t01 state, p08-t01 export after drift check |
| D9 Author provenance and finding paths | implemented | p07-t03 (author/reviewer evidence), p08-t01 (absolute handoffs) |
| D10 Same executable in both distributions; no dispatcher subcommand; narrow drift | implemented | p06-t01 (no subcommand), p07-t01 (selected-path drift and disclosure) |
| D11 Interactive scope prompt; headless usage error | implemented | p08-t01 SKILL.md and CLI behavior with tests for no-scope exit |
| D12 Seven tasks, three phases, High ceiling, no extra gates | implemented | Plan structure, `state.md` dispatch policy `high`, `oat_plan_parallel_groups: []` |
| Design: provider transport (no-sidecar, bounded readers, Codex capture) | implemented | p06-t02; sidecar at `structured-output.ts:152`, last-message read at `subprocess.ts:293`, Codex capture at `invocation.ts:96` corroborate the gaps the task closes |
| Design: `defaults.reviewers` config, precedence, show/set/clear | implemented | p07-t02; `consensus-config.ts:91` `DEFAULTS_KEYS` and `ConsensusAgentRef` (`:31-35`) already carry provider/model/effort shape |
| Design: bounds (100 files, 2 MiB, 256 KiB, 64 KiB, 1 MiB, 10 min) | implemented | p07-t01 "bounds", p07-t02 "prompt bounds", p07-t03 validation |
| Design: packaging proof first, outside checkout | implemented | p06-t01/p06-t02; see Medium finding on mechanism wording |
| Design: docs cover three selectors, config, limits, both installs, exit codes | implemented | p08-t01; see Minor finding on first-supporting-release note |
| Design: receipt exercise with current `oat-review-receive` | implemented | p08-t02 with named alternate if Fable unavailable |
| Constraint: Node >=22, no shipped runtime deps | implemented | Boundaries |
| Constraint: no live acceptance, install, push, publish, merge | implemented | Boundaries and p08-t02 "live acceptance as unverified" |
| Constraint: version bumps and transitive impact | implemented | Boundaries; p08-t02 `validate:skill-versions -- --base-ref origin/main` |

### Extra Work (not in declared requirements)

None. The plan adds no surfaces beyond the design; the optional p06-t02 / p07-t01 split is explicitly not requested now.

### Plan-specific checklist

- Canonical format: frontmatter, Reviews table (eight-column widened form), Implementation Complete, and References present; `oat project validate-plan` passes.
- Stable IDs: p06-t01 … p08-t02 are monotonic per phase; retired p01–p05 IDs are mapped, not reused. Existing review rows are preserved.
- Task atomicity: every task has bounded Files, executable Verify (`pnpm run test:vitest <paths>` is valid because `scripts/run-vitest.mjs` forwards argv to `vitest run`), file-scoped Format, and a Conventional Commits message.
- Parallelism: sequential claim is consistent with the shared `src/skills/consensus-review/src/run.ts` and generated-output overlap across all three phases.
- Dispatch Profile: section absent, which is normal; not flagged.
- Baseline note: `origin/main` has advanced one commit past the recorded baseline `08f59459` (`e9f14ccc`, session-observer test only, no consensus files). The plan's "recheck main" instruction covers this; no action needed.

## Verification Commands

```bash
oat project validate-plan --project-path .oat/projects/shared/consensus-review
grep -n '^oat_template:' .oat/projects/shared/consensus-review/plan.md
pnpm exec oxfmt --check README.md CHANGELOG.md documentation/docs/user-guide/consensus/configuration.md documentation/docs/user-guide/consensus/index.md documentation/docs/user-guide/installation.md documentation/docs/user-guide/skills/index.md
git diff --check
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to disposition the two Medium and four Minor findings; none blocks the planning gate.
