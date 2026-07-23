---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-derive-bump-version-skill-list
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Derive bump-version's skill list from disk so a new skill cannot miss release bumps

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

`scripts/bump-version.mjs` no longer depends on a hand-maintained `SKILL_FILES` array to know which `SKILL.md` files to bump at release time. Today the list is the only skill enumeration in the repo that is *not* derived from disk (`validate.mjs` and `validate-skill-versions.mjs` both scan), AGENTS.md documents keeping it current as a manual step, and its own test asserts against the same hardcoded constant — so a forgotten entry ships a skill with a stale version and nothing flags it. After this plan, the skill set is discovered from disk (the same discovery contract the validators use), and a test pins the discovery against the known set so unexpected additions/removals are visible.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (architecture + tests lanes), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Verified evidence (read live at planning time):
  - `scripts/bump-version.mjs:18-29` — `export const SKILL_FILES = [...]` hardcodes 10 `SKILL.md` paths. **Currently complete** (all 10 shipped skills present, including `session-observer-collab`) — the finding is the unguarded mechanism, not present drift.
  - `scripts/validate.mjs:73-97` — `discoverSkillDirectories` derives skills from disk (`SKILL.md` under `skills/` and `plugins/*/skills/`).
  - `scripts/validate-skill-versions.mjs` — independently derives skills from disk (AGENTS.md states this explicitly).
  - `tests/release/versioning.test.ts` — imports the hardcoded constant and asserts self-consistency, not completeness (tests-lane claim; confirm in step 1).

## Drift check

```bash
git diff --stat 8309623..HEAD -- scripts/bump-version.mjs scripts/validate.mjs tests/release/
```

If `SKILL_FILES` was already replaced or a new skill was added, reassess: the plan may already be done or the list may now be stale — reconcile before editing.

## Repository conventions

- Test: `pnpm test`; release suites live under `tests/release/`
- Validate: `npm run validate`; version gate: `pnpm run validate:skill-versions -- --base-ref main`
- `scripts/` are dev tooling (Node stdlib only by practice; keep it dependency-free)
- AGENTS.md documents the `SKILL_FILES` maintenance rule — update that sentence when the mechanism changes (AGENTS.md edits are fine; only the `<!-- OAT tools -->` generated block is off-limits, and never run formatters over AGENTS.md).
- Commits: Conventional Commits (`refactor(release): derive skill files from disk`). Do not push or open a PR unless instructed.

## Scope

### In scope

- `scripts/bump-version.mjs`: replace the hardcoded array with disk discovery; keep the exported name/shape so `--check-tag` and consumers keep working.
- `tests/release/versioning.test.ts` (or a sibling): a completeness pin.
- The AGENTS.md sentence describing the manual `SKILL_FILES` step.

### Out of scope

- `JSON_FILES`/manifest lists in the same script (different contract — only touch if trivially derivable the same way; otherwise leave).
- Changing which files a version bump edits or the bump semantics.
- The validators' own discovery code.

## Current state

- `bumpVersion` and `--check-tag` iterate `SKILL_FILES` to rewrite/check frontmatter versions in each `SKILL.md`.
- Discovery must exclude non-shipped skill locations: `.agents/`, `.claude/`, `.cursor/` mirrors are non-canonical (AGENTS.md), and `skills/` + `plugins/*/skills/` are the canonical roots — exactly what `discoverSkillDirectories` in `validate.mjs:73-97` already encodes.
- `validate.mjs` is an ESM module; check whether its discovery function is exported/importable. If not, exporting it (or extracting a tiny shared `scripts/lib/discover-skills.mjs`) is in scope.

## Implementation steps

### 1. Confirm the test gap and consumer surface

Read `tests/release/versioning.test.ts` usage of `SKILL_FILES`, and `grep -rn "SKILL_FILES" scripts/ tests/` for all consumers.

**Verify:** consumer list recorded; no consumer needs the literal array shape beyond an iterable of repo-relative paths.

### 2. Share the discovery

Export the discovery from `validate.mjs` (or extract `scripts/lib/discover-skills.mjs` used by both) and have `bump-version.mjs` compute `SKILL_FILES` from it at module load (sorted, repo-relative, stable order for deterministic diffs).

**Verify:** `node -e "import('./scripts/bump-version.mjs').then(m => console.log(m.SKILL_FILES))"` prints the same 10 paths as the previous hardcoded list, sorted.

### 3. Pin completeness in tests

Replace/augment the self-referential assertion with: (a) discovered set equals the set derived independently in the test by globbing `skills/*/SKILL.md` and `plugins/*/skills/*/SKILL.md`; (b) a snapshot-style assertion of the current 10 names so any skill addition/removal shows up as an explicit, reviewable test diff.

**Verify:** `pnpm test -- tests/release/versioning.test.ts` → passes; temporarily creating `skills/tmp-fake/SKILL.md` makes it fail (then delete the scratch dir).

### 4. Update AGENTS.md and run the contract

Rewrite the AGENTS.md sentence that instructs maintainers to hand-update `SKILL_FILES` to describe the derived mechanism instead. Then:

```bash
pnpm test && npm run validate && pnpm run validate:skill-versions -- --base-ref main
```

**Verify:** all exit 0; `git status --short` shows only `bump-version.mjs`, `validate.mjs` (or the new lib), the test, and AGENTS.md.

## Test plan

- Updated `tests/release/versioning.test.ts` per step 3 (pattern: existing release suites run real functions against the repo tree).
- Regression proven: a skill added without appearing in the bump set is impossible (derived) and visible (snapshot pin).
- Focused: `pnpm test -- tests/release/` → pass. Full: `pnpm test` → pass.

## Done criteria

- [ ] No hardcoded skill path list remains in `bump-version.mjs`.
- [ ] Discovery is shared with (not duplicated from) the validator contract.
- [ ] Completeness pin fails on any skill-set change until deliberately updated.
- [ ] AGENTS.md no longer instructs manual list maintenance; full contract passes.

## STOP conditions

- Discovery from `validate.mjs` and `validate-skill-versions.mjs` disagree about what counts as a skill (report the contract conflict first).
- A consumer depends on `SKILL_FILES` ordering or literal content in a way derivation breaks.
- Any verification gate fails twice after one bounded correction.

## Review focus

- The discovery boundary: must not pick up `.agents/`/`.claude/`/`.cursor/` mirrors or test fixtures.
- Deterministic ordering (sorted) so release diffs stay stable.
- Deferred intentionally: deriving `JSON_FILES`/manifest lists the same way — note as follow-up if inspection shows it is equally mechanical.
