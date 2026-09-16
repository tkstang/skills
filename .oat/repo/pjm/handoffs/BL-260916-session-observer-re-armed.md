# Handoff: Observer re-arm investigation

**Item:** [BL-260916-session-observer-re-armed — Investigate observer re-arm catch-up and suspected unread-record gaps](../backlog/items/BL-260916-session-observer-re-armed.md)
**Mode:** `oat-project-lite` — bounded single-ticket investigation.
**Assignment:** Sol is already started, per the user. This file preserves the existing handoff; do not launch a duplicate.

## Objective and evidence

Reproduce whether an exact-pin watcher loses a renderable message across termination/restart. Observed raw gaps were tool/reasoning/subagent records; they do not establish conversational loss. Current watch startup calls `observeCatchUp()` before setting the baseline and emits its result for `catchUpFirst`.

Authoritative inputs:
- The linked item.
- `src/skills/session-observer/src/lib/{watch,observe,state}.ts`.
- `src/skills/session-observer/src/watch.test.ts`.
- `src/skills/session-observer-collab/references/runtime-claude-code.md`.

## Work boundary

Use synthetic transcripts and existing deterministic helpers. Append a known renderable peer message while stopped; cover SIGTERM, max-runtime expiry, filtered-only ranges, startup appends, and competing consumers. Separate persisted consumption, stdout emission, and harness delivery.

If loss is demonstrated, fix the actual boundary and add regression coverage. Otherwise record the supported explanation and improve only evidence-backed diagnostics/guidance. The existing Monitor duration/re-arm claims need verification, not automatic repetition. Broader acknowledgment redesign or live-harness access is an escalation point.

Do not add the activity view, messaging, N>2 topology, Consensus cleanup, or changes to running watchers. Pre-populate the lite plan from the ticket and this evidence; preserve sanitized reproduction results in the project/closeout.

## Repository and verification contract

- Use a separate visible worktree for implementation; do not reset or write in a peer's worktree. Read root `AGENTS.md`, `src/AGENTS.md`, and applicable docs/test guidance.
- Consume the current planning item (this branch/PR), not an older main copy. After the planning PR merges, rebase or reconcile ticket changes before closeout. Do not overwrite the concurrent planning update.
- Edit canonical source only. Any changed canonical skill directory, including tests/references, requires its sole `metadata.version` bump; account for transitive consumers. Regenerate declared outputs with `pnpm run build`.
- Run scoped Vitest tests, `pnpm run type-check`, `pnpm run build:check`, `pnpm run validate`, applicable changed-file lint/format and `pnpm run validate:skill-versions -- --base-ref origin/main`; run `pnpm run premerge` before final handoff.
- Keep runtime dependency-free. No paid/live provider calls, user-global installation, release, push, or PR publication is granted by this handoff. Request those boundaries explicitly when needed.
- Record limitations honestly: deterministic fixtures do not prove live provider discovery, harness wake/delivery, or external installation.

## Closeout

Only after all criteria are satisfied, run `oat backlog archive BL-260916-session-observer-re-armed --summary "<verified outcome>"` and reconcile the index/current-state in the same shipping PR. If evidence remains insufficient, leave the item open with the precise remaining test.

Delete this consumed handoff with `git rm .oat/repo/pjm/handoffs/BL-260916-session-observer-re-armed.md` in that same shipping PR.
