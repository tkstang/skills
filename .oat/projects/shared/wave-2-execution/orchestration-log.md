---
oat_generated: false
purpose: orchestration-observations
oat_last_updated: 2026-07-23
---

# Orchestration Log: wave-2-execution

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
Run pnpm exec oxfmt --write <file> (source-program example: `pnpm format:fix`)
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

wave-2-execution at ea36369 (origin/main 7db7d0f + W1 wave-close commit).
Baseline green (full suite). W2 drift refresh: 2 PASS, 2 non-material
MINOR-DRIFT (W1 anchor shifts; target gaps re-verified present), 0 STOP.
Shared surface p03∩p04: AGENTS.md, different sentences.




---

## End-of-run synthesis (2026-07-23)

**Convention verdicts:**

1. **Wave-1 adopted rules all earned out:** zero pnpm `--` failures (corrected
   DoD form), zero false plan-gate Criticals (context note), one codex `-o`
   flush recovered via the briefed fallback (p02's file appeared; p01's rounds
   flushed; no rollout transcription needed this wave), reviewers wrote or
   returned artifacts without friction.
2. **Ungrouped-sequential lane for shared files: WORKED.** The plan gate
   correctly forced p04 out of the parallel group (AGENTS.md overlap with p03);
   p04 executed on the post-group tip and its base already contained p03's
   sentence — zero conflict by construction.
3. **Cross-model review loop needs a CAP RULE:** p01 entered a third Codex pass
   before the orchestrator capped it (disposition ≠ re-approval; the phase
   reviewer owns fix verification). Adopted for later waves: implementer briefs
   state MAX TWO codex rounds; further verification belongs to the phase
   reviewer.
4. **Stale plan premises surfaced twice** (p04: guard test already existed
   pre-plan; p03: a consumer test greping source text the plan's step-1 didn't
   catch) — both handled as evidence-backed bounded deviations and verified by
   reviewers. Signal for the repo-improve plan-authoring process: inventory
   existing tests for the target property before mandating new test files.

**Ruling on Skill-signal entries:** none new this wave beyond the above; wave-1's
upstream recommendations stand.

**Adjustments adopted for later waves (rules):**

1. Implementer briefs: max two codex rounds; then disposition and report.
2. Plan-gate prompts: keep the sanctioned-addenda context note (validated).
3. Recon briefs: check for pre-existing tests covering a plan-mandated property.

**Graduated-entries ledger:**

- Follow-up (logged, optional): directory-mtime short-circuit for watch
  discovery (p02 review note; carried into BL-260718-cache-transcript archive
  summary).
- Follow-up (logged, optional): structural enforcement for pickImportRewriteTarget
  proximity assumption (p04 review F1) — informational only.
- Observation for future plans: runProviderCliCommand twins remain un-unified;
  timeoutMs is inert until a caller wires it (p01 report) — candidates for the
  W3 consolidation lane's awareness, not new work items.
- Closed-with-evidence: codex loop cap (this wave's p01), stale-premise
  handling ×2.

## Archived synthesis contract (fulfilled above)

At project completion, BEFORE any archive step, the orchestrator writes:
(1) verdicts on the conventions this wave exercised, with evidence entries cited;
(2) a ruling on every "Skill signal"-tagged entry — what the `oat-wave-execute`
skill should change; (3) adjustments adopted for later waves, stated as rules;
(4) a graduated-entries ledger (backlog IDs / upstream refs / closed-with-evidence
/ open-with-owner).

Roll-up ordering (critical): `summary.md` `## Workflow Observations` and any
repo-level ledger updates happen BEFORE `oat-project-complete` archives this file.

### 2026-07-23 · structural · oat-wave-execute · group-1 reviews

p01 PASS (Opus review; 2 Codex rounds verified, 1 rejection upheld, 3 scope
expansions judged within-outcome, double-settle probe clean). p02 PASS (Codex
Important meta-read fix + LRU cap verified; torn-read race judged self-healing
and pre-existing). p03 PASS (clean). p02 Minor dispositioned by orchestrator:
the plan-mandated follow-up note for the deferred directory-mtime short-circuit
is recorded HERE and will be carried into BL-260718-cache-transcript's archive
summary at closeout — candidate future optimization: skip discovery entirely
for watch targets whose directory mtime is unchanged since the last tick.
