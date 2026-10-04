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

Invoke `$land-pr` in Codex or `/land-pr` in Claude Code. Supply the PR and any
bot/check requirements or time budget. The merge method comes from the user
or repository policy; if several methods are allowed and no default is known,
the skill asks for that choice.

The shared loop triages findings, makes focused fixes, validates, commits,
pushes, and waits for fresh checks/reviews. Once green, landing performs a
fresh inspection and uses an expected-head SHA guard for the merge. A moved
head or changed review state returns to inspection.

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

Landing respects repository protection and queue rules. It never bypasses
checks, grants itself admin authority, enables early auto-merge, or cleans up
branches/worktrees without a separate request. The head guard cannot atomically
lock incoming comments or CI state; fresh inspection and server rules provide
the remaining protections. Live discovery, repair, watching, and merging need
separate acceptance evidence beyond the packaged instructions.
