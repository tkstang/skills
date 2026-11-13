# Brief template

Write the brief as a file outside the worktree and pass it with
`--prompt-file`. Fill in every block; delete the line for the mode you are not
using. Keep the context to what the task needs, and leave out secrets,
credentials, and private data.

```text
<task>
Goal: <one or two sentences: what done looks like>

Context:
- Repository and branch: <name>, <branch or base commit>
- Relevant files: <paths, with a line on why each matters>
- Constraints: <conventions, APIs to keep, things not to touch>
- Known so far: <findings, failed attempts, error output>

Working directory: <absolute cwd>. Stay inside it.
Write: edit files in the working directory only. Do not stage, commit, push,
or create branches; leave every change unstaged for the host to review.
Read-only: do not create, edit, or delete any file.
</task>

<output_contract>
End with one final reply that contains:
- Summary: what you did and why, in a few sentences.
- Changes (write) or Findings (read-only): each file you changed with a
  one-line reason, or each finding with file:line evidence.
- Verification: each command you ran and its result.
- Open issues: anything unfinished, uncertain, or blocked, including commands
  or writes that were denied.
</output_contract>

<verification_loop>
Run `<exact verification command>` in the working directory. If it fails, fix
the cause and run it again until it passes or you stop making progress, then
report the last failing output. Do not skip, weaken, or delete tests to make it
pass.
</verification_loop>
```

## Notes

- Name one exact verification command. You rerun the same command after the
  peer finishes. For a read-only task, the verification can be "cite file:line
  evidence for every claim". Use a command that cannot write to the checkout;
  run any verification that may write in a separate worktree.
- A Claude write run can execute only the Bash commands you grant with
  `--allow-bash`, so grant the verification command. A Codex run may have no
  network, depending on the user's Codex sandbox configuration, so install
  dependencies before the run rather than asking the peer to.
- For a continued turn, write a short follow-up that names what to change, and
  repeat the verification loop. The resumed session keeps the earlier context.
