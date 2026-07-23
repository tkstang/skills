---
oat_generated: false
purpose: orchestration-observations
oat_last_updated: 2026-07-23
---

# Orchestration Log: wave-1-execution

Running log of orchestration and subagent observations for this project. Two
audiences: (1) evaluating this wave's execution specifically, and (2) collecting
general feedback on OAT orchestration/tooling and on the `oat-wave-execute` skill
itself — bugs, friction, and things that worked well.

**Logging contract (for the orchestrator and any lifecycle skill touching this
project):** append an entry whenever something breaks, surprises, requires a
workaround, or works notably well. Structural entries (dispatch stamps, gate
results, STOP/park events, bootstrap statuses, disposition maps) are appended as
one-liners referencing artifacts by path; judgment entries are agent-authored.
Never delete entries; strike through with a correction note if one turns out
wrong. Version-stamp tool-related observations. Keep entries short and factual.
Run `pnpm exec oxfmt --write .oat/projects/shared/wave-1-execution/orchestration-log.md`
after writing (repo ignore rules may skip it; that is fine). Tag entries that bear
on the wave-skill's design with a **Skill signal (strengthens/contradicts/gap):**
line — those drive the upstream implementation.

**Entry format:**

    ### YYYY-MM-DD · [project | general] · [bug | friction | worked-well | feedback] · <area>
    What happened (1-3 sentences). Impact/workaround. Follow-up (backlog / upstream / none).

**Structural entry format (skill-appended):**

    ### YYYY-MM-DD · structural · <skill> · <scope>
    One-line mirror of the skill's structured output. Reference artifacts by path.

---

## Entries

### 2026-07-23 · project · feedback · preflight

Branch base deviation: skill rule says branch `wave-N-execution` from up-to-date
main, but the execution-program artifact (36e37fb) existed only on
`repo-improve-2` (= origin/main + 1 tracking commit). Branched from that tip
instead so the program artifact rides into main with the wave PR. No conflict
risk (tracking-only commit).
**Skill signal (gap):** preflight should say where to branch from when the
program artifact itself is not yet on main (fresh-program first wave).

### 2026-07-23 · structural · oat-wave-execute · drift-refresh

Wave-boundary recon: 4/4 PASS, 0 shared write surfaces, 1 drift-check coverage
gap (p01 pathspec omits its generated output + SKILL.md targets → wrapper rule-1
addendum), 1 non-narrowing reconciliation (consensus-loop.mjs is one shared
plugin-level output, not per-skill copies). Recorded in plan.md Drift Refresh
Record.

### 2026-07-23 · structural · oat-wave-execute · preflight

Baseline at 36e37fb: type-check clean, build:check in sync, 1090/1091 tests
green (1 intentional live-E2E skip). Node v25.9.0, pnpm 10.13.1, oat CLI
resolves globally.

### 2026-07-23 · structural · oat-wave-execute · plan-gate

Codex plan gate: FIXES_NEEDED (1 Critical, 7 Important, 1 Minor). 6 fixed, 3
rejected with reasons (rule-1 addendum is skill-mandated non-narrowing; operator
directive record; scaffold-owned comments). Artifact:
reviews/plan-gate-2026-07-23.md. Terminal: passed.

### 2026-07-23 · structural · oat-wave-execute · group-1 dispatch

4 worktrees bootstrapped clean at ef3949b (view-parity ok ×4). Lanes: p01
sonnet, p02 opus (security), p03 sonnet, p04 sonnet. All four completed;
reviews: p01 PASS, p02 PASS, p03 pending, p04 PASS.

### 2026-07-23 · project · friction · codex-cli

Two lanes' `codex exec -o <file>` runs failed to flush the output file (p01:
process died silently in subagent context; p02: wedged on a nested wait call —
implementer transcribed the verdict from the session rollout). p03's run
flushed normally. Workarounds: orchestrator re-ran p01's review itself;
p02 transcription verified by phase reviewer.
**Skill signal (strengthens):** rule-8 diagnostics (timeout+zero-bytes vs
late-completion) applies to `codex exec -o` runs launched by IMPLEMENTER
subagents too — briefs should tell implementers to fall back to reading the
codex session rollout rather than waiting indefinitely.

### 2026-07-23 · project · friction · pnpm-arg-forwarding

`pnpm run validate:skill-versions -- --base-ref main` (the DoD's literal form)
fails on pnpm 10.13.1 — the bare `--` is forwarded into the script and rejected.
Same class hits `pnpm test -- <path>` (runs full suite instead of the scoped
path). Correct forms: drop the `--` (`pnpm run validate:skill-versions
--base-ref main`) or call the script/vitest directly. Three of four lanes hit
this independently. Follow-up: fix the wrapper-plan DoD line for later waves.
**Skill signal (gap):** the wrapper-plan template's DoD example should not
model the `-- --flag` form for pnpm repos.

### 2026-07-23 · project · feedback · environment

This repo checkout is itself a LINKED WORKTREE (of ~/Code/skills): `.git` is a
pointer file, so `.git/info/exclude` must be resolved via
`git rev-parse --git-path info/exclude`. Also: `.worktrees/` was untracked and
dirty-listing; excluded via the resolved git-path exclude (local-only, no repo
change).

### 2026-07-23 · project · worked-well · cross-model-reviews

Embedded Codex reviews earned their cost this wave: p01 Medium (rename-failure
test didn't exercise rename) — valid, fixed; p03 2 Criticals (reclaim
double-acquisition race; age-fallback live-owner theft) — both real design
flaws caught pre-merge, fixed with regression tests. p02's 128-case
weaker-anywhere matrix provided strong monotonicity evidence.

---

## End-of-run synthesis (pending — do not skip at project completion)

At project completion, BEFORE any archive step, the orchestrator writes:
(1) verdicts on the conventions this wave exercised, with evidence entries cited;
(2) a ruling on every "Skill signal"-tagged entry — what the `oat-wave-execute`
skill should change; (3) adjustments adopted for later waves, stated as rules;
(4) a graduated-entries ledger (backlog IDs / upstream refs / closed-with-evidence
/ open-with-owner).

Roll-up ordering (critical): `summary.md` `## Workflow Observations` and any
repo-level ledger updates happen BEFORE `oat-project-complete` archives this file.
