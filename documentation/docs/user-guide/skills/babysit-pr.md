---
title: 'Babysit PR'
description: 'Repair CI and review findings until a pull request is green, then report readiness without merging.'
---

# Babysit PR

`babysit-pr` takes an existing GitHub PR through repeated inspection, triage,
fixes, validation, commits, and pushes. It stops when CI and expected bot
reviews are green for the current head, with no unresolved findings or
review threads and the repository's approval requirements satisfied.
The PR remains unmerged. Use [Land PR](land-pr.md) to include merging.

## Use

> Babysit PR 42 until CI and Bugbot are green.

Invoke `$babysit-pr` in Codex or `/babysit-pr` in Claude Code. Supply a PR URL,
or simply say **“babysit it”** when a PR is already the subject of conversation.
The target comes from an explicit URL/number first, then the conversational
PR, then a unique current-branch PR. The agent asks only when the target is
ambiguous; discussing these example phrases does not start babysitting.
Optional constraints include named bots/checks, a time budget, or monitor-only
mode. Monitor-only mode permits no fixes, pushes, replies, or thread mutations.

Normal invocation authorizes focused fixes, validation, commits, pushes, and
factual review replies/resolution. Findings receive stable IDs, severity,
and a fix/already-addressed/dismiss/defer disposition. Dismissals require
counter-evidence; unapproved deferrals and contested findings remain blockers.
Human objections and required approvals still count.

## What green means

The skill checks complete CI results, review bodies, inline discussions, and
PR comments. It establishes which bots are expected and how each signals
completion. Every new push needs fresh evidence. Silence, old approval, a
skipped bot, or an outdated thread does not establish success.

An explicit exhausted free-tier or included OSS review allowance is
non-blocking by default. The skill reports **green with quota exception**
when all other gates pass, naming the unavailable review and its last reviewed
revision. It does not wait for quota reset or schedule quota-only retries.
Existing findings, CI failures, required approvals, and explicit requirements
to obtain that review still block; ordinary outages or API throttling do not
qualify. A quota exception is never reported as a completed bot review.

In T3 Code, it processes existing findings and uses the app's PR watcher to
resume on relevant changes. Other hosts can poll within an active session.
It reports whether monitoring is actually active; an ended foreground session
does not imply background coverage.

Output names the PR, checked head, check/bot evidence, remaining threads,
fix commits, and validation. A real blocker or exhausted budget produces an
explicit blocked or paused report instead of a green claim.

## Installation and limits

Install the generated standalone payload at
[`skills/babysit-pr`](https://github.com/tkstang/skills/tree/main/skills/babysit-pr)
using the [standalone installation instructions](../installation.md).
This instruction-only skill requires authenticated GitHub access through
`gh` or an equivalent connector, git, and the repository's validation tools.
It does not require OAT or install a background service.

It never merges, enables auto-merge, weakens checks, dismisses required reviews,
force-pushes, or deletes branches. Unknown bot completion contracts require
clarification. Static packaging and written workflow review do not establish
live provider discovery or end-to-end PR remediation.
