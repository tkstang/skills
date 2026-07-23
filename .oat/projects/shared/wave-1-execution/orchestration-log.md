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

## End-of-run synthesis (2026-07-23)

**Convention verdicts (evidence cited):**

1. **Write-disjoint group composition at ceiling 4: WORKED.** Zero merge
   conflicts across four rebase+merge cycles (fan-in a367b1d/6f1f083/1e06803/0d81b84);
   the drift-refresh recon's mechanical write-surface intersection was accurate.
2. **Embedded cross-model reviews: HIGH VALUE.** 3 real defects caught pre-merge
   (p01 Medium test gap; p03 2 Criticals in lock reclaim), plus p02's 128-case
   monotonicity matrix as strong security evidence. See "worked-well ·
   cross-model-reviews" entry.
3. **Adversarial phase reviewers with own probes: DECISIVE.** The p03 reviewer's
   independent interleaving analysis found a TOCTOU that BOTH the implementer
   and Codex missed (`reviews/p03-code-review-2026-07-23.md`) — direct
   replication of the DR-260715-adversarial-probe-reviewer evidence class.
4. **Append-only fix rounds + disposition verification: WORKED.** p03's fix
   round was verified by resuming the same reviewer handle; revert-verification
   proved the new regression test discriminates the fix.
5. **Plan gate at bounded scope: WORKED with one calibration note** — the gate
   flagged the skill-mandated rule-1 addendum as a Critical (it lacked
   wave-execute contract context); rejected with reasons. Gate prompts should
   state that wrapper drift-addenda are skill-sanctioned extensions.

**Rulings on Skill-signal entries:**

- *preflight branch base (gap):* ADOPT — when the program artifact is not yet on
  main, branch the wave from the program commit and let it ride in the wave PR.
  Recommend upstreaming into the skill's Step 1.
- *codex `-o` flush (strengthens rule 8):* ADOPT for later waves — implementer
  briefs now include a fallback: if the `-o` file has not appeared but the codex
  session completed, transcribe the verdict from the session rollout; if the
  process died silently, report to the orchestrator instead of waiting.
- *pnpm `--` forwarding (gap):* ADOPT — later waves' wrapper plans write the DoD
  as `pnpm run premerge && pnpm run validate:skill-versions --base-ref main`
  (no bare `--`). Recommend fixing the skill's wrapper-plan template example.

**Adjustments adopted for later waves (as rules):**

1. DoD line uses no bare `--` with pnpm run.
2. Implementer briefs carry the codex-fallback paragraph (rollout transcription).
3. Plan-gate prompts note that rule-1 drift-addenda and non-narrowing
   reconciliations are skill-sanctioned (prevents false Criticals).
4. Reviewer briefs explicitly grant artifact-writing via bash heredoc (one
   Explore reviewer refused for lack of a Write tool; orchestrator persisted).
5. This repo checkout is a linked worktree: always resolve git paths via
   `git rev-parse --git-path`.

**Graduated-entries ledger:**

- Follow-up candidate → backlog (filed at closeout): atomic conversion of the
  two deferred write sites (`writeSectionOutput`, `seedRecordsFile`) in
  consensus-loop.ts — spotted by p01, out of its plan scope.
- Upstream skill recommendations (owner: operator, next skill revision):
  Step-1 branch-base note; wrapper-template DoD pnpm form; gate-prompt
  addendum-context note.
- Closed-with-evidence: codex `-o` wedge workarounds (both lanes recovered);
  worktree `.git`-pointer discovery (exclude via resolved path).
- Open-with-owner: none.

Roll-up: `summary.md` `## Workflow Observations` written from this synthesis
BEFORE any archive step.
