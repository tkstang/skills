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

## End-of-run synthesis (pending — do not skip at project completion)

Summarize the overall verdict, adopted adjustments, and entries graduated to the repo ledger or backlog. Roll up durable observations into tracked surfaces before archiving this project log.
