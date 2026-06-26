---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-26
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ['p01'] # pause after the consensus-code phase, before verification
oat_plan_parallel_groups: [['p01', 'p02']] # code phase ∥ upstream-prompt doc (disjoint writes)
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: public-discovery

> Execute this plan using `oat-project-implement` — sequential by default, parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Control the public skill-discovery surface on the path we actually
control (the `npx skills` CLI). Make standalone consensus installs *recoverable*
across all five consensus skills, hand the OAT-tooling `internal` flag upstream
to `open-agent-toolkit`, and verify the standalone entries and skills.sh behavior.

**Architecture:** One centralized change in `src/consensus/core/consensus-loop.ts`
(an existence-aware `~/.consensus/` fallback in `resolveConsensusCliPath` plus a
shared, actionable missing-CLI error), regenerated to the five per-skill `.mjs`
runtimes; a pinned-fetch `install.sh` that provisions `~/.consensus/consensus.mjs`;
a README alternative-install section; an upstream handoff prompt; and CLI/skills.sh
verification.

**Tech Stack:** Node 22, TypeScript (canonical `src/`), esbuild-generated `.mjs`,
Vitest, pnpm, bash (`install.sh`).

**Commit Convention:** `{type}({scope}): {description}` — e.g. `feat(p01-t01): add ~/.consensus fallback to consensus CLI resolver`

## Planning Checklist

- [x] Confirmed HiLL checkpoints with user (pause after `p01`)
- [x] Set `oat_plan_hill_phases` in frontmatter
- [x] Evaluated phases for parallelism opportunities
- [x] Set `oat_plan_parallel_groups` in frontmatter

---

## Parallelism

`oat_plan_parallel_groups: [['p01', 'p02']]`

- **p01 (consensus code)** writes only under `src/consensus/**`,
  `plugins/consensus/**` (regenerated `.mjs` + SKILL.md version bumps),
  `tests/consensus/**`, `install.sh`, and `README.md`.
- **p02 (upstream handoff prompt)** writes only a single Markdown deliverable
  under the project's `handoff/` directory.

These write sets are disjoint and each phase has independent verification, so they
may run concurrently in isolated worktrees and merge back in plan order. **p03**
is sequential after the group: its CLI-recovery verification (`p03-t01`) depends
on the `p01` runtime change, so it must not be parallelized with `p01`.

No shared migration, generated artifact, or cross-phase test dependency couples
`p01` and `p02`, so the group is safe to declare.

---

## Phase 1: Consensus standalone recovery (cat 2)

### Task p01-t01: Add `~/.consensus/` fallback to the shared CLI resolver

**Files:**

- Modify: `src/consensus/core/consensus-loop.ts`
- Create: `tests/consensus/core/resolve-consensus-cli-path.test.ts`
- Modify (regenerated): `plugins/consensus/skills/*/scripts/*.mjs` (via `pnpm run build`)

**Step 1: Write test (RED)**

Add unit tests for `resolveConsensusCliPath` covering the resolution order with a
sandboxed `HOME` (and scrubbed `CONSENSUS_CLI_PATH`/`GIT_DIR`) so the real
`~/.consensus` is never read or written:

- explicit `consensusCliPath` arg wins
- `env.CONSENSUS_CLI_PATH` wins next
- plugin-relative `../../../scripts/consensus.mjs` used when it exists
- `~/.consensus/consensus.mjs` used when the plugin-relative path is absent but the shared file exists
- none-exist → resolution reports "missing" (consumed by p01-t02)

Run: `pnpm exec vitest run tests/consensus/core/resolve-consensus-cli-path.test.ts`
Expected: fails (RED) — fallback not yet implemented.

**Step 2: Implement (GREEN)**

Make resolution existence-aware: keep explicit arg and `CONSENSUS_CLI_PATH` as
highest priority, then prefer the plugin-relative path when it exists, then fall
back to `path.join(os.homedir(), '.consensus', 'consensus.mjs')` when it exists.
Node stdlib only (`os`, `path`, `fs`). Preserve existing behavior for plugin
installs (plugin-relative path present → unchanged).

Run: `pnpm exec vitest run tests/consensus/core/resolve-consensus-cli-path.test.ts`
Expected: passes (GREEN).

**Step 3: Refactor**

Keep the fallback path a single shared constant/helper so p01-t02, `install.sh`,
and tests all reference the same `~/.consensus/consensus.mjs` literal.

**Step 4: Verify**

Run: `pnpm run build && pnpm exec vitest run tests/consensus/core/resolve-consensus-cli-path.test.ts`
Expected: generated `.mjs` regenerated and in sync; tests green.

