---
oat_generated: false
purpose: project-observations
oat_last_updated: 2026-09-13
---

# Project Log: skill-source-organization

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
### 2026-09-13 · <project|general> · <bug|friction|worked-well|feedback> · <area>
```

Structural entries:

```text
### 2026-09-13 · structural · <producer> · <ref>
```

## Entries

Entries are chronological and append-only.

### 2026-09-13 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:3,minor:3 exit=0 status=ok artifact=.oat/projects/shared/skill-source-organization/reviews/artifact-plan-review-2026-09-13T151722Z.md run=ad0f809d-26ad-4210-9d55-2f0340097ea0

### 2026-09-13 · structural · oat-reviewer · p01-review-cycle-3

7c4c38ea-f650-4f95-8fec-252278d09f90 artifact=.oat/projects/shared/skill-source-organization/reviews/p01-review-2026-09-13T172248Z.md reconnaissance=attempted waves=2 result=critical:0,important:1,medium:0,minor:0

### 2026-09-13 · structural · oat-project-implement · p01

26360de4-05a7-4c8a-ae15-cfffe34fe1f8 status=blocked review_cycle=3 fix_iterations=2 remaining=important:1 artifact=.oat/projects/shared/skill-source-organization/reviews/p01-review-2026-09-13T172248Z.md

## End-of-run synthesis (pending — do not skip at project completion)

Summarize the overall verdict, adopted adjustments, and entries graduated to the repo ledger or backlog. Roll up durable observations into tracked surfaces before archiving this project log.
