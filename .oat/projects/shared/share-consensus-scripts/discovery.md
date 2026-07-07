---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-07-07
oat_generated: false
---

# Discovery: share-consensus-scripts

## Initial Request

Create a quick-mode OAT project for the handoff at
`.oat/repo/pjm/handoffs/BL-260620-share-consensus-generated.md`.

The handoff targets backlog item
`.oat/repo/pjm/backlog/items/BL-260620-share-consensus-generated.md`
(`BL-260620-share-consensus-generated` - "Share consensus generated runtime
output at the plugin level"). The handoff says the acceptance criteria are
already near-spec quality and directs the plan shape: spike phase, go/no-go gate,
then build phase when the spike passes. A documented no-go that keeps duplicated
generated output and records why is a legitimate terminal outcome that can close
the item.

## Request Classification

Well-understood. The backlog item and handoff provide the requirements, sources
of truth, constraints, verification gates, and closeout steps. The remaining
unknowns are spike findings to resolve during implementation, not missing
planning requirements.

## Source Material

- Handoff:
  `.oat/repo/pjm/handoffs/BL-260620-share-consensus-generated.md`
- Backlog item:
  `.oat/repo/pjm/backlog/items/BL-260620-share-consensus-generated.md`
- Generated-output build mapping: `scripts/build-generated.mjs`
- Drift guard and config coverage:
  `tests/tooling/generated-output-sync.test.ts`
- Decisions:
  `.oat/repo/reference/decisions/DR-260615-canonical-typescript-sources.md`
  and
  `.oat/repo/reference/decisions/DR-260616-build-time-import-rewrites.md`
- Standalone recovery decision:
  `.oat/repo/reference/decisions/DR-260627-keep-consensus-skills.md`
- Provider install/load references: `plugins/consensus/README.md` and
  `RELEASING.md`
- Docs target:
  `documentation/docs/engineering/architecture/generated-runtime.md`
- Backlog closeout contract: `.oat/repo/pjm/AGENTS.md`

## Solution Space

The chosen direction is a spike-gated plugin-local migration.

### Approach 1: Plugin-local shared generated output (recommended on go)

Emit shared consensus runtime output under `plugins/consensus/scripts/` and
rewrite generated skill wrappers to import it through plugin-root-relative
paths. This is the cleaner layout if Claude, Codex, Cursor, and Copilot preserve
the plugin root beside `skills/` in the installed or local-load layouts we care
about.

This approach reduces generated-output duplication while preserving the existing
contract: canonical TypeScript under `src/`, committed generated `.mjs` runtime
outputs, and drift checks through `scripts/build-generated.mjs`.

### Approach 2: Keep duplicated per-skill output (valid no-go terminal outcome)

If the spike finds that one or more supported hosts cannot reliably preserve or
execute plugin-local shared scripts, keep the current per-skill duplicated
outputs and record the provider-specific blocker. This preserves install
robustness and still closes the item if the evidence is clear.

### Rejected Approach: Global shared runtime path

Do not move runtime dependencies to a global `~/.consensus/scripts` style path.
The backlog item explicitly rejects that shape because it creates version,
cleanup, and cross-install coupling. The existing `~/.consensus/consensus.mjs`
fallback from PR #38 remains a standalone-install recovery path to verify, not
the primary layout for this project.

## Key Decisions

1. **Workflow:** Use quick mode and go straight to plan after the requirements
   gate; the handoff and backlog item are detailed enough that a separate
   lightweight design artifact is not necessary.
2. **Execution shape:** Plan implementation as spike, go/no-go, then build. The
   build tasks are conditional on spike success.
3. **Terminal outcomes:** Both "migrate to plugin-local shared output" and
   "keep duplication with documented evidence" are valid project outcomes.
4. **Runtime boundary:** Stay plugin-local and hermetic. Do not introduce a new
   global shared runtime path.
5. **Build contract:** Edit canonical TypeScript and build tooling, then run
   `pnpm run build` to regenerate committed `.mjs` outputs. Never hand-edit
   generated output with a `// GENERATED` banner.
6. **Closeout:** Close or archive the backlog item and delete the consumed
   handoff file in the same PR as the implementation outcome.

## Constraints

- Nothing that touches `consensus-loop` should run concurrently with this
  project.
- Verify Claude, Codex, Cursor, and Copilot plugin layouts before committing to
  the shared-output migration.
- The spike must verify the PR #38 standalone recovery path still works after
  any layout change.
- Changed consensus skills must bump `SKILL.md` versions, keeping top-level
  `version` and `metadata.version` in sync.
- Runtime plugin code remains dependency-free; provider CLI subprocesses are the
  only external execution boundary.
- Documentation updates belong in the docs site, not the README, unless source
  claims elsewhere become stale.
- Full closeout gates include `pnpm test`, `pnpm run build:check`,
  `npm run validate`, `npm run smoke`, and `pnpm run worktree:validate` before
  merge.

## Success Criteria

- Spike evidence records the install or local-load command and installed layout
  result for Claude, Codex, Cursor, and Copilot.
- Spike proves plugin-local shared scripts resolve and execute from each
  supported host layout, or records concrete blockers and recommends retaining
  duplicated per-skill output.
- On go, `scripts/build-generated.mjs` emits one shared
  `plugins/consensus/scripts/consensus-loop.mjs` instead of five per-skill loop
  copies.
- On go, generated consensus skill wrappers import the shared loop through the
  plugin-local shared path, and drift checks cover the new mapping.
- Per-skill duplicated `consensus-loop.mjs` outputs are removed from maintained
  source/runtime/docs/tests after migration.
- Tests or release checks simulate or exercise the installed plugin-root layout.
- Documentation states the Consensus runtime contract as plugin install/local
  plugin loading; standalone single-skill copying is a non-goal except for the
  existing recovery path.
- The backlog item is closed or archived, `backlog/completed.md` and indexes are
  refreshed, and the consumed handoff file is removed in the same PR.

## Out of Scope

- Reworking consensus-loop behavior, deliberation metrics, similarity heuristics,
  or loop quality.
- Running the queued loop-quality backlog work concurrently with this item.
- Introducing a global shared runtime location for plugin wrappers.
- Claiming provider marketplace support or skills.sh discovery beyond verified
  live evidence.
- Hand-editing generated `.mjs` outputs.

## Deferred Ideas

- Sharing `consensus-config.mjs` at the plugin level may be evaluated during the
  build phase if the same provider-layout evidence supports it, but the backlog
  item's required migration target is `consensus-loop.mjs`.
- Future provider marketplace claims stay deferred until release checklist
  evidence verifies them.

## Open Questions

- Does Copilot preserve the local plugin root beside `skills/` in a way that can
  execute `../../../scripts/*.mjs` from wrappers?
- Do all provider installs preserve `plugins/consensus/scripts/` after install or
  local load, rather than copying only individual skill folders?
- If plugin-local shared output passes for `consensus-loop.mjs`, should this PR
  also share `consensus-config.mjs`, or should config sharing remain a follow-up?

## Assumptions

- The current branch is the intended worktree for this OAT lane.
- The handoff reflects the current priority window and this project is the cycle
  anchor for consensus-loop-touching work.
- Provider CLI commands in `plugins/consensus/README.md` and `RELEASING.md` are
  starting points, but implementation must verify live command behavior before
  making release claims.

## Risks

- **Provider layout mismatch:** A host may copy skill directories without the
  plugin root, breaking plugin-local shared imports.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Make the spike the first phase and treat no-go as a
    valid closeout path.
- **Generated-output drift:** Build mapping, committed outputs, lint/format
  ignores, and tests can diverge.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Update `scripts/build-generated.mjs` as the source of
    truth, run `pnpm run build`, and verify with `pnpm run build:check` and
    `tests/tooling/generated-output-sync.test.ts`.
- **Stale public documentation:** Provider support claims can get ahead of live
  evidence.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Keep docs scoped to verified plugin install/local-load
    behavior and avoid marketplace/discovery claims unless rechecked.

## Next Steps

Proceed straight to the requirements gate, then generate a quick implementation
plan.
