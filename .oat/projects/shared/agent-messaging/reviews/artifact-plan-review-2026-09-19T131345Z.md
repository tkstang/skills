---
oat_generated: true
oat_generated_at: 2026-09-19T13:13:45Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/agent-messaging
oat_gate_headless: true
oat_gate_run_id: 94c9a069-05df-4541-84ef-5b56f699c674
oat_gate_target: claude-fable-skip-permissions
oat_gate_runtime: claude
oat_invocation_model: fable
oat_invocation_reasoning_effort: provider-default
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-09-19T13:13:45Z
**Scope:** Fifth gate review of the revised `plan.md` for the quick-mode `agent-messaging` project, against `discovery.md` and the amended `design.md`, at HEAD `6c718f223921b891cbd9ecf49d720ca7b0534d12`
**Files reviewed:** 5 (`plan.md`, `design.md`, `discovery.md`, `state.md`, `implementation.md`), the fourth archived gate review, and the observer sources that p04-t01 names
**Commits:** not applicable (artifact review has no git range)

## Summary

No blocking findings. The five corrections from the fourth gate review
(`reviews/archived/artifact-plan-review-2026-09-19T125014Z.md`) are present and
agree across plan, design and discovery. The Claude composed path now has an
owner, files, tests and a verification list in p04-t01, and every source seam
that task names exists in the repository today. Two Medium findings remain,
both inside p04-t01: an interrupted observation attempt has no stated recovery
or status outcome, and the task is large and unstaged compared with the
precedent the plan set for p03-t02. Two Minor findings are wording and test
coverage gaps.

Findings: 0 critical, 0 important, 2 medium, 2 minor

**Dispatch audit:** `Dispatch: scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:opus effort_axis=not-applicable dispatch_policy=high dispatch_ceiling=opus target=opus`
That stamp is the managed project reviewer resolution, copied verbatim from the
resolver's `dispatchStamp`. This review did not run on that target: it is
gate-originated, and the gate resolves its exec target independently of the
project dispatch ceiling.
`Gate route: inline (runtime=claude, cliRoot=/Users/tstang/Library/pnpm/store/v11/links/@open-agent-toolkit/cli/0.2.79/8ca9b56072295bbba9acd47c440b3cf7b78bcdb55a6cc290bf101117d76b5c8b/node_modules)`.
The route helper reported that the runtime marker matched and that model
evidence was unavailable. The frontmatter records the configured invocation
only; it is not a runtime identity observation.

## Findings

### Critical

None

### Important

None

### Medium

- **An interrupted observation attempt has no recovery or status outcome** (`plan.md:735-744`, `plan.md:283-289`, `plan.md:760-762`; `design.md:326-343`, `design.md:499-504`)
  - Issue: p04-t01 derives the observation event key from the activation, the
    owner and peer pins, the selected range and the selected-prefix identity,
    and explicitly excludes the wall clock and the re-arm lease ID. It then
    claims the event and a shared slot before the private-cursor CAS. If the
    runner dies after the event claim and before the CAS or the emit, the
    private cursor has not moved. With a quiet peer the next run selects the
    same range, derives the same key, finds the event already claimed and emits
    nothing, for the rest of the activation. The design accepts this
    under-delivery for message batches because explicit retry is the recovery
    (`design.md:328-332`). That recovery is keyed by message:
    `delivery retry --message`, stored under
    `retries/<participantId>/<priorAttemptId>.json`, with retry generations
    folded into delivery keys. An observation claim has no message ID and no
    retry generation, so none of it applies. p02-t01's status contract says a
    known incomplete stage reports "interrupted attempt — retry available" with
    an exact retry command (`plan.md:286-289`). For an observation attempt that
    text would be wrong. The Verify list names "interrupted output" and
    "same-range re-arm dedup" but gives no expected outcome for the interrupted
    case, so the implementer has to invent one.
  - Fix: Add two or three sentences to p04-t01. The smaller option stays within
    the approved protocol: status shows an interrupted observation attempt as
    its own kind, with the peer range and no retry command, and the stated
    recovery is the normal explicit observer catch-up read, which advances the
    cursors the usual way and so changes the next selected range. Give the
    "interrupted output" test that expected result, and add a case for a kill
    between the slot and the CAS followed by a re-arm against a quiet peer. If
    the user would rather have automatic recovery, an observation retry
    generation in the key is a protocol addition and returns to them under
    `plan.md:57-58`.

