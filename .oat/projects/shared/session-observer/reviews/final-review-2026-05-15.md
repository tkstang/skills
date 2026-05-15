---
oat_generated: true
oat_generated_at: 2026-05-15
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/session-observer
---

# Code Review: final

**Reviewed:** 2026-05-15
**Scope:** Full branch diff from `f888df330b7a1d2020f2ec64ed7b3fdd366492d8..HEAD`
**Files reviewed:** 158
**Commits:** `f888df330b7a1d2020f2ec64ed7b3fdd366492d8..HEAD`

## Summary

Final review found blocking runtime issues in the implemented `session-observer` skill despite green test/validation gates. The most serious issue breaks current Codex transcript matching when `cwd` is stored in `payload.cwd`, and the CLI currently exits before the documented `--session` recovery path can rescue no-match or tie cases.

## Findings

### Critical

- `.agents/skills/session-observer/scripts/lib/runtimes.mjs:304` only reads `record.cwd` for Codex transcript metadata, but current Codex session metadata uses `payload.cwd` on `type: "session_meta"` records. A transcript with `{ "payload": { "cwd": "/tmp/project" } }` is discovered with `recordedCwd: null`, then `.agents/skills/session-observer/scripts/session-observer.mjs:242` returns `noMatch` before a digest can be built. The documented recovery is also blocked: passing `--session codex:<id>` still exits before the pinned override at `.agents/skills/session-observer/scripts/session-observer.mjs:270` runs. I verified this with a synthetic current-shape Codex transcript: both `review --runtime codex --cwd /tmp/session-observer-review-proj` and the same command with `--session codex:payload-session` returned exit 2 with the candidate in `globalRecent` and `recordedCwd: null`. This breaks the core v1 goal of checking the other runtime's Codex session for the active project. Fix by reading `payload.cwd` as well as top-level `cwd`, adding a payload-cwd fixture/test, caching `sessionId` with `recordedCwd`, and applying a valid pinned session before returning no-match.

### Important

- `.agents/skills/session-observer/scripts/session-observer.mjs:255` and `.agents/skills/session-observer/scripts/session-observer.mjs:375` perform tie handling before the `--session` override is applied. The skill tells agents to recover from exit-3 ties by re-invoking with `--session` (`.agents/skills/session-observer/SKILL.md:115`), but the re-invocation hits the same tie branch and exits 3 again. I reproduced this with two same-mtime Claude Code fixtures and `review --runtime claude-code --session ... --json`; the command still returned `{ "ties": true }`. Move pinned-session selection ahead of tie/no-match returns, validate the pinned runtime/id, and add tests for `review` and `catch-up` tie recovery.

### Medium

- `.agents/skills/session-observer/scripts/lib/rank.mjs:47` only treats `recordedCwd.startsWith(targetCwd + '/')` as Tier B. The approved source spec requires either side to be a path-prefix of the other so sessions started at the repo root still match when the agent is invoked from a subdirectory (`.superpowers/specs/2026-05-14-session-observer-design.md:154`). Today `tierOf({ recordedCwd: "/tmp/project" }, "/tmp/project/src")` returns Tier C and `rank()` returns noMatch. Fix Tier B to handle both directions using path-boundary-safe comparisons, and add a test for target-cwd-under-recorded-cwd.

### Minor

- `.agents/skills/session-observer/scripts/lib/state.mjs:17` still imports unused `access`. The p01 review also deferred edge-case state backup concerns around un-locked backup writes (`state.mjs:107`, `state.mjs:123`). Those backup paths remain acceptable to defer because they only affect corrupt/old state files, but the unused import should be cleaned up while touching `state.mjs`.
- `.oat/projects/shared/session-observer/implementation.md:385` still has `Final Summary (for PR/docs)` placeholders, and `.oat/projects/shared/session-observer/state.md:9` still reports `oat_phase_status: in_progress` even though all 15 tasks and p01-p06 reviews are complete. This is not a runtime blocker, but PR-final/complete routing should normalize it before closeout.

## Deferred Findings Ledger

- Deferred Medium count reviewed: 3 from p01, plus carried-forward ranking/Codex items from p02-p04.
- Deferred Minor count reviewed: 7 across p01, p03, p04, and p06.
- Disposition:
  - p01 `state.mjs` corrupt/migration backup atomicity findings remain acceptable to defer; they are dormant/edge-case state-recovery paths.
  - p02 Codex `payload.cwd` fallback is no longer acceptable as Minor; escalated to Critical above because it matches current Codex metadata shape and blocks project matching.
  - p03/p04 `tierOf` path comparison drift is no longer acceptable as a carried Minor; escalated to Medium above because it violates the approved subdirectory matching contract.
  - p04 no-op catch-up locked write and reserved exit-code 4 remain acceptable as non-blocking cleanup.
  - p06 stale artifact metadata/final-summary placeholders remain Minor closeout cleanup.

## Spec/Design Alignment

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| Locate other runtime's current-project session | partial | Claude direct cwd matching is covered; current-shape Codex `payload.cwd` sessions fail to match. |
| `check again` catches up incrementally | implemented | `catch-up` state flow works in tested exact-match cases. |
| Tool calls/results excluded by default | implemented | Runtime adapters and digest renderer honor default filtering. |
| Ask/recover on ties | partial | Tie detection exists, but documented `--session` recovery does not work. |
| Subdirectory cwd matching | partial | Only candidate-under-target direction is implemented. |
| No Stoa runtime dependency/no network/transcript read-only | implemented | Runtime is Node stdlib and local file/state only. |

### Extra Work

The branch diff includes existing consensus-plugin/OAT tooling history in addition to the active `session-observer` project. I focused the behavioral review on the active project files and checked the repo-wide validation gates.

## Verification Commands

Commands run during review:

```bash
npm test
npm run validate
npm run smoke
node --input-type=module - <<'EOF'
import { tierOf, rank } from './.agents/skills/session-observer/scripts/lib/rank.mjs';
const candidate = { recordedCwd: '/tmp/project', mtime: 10, ageSec: 10, runtime: 'codex', sessionId: 's', transcriptPath: '/tmp/s.jsonl' };
console.log({ tier: tierOf(candidate, '/tmp/project/src'), rank: rank([candidate], '/tmp/project/src') });
EOF
```

Additional synthetic CLI repros were run for:

- Codex `payload.cwd` metadata: `review --runtime codex --cwd <matching-cwd>` returned exit 2 with `recordedCwd: null`.
- Pinned tie recovery: `review --runtime claude-code --session <runtime:id>` still returned exit 3 with `ties: true`.

## Recommended Next Step

Run `oat-project-review-receive` to convert the Critical, Important, Medium, and closeout Minor findings into fix tasks before PR finalization.
