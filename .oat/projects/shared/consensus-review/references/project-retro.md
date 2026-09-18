---
oat_retro_project: consensus-review
oat_retro_generated: '2026-09-17T23:39:32Z'
oat_retro_evidence_sources:
  - source: project-log
    status: used
  - source: oat-execution-learnings
    status: unavailable
  - source: lifecycle-artifacts
    status: used
  - source: active-review-markdown
    status: used
  - source: archived-review-markdown
    status: used
  - source: gate-receipts
    status: used
  - source: session-transcript
    status: used
oat_retro_promotions: none
oat_retro_filing: complete
oat_generated: true
oat_template: false
---

# Project Retrospective: Consensus Review

## Executive Summary

Consensus Review delivered a bounded, independent review skill with one canonical implementation, two generated install forms, explicit scope, host-aware single-reviewer selection, external run state, strict result validation, and deterministic Markdown and JSON. Fourteen tasks across p06-p09 completed, the terminal premerge suite passed 2,030 tests with one skipped, and configured exit-gate attempt 2 passed and was received. At generation time, PR #91 was open; merge, release, global installation, fresh-session discovery, and live-provider acceptance were outside the verified boundary.

The run was technically successful because independent reviews repeatedly examined failure seams rather than only happy paths. They found and closed symlink containment, recursion-depth, stale-evidence, provenance, atomic-publication, bounded-read, host-detection, fixture-binding, and unsafe-input defects. The main workflow cost came from orchestration state: a wrong dispatch base created a zero-work terminal run, Git-hook index locking complicated OAT path-scoped commits, review status drift consumed extra cycles, and gate receipts remained clone-local while project state called them durable.

The retrospective proposes one repository backlog item and four OAT upstream items. None is an immediate documentation, instruction, rule, or decision promotion.

## Evidence and Review Method

The review used the chronological `project-log.md`; discovery, design, plan, implementation, state, summary, decision records, receipt exercise, PR artifact, and documentation artifacts; active and archived review Markdown; both configured-gate result receipts; and the original project-run session transcript for operator corrections and closeout friction. The five decision records were treated as the durable source for accepted design choices. Review claims were cross-checked against task commits, later passing reviews, current state, and terminal verification.

No `oat-execution-learnings.md` exists for this project, so that evidence family is unavailable. The session transcript is used only for original-run events not fully represented elsewhere, including the operator correction about the Refine test and the closeout adapter-version mismatch. It is not substituted for durable product verification.

Causes are labeled confirmed only where artifacts or repeated observations establish them. The exact mechanism behind the Git hook/index-lock interaction remains inconclusive even though the repeated symptom and safe recovery are confirmed. Current state is taken from `state.md`; `summary.md` is generation-time analysis and contains now-stale closeout wording.

## Outcome Snapshot

| Area | Outcome |
| --- | --- |
| Delivered scope | One canonical `consensus-review` skill; standalone and plugin-local generated forms; exactly three selectors; one reviewer attempt; external private state; strict schema and deep validation; deterministic four-severity output. |
| Decisions | Five durable records cover executable ownership, selectors, host-aware single review, external scoped state, and deterministic result contract. |
| Implementation | 14/14 active tasks completed across p06-p09. |
| Independent review | p06, p07, p09, pre-gate final, and post-gate final reviews passed their blocking thresholds after bounded fixes. |
| Configured gate | Attempt 1 produced four accepted p09 tasks; attempt 2 passed with 0 Critical, 0 Important, 1 Medium, and 1 Minor, both nonblocking findings explicitly dispositioned. |
| Verification | 142 test files and 2,030 tests passed with one skipped, plus build, type-check, generated freshness, validation, smoke, skill-version/changelog, internal-flag, PJM, changed-file static, and docs-build checks. |
| Delivery | At generation time, PR #91 was open, final HiLL approval and post-implementation sequencing were complete, and the project was not archived. |
| Unverified boundaries | At generation time: merge, release, global/external installation, fresh-session discovery, native continuation, and live-provider execution. |

## Current State

- **Promotions:** None; there are no RP items with `Disposition: apply`.
- **Filing:** Complete; RP-01 was settled by direct implementation, UP-01 links to an exact existing issue, and UP-02 through UP-04 were filed as new issues.
- **Unsettled items:** None in the retrospective registers. PR #91 awaits human review and merge; live-provider and release acceptance remain unverified.

