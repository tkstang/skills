---
oat_generated: true
oat_generated_at: 2026-06-19
oat_review_scope: plan
oat_review_type: artifact
oat_project: .oat/projects/shared/consensus-rubric-guidance
oat_review_invocation: manual
---

# Artifact Review: plan

**Reviewed:** 2026-06-19
**Scope:** plan.md (quick-mode implementation plan) — alignment with discovery.md and against the actual repo source
**Files reviewed:** 2 artifacts (plan.md, discovery.md) + 8 repo sources verified
**Commits:** N/A (artifact review)

## Summary

The plan is well-structured, canonical-format conformant, and faithful to discovery's two workstreams and key decisions. File targets are accurate: every "Modify" target exists, the four "Create" rubric example targets do not yet exist, and `evaluate/references/examples/` correctly mirrors the existing `refine/references/examples/` layout. The one substantive gap is in p03-t01: the plan's release-tooling task underspecifies that `evaluate/SKILL.md` is **not** currently tracked by `scripts/bump-version.mjs` (`SKILL_FILES` lists only `refine`), and adding it will require coordinated changes to `tests/release-versioning.test.mjs` (which copies only `refine` into its temp repo) — otherwise the task's own verification will fail. Two smaller alignment/sequencing notes round out the findings.

## Findings

### Critical

None

### Important

- **p03-t01 underspecifies the `evaluate` skill addition to release tooling and the coupled test fixture change** (`plan.md:269-300`; `scripts/bump-version.mjs:18`; `tests/release-versioning.test.mjs:30,40-54`)
  - Issue: The task goal is to "keep top-level skill `version` and `metadata.version` in sync after the validator starts recognizing the promoted field" and the implementation notes say to "update top-level `version` when present and still update `metadata.version`." But the concrete, verified reality is that `SKILL_FILES` in `scripts/bump-version.mjs:18` is `['plugins/consensus/skills/refine/SKILL.md']` — `evaluate/SKILL.md` is **absent entirely**. Phase 1/2 will promote a top-level `version` and add `argument-hint` to `evaluate/SKILL.md`, so for release tooling to keep evaluate in sync it must first be **added** to `SKILL_FILES`, not merely have its update logic extended. The plan never names this addition.
  - Compounding problem: `tests/release-versioning.test.mjs` maintains its **own** local `skillFiles = ['plugins/consensus/skills/refine/SKILL.md']` (line 30) and `tempReleaseRoot()` copies only those files into the temp repo (lines 40-54). If `evaluate/SKILL.md` is added to the production `SKILL_FILES` but the test's `skillFiles`/`tempReleaseRoot` are not updated in the same task, `bumpVersion` will throw `ENOENT` reading the missing evaluate file inside the temp repo, and the task's own `node --test tests/release-versioning.test.mjs` verification will fail. The plan lists `tests/release-versioning.test.mjs` in the task's Files, but its implementation notes only mention "Extend release-versioning tests so a version bump updates both skill version locations" (i.e., the dual top-level/metadata assertion) — not the fixture-copy and `skillFiles`-list changes needed to even include evaluate.
  - Fix: Expand p03-t01 implementation notes to explicitly (1) add `'plugins/consensus/skills/evaluate/SKILL.md'` to `SKILL_FILES` in `scripts/bump-version.mjs`, (2) make `replaceSkillMetadataVersion`/version helpers handle a top-level `version` line in addition to `metadata.version`, and (3) update `tests/release-versioning.test.mjs` to add evaluate to its local `skillFiles` list and copy it in `tempReleaseRoot()`, plus assert both files get bumped. Note that `bumpVersion`'s current `requireSemver`-first ordering and the "rejects malformed semver before modifying files" test (lines ~150) must keep passing.

