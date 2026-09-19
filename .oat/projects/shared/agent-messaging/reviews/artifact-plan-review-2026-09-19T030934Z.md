---
oat_generated: true
oat_generated_at: 2026-09-19T03:09:34Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/agent-messaging
oat_gate_headless: true
oat_gate_run_id: 09f3c2b9-f6ec-4cda-91f4-966ba80a9f20
oat_gate_target: claude-fable-skip-permissions
oat_gate_runtime: claude
oat_invocation_model: fable
oat_invocation_reasoning_effort: provider-default
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-09-19T03:09:34Z
**Scope:** Third gate review of the revised `plan.md` for the quick-mode `agent-messaging` project, against `discovery.md` and the approved `design.md`, at HEAD `e287517c1c6f319706df544e90da4d1bfdfe3a83`
**Files reviewed:** 5 (`plan.md`, `design.md`, `discovery.md`, `state.md`, `implementation.md`), both archived prior reviews, and the repository sources the plan names
**Commits:** not applicable (artifact review has no git range)

## Summary

One blocking finding. The four corrections from the second gate review
(`reviews/archived/artifact-plan-review-2026-09-19T021241Z.md`) are present and
accurate against the repository: p03-t02 now owns the composed-controller
exception with the messaging files and suites, p02-t02 names the detection
contract and pins it with `owner-contract.test.ts` using exports that exist,
both `SKILL.md` files own the exact-ID dedup rule, and the stdin formatter
command runs cleanly. The blocking finding is in the ownership rule those
corrections completed. As written, a recognized observer Stop registration
refuses ownership even with no lease, and any opaque third-party Stop hook
counts as an uncertain owner. The only recorded target host has both, so
`delivery enable` would refuse there in phase 2 and still refuse after p03-t02.
The first half of that rule follows wording this reviewer suggested in the
first gate review; the refusal on registration alone was too broad.

Findings: 0 critical, 1 important, 1 medium, 2 minor

**Dispatch audit:** `Dispatch: scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:opus effort_axis=not-applicable dispatch_policy=high dispatch_ceiling=opus target=opus`
That stamp is the managed project reviewer resolution, copied verbatim. This
review did not run on that target: it is gate-originated, and the gate resolves
its exec target independently of the project dispatch ceiling.
`Gate route: inline (runtime=claude, cliRoot=/Users/tstang/Library/pnpm/store/v11/links/@open-agent-toolkit/cli/0.2.79/8ca9b56072295bbba9acd47c440b3cf7b78bcdb55a6cc290bf101117d76b5c8b/node_modules)`.
The route helper reported that the runtime marker matched and that model
evidence was unavailable. The frontmatter records the configured invocation
only; it is not a runtime identity observation.

## Findings

### Critical

None

### Important

