# End-of-run status instruction

`reorient` rebuilds the whole thread after the fact. A standing instruction can
cover the common case earlier: every time an agent hands back after a long
autonomous run, it ends with a short status block. When a returning user can
read that block, they often do not need a full reorientation. The two share one
field set so the user reads the same shape in both places.

This file is the versioned copy of that instruction. The skill does not install
it. To adopt it, add the text below to user-level agent instructions, for
example `~/.claude/CLAUDE.md` for Claude Code, the user-level `AGENTS.md` for
Codex, and a user rule file such as `~/.cursor/rules/end-of-run-status.mdc` for
Cursor, with `alwaysApply: true` in its frontmatter.

## The instruction

```markdown
# End-of-Run Status

When handing back after sustained autonomous work — roughly 20+ minutes, several
substantive steps without user input, or delegated work — end with a short status
block. Skip it in live back-and-forth, quick tasks, and interim progress updates.

- **Goal:** the current intended outcome, including accepted corrections.
- **Done:** what this run completed. Omit when nothing.
- **Now:** where things stand: finished, running, blocked, or unverified.
- **Next:** the immediate action and who takes it, marked recommended, scheduled,
  or running. Omit when nothing remains. Add "ask for next steps for more detail"
  only when there is more detail to be had.
- **Needs you:** the specific input or action required, or "nothing".

One short line each. Qualify reported or unverified results. Do not restate the
body, invent follow-up work, or manufacture approval requests.
```

## Why it is shaped this way

- **The trigger is observable.** Duration, step count, and delegation are facts
  the agent knows. The instruction does not ask it to guess whether the user has
  walked away. Conversational turns and interim updates are excluded so the block
  does not become noise.
- **Goal, Now, and Needs you always appear.** "Needs you: nothing" tells the
  reader they can leave; a missing line would be ambiguous. Done and Next appear
  only when they have content, because Now already explains an empty Done
  (blocked, still running) or an empty Next (finished).
- **Done and Now are separate.** "Implemented the fix" and "CI is still running"
  answer different questions; merging them lets completed work read as the
  overall state.
- **Done is this run only,** not cumulative progress, so the block stays short
  over a long thread.
- **The next-steps pointer is conditional.** It appears only when Next compresses
  something non-trivial, such as several dependent steps or a decision with
  tradeoffs. Phrasing it as a request rather than a skill name keeps it valid
  where no such skill is installed.
- **The last line guards against padding, overstated completion, and invented
  work.**

## Differences in reorient's closing block

`reorient` ends with the same five fields. Its Done covers the latest substantive
stretch of work rather than the reorientation itself, and it never adds the
next-steps pointer, because its own Next section already carries the reasoning.
