---
title: 'Delegate'
description: 'Use delegate to hand one task to another provider: code changes run in a dedicated git worktree, and the host verifies the diff before you decide.'
---

# Delegate

`delegate` hands one task to another provider-backed AI peer, such as "have
Codex fix the flaky retry test" or "have Claude look into why the build is
slow". The peer does the work in one provider turn. The host agent then checks
it: it computes the changes from its own git baseline, reads the full diff,
and reruns the verification command itself. Nothing is merged or pushed. You
decide what to keep.

It ships standalone as `delegate` and in the Consensus plugin as `delegate`.
Install the standalone form with `npx skills add tkstang/skills --skill delegate`,
or follow [Installation](../installation.md) for the plugin. Both forms bundle
the provider helper and need an authenticated provider CLI. Live provider
discovery for the new standalone form remains unverified.

Claude Code invokes the plugin form as
`/consensus:delegate` and Codex as `$consensus:delegate`; Cursor's local plugin
load exposes the local name. You can also just ask the host to hand a task to
another model.

Use [`phone-a-friend`](phone-a-friend.md) when you want an opinion for the host
to weigh, and [`review`](review.md) when an independent reviewer should inspect
a bounded branch, file set, or document.

## Write or read-only

The host picks the mode from what you ask:

- **Write** when you ask it to delegate a task that changes code or files. You
  do not have to say "write".
- **Read-only** when the ask is a question, review, or investigation ("have
  Codex look into why X fails"), and whenever the host consults a peer on its
  own initiative.

If the host cannot tell, it asks. Cursor runs read-only only.

## Peers

By default the host picks a ready provider other than itself, checked with a
scoped preflight. Name a peer to choose it yourself; any provider works,
including the host's own. Pass a model or effort only when you want one;
Cursor accepts neither.

## How a write run works

1. The host writes a brief with three blocks: `<task>`, `<output_contract>`,
   and `<verification_loop>`, which names the exact verification command. The
   brief tells the peer to leave its changes unstaged.
2. It creates a dedicated linked worktree on a new `delegate/<slug>` branch
   from a commit, so the peer never writes in your checkout, and takes a
   baseline snapshot of it.
3. It runs the peer once with `--output text`, a single attempt, and a
   30-minute timeout (15 minutes for read-only runs).
4. It snapshots the worktree again and reports any new commits, staged,
   unstaged, and untracked changes, and the full change since the baseline,
   computed by git rather than taken from the peer.
5. It reads the diff, reruns the verification command, and gives you the
   result, its assessment, and a reason for anything it dismisses.

The run ends there. You choose whether to commit, bring the branch into your
work, continue with the peer, or discard the worktree; the host does those
only when you ask.

A read-only run uses the repository root as its working directory and skips
the worktree and snapshots. The host still checks the peer's load-bearing
claims against the source before relying on them.

## What the peer can do

The provider policies come from `consensus run`; see
[Provider run controls](configuration.md#provider-run-controls) for the full
behaviour.

| Peer   | Write mode                                          | Read-only mode                |
| ------ | --------------------------------------------------- | ----------------------------- |
| Codex  | `--sandbox workspace-write --approval-policy never` | `--sandbox read-only`         |
| Claude | `--permission-mode workspace-write`, `--allow-bash` | `--permission-mode read-only` |
| Cursor | not supported                                       | `--permission-mode read-only` |

- **Codex** edits inside the worktree and is denied writes outside it. It
  cannot `git add` or `git commit` in a linked worktree, because the index
  lives outside its writable root, so its changes stay unstaged. Network
  access follows your Codex sandbox configuration.
- **Claude** gets file tools plus only the Bash commands the host grants, such
  as the verification command. File-tool writes outside the worktree and other
  commands are denied. These are permission rules, not an operating-system
  sandbox, and three limits remain: `acceptEdits` auto-approves simple file
  commands such as `touch` inside the worktree, your own Claude allow rules
  still apply, and a granted command runs repository code the peer can edit,
  such as `package.json` scripts or tests, without being confined to the
  worktree. After a Claude write run the host also checks that your own
  checkout is unchanged and reports any difference.

A commit made by any peer is reported, never accepted silently.

## Failures and timeouts

The host reads the JSON envelope, not the exit code. If the peer timed out,
was interrupted, or ended in an unknown turn state, it may still have changed
files: the host inspects the worktree and reports what it finds, and never
resends the brief. A failure before the turn started, such as a usage or
preflight error, is fixed and run again.

## Continuing

When you ask for a follow-up, such as "have it fix the failing test", the host
resumes the same Claude or Codex session with the same model, effort, and
write policy. In write mode it first checks that the worktree has changed only
in what the previous report recorded; any other change waits for your
decision. Cursor has no continuation.

## Limits

- Delegate runs one provider turn per request. It does not merge, push, or
  open pull requests.
- Do not put secrets or credentials in a brief. Provider CLIs can send prompt
  contents and files they read to their services.
- Claude's write mode uses Claude Code permission rules, not an operating
  system sandbox.
