---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-sync-stale-top-level
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Bring stale top-level documentation surfaces back in sync with shipped reality

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

Six verified documentation staleness defects are fixed in one docs-accuracy pass: CHANGELOG's `[Unreleased]` catches up on ~3 weeks of shipped work; README lists the newest standalone skill; CONTRIBUTING stops telling contributors to use `npm` in a pnpm-pinned repo; the marketplace manifests stop describing the plugin as refine-only; the repository-layout doc gains `src/consensus/`; and the hand-written-scripts exception for `session-observer-collab` is documented instead of contradicting the stated generated-runtime contract. One shippable outcome: top-level docs match shipped state at the planned commit, verified by greppable assertions.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (docs/direction + deps/DX + architecture lanes), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Verified evidence (read live at planning time):
  - `CHANGELOG.md:1-13` — `[Unreleased]` lists only `consensus-create/decide/plan/panel`; missing: `phone-a-friend` (shipped 2026-06-28), `consensus config get/list/set/clear` (shipped 2026-07-03), `session-observer-collab` (PR #48, 2026-07-15) — cross-checked against `.oat/repo/pjm/backlog/completed.md` and git log.
  - `README.md:14` — standalone skills list names only `session-observer` and `export-session-transcript`; `.oat/repo/pjm/current-state.md` names `session-observer-collab` as part of the canonical public standalone set.
  - `CONTRIBUTING.md:16-21` — instructs `npm test` / `npm run validate` only; `package.json` pins `packageManager: pnpm@10.13.1`, and README/RELEASING consistently use `pnpm run …` across the fuller check set.
  - `.claude-plugin/marketplace.json:10` and `.cursor-plugin/marketplace.json:10` — describe the plugin as "Consensus deliberation skills for refining drafts…" while `plugins/consensus/.claude-plugin/plugin.json:4` lists all seven skills (docs lane; confirm strings in step 1).
  - `documentation/docs/engineering/repository-layout.md:10-14` — calls itself the single structural reference but omits `src/consensus/` (nine subdirectories on disk).
  - `skills/session-observer-collab/scripts/*.mjs` — hand-written (absent from `scripts/build-generated.mjs`'s `generatedOutputs`, zero grep matches), while AGENTS.md's generated-runtime section implies skill runtime `.mjs` comes from `src/` (architecture lane ARCH-07).

## Drift check

```bash
git diff --stat 8309623..HEAD -- CHANGELOG.md README.md CONTRIBUTING.md .claude-plugin/ .cursor-plugin/ documentation/docs/engineering/repository-layout.md AGENTS.md
```

Any of these files having changed means re-verifying its specific staleness claim before editing it — fix only what is still stale.

## Repository conventions

- Docs authoring contract: read `documentation/AGENTS.md` before touching anything under `documentation/` (navigation `## Contents` rules, `.md`-link convention, generated-index discipline).
- Never run formatters over `AGENTS.md`/`CLAUDE.md`; the root AGENTS.md `<!-- OAT tools -->` block is generated — edit outside it only.
- Marketplace manifests are hand-maintained JSON — keep both provider copies consistent.
- Validate: `npm run validate` (docs/manifest invariants); Test: `pnpm test` (some suites assert manifest/docs strings — failures there are signal, not noise).
- Commits: Conventional Commits (`docs: sync stale top-level surfaces`). Do not push or open a PR unless instructed.

## Scope

### In scope

- `CHANGELOG.md` `[Unreleased]`: three added bullets (phone-a-friend skill; `consensus config` subsystem; `session-observer-collab` skill), phrased from `backlog/completed.md` entries, matching the existing bullet style.
- `README.md`: add `session-observer-collab` to the standalone-skills mention with a one-line description matching `documentation/docs/user-guide/skills/index.md` phrasing.
- `CONTRIBUTING.md`: replace the npm commands with the pnpm verification sequence used by README/RELEASING (build, type-check, build:check, test, validate, smoke — mirror README's exact set).
- `.claude-plugin/marketplace.json` + `.cursor-plugin/marketplace.json`: sync plugin `description` to `plugins/consensus/.claude-plugin/plugin.json`.
- `documentation/docs/engineering/repository-layout.md`: add a `src/consensus/` bullet parallel to `src/transcript/`.
- Root `AGENTS.md` generated-runtime paragraph: one added sentence documenting `skills/session-observer-collab/scripts/` as deliberately hand-written (with `.d.ts` typing) and excluded from the generated pipeline — **only after step 1 confirms it is deliberate**.

### Out of scope

- Any code or manifest behavior change; version bumps (no `SKILL.md`/scripts content changes — docs at repo top level and the docs site only).
- Restructuring documentation navigation; README expansion beyond the one skill mention.
- Fixing DEPS-01 (docs app dependency alignment).

## Current state

- The `[Unreleased]` section format is: `### Added` bullets, one per skill/feature, past-shipped phrasing with defaults/flags named — mirror it.
- `session-observer-collab` context: shipped via PR #48 (2026-07-15); its docs page exists at `documentation/docs/user-guide/skills/session-observer-collab.md`.
- Whether hand-written scripts in that skill are deliberate is **unconfirmed** — check `.oat/repo/reference/` project summaries/decisions for the session-observer-collab project before documenting the exception.

## Implementation steps

### 1. Confirm the two unverified claims

(a) Read both marketplace.json files and the plugin.json description. (b) Search `.oat/repo/reference/` (project summaries, decisions) for the session-observer-collab implementation rationale — confirm hand-written runtime scripts were a deliberate choice.

**Verify:** both confirmed, or the affected sub-fix is dropped/reported (a non-deliberate ARCH-07 becomes a code finding to surface, not a doc note).

### 2. Apply the six edits

Make the edits listed in Scope. For the CHANGELOG, source facts from `.oat/repo/pjm/backlog/completed.md` (2026-06-28, 2026-07-03 entries) and the PR #48 summary; do not invent feature details.

**Verify (greppable assertions, all must pass):**

```bash
grep -q "phone-a-friend" CHANGELOG.md
grep -q "session-observer-collab" CHANGELOG.md
grep -q "consensus config" CHANGELOG.md
grep -q "session-observer-collab" README.md
! grep -n "npm test" CONTRIBUTING.md
grep -q "phone-a-friend" .claude-plugin/marketplace.json
grep -q "phone-a-friend" .cursor-plugin/marketplace.json
grep -q "src/consensus" documentation/docs/engineering/repository-layout.md
```

### 3. Run the contract

```bash
pnpm test && npm run validate
```

**Verify:** exit 0 — `validate.mjs` checks docs/manifest invariants, and test suites that assert manifest strings must still pass (if a test pins the old marketplace description, update the test with the fix in the same commit).

## Test plan

- No new tests. The verification boundary is the greppable assertion set (step 2) plus `npm run validate` and `pnpm test` (existing string-contract suites are the regression net).

## Done criteria

- [ ] All eight grep assertions pass.
- [ ] `pnpm test && npm run validate` pass.
- [ ] The AGENTS.md exception sentence exists only if step 1 confirmed deliberateness; otherwise the finding was reported instead.
- [ ] `git status --short` shows only the six (or fewer, per step 1) documentation surfaces.

## STOP conditions

- Step 1 finds no evidence the hand-written scripts are deliberate — report ARCH-07 as an open architecture question instead of documenting it as intended.
- A shipped-feature fact needed for the CHANGELOG cannot be confirmed from `completed.md`/git history (do not guess feature details).
- `pnpm test` failures unrelated to pinned doc strings (report; docs sweep must not absorb code fixes).

## Review focus

- CHANGELOG phrasing accuracy against what actually shipped (reviewers: spot-check against `backlog/completed.md`).
- Marketplace JSON stays valid and both provider copies identical in meaning.
- Deferred intentionally: TEST-05's smoke-scope note (one sentence in AGENTS.md/RELEASING, foldable here if trivial — optional), deeper README refresh.
