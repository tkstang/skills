---
title: 'Delegate'
description: 'Use delegate to hand one task to another provider: code changes run in a dedicated git worktree, and the host verifies the diff before you decide.'
---

# Delegate

`delegate` hands one task to another provider-backed AI peer, such as "have
Codex fix the flaky retry test" or "have Claude look into why the build is
slow". The peer does the work in a provider turn. The host agent then checks
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
load exposes the local name. The standalone form uses `/delegate` in Claude Code
and `$delegate` in Codex, without the plugin namespace. These invocation names
describe the declared payload; live discovery remains unverified. You can also
just ask the host to hand a task to another model.

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
   from a commit and takes a baseline snapshot of it. The worktree is the
   peer's working directory; Claude's permission limits are described below.
3. It runs the peer once with `--output text`, a single attempt, and a
   30-minute timeout (15 minutes for read-only runs).
4. It snapshots the worktree again and reports any new commits, staged,
   unstaged, and untracked changes, and the full change since the baseline,
   computed by git rather than taken from the peer.
5. It reads the diff and reruns the verification command. If it finds an
   ordinary failure within the original task, it resumes the same peer to fix
   it, then checks the new changes and reruns verification itself.
6. Once verification passes or the work is blocked, it gives you the result,
   its assessment, and a reason for anything it dismisses.

You choose whether to commit, bring the branch into your work, request further
work, or discard the worktree; the host does those
only when you ask.

A read-only run uses the repository root as its working directory and skips
the worktree and snapshots. The host still checks the peer's load-bearing
claims against the source before relying on them. Its verification command
must not write to your checkout; verification that may write runs in a separate
worktree.

## What the peer can do

The provider policies come from `consensus run`; see
[Provider run controls](provider-run-controls.md) for the full
behaviour.

| Peer   | Write mode                                          | Read-only mode                |
| ------ | --------------------------------------------------- | ----------------------------- |
| Codex  | `--sandbox workspace-write --approval-policy never` | `--sandbox read-only`         |
| Claude | `--permission-mode workspace-write`, `--allow-bash` | `--permission-mode read-only` |
| Cursor | not supported                                       | `--permission-mode read-only` |

- **Codex** edits inside the worktree and can also write to `/tmp` and
  `$TMPDIR`. Writes to other paths, including `$HOME`, are denied. It cannot
  `git add` or `git commit` in a linked worktree, because the index lives
  outside its writable root, so its changes stay unstaged. Network access
  follows your Codex sandbox configuration.
- **Claude** gets file tools plus only the Bash commands the host grants, such
  as the verification command. File-tool writes outside the worktree and other
  commands are denied. These are permission rules, not an operating-system
  sandbox, and three limits remain: `acceptEdits` auto-approves simple file
  commands such as `touch` inside the worktree, your own Claude allow rules
  still apply, and a granted command runs repository code the peer can edit,
  such as `package.json` scripts or tests, without being confined to the
  worktree. After a Claude write run the host compares tracked and non-ignored
  untracked files in your checkout and reports any difference. Ignored paths,
  such as `.env` or build outputs, are outside that check.

A commit made by any peer is reported, never accepted silently.

## Failures and timeouts

The host reads the JSON envelope, not the exit code. If the peer timed out,
was interrupted, or ended in an unknown turn state, it may still have changed
files: the host inspects the worktree and reports what it finds, and never
resends the brief. A failure before the turn started, such as a usage or
preflight error, is fixed and run again.

## Continuing

After a completed turn with a usable reply, the host automatically sends an
ordinary verification failure back to the same Claude or Codex session when
the fix is within the original task. It includes the failing command or
evidence, the expected result, and the original verification loop. It keeps
the same model, effort, mode, and permission grants, and accounts for and
verifies every follow-up itself. It stops when verification passes, progress
stops, or the fix is blocked or outside the original task. It does not widen
permissions or weaken verification.

You can also request further work explicitly. Before each continued write
turn, the host checks that the worktree has changed only in what the previous
report recorded; any other change waits for your decision. Timeouts,
interrupts, unknown execution, and unusable replies still stop for inspection
and reporting. Cursor has no continuation, so the host reports its failed
verification rather than starting another session.

## Limits

- Each provider turn runs once. Host verification can trigger follow-up turns
  within the original task. Delegate does not merge, push, or open pull requests.
- Do not put secrets or credentials in a brief. Provider CLIs can send prompt
  contents and files they read to their services.
- Claude's write mode uses Claude Code permission rules, not an operating
  system sandbox.
- Snapshots exclude ignored paths. Worktrees with initialized submodules are
  unsupported because superproject snapshots cannot account for their working
  contents. The host stops if it cannot take a reliable baseline.
