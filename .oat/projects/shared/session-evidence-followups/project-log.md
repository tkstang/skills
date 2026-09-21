---
oat_generated: false
purpose: project-observations
oat_last_updated: 2026-09-20
---

# Project Log: session-evidence-followups

This append-only log serves two audiences: the project team learning from this project's execution, and maintainers improving the general OAT workflow and tooling.

## Logging contract

Append when something breaks, surprises you, requires a workaround, or works notably well enough to preserve as do-not-regress evidence. Record evidence, not a running narrative. Prior entries are never edited or struck through; append corrections as a new judgment entry that references the original entry and explains the correction. Add a version note to tool-related observations. Create entries only with `oat project log append`; run `oat project log append --help` for the complete entry contract. Reference supporting artifacts by path instead of inlining them. Never record secret values such as tokens, keys, signed URLs, or credentials because this log rolls up into tracked surfaces; reference secrets by name or source, never by value.

Judgment entries default to 1–3 sentences covering what happened, the impact or workaround, and any follow-up. High-value entries may instead use this structured body:

```text
Observation: What happened and the supporting evidence.
Impact: Why it mattered or what workaround was required.
Recommendation: What should change or be preserved.
```

Shared tracked surfaces must be written only from the root checkout, never from parallel worktrees.

## Entry format

Judgment entries:

```text
### 2026-09-20 · <project|general> · <bug|friction|worked-well|feedback> · <area>
```

Structural entries:

```text
### 2026-09-20 · structural · <producer> · <ref>
```

## Entries

Entries are chronological and append-only.

### 2026-09-20 · structural · oat-project-implement · p00

p00 passed independent Consensus review 8c84e955-3f2e-4817-afd8-a7d08531875b; nonblocking docs follow-up accepted, zero blocking fix rounds; see implementation.md.

### 2026-09-20 · structural · oat-project-implement · p01

p01 passed full and bounded independent Opus reviews; one nonblocking fix round plus docs clarification; review c47f8d9e-a43b-48e3-b790-fdf445abf041, evidence in implementation.md.

### 2026-09-20 · structural · oat-project-implement · p02

evidence-p02-outcome-20260920: two Sol task commits verified; phase checks and self-review pass, independent Opus review pending; see implementation.md.

### 2026-09-20 · structural · oat-project-implement · p02-fix1

evidence-p02-fix1-outcome-20260920: six accepted findings fixed by same Sol handle; self-review and checks pass, independent verification pending; see implementation.md.

### 2026-09-20 · structural · oat-project-implement · p02-complete

evidence-p02-complete-20260920: phase complete with independent pass and all follow-ups implemented; two review-fix rounds, no recovery; p03 review includes final Low delta.

### 2026-09-21 · structural · oat-project-implement · p03

evidence-p03-implementation-outcome-20260920: Sol/high completed p03-t01 in190e5a51; full2499-test suite and phase checks passed, recovery0, independent review pending; see implementation.md.

### 2026-09-21 · structural · oat-project-implement · main-integration

evidence-main-integration-20260921: merged main4150cfe2 in14b7bd1e retaining PR100/101 and host polling guidance;75 focused tests, types, build/validate/version gates pass; canonical review runner replaces temporary shim.

### 2026-09-21 · structural · oat-project-implement · p03-outcome

evidence-p03-final-outcome-20260921: p03 Opus pass and all Low follow-ups implemented in fad824d7;135 focused tests and phase gates pass;fixround1,recovery0; p04 review includes narrow follow-up delta.

### 2026-09-21 · structural · oat-project-implement · p04

evidence-p04-implementation-outcome-20260921: Sol/medium completed p04-t01 in c97f65db; frozen fixture acceptance and phase gates pass, recovery0; independent review and final integration pending.

### 2026-09-21 · structural · oat-project-implement · p04

evidence-p04-invalid-20260921: Consensus reply defective, no pass; stable diagnostic evidence/p04-review-diagnostic.json retained. Independent final suite found stale packaging assertion; same-target p04 recovery and valid corrected-scope review remain required.

### 2026-09-21 · structural · oat-project-implement · p04

evidence-p04-recovered-20260921: same-target recovery f3dea62b verified, attempt1/10 preserved and pending marker settled; packaging41/41, freshness/types/lint pass. Corrected-scope review remains pending.

### 2026-09-21 · structural · oat-project-implement · p04

evidence-p04-pass-20260921: valid Opus pass0Critical/High,2Medium/3Low accepted; canonical reviews/archived/p04-opus-review.md. Sequential original-target p03 guard and p04 docs follow-ups precede final integration review.

### 2026-09-21 · structural · oat-project-implement · p03

evidence-p03-fix2-done-20260921: L2 fixed in0ca7ad65 by originalSolhigh; exporter97/97 and gates passed, exporter2.0.32/fork0.2.46 dependency closure. Review-fix2/2, recovery0; final review remains.

### 2026-09-21 · structural · oat-project-implement · p04

evidence-p04-terminal-20260921: all accepted findings fixed8ac3ba9e and0ca7ad65; p04 proof/gates pass, visual evidence/p04-visual/receipt.md. All7tasks/phases complete; final review next.

### 2026-09-21 · structural · oat-project-implement · p05

evidence-p05-pass-20260921: two Sol task commits and independent native review passed with zero findings; exporter49/49, phase97, types, build/validate/version/lint/format pass; recovery0; see reviews/p05-review-2026-09-21T145528Z.md.

### 2026-09-21 · structural · oat-project-implement · pr99-feedback

evidence-pr99-feedback-resolved-20260921: correction head6d7318b pushed; both comments replied to and threads resolved; CodeRabbit and current-head CI passed; PR99 ready and mergeable.

## End-of-run synthesis (pending — do not skip at project completion)

Summarize the overall verdict, adopted adjustments, and entries graduated to the repo ledger or backlog. Roll up durable observations into tracked surfaces before archiving this project log.
