# deliberate-testing dogfooding: first campaign trial

- **Date:** 2026-09-26
- **Skill under trial:** `deliberate-testing`, installed at `~/.claude/skills/deliberate-testing/`. Files used: `SKILL.md`, `references/campaign.md` and `references/audit.md`. This note does not edit the skill.
- **Trial:** a full pruning campaign on the session-observer test surface. See [the campaign hand-off report](2026-09-26-session-observer-test-pruning-campaign.md).
- **Host:** Claude Code with Opus 5.5 at the root and 11 subagents: 7 lane agents and 4 preservation reviewers. Cross-model review used `codex review`.

## Outcome in one paragraph

The campaign steps held up. The most valuable parts were not the deletions. The settling failure injections found vacuous tests the lane records had called keepers or targets: four watch and digest timing tests, two lock-reclaim tests, and a concurrent-save test that could never collide. The independent preservation review found six real gaps the lanes had introduced, and each was confirmed and restored. The presumed-keeper rule and the named-keeper proofs stopped several plausible but wrong deletions.

The deletion ratio (about 8%) was modest, which fits a suite that already mostly tested real boundaries.

The skill's weak spots are all about coordination, and none of them came up in a single-lane audit:

- cross-lane keeper conflicts;
- the order in which carried assertions land;
- running injections in a shared checkout;
- telling campaign-caused gaps from pre-existing ones.

## Time per step

| Step | Wall time | Notes |
| --- | --- | --- |
| Read SKILL.md, campaign.md, audit.md | ~3 min | Mode selection was unambiguous. |
| 1. Baseline | ~3 min | Mostly scope discovery by import-graph grep; the suite run took 36 s. |
| 2. Lanes | ~1 min | Overlapped step 1. |
| 3. Read-only record | 13.5 min | 7 parallel agents took 7–13 min each; 534 protections recorded. |
| 4. Keeper plan | ~6 min | Same agents resumed with their context, 2–4 min each, plus one relay to resolve a cross-lane cycle. |
| 5. Cutover | 41 min | Sequential lanes, 5–8 min each, including about 85 settling-injection runs. |
| 6. Preservation review | 21 min | 4 reviewers in parallel (4–9 min) plus Codex; about 12 min of root injections and restorations. |
| 7. Product defects | ~2 min | Two reproductions; no fix was authorized. |
| 8. Reconcile and hand off | ~15 min | Base unchanged. Version fan-out, gates and the report. |
| **Total** | **~1 h 45 min** | |

## Unclear

- **Finding the in-scope tests.** Step 1 says to count "the subsystem's test and test-support line counts". Step 2 says to include "the subsystem's cases in shared core suites", but gives no method for finding them. An import-graph sweep worked: observer → shared transcript, fork-to-destination → observer `lib/locate.ts`, collab → observer `lib/state.ts` and `lib/digest.ts`. The skill should suggest it. It is also silent on counting files that are only partly in scope, such as collab suites where only a few cases touch observer. I counted those whole files separately.
- **"Production-code ownership" when one owner has many modules.** Lanes by skill would have produced one 22k-line lane. I split by lib-module groups. Nothing says whether an integration test that spans modules of one owner is "cross-module"; I kept it in the CLI lane.
- **Step 3 versus audit.md evidence.** Step 3 asks for "one evidence line" per protection. audit.md requires seven candidate-evidence fields "before editing". I resolved it as one line for Keep and all fields for every non-Keep candidate. The skill should say so.
- **Where lane records and plans live.** No artifact location is given. I used a gitignored scratch path and later moved everything to `.oat/repo/analysis/`.
- **Test-only hook, unwired product function, or documented export.** Lanes flagged all of these as "test-only":
  - production functions with no production caller (`recoverCursorStateStore`, `classifyTranscript`);
  - a documented extension-point export (`encodeCwd`);
  - dead code in another owner.

  The skill's hook definition ("exported internal, reset function, or test-only flag") does not separate these. I had to decide that unwired product functions and documented exports are product decisions, not hooks.
- **When settling injections run.** audit.md requires a deliberate failure to settle a non-obvious Covered proof before deletion. campaign.md mentions injections only in step 6. I ran the settling injections during cutover, before each deletion, and chose extra targeted injections in step 6. campaign.md should say that step 5 runs the audit's settling checks.
- **"Record durable test-ownership rules … in the subsystem's agent instructions".** This assumes a subsystem instructions file exists; none did, so I used a subsection of `src/AGENTS.md`. Editing agent instructions is arguably outside "test and test-support edits". The campaign reference requires it, so I did it and said so.

## Too light (missing guidance that mattered)

