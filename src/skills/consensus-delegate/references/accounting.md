# Accounting

Compute every change from your own baseline. Never take the file list from the
peer's reply: it is a claim, checked against what git shows.

## State directory

Keep the brief, the envelopes, and the snapshots in a state directory outside
the worktree and outside `/tmp` and `$TMPDIR`, because Codex `workspace-write`
can write to both temp locations. For example, use
`~/.cache/consensus-delegate/<slug>`.

## Snapshot

Write this function to `<state-dir>/snapshot.sh`. Each command tool call may
start a fresh shell, so source the file in the same command that uses it:
`. <state-dir>/snapshot.sh && delegate_snapshot <worktree> <out-dir>`. It works
in `bash` and `zsh`.

```sh
delegate_snapshot() { # delegate_snapshot <worktree> <out-dir>
  local wt="$1" out="$2" idx
  mkdir -p "$out" && idx="$(cd "$out" && pwd)/tmp-index" || return 1
  rm -f "$idx"
  if git -C "$wt" rev-parse --verify HEAD > "$out/head" &&
    git -C "$wt" write-tree > "$out/index" &&
    GIT_INDEX_FILE="$idx" git -C "$wt" read-tree HEAD &&
    GIT_INDEX_FILE="$idx" git -C "$wt" add -A &&
    GIT_INDEX_FILE="$idx" git -C "$wt" write-tree > "$out/tree"; then
    rm -f "$idx"
    printf 'head %s\nindex %s\ntree %s\n' "$(cat "$out/head")" \
      "$(cat "$out/index")" "$(cat "$out/tree")"
  else
    rm -f "$idx" "$out/head" "$out/index" "$out/tree"
    return 1
  fi
}
```

It prints three IDs and saves them in `<out-dir>`:

- `head`: the commit checked out.
- `index`: a tree of the staged state.
- `tree`: a tree of every tracked and untracked file that is not ignored.
  Unlike `git status`, it changes when an already-modified file is edited
  again.

It returns nonzero, with nothing saved, if any step fails, such as a missing
worktree or an index with unmerged entries. The temporary index lives in
`<out-dir>`, so the worktree's files and staged state are not changed. Ignored
paths, such as `node_modules`, `.env`, or build output, are not accounted for.

Keep the printed IDs in your own notes and report: they are the baseline. The
saved files make the commands below easier to write.

## Baseline

Before the first turn, snapshot the worktree into `<state-dir>/turn-1-before`.
A freshly created worktree is clean: `index` and `tree` both equal
`git -C <worktree> rev-parse 'HEAD^{tree}'`. If setup added files that are not
ignored, list them in the report as part of the baseline.

For a Claude write run, also snapshot your own checkout into
`<state-dir>/host-before`. A granted command can run code the peer edited, and
Claude has no operating-system sandbox, so the peer can reach beyond the
worktree.

## After the run

Snapshot the worktree into `<state-dir>/turn-<n>-after` whether the run
succeeded, failed, or timed out. With `B` the turn's starting IDs and `A` the
new ones:

```bash
git -C <worktree> rev-list <B.head>..<A.head>   # new commits
git -C <worktree> diff --cached --stat          # staged changes
git -C <worktree> diff --stat                   # unstaged changes
git -C <worktree> diff --raw --no-abbrev --diff-filter=A <A.index> <A.tree>
                                                # untracked files with hashes
git -C <worktree> diff --stat <B.tree> <A.tree> # everything this turn changed
git -C <worktree> diff <B.tree> <A.tree>        # the full diff to read
```

- Report every new commit by hash and subject; never accept one silently. If
  `head` changed but `rev-list` is empty, the peer moved `HEAD`; report that.
- The last command covers committed, staged, unstaged, and untracked changes
  alike. Read all of it before you run verification.
- For a Claude write run, snapshot your own checkout into
  `<state-dir>/host-after` and compare its IDs with `host-before`. Report any
  difference, with `git -C <repo-root> diff --stat <before.tree> <after.tree>`.
- If your own verification run then changes files that are not ignored, list
  them in the report and snapshot the worktree again into
  `<state-dir>/turn-<n>-closing`. Otherwise `turn-<n>-after` is the closing
  snapshot. The closing IDs are the baseline for a continued turn.

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
  made, any changes your verification made, and, for Claude, any change to your
  own checkout.
- Your verification command and its result, and your assessment of the diff,
  with a reason for anything you dismiss.

## Continue

Before a continued write turn, snapshot the worktree into
`<state-dir>/turn-<n+1>-before`. Continue only if `head`, `index`, and `tree`
all equal the previous turn's closing IDs, so the worktree has changed only in
what that report recorded. That snapshot is then the new turn's baseline. If
any ID differs, show the user
`git -C <worktree> diff --stat <closing.tree> <current.tree>` and the `head`
change, and wait for their decision.
