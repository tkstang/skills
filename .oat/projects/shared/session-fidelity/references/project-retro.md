---
oat_retro_project: session-fidelity
oat_retro_generated: 2026-09-20T13:21:19Z
oat_retro_evidence_sources:
  - source: gate-receipts
    status: used
  - source: git-history
    status: used
  - source: github-pr-state
    status: used
  - source: lifecycle-artifacts
    status: used
  - source: oat-execution-learnings
    status: unavailable
  - source: project-log
    status: used
  - source: review-artifacts
    status: used
  - source: session-transcript
    status: used
oat_retro_promotions: complete
oat_retro_filing: proposed
oat_generated: true
oat_template: false
---

# Project Retrospective: session-fidelity

## Executive Summary

The project delivered an opt-in, source-attributable activity view for session
observation and transcript export, plus the identity and provenance hardening
needed to make stateful behavior safe. The implementation completed 29 tasks,
passed its final independent review with no findings, and passed the full local
validation suite. PRs #94 and #95 are merged. PR #96 is open, mergeable, clean,
and has seven successful checks at generation time.

The technical result is strong because reviews repeatedly tested the evidence
boundaries rather than only the happy path. The run was less efficient than it
could have been: identity semantics required several correction rounds,
lifecycle summaries drifted after late fixes, gate bookkeeping competed for the
Git index, and a squash merge required recovery of the upper stack. The next
improvements should make closeout state derived, make documentation generation
non-mutating, harden gate finalization, and remove a timing-sensitive watch
test.

## Evidence and Review Method

This retrospective reviewed the project log, design, specification, plan,
implementation ledger, summary, documentation record, phase and final review
artifacts, gate receipts and raw gate diagnostics, Git history, the current
session transcript, and live GitHub state for PRs #94 through #96. The expected
`oat-execution-learnings` file was absent and is recorded as unavailable rather
than treated as an empty source.

Claims below are marked by strength in their wording. Statements grounded in
artifacts, Git, or GitHub are confirmed. Proposed improvements are hypotheses
about how to prevent recurrence. One Cursor checkpoint concern raised by a gate
review remained inconclusive because focused exactly-once probes passed and no
divergence was reproduced.

## Outcome Snapshot

| Area                   | Outcome                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Delivered scope        | Exact identity and source binding, fail-closed state reuse, corrected Claude provenance, detailed JSONL provenance, shared activity extraction/correlation/projection, and opt-in observer/exporter delivery |
| Compatibility boundary | Default digest and export behavior remains unchanged when `--include-activity` is absent                                                                                                                     |
| Verification           | 2,247 tests passed with one expected skip; type checking, build freshness, validation, smoke, version checks, lint/format checks, docs build, and fixture privacy checks passed                              |
| Independent review     | All 13 phase reviews completed; the final post-p12 review reported zero findings                                                                                                                             |
| Publication            | PR #94 and PR #95 merged; PR #96 is open, non-draft, mergeable, clean, and green at generation time                                                                                                          |
| Work tracking          | `BL-260916-session-fidelity-opt` was satisfied and archived                                                                                                                                                  |
| Outside this run       | Release, installation, global user-skill sync, and live-provider acceptance were not performed                                                                                                               |

## Current State

- **Promotions:** Complete; RP-01 was applied.
- **Filing:** Proposed; RP-02 and UP-01 through UP-03 are unfiled.
- **Unsettled items:** RP-02, UP-01, UP-02, and UP-03.

## What Went Well

- The project preserved a narrow user-facing contract. Activity is a separate
  optional envelope and export section; existing consumers remain on the
  established path unless they opt in.
- Transition audits found malformed-header selection, provenance ownership,
  interruption outcomes, incomplete lineage, duplicate previews, and delivery
  omissions before later phases depended on them. These audits were especially
  valuable at the identity and projection seams.
- Formal review supplied useful independent pressure. The p02 review found
  original-argument loss, source-snapshot drift, metadata-only byte overflow,
  and incomplete invocation ceilings. Remote review of PR #95 found three more
  fail-closed identity gaps. Each accepted finding received a bounded fix and a
  fresh zero-finding review.
