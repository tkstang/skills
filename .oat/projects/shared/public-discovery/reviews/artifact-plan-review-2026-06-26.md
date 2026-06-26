---
oat_generated: true
oat_generated_at: 2026-06-26
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: manual
oat_project: /Users/tstang/Code/feat-public-discovery/.oat/projects/shared/public-discovery
---

# Artifact Review: plan

**Reviewed:** 2026-06-26
**Scope:** Quick-mode plan artifact readiness for `oat-project-implement`
**Files reviewed:** 13 scoped/supporting artifacts and repo contract files
**Commits:** N/A (artifact review)

## Summary

The plan carries forward the corrected design direction: Category 3 is a handoff prompt with post-upstream hiding deferred, Category 2 covers all five consensus skills, generated runtime changes are routed through canonical TypeScript, and the required canonical plan sections are present. It is close to implementable, but several plan gaps would let implementation close without proving the standalone public-discovery requirements or producing an actually usable pinned installer path.

## Findings

### Critical

None

### Important

- **Category 1 only checks listing, not standalone install/run behavior** (`.oat/projects/shared/public-discovery/plan.md:350`)
  - Issue: Discovery requires `session-observer` and `export-session-transcript` to remain the only individually installable standalone entries and to resolve/run correctly (`discovery.md:148`). The plan's p03-t01 verifies the remote `--list` output and consensus recovery, but it never installs or executes the two standalone skills; following the plan could record success while the standalone installs are listed but broken.
  - Fix: Expand p03-t01 with sandboxed install/run checks for both standalone skills. Use the real CLI path (`npx skills add tkstang/skills@session-observer` and `npx skills add tkstang/skills@export-session-transcript`) in an isolated HOME/install target, then run a safe smoke command such as each installed skill's help or documented no-op/status command and record the command output in `verification/cli-discovery.md`.

- **Generated skill runtime commits are separated from the required skill version bumps** (`.oat/projects/shared/public-discovery/plan.md:120`)
  - Issue: p01-t01 and p01-t02 commit regenerated files under `plugins/consensus/skills/**`, then defer all `SKILL.md` version bumps to p01-t05 (`plan.md:269`). The repo contract says any change under a canonical skill directory, including generated output, requires that skill's version to increase; the plan's "do not push individual mid-phase task commits" note is a workaround rather than an independently committable task boundary.
  - Fix: Adjust p01 task boundaries so the first commit that changes each consensus skill directory also bumps that skill's `version` and `metadata.version`, or collapse the generated output + version bump into a single p01 commit/task. Keep `pnpm run validate:skill-versions -- --base-ref origin/main` as the phase gate.

- **Pinned installer ref is still a placeholder-level decision** (`.oat/projects/shared/public-discovery/plan.md:238`)
  - Issue: The runtime error and README are supposed to point users at a pinned `install.sh`, but the plan only shows `<tag>` and says to document the "current pinned ref" without specifying which immutable ref exists or how it will become valid. Since v0.1.0 already exists without this installer, a README/runtime message can easily ship with a nonexistent future tag or an accidental moving branch.
  - Fix: Make the plan choose the concrete release/ref policy before implementation: either include a release/tag task that verifies the raw GitHub URL actually serves the new `install.sh` and matching `consensus.mjs`, or explicitly mark remote pinned-fetch usability as post-release deferred while keeping checkout-mode recovery as the pre-merge verification. Add a contract check that rejects `<tag>` placeholders in README/runtime-facing text.

### Medium

- **skills.sh verification task lacks reproducible checks** (`.oat/projects/shared/public-discovery/plan.md:393`)
  - Issue: p03-t02 says to determine crawl/submission behavior using "the CLI/docs and a direct check" but does not specify the commands, URLs, or evidence shape to capture. Because this project is explicitly blocked on not making a public-listing claim before live verification, the plan should be more deterministic about what evidence proves the hosted surface state.
  - Fix: Add concrete checks to p03-t02, for example `npx skills find tkstang`, `npx skills find session-observer`, a direct hosted page/search check for `tkstang/skills`, and links to any skills.sh/Vercel docs consulted. Require the backlog update to record command/date/output snippets and the resulting listing strategy.

### Minor

- **Implementation-complete section implies post-implementation readiness before implementation starts** (`.oat/projects/shared/public-discovery/plan.md:458`)
  - Issue: The required `## Implementation Complete` section has accurate task counts, but it ends with "Ready for code review and merge" while the plan frontmatter correctly says `oat_ready_for: oat-project-implement`. That wording can mislead the handoff even though the routing metadata is correct.
  - Suggestion: Replace the sentence with a planning-state phrase such as "Ready for `oat-project-implement`" and leave code-review/merge readiness for implementation closeout.