- **The owner-refusal rule disables all automatic delivery on the recorded target host, before and after composition** (`plan.md:329-344`, `plan.md:369-371`, `plan.md:428-431`, `plan.md:502-512`; `design.md:393-398`, `design.md:417-419`, `design.md:460`; `discovery.md:30-32`, `discovery.md:159-160`)
  - Issue: p02-t02 refuses messaging automatic ownership when "an effective
    observer-collab Stop registration or active observer lease" exists, and its
    Verify list names "existing observer Stop registration" as a refusal case
    separate from "active same-session observer lease". Registration alone
    therefore refuses. The same task adds "unreadable, unknown or opaque
    potentially continuing registrations mean uncertain owner, not absence",
    and p03-t02 keeps that refusal for "unknown, mismatched, legacy or
    uncomposed registrations". Three facts make this rule over-broad:
    - The observer registration is global and persistent by design. Uninstall
      is a separate explicit user choice
      (`src/skills/session-observer-collab/references/runtime-codex.md:113-116`,
      `:199-203`), and `design.md:460` keeps global hooks installed. The
      observer hook is provably inert for a session with no lease:
      `runCodexStopHook` returns `allow('missing')`
      (`src/skills/session-observer-collab/src/hooks/codex-stop.mjs:211`). A
      registration without a same-session lease cannot emit a continuation,
      so it is not a competing owner.
    - A read-only look at this machine's `~/.codex/hooks.json` shows two Stop
      registrations: the observer launcher (`session-observer-collab-stop.mjs`,
      timeout 65) and an unrelated shell notifier (`agent-shell-notify.sh`,
      timeout 5). The first triggers the registration-alone refusal. The second
      is a shell script that cannot be classified "without executing" it, so it
      is an opaque potentially continuing registration and also refuses.
    - Refusal happens at `delivery enable`, so no activation epoch is
      published. The turn-start context hook is a no-op without an activation
      (`plan.md:327` "inactive-session no-op"), so the refusal removes
      turn-start delivery too, even though `design.md:404-405` says start
      checks are not a second autonomous wake owner.

    The result on the only host where Codex delivery evidence has ever been
    recorded: `delivery enable` refuses in phase 2, the p02-t04 Codex live
    probe refuses at its own precondition (`plan.md:428-431`), and after
    p03-t02 a messaging-only session still refuses because of the third-party
    Stop hook. That leaves discovery decision 4 and the success criterion
    "supported start/stop integration checks only active participants"
    unreachable for Codex, and it would surface only at p02-t04 or later, after
    the refusal tests are written. The design requires one continuation owner
    between messaging and observation and says "preserve unrelated hooks"; it
    does not make every unrelated Stop hook a disqualifier. That broadening is
    a product tradeoff the user has not been asked about (`plan.md:55-56`).

  - Fix: State the ownership truth table in p02-t02 and carry it into p03-t02.
    A minimal version:
    - Recognized observer registration with no valid lease for the exact
      session: not an owner, because that hook is inert without a lease. Keep
      the boundary-time recheck so a lease armed after enable still refuses.
    - Recognized observer registration with an active or unreadable lease for
      the exact session: owner or uncertain, so refuse. This is today's rule.
    - Unrecognized third-party Stop registration: needs a user decision. The
      options are to refuse as written and accept that hosts with any other
      Stop hook stay manual, to list the exact commands in the first-enable
      disclosure and proceed on explicit operator acknowledgment recorded in
      the activation epoch, or to refuse only the Stop mechanism while still
      allowing activation for turn-start context. The last option adds a
      start-only mechanism that `design.md:523` does not have, so it is a
      design change.

    Update the p02-t02 Verify cases to match: registration without a lease
    enables, and registration with a same-session lease refuses. In p03-t02,
    say which controller a messaging-only session selects when a
    composed-capable observer hook is registered but holds no lease, because
    "uncomposed registrations still refuse" currently reads as refusing that
    case.

### Medium

- **p03-t02 is no longer one bounded, atomic task** (`plan.md:474-534`)
  - Issue: After the second-round corrections this task modifies about 30
    files across three owners: six observer runtime modules and their
    `.d.mts` declarations, four observer suites, three runtime references, the
    shared `types.ts`, `activation.ts` and `claims.ts`, the messaging CLI,
    registration, two or three hook adapters, watch, five messaging suites, and
    both `SKILL.md` files. Its Verify line runs 12 suites. It lands as one
    commit with two skill version bumps. It also carries three separable
    concerns: binding a controller to the activation epoch, observer delegation
    to shared claims with inbox-first selection, and the agent-facing dedup
    instructions. A defect in any one of them is hard to isolate in review or
    bisect, and a phase implementer holding all of it at once is where the
    context-heavy mistakes will come from. The user kept task counts unchanged
    when approving the prior fixes, so this is a call for them to make rather
    than a defect in how the corrections were applied.
  - Fix: Split along the seam that is already independently committable.
    First, shared controller binding plus the messaging-side composed exception
    (CLI enable, registration, hooks, watch, and their suites), tested against
    an observer fixture. Until the observer side lands nothing is verified as
    composed-capable, so behavior stays fail-closed. Second, observer adapter
    delegation, shared slot before CAS, the composition suite, both `SKILL.md`
    files, and the references. Renumber the docs task to p03-t04 and update the
    phase and total counts. If the user prefers one task, keep it and require
    the implementer to stage the work in that order with the focused suites
    green between stages.

### Minor

