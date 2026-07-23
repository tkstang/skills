---
review_type: phase-code-review
wave: wave-2-execution
phase: p03
branch: wave-2/p03
commit: 2e52beb
base: df9b899
contract: .oat/repo/reference/external-plans/2026-07-17-skill-files-disk-derivation.md
reviewer: claude-code (read-only phase reviewer)
date: 2026-07-23
verdict: PASS
---

# p03 code review — derive bump-version's skill list from disk

## Verdict: PASS

## Summary

`scripts/bump-version.mjs` no longer hardcodes `SKILL_FILES`; it now derives the
list from disk at module load via a new shared module,
`scripts/lib/discover-skills.mjs`, which `scripts/validate.mjs` also imports
(re-exporting `discoverSkillDirectories` for `scripts/validate-skill-versions.mjs`'s
existing import path). The discovery boundary is provably scoped to
`skills/*/SKILL.md` and `plugins/*/skills/*/SKILL.md` under the repo root and does
not reach `.agents/`, `.claude/`, `.cursor/` mirrors (those are sibling top-level
dirs, never touched by the two `listSubdirectories` calls) or any test fixtures
(none exist under those roots). Ordering is deterministic (`.toSorted()` twice —
once per source list, once on the merged/deduped result by relative-path
`localeCompare`). `tests/release/versioning.test.ts` gained an independent glob
(no shared code with `discover-skills.mjs`) that asserts `SKILL_FILES` equals the
independently-globbed set, plus a snapshot pin listing exactly the current 10
paths. AGENTS.md's `SKILL_FILES` maintenance sentence (line 36) was rewritten to
describe the derived mechanism; nothing else in AGENTS.md changed. All commands
specified in the contract and my own destructive spot-check (temporarily adding a
fake skill directory) behaved as expected; full test/validate suites are green in
the worktree.

One deviation from the review brief's literal expectation: the rewritten
`tests/repo/skill-frontmatter.test.ts` assertion checks `SKILL_FILES.toContain(...)`
for only the same 2 paths (`panel`, `session-observer-collab`) the old
source-grep checked — not all 10 paths. This is behaviorally equivalent (not
strictly "≥") to the old test, but it is not a functional gap: system-wide
completeness is still pinned by `tests/release/versioning.test.ts`'s snapshot
(verified below to actually fail on a missing/added skill), and
`skill-frontmatter.test.ts` was not in the plan's "In scope" list to begin with.
Logged as a low-severity note, not a blocker.

