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
Run `pnpm exec oxfmt --write` on this file after writing. Tag entries that bear
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