**Step 5: Commit**

```bash
git add src/consensus/core/consensus-loop.ts tests/consensus/core/resolve-consensus-cli-path.test.ts plugins/consensus/skills
git commit -m "feat(p01-t01): add ~/.consensus fallback to consensus CLI resolver"
```

> Note: this commit regenerates `.mjs` in all five consensus skill dirs; the
> lockstep version-bump gate (`validate:skill-versions`) is satisfied at the **p01
> push boundary after p01-t05**. Do not push individual mid-phase task commits.

---

### Task p01-t02: Centralize the actionable missing-CLI error across all five skills

**Files:**

- Modify: `src/consensus/core/consensus-loop.ts`
- Modify: `src/consensus/refine/consensus-refine.ts` (delegate preflight to the shared helper)
- Create: `tests/consensus/provider-cli/missing-cli-message.test.ts`
- Modify (regenerated): `plugins/consensus/skills/*/scripts/*.mjs`

**Step 1: Write test (RED)**

Add tests asserting that when no CLI resolves (no arg, no `CONSENSUS_CLI_PATH`, no
plugin-relative file, no `~/.consensus/consensus.mjs`), **each of the five
wrappers** (`refine`, `evaluate`, `decide`, `plan`, `create`) surfaces a single
shared `CONSENSUS_PROVIDER_CLI_MISSING` error whose message names both recovery
options (install the consensus plugin; run the pinned `install.sh`) and the README
pointer. Assert refine's preflight delegates to the shared helper rather than its
own copy.

Run: `pnpm exec vitest run tests/consensus/provider-cli/missing-cli-message.test.ts`
Expected: fails (RED).

**Step 2: Implement (GREEN)**

Move missing-CLI detection + the actionable `CONSENSUS_PROVIDER_CLI_MISSING`
message into the shared core resolution/invocation surface in
`consensus-loop.ts` (the path all five wrappers already call). Unify refine's
existing preflight (`consensus-refine.ts:2086`) to delegate to that shared helper.
Do not hand-edit generated `.mjs`.

Run: `pnpm exec vitest run tests/consensus/provider-cli/missing-cli-message.test.ts`
Expected: passes (GREEN) for all five wrappers.

**Step 3: Refactor**

Ensure the message text lives in one place (single source of truth) referenced by
both the shared helper and any preflight.

**Step 4: Verify**

Run: `pnpm run build && pnpm exec vitest run tests/consensus`
Expected: regenerated `.mjs` in sync; consensus suite green.

**Step 5: Commit**

```bash
git add src/consensus tests/consensus/provider-cli/missing-cli-message.test.ts plugins/consensus/skills
git commit -m "feat(p01-t02): centralize actionable missing-CLI error across all five consensus skills"
```

> Note: same version-gate timing as p01-t01 — the regenerated `.mjs` changes all
> five skill dirs; the bump gate is satisfied at the p01 push boundary after
> p01-t05, so don't push this commit on its own mid-phase.

---

### Task p01-t03: Add the pinned-fetch `install.sh` alternative installer

**Files:**

- Create: `install.sh`
- Create: `tests/consensus/install-sh.test.ts`

**Step 1: Write test (RED)**

Add a Vitest harness that runs `install.sh` with a sandboxed `HOME` and a mocked
pinned-fetch source, asserting: it writes `~/.consensus/consensus.mjs` from the
pinned ref; a subsequent `resolveConsensusCliPath` finds it; it is idempotent on
re-run; it fails clearly when the fetch/write cannot complete; in-checkout mode
copies the in-tree `plugins/consensus/scripts/consensus.mjs` without network.

Run: `pnpm exec vitest run tests/consensus/install-sh.test.ts`
Expected: fails (RED).

**Step 2: Implement (GREEN)**

Write `install.sh`: resolve the shared `consensus.mjs` (in-checkout copy preferred;
otherwise fetch from the pinned repo ref) and write it to `~/.consensus/`. POSIX
bash, Node-22-aware, idempotent, clear failure messaging. `bash -n install.sh`
must pass.

Run: `bash -n install.sh && pnpm exec vitest run tests/consensus/install-sh.test.ts`
Expected: passes (GREEN).

**Step 3: Refactor**