- **p04-t01 is a single unstaged commit across three owners plus final acceptance** (`plan.md:683-780`; precedent at `plan.md:597-607`)
  - Issue: One task extends the lease owner-runtime contract and the control
    re-arm path, adds a new bundled entrypoint with its declaration and build
    entry, adds observation claims to the shared runtime, flips the
    messaging-side capability label in the CLI, registration and watch,
    rewrites three docs pages, bumps versions, regenerates two distribution
    forms, and then repeats the full repository checks and conditionally closes
    the backlog item. The third gate raised the same concern about p03-t02, and
    the plan answered it with ordered stages and green focused suites between
    them. p04-t01 touches a comparable file set and has no such checkpoints. A
    failure late in the task leaves one large uncommitted change with no green
    intermediate state to return to. The user approved adding exactly one task
    (`discovery.md:155-156`), so splitting the ID is not the remedy.
  - Fix: Keep the one task ID and one atomic commit, and add an "Ordered
    implementation stages" block like p03-t02's:
    1. Lease owner-runtime extension and the composed initial/re-arm control,
       with `control.test.ts` and the existing Codex and Cursor hook suites
       green. This shows the existing records and adapters are unchanged before
       anything new depends on them.
    2. `claude-monitor.mjs`, the observation claims, and the monitor,
       packaging and composition suites green.
    3. The messaging-side capability flip and docs, then the complete Verify
       list and the repeated p03-t03 checks.

    Backlog closure stays the last step, as written.

### Minor

- **p04-t01 changes the lease contract that `owner-contract.test.ts` pins, but does not list that test** (`plan.md:711-716`, `plan.md:405-412`, `plan.md:757`)
  - Issue: p02-t02 pins messaging's independent lease reader to the observer's
    exported contract with `owner-contract.test.ts`, and p03-t02 keeps it in
    both Modify and Verify. p04-t01 widens that contract. `OWNER_RUNTIMES`
    currently rejects anything but `codex` and `cursor`
    (`src/skills/session-observer-collab/src/lib/lease-state.mjs:80-87`), and
    after this task a lease with a `claude-code` owner is valid. The test is in
    neither list for p04-t01. The full `pnpm run test` run in the repeated
    p03-t03 checks will still execute it, so existing assertions cannot
    silently break. What is missing is a fixture that says what messaging's
    reader does with a `claude-code` owner lease: refuse standalone ownership,
    and recognize it only for a verified composed epoch.
  - Suggestion: Add `src/skills/agent-messaging/src/owner-contract.test.ts` to
    p04-t01's Modify and Verify lists, with a `claude-code` owner lease case
    for both outcomes.

- **p03-t03 still tells the implementer to format the backlog item "before archiving it", though archiving moved to p04-t01** (`plan.md:671-677`, `plan.md:639`, `plan.md:667-668`, `plan.md:777`)
  - Issue: p03-t03's Format block carries the backlog stdin command with the
    words "before archiving it", while the same task says final acceptance and
    backlog closure belong to p04-t01 and that the backlog stays open. p04-t01
    points back to "p03-t03's exact stdin command". The command is right and
    lives in a reasonable place, but a p03-t03 implementer reading the Format
    block on its own could edit or archive the item early. The block also names
    `apply_patch`, a tool specific to one host.
  - Suggestion: Reword to "p04-t01 uses this command when it closes the backlog
    item; p03-t03 does not change that file", or move the command into
    p04-t01's Format block. Replace "apply_patch" with "the host's file-edit
    tool".

## Requirements/Design Alignment

