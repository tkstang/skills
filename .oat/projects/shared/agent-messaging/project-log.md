---
oat_generated: false
purpose: project-observations
oat_last_updated: 2026-09-19
---

# Project Log: agent-messaging

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
### 2026-09-19 · <project|general> · <bug|friction|worked-well|feedback> · <area>
```

Structural entries:

```text
### 2026-09-19 · structural · <producer> · <ref>
```

## Entries

Entries are chronological and append-only.

### 2026-09-19 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:3,minor:4 exit=0 status=ok artifact=.oat/projects/shared/agent-messaging/reviews/artifact-plan-review-2026-09-19T014304Z.md run=f1bc5e2e-4077-4485-925e-6fc98bc9df59

### 2026-09-19 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:2,minor:2 exit=0 status=ok artifact=.oat/projects/shared/agent-messaging/reviews/artifact-plan-review-2026-09-19T021241Z.md run=a5a5f137-5011-4d64-81af-c4db88d3f3e7

### 2026-09-19 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:1,medium:1,minor:2 exit=1 status=blocked artifact=.oat/projects/shared/agent-messaging/reviews/artifact-plan-review-2026-09-19T030934Z.md run=09f3c2b9-f6ec-4cda-91f4-966ba80a9f20

### 2026-09-19 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:1,medium:1,minor:3 exit=1 status=blocked artifact=.oat/projects/shared/agent-messaging/reviews/artifact-plan-review-2026-09-19T125014Z.md run=c94b55d0-0138-409d-aca6-ed4703fa8c99

### 2026-09-19 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:2,minor:2 exit=0 status=ok artifact=.oat/projects/shared/agent-messaging/reviews/artifact-plan-review-2026-09-19T131345Z.md run=94c9a069-05df-4541-84ef-5b56f699c674

### 2026-09-19 · structural · oat-project-implement · p01

p01 blocked after final review: verdict=blocking findings=0-critical/3-important/0-medium/0-minor review-cycles=3/3 fix-rounds=2/2 artifact=reviews/code-p01-final-review-2026-09-19T152245Z.md id=p01-final-review-057cc67a

### 2026-09-19 · structural · oat-project-implement · p01-override

p01 resumed by explicit user authorization for one additional bounded correction and fresh review; scope=3-important-findings artifact=reviews/code-p01-final-review-2026-09-19T152245Z.md retry-limit=3 id=p01-extra-fix-authorized-20260919

### 2026-09-19 · structural · oat-project-implement · p01

p01 accepted after user-authorized review: verdict=pass findings=0-critical/0-important/1-medium/0-minor review-cycles=4 fix-rounds=3 recovery-attempts=3 artifact=reviews/code-p01-authorized-review-2026-09-19T161151Z.md supersedes-blocked-outcome=p01-final-review-057cc67a id=p01-pass-d3cd0e9c

### 2026-09-19 · structural · oat-project-implement · p02-review-round-1

p02 review round 1 used two reconnaissance waves and returned 0-critical/7-important/1-medium/0-minor; artifact=reviews/code-p02-review-2026-09-19T172855Z.md id=p02-review-r1-a54d9baf

### 2026-09-19 · structural · oat-project-implement · p02-review-round-2

p02 review round 2 used bounded reconnaissance and passed with 0-critical/0-important/2-medium/0-minor; artifact=reviews/code-p02-rereview-2026-09-19T181232Z.md id=p02-review-r2-14f26df4

### 2026-09-19 · structural · oat-project-implement · p02

p02 accepted: verdict=pass findings=0-critical/0-important/2-medium/0-minor review-cycles=2 fix-rounds=1 recovery-attempts=0 artifacts=reviews/code-p02-review-2026-09-19T172855Z.md,reviews/code-p02-rereview-2026-09-19T181232Z.md id=p02-pass-14f26df4

### 2026-09-19 · structural · oat-project-implement · p03-review-round-1

p03 review round 1 used two bounded reconnaissance lanes and returned 0-critical/2-important/2-medium/0-minor; artifact=reviews/code-p03-review-2026-09-19T190153Z.md id=p03-review-r1-d6bd6d6a

### 2026-09-19 · structural · oat-project-implement · p03-review-round-2

p03 review round 2 used one completed runtime lane plus inline deterministic coverage and returned 0-critical/1-important/0-medium/0-minor; artifact=reviews/code-p03-rereview-2026-09-19T192712Z.md id=p03-review-r2-8e461d89

### 2026-09-19 · structural · oat-project-implement · p03

p03 accepted: verdict=pass findings=0-critical/0-important/0-medium/0-minor review-cycles=3 fix-rounds=2 recovery-attempts=0 artifacts=reviews/code-p03-review-2026-09-19T190153Z.md,reviews/code-p03-rereview-2026-09-19T192712Z.md,reviews/code-p03-final-review-2026-09-19T194903Z.md id=p03-pass-d1b3fe16

## End-of-run synthesis (pending — do not skip at project completion)

Summarize the overall verdict, adopted adjustments, and entries graduated to the repo ledger or backlog. Roll up durable observations into tracked surfaces before archiving this project log.