Keep the pinned ref and the `~/.consensus/consensus.mjs` target as named values so
the README and resolver reference the same contract.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/install-sh.test.ts`
Expected: green; no real `~/.consensus` written outside the sandbox.

**Step 5: Commit**

```bash
git add install.sh tests/consensus/install-sh.test.ts
git commit -m "feat(p01-t03): add install.sh alternative installer for consensus shared script"
```

---

### Task p01-t04: Document the alternative-install path + assert the cross-file contract

**Files:**

- Modify: `README.md`
- Create: `tests/consensus/install-contract.test.ts`

**Step 1: Author content**

Add an alternative-install section documenting the pinned `install.sh` one-liner
(`curl -fsSL https://raw.githubusercontent.com/tkstang/skills/<tag>/install.sh | bash`),
the current pinned ref, what it does (provisions `~/.consensus/consensus.mjs`), and
when to use it (a consensus skill installed standalone via skills.sh, without the
full plugin). Keep wording consistent with the runtime missing-CLI message.

**Step 2: Write the contract test (the real verification — design-review M1)**

`pnpm run validate` only asserts the *existing* README install section exists; it
does **not** check the new alternative-install contract. Add
`tests/consensus/install-contract.test.ts` that extracts the pinned ref and the
`~/.consensus/consensus.mjs` literal from `README.md` and asserts they match the
same values in `install.sh` and the resolver constant introduced in p01-t01
(Step 3). This makes the cross-file contract a real assertion instead of an
eyeball check — closing the silent-drift risk the design names.

**Step 3: Verify**

Run: `pnpm exec vitest run tests/consensus/install-contract.test.ts && pnpm run validate`
Expected: the contract test passes (README ↔ `install.sh` ↔ resolver agree on the
pinned ref and shared path); repository/doc invariants pass.

**Step 4: Commit**

```bash
git add README.md tests/consensus/install-contract.test.ts
git commit -m "docs(p01-t04): document install.sh alt-install path and assert cross-file contract"
```

---

### Task p01-t05: Rebuild runtimes and bump the five consensus skill versions

**Files:**

- Modify: `plugins/consensus/skills/{refine,evaluate,decide,plan,create}/SKILL.md` (version + metadata.version)
- Modify (regenerated): `plugins/consensus/skills/*/scripts/*.mjs`

**Step 1: Rebuild + bump**

Run `pnpm run build` to ensure all five generated `.mjs` bundles reflect the
`src/consensus` changes. Bump each changed consensus skill's `version` **and**
`metadata.version` in lockstep (`refine`/`evaluate` `0.1.1 → 0.1.2`;
`decide`/`plan`/`create` `0.1.0 → 0.1.1`). Confirm each skill is listed in
`SKILL_FILES` in `scripts/bump-version.mjs`.

**Step 2: Verify**

Run: `pnpm run build:check && pnpm run validate && pnpm run validate:skill-versions -- --base-ref origin/main && pnpm test`
Expected: generated outputs in sync; structure/version invariants pass (top-level
`version` == `metadata.version` for each; every changed skill dir has a bumped
version); full Vitest suite green.

**Step 3: Commit**

```bash
git add plugins/consensus/skills
git commit -m "chore(p01-t05): rebuild consensus runtimes and bump skill versions"
```

---

## Phase 2: Upstream handoff prompt (cat 3)

### Task p02-t01: Author the `open-agent-toolkit` internal-flag handoff prompt

**Files:**

- Create: `.oat/projects/shared/public-discovery/handoff/open-agent-toolkit-internal-flag-prompt.md`

**Step 1: Author content**

Write a self-contained agent prompt to run against the `open-agent-toolkit` repo
that:

- adds `metadata.internal: true` to the OAT tooling skill definitions at the pack
  source (the skills installed via `oat init` / `oat tools install` that land in
  this repo as `.agents/skills/**`)
- explains *why* upstream (a flag injected in this repo's synced mirror is
  overwritten on the next `oat sync`)
- names the affected skill set (the `oat-*` / core-pack tooling skills, not the
  standalone `skills/` or the consensus plugin)
- specifies the post-sync verification the change should produce:
  `npx skills add tkstang/skills --list` no longer surfaces `.agents/skills/**`,
  and `INSTALL_INTERNAL_SKILLS=1 … --list` shows them reappear

**Step 2: Verify**

Confirm (manual content check) the prompt is self-contained and names the target
repo, the exact flag, the affected skill set, and the verification commands. Note
in the prompt that the actual hiding outcome is a **deferred** follow-up for this
project (tracked against `BL-260621`), not a closure gate here.

**Step 3: Commit**

```bash
git add .oat/projects/shared/public-discovery/handoff/open-agent-toolkit-internal-flag-prompt.md
git commit -m "docs(p02-t01): add open-agent-toolkit upstream internal-flag handoff prompt"
```

---

## Phase 3: Verification & recording (cat 1 + skills.sh)