**Evidence sources used:** `plan.md`, `discovery.md`, `design.md` (present and
approved, so used although optional in quick mode), `state.md`,
`implementation.md`, the fourth archived gate review, observer-collab
`build.json`, `lib/lease-state.mjs`, `lib/runtime-adapter.mjs`,
`lib/selected-prefix.mjs`, `lib/completion-selection.mjs`, `collab-control.mjs`,
`hooks/codex-stop.mjs`, the base `session-observer/src/lib/digest.ts` and
`observe.ts`, `src/distributions.ts`, `package.json` scripts, `.oxfmtrc.json`,
the backlog item's acceptance criteria, and the quick-start skill's
`oat_template` rule.

Checked directly in this pass:

- Fourth-round Important (Claude composed path): resolved. p04-t01 names a new
  observer-collab entrypoint, its declaration, build entry, tests, the lease
  and control changes, and a Verify list with Claude composed cases
  (`plan.md:685-766`). p03-t02 now reports `composed-monitor-unavailable` for
  Claude until then and tests that (`plan.md:565-569`, `:620-621`). p03-t03
  labels it pending (`plan.md:648-649`). Design section 7 and discovery record
  the user's choice (`design.md:481-514`, `discovery.md:149-156`).
- The seams p04-t01 depends on exist: `buildDigest` and `observeCatchUp` in the
  base skill (`digest.ts:1063`, `observe.ts:1516`);
  `selectCompletedContinuation` (`completion-selection.mjs:360`);
  `observeCursorCompletion` (`selected-prefix.mjs:157`); `advanceAdapterCursor`
  and `claimAdapterTrigger` (`runtime-adapter.mjs:272`, `:349`);
  `generated-runtime.d.ts` and `runtime-claude-code-reference.test.ts`.
- The claim that the base reader is already a permitted bundled dependency is
  true. `src/distributions.ts:201-204` lists `src/skills/session-observer` in
  observer-collab's `allowedSourceRoots`, and `hooks/codex-stop.mjs:5` and
  `lib/selected-prefix.mjs:6` already import `buildDigest` from it. No base
  skill edit or version bump is needed.
- The warning against the generic arm path is grounded. `arm` in
  `collab-control.mjs` defaults `cursor` to 0 (`:178-180`) and writes a fresh
  lease with `continuationCount: 0`. `claimAdapterTrigger` only proceeds for
  `armed` or `waiting` leases (`runtime-adapter.mjs:231-234`), which matches
  the plan's explicit re-arm between runs.
- Fourth-round Medium (Claude inventory): resolved. The inventory is loaded
  settings plus enabled installed plugins, catalog copies are ignored,
  session-scoped frontmatter hooks are a disclosed visibility limit, and
  fixtures cover each (`plan.md:347-359`, `:426-429`; `design.md:425-434`).
- Fourth-round Minor 1 (triggered leases): resolved the conservative way, with
  the reason recorded (`plan.md:382-394`; `design.md:402-413`). `effectiveLease`
  still only retires `armed` and `waiting` (`lease-state.mjs:504-544`), and
  `disarm --session` exists (`collab-control.mjs:338`, `:401-402`).
  Expired-triggered refusal, byte-unchanged lease state and enable after
  explicit disarm are listed as tests.
- Fourth-round Minor 2 (activation shape): resolved. p02-t01 publishes the full
  schema-v1 shape, and a readability test for phase-2 records after composition
  is listed (`plan.md:270-275`; `design.md:642-646`).
- Fourth-round Minor 3 (baseline pointer): resolved. The header names
  `c0a61d53` and tells the implementer to carry the latest committed project
  (`plan.md:28-33`).
- `git merge-base origin/main HEAD` is still
  `d74abe671561053154d3012e1b8edd11fc079dcf`, matching p03-t03.
- Every existing file the plan modifies is present, and every script it invokes
  exists in `package.json`. `src/skills/agent-messaging/` and
  `src/shared/collaboration/` are absent, which matches their Create entries.
- The plan's directory-wide `oxfmt --write` commands would not rewrite
  untouched files today. `oxfmt --check` over
  `src/skills/session-observer-collab` and the other existing paths reports all
  54 files clean, and `**/fixtures/**` is ignored by `.oxfmtrc.json`.
- 13 unique task IDs, monotonic within each phase. `implementation.md` and
  `state.md` agree on 4 phases and 13 tasks. All prior Reviews rows are
  preserved. `oat_template: true` is the quick-start ownership marker, not a
  leftover placeholder.
