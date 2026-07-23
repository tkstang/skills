---
oat_generated: false
purpose: orchestration-observations
oat_last_updated: 2026-07-23
---

# Orchestration Log: wave-3-execution

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
Run pnpm exec oxfmt --write <file>
on this file after writing. Tag entries that bear on the
wave-skill's design with a **Skill signal (strengthens/contradicts/gap):** line —
those drive the upstream implementation.

**Entry format:**

    ### YYYY-MM-DD · [project | general] · [bug | friction | worked-well | feedback] · <area>
    What happened (1-3 sentences). Impact/workaround. Follow-up (backlog / upstream / none).

**Structural entry format (skill-appended):**

    ### YYYY-MM-DD · structural · <skill> · <scope>
    One-line mirror of the skill's structured output. Reference artifacts by path.

---

## Entries

### 2026-07-23 · structural · oat-wave-execute · preflight

wave-3-execution at 17e24ee (origin/main post-W2 + W2 wave-close). Baseline
green (1137 tests). Drift refresh: p01 MINOR-DRIFT (premise confirmed live;
atomicWriteFile name-collision hazard; import-rewrite simplification),
p02 PASS. Zero shared surfaces.




---

## End-of-run synthesis (2026-07-23)

**Convention verdicts:** two-lane wave ran clean under all adopted rules (zero
codex-loop overruns — the MAX TWO cap was hit exactly by p01 and held; the
equivalent-invocation note prevented pnpm `--` recurrence). The
escalate-to-reviewer path proved out: p01's panel question was an interlocking
design decision, the implementer correctly did NOT resolve it unilaterally, and
the Opus reviewer issued a reasoned ruling (exclusion accepted, follow-up
named). Plan-gate finding 1 (scaffold-readiness ordering) adopted: W4/W5
scaffold with in_progress and flip atomically at gate pass.

**Skill-signal rulings:** the wrapper's equivalent-invocation note should
graduate upstream into the wave-execute skill's brief template (pnpm-repo
clause). No other new signals.

**Graduated-entries ledger:** follow-up backlog item filed at closeout:
loop-free `cli-helpers-core.ts` split so panel can share the pure helpers
(reviewer-named shape). p02 review's two informational notes (Array#sort
in a .ts test; validate.sh intermediate checkpoint untested) recorded here,
no action required.

## Archived synthesis contract (fulfilled above)

At project completion, BEFORE any archive step, the orchestrator writes:
(1) verdicts on the conventions this wave exercised, with evidence entries cited;
(2) a ruling on every "Skill signal"-tagged entry — what the `oat-wave-execute`
skill should change; (3) adjustments adopted for later waves, stated as rules;
(4) a graduated-entries ledger (backlog IDs / upstream refs / closed-with-evidence
/ open-with-owner).

Roll-up ordering (critical): `summary.md` `## Workflow Observations` and any
repo-level ledger updates happen BEFORE `oat-project-complete` archives this file.