## What Went Well

- The implementation preserved one canonical owner and generated both distribution forms from it. This kept runtime behavior, versions, changelog entries, tests, and shipped payloads aligned.
- The scope reduction was disciplined. Three explicit selectors and selected-path drift evidence replaced a wider selector set and whole-worktree hashing, while the resulting evidence limitations were stated rather than hidden.
- Independent review was effective at boundary failures. The p06 review caught canonical-path escape and malformed inherited depth; p07 caught capture-to-baseline drift, false provenance, unborn-repository handling, missing identities, and missing diagnostic persistence; final review caught partial publication and concurrent-growth reads; the configured gate caught mixed host markers, explicit-parent handling, fixture binding, and unsafe request-file types.
- Fixes were bounded and verified in both canonical source and copied-install behavior where applicable. Passing re-reviews preserved exact artifacts and reviewed heads instead of overwriting history.
- The exit-gate result was interpreted honestly. Passing the Important threshold was not treated as “no findings”; the remaining Medium and Minor observations were correlated, reviewed, and explicitly rejected with rationale.
- The operator correction about the Refine peer-order test was honored. The test was deterministic and host-sensitive, not flaky and not a p06 defect; PR #89 fixed it on main, and this branch did not modify the test.

## Challenges and Struggles

### Dispatch and resume-state failures

Implementation first paused because `implementation.md` pointed to p06-t01 while `state.md` had no current task. The user approved reconciliation before product work began. The first accepted p06 dispatch then carried a full base SHA that differed from clean HEAD. The implementer correctly failed closed before edits, tests, or recovery use, but the accepted run became terminal and required a new user-authorized run. These events are recorded by `consensus-review-resume-drift-20260917T0022Z`, `consensus-review-p06-blocked-20260917T0048Z`, and `consensus-review-stop-base-mismatch-20260917T0048Z`.

The failure was avoidable: bookkeeping changed HEAD after the dispatch base had been prepared. The workflow should capture and validate the exact base only after all pre-launch writes.

### Verification attribution during p06

After the two p06 task commits, verification found three attributable inventory omissions and one Refine peer-order failure outside the p06 surface. The phase stopped before review and requested direction. The user authorized a narrow recovery for the inventory files; `a1b2b427` fixed them. Fable then clarified that the remaining Refine failure inherited host markers from the runner environment and deterministically changed peer order under Codex. Main PR #89 (`6eb5fd8c`) pinned the test host; merging current main at `9cfe41ac` removed the baseline failure.

The initial baseline disposition was safe, but describing the failure as flaky would have been wrong. Environment-sensitive tests must be reproduced with controlled host markers before attribution.

### Safety defects exposed by independent review

The first p06 review found that an external Codex capture destination could traverse a symlink back into the reviewed worktree and that malformed inherited depth silently reset recursion depth. The p07 review then found a capture-to-baseline mutation window, inaccurate reviewer provenance, unborn-repository failures, omitted Git identities, and missing durable diagnostics. Later final review found partial Markdown publication on write failure and an unbounded read when a request file grew concurrently. Each set blocked progression until fixed and re-reviewed.

These were not random test gaps. They clustered at filesystem, process, identity, and evidence boundaries where lexical checks, permissive parsing, pre-open validation, and requested-versus-observed metadata can fail open.

### Recovery, gate expansion, and lifecycle bookkeeping

p08 used two bounded recoveries: wall-clock metadata contradicted deterministic rendering, and a manifest test retained the old plugin version. Configured exit-gate attempt 1 then expanded the seven-task p06-p08 plan into 14 tasks through p09. Four findings became explicit tasks covering shared mixed-marker host priority, explicit-parent authority, renderer-to-fixture byte equality, and pre-open rejection of symlinks and FIFOs.

After product behavior was correct, three narrow post-gate review cycles were still needed to repair stale “pending” prose, broken PJM links, and a reintroduced `review_pending` status. Append-ordered review provenance was preserved, but duplicated mutable status made the workflow costly and error-prone.

### OAT commit and receipt friction

The scaffold's path-scoped commit and the planning gate's automatic project-log commit both collided with a hook index lock on OAT 0.2.77. Recovery waited for the lock to clear, staged the exact path, committed normally with hooks enabled, and replayed the idempotent recovery. No lock was deleted and no hook was bypassed. The repeated symptom is confirmed; the underlying Git/index mechanism is not.