- The core project artifacts were clean in git before this review.

No `## Dispatch Profile` section is present; that is normal and not a finding.
The sequential-phase claim remains consistent with the shared write sets.

### Requirements Coverage

| Requirement (discovery success criterion / design component)           | Status  | Notes                                                            |
| ---------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| N>=3 messaging with observation disabled, concurrent senders           | covered | p01-t02, p01-t03, p01-t05                                        |
| Per-recipient acks, identifiable replay, no silent loss                | covered | p01-t01, p01-t03                                                 |
| Start/stop integration only for active participants, finite budgets    | covered | p02-t01, p02-t02                                                 |
| Messages survive restart; no always-on wake promise                    | covered | p01-t03, p02-t03                                                 |
| Same storage and Markdown log across worktrees; concurrent log appends | covered | p01-t01, p01-t04, p03-t01                                        |
| Optional observation, separate state, messages before catch-up         | covered | p03-t01, p03-t02, p04-t01                                        |
| Status exposes identity, pending/acked, capability, paths              | partial | p01-t05, p02-t01; observation-attempt status unstated (Medium 1) |
| Defined outcomes for malformed, replay, crash, ambiguity, expiry       | partial | p01-t01 to p02-t01; interrupted observation attempt (Medium 1)   |
| Design §1 identity, takeover                                           | covered | p01-t02, p01-t05                                                 |
| Design §2-§3 storage and publication                                   | covered | p01-t01                                                          |
| Design §4 messages and receipts, composed-session ID dedup             | covered | p01-t03, p03-t02                                                 |
| Design §5 activation, claims, limits, retry                            | covered | p02-t01                                                          |
| Design §6 adapters, Monitor, disclosure, ownership policy, probes      | covered | p02-t01 to p02-t04                                               |
| Design §7 composition, controller binding, shared log                  | covered | p03-t01, p03-t02                                                 |
| Design §7 Claude composed Monitor                                      | covered | p04-t01; staging (Medium 2), parity fixture (Minor 1)            |
| Design §8 closeout, trust, retention                                   | covered | p01-t02, p01-t05, p02-t02, p02-t03                               |
| Ownership, packaging, versions, changelog, docs                        | covered | p01-t05, p03-t01, p03-t03, p04-t01                               |
| Backlog closure for BL-260619                                          | covered | p04-t01, conditional on acceptance criteria                      |

### Extra Work (not in declared requirements)

None. The dedicated Claude composed Monitor traces to the user's fourth-gate
decision recorded in `discovery.md:149-156`.

## Verification Commands

```bash
# Medium 1: the observation key excludes clock and lease ID, and retry is keyed by message
sed -n 735,744p .oat/projects/shared/agent-messaging/plan.md
grep -n "delivery retry\|retry available\|interrupted" .oat/projects/shared/agent-messaging/plan.md
sed -n 326,343p .oat/projects/shared/agent-messaging/design.md
# after the fix, p04-t01 should state the interrupted-observation outcome
sed -n '/### Task p04-t01/,/^## Reviews/p' .oat/projects/shared/agent-messaging/plan.md | grep -n -i "interrupted"

# Medium 2: p03-t02 has ordered stages; p04-t01 should have them too
grep -n "Ordered implementation stages" .oat/projects/shared/agent-messaging/plan.md   # expect two matches after the fix

# Minor 1: the pinned contract that p04-t01 widens
sed -n 80,87p src/skills/session-observer-collab/src/lib/lease-state.mjs
sed -n '/### Task p04-t01/,/^## Reviews/p' .oat/projects/shared/agent-messaging/plan.md | grep -n "owner-contract"   # expect a match after the fix

# Minor 2
grep -n "before archiving" .oat/projects/shared/agent-messaging/plan.md

# Prior fixes stay resolved
grep -n "composed-monitor-unavailable\|claude-monitor.mjs\|Activation schema-v1\|disarm --session" .oat/projects/shared/agent-messaging/plan.md
grep -n "src/skills/session-observer'" src/distributions.ts
git merge-base origin/main HEAD   # expect d74abe671561053154d3012e1b8edd11fc079dcf
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
