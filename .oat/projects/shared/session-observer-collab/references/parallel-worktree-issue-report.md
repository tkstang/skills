# Parallel phase worktree bootstrap fails when the project slug is also the orchestration branch

## Summary

`oat-project-implement` could not bootstrap the plan-declared parallel phases
`p04` and `p05`. The workflow required branches named
`session-observer-collab/p04` and `session-observer-collab/p05`, but the current
orchestration branch already occupied the leaf ref
`refs/heads/session-observer-collab`.

Git cannot store both a leaf ref and child refs beneath that leaf. Both strict
`oat-worktree-bootstrap-auto` invocations therefore failed before creating a
branch or worktree, and `oat-project-implement` correctly degraded the entire
parallel group to sequential execution.

This appears to be a deterministic branch-naming collision rather than a test,
dependency, worktree-root, or transient Git failure.

## Environment

- Repository: `/Users/tstang/Code/session-observer-collab`
- Active project: `.oat/projects/shared/session-observer-collab`
- OAT version: `0.1.53`
- Git version: `2.54.0`
- Orchestration branch: `session-observer-collab`
- Bootstrap base at the time of both attempts:
  `20a96fd370df7e783daa7fa17369e5d8bab910de`
- Bootstrap policy: `strict`
- Parallel group from `plan.md`: `[p04, p05]`

## Triggering contract

The implementation workflow's parallel-group contract derives each phase
branch as:

```text
{project-name}/{phase-id}
```

For this project, that produced:

```text
session-observer-collab/p04
session-observer-collab/p05
```

The repository was already on:

```text
refs/heads/session-observer-collab
```

## Reproduction

From a repository whose current local branch is `session-observer-collab`, the
equivalent failing Git operation is:

```bash
BASE_SHA=20a96fd370df7e783daa7fa17369e5d8bab910de
git worktree add \
  /Users/tstang/Code/session-observer-collab-worktrees/session-observer-collab/p04 \
  -b session-observer-collab/p04 \
  "$BASE_SHA"
```

The p05 attempt fails in the same way when `p04` is replaced with `p05`.
Run this reproduction only in a disposable repository or after confirming the
target branch and worktree do not exist.

## Actual result

p04 returned:

```text
cannot lock ref 'refs/heads/session-observer-collab/p04':
'refs/heads/session-observer-collab' exists;
cannot create 'refs/heads/session-observer-collab/p04'
```

p05 returned:

```text
cannot lock ref 'refs/heads/session-observer-collab/p05':
'refs/heads/session-observer-collab' exists;
cannot create 'refs/heads/session-observer-collab/p05'
```

Structured outcome for both attempts:

```yaml
status: error
base_ref: 20a96fd
resolved_base_sha: 20a96fd370df7e783daa7fa17369e5d8bab910de
baseline_policy: strict
checks:
  worktree_init: skip
  project_status: skip
  tests: skip
  git_clean: skip
  provider_sync: skip
  sync_commit: skip
```

No phase branch or target worktree was created. The expected target paths were
checked after the failures and did not exist.

## Expected result

The bootstrap layer should select a valid, collision-safe phase branch name,
create each worktree from the explicit orchestration HEAD, verify that the base
SHA is an ancestor of the new worktree HEAD, and then run the strict baseline
checks.

A valid naming scheme must not require a child ref underneath the current
orchestration branch's leaf ref.

## Root cause

Git represents ordinary local branch refs beneath `.git/refs/heads` or the
equivalent packed-ref namespace. A ref named:

```text
refs/heads/session-observer-collab
```

cannot coexist with:

```text
refs/heads/session-observer-collab/p04
```

because the former is a leaf while the latter requires the same path segment
to act as a namespace. The current `{project-name}/{phase-id}` template is
therefore invalid whenever the orchestration branch is exactly the project
name, which is a normal OAT project setup.

## Workflow impact

- The p04/p05 phases could not execute concurrently.
- Both bootstrap attempts stopped before setup or tests, so no baseline signal
  was collected from either worktree.
- `oat-project-implement` followed its safety contract: after any bootstrap
  failure, it canceled parallel execution and degraded the whole group to
  sequential target-preserving execution on the orchestration branch.
- No partial branch, worktree, or implementation edit required cleanup.

## Suggested remediation

Prefer a collision-safe branch namespace that is independent of the current
orchestration branch leaf. For example:

```text
oat-phase/session-observer-collab-p04
oat-phase/session-observer-collab-p05
```

or another deterministic encoding that does not use
`{existing-leaf-ref}/...`.

The implementation workflow or bootstrap layer should also preflight the
candidate ref before `git worktree add`:

1. Resolve the proposed full ref.
2. Detect whether any prefix is already an existing ref or whether the proposed
   ref would become a prefix of an existing ref.
3. Select the documented collision-safe fallback name.
4. Return the selected branch name in structured output so fan-in and cleanup
   use the actual ref rather than re-deriving it.

The fallback should remain deterministic and should not silently change the
explicit base SHA, worktree root, baseline policy, merge order, or phase ID.

## Suggested regression coverage

Add an integration test with this topology:

```text
current branch: example-project
project name:   example-project
parallel group: [p02, p03]
```

Verify that:

- both phase worktrees bootstrap successfully from the explicit current HEAD;
- neither selected phase branch is nested beneath
  `refs/heads/example-project`;
- structured status reports the actual selected branch names;
- the base-mismatch gate still runs against the explicit base SHA;
- fan-in merges the phase branches in plan order; and
- cleanup removes the selected worktrees without assuming the old branch-name
  template.

Also retain a unit-level failure test for direct requests that deliberately use
an invalid nested ref, so `oat-worktree-bootstrap-auto` continues to return a
clear structured `worktree-creation-failed` result rather than misclassifying
the error as a baseline failure.

## Current disposition

The project recorded the degradation in `implementation.md` and continued p04
then p05 sequentially. This report documents the OAT tooling issue; it does not
change the session-observer collaboration product contract.