At generation time, configured-gate state referred to a “durable” result receipt under the shared project, but both receipt files were untracked and clone-local. That left shared lifecycle state dependent on evidence that a fresh clone could not obtain and kept the worktree intentionally dirty.

### Closeout adapter-version skew

During closeout, the repository-local `oat-explainer-kit` adapter expected core 2.1 and rejected the installed core 3.0, while the current user-level adapter accepted core 3.0 and successfully recorded the explicit recap skip. This was recovered without changing product code. Because the current repository and user copies no longer show a behavioral difference beyond generated metadata, the incident is retained as a version-coherence gotcha rather than filed as a separate upstream item without stronger reproduction evidence.

## Decision Register

| Decision | Rationale | Consequence | Durable record |
| --- | --- | --- | --- |
| Skill-owned executable | Both install forms need identical behavior without coupling the Consensus dispatcher to a product skill. | Canonical skill source owns the executable and build closure; generated outputs must move together. | `DR-260917-skill-owned-review-executable` |
| Three explicit v1 selectors | Implicit or broad scope would weaken intent and evidence. | Base diff, selected files, or one document only; missing scope is gathered interactively or rejected non-interactively. | `DR-260917-explicit-v1-review-selectors` |
| Host-aware single review | Review is independent inspection, not convergence or retry orchestration. | Ordered defaults, host exclusion, explicit same-provider consent, one attempt, and no hidden fallback. | `DR-260917-host-aware-single-review` |
| Scoped external state | Review runs should not add unrequested files to the worktree. | State is private and external; stability claims are limited to selected-path and Git evidence. | `DR-260917-scoped-external-review-state` |
| Deterministic review contract | Peer output alone cannot be treated as host evidence or a clean review. | Review owns schema, semantic validation, evidence aggregation, and deterministic rendering; OAT integration remains optional. | `DR-260917-deterministic-review-contract` |

No missing project decision record was identified. Later fixes hardened these decisions without changing them.

## Rejected or Superseded Alternatives

- A wider initial selector set and whole-worktree hashing were superseded by three selectors and selected-path drift evidence. The smaller contract reduced v1 complexity but does not claim complete filesystem isolation.
- A `consensus review` dispatcher subcommand was rejected in favor of a skill-owned executable shared by both generated install forms.
- Automatic repair, retry, model fallback, and provider fallback were rejected because they hide extra invocations and weaken independent-review provenance.
- Current renderer-byte receiver re-execution was not converted into required debt. Historical receiver compatibility and current renderer byte identity remain separate, explicitly disclosed evidence families.
- Broader Markdown escaping was rejected at the final gate because the renderer already escapes the required table-control characters and additional escaping would change deliberate presentation semantics.
- Staged-only, unstaged-only, and committed-range selectors remain demand-triggered future possibilities, not promised backlog work.

## Where We Changed Course

- Resume-state mismatch triggered an operator-approved pointer reconciliation, after which execution began at p06-t01.
- A wrong base SHA caused a zero-work terminal p06 run; a new user-authorized run replaced it without mutating the failed history.
- Three inventory omissions triggered narrow p06 recovery; the separate Refine failure stayed external until main's PR #89 fix was merged.
- Independent reviews converted boundary defects into bounded fix iterations, followed by clean re-reviews.
- Configured-gate attempt 1 turned four findings into p09-t01 through p09-t04, growing the project from seven planned tasks to 14 completed tasks.
- Gate attempt 2 passed its threshold; its remaining findings were explicitly dispositioned rather than silently added to scope.

## New Architecture Patterns and Approaches

- **Canonical skill-owned runtime with generated install forms.** The runtime belongs to the product skill, while standalone and plugin-local packages are reproducible projections. This avoids divergent implementations and avoids making OAT a shipped dependency.
- **Capture, revalidate, dispatch.** Scope and evidence are captured, selected inputs and Git identities are revalidated immediately before provider invocation, and post-run evidence is compared over the declared coverage. This addresses stale-evidence races without claiming universal sandboxing.
- **Host-aware, single-attempt routing.** Host identity is resolved once and reused for preflight and dispatch. Explicit parent context is authoritative; ambient markers follow a stable compatibility priority; contradictory explicit context fails closed.
- **Strict peer-output boundary.** Provider output is data, not proof. A deep validator enforces structural and semantic consistency before deterministic rendering, while host evidence and limitations are added separately.
- **Atomic outcome publication.** Final Markdown or diagnostic publication uses exclusive, all-or-nothing behavior so a reported path never points at partial output.

