---
oat_generated: true
oat_generated_at: 2026-06-02
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/session-observer-watch
---

# Artifact Review: plan

**Reviewed:** 2026-06-02
**Scope:** plan.md (quick workflow mode)
**Files reviewed:** 1 primary (plan.md) + 1 upstream (discovery.md)
**Commits:** n/a (artifact review)

## Summary

The plan is well-structured, internally consistent, and tightly aligned with `discovery.md` and the existing `references/watch-design.md`. All referenced source files, module exports (`discover`, `rank`, `runCatchUp`, `runReview`, state lock/atomic-write discipline), and the documented `SKILL.md` "not implemented in v1" claim were verified to exist in the codebase as the plan assumes. Findings are limited to a small number of clarity/consistency gaps; none block implementation.

## Findings

### Critical

None.

### Important

None.

### Medium

- **Stale Reviews-table rows reference absent spec/design artifacts** (`plan.md:441-442`)
  - Issue: The Reviews table lists `spec | artifact | pending` and `design | artifact | pending` rows, but this is a quick-mode project with no `spec.md` or `design.md` (correctly so). These pending rows imply artifact reviews that will never have a target, which can confuse review/closeout bookkeeping and the `oat-project-review-receive` flow.
  - Fix: Remove the `spec` and `design` rows from the Reviews table for this quick-mode plan, or annotate them as `n/a (quick mode)` so closeout does not treat them as outstanding gates. This is artifact-alignment cleanup, not an implementation defect.

- **`--runtime both` is committed as built scope despite being an open question in discovery** (`plan.md:107,123-124,242` vs `discovery.md:129`)
  - Issue: The plan hard-commits `both` into the runtime validation surface (p01-t02) and verification commands, but `discovery.md` Open Questions ("Default runtime breadth") states `both` should be included "if low-friction, but may preserve `auto` as the default when `both` would complicate singleton state or tests." The plan does not capture the escape hatch to drop `both` if it complicates singleton/test work, so an implementer hitting friction has no sanctioned fallback recorded.
  - Fix: Add a one-line note to p01-t02 (or the Parallelism/notes area) that `both` may be deferred to `auto`-only if singleton-state or test determinism becomes hard, matching the discovery open question, and that such a deviation should be logged in `implementation.md` Deviations rather than treated as a plan failure.

### Minor

- **p03-t01 RED step is conditional and may not produce a true failing gate** (`plan.md:323-329`)
  - Issue: The RED step says to add validation expectations "so docs fail," but then allows keeping `scripts/validate.mjs` untouched if existing validation already catches stale text. Verified that `scripts/validate.mjs` currently has no session-observer/watch docs invariant, so today there is no failing gate for the "not implemented in v1" string at `SKILL.md:44`. The task is recoverable but the RED/GREEN framing is softer than the other TDD tasks.
  - Suggestion: Tighten p03-t01 Step 1 to state that, absent an existing invariant, the implementer must add a concrete validation check (or `rg`-based assertion) that fails on the stale "not implemented" wording before updating docs, so the docs task has a real RED gate like the rest of the plan.

- **Final commit task bundles OAT artifact bookkeeping with a `chore` skill-sync commit** (`plan.md:422-428`)
  - Issue: p03-t02 Step 5 stages `implementation.md`, `plan.md`, `state.md`, and `.oat/state.md` together with the `.agents` skill sync under a single `chore(p03-t02): sync...` message. This is acceptable but mixes feature-closeout bookkeeping into a sync commit, which can make the history slightly harder to read.
  - Suggestion: Optional — consider noting that artifact-state updates may land in their own bookkeeping commit. Not a blocker; the commit convention section already permits `chore` for sync/docs bookkeeping.

- **Implementation.md frontmatter shows `in_progress` before any work** (`implementation.md:2,38`)
  - Issue: Outside the strict plan scope, but noted for closeout hygiene: `implementation.md` is already `oat_status: in_progress` with `oat_current_task_id: p01-t01` while all tasks are `pending` and `0/7` complete. This is consistent with a scaffolded start, but reviewers consuming the plan should know no tasks are done yet.
  - Suggestion: No action required for plan readiness; flagged only so review-receive does not misread the project as partially implemented.

