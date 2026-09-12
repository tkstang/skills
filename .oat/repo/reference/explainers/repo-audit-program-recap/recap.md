# Repo-Audit Execution Program — Recap

## Executive summary

The repo-audit execution program took the fifteen external implementation plans
produced by a six-lane repository audit and drove all fifteen to `main` across
five sequenced waves, every wave landing on 2026-07-23 as its own pull request
(PRs #50, #51, #52, #53, and #59). The coverage invariant held all the way to
close: 15 of 15 plans done, none deferred and none dropped. The work spanned
correctness and security fixes, build- and release-contract guards, a large
code-consolidation pass, the CI and supply-chain surface, and finally two
god-module splits. The test suite grew from 1,090 to 1,170 passing tests, and
the whole program fanned in through 15 plan lanes (4+4+2+3+2 across the five waves)
plus 3 final-gate fix lanes with zero merge conflicts. The layered review
architecture — embedded
cross-model Codex rounds, adversarial phase reviewers writing their own probes,
and xhigh-effort final gates — caught at least 25 dispositioned findings before
merge, four of them Criticals, each with a stored verification record.

## What shipped, wave by wave

**Wave 1 — Correctness & security core.** A resumable deliberation session can
no longer be corrupted by a mid-write crash: atomic state writes (same-dir temp
plus fsync plus rename) now back the consensus records and loop-status files.
The alternating-provider recursion bypass (claude→codex→claude…) is closed —
the host guard now propagates depth across provider boundaries and blocks at the
limit. Session-observer locks record owner PIDs and reclaim a stale lock exactly
once per acquisition, closing a demonstrated lock-theft interleaving. A
three-week docs staleness backlog (CHANGELOG, README, CONTRIBUTING, marketplace
descriptions) was swept current.

**Wave 2 — Hardening & contract guards.** Consensus subprocess calls gained a
timeout with SIGTERM→SIGKILL escalation and a stdio-teardown safety net for
descendants that hold the pipes after a kill. The session-observer watch loop
stopped re-reading unchanged transcripts on every tick by adding an
`(path, mtime, size)`-keyed classification cache. Two contract guards landed:
the release version-bump tool now derives its skill list from disk instead of a
hand-maintained constant, and all hand-written build import-rewrites are now
derived from the TypeScript compiler API, byte-equivalent to the old tree.

**Wave 3 — Consolidation & tooling nets.** Seventeen byte-identical helpers
scattered across the create/decide/plan/evaluate command modules were extracted
into one shared `cli-helpers` module, with re-fork and panel-decoupling guard
tests protecting the new invariants; along the way a real validation-strictness
drift in the loop CLI's argument parsing was reconciled to the validated
canonical (a documented, user-visible tightening). The worktree and git-hook
scripts, previously covered only by brittle string-matching tests, gained
behavioral tests that execute them under stub harnesses.

**Wave 4 — CI & release surface.** Every workflow action is now SHA-pinned with
Dependabot keeping the pins current, install paths gained fail-closed checksum
verification, and a PR-time docs build gate was added. The live-provider E2E
path was converted from a silent skip into a run-or-waive gate that fails loudly
when a live run is requested without a usable provider — and it immediately
earned its keep: an accidental single live call surfaced a real stub-vs-live
`verdict_source` mismatch, filed as `BL-260723-investigate-live-submit`.

**Wave 5 — God-module splits.** The two largest files became thin facades over
cohesive modules with no behavior change: `consensus-loop.ts` went from 4,074 to
a 1,125-line facade over 7 runtime modules, and `consensus-refine.ts` from 3,890
to 1,138 over another 7. Public surfaces are byte-identical (98/98 and 24/24
exports), the generated wrapper outputs are OID-identical, and this was the
program's only final gate to close with zero findings.

## What the layered review caught

The review architecture is expensive by design, and the defects it caught
before merge are the clearest evidence it earned that cost. In Wave 1, after a
cross-model Codex round had already passed a lock-reclaim fix, the phase
reviewer's own interleaving analysis found a reclaim **TOCTOU** Critical that the
Codex pass had missed — the two review layers were complementary, not redundant.
Wave 2's final gate reproduced an **output-cap hang** with a purpose-built probe,
and surfaced a **transitive skill-version gap** that spanned two waves. Wave 3's
final gate caught a **`GIT_CONFIG_*` isolation escape** in the test harness,
now closed by scrubbing the whole environment-variable prefix rather than named
variables. Wave 4's live gate exposed the **stub-vs-live `verdict_source`
mismatch** described above — precisely the drift class it was built to expose.
Across the program the same machinery dispositioned at least 25 findings, four of
them Criticals, every disposition backed by a stored verification record.

## Process learnings graduated to rules

Several operating frictions were resolved into standing rules during the
program: a hard cap of two cross-model review rounds per lane, with the phase
reviewer owning fix verification beyond that; anchored insertion for appends to
shared config files, which kept the largest diffs conflict-free; poll-until-
registered CI watching before trusting a checks report; pre-gate scaffold-
readiness ordering; and the discovery that OAT's status parser requires the
literal `## Phase <number>:` heading form, a latent template gap that waves 1–4
had silently shared.

## Disclosures and open threads

Two process incidents are disclosed in the program record. Wave 3's PR was
merged while its checks report was still empty; the tree was certified
retroactively against `main`'s green Validate run on the identical commit, and
the poll-until-registered rule was adopted and used for the remaining waves.
During the Wave 5 merge, a mistyped merge command (`gh pr merge 54`) landed
Dependabot's deploy-pages 4.0.5→5.0.0 bump ahead of schedule; it was benign
(a CI-green pin update through the wave-4 automation) and left in place.
Separately, the operator-mandated `sol` review model was unavailable on this
Codex account for every final gate, so the account-default Codex model at xhigh
reasoning effort substituted, flagged in each wave's gate artifact and PR
description.

On follow-ups, the program bumped skill versions to refine 0.1.9, evaluate
0.1.9, panel 0.1.2, create/decide/plan 0.1.6, session-observer 1.0.7, and
export-session-transcript 1.0.4. Four follow-up backlog items were filed during
the program and remain open: the remaining consensus-loop atomic write sites,
the transitive shared-runtime version guard, the loop-free `cli-helpers` core
split, and the live-submit `verdict_source` investigation.

<!-- traceability: exec-summary c01 c06 c07 c08; wave1 c02; wave2 c03; wave3 c04; wave4 c05; wave5 c06; layered-review c02 c03 c04 c05 c08; process-rules c10; disclosures c11 c12; follow-ups c09 -->