- Sanitized captures and privacy canaries made provider evidence inspectable
  without committing sensitive transcript content. The implementation kept
  opaque or unmatched native evidence out of rendered output.
- The three-layer PR stack kept documentation, identity, and activity changes
  independently reviewable. Although late lower-layer fixes caused rebase work,
  the boundaries made the risk and ownership of each correction clear.
- Generated-output ownership, skill versions, changelog entries, and all
  declared distributions were reconciled before closeout.

## Challenges and Struggles

### A portable behavior fix stopped on a non-portable assertion

The p01 `--mark-read` correction behaved correctly on an `EISDIR` state
failure: it exited nonzero, emitted no digest, and preserved state. Its test
required a pathname in Node's platform-dependent error text. The configured
recovery limit therefore produced a terminal stop after the failed assertion,
even though the product behavior was sound. After the user resumed the run, the
test asserted the stable contract—error class, exit status, and empty
stdout—and the focused and phase suites passed. The incident is recorded by
`sf-p01-terminal-20260919` and `sf-stop-recovery-20260919` in the project log.

### Evidence integrity needed repeated correction

Identity and activity logic crossed discovery, caches, saved state, native
provider records, correlation, projection, and export. Early audits and p01
review corrected malformed first-header handling, unsafe state fallback,
provenance overwrite, and later-header takeover. PR #95 then exposed a weak
persistent-cache signature, invalid present lineage values collapsing to
omission, and invalid exporter candidates escaping the last boundary. Activity
review likewise required two fix rounds before final-format budgets, source
snapshot metadata, inherited calls, and unknown invocations were all honest.
The response was to fail closed at every stateful boundary and to bind reports
to the exact evidence read. The p02 round-three, p12, and final reviews all
passed with zero findings.

### Closeout artifacts drifted as the implementation moved

The first final review found that plan and PJM records contradicted the
completed implementation. Subsequent remote-review phases made the generated
summary stale twice more, producing p09 and p11 solely to realign lifecycle
artifacts. The current summary has drifted again because it still says PR #95
is open and both upper heads await publication, while GitHub shows #95 merged
and #96 rebased and green. The corrections maintained truthful records, but
manual snapshots proved too easy to invalidate after a new phase, rebase, or
merge.

### Stack recovery and bookkeeping added operational work

Accepted fixes in lower PRs required cascade rebases. After PR #95 was squash
merged, PR #96 had to be synchronized onto the new `main`; the final result is
clean, but prior review ancestry could no longer support a narrow re-review.
Separately, planning and exit-gate writers encountered `index.lock` contention.
One exit gate finished its substantive review but failed the project-log
auto-commit after three retries, requiring idempotent manual reconciliation.
The run correctly avoided deleting the lock and preserved the gate receipts.

### Tooling produced avoidable workspace churn

Documentation index generation rewrote `.oat/config.json` even though the
project did not intend a configuration change, so agents restored the original
bytes after each run. Raw gate diagnostics also retained machine-local absolute
transcript paths. No credential was found, but durable review evidence should
not depend on a particular user's home directory.

### One CI check was timing-sensitive

After the final squash rebase, the watch test for re-arming an exact Codex pin
after clean `SIGTERM` shutdown failed once in CI. The focused local test passed,
and the failed CI job passed on rerun without a code change. This does not show
a product defect, but it does show that the test is not yet deterministic under
CI scheduling.

## Decision Register

The load-bearing decisions were already captured and remained valid:

- `DR-260724-stateful-work-requires-exact` governs exact identity and source
  binding for saved state, caches, and pins.
- `DR-260514-digests-are-natural-language` keeps tool activity opt-in and
  separate from the default digest.
- `DR-260724-content-availability-is-not` separates evidence coverage from
  lifecycle and call outcomes.
- `DR-260724-separate-observation` keeps observation progress distinct from
  collaboration authority.
- `DR-260603-watch-event-logs-are-metadata` keeps activity content on the
  digest path and watch events metadata-only.

