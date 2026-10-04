---
name: land-pr
description: 'Use when the user says "land it", "land this PR", or asks to get a GitHub PR green and merge it, including a PR identified by the conversation. Fix CI and valid review findings, push and wait until green, then merge the verified head. Requires babysit-pr. A readiness question or discussion of the skill does not authorize landing.'
license: MIT
compatibility: Requires the installed babysit-pr skill, authenticated GitHub access, git, and repository validation tools. Merge access must support matching the reviewed head SHA.
user-invocable: true
metadata:
  author: Thomas Stang
  version: '1.0.2'
---

# Land PR

Take one explicitly selected PR through repair and review to a verified merge.
An explicit invocation authorizes the shared babysitting actions and merging
that PR once green; do not ask for a second routine merge confirmation.
Respect narrower instructions and unresolved scope or policy decisions.
Creating or discussing this skill is not an invocation against an example PR.

## Prerequisites and inputs

Resolve the target in order: an explicit PR URL/number in the request; the
unambiguous PR currently being discussed (including one just opened or
linked); then a unique current-branch PR when there is no conversational target.
“Land it” is explicit landing and merge authorization when “it” clearly refers
to that PR; no skill name or repeated URL is required. State the resolved
target and proceed without another target/merge confirmation. If multiple
PRs are plausible, ask which one; do not silently use the current branch to
break the ambiguity. Quoted examples or discussion of trigger language are
not live invocations.

Accept an optional merge method, expected bots/checks, and time/iteration budget.

Locate and read the installed {{skill:babysit-pr}} workflow. If unavailable,
stop with the required skill's
[install source](https://github.com/tkstang/skills/tree/main/skills/babysit-pr);
do not install it automatically or substitute a weaker readiness check.
Check authenticated GitHub access and `gh pr merge --help` for
`--match-head-commit` before dependent work. A connector is acceptable only
if it can enforce the same expected-head precondition at the server.
Missing capabilities require [GitHub CLI setup/update](https://cli.github.com/).

## Workflow

1. Run {{skill:babysit-pr}} with the same target and constraints. Retain
   `mode=land` and the merge authorization in the continuation ledger across
   watcher wakeups. Carry forward its finding register, fixes, check/bot
   evidence, and verified head SHA. **Waiting**, **blocked**, or **paused**
   is not permission to merge. If already merged or closed, report that
   state without another mutation.
   The shared free/OSS quota exception applies to landing too: when all other
   gates pass, merge without waiting for exhausted free review allowance to
   reset or requesting another waiver. Retain the exception in the final
   evidence; existing findings and server-required checks/approvals still block.
2. Choose the merge method from the user's instruction or documented
   repository policy. If unspecified, use the repository's sole permitted
   method; when multiple methods remain and there is no established default,
   ask that focused question. Preserve a stack's intended base and follow its
   dependency order; never retarget or merge other layers implicitly.
3. Immediately before merging, repeat the shared green gate against fresh
   remote evidence, including comments, threads, bot completion or supported
   quota exceptions, required
   approvals, checks, head and base. Verify the PR is still open/non-draft
   and mergeable. If the head/base or review state changed, return to the
   shared inspection loop. Never rely on the earlier “green” message alone.
4. Merge using the verified SHA as an atomic precondition, for example:

   ```bash
   gh pr merge "$pr_url" --squash --match-head-commit "$verified_head"
   ```

   Use `--merge` or `--rebase` instead when that is the selected policy.
   Never use `--admin`, weaken branch rules, dismiss required reviews, or
   enable early `--auto`: GitHub's required checks may omit the bot/comment
   gate this workflow promises. Do not delete branches or worktrees unless
   separately requested. A SHA mismatch means reinspect, not retry blindly.

5. For repositories requiring a merge queue, use the supported queue path
   only after the same green gate passes; `gh pr merge` can enqueue without
   a strategy flag. Confirm the actual resulting state. Queue admission is
   **queued**, not **merged**. Continue host-native watching and reinspection
   for changes, ejection, or failed merge-group checks; never bypass the
   queue. Repository rules control server-side queue execution, so a local
   check cannot guarantee against a new comment arriving after admission.
6. Query the remote PR after the merge attempt. Confirm `state=MERGED`,
   `mergedAt`, and the merge commit before claiming success. An accepted
   command, lost response, or auto-merge enrollment alone proves no merge.
   If the response is uncertain, read state before retrying any mutation.
   Stop the owned watcher once complete and reconcile host PR links.

## Output

Report the PR link, final state, verified head, merge method and merge commit
when merged, plus concise CI/review evidence and fixes made. If still queued,
waiting, blocked, or paused, name the remaining condition and whether a
durable watcher is active. A check cannot atomically lock review comments and
CI with the merge; the final sweep, expected-head guard, and server-enforced
repository rules are the available protections.
Name any free/OSS review that could not run because its quota was exhausted;
do not claim all bot reviews passed when merging with that exception.

## Examples

- After opening or discussing PR 42: “Land it.” — Use PR 42 from the
  conversation; repair, verify, and merge under the established method/policy.
- “Land PR 42 once CI and the bots pass; use squash.” — Repair and repeat,
  verify the current head, squash merge, and confirm the remote merge.
- “Land it” with passing CI, no remaining findings, and exhausted free OSS
  review quota — merge with the quota exception and disclose the missing review.
- “Is PR 42 ready to land?” — Read-only readiness assessment; no merge.
- “Babysit PR 42.” — Use the babysitting workflow; no merge authority.
