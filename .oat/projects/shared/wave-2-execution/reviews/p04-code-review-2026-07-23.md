---
review_type: phase-code-review
wave: wave-2-execution
phase: p04
branch: wave-2/p04
commit: 2d3ba9e
base: 3ad6b84614fb5dcb6cc42fe08b2a466aa942a3ae
contract: .oat/repo/reference/external-plans/2026-07-17-derive-generated-ignore-lists.md
reviewer: claude-code (read-only phase reviewer)
date: 2026-07-23
verdict: PASS
---

# p04 code review — derive generated-output import rewrites from source imports

## Verdict: PASS

## Summary

The implementer shipped step 3 of the plan (`deriveImportRewrites` in
`scripts/build-generated.mjs`) in full, and consciously skipped step 2 (a new
`tests/tooling/generated-ignore-lists.test.ts` file), citing pre-existing
equivalent coverage in `tests/tooling/generated-output-sync.test.ts`'s
`'excludes generated outputs from static lint and format configs'` test. I
verified that claim directly rather than taking it on faith (see Deviation
Judgment below) and it holds up: the existing test asserts exactly the
property the plan's Outcome section demands, and a live negative check
(temporarily deleting an `.oxlintrc.json` entry in the worktree) fails as
expected, then the worktree was restored clean. All 14 of the plan's original
hand-transcribed `importRewrites` arrays are now derived and byte-identical
(`pnpm run build && pnpm run build:check` shows every mapping "in sync" with
zero `git status --short` diff). The parser's two documented failure modes
(unresolvable specifier, ambiguous fan-out tie) both throw loudly per the
plan's Review focus, and are exercised by new focused tests. The
`mapping.importRewrites ?? deriveImportRewrites(...)` fallback at
`scripts/build-generated.mjs:431` preserves the plan's STOP escape hatch for
any future entry where derivation and hand-writing diverge — no entry
currently uses it, matching the "byte-equivalent for all 14" claim.
AGENTS.md's diff is exactly the single format-exclusions sentence the plan
targeted; p03's `SKILL_FILES` sentence (line 36) and the wave-1 collab
boundary sentence (line 39) are untouched. The rewritten
`'resolves wrapper loop imports...'` test now asserts against the committed
generated artifact rather than a static `importRewrites` field — a
necessary and appropriately-scoped adjustment given the field no longer
exists on 5 of the 6 wrapper mappings, and it still asserts genuine rewrite
correctness (see checklist #7). Full contract (`pnpm test`, `npm run
validate`) is green in the worktree; no SKILL.md changes; no `.oat/projects`
writes; commit message is a well-formed Conventional Commit.

One non-blocking design note from reasoning through the fan-out
disambiguation heuristic (`pickImportRewriteTarget`): directory-proximity
scoring is provably correct for all 6 real fan-out consumers today (see
Finding F1), but the heuristic's correctness assumption — that a mapping's
own output directory is never nested inside a *different* skill's directory
subtree — is not enforced anywhere. A future generatedOutputs entry that
violates it could get a wrong-but-non-tied pick silently (no throw). This
doesn't affect the current 28 entries and isn't a fix requirement for this
phase, but is worth flagging for future entries.

## Deviation judgment: citing existing coverage instead of adding the plan's step-2 test file

**Verdict: legitimate, non-narrowing satisfaction of the plan's Outcome — not a scope miss.**

The plan's Outcome section states the target property in one sentence: "a
tooling test fails whenever `.oxfmtrc.json` or `.oxlintrc.json`
`ignorePatterns` misses a generated output path." It does not say the test
must live in a *new* file — step 2's file name
(`tests/tooling/generated-ignore-lists.test.ts`) is an implementation
suggestion inside an "Implementation steps" section that is explicitly
subordinate to the Outcome. I read the plan's own Evidence section and
confirmed it never inventories the pre-existing `generated-output-sync.test.ts`
file's test cases beyond the CI-derivation ones — it's a stale premise typical
of a plan drafted from a repo-audit summary rather than a full read of the
target test file, exactly as the implementer's commit message argues.

Verification performed directly (not delegated to the implementer's claim):

- **(a) The existing test genuinely asserts the property.** Read
  `tests/tooling/generated-output-sync.test.ts:271-288`
  (`'excludes generated outputs from static lint and format configs'`): it
  builds `generatedOutputPaths = generatedOutputs.map(m => m.output)` (every
  entry uses singular `output`, confirmed no entry uses a plural `outputs`
  array), reads both `.oxfmtrc.json` and `.oxlintrc.json`, and for every path
  in `generatedOutputPaths` asserts `expect(oxfmt.ignorePatterns).toContain(output)`
  **and** `expect(oxlint.ignorePatterns).toContain(output)`. This is the exact
  bidirectional, per-path assertion the plan's step 2 describes ("assert every
  output path appears in each `ignorePatterns`").
- **(b) It fails when an entry is removed — reproduced live, not trusted.** In
  the worktree, I removed
  `"plugins/consensus/skills/refine/scripts/consensus-refine.mjs"` from
  `.oxlintrc.json`'s `ignorePatterns`, ran
  `npx vitest run tests/tooling/generated-output-sync.test.ts -t "excludes generated outputs from static lint and format configs"`,
  and got a failure: `AssertionError: expected [...] to include
  'plugins/consensus/skills/refine/scrip…'`. I then ran `git checkout --
  .oxlintrc.json` and confirmed `git status --short` was clean, and reran the
  test to confirm it passes again post-restore.
- **(c) Judgment.** The plan's own Test plan section names
  `generated-output-sync.test.ts` as "the regression net for step 3" but is
  silent on whether it also already covers step 2's guard property — it
  doesn't rule it out either. Given (a) and (b) both hold, adding a second,
  near-duplicate test file asserting the identical property would be pure
  redundancy, not a stronger guarantee. This satisfies the plan's Outcome
  without narrowing it. I judge this a legitimate deviation, correctly
  reasoned and correctly verified by the implementer (and independently
  reverified by me), not a scope miss requiring rework.

## Checklist (contract: Review focus + Done criteria + STOP conditions)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Step 3 byte-equivalence proof: build diff is empty | PASS | `pnpm run build` → 28/28 "wrote"; `pnpm run build:check` → 28/28 "in sync"; `git status --short` → empty, both before and after. |
| 2 | Unresolvable specifier → loud build error, never silent skip | PASS | `deriveImportRewrites` throws `` `Import rewrite derivation for ${mapping.id} found module specifier '${specifier}' resolving to '${resolvedSource}', which has no generatedOutputs entry...` `` (`scripts/build-generated.mjs:375-379`) when `candidates.length === 0`; exercised by the new test `'throws loudly instead of silently skipping an unresolvable relative specifier'`. |
| 3 | Ambiguous fan-out tie → loud build error, never a guess | PASS | `pickImportRewriteTarget` throws when `tied` is true after scoring (`scripts/build-generated.mjs:349-355`); exercised by the new test `'throws loudly instead of guessing when multiple fan-out candidates are equally close'` using a synthetic mapping whose output dir shares no prefix with any of the 6 consensus-config candidates (genuine 0-score 6-way tie, confirmed by manual path-segment trace). |
| 4 | `mapping.importRewrites ?? derive` fallback preserves the STOP escape hatch | PASS | `scripts/build-generated.mjs:430-431`: `const rewrites = mapping.importRewrites ?? deriveImportRewrites(mapping, text);`. No entry in the current 28-entry `generatedOutputs` array retains a hand-written `importRewrites` field (`grep -n "importRewrites:" scripts/build-generated.mjs` inside the array body returns nothing) — consistent with the claim that all 14 previously-hand-written entries matched derivation exactly. |
| 5 | Fan-out disambiguation correctness (consensus-config 6-way, runtimes 2-way) | PASS, with a non-blocking design note | See Finding F1 below: traced both real fan-outs by hand; proximity scoring picks the correct sibling in every real case because each consuming skill's own copy always shares a strictly longer directory prefix with the importer than any other skill's copy does (skill name is a literal path segment in both). Constructed one hypothetical adversarial layout where a *future* entry nested inside a different skill's directory tree could get a wrong-but-non-tied silent pick — not a live bug in the current 28 entries. |
| 6 | AGENTS.md: exactly the format-exclusions sentence changed | PASS | `git diff --stat` shows `AGENTS.md \| 2 +-` (one sentence replaced, single hunk). Line 36 (p03's `SKILL_FILES` sentence) and line 39 (wave-1's collab-boundary sentence) both grepped and confirmed unchanged/present verbatim. |
| 7 | Updated `'resolves wrapper loop imports...'` test still meaningfully asserts rewrite correctness | PASS | Now reads the committed generated `.mjs` artifact and regex-matches the rewritten specifier, then resolves it to a `file://` URL and compares against the shared loop file's own URL — this asserts the *actual emitted, committed* rewrite target resolves to the correct file, which is equivalent in strength to the old static-field assertion (arguably stronger: it exercises the real build output, not just the data structure that fed it) and is a necessary adjustment since the `importRewrites` field this test previously read no longer exists on 5 of 6 wrapper mappings. |
| 8 | The 3 new tests assert what's claimed | PASS | `'derives importRewrites from emitted module specifiers for a real mapping'` — feeds `consensus-refine`'s real two-import shape into `deriveImportRewrites`, asserts the exact array that was previously hand-written for it. `'throws loudly instead of silently skipping...'` and `'throws loudly instead of guessing...'` — both verified in #2/#3 above by manual trace of the scoring/candidate logic, not just reading the assertion. |
| 9 | DoD green | PASS | `npx vitest run tests/tooling/` → 3 files / 24 tests passed. `pnpm test` → 110 files / 1134 tests passed, 1 skipped, 0 failed. `npm run validate` → `validation passed`. |
| 10 | No SKILL.md changes | PASS | `git diff --name-only` for the phase touches only `AGENTS.md`, `scripts/build-generated.mjs`, `tests/tooling/generated-output-sync.test.ts`. |
| 11 | Conventional commit | PASS | `refactor(p04-t01): derive generated-output import rewrites from source imports`. |
| 12 | No `.oat/projects` writes | PASS | `git diff --name-only ... \| grep '^.oat/projects'` → empty. |
| 13 | Out-of-scope files untouched (`.lintstagedrc.mjs`, CI workflow, both JSON ignore lists themselves) | PASS | `git diff ... -- .lintstagedrc.mjs .github/workflows/validate.yml .oxfmtrc.json .oxlintrc.json` → empty. |
| Done | Guard test fails on any missing generated path in either ignore list | PASS (via pre-existing test, see Deviation judgment) | Live negative check reproduced above. |
| Done | `importRewrites` hand-lists removed where derivation is byte-equivalent; generated outputs unchanged | PASS | All 14 removed; `pnpm run build:check` zero-diff confirms byte-equivalence. |
| Done | AGENTS.md reflects the new mechanism; full contract passes; `git status --short` clean of unexplained files | PASS | See #6, #9. |
| STOP | Derived rewrites differ from hand-written for any entry | Not triggered | Confirmed via build:check zero-diff; no entry retains a hand-written override. |
| STOP | JSON ignore lists rely on glob semantics the guard can't check simply | Not triggered | `generatedOutputPaths` are checked with `toContain` (exact string), matching the existing test's own `TODO(generated-output)` comment noting glob-awareness would need to be added only if globs were introduced; current lists use literal paths only (confirmed by reading both JSON files' `ignorePatterns` arrays). |
| STOP | Verification gate failed twice after one correction | Not triggered | All gates green on first run in review. |

## Finding F1 (informational, non-blocking) — fan-out proximity heuristic assumes no cross-skill directory nesting

- **File:** `scripts/build-generated.mjs:337-357` (`pickImportRewriteTarget`)
- **What I checked:** Traced the directory-prefix scoring by hand for both real
  fan-out sources:
  - `src/consensus/config/consensus-config.ts` → 6 outputs, one per consensus
    skill (`create`/`decide`/`plan`/`refine`/`evaluate`/`panel`). For every
    importer (e.g. `consensus-refine.mjs`, output dir
    `plugins/consensus/skills/refine/scripts`), its own skill's copy scores a
    full 5-segment match; every other skill's copy scores 3 (mismatch at the
    skill-name segment). No ties, always correct.
  - `src/transcript/core/runtimes.ts` → 2 outputs (session-observer,
    export-session-transcript). Same pattern: own-skill copy always wins
    because the skill-name directory segment is shared with the importer's own
    output path, and diverges from the other skill's path at that same
    segment index.
- **Why it's correct today but not provably correct in general:** The
  heuristic's implicit assumption is "the correct sibling is co-located with
  (or a descendant of) the importer's own output directory, and no candidate
  belonging to a *different* logical skill is closer." This holds for all 28
  current entries because every skill's outputs live under its own
  `skills/<name>/` or `plugins/consensus/skills/<name>/` subtree with no
  cross-nesting. Constructed adversarial counterexample (hypothetical, not
  present in the repo): if a future mapping's own output were nested *inside*
  a different skill's directory tree (e.g.
  `plugins/consensus/skills/evaluate/legacy/refine/scripts/x.mjs` for a
  logically-"refine" mapping that got filed under `evaluate/legacy/` for some
  organizational reason), while its true intended sibling lives at
  `plugins/consensus/skills/refine/scripts/consensus-config.mjs`, the wrong
  sibling (`evaluate`'s own copy) would score higher (4 matching segments)
  than the correct one (3 matching segments, diverging at the skill-name
  segment) — a clean, non-tied win for the wrong candidate, so no throw. This
  is a latent design gap, not a live bug: no such layout exists today, and any
  future entry that did introduce it would immediately fail
  `pnpm run build:check`'s existing regression net for *known-correct* prior
  entries but would **not** be caught for the *new* mismatched entry itself,
  since there's no independent ground truth for a brand-new mapping.
- **Recommendation (optional follow-up, not required to pass this phase):** if
  a future generatedOutputs entry is ever added whose own output directory is
  nested under a different skill's subtree, add an explicit `importRewrites`
  override for it rather than relying on directory-proximity, or tighten
  `pickImportRewriteTarget` to require the skill-name segment (not just
  longest-common-prefix) to match before considering a candidate "closer."

No other findings. No correctness bugs, no silent-skip failure modes, no
unauthorized scope creep, no test weakening beyond the one deliberate and
justified adjustment (#7 above).

## Commands run (worktree: `.worktrees/wave-2/p04`)

```
$ git status --short
# (clean, HEAD = 2d3ba9e)

$ npx vitest run tests/tooling/generated-output-sync.test.ts -t "excludes generated outputs from static lint and format configs"
Test Files  1 passed (1)
     Tests  1 passed | 17 skipped (18)

# Live negative check: remove one generated-output path from .oxlintrc.json
$ python3 -c "... data['ignorePatterns'].remove('plugins/consensus/skills/refine/scripts/consensus-refine.mjs') ..."
$ npx vitest run tests/tooling/generated-output-sync.test.ts -t "excludes generated outputs from static lint and format configs"
FAIL tests/tooling/generated-output-sync.test.ts > generated output drift guard > excludes generated outputs from static lint and format configs
AssertionError: expected [ 'node_modules/', '.oat/', …(32) ] to include 'plugins/consensus/skills/refine/scrip…'
$ git checkout -- .oxlintrc.json
$ git status --short
# (clean)
$ npx vitest run tests/tooling/generated-output-sync.test.ts -t "excludes generated outputs from static lint and format configs"
Test Files  1 passed (1)
     Tests  1 passed | 17 skipped (18)

$ pnpm run build
# 28/28 "wrote"
$ pnpm run build:check
# 28/28 "in sync"
$ git status --short
# (clean)

$ npx vitest run tests/tooling/
Test Files  3 passed (3)
     Tests  24 passed (24)

$ pnpm test
Test Files  110 passed | 1 skipped (111)
     Tests  1134 passed | 1 skipped (1135)

$ npm run validate
validation passed

$ git diff --stat 3ad6b84614fb5dcb6cc42fe08b2a466aa942a3ae..2d3ba9e --name-only
AGENTS.md
scripts/build-generated.mjs
tests/tooling/generated-output-sync.test.ts

$ git diff 3ad6b84614fb5dcb6cc42fe08b2a466aa942a3ae..2d3ba9e -- .lintstagedrc.mjs .github/workflows/validate.yml .oxfmtrc.json .oxlintrc.json
# (empty)

$ git diff --stat 8309623..3ad6b84614fb5dcb6cc42fe08b2a466aa942a3ae -- scripts/build-generated.mjs .oxfmtrc.json .oxlintrc.json .lintstagedrc.mjs tests/tooling/
# (empty — no drift between plan-time commit and phase base)
```