The project also retained line numbers and decoded-record indices while
deferring new per-record byte ranges until a consumer needs them. Existing
Cursor continuity positions and UTF-8 output budgets were not removed. No new
decision record is justified by this retrospective.

## Rejected or Superseded Alternatives

- A selective design pass was superseded by a complete design after native
  identity and provenance defects proved inseparable from safe activity work.
- Timing, command text, and cross-stream heuristics were rejected for call/result
  correlation. Only unique explicit native identity can establish a match.
- Recursive child-session ingestion, arbitrary output-path traversal,
  sidecars, reasoning bodies, and speculative provider shapes were excluded
  from the first increment.
- New per-record byte ranges were deferred; physical line and logical record
  provenance covered the current pointing and diagnostic use cases.
- Runtime task notifications were not reclassified as authenticated automatic
  control wakes. They remain provenance-bearing transcript content.

## Where We Changed Course

- Dogfooding exposed native identity and Claude provenance defects, so the
  project expanded from activity presentation to the minimum identity layer
  required for safe stateful behavior.
- Complexity review removed speculative enrichments and fixture approval
  machinery, preserving a dependency-free activity pipeline with explicit
  omissions.
- Review feedback split the work into documentation, identity, and activity
  PRs and later added bounded phases p08, p10, and p12 for accepted remote
  findings.
- The user disabled further configured gate reviews late in the run after
  repeated gate/bookkeeping friction. Independent subagent review remained the
  final verification path and reported zero findings.

## New Architecture Patterns and Approaches

The detailed JSONL reader separates physical input provenance from decoded
record semantics. Callers can retain one-based line numbers and zero-based
record indices without breaking the legacy `readRecords()` interface.

The activity pipeline keeps extraction, exact-ID correlation, range selection,
and presentation distinct. Native evidence remains complete until the final
projection applies UTF-8 budgets, escaping, and omission accounting. This keeps
display truncation from changing semantic outcomes.

Stateful operations bind identity, source path, and source signature before
reusing state. Missing or malformed present evidence fails closed. Stateless
review and export may still report pending or partial evidence, but they do not
invent completion, identity, usage, or result content.

## Domain Learnings

- Provider content can establish availability without establishing completion.
  Track coverage and outcome separately.
- Provenance must come from the selected native record and survive through the
  final projection. Content shaped like a provider envelope is not authority to
  overwrite explicit provenance.
- Correlation needs an explicit native relation. Temporal proximity and similar
  command text are useful debugging clues, not identity.
- Physical line numbers are stable diagnostic coordinates. Byte ranges require
  explicit CRLF and multibyte semantics and should be added only with a real
  consumer.
- Byte limits must be enforced on the final serialized representation. Bounding
  compact JSON does not prove that pretty JSON or Markdown remains within the
  same budget.

## Gotchas for Humans

- Merge or squash a stack from the bottom upward, then run remote stack sync
  before pushing the next layer. A squash changes ancestry even when the patch
  is equivalent.
- Recheck summaries and publication prose after every added phase, rebase, or
  merge. Generated lifecycle prose is a timestamped claim, not live state.
- When a canonical skill changes anywhere under its source directory, include
  the owner version, changelog entry, and every declared generated output in
  the same layer.
- Assert stable filesystem behavior such as error code, exit status, preserved
  state, and output absence. Do not require Node error strings to contain a
  pathname.
- Inspect `.oat/config.json` after documentation index generation until that
  command is made non-mutating.

## Gotchas for Autonomous Agents

- Treat a reported session ID, source path, cache entry, or saved position as a
  claim. Verify the exact native identity and source binding before stateful
  work.
- Do not read sidecars, recurse into child trajectories, or infer relations from
  time and text when the declared evidence source lacks a unique ID.
- Preserve the distinction between runtime notification provenance and
  authenticated automatic-control authority.
- After a squash merge, compare against the new remote base before reusing
  review ancestry or pushing an upper stack layer.
- Treat agent-reported commit hashes as claims; resolve the authoritative
  one-parent commit from Git before recording a receipt.
