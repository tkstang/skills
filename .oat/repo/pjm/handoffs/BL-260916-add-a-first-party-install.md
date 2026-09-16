# Handoff: First-party standalone installer

**Item:** [BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills](../backlog/items/BL-260916-add-a-first-party-install.md)
**Mode:** `oat-project-quick-start` — focused installer project; short design for integrity/overwrite boundaries.
**Assignment:** Approved parallel lane; user selects its implementation agent/worktree. Not yet claimed started.

## Objective and inputs

Install declared generated standalone payloads from an explicit pinned tag into the chosen host's project-scope skills directory, verify the payload, and print the host invocation name. Do not copy authored `src/skills/` or silently install a user's global skills.

Read:
- The linked item and `install.sh` (currently a Consensus-wrapper installer, not a general skill installer).
- `src/distributions.ts` and `scripts/lib/packaging.ts`.
- `tests/release/` and `tests/tooling/` for installed-artifact/build patterns.
- `documentation/docs/user-guide/installation.md`, `RELEASING.md`, and `documentation/AGENTS.md`.

## Required design and implementation boundary

Pre-populate discovery from the ticket. Specify CLI shape, pinned ref resolution and authenticity/integrity meaning, complete payload inventory, host destination/invocation mapping, overwrite/refusal and partial-failure behavior. Preserve the current Consensus-wrapper installation contract unless a change is explicitly designed and tested.

Test missing tag/skill, invalid target, refusal to copy source, existing destination, and interrupted/failed copy without damaging an existing installation. Use temporary directories/local fixtures; production networking must not be required for unit tests.

Add the first-party procedure beside the third-party Skills CLI path. The release checklist must cover live host acceptance; actual live discovery/install checks require separate authority. If unavailable, state which acceptance evidence remains pending rather than closing prematurely.

This work can proceed alongside observer reliability and Consensus Review. Coordinate any overlapping distribution catalog and installation-guide changes at integration; do not absorb those projects.

## Repository and verification contract

- Use a separate visible worktree for implementation; do not reset or write in a peer's worktree. Read root `AGENTS.md`, `src/AGENTS.md`, and applicable docs/test guidance.
- Consume the current planning item (this branch/PR), not an older main copy. After the planning PR merges, rebase or reconcile ticket changes before closeout. Do not overwrite the concurrent planning update.
- Edit canonical source only. Any changed canonical skill directory, including tests/references, requires its sole `metadata.version` bump; account for transitive consumers. Regenerate declared outputs with `pnpm run build`.
- Run scoped Vitest tests, `pnpm run type-check`, `pnpm run build:check`, `pnpm run validate`, applicable changed-file lint/format and `pnpm run validate:skill-versions -- --base-ref origin/main`; run `pnpm run premerge` before final handoff.
- Keep runtime dependency-free. No paid/live provider calls, user-global installation, release, push, or PR publication is granted by this handoff. Request those boundaries explicitly when needed.
- Record limitations honestly: deterministic fixtures do not prove live provider discovery, harness wake/delivery, or external installation.

## Closeout

When all acceptance criteria including the agreed live verification boundary are satisfied, run `oat backlog archive BL-260916-add-a-first-party-install --summary "<verified outcome>"`, regenerate the index and update current-state/roadmap in the same shipping PR.

Delete this consumed handoff with `git rm .oat/repo/pjm/handoffs/BL-260916-add-a-first-party-install.md` in that same PR.
