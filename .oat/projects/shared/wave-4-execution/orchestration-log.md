---
oat_generated: false
purpose: orchestration-observations
oat_last_updated: 2026-07-23
---

# Orchestration Log: wave-4-execution

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

wave-4-execution at f701e96 (origin/main post-W3 + W3 wave-close). Quick
baseline green (type-check + build:check); full-suite certification via main's
Validate run on the identical merged tree (exit 0). Drift refresh 3/3 PASS.

### 2026-07-23 · project · friction · ci-watch

W3 PR #52 was merged while `gh pr checks --watch` reported "no checks
reported" (watch raced check registration; merge proceeded on an empty
result). Closed by watching main's Validate run on the identical tree (green).
Rule adopted: after PR creation, poll `gh pr checks` until checks REGISTER
(non-empty), then watch; never merge on an empty checks report.
**Skill signal (gap):** the closeout PR step should require non-empty
registered checks before merge.




---

## End-of-run synthesis (2026-07-23)

**Convention verdicts:** the ungrouped-first lane pattern (style-input
dependency) worked exactly as composed — p02/p03 authored their new workflows
against p01's landed pin style with zero rework. Poll-until-registered CI rule
(W3 lesson) to be exercised at this wave's PR. Gate finding on scaffold
readiness produced the pre-gate scaffold flow; it caught a real leftover
(oat_phase: discovery) on its first use — keep it.

**Notable event:** p03's single accidental live provider call surfaced a real
stub-vs-live contract mismatch (verdict_source 'final_message' vs 'submit') —
precisely the drift class the live-gate plan exists to expose. Graduated to a
follow-up backlog item at closeout; the committed changes do not mask it.

**Graduated-entries ledger:** live-contract mismatch follow-up (filed);
optional docs-ci self-trigger hardening (recorded in p02 review, operator
optional); W3 CI-watch rule exercised at this wave's PR step.

## Archived synthesis contract (fulfilled above)

At project completion, BEFORE any archive step, the orchestrator writes:
(1) verdicts on the conventions this wave exercised, with evidence entries cited;
(2) a ruling on every "Skill signal"-tagged entry — what the `oat-wave-execute`
skill should change; (3) adjustments adopted for later waves, stated as rules;
(4) a graduated-entries ledger (backlog IDs / upstream refs / closed-with-evidence
/ open-with-owner).

Roll-up ordering (critical): `summary.md` `## Workflow Observations` and any
repo-level ledger updates happen BEFORE `oat-project-complete` archives this file.