## Requirements/Design Alignment

**Evidence sources used:** `plan.md` (primary), `discovery.md` (upstream, quick mode). No `spec.md`/`design.md` (expected absent in quick mode). Cross-checked against existing source: `session-observer.mjs`, `lib/state.mjs`, `lib/locate.mjs`, `lib/rank.mjs`, `references/watch-design.md`, `SKILL.md`, `scripts/validate.mjs`.

### Requirements Coverage (discovery success criteria + key decisions -> plan tasks)

| Requirement (discovery) | Status | Notes |
| ----------------------- | ------ | ----- |
| `watch` + `--watch` enter watch mode | implemented | p01-t02 adds canonical `watch`, `--watch` alias, `watch-ctl`. |
| Watch identifies same candidate as locate/rank/catch-up | implemented | p02-t01 extracts reusable observe pipeline reusing auto/pinned/snippet/locate/rank rules. |
| Poll + debounce, at most one digest per settled burst | implemented | p02-t02 polling/debounce with injected timers; mirrors watch-design pseudocode. |
| New output rendered as catch-up digest for agent | implemented | p02-t01/p02-t02 keep output formatting in CLI, emit rendered markdown. |
| `--json` JSON-line events; `--event-log` metadata-only JSONL | implemented | p02-t02 asserts `ts`, `runtime`, `sessionId`, `newRecords`, `digestChars`, range, no content. |
| `watch-ctl` status/pause/resume/flush/stop via control file | implemented | p01-t02 (status) + p02-t03 (pause/resume/flush/stop). |
| Singleton enforcement; stale pid cleared (`ESRCH`) | implemented | p01-t01 watch-state tests cover live-pid refusal and `kill(pid,0)` ESRCH clearing. |
| Existing CLI tests pass; new state/debounce/control/runtime tests | implemented | Every task has RED tests + regression assertions; p03-t02 runs full suite. |
| Docs no longer say "not implemented"; operator guidance added | implemented | p03-t01 removes stale warning, adds active-watch operator guidance + deferred-hook boundary. |
| User-level dogfooding install refreshed; symlinks verified | implemented | p03-t02 refreshes `~/.agents/...`, checks `~/.claude`/`~/.cursor` symlinks, runs `oat sync --scope user`. |
| State safety: writes only under `~/.local/state/session-observer/` | implemented | p01-t01 reuses state.mjs lock/temp/rename discipline; STATE_DIR-scoped. |
| Transcript read-only; no network; no memory writes | implemented | Plan never writes transcripts; observe pipeline is read+digest only. Constraint honored implicitly. |
| `--max-runtime-min` bounded test runs | implemented | p02-t02 RED + verify use `--max-runtime-min 0.02`. |
| Default runtime breadth (`both` vs `auto` fallback) | partial | `both` is committed without the discovery-sanctioned fallback to drop it if it complicates singleton/tests. See Medium finding. |
| `watchedByPid` warn-not-refuse on manual catch-up | implemented | p02-t03 asserts catch-up warns but still succeeds. |

### Extra Work (not in declared requirements)

None. Every task traces to a discovery success criterion, key decision, or constraint. The catch-up pipeline extraction (p02-t01) is enabling refactor work justified by the "same pipeline as catch-up" requirement, not scope creep.

## Verification Commands

```bash
# Confirm referenced source files exist (plan grounding)
ls skills/session-observer/scripts/lib/state.mjs skills/session-observer/scripts/session-observer.mjs
ls skills/session-observer/references/watch-design.md tests/session-observer/cli.test.mjs

# Confirm module exports the plan assumes
rg -n "export async function discover|export function rank" skills/session-observer/scripts/lib/locate.mjs skills/session-observer/scripts/lib/rank.mjs
rg -n "runCatchUp|runReview|case 'catch-up'" skills/session-observer/scripts/session-observer.mjs

# Confirm the stale docs string the plan targets still exists
rg -n "not implemented" skills/session-observer/SKILL.md skills/session-observer/references/watch-design.md

# Confirm validate.mjs has (or lacks) a watch docs invariant today
rg -n "session-observer|watch" scripts/validate.mjs
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks (or apply the Medium artifact-alignment fixes directly to `plan.md`, since both are low-effort plan edits).
