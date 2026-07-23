---
oat_generated: false
purpose: orchestration-observations
oat_last_updated: 2026-07-23
---

# Orchestration Log: wave-5-execution

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

wave-5-execution at 4e3c4ca. Full baseline green (1170 tests). Drift refresh:
both plans MINOR-DRIFT-expected within their own carve-outs; facade
preconditions verified live (single shared loop output; derived rewrites;
guarded ignore lists; refine byte-identical since authoring).




---

## End-of-run synthesis (2026-07-23)

**Convention verdicts:** the per-cluster green-commit discipline made two ~4k-line
refactors uneventful (16 cluster commits, every one independently gated); the
anchored-insertion rule produced a zero-conflict cross-lane rebase over three
shared config files; the facade contract's leak signal (wrapper-output diff)
never fired — OID-identical trees. The codex `-o` wedge remains the program's
one persistent tool flake (struck twice more this wave; transcription fallback
absorbed it both times, and reviewers independently re-verified).

**Skill-signal rulings:** (1) plan-parser heading form (`## Phase <number>:`)
must be the template's literal example — waves 1-4 shipped unparsed phase
tables (harmless here, latent elsewhere); (2) `.oat/**` formatter no-op should
be reflected in the log template's hygiene line; (3) the codex `-o` wedge
deserves an upstream codex-companion issue rather than more per-wave fallbacks.

**Graduated-entries ledger:** trip-wire comment suggestion (type-only
loop-types↔loop-validation cycle) — non-blocking, recorded in the p01 review;
no new backlog items this wave.

## Archived synthesis contract (fulfilled above)

At project completion, BEFORE any archive step, the orchestrator writes:
(1) verdicts on the conventions this wave exercised, with evidence entries cited;
(2) a ruling on every "Skill signal"-tagged entry — what the `oat-wave-execute`
skill should change; (3) adjustments adopted for later waves, stated as rules;
(4) a graduated-entries ledger (backlog IDs / upstream refs / closed-with-evidence
/ open-with-owner).

Roll-up ordering (critical): `summary.md` `## Workflow Observations` and any
repo-level ledger updates happen BEFORE `oat-project-complete` archives this file.

### 2026-07-23 · general · bug · plan-parser

Wave-5 plan gate found `## Phase p0N:` headings are invisible to the OAT
status parser (`## Phase <number>:` required). Waves 1-4 wrappers shared the
form — their status payloads reported 0 phases throughout (harmless: the
orchestrator tracked progress manually; all lifecycle gates keyed off
frontmatter, not the parsed table).
**Skill signal (gap):** the wrapper-plan template should show the literal
parsed heading form, not `## Phase { NN }:` with a pNN example.