- **p03-t01 / p01-t01 do not state that the existing `bump-version` regex only matches `metadata.version`, so "update top-level version when present" implies new write logic** (`plan.md:284-285`; `scripts/bump-version.mjs:53-71,38-51`)
  - Issue: `replaceSkillMetadataVersion` (lines 53-71) and `skillMetadataVersion` (lines 38-51) target the `metadata:\n ... version:` block specifically; there is no current code path that reads or writes a top-level `version:` line. The plan's phrasing "update top-level `version` when present and still update `metadata.version`" is the right intent, but a reader could mistake it for a trivial extension. This is the same scripted boundary the validator change in p01-t01 must mirror: `scripts/validate.mjs:190` checks `parsed.metadata?.version` only, and `parseFrontmatter` (lines 88-123) does parse a top-level `version` into `parsed.version`, so the validator helper p01-t01 describes is feasible — but the bump tooling needs genuinely new top-level read/write code, not just a tweak.
  - Fix: Add an implementation note to p03-t01 clarifying that a new top-level `version` read/replace helper is required (the current helpers are metadata-only), and that both helpers should treat a present top-level `version` as authoritative while keeping `metadata.version` synchronized — mirroring the validator's "require match when both present" rule from p01-t01 to avoid a tooling/validator divergence.

### Minor

- **Mid-phase failing-test window between p01-t01 and p01-t02** (`plan.md:55-133`)
  - Issue: p01-t01 commits validator changes plus `tests/validate-script.test.mjs` cases for top-level `version`, but the consensus SKILL.md files do not gain a top-level `version` until p01-t02. The plan correctly keeps `metadata.version` compatibility and requires the two to *match only when both exist*, so a metadata-only skill still passes — the verified `validate-script.test.mjs` already exercises metadata-only frontmatter (lines 144-150, 219-228) and `pnpm run validate` should stay green after p01-t01. This is therefore a benign window, not a strand. Worth a one-line note in the Parallelism/sequencing prose that p01-t01 must preserve metadata-only passing so the repo is never red between the two commits.
  - Suggestion: Add a sentence to p01-t01's notes: "metadata-only frontmatter (the current state of both skills) must still pass after this task, so the repo stays green before p01-t02 adds the top-level field."

- **`tests/docs-presence.test.mjs` already asserts a fixed evaluate heading set; new sections are additive but the existing assertions constrain placement** (`plan.md:139-263`; `tests/docs-presence.test.mjs` evaluate block)
  - Issue: The verified `docs-presence` test already asserts `## Evaluation Invocation`, `## Output Contract`, `--rubric <path>`, `parallel_revision`, `minimal`, and `consensus-verdict` for evaluate, and `## Iteration Modes` / `## Escalation Handling` for refine. The plan's p02-t01/p02-t02/p02-t03 additions (`## When NOT to Use`, `## Examples`, `## Success Criteria`, `## Guided Rubric Creation`, examples links) are purely additive and compatible with these existing assertions, so there is no conflict — but the plan should note that the existing assertions must be preserved (not replaced) when extending the test, to avoid an implementer rewriting the test block wholesale.
  - Suggestion: Add "preserve existing heading/token assertions; only add new ones" to p02-t01's notes.

- **p02-t03 should confirm `tests/repo-layout.test.mjs` is the right home for the new directory assertion** (`plan.md:223-263`; `tests/repo-layout.test.mjs:51-60,97-99`)
  - Issue: `repo-layout.test.mjs` currently asserts the presence of skill/scripts directories and the *absence* of a `refine/src` dir; it does not currently enumerate `references/examples`. Adding the new `evaluate/references/examples` assertion there is reasonable, but the plan could note that the directory-existence assertion belongs in repo-layout while the file-content/link assertions belong in docs-presence, to keep the split clean (the plan already lists both files, so this is just a clarity nudge).
  - Suggestion: One-line note assigning directory existence to `repo-layout.test.mjs` and file/link content to `docs-presence.test.mjs`.

## Requirements/Design Alignment

**Evidence sources used:** plan.md, discovery.md (quick mode — no spec.md/design.md, correctly N/A). Repo verification: `scripts/validate.mjs`, `scripts/bump-version.mjs`, `tests/validate-script.test.mjs`, `tests/skill-frontmatter.test.mjs`, `tests/docs-presence.test.mjs`, `tests/repo-layout.test.mjs`, `tests/release-versioning.test.mjs`, both consensus `SKILL.md` files, and `refine`/`evaluate` `references/` layouts.

### Discovery Decision Coverage