## Domain Learnings

- Filesystem confinement requires canonical destinations, exclusive creation, regular-file checks before open, and bounded descriptor reads. Lexical path checks alone do not stop symlink traversal or FIFO blocking.
- Recursion protection is a safety boundary. Malformed inherited depth and contradictory explicit host context must fail closed; ambient multi-host markers require a stable compatibility rule.
- Requested model and effort are not observed reviewer identity. Provenance must distinguish configured intent, selected provider, actual transport, Git identities, and result validation.
- Determinism includes metadata. A renderer cannot claim byte stability while embedding wall-clock timestamps.
- Fixture equality and receiver compatibility answer different questions. Proving current fixture bytes match the renderer does not prove a receiver exercised those exact bytes.
- A passed severity threshold does not mean a clean review. Receipt correlation and explicit disposition of all remaining findings are still required.

## Gotchas for Humans

- Re-read clean `HEAD` after every bookkeeping commit and immediately before accepting a phase dispatch.
- Control inherited Claude, Codex, and Cursor environment markers when reproducing host-sensitive tests; do not label a deterministic environment-dependent failure flaky.
- Move canonical source, metadata versions, changelog entries, generated payloads, inventories, manifests, and manifest tests together.
- Do not delete `.git/index.lock` reflexively. Establish whether a Git process owns it, wait for safe clearance, keep hooks enabled, and prefer idempotent recovery.
- Treat `summary.md` as generation-time analysis. Use `state.md` and the append-ordered project log for current lifecycle status and historical events.
- Keep fixture receipt, live-provider, external install, fresh-session discovery, release, and merge acceptance as distinct evidence layers.

## Gotchas for Autonomous Agents

- Reject a dispatch packet whose exact 40-character base does not equal current clean HEAD; do not consume product work or recovery budget.
- Preserve failed runs, review artifacts, invocation identities, reviewed heads, and event order. Correct current status without rewriting historical provenance.
- Revalidate captured content and identities immediately before dispatch; pre-dispatch capture alone is not stable evidence.
- Treat symlinks, FIFOs, non-regular inputs, malformed depth, contradictory explicit hosts, and partial result writes as fail-closed conditions.
- Attribute verification failures by changed surface and controlled reproduction. Separate mechanical recovery from unrelated baselines and request direction when scope would expand.
- Correlate configured-gate receipts by project, run, invocation, artifact, and reviewed head before receiving them. Record lower-severity dispositions even when the threshold passes.
- Verify that a lifecycle adapter and its core are a compatible installed pair before invoking closeout actions; route to a coherent pair rather than treating version skew as a product blocker.

## Repo Improvements (Promotion Register)

### RP-01: Exclude generated provider skill mirrors from repository-wide lint

- **Type:** code-follow-up
- **Disposition:** file
- **Status:** rejected
- **Destination:** —
- **Destination-receipt:** —
- **Remote-visibility:** —
- **Sanitized:** no
- **Disposition-note:** Filing declined in favor of direct implementation; commit `2787eb44` added provider-mirror exclusions and regression coverage.

Repository-wide `pnpm lint` follows tracked `.claude/skills/**` symlinks into generated `.agents/skills/**`, creating a baseline failure outside authored product source. Extend the static lint exclusion contract to generated provider mirrors, including Cursor where applicable, and add regression coverage proving those mirrors are excluded while `src/skills/**` remains linted. Evidence: `state.md` Verification and `reviews/archived/final-review-2026-09-17T053248Z.md` Verification Results.

## OAT Upstream Feedback (Upstream Register)

### UP-01: Capture and validate phase dispatch bases after pre-launch bookkeeping

- **Status:** filed
- **Destination:** https://github.com/voxmedia/open-agent-toolkit/issues/265
- **Destination-receipt:** —
- **Remote-visibility:** —
- **Sanitized:** yes
- **Disposition-note:** Linked to exact existing issue #265 without modifying it.