## Checklist (contract: Review focus + Done criteria)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Discovery boundary excludes `.agents/`/`.claude/`/`.cursor/` mirrors and test fixtures | PASS | `scripts/lib/discover-skills.mjs` only walks `path.join(root,'skills')` and `path.join(root,'plugins',*,'skills')`; repo has no fixtures under those roots (`find . -path "*/fixtures/*SKILL.md"` empty). `.agents`/`.claude`/`.cursor` are separate top-level dirs, structurally unreachable from these two roots. |
| 2 | Deterministic sorted ordering | PASS | `listSubdirectories` sorts (`.toSorted()`) at each level; `discoverSkillDirectories` sorts the deduped result again by `path.relative(root,...).localeCompare(...)`. `bump-version.mjs` maps this already-sorted array 1:1 to `SKILL.md` paths — order preserved. Verified output is alphabetically sorted (see command output below). |
| 3 | `JSON_FILES`/manifest lists left untouched (plan defers them) | PASS | `git diff df9b899...wave-2/p03 -- scripts/bump-version.mjs` shows `PROVIDER_MANIFESTS`/`MARKETPLACE_MANIFESTS` (the only manifest-list exports in this file) unchanged; diff is scoped entirely to the `SKILL_FILES` block. |
| 4 | Discovery genuinely shared, not duplicated — `validate.mjs` imports the lib, no residual copy | PASS | `scripts/validate.mjs` diff removes its local `discoverSkillDirectories`/`listSubdirectories` implementation and replaces with `import { discoverSkillDirectories } from './lib/discover-skills.mjs'; export { discoverSkillDirectories };`. `grep -n "readdir\|stat\b" scripts/validate.mjs` shows those imports are still used elsewhere in the file (line-level structural checks), not for skill discovery — no dead/duplicate logic left. |
| 5 | `validate-skill-versions.mjs` still works via re-export | PASS | It imports `discoverSkillDirectories` from `./validate.mjs` (unchanged import path) — works because `validate.mjs` now re-exports it. Ran `node scripts/validate-skill-versions.mjs --base-ref df9b899` in the worktree → `skill-version validation: no changed skills relative to df9b899` (exit 0), as expected since this diff touches no skill directories. |
| 6 | `versioning.test.ts`'s independent glob is genuinely independent (separate implementation) | PASS | `globSkillMarkdownFiles()` in the test file re-implements directory listing with its own `readdir`/`stat` calls and does not import `scripts/lib/discover-skills.mjs` or `scripts/validate.mjs`; only imports `bump-version.mjs`'s `SKILL_FILES` value for comparison. Comment in the test explicitly documents the independence rationale. |
| 7 | Snapshot pin lists exactly the 10 current paths | PASS | Test snapshot in `versioning.test.ts` lists exactly the 10 paths matching `node -e "...SKILL_FILES..."` output (see command output below) — same 10 skills, same sort order. |
| 8 | `tests/repo/skill-frontmatter.test.ts` rewritten test: asserts derived `SKILL_FILES` contents (all 10 incl. panel + session-observer-collab), behaviorally ≥ old source-grep | PARTIAL (non-blocking) | Rewritten test imports `SKILL_FILES` from `bump-version.mjs` and asserts `.toContain('plugins/consensus/skills/panel/SKILL.md')` and `.toContain('skills/session-observer-collab/SKILL.md')` — same 2 paths the old grep-based test checked, not all 10. Behaviorally equivalent to (not stronger than) the old test in this file alone, but the "missing skill still fails" property holds for those 2, and full-set completeness is independently and more strongly pinned by `versioning.test.ts`'s snapshot (verified to fail on a fake-skill addition, see below). File not listed in plan's "In scope" section. See Finding F1. |
| 9 | AGENTS.md: exactly one sentence changed (SKILL_FILES rule); p04-reserved format-exclusions sentence (~line 85) and wave-1 collab sentence untouched; no reformatting | PASS | `git diff --stat` shows `AGENTS.md \| 2 +-` (1 line removed, 1 added = single sentence replaced). Line 83 (format-exclusions, `p04-reserved`) unchanged and not adjacent to the edit; diff hunk is a single-line, non-reformatted replacement (line-for-line, no wrapping/whitespace changes visible). |
| 10 | `npx vitest run tests/release/versioning.test.ts tests/repo/skill-frontmatter.test.ts` green | PASS | Ran in worktree: `Test Files 2 passed (2)`, `Tests 30 passed (30)`. |
| 11 | `node -e "import('./scripts/bump-version.mjs').then(m=>console.log(m.SKILL_FILES.length))"` → 10 | PASS | Ran in worktree: printed `10`. |
| Done | No hardcoded skill path list remains in `bump-version.mjs` | PASS | `SKILL_FILES` is computed via `discoverSkillDirectories(...).map(...)`; no literal array of skill paths remains. |
| Done | Discovery shared with (not duplicated from) validator contract | PASS | Single implementation in `scripts/lib/discover-skills.mjs`, imported by both `bump-version.mjs` and `validate.mjs` (re-exported for `validate-skill-versions.mjs`). |
| Done | Completeness pin fails on any skill-set change until deliberately updated | PASS | Verified live: added `skills/tmp-fake-skill-p03review/SKILL.md`, ran `versioning.test.ts` → snapshot test failed showing the new path in the diff (then removed the fixture; `git status --short` clean afterward). |
| Done | AGENTS.md no longer instructs manual list maintenance; full contract passes | PASS | Sentence rewritten (see #9). `pnpm test` (1114 passed / 1 skipped) and `npm run validate` (`validation passed`) both green in the worktree. |

## Findings

### F1 — LOW / non-blocking: `skill-frontmatter.test.ts` correction checks only 2 of 10 derived paths, not the full set

- **File:** `tests/repo/skill-frontmatter.test.ts:326-330`
- **Evidence:**
  ```js
  it('standalone and plugin skills are included in version bump tooling', () => {
    // SKILL_FILES is derived from disk (scripts/lib/discover-skills.mjs), so
    // this checks the resulting set rather than grepping the script source.
    expect(SKILL_FILES).toContain('plugins/consensus/skills/panel/SKILL.md');
    expect(SKILL_FILES).toContain('skills/session-observer-collab/SKILL.md');
  });
  ```
- **Why it's low severity / not a fix requirement:** The pre-existing test (removed
  in this diff) only grepped the script source for these same 2 literal path
  strings, so the rewritten version is a faithful, minimal, behavior-preserving
  correction of a test that broke because the literal strings no longer exist in
  `bump-version.mjs`'s source. It is not weaker than before. Full completeness
  (all 10 paths, and detection of any addition/removal) is independently and more
  rigorously pinned in `tests/release/versioning.test.ts` (both the
  cross-checked-against-an-independent-glob test and the 10-path snapshot), which
  I verified actually fails when a skill is added. `tests/repo/skill-frontmatter.test.ts`
  was not listed in the plan's "In scope" section, so expanding its assertions
  further was optional, not required by the contract.
