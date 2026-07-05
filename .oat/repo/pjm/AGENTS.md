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

## Project Kickoff Handoffs

`handoffs/` holds one-shot kickoff prompts that turn kickoff-stack backlog
items into OAT projects without re-deriving context. See `handoffs/README.md`
for the consumption convention.

**When to generate or refresh.** At the conclusion of a priority-alignment
pass (`oat-pjm-review-backlog` walkthrough), write or refresh one handoff per
item in the agreed **kickoff stack** — kickoff-stack items only, not the whole
board. When a later alignment pass reprioritizes an item out of the stack,
delete its stale handoff in that same pass.

**Required content per handoff** (file named `<BL-id>.md`):

- The item reference: ID + human-readable title + item file path.
- Recommended mode (`/oat-project-quick-start` vs `/oat-project-new`) with
  guidance on which project artifacts to pre-populate from existing research
  instead of leaving thin.
- Authoritative input pointers: research directories, decision records
  (`reference/decisions/`), and code paths the project should treat as
  source material.
- Repo conventions and verification gates the item file omits (build/test
  gates, version-bump rules, sequencing constraints).
- A close-out section requiring (a) the **Backlog Lifecycle** above executed
  in the same shipping PR, and (b) `git rm` of the handoff file in that same
  PR.

**Properties.** Handoffs are consumable, not durable — durable knowledge
belongs in the item file, `reference/`, or project artifacts. The operator
creates a worktree per item and passes the handoff as context when invoking
the project-creation skill. Every backlog item referenced inside a handoff
pairs the ID with its human-readable title (no bare IDs).