### Task p03-t01: Verify CLI discovery — standalone entries + consensus recovery

**Files:**

- Create: `.oat/projects/shared/public-discovery/verification/cli-discovery.md`

**Step 1: Verify discovery entries (remote `--list`)**

Run `npx skills add tkstang/skills --list` and confirm the discovery surface:

- `session-observer` and `export-session-transcript` are present and the only
  individually-installable standalone (`skills/`) entries
- the five consensus skills still appear (plugin-manifest discovery)

Note: `--list` resolves against the public remote's default branch, so it reflects
*discovery*, not this branch's recovery infra (which only lands at merge).

**Step 2: Verify recovery (local simulation)**

Simulate a standalone consensus skill dir with no plugin tree (and no
`~/.consensus/consensus.mjs`): confirm the run surfaces the actionable missing-CLI
message, then run `install.sh` and confirm the skill resolves the shared CLI from
`~/.consensus/consensus.mjs`. This local simulation is the only pre-merge
verification of the recovery path.

**Step 3: Record**

Capture both the `--list` output (discovery) and the local-simulation result
(recovery), pass/fail per check, into `verification/cli-discovery.md`.

**Step 4: Verify**

Run: `npx skills add tkstang/skills --list`
Expected: discovery entries match the recorded expectations; the Step 2 local
simulation demonstrates the recovery path.

**Step 5: Commit**

```bash
git add .oat/projects/shared/public-discovery/verification/cli-discovery.md
git commit -m "test(p03-t01): verify standalone + consensus CLI discovery and recovery"
```

---

### Task p03-t02: Verify and record skills.sh crawl/submission behavior

**Files:**

- Modify: `.oat/repo/pjm/backlog/items/BL-260621-control-public-skill-discovery.md`

**Step 1: Investigate**

Determine whether the skills.sh hosted index auto-crawls public repos or is
submission-gated, and whether the hosted crawler honors `metadata.internal` the
way the CLI does. Use the CLI/docs and a direct check of whether `tkstang/skills`
is indexed.

**Step 2: Record**

Append the finding to the backlog item's `## Findings`, choosing the listing
strategy accordingly, and explicitly note that the cat-3 hiding outcome remains
deferred to the post-upstream verification (do not claim a public listing before
the upstream `internal` flag lands and syncs).

**Step 3: Verify**

Confirm the backlog item records the crawl/submission determination and the
deferral note.

**Step 4: Commit**

```bash
git add .oat/repo/pjm/backlog/items/BL-260621-control-public-skill-discovery.md
git commit -m "docs(p03-t02): record skills.sh crawl/submission finding and cat-3 deferral"
```

---

## Reviews

{Track reviews here after running the oat-project-review-provide and oat-project-review-receive skills.}

{Keep both code + artifact rows below. Add additional code rows (p03, p04, etc.) as needed, but do not delete `spec`/`design`.}

| Scope  | Type     | Status          | Date       | Artifact                                              |
| ------ | -------- | --------------- | ---------- | ----------------------------------------------------- |
| p01    | code     | pending         | -          | -                                                     |
| p02    | code     | pending         | -          | -                                                     |
| p03    | code     | pending         | -          | -                                                     |
| final  | code     | pending         | -          | -                                                     |
| spec   | artifact | pending         | -          | -                                                     |
| design | artifact | fixes_completed | 2026-06-26 | reviews/archived/artifact-design-review-2026-06-26.md |
| plan   | artifact | received        | 2026-06-26 | reviews/artifact-plan-review-2026-06-26.md             |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

**Meaning:**

- `received`: review artifact exists (not yet converted into fix tasks)
- `fixes_added`: fix tasks were added to the plan (work queued)
- `fixes_completed`: fixes implemented / artifact findings resolved, awaiting re-review
- `passed`: re-review run and recorded as passing (no Critical/Important)

---

## Implementation Complete

**Summary:**

- Phase 1 (Consensus standalone recovery): 5 tasks — resolver fallback, shared actionable error, `install.sh`, README, rebuild + version bumps
- Phase 2 (Upstream handoff prompt): 1 task — `open-agent-toolkit` internal-flag prompt
- Phase 3 (Verification & recording): 2 tasks — CLI discovery verification, skills.sh finding

**Total: 8 tasks**

Ready for code review and merge.

---

## References

- Design: `design.md`
- Discovery: `discovery.md`
- Backlog: `.oat/repo/pjm/backlog/items/BL-260621-control-public-skill-discovery.md`
- Canonical resolver: `src/consensus/core/consensus-loop.ts`
- Generated-output build contract: `scripts/build-generated.mjs`, `CLAUDE.md`
