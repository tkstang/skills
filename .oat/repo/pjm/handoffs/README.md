# PJM Handoffs

One-shot kickoff context for backlog items about to become OAT projects.
Each file stitches the backlog item, existing research, code pointers, and
mode guidance into a single prompt an operator passes as context when calling
`/oat-project-quick-start` (or `/oat-project-new`) from a per-item worktree.

Conventions:

- One file per backlog item, named `<BL-id>.md`.
- Handoffs are **consumable, not durable**: once the project is created and
  the content is absorbed into project artifacts, delete the handoff
  (`git rm`) in the same PR that ships the work. Durable knowledge belongs in
  the item file, `reference/`, or project artifacts — never here.
- Each handoff carries its own deletion instruction so the consuming agent
  needs no outside context.
- Handoffs exist only for the **current kickoff stack** (see
  [`backlog/reviews/priority-alignment.md`](../backlog/reviews/priority-alignment.md));
  when an alignment pass reprioritizes an item out of the stack, delete its
  handoff. Governing guidance: **Project Kickoff Handoffs** in
  [`../AGENTS.md`](../AGENTS.md).

## Current handoffs

- [`BL-260612-add-consensus-research-skill.md`](./BL-260612-add-consensus-research-skill.md)
  (`BL-260612-add-consensus-research-skill` — Add consensus-research skill)
- [`BL-260612-add-deliberation-metrics.md`](./BL-260612-add-deliberation-metrics.md)
  (`BL-260612-add-deliberation-metrics` — Add deliberation metrics (tokens,
  wall-clock, rounds) to artifacts)
- [`BL-260612-add-similarity-heuristic.md`](./BL-260612-add-similarity-heuristic.md)
  (`BL-260612-add-similarity-heuristic` — Add similarity heuristic for
  near-converged deliberation states)
