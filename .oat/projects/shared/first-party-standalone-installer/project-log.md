---
oat_generated: false
purpose: project-observations
oat_last_updated: 2026-09-16
---

# Project Log: first-party-standalone-installer

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
### 2026-09-16 · <project|general> · <bug|friction|worked-well|feedback> · <area>
```

Structural entries:

```text
### 2026-09-16 · structural · <producer> · <ref>
```

## Entries

Entries are chronological and append-only.

### 2026-09-16 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:1,medium:3,minor:4 exit=1 status=blocked artifact=.oat/projects/shared/first-party-standalone-installer/reviews/artifact-plan-review-2026-09-16T231057Z.md run=8526c3ae-9e24-42fd-b0c2-bf22639824df

### 2026-09-16 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:1,medium:1,minor:2 exit=1 status=blocked artifact=.oat/projects/shared/first-party-standalone-installer/reviews/artifact-plan-review-2026-09-16T232140Z.md run=0a7568fc-1f95-49dd-90bc-3768c2c5fc2c

### 2026-09-17 · project · feedback · reuse proven installer prior art

A complexity review and live comparison found that tkstang/personal-skills already provides the relevant pinned-source, inventory, destination, and failure-injection patterns. The plan now adapts only the dependency-free public bootstrap delta; do not reintroduce a second staging copy or shipped race harness without a demonstrated requirement.

### 2026-09-17 · structural · oat-project-implement · p01

run-first-party-standalone-installer-p01-20260917-blocked verdict=blocked fix-loops=0 recovery-attempts=1; see implementation.md#run-1--2026-09-16

### 2026-09-17 · structural · oat-project-implement · p01

run-first-party-standalone-installer-p01-20260917-passed verdict=passed fix-loops=0 review=reviews/p01-review-2026-09-17T012147Z.md findings=critical:0,important:0,medium:1,minor:0

### 2026-09-17 · structural · oat gate review · final

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:0,minor:5 exit=0 status=ok artifact=.oat/projects/shared/first-party-standalone-installer/reviews/final-review-2026-09-17T020642Z.md run=3631aaf2-103a-4106-9bda-9eeb577cc87f

### 2026-09-17 · structural · oat gate review · final

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:0,minor:4 exit=0 status=ok artifact=.oat/projects/shared/first-party-standalone-installer/reviews/final-review-2026-09-17T050550Z.md run=f673a067-7275-4ef8-9a0a-55e88e880a5b

## End-of-run synthesis (pending — do not skip at project completion)

Summarize the overall verdict, adopted adjustments, and entries graduated to the repo ledger or backlog. Roll up durable observations into tracked surfaces before archiving this project log.