- **A baseline taken on one machine is not the baseline.** Step 1 says to record every in-scope file's result at a pinned commit, but not where. I ran it locally on macOS and got 784/784. Linux CI had failed one in-scope test on every `main` push for four days, because its result depends on directory order. PR #106's CI surfaced it after the campaign had reported "no baseline failures". The failing test was kept, since the campaign had not changed it. The failure was a real product defect, fixed in PR #107. Suggested addition to step 1: record the latest CI result for the pinned commit alongside the local run, and treat a platform difference as a baseline failure to classify.
- **Cross-lane keeper conflicts.** Step 4 checks for redundant layers within a lane, but says nothing about keepers in other lanes. Two failures occurred:
  - **A keeper deleted elsewhere.** L2 planned deletions whose keeper L3 planned to delete.
  - **A mutual-keeper cycle.** L3 deleted O8 citing an integration test, while L5 deleted that integration test citing O8.

  I only caught these because I added a cross-lane check to the step-4 brief. Suggested rule: a keeper cited by any deletion is pinned in every lane, and the root checks the union of plans for cycles before cutover.
- **Order of carried assertions across lanes.** A "Moved" proof requires the assertion to land in the keeper before the deletion. When the keeper file belongs to another lane, cutover order matters. I ordered the landing lanes first. campaign.md step 5 says only "lane by lane".
- **Injections in a shared checkout.** Settling injections mutate production source, and keepers that run a generated bundle need a rebuild. Parallel lanes in one worktree would see each other's mutations. This forced sequential cutover, which took 41 of the 105 minutes. The skill should mention serializing, or giving each lane its own worktree.
- **Campaign-caused gap or pre-existing gap.** Step 6 asks reviewers for "contracts that lost their only proof". Two reviewer leads turned out to be uncovered at the baseline too. I could only separate them by running the same injection in a temporary baseline worktree. Suggested addition: when an injection leaves HEAD green, run it at the baseline. Red at baseline means a campaign gap to restore; green at both means a follow-up.
- **Hook removal can quietly weaken a keeper.** Removing the `tieWindowSec` option pushed a keeper onto the default path with a 3 s gap, so three boundary mutations passed. The removal was correct, but the test lost precision. Step 5 should say: when a hook is removed, recheck the precision of every keeper that used it.
- **Product defects found by reading, not by a baseline failure.** Step 7 covers "a baseline failure that survives into a keeper". Both defects here were found by lanes reading code in step 3 while every test passed: subcommand `--help` runs the command, and same-millisecond backup names collide. The skill has no route for these; I parked them for step 7.
- **Repository version fan-out.** This is not a skill defect, but a test-only campaign in this repo bumps four skills and two plugins and edits pinned release-test literals. A line such as "repository versioning and changelog rules apply to test-only edits" would set expectations.

## Too heavy

- **A record row for every Keep.** Of 534 recorded protections, most were Keep with one line each. The value was concentrated in the non-Keep candidates and the injections. Allowing Keep rows to be grouped per describe block, with a count and a single evidence line, would roughly halve step 3 with no visible loss.
- **Strict step gating.** "Finish each step before starting the next" meant defect reproduction (read-only) waited through steps 4–6, though it could have run in parallel. Read-only work for a later step could run early without breaking the gate's purpose.
- **Step 4 as a separate pass.** With the same agents resumed, step 4 took 2–4 minutes per lane and mostly did cross-lane reconciliation. If step 3 required the cross-lane pin check, steps 3 and 4 could merge for lanes with no redundant layers.

## Wrong or misapplied

- **"A value compared with itself" was misapplied.** A lane treated D50, which compared a digest built with the option unset against one built with `includeActivity: false`, as a circular self-comparison and replaced it. That removed the only direct proof of the default, which collab callers depend on. The review restored it. The circular-assertion wording should say explicitly that comparing two different inputs that should be equivalent (default versus explicit, or two paths to the same result) is an equivalence property, not circular.
- **Nothing else in the skill was factually wrong** for this repository.

## Steps skipped or adapted, and why

- **New worktree:** not created. The session already ran in a harness-created worktree on a new branch at current `main`, which met the requirement.
- **Step 1, baseline failure classification:** skipped because the local baseline was green. That was a mistake: CI showed an in-scope baseline failure that only happens on Linux. See the first item under "Too light".
- **Step 5, "register moved suites in CI routing and test inventories":** not applicable. The moved test landed in an existing suite covered by the Vitest include globs. I ran `docs-presence`, which pins test and fixture file names.
- **Step 7, repair with control and candidate:** skipped. The request did not authorize product fixes, so the defects are reported with reproductions only.
- **Step 8, base integration:** skipped. `main` gained no commits during the campaign.
- **Per-agent effort selection:** not possible. The host's Agent tool accepts a model but not an effort level, so the subagent-orchestration effort guidance could not be applied directly.

## What worked and should stay

- **The presumed-keeper rule.** Named-keeper proofs, with a settling injection, stopped over-deletion. L7 withdrew its only deletion, and L4 kept overlapping rows from fix PRs because no injection could separate them.
- **Deliberate failures before deletion, and before and after repairs.** "Stays green before the repair, fails after" was the most reliable signal in the campaign.
- **Independent reviewers per boundary group.** They found six real issues after the authors' own injections had all passed. The "new assertions that cannot fail" prompt found one.
- **One owner for shared support.** Only the shared-transcript lane touched fixtures and the fixture README. No fixture was deleted while still in use.
