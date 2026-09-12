---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - .
  - .oat/repo/reference/reviews/2026-09-11-audit-astra-review.md
oat_external_plan_commit: 1ff91ed5
oat_backlog_items: []
oat_issue_url: null
created: '2026-09-11T13:29:20Z'
---

# Preserve project isolation in transcript export selection

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`. Execute it directly, or import it with `oat-project-import-plan <this-file>`.

## Outcome

Codex transcript export never treats a session with unresolved project metadata as a project-matched fallback. Effective selector precedence is applied before it can weaken candidate eligibility. A successful explicit marker/session selection may still identify a cwd-less session, as currently documented; a known different cwd remains ineligible.

Value: high privacy/correctness. Effort: small. Implementation risk: medium. Confidence: high, source-verified with a synthetic reproduction; no real transcripts inspected or exported.

## Source and live evidence

- Finding `PRODUCT-01`; source unchanged from `f5395a35` when reviewed on 2026-09-11 at plan branch `1ff91ed5`.
- `src/transcript/export-session/export-session-transcript.ts:271-276` retains unresolved-cwd candidates when `requireCwd` is false. At `:626`, the mere presence of either lower-precedence selector disables the guard, although `--all` wins at `:376`.
- At `:391-408`, a missing marker falls back to the newest unrestricted candidate and labels it “newest-for-cwd.” A synthetic newer cwd-less candidate reproduces the mismatch.
- `tests/export-session-transcript/cli.test.ts:345,403` cover Claude marker fallback and bare Codex `--all`, not their failing combinations. `documentation/docs/user-guide/skills/export-session-transcript.md:40,56-58` describes project matching and precedence.
- The archived exporter plan's unresolved-cwd fix deliberately covered bare all/no-selector modes and left marker/session behavior unchanged. That completed outcome stays closed; this is a distinct uncovered combination.

## Drift check

```bash
git diff --stat f5395a35..HEAD -- src/transcript/export-session src/transcript/core/runtimes.ts tests/export-session-transcript skills/export-session-transcript
gh pr view 70 --json state,headRefOid,files
```

PR #70 owns shared transcript metadata work, not this selector outcome. Recheck its current changes before execution; use its landed metadata contract if applicable. Do not reopen or independently reimplement its handoff/discovery work.

## Scope

In scope: canonical `src/transcript/export-session/export-session-transcript.ts`, synthetic cases in `tests/export-session-transcript/cli.test.ts`, generated exporter output, exporter skill version, and the existing user-guide page/skill instructions if selector wording needs clarification.

Out of scope: changing provider discovery roots, accepting known-other-cwd sessions, removing explicit selector support, redesigning shared metadata discovery, sanitization changes, real transcript exports, or global installation.

## Implementation steps

### 1. Pin effective selection and fallback eligibility

Add synthetic Codex CLI fixtures for `--all --match`, `--all --session`, `--session --match`, marker hit, marker miss, and no selector. Include a verified matching cwd, a newer unresolved cwd, and a known different cwd. Keep all fixture paths temporary and fixture text invented.

**Verify:** reproduce the current marker-miss and mixed-all failures. Exact marker/ID selection of an unresolved-cwd candidate remains valid; an unknown ID still returns exit 2 without fallback.

### 2. Separate authoritative hits from project-qualified fallback

Derive the effective selector once (`all` > `session` > `match` > no selector) and use it for enumeration as well as selection. Retain enough candidate metadata, or re-enumerate through the existing strict path, to restrict marker-miss fallback to independently verified cwd matches. Do not infer project membership from file age, an absent marker, or missing metadata.

**Verify:** all-mode ignores lower-precedence flags without admitting unresolved candidates; marker miss chooses the newest verified project match, or exits 2 without writing when none exists. Positive marker/ID cases and known-different-cwd exclusion remain unchanged. Assert selected export contents, exit status, warning accuracy, and absence of unrelated output files—not just candidate counts.

### 3. Regenerate and verify the bounded change

Update the current selector documentation only where behavior needs clarification. Edit canonical TypeScript, regenerate via `pnpm run build`, and bump the exporter version consistently. Do not edit generated `.mjs` by hand or sync a branch globally.

**Verify:** `pnpm exec vitest run tests/export-session-transcript/cli.test.ts`, targeted authored-file lint/format, `pnpm run premerge`, and `pnpm run validate:skill-versions -- --base-ref origin/main`. Follow `documentation/AGENTS.md` for any docs edits and run the documented docs CI checks if the docs app changes. All checks use synthetic data, not user runtime stores.

## Done criteria

- [ ] Selection precedence governs both eligibility and selection.
- [ ] Fallback/all/no-selector paths exclude unresolved and different-cwd candidates.
- [ ] Successful explicit selectors retain documented compatibility.
- [ ] The full synthetic selector matrix proves content isolation and no-write failures.
- [ ] Generated output, skill version, docs, tests, type-check, validation, and smoke pass.

## STOP conditions

- PR #70 or another current owner already resolves this exact outcome; reuse its fix and retire this plan rather than competing.
- The change requires redesigning shared identity/provenance or accepting a known-other-project session.
- Verification would require real transcripts, provider execution, or changing runtime stores; synthetic fixtures are the required boundary.

## Review focus

Check selector precedence before enumeration, provenance retained through marker fallback, no-write failure behavior, and the distinction between authoritative selection and independently verified cwd membership.
