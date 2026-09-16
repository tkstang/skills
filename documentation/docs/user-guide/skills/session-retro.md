---
title: 'Session Retro'
description: 'Review one skill invocation or bounded session episode and report evidence-backed improvements without applying them.'
---

# Session Retro

`session-retro` reviews a completed or bounded episode to identify what would
improve a future run. It is generated as the standalone `session-retro` skill
and as `retro` in the Session plugin. Both forms come from one canonical owner,
share one `metadata.version`, and use the same bundled report template.

The default scope is the skill invocation the user means. A wider session is
reviewed only when requested. The retrospective is read-only: it reports
findings and does not edit skills, rules, memory, repositories, installed
copies, generated packages, or publications.

## Scope and evidence

The review states its selected episode, goal, and evidence cutoff. When a
reliable transcript cutoff is unavailable, it lists the evidence used and the
coverage gap instead of claiming complete-session review.

It starts with active-session evidence: the request, visible outcomes, user
corrections, repository state, diffs, commands, and test results. It may inspect
relevant files and bounded Git state read-only. Reproducing failures or
rerunning tests requires separately scoped authorization.

When recoverable, the review compares observed actions with the instructions
and resources that were actually executed. Current source is comparison
context, not proof of the executed revision. An unknown revision remains an
explicit gap.

## Optional session observation

`session-observer` can enrich a retrospective when its installed contract
supports the exact target. It is optional in both installation forms. Installing
Session's `retro` member does not require the Consensus plugin or any observer
skill.

The retro checks the current installed contract and uses only exact, stateless
evidence. It never substitutes a newest or auto-ranked session, advances read
state, marks content read, starts a watch, or parses raw transcripts. A digest
is a filtered rendered view whose truncation and redaction limit what it proves.
When exact observation is unavailable, the review continues with active context
and repository evidence and names the gap.

## Assessment and report

The first pass reconstructs only the bounded episode and distinguishes observed
facts, user preferences, interpretations, and unknowns. Optional user feedback
comes after that self-assessment. Feedback supplied with the request appears in
a separate feedback-guided section; later feedback revises findings without
erasing the first pass.

Each actionable finding is labeled as:

- `skill defect`;
- `skill noncompliance`;
- `tool/runtime failure`;
- `documentation gap`;
- `changed requirement`; or
- `no change`.

Every finding records evidence, expectation and consequence, a cause
hypothesis, owner, the smallest useful change, and a proportionate validation
case. A valid result can be `no change`, `proposal ready`, or `accepted
follow-up owned elsewhere`.

Reports are inline by default. A saved report requires an authorized
destination. Before writing, the workflow rechecks the path, preserves existing
files unless their update was authorized, summarizes evidence, and redacts
secrets and unrelated personal content.

## Examples

- “Retro the skill we just used and tell me whether its instructions need
  work.” Review that invocation first.
- “Review this session's repeated test failures.” Review only the named failure
  sequence and its repository/test evidence.
- “Here is my feedback on the last run; do a retro.” Preserve the self-assessment
  and add a feedback-guided section.

## Installation and validation

Choose one form:

- standalone
  [`session-retro`](https://github.com/tkstang/skills/tree/main/skills/session-retro);
  or
- Session plugin member `retro`.

Installing both may expose duplicate host entries. Static checks can verify the
complete standalone payload, the Session member, the bundled report template,
and target-specific names. Useful live retrospectives, fresh provider
discovery, and optional observer behavior require separate evidence.

Representative behavior checks include a compliant run, a missed instruction,
a real skill gap, a runtime failure, and a no-change result. Confirm that the
review stays within its evidence cutoff, preserves privacy, and does not apply
its own findings.
