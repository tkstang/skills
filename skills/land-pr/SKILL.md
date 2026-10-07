---
name: land-pr
description: 'Use when the user says "land it", "land this PR", "review and land it", "land it with review", "use consensus review, then land it", or asks to get a GitHub PR green and merge it, including a PR identified by conversation. Review-and-land adds cross-provider Consensus Review, dispositions, and focused fixes before landing. Plain landing retains the shared repair loop. Requires babysit-pr. Readiness questions or discussion do not authorize landing.'
license: MIT
compatibility: Requires babysit-pr, authenticated GitHub access, git, repository validation tools, and expected-head merge support. Review-and-land additionally requires Consensus Review, subagent-orchestration guidance, and an eligible different-provider CLI.
user-invocable: true
metadata:
  author: Thomas Stang
  version: '1.1.0'
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
Select `review-and-land` when the user asks to review before landing, including
"review and land it", "land it with review", or "use consensus review, then
land it". Plain "land it" keeps the existing landing flow without adding this
review. Honor explicit narrower instructions; a review-only request grants no
merge authority. Retain the selected mode across continuation and watcher wakeups.

Locate and read the installed babysit-pr workflow. If unavailable,
stop with the required skill's
[install source](https://github.com/tkstang/skills/tree/main/skills/babysit-pr);
do not install it automatically or substitute a weaker readiness check.
Check authenticated GitHub access and `gh pr merge --help` for
`--match-head-commit` before dependent work. A connector is acceptable only
if it can enforce the same expected-head precondition at the server.
Missing capabilities require [GitHub CLI setup/update](https://cli.github.com/).

## Independent review (review-and-land only)

After establishing the PR head, base, checkout, and authority using babysit-pr,
perform this stage before the landing readiness gate. Do not merge while it is
pending. Consensus Review is not a prerequisite for plain landing; in this
mode: locate and read the installed `consensus-review` or `review` or `consensus:review` skill.
If unavailable, report its
[install source](https://github.com/tkstang/skills/tree/main/skills/consensus-review)
and stop dependent landing; never auto-install it or silently skip review.

1. Read the installed `subagent-orchestration` guidance and the reference for
   the reviewer's provider before dispatch. If missing, report the prerequisite
   ([source](https://github.com/voxmedia/open-agent-toolkit/tree/main/.agents/skills/subagent-orchestration))
   and stop dependent landing; do not invent a weaker routing policy.
   Route this final review as `consequential`, using a qualified high-capability
   model at provider-native high effort (currently Opus high for Claude or Sol
   high for Codex, subject to that guidance and verified availability). Use a
   **different provider from the landing host** and, when known, the AI author;
   different model names on the same provider do not establish independence.
   Record author/host providers, reviewer provider/model/effort, and returned
   identity evidence. Human or unknown authorship does not require a routine
   confirmation: use host-provider independence and label author evidence
   unknown, without claiming verified author diversity. Mixed AI authorship or
   a known author on the only eligible reviewer provider needs a focused
   independence decision; continue independent preparation meanwhile. Never
   silently downgrade or enable same-provider review. Distinguish requested,
   passed, observed, and model-claimed identities; verify native provider
   evidence when the artifact lacks it. Report unobserved effort as such, not
   as a passing observed claim. Contradictory identity or inability to establish
   the eligible reviewer route blocks landing.
2. Review the selected PR's complete branch diff against its actual fetched
   base, not an assumed `main`. Resolve the executable from the loaded skill
   directory and pass the actual host, explicit reviewer and effort. Supply a
   bounded request naming the target revision, requirements, risks, expected
   findings with file/line evidence, read-only authority, and escalation
   conditions. Keep unrelated dirty work outside the review checkout. Freeze
   the reviewed files, HEAD, and index until it completes; parallel work must
   use a separate scope/checkout. Parse the returned status and artifacts;
   timeout, malformed output, detected drift, unresolved reviewer routing,
   or an empty-scope no-op is not a completed PR review. Record the actual
   canonical Markdown/JSON paths and review coverage/limitations.
3. Disposition **every** finding against source and verification using the
   shared finding register: fix, already addressed, dismiss with evidence, or
   defer with a concrete reason. Apply uncontested, unambiguous in-scope fixes
   without another approval; validate, commit, and push them normally. If you
   disagree with the reviewer or need a product/security/scope decision, raise
   that finding immediately with evidence and a recommendation. Continue
   independent uncontested fixes while awaiting the answer; leave the disputed
   item open and block merging until disposition is resolved. Reviewer output
   is evidence, not permission to expand scope or perform production actions.
4. Use **one review loop by default**: one provider review, dispositions,
   focused fixes, and validation. Do not automatically request another review
   for each fix/push. A **very large PR** may use a second loop: explain the
   authored breadth or interacting subsystems that warrant it before dispatch;
   generated file count alone does not qualify. Two completed loops is the
   maximum without new user direction. A failed invocation is not a completed
   loop; follow the shared bounded retry/blocker policy, never retry indefinitely.
   Loop limits do not waive defects, disagreements, CI, repository-mandated
   review, or invalidated coverage. Base advancement or a required update from
   base is not by itself invalidation: inspect the resulting authored diff and
   integration, record coverage, and revalidate. Material new authored behavior,
   nontrivial conflict resolution, or changed dependencies that invalidate
   reviewed assumptions make coverage insufficient. A very large PR with a
   remaining second loop may use it; otherwise stop for user direction.
   Invalidation alone does not grant another loop on an ordinary-size PR.
   Never claim stale coverage or exceed the budget.
5. Hand the dispositions, reviewed head/base, fix commits, validation, routing,
   artifact paths, loop count/budget, and open questions to the landing ledger.
   Distinguish the reviewed revision from the final fixed head; routine
   review-driven fixes need validation, not an automatic clean-verdict loop.
   Explicitly report which final changes were not independently re-reviewed.
   The free/OSS bot quota exception never substitutes for this requested review.

## Workflow

1. Run babysit-pr with the same target and constraints. Retain
   the selected `mode=land` or `mode=review-and-land` and merge authorization
   in the continuation ledger across watcher wakeups. Before any waiting turn
   ends, persist review-stage status (not started, pending, or complete), run
   ID/artifact paths when available, loop count/budget, and reviewed revision
   when known. Resume the existing stage, never skip it or dispatch a duplicate
   review because of a wakeup. Carry forward its finding register, fixes, check/bot
   evidence, and verified head SHA. **Waiting**, **blocked**, or **paused**
   is not permission to merge. If already merged or closed, report that
   state without another mutation.
   For `review-and-land`, complete the independent review stage above and
   carry its findings into this same repair/readiness loop; do not create a
   competing watcher or a second unlimited review loop.
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
   shared inspection loop and reconcile independent review coverage/budget
   when applicable. Never rely on the earlier “green” message alone.
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
For review-and-land, include the reviewer provider/model/effort and verified
identity, canonical review artifact paths, loop count, finding dispositions,
and reviewed revision versus final-head coverage. Never call fixed but
unreviewed changes an independent clean verdict.

## Examples

- After opening or discussing PR 42: “Land it.” — Use PR 42 from the
  conversation; repair, verify, and merge under the established method/policy.
- “Review and land it” or “land it with review.” — Review the conversational
  PR through Consensus Review on a different provider, disposition and fix,
  then validate and land. One review loop normally suffices.
- “Review PR 42.” — Review only; no repair/push/merge authority is implied.
- “Land PR 42 once CI and the bots pass; use squash.” — Repair and repeat,
  verify the current head, squash merge, and confirm the remote merge.
- “Land it” with passing CI, no remaining findings, and exhausted free OSS
  review quota — merge with the quota exception and disclose the missing review.
- “Is PR 42 ready to land?” — Read-only readiness assessment; no merge.
- “Babysit PR 42.” — Use the babysitting workflow; no merge authority.