- Never delete `index.lock` to recover gate or bookkeeping work. Confirm the
  owner, retry a scoped commit, and preserve idempotent receipts.

## Repo Improvements (Promotion Register)

### RP-01: Refresh the project summary after the latest merge and rebase

- **Type:** docs
- **Disposition:** apply
- **Status:** applied
- **Target:** `.oat/projects/shared/session-fidelity/summary.md`
- **Applied-ref:** `.oat/projects/shared/session-fidelity/summary.md`
- **Disposition-note:** —

Update the overview and integration notes to record PR #95 as merged and PR
#96 as rebased, published, clean, and awaiting merge at the observed head. Keep
release, installation, global sync, and live-provider acceptance explicitly
outside the completed boundary. This removes a confirmed contradiction between
the generated summary and live GitHub state.

### RP-02: Make the exact-pin SIGTERM watch test deterministic

- **Type:** code-follow-up
- **Disposition:** file
- **Status:** proposed
- **Destination:** —
- **Destination-receipt:** —
- **Remote-visibility:** —
- **Sanitized:** yes
- **Disposition-note:** —

Investigate the one-off CI failure in the exact Codex pin re-arm test and
replace timing-sensitive coordination with an observable readiness or process
state boundary. Preserve the assertions that clean shutdown re-arms the exact
pin and does not replay delivered content. The focused test and CI rerun passed,
so this should be tracked as test hardening rather than a confirmed runtime
defect.

## OAT Upstream Feedback (Upstream Register)

### UP-01: Derive current lifecycle state and invalidate stale summaries

- **Status:** proposed
- **Destination:** —
- **Destination-receipt:** —
- **Remote-visibility:** —
- **Sanitized:** yes
- **Disposition-note:** —

New phases, review-fix receipts, publication heads, rebases, and merges can
invalidate a generated project summary while append-only ledgers remain
correct. OAT should expose one derived current-state projection and invalidate
or regenerate summary fields when those inputs change. Historical rows can
remain immutable while consumers receive one unambiguous current phase,
review, and publication state.

### UP-02: Keep documentation index generation non-mutating

- **Status:** proposed
- **Destination:** —
- **Destination-receipt:** —
- **Remote-visibility:** —
- **Sanitized:** yes
- **Disposition-note:** —

Documentation index generation repeatedly rewrote the project configuration
even when no configuration change was requested. The command should preserve
configuration bytes or stage an explicit, reviewable migration instead of
creating unrelated workspace churn that every caller must restore.

### UP-03: Harden durable gate finalization

- **Status:** proposed
- **Destination:** —
- **Destination-receipt:** —
- **Remote-visibility:** —
- **Sanitized:** yes
- **Disposition-note:** —

Gate review, structural project-log append, and root bookkeeping competed for
the same Git index, and one otherwise successful gate stopped at auto-commit
finalization. OAT should coordinate structural writers, preserve idempotent
recovery, and write path-neutral durable receipts. Raw liveness diagnostics may
retain richer local detail outside committed artifacts, but durable evidence
should not contain user-home transcript paths.

## Remaining Boundaries and Follow-Ups

PR #96 remains the only unmerged stack layer. Its observed head is clean and
green, but merge is a separate action. Release, installation, global user-skill
sync, and live-provider acceptance also remain separate lifecycle steps.

The project summary retains five lower-priority technical follow-ups: Codex
item/call relation evidence, nested web-search query carriers, Cursor final
records without a newline, Claude metadata-only watch deltas, and repeated
observer reads/warnings. Those remain hypotheses or deferred enhancements and
should enter the backlog only when product priority selects them.

## Reflections

The run showed that session fidelity is primarily an evidence-integrity
problem. The most trustworthy parts of the result came from requiring exact
identity, preserving native provenance, distinguishing absence from unknown,
and testing the final rendered boundary. Independent audits and reviews earned
their cost at those seams.

Future runs should spend less effort maintaining parallel lifecycle snapshots.
Derived closeout state, deterministic process tests, non-mutating generators,
and coordinated structural writers would reduce operational churn without
weakening the strict review and recovery behavior that made this result
credible.
