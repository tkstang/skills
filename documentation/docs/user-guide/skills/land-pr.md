---
title: 'Land PR'
description: 'Repair and verify a pull request, then merge its checked head and confirm the remote result.'
---

# Land PR

`land-pr` runs the [Babysit PR](babysit-pr.md) repair and readiness workflow,
then merges the verified PR head. An explicit landing request includes merge
authorization; a status question or babysitting request does not.

## Use

> Land PR 42 once CI and the bots pass; use squash.

Invoke `$land-pr` in Codex or `/land-pr` in Claude Code, or simply say **“land it”**
when a PR is already the subject of conversation. That request authorizes the
repair loop and merge without another routine confirmation. Resolve an explicit
URL/number first, then the conversational PR, then a unique current-branch PR;
ask when multiple targets remain plausible. Discussing these example phrases
does not authorize a merge.

Optionally supply bot/check requirements or a time budget. The merge method comes from the user
or repository policy; if several methods are allowed and no default is known,
the skill asks for that choice.

The shared loop triages findings, makes focused fixes, validates, commits,
pushes, and waits for fresh checks/reviews. Once green, landing performs a
fresh inspection and uses an expected-head SHA guard for the merge. A moved
head or changed review state returns to inspection.

## Review and land

Say **"review and land it"**, **"land it with review"**, or **"use consensus
review, then land it"** to add an independent review before landing. Plain
"land it" does not add this stage. A review-only request never authorizes a
merge, and discussing these phrases is not an invocation.

The skill uses installed [Consensus Review](../consensus/review.md) to inspect
the complete PR diff against its actual base. It follows installed
`subagent-orchestration` guidance for a consequential reviewer on a different
provider from the landing host and, when known, the AI author, at provider-native high effort
(currently Opus high or Sol high, subject to qualified availability). Missing
guidance, a missing eligible provider, or unresolved independence blocks
landing; the skill does not silently substitute same-provider review.
Human or unknown authorship uses host-provider independence without a routine
confirmation, with the authorship limitation disclosed. Known mixed-provider
authorship that leaves no eligible independent reviewer requires a decision.

Every finding receives an evidence-backed disposition. Uncontested in-scope
fixes proceed without another approval. Disagreements and ambiguous product,
security, or scope choices are raised immediately while independent fixes
continue; unresolved dispositions block merging.

One review loop means one provider review followed by dispositions, fixes,
and validation. That is the default, not a repeat-until-clean review cycle.
Very large PRs spanning interacting authored subsystems may use a second
loop with an explanation; generated file count alone does not qualify.
Beyond two completed loops, new direction is required. Failures, invalidated
coverage, unresolved findings, and repository-required review are not waived
by the budget. Routine fixes receive validation; the report distinguishes
the reviewed revision from final changes not independently re-reviewed.
Base advancement alone does not invalidate review: inspect authored changes
and integration, then revalidate. Material new behavior, nontrivial conflict
resolution, or changed dependencies that invalidate reviewed assumptions do.
An ordinary-size PR with invalidated coverage stops for user direction;
invalidation alone does not authorize a second loop. Persist the selected mode,
review-stage status, run/artifact IDs, loop budget, and reviewed revision before
waiting so a watcher wakeup neither skips nor duplicates the review.

The landing report distinguishes requested, passed, observed, and model-claimed
provider/model/effort, verifying native evidence where available, and includes
canonical Markdown and JSON review paths, loop count, and dispositions.
Review's read-only controls and drift checks are not universal isolation;
see its guidance for scope and retention limits. Free/OSS bot quota exceptions
do not replace this explicitly requested review.

Exhausted free-tier or included OSS review allowance follows Babysit PR's
non-blocking quota exception. If all other gates pass, landing merges without
waiting for quota reset or asking for another waiver, and names the review
that did not run. Existing findings, CI failures, and required checks/approvals
still block; repository protection is never bypassed.

For a repository with a merge queue, queue admission is reported as queued.
The skill continues watching until the remote state confirms a merge or a
blocker. It reports the merge commit only after observing `MERGED`; a successful
CLI exit alone is insufficient.

## Installation and limits

Install both generated standalone skills:

- [`skills/babysit-pr`](https://github.com/tkstang/skills/tree/main/skills/babysit-pr)
- [`skills/land-pr`](https://github.com/tkstang/skills/tree/main/skills/land-pr)

See [standalone installation](../installation.md). Landing requires the
installed babysitting workflow and GitHub merge access with a server-enforced
expected-head condition. It does not automatically install its dependency.
Review-and-land additionally requires the installed standalone
[`consensus-review`](https://github.com/tkstang/skills/tree/main/skills/consensus-review)
or its `consensus:review` plugin form, installed
[`subagent-orchestration`](https://github.com/voxmedia/open-agent-toolkit/tree/main/.agents/skills/subagent-orchestration)
guidance, and an authenticated eligible different-provider CLI. These are
conditional prerequisites, not automatic installs or plain-landing requirements.

Landing respects repository protection and queue rules. It never bypasses
checks, grants itself admin authority, enables early auto-merge, or cleans up
branches/worktrees without a separate request. The head guard cannot atomically
lock incoming comments or CI state; fresh inspection and server rules provide
the remaining protections. Live discovery, repair, watching, and merging need
separate acceptance evidence beyond the packaged instructions.
