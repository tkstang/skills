# Handoff: Share Consensus Generated Runtime Output at the Plugin Level

**Backlog item:** `.oat/repo/pjm/backlog/items/BL-260620-share-consensus-generated.md`
(`BL-260620-share-consensus-generated` — Share consensus generated runtime
output at the plugin level)
**Mode:** `/oat-project-quick-start` — the item's acceptance criteria are
already a near-complete spec. Pre-populate discovery from the item's
Description + sequencing notes and the PR #38 standalone-recovery evidence;
structure the plan as **spike phase → go/no-go gate → build phase**, where
"keep duplication, record why" is a legitimate terminal outcome that still
closes the item.

## Mission

Prove (or disprove) that plugin-local shared scripts survive every installed
plugin layout we care about — Claude, Codex, Cursor, Copilot — then, on a go,
collapse the duplicated generated outputs to one shared
`plugins/consensus/scripts/consensus-loop.mjs` that skill wrappers import via
a plugin-root-relative path. The duplication has grown since the item was
written: the loop is emitted into **5** skill dirs (refine, evaluate, create,
decide, plan) and `consensus-config.mjs` into **6** (those five + panel) —
see the target mapping in `scripts/build-generated.mjs`. Stay plugin-local
and hermetic; a global `~/.consensus/scripts` path is explicitly rejected by
the item.

**Scheduling constraint (why now):** nothing consensus-loop-touching may run
concurrently with this project — the window is open and this is the cycle
anchor per `backlog/reviews/priority-alignment.md`. The loop-quality worktree
(`BL-260612-add-deliberation-metrics` — deliberation metrics;
`BL-260612-add-similarity-heuristic` — similarity heuristic) queues behind
this project's land-or-close.

## Authoritative inputs (populate spec/design from these)

- The item file itself — acceptance criteria enumerate the spike evidence
  required per host and the exact build-change contract.
- `scripts/build-generated.mjs` — the canonical build-target mapping this
  project rewrites.
- `.oat/repo/reference/decisions/DR-260615-canonical-typescript-sources.md`
  and `DR-260616-build-time-import-rewrites.md` — the generated-runtime build
  contract (canonical TS under `src/`, committed `.mjs` outputs, drift
  guards). Your change must stay inside this contract.
- `.oat/repo/reference/decisions/DR-260627-keep-consensus-skills.md` — the
  PR #38 standalone-install recovery path (`~/.consensus/` resolver fallback
  + repo-root `install.sh` + actionable missing-CLI error). **The spike must
  verify this recovery path still works after the layout change** — it
  post-dates the item's original write-up.
- `plugins/consensus/README.md` + `RELEASING.md` — provider install/load
  commands per host (the spike's execution recipe) and the release-claim
  discipline.
- `tests/tooling/generated-output-sync.test.ts` — the drift guard that must
  cover the new mapping.
- Docs: `documentation/docs/engineering/` (generated-runtime build contract
  page) — update via `oat-project-document`, not README.

## Repo conventions and gates

- Never hand-edit `// GENERATED` `.mjs` outputs. Edit `src/`, run
  `pnpm run build`, verify with `pnpm run build:check`.
- Changed skills bump versions: any change under `plugins/consensus/skills/*`
  (including generated output) requires that skill's `SKILL.md` version bump,
  top-level `version` + `metadata.version` in sync — enforced by
  `pnpm run validate:skill-versions -- --base-ref <ref>` (CI + pre-push).
  A layout change touching all six skills bumps all six.
- Definition of done: `pnpm test`, `pnpm run build:check`, `npm run
  validate`, `npm run smoke`, and `pnpm run worktree:validate` before merge.
- Conventional commits (`feat(consensus): …` / `chore(consensus): …`).

## Close-out (same PR — no exceptions)

Follow the **Backlog Lifecycle** in `.oat/repo/pjm/AGENTS.md`: set the item
`status: closed` (also on a documented no-go) + bump `updated`, append the
`backlog/completed.md` entry, `git mv` the item to `backlog/archived/`, run
`oat backlog regenerate-index`, refresh `current-state.md` and the curated
overview. **Then delete this handoff file
(`git rm .oat/repo/pjm/handoffs/BL-260620-share-consensus-generated.md`) in
the same PR** — it is consumed context, not documentation.