- **Suggested follow-up (optional, not required for this phase to pass):** if a
  future maintainer wants a second line of defense specifically in this file, it
  could be changed to `expect([...SKILL_FILES].toSorted()).toEqual([...all 10...])`
  to mirror the versioning.test.ts snapshot, but this would be pure duplication of
  an already-covered invariant.

No other findings. No correctness bugs, no discovery-boundary leaks, no
ordering nondeterminism, no dead code, no scope creep into `JSON_FILES`/manifest
lists, no unauthorized AGENTS.md edits.

## Commands run (worktree: `.worktrees/wave-2/p03`)

```
$ node -e "import('./scripts/bump-version.mjs').then(m=>{console.log(m.SKILL_FILES.length); console.log(JSON.stringify(m.SKILL_FILES,null,2));})"
10
[
  "plugins/consensus/skills/create/SKILL.md",
  "plugins/consensus/skills/decide/SKILL.md",
  "plugins/consensus/skills/evaluate/SKILL.md",
  "plugins/consensus/skills/panel/SKILL.md",
  "plugins/consensus/skills/phone-a-friend/SKILL.md",
  "plugins/consensus/skills/plan/SKILL.md",
  "plugins/consensus/skills/refine/SKILL.md",
  "skills/export-session-transcript/SKILL.md",
  "skills/session-observer/SKILL.md",
  "skills/session-observer-collab/SKILL.md"
]

$ node scripts/validate-skill-versions.mjs --base-ref df9b899
skill-version validation: no changed skills relative to df9b899

$ npx vitest run tests/release/versioning.test.ts tests/repo/skill-frontmatter.test.ts
Test Files  2 passed (2)
     Tests  30 passed (30)

$ pnpm test
Test Files  108 passed | 1 skipped (109)
     Tests  1114 passed | 1 skipped (1115)

$ npm run validate
validation passed

# Destructive spot-check (fixture removed immediately after):
$ mkdir -p skills/tmp-fake-skill-p03review && printf -- '---\nname: tmp-fake-skill-p03review\n---\ntest\n' > skills/tmp-fake-skill-p03review/SKILL.md
$ npx vitest run tests/release/versioning.test.ts
# → 3 failed (both SKILL_FILES-consistency tests, plus a knock-on failure in the
#   unrelated bumpVersion-against-repo test because the fixture root now diverges
#   from the fixed skillFiles list used to build the temp fixture — expected, not
#   a bug), diff showed "+ skills/tmp-fake-skill-p03review/SKILL.md" being picked up
$ rm -rf skills/tmp-fake-skill-p03review
$ git status --short   # clean
```
