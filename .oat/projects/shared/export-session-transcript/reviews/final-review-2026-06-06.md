---
oat_generated: true
oat_generated_at: 2026-06-06
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/export-session-transcript
---

# Code Review: final

**Reviewed:** 2026-06-06
**Scope:** Final independent code review for `feat/export-session-transcript` against merge-base `e9787984518ad59ebab197ba0d9b7557a5686996`.
**Files reviewed:** 26
**Commits:** `e9787984518ad59ebab197ba0d9b7557a5686996..HEAD`

## Summary

The implementation is broadly coherent and the automated verification suite passes, including the shared transcript-core drift guard. I found one Important sanitizer coverage gap: a leading `<skill>...</skill>` payload is still preserved even though the skill and discovery requirements promise to exclude skill payloads. I also found one Minor README inconsistency introduced by documenting additional skills while leaving the old "refine skill only" limitation intact.

## Findings

### Critical

None.

### Important

#### I1. Leading `<skill>...</skill>` payloads survive sanitization

**References:** `skills/export-session-transcript/scripts/lib/sanitize.mjs:120`, `skills/export-session-transcript/scripts/lib/sanitize.mjs:139`, `skills/export-session-transcript/SKILL.md:17`, `.oat/projects/shared/export-session-transcript/discovery.md:17`, `tests/export-session-transcript/sanitize.test.mjs:50`

The export skill promises that only visible user/assistant messages survive and that `environment/AGENTS.md/skill payloads` are excluded (`SKILL.md:17-21`). The original request also requires excluding `AGENTS.md/skill payloads` (`discovery.md:17-22`). The sanitizer currently drops command-message wrappers, AGENTS/SKILL markdown headings, and leading skill frontmatter, but there is no matcher for the common leading XML-style skill wrapper form:

```text
<skill>
<name>oat-project-review-provide</name>
---
name: oat-project-review-provide
</skill>
```

I verified this directly:

```bash
node --input-type=module -e "import { sanitizeEntries } from './skills/export-session-transcript/scripts/lib/sanitize.mjs'; const input = [{ role: 'user', text: '<skill>\\n<name>oat-project-review-provide</name>\\n---\\nname: oat-project-review-provide\\n</skill>', recordIndex: 0, kind: 'message' }]; console.log(JSON.stringify(sanitizeEntries(input, { runtime: 'codex' }), null, 2));"
```

The entry is returned unchanged. The hidden-payload test token list also lacks this wrapper class (`tests/export-session-transcript/sanitize.test.mjs:50-68`), so the leak is not covered by fixtures for Claude Code, Codex, or Cursor.

**Impact:** If a host records injected skill bodies in `<skill>...</skill>` form as ordinary transcript text, the export writes hidden skill instructions into the Markdown file under `~/Downloads`, violating the main privacy boundary for this skill.

**Fix guidance:** Add a leading-anchored hidden-payload matcher for `<skill>` blocks (and any observed close variants), add fixture coverage for all three runtimes, and keep a negative test proving ordinary mid-sentence mentions of `<skill>` are preserved.

### Medium

None.

### Minor

#### M1. README limitations still claim only `refine` ships

**Reference:** `README.md:128`

This branch adds public README documentation for `session-observer`, `export-session-transcript`, and `shared/transcript-core`, but the Limitations section still says "v0.1 ships the `refine` skill only." That leaves the repository-level documentation internally inconsistent after the new export skill docs were added.

**Impact:** Users reading the README can miss or mistrust the newly documented standalone skills.

**Fix guidance:** Update the limitation to describe the current shipped skill set, or scope the statement explicitly to the consensus family if that is what it is meant to describe.

## Deferred Findings Ledger

- Deferred Medium count: 0
- Deferred Minor count: 0
- Prior final review minors from `reviews/archived/final-review-2026-06-05.md` were converted to p03-t03 and p03-t04 and recorded as fixed in `implementation.md:237-248`.

## Spec/Design Alignment

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| Export current conversation to sanitized Markdown | partial | Core flow exists and tests pass, but `<skill>...</skill>` hidden payloads leak through I1. |
| Default output named after current git branch under `~/Downloads` | implemented | Covered by CLI tests. |
| Support Claude Code, Codex, and Cursor stores | implemented | Runtime parsing is centralized in transcript-core and synced into consumers. |
| Marker, `--session`, `--match`, and `--all` selection modes | implemented | Mode precedence is documented and tested. |
| Shared transcript-core drift guard | implemented | `node scripts/sync-transcript-core.mjs --check` and `tests/transcript-core/sync.test.mjs` pass. |
| Documentation and repo invariants | partial | README limitation drift remains in M1. |

### Extra Work

None requiring rollback. The shared transcript-core extraction and drift guard are within the documented plan scope.

## Verification Commands

Passing commands run during review:

```bash
npm test
npm run validate
npm run smoke
node scripts/sync-transcript-core.mjs --check
git diff --check e9787984518ad59ebab197ba0d9b7557a5686996..HEAD
```

Results:

- `npm test`: 362 tests, 34 suites, 0 failures
- `npm run validate`: passed
- `npm run smoke`: passed
- `node scripts/sync-transcript-core.mjs --check`: passed
- `git diff --check ...`: passed

Failing manual probe:

- `sanitizeEntries` preserves a leading `<skill>...</skill>` payload unchanged; see I1.

## Recommended Next Step

Run `oat-project-review-receive` to convert I1 and M1 into tracked fix tasks, then re-run the final code review.