An accepted p06 packet carried a full base SHA different from clean HEAD, producing a terminal zero-work run. Persist all root bookkeeping first, then capture and re-read HEAD immediately before launch; populate every dispatch-base field from that value and fail locally before accepting a child if they diverge. Evidence: project-log events `consensus-review-p06-blocked-20260917T0048Z` and `consensus-review-stop-base-mismatch-20260917T0048Z`, plus `implementation.md` Orchestration Run 1.

### UP-02: Make review and lifecycle status transitions atomic

- **Status:** filed
- **Destination:** https://github.com/voxmedia/open-agent-toolkit/issues/305
- **Destination-receipt:** —
- **Remote-visibility:** —
- **Sanitized:** yes
- **Disposition-note:** Filed as new issue #305; related issues #233 and #194 cover different mechanisms.

Multiple reviews found stale `fixes_added`, stale pending prose, broken archived-backlog links, and a reintroduced `review_pending` value after product fixes were complete. Define one structured authority or helper for review-event, phase, and routing status; update dependent artifacts atomically or derive their current views. Add a consistency invariant before the next review. Also clarify or synchronize secondary fields such as `oat_hill_completed` and gate `attempts_completed` so they cannot disagree with the authoritative status. Evidence: archived final reviews at `2026-09-17T055634Z`, `2026-09-17T071244Z`, and `2026-09-17T072611Z`, plus fixes `8d8ff233`, `738e566c`, and `084cbffd`.

### UP-03: Make exact-path OAT commits compatible with Git hooks

- **Status:** filed
- **Destination:** https://github.com/voxmedia/open-agent-toolkit/issues/306
- **Destination-receipt:** —
- **Remote-visibility:** —
- **Sanitized:** yes
- **Disposition-note:** Filed as new issue #306; related issue #213 is limited to gate-owned project-log commits.

On OAT 0.2.77, both a scaffold path-scoped commit and the planning gate's automatic project-log commit collided with a hook index lock. A normal exact-staging commit with hooks preserved, followed by idempotent recovery, succeeded. Reproduce exact-path commits under hook-managed repositories and provide one hook-safe primitive that preserves unrelated staged state and verifies the committed paths. The repeated symptom and workaround are confirmed; the precise Git/index mechanism remains inconclusive. Evidence: `state.md` Operational Notes.

### UP-04: Define portable ownership and cleanup for configured-gate receipts

- **Status:** filed
- **Destination:** https://github.com/voxmedia/open-agent-toolkit/issues/307
- **Destination-receipt:** —
- **Remote-visibility:** —
- **Sanitized:** yes
- **Disposition-note:** Filed as new issue #307.

Shared project state records a configured-gate result receipt as durable, but the receipt directory remains untracked and clone-local. Define one supported lifecycle: persist sanitized receipts with project-scope storage and push, or use a stable ignored runtime location with portable correlation data and deterministic cleanup. Shared state should not require unavailable local evidence or leave the worktree permanently dirty. Evidence: `state.md` `launch_result_receipt`, `implementation.md` Orchestration Run 5, and the current untracked `gate-receipts/` directory.

## Remaining Boundaries and Follow-Ups

- At generation time, RP-01 and UP-01 through UP-04 awaited a filing decision; none had been filed by this retrospective.
- At generation time, PR #91 awaited human review and merge, and `oat-project-complete` had not archived the project.
- At generation time, live-provider execution, external/global installation, native continuation, fresh-session discovery, release, and merge acceptance were unverified and required separate authorization and evidence.
- The historical receiver exercise and current renderer-byte equality remain separate accepted evidence families. A current-byte receiver rerun is optional acceptance work, not undisclosed debt.
- Wider selectors remain deliberately deferred until a concrete request cannot be expressed by the three v1 selectors.

## Reflections

The project became trustworthy through explicit limits and adversarial inspection, not through test volume alone. The strongest reviews targeted the seams where one subsystem's assumptions became another subsystem's evidence: paths crossing process boundaries, requested configuration becoming claimed identity, captured bytes becoming stability claims, and renderer fixtures becoming interoperability claims.

The technical design held while the workflow around it showed avoidable friction. Future runs should make dispatch bases, current lifecycle status, hook-safe commits, and receipt ownership mechanical invariants. Doing so would preserve the review rigor that improved the product while reducing the bookkeeping cycles needed to prove that the work was complete.
