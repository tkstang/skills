# Worktree writes

A write run edits a dedicated linked worktree that you create. It never runs in
your own checkout, and it has one writer at a time.

## Create the worktree

Create it from a commit, which gives a clean worktree on a new branch:

```bash
git -C <repo-root> worktree add -b delegate/<slug> <worktree-path> <base>
```

- `<base>` defaults to `HEAD` of your checkout. Uncommitted changes in your
  checkout are not in the new worktree; if the task depends on them, tell the
  user so they can commit them first.
- Put the worktree where the repository's instructions say worktrees go.
  Otherwise use a sibling directory, such as `../<repo>-delegate-<slug>`.
- If the verification command needs dependencies or generated files, run the
  repository's worktree setup now, before the baseline.
- Then take the baseline snapshot in [accounting](accounting.md#baseline).

Use one worktree per delegated task. While a turn runs, the peer is the only
writer: do not edit the worktree yourself, and never start a second run in it.

## What the peer can do

Codex, `--sandbox workspace-write --approval-policy never`:

- It edits inside the worktree and is denied writes outside it and to `$HOME`.
- It cannot run `git add` or `git commit`. A linked worktree's index lives under
  the main checkout's `.git/worktrees/`, outside the writable root, so these
  fail with `Operation not permitted`. That is expected: the peer leaves its
  changes unstaged.
- Network access follows the user's Codex sandbox configuration; do not assume
  it is on or off.

Claude, `--permission-mode workspace-write`:

- It runs with `acceptEdits` and the tools `Read`, `Glob`, `Grep`, `Edit`, and
  `Write`, plus `Bash` limited to the `--allow-bash` patterns you grant.
- The Edit and Write tools are denied outside the worktree, and ungranted
  commands are denied.
- These are Claude Code permission rules, not an operating-system sandbox, and
  three limits remain:
  - `acceptEdits` auto-approves simple file commands such as `touch` inside the
    worktree.
  - The user's own Claude allow rules still apply, so an interpreter they have
    allowlisted is not blocked.
  - A granted command runs repository code the peer can edit, such as
    `package.json` scripts or tests, and that code is not confined to the
    worktree. The after-run procedure in [accounting](accounting.md) checks
    your own checkout for this.
- An `--allow-bash` pattern, such as `git status:*`, is one line of at most 256
  characters with no parentheses or commas, and must name a command.

Cursor has no write mode.

Both Claude and Codex keep the same write policy on a resumed turn.

## After the run

The worktree stays as the peer left it, with the changes unstaged. If host
verification finds an ordinary failure within the original task, resume the
same peer automatically under the skill's Continue rules, then account for and
verify the next turn. Once verification passes or the work is blocked, run only
the step the user chooses:

- Commit in the worktree:
  `git -C <worktree-path> add -A && git -C <worktree-path> commit`.
- Bring the changes into their branch, for example by merging or cherry-picking
  `delegate/<slug>` once it has a commit.
- Continue with the peer; see the skill's Continue section.
- Discard: `git -C <repo-root> worktree remove --force <worktree-path>`, then
  `git -C <repo-root> branch -D delegate/<slug>`.

Never merge or push on your own.