## Artifact Alignment

**Evidence sources used:**

- `.oat/projects/shared/public-discovery/plan.md`
- `.oat/projects/shared/public-discovery/discovery.md`
- `.oat/projects/shared/public-discovery/design.md`
- `.oat/projects/shared/public-discovery/implementation.md` (scaffold/context only)
- `.oat/projects/shared/public-discovery/reviews/archived/artifact-design-review-2026-06-26.md`
- `.oat/projects/shared/public-discovery/state.md` (workflow metadata/context)
- `.agents/skills/oat-project-review-provide/SKILL.md`
- `.agents/skills/oat-project-plan-writing/SKILL.md`
- `src/consensus/core/consensus-loop.ts`
- `src/consensus/refine/consensus-refine.ts`
- `scripts/bump-version.mjs`
- `scripts/validate-skill-versions.mjs`
- `documentation/docs/engineering/contributing/development/{conventions.md,hooks-and-safety.md}`
- `RELEASING.md`
- `package.json`

### Discovery / Design Coverage

| Source requirement / decision | Status | Notes |
| --- | --- | --- |
| Preserve the split between Category 3 handoff deliverable and deferred post-upstream hiding verification | aligned | p02 authors the upstream prompt and p03 records the deferral without implying this project lands the upstream OAT flag. |
| Cover all five consensus skills (`refine`, `evaluate`, `decide`, `plan`, `create`) | aligned | p01-t02 tests all five wrappers and p01-t05 bumps all five skill versions. |
| Route runtime changes through canonical TypeScript and regenerate `.mjs` outputs | aligned | p01 modifies `src/consensus/**`, runs `pnpm run build`, and uses `pnpm run build:check`; no hand-editing of generated output is requested. |
| Bump changed shipped skill versions and validate with a base ref | partial | p01-t05 includes the right validation, but earlier task commits modify canonical skill dirs before the bump. See Important finding. |
| Make `install.sh` acquisition/pinned-fetch behavior concrete | partial | The tests and README contract are planned, but the immutable ref/release policy is not chosen. See Important finding. |
| README/runtime-error contract and sandboxed HOME tests | aligned | p01-t01, p01-t03, and p01-t04 specify sandboxed HOME behavior and a README/runtime/install contract test. |
| Verify Category 1 standalone entries resolve/run correctly | missing | p03-t01 checks listing but not install/run behavior. See Important finding. |
| Verify skills.sh crawl/submission behavior before public-listing claim | partial | p03-t02 records the outcome, but the evidence checks are too vague. See Medium finding. |

### Canonical Plan Checks

| Check | Status | Notes |
| --- | --- | --- |
| Required frontmatter and quick-mode source metadata | passed | `oat_plan_source: quick`, `oat_status: complete`, and `oat_ready_for: oat-project-implement` are present. |
| Stable task IDs | passed | Task IDs are monotonic within p01-p03. |
| Required sections | passed | `## Reviews`, `## Implementation Complete`, and `## References` are present. |
| Review-table preservation | passed with context | The existing structured auto-review row for `plan` is preserved; this manual review should supersede it through this artifact and later main-session bookkeeping. |
| Dispatch Profile | not applicable | No explicit Dispatch Profile rows are present; omission is normal. |
| Parallelism claim | passed | p01 and p02 have disjoint write sets, and p03 is correctly sequential. |

### Extra Work / Scope Risk

None. The five-skill consensus scope is a defensible alignment update from the optional design artifact and current repo state, not scope creep.

## Verification Commands / Checks

Run these after fixing the plan artifact to confirm the plan now contains the missing implementation checks and no placeholder installer contract:

```bash
rg -n "tkstang/skills@(session-observer|export-session-transcript)|validate:skill-versions|pnpm run build:check|pnpm run validate" .oat/projects/shared/public-discovery/plan.md
rg -n "<tag>|Ready for code review and merge|do not push individual mid-phase" .oat/projects/shared/public-discovery/plan.md
nl -ba .oat/projects/shared/public-discovery/plan.md | sed -n '340,418p'
```

The eventual implementation verification should still include the real gates named in the plan:

```bash
pnpm run build:check
pnpm run validate
pnpm run validate:skill-versions -- --base-ref origin/main
pnpm test
npx skills add tkstang/skills --list
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks, then re-review the plan before `oat-project-implement`.
