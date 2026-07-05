# PJM Guidance

This directory owns active project-management state.

- `current-state.md` records the present operating picture.
- `roadmap.md` records prioritized direction and sequencing.
- `backlog/` stores file-per-record backlog items and generated indexes.
- Do not store durable research, brainstorms, imported plans, or decision
  history here.

## Backlog Lifecycle

Invariant: `backlog/items/` holds only active work (`status: open` or
`in_progress`). Completed and abandoned records live in `backlog/archived/`.
`backlog/completed.md` is the newest-first summary of what shipped.

**Trigger.** Run the close-out steps below when either is true:

- an item's `status` changes to `closed` or `wont_do` (these are the only
  terminal values — never invent variants like `done`), or
- a commit or PR satisfies an item's acceptance criteria — **even when the work
  happened outside an OAT project lifecycle** (small doc commits included).

The agent or person shipping the work owns the close-out, in the same
commit/PR as the work whenever practical.

**Close-out steps, in order:**

1. In the item file, set `status: closed` (or `wont_do`) and bump `updated`.
2. Append a summary entry to `backlog/completed.md` (newest first; entry format
   is documented at the top of that file). Skip the entry for `wont_do` items
   unless the abandonment itself is worth recording.
3. `git mv` the item file from `backlog/items/` to `backlog/archived/`.
4. Run `oat backlog regenerate-index` and stage the regenerated
   `backlog/index.md`.
5. If the completion changes the operating picture, refresh
   `current-state.md` and the curated overview section of `backlog/index.md`.

A partial close-out (status flipped or `completed.md` updated, but the file
left in `items/`) is how drift starts — finish all steps or none.

**When reviewing backlog state** (e.g. `oat-pjm-review-backlog`), cross-check
recent commits against open items: work that shipped without a close-out
should be closed retroactively with a note.