| Discovery item | Status | Notes |
| --- | --- | --- |
| W1: `## When NOT to Use` / `## Examples` / `## Success Criteria` on both skills | covered | p02-t01 (both skills); verified neither SKILL.md has these today |
| W1: `argument-hint` added to both skills | covered | p01-t02; verified absent today |
| W1: promote `version` to top-level, keep `metadata` block, make validation meaningful | covered | p01-t01 (validator) + p01-t02 (frontmatter); verified validator checks `metadata.version` only today (`validate.mjs:190`), matching discovery |
| W1: sibling parity (both skills together) | covered | p01-t02 and p02-t01 edit both files in one task each |
| W1: preserve topical-section style (not Step-N) | covered | explicit in p02-t01 notes; matches verified topical headings in both files |
| W2: bundle four example rubrics under `evaluate/references/` | covered | p02-t03 creates the four files; verified they do not exist yet and that `refine/references/examples/` exists to mirror |
| W2: ≤12 load-bearing criteria per rubric | covered | p02-t03 notes the 12-cap; matches discovery revalidation finding |
| W2: host-model guided flow, deterministic wrapper unchanged | covered | p02-t02 keeps wrapper contract `--rubric` unchanged; no `src/consensus/evaluate/` edit planned |
| W2: guided trigger = explicit ask OR evaluate-without-rubric | covered | p02-t02 lists both triggers verbatim per discovery decision 5 |
| W2: drafts written only to user-approved workspace path | covered | p02-t02 notes user-approved path |
| Release/version tooling kept in sync | **partial** | p03-t01 covers intent but omits the concrete `SKILL_FILES` addition of evaluate + coupled fixture change (see Important findings) |
| Out of scope: no bundled rubrics for `refine` | honored | refine gets frontmatter+sections only; no examples created for refine — correct |
| Out of scope: no wrapper interactivity / no new `bin` | honored | no runtime/CLI changes planned |
| Generated-output contract (no `.mjs` hand-edit) | honored | SKILL.md confirmed not generated; p03-t02 `build:check` is a drift guard, correctly scoped |

### Plan-format Conformance

- Frontmatter: present and valid (`oat_status: complete`, `oat_plan_source: quick`, `oat_plan_parallel_groups: []` consistent with sequential rationale).
- Required sections: Parallelism, three phases with stable monotonic `pNN-tNN` IDs, Reviews table, Implementation Complete, References — all present, no placeholder-only critical content.
- Reviews table: preserved with prior artifact rows; no deletion required.
- Dispatch Profile: absent — NORMAL for an artifact plan, not flagged.
- Task atomicity: each task is independently committable with a bounded file set and a runnable verification command; commit groupings are coherent.
- Parallelism claim: `[]` (sequential) is sound — phases repeatedly touch the same `SKILL.md` and `tests/docs-presence.test.mjs`, so parallel worktrees would collide. The stated rationale matches the verified file overlap.

### Extra Work (not in discovery)

None. Every task maps to a discovery workstream or its explicit verification/guardrail needs.

## Verification Commands

```bash
# Confirm the release-tooling gap (evaluate absent from SKILL_FILES):
grep -n "SKILL_FILES" /Users/tstang/Code/consensus-rubric-guidance/scripts/bump-version.mjs
grep -n "skillFiles" /Users/tstang/Code/consensus-rubric-guidance/tests/release-versioning.test.mjs

# Confirm validator currently keys on metadata.version only:
grep -n "metadata?.version\|metadata.version" /Users/tstang/Code/consensus-rubric-guidance/scripts/validate.mjs

# Confirm current SKILL.md state (no top-level version / argument-hint / new sections):
grep -nE '^(version|argument-hint):|^## ' /Users/tstang/Code/consensus-rubric-guidance/plugins/consensus/skills/evaluate/SKILL.md
grep -nE '^(version|argument-hint):|^## ' /Users/tstang/Code/consensus-rubric-guidance/plugins/consensus/skills/refine/SKILL.md

# Confirm create-targets absent and refine layout exists to mirror:
ls /Users/tstang/Code/consensus-rubric-guidance/plugins/consensus/skills/evaluate/references/
ls /Users/tstang/Code/consensus-rubric-guidance/plugins/consensus/skills/refine/references/examples/

# Baseline test suites the plan's tasks depend on:
node --test tests/release-versioning.test.mjs tests/validate-script.test.mjs tests/skill-frontmatter.test.mjs tests/docs-presence.test.mjs tests/repo-layout.test.mjs
pnpm run validate
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
