# Handoff: Consensus Review

**Item:** [BL-260916-add-consensus-review-cross — Add consensus-review: cross-model review of a bounded scope](../backlog/items/BL-260916-add-consensus-review-cross.md)
**Mode:** `oat-project-quick-start` with **lightweight design**.
**Ownership:** Astra drives planning/implementation; Fable watches and provides independent review. Peer review complements, rather than silently replaces, configured OAT gates.

## Objective

Ship one bounded worktree-based reviewer invocation: standalone `consensus-review`, plugin-local `review`, both using the same skill-owned `scripts/review.mjs`, not a generic dispatcher subcommand. No convergence loop, packet-only mode, or full isolation claim. Direct provider dispatch already forwards model/effort; the convergence settings fix is not a prerequisite.

The approved smaller v1 has three selectors: base-branch diff, explicit files, and document (including external/materialized conversation text). Missing scope makes the host agent ask the user to choose among those options and supply ref/paths; direct CLI calls return usage error with zero invocations instead of prompting or guessing. Staged-only, unstaged-only and committed ranges are deferred until a real need appears.

## Pre-populate discovery and lightweight design

Use the item and confirmed conversation to fill scope, decisions and non-goals. Confirm rather than rediscover settled choices. Design these seams before an executable plan:

1. `defaults.reviewers`: ordered preference list, invocation/project/user/built-in precedence, list replacement, explicit model/effort overrides, scoped readiness/fallback. A different provider is not necessarily a different model family; disclose unknown identity.
2. Scope capture: base/files/document; exact request, commit and dirty diff/content hashes; requested versus actually inspected scope and checks run. Base scope includes staged/unstaged tracked changes; explicit file scope can include untracked files.
3. Read-only execution: supported provider controls, unsupported-provider failure/skip, external host/capture state, and narrow drift detection: HEAD/index/status plus selected-path hashes. Unselected content changes with unchanged status can be missed; no whole-worktree hashing engine. Worktree access does not authorize edits or establish universal filesystem/network isolation.
4. Owned JSON findings schema and deterministic OAT Markdown adapter, tested against `oat-review-receive`. Preserve location-or-anchor, severity, evidence, confidence, questions and provenance.
5. One dispatched invocation with bounded attempts/recursion; honest handling of provider-internal tools, errors and incomplete output.

Use the reconciled design/plan at `.oat/projects/shared/consensus-review/`: seven tasks, three phases, High ceiling, configured planning/final gates and ordinary reviews, no optional phase gates. Fable approved the revision, formal artifact review passed, and the configured planning gate passed with its user-approved dispositions recorded. The plan is ready for implementation starting at p06-t01; execution still requires user authorization. The p08-t02 receipt exercise remains an interoperability check.

## Source inputs and boundaries

- `src/plugins/consensus/config/consensus-config.ts` and its tests.
- `src/plugins/consensus/provider-cli/{args,commands,adapters,runtime-policy,invocation,structured-output,types}.ts`.
- `src/skills/{phone-a-friend,panel,session-handoff}/` for existing dispatch and context patterns.
- `src/distributions.ts`, distribution/build tests, and `.agents/skills/oat-review-receive/SKILL.md`.
- `documentation/docs/user-guide/consensus/configuration.md` and the Consensus guide.

Do not bundle convergence model propagation, atomic loop writes, metrics, similarity, live-submit investigation, or the installer. Extract loop-free helpers only if the design demonstrates a directly needed shared abstraction; otherwise use the existing runner and leave that item separate.

## Repository and verification contract

- Use a separate visible worktree for implementation; do not reset or write in a peer's worktree. Read root `AGENTS.md`, `src/AGENTS.md`, and applicable docs/test guidance.
- Consume the current planning item (this branch/PR), not an older main copy. After the planning PR merges, rebase or reconcile ticket changes before closeout. Do not overwrite the concurrent planning update.
- Edit canonical source only. Any changed canonical skill directory, including tests/references, requires its sole `metadata.version` bump; account for transitive consumers. Regenerate declared outputs with `pnpm run build`.
- Run scoped Vitest tests, `pnpm run type-check`, `pnpm run build:check`, `pnpm run validate`, applicable changed-file lint/format and `pnpm run validate:skill-versions -- --base-ref origin/main`; run `pnpm run premerge` before final handoff.
- Keep runtime dependency-free. No paid/live provider calls, user-global installation, release, push, or PR publication is granted by this handoff. Request those boundaries explicitly when needed.
- Record limitations honestly: deterministic fixtures do not prove live provider discovery, harness wake/delivery, or external installation.

## Closeout

Run `oat backlog archive BL-260916-add-consensus-review-cross --summary "<verified outcome>"` only when the whole item is satisfied. Update current-state, roadmap and user-facing configuration/usage docs in the same shipping PR.

Delete this consumed handoff with `git rm .oat/repo/pjm/handoffs/BL-260916-add-consensus-review-cross.md` in that same PR. Do not close adjacent tickets unless their own acceptance criteria have independently been met.