- **The lease-liveness rule treats a `triggered` observer lease as "no owner" within the same Stop** (`plan.md:347-349`, `plan.md:315-317`)
  - Issue: The plan defines an active lease as one that `effectiveLease`
    leaves `armed` or `waiting`. When the observer emits its continuation,
    `compareAndSwapTrigger` moves the lease to `triggered`
    (`src/skills/session-observer-collab/src/lib/lease-state.mjs:716`). With the
    default zero wait, the messaging hook reads the lease early and refuses. A
    session that opted into the reply-wait window (up to 60 seconds) rechecks
    ownership at final validation. It can then see `triggered`, conclude that
    no owner exists, and return a second block decision for the Stop the
    observer just continued. The next Stop is covered by the conservative
    continuation-marker rule, so the exposure is that single boundary.
  - Suggestion: In p02-t02, count `triggered` as owner-present for boundary
    checks, leaving only `idle` and `disarmed` as inactive. Add a fixture case
    in `owner-contract.test.ts` for a lease that flips to `triggered` during a
    messaging reply-wait.

- **Claude's "proven single-owner host inventory" has no named evidence source** (`plan.md:350-352`, `plan.md:387`)
  - Issue: The plan correctly notes that the observer's Claude Monitor leaves
    no lease. `validateOwnerRuntime` accepts only `codex` and `cursor`
    (`src/skills/session-observer-collab/src/lib/lease-state.mjs:81-88`). It then
    requires "a proven single-owner host inventory" without saying what
    constitutes proof. A CLI cannot enumerate Monitor tools running inside a
    Claude session; only the acting agent knows what it armed. As written, the
    implementer has to choose between always-manual on Claude and an invented
    attestation.
  - Suggestion: Name the mechanism in p02-t02 or p02-t03. For example, the
    skill instructs the acting session to confirm that no observer Monitor is
    armed and to pass an explicit flag that `watch` and `delivery enable`
    record in the activation epoch, and `runtime-claude-code.md` documents that
    this is an agent attestation, not a host inventory. Or state plainly that
    Claude automatic delivery stays manual until p03-t02 composes the Monitor
    owner.

## Requirements/Design Alignment

**Evidence sources used:** `plan.md`, `discovery.md`, `design.md` (present and
approved, so used although optional in quick mode), `state.md`,
`implementation.md`, both archived gate reviews, observer-collab
`lib/lease-state.mjs`, `lib/codex-install.mjs`, `codex-lifecycle.mjs`,
`hooks/codex-stop.mjs`, `references/runtime-codex.md`,
`references/runtime-claude-code.md`, the documentation tree, and a read-only
listing of the hook events in this machine's `~/.codex/hooks.json`.

Checked directly in this pass:

- Second-round Medium 1 (composed exception owned by p03-t02): resolved.
  p03-t02 now lists the messaging CLI, registration, hooks, watch, their five
  suites, and the shared activation/claims suites in Modify and Verify, and it
  states the composed-versus-competing rule (`plan.md:484-514`, `:521-530`).
- Second-round Medium 2 (detection contract pinned): resolved and accurate.
  `leasePath`, `LEASE_SCHEMA_VERSION = 6`, and `effectiveLease` are exported
  from `lease-state.mjs:18`, `:213`, `:504`. `codexStopCommand` is exported from
  `codex-lifecycle.mjs:166`, and `installCodexStopBundle` from
  `codex-install.mjs:175`. `BUNDLE_OWNER` is a private constant
  (`codex-install.mjs:15`), as the plan says. `hooksPath` and `scriptPath` are
  caller-supplied and validated as absolute (`codex-lifecycle.mjs:96-100`). The
  locally installed launcher is named `session-observer-collab-stop.mjs`, which
  confirms the plan's point that the launcher location is not fixed.
- Second-round Minor 1 (exact-ID dedup guidance): resolved. Both `SKILL.md`
  files are owned by p03-t02, with a generated-form review step
  (`plan.md:489-490`, `:516-519`, `:529-530`).
- Second-round Minor 2 (stdin formatter command): resolved. Running
  `pnpm exec oxfmt --stdin-filepath=agent-messaging-backlog.md` on the backlog
  item exits 0, and the item is already format-clean.
- Every observer file p03-t01 and p03-t02 modify exists, including all six
  `.d.mts` declarations. `messaging-composition.test.ts` and
  `shared-log.test.ts` are absent, which matches their Create entries. Every
  docs path p03-t03 modifies exists, and
  `documentation/docs/engineering/architecture/agent-messaging.md` is absent as
  expected.
