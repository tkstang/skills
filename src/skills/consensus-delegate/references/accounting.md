# Accounting

Compute every change from your own baseline. Never take the file list from the
peer's reply: it is a claim, checked against what git shows.

## Snapshot

Define this function in `bash` (it uses `read -d ''`). It records the
worktree's state in `<out-dir>`, a directory outside the worktree, and prints
three IDs:

- `head`: the commit checked out.
- `index`: a tree of the staged state.
- `tree`: a tree of every tracked and untracked file that is not ignored,
  excluding `.consensus/`. Unlike `git status`, it changes when an
  already-modified file is edited again.

```bash
delegate_snapshot() { # delegate_snapshot <worktree> <out-dir>
  local wt=$1 out=$2 idx
  mkdir -p "$out" && idx="$(cd "$out" && pwd)/tmp-index" && rm -f "$idx" || return
  git -C "$wt" rev-parse HEAD > "$out/head" &&
    git -C "$wt" status --porcelain=v2 -z > "$out/status" &&
    git -C "$wt" write-tree > "$out/index-tree" &&
    GIT_INDEX_FILE="$idx" git -C "$wt" read-tree HEAD &&
    GIT_INDEX_FILE="$idx" git -C "$wt" add -A -- . ':(exclude).consensus' &&
    GIT_INDEX_FILE="$idx" git -C "$wt" write-tree > "$out/tree" &&
    git -C "$wt" ls-files -o --exclude-standard -z -- . ':(exclude).consensus' |
    while IFS= read -r -d '' p; do
      printf '%s  %s\n' "$(git -C "$wt" hash-object -- "$p")" "$p"
    done > "$out/untracked"
  rm -f "$idx"
  printf 'head %s\nindex %s\ntree %s\n' "$(cat "$out/head")" \
    "$(cat "$out/index-tree")" "$(cat "$out/tree")"
}
```

The temporary index lives in `<out-dir>`, so the worktree's files and staged
state are not changed. Keep the three printed IDs in your own notes and report: they
are the baseline. The files in `<out-dir>` (`status` holds
`git status --porcelain=v2 -z`, and `untracked` the untracked files with their
hashes) are a convenience, and a peer that can write to that directory could
alter them.

## Baseline

Before the first turn, run `delegate_snapshot <worktree> <state-dir>/turn-1-before`.
A freshly created worktree is clean: `index` and `tree` both equal
`git -C <worktree> rev-parse 'HEAD^{tree}'`, and `untracked` is empty. If setup
added files that are not ignored, list them in the report as part of the
baseline.

## After the run

Run `delegate_snapshot <worktree> <state-dir>/turn-<n>-after` whether the run
succeeded, failed, or timed out. With `B` the baseline IDs and `A` the new ones:

```bash
git -C <worktree> rev-list <B.head>..<A.head>   # new commits
git -C <worktree> diff --cached --stat          # staged changes
git -C <worktree> diff --stat                   # unstaged changes
cat <state-dir>/turn-<n>-after/untracked        # untracked files with hashes
git -C <worktree> diff --stat <B.tree> <A.tree> # everything this turn changed
git -C <worktree> diff <B.tree> <A.tree>        # the full diff to read
```

- Report every new commit by hash and subject; never accept one silently. If
  `head` changed but `rev-list` is empty, the peer moved `HEAD`; report that.
- The last command covers committed, staged, unstaged, and untracked changes
  alike. Read all of it before you run verification.
- If your own verification run then changes files that are not ignored, list
  them in the report and take the closing snapshot after it. The closing
  snapshot's IDs are the baseline for any continued turn.

## Report

Give the user:

- `ok` and `code`, and the terminal reason (`attempts.terminal_reason`, plus
  `diagnostics.termination` when present).
- `final_text`: the envelope's `text`, or "none" on a failure.
- The session id (`continuation.session_id`) and the turn state
  (`continuation.turn`).
- Requested and observed model and effort: requested is what you passed, or
  "provider default"; observed comes from `continuation.observed_models`, and
  is "unobserved" when absent. No provider reports effort, so observed effort is
  "unobserved".
- Permission denials (`diagnostics.permission_denials`), or "none".
- For a write run: the worktree path and branch, the baseline and closing IDs,
  new commits, staged, unstaged, and untracked changes, the changes this turn
  made, and any changes your verification made.
- Your verification command and its result, and your assessment of the diff,
  with a reason for anything you dismiss.

## Continue

Before a continued write turn, run `delegate_snapshot` again. Continue only if
`head`, `index`, and `tree` all equal the previous turn's closing snapshot, so
the worktree has changed only in what that report recorded. That snapshot is
then the new baseline. If any ID differs, show the user
`git -C <worktree> diff --stat <closing.tree> <current.tree>` and the `head`
change, and wait for their decision.