- `git merge-base origin/main HEAD` is still
  `d74abe671561053154d3012e1b8edd11fc079dcf`, matching p03-t03.
- The project artifacts were clean in git before this review. Task IDs are
  stable and monotonic. No task was added or renumbered by the corrections. All
  prior Reviews rows are preserved.

No `## Dispatch Profile` section is present; that is normal and not a finding.
Plan frontmatter `oat_template: true` with `oat_status: in_progress` is the
quick-start pre-readiness state, not a defect. The sequential-phase claim
remains consistent with the shared write sets.

### Requirements Coverage

| Requirement (discovery success criterion / design component)           | Status  | Notes                                                                             |
| ---------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| N>=3 messaging with observation disabled, concurrent senders           | covered | p01-t02, p01-t03, p01-t05                                                         |
| Per-recipient acks, identifiable replay, no silent loss                | covered | p01-t01, p01-t03                                                                  |
| Start/stop integration only for active participants, finite budgets    | partial | p02-t01, p02-t02; owner rule refuses enable on the recorded host (Important)      |
| Messages survive restart; no always-on wake promise                    | covered | p01-t03, p02-t03                                                                  |
| Same storage and Markdown log across worktrees; concurrent log appends | covered | p01-t01, p01-t04, p03-t01                                                         |
| Optional observation, separate state, messages before catch-up         | covered | p03-t01, p03-t02; messaging-only controller with a registered observer hook (Imp) |
| Status exposes identity, pending/acked, capability, paths              | covered | p01-t05, p02-t01                                                                  |
| Defined outcomes for malformed, replay, crash, ambiguity, expiry       | covered | p01-t01 to p02-t01                                                                |
| Design §1 identity, takeover                                           | covered | p01-t02, p01-t05                                                                  |
| Design §2-§3 storage and publication                                   | covered | p01-t01                                                                           |
| Design §4 messages and receipts, composed-session ID dedup             | covered | p01-t03, p03-t02                                                                  |
| Design §5 activation, claims, limits, retry                            | covered | p02-t01                                                                           |
| Design §6 adapters, Monitor, disclosure, probes, diagnostics           | partial | p02-t01 to p02-t04; owner rule (Important), Claude proof source (Minor 2)         |
| Design §7 composition and shared log                                   | covered | p03-t01, p03-t02; task size (Medium), `triggered` state (Minor 1)                 |
| Design §8 closeout, trust, retention                                   | covered | p01-t02, p01-t05, p02-t02, p02-t03                                                |
| Ownership, packaging, versions, changelog, docs                        | covered | p01-t05, p03-t01, p03-t03                                                         |
| Backlog closure for BL-260619                                          | covered | p03-t03, conditional on acceptance criteria                                       |

### Extra Work (not in declared requirements)

Refusing automatic delivery because of any opaque third-party Stop registration
goes beyond the design's one-owner rule between messaging and observation. It
is a defensible safety posture, but it is a product decision with a usability
cost. See the Important finding.

## Verification Commands

```bash
# Important: the observer hook is inert without a lease
sed -n 205,213p src/skills/session-observer-collab/src/hooks/codex-stop.mjs

# Important: Stop registrations present on this host (read-only)
node -e 'const j=JSON.parse(require("fs").readFileSync(process.env.HOME+"/.codex/hooks.json","utf8"));for(const g of (j.hooks??j).Stop??[])for(const h of g.hooks??[])console.log(h.command,h.timeout)'

# Important: after the fix, p02-t02 should state both cases
sed -n '/### Task p02-t02/,/### Task p02-t03/p' .oat/projects/shared/agent-messaging/plan.md | grep -n -i "no lease\|without a lease\|third-party\|acknowledg"

# Minor 1: the state written when the observer emits a continuation
grep -n "'triggered'" src/skills/session-observer-collab/src/lib/lease-state.mjs

# Minor 2: observer leases exist only for codex and cursor owners
sed -n 81,88p src/skills/session-observer-collab/src/lib/lease-state.mjs

# Prior fixes stay resolved
grep -n "owner-contract.test.ts\|stdin-filepath" .oat/projects/shared/agent-messaging/plan.md
git merge-base origin/main HEAD   # expect d74abe671561053154d3012e1b8edd11fc079dcf
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
