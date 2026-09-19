---
oat_generated: true
oat_generated_at: 2026-09-19T12:50:14Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/agent-messaging
oat_gate_headless: true
oat_gate_run_id: c94b55d0-0138-409d-aca6-ed4703fa8c99
oat_gate_target: claude-fable-skip-permissions
oat_gate_runtime: claude
oat_invocation_model: fable
oat_invocation_reasoning_effort: provider-default
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-09-19T12:50:14Z
**Scope:** Fourth gate review of the revised `plan.md` for the quick-mode `agent-messaging` project, against `discovery.md` and the amended `design.md`, at HEAD `c0a61d539c95f90b613b97ed07d5701c118ea015`
**Files reviewed:** 5 (`plan.md`, `design.md`, `discovery.md`, `state.md`, `implementation.md`), the third archived gate review, and the observer sources the plan names
**Commits:** not applicable (artifact review has no git range)

## Summary

One blocking finding. The four corrections from the third gate review
(`reviews/archived/artifact-plan-review-2026-09-19T030934Z.md`) are present in
plan, design and discovery, and they agree with each other: dormant observer
registrations no longer refuse, third-party Stop hooks use a recorded
acknowledgment, `triggered` leases count as owner-present, Claude uses an
acting-session attestation, and p03-t02 is staged. The blocking finding is the
Claude half of composition in p03-t02. The observer's Claude wake owner is a
Monitor around the base `session-observer` watcher, which has no claims, no
budget and no inbox knowledge, and that source is outside every task's file
list. As written, a composed Claude session gets no message notification and
its observation wakes never spend the shared budget, while the plan asserts
both. Phases 1 and 2 are not affected.

Findings: 0 critical, 1 important, 1 medium, 3 minor

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

- **Composed Claude delivery has no implementation path: the observer's Monitor owner lives in a skill no task touches** (`plan.md:513-527`, `plan.md:534-536`, `plan.md:543-546`, `plan.md:574-584`; `design.md:434`, `design.md:445-453`; `discovery.md:113-116`)
  - Issue: p03-t02 says "Reuse the verified Claude notification owner where
    composed", "Both modes share expiry and finite budget", and that under the
    observer controller "the standalone messaging Stop/watch entrypoints stay
    inert for that epoch". On Codex and Cursor the observer owner is a Stop
    hook inside `session-observer-collab` (`hooks/codex-stop.mjs`,
    `hooks/cursor-stop.mjs`), and the task lists those files, so delegation to
    shared claims is implementable. On Claude the observer owner is different:
    - The Monitor runs
      `node <session-observer-skill>/scripts/session-observer.mjs catch-up-then-watch ... --until-stopped`
      (`src/skills/session-observer-collab/references/runtime-claude-code.md:29-44`).
      That command is implemented in the base skill,
      `src/skills/session-observer/src/session-observer.ts:446` and `:1502`.
      It has no activation, claim, slot or inbox concept, and it runs until
      stopped.
    - No path under `src/skills/session-observer/` appears in any task's
      Create or Modify list, in the design's source seams
      (`design.md:736-738`), or in the design's packaging section. Observer
      leases do not exist for Claude owners
      (`src/skills/session-observer-collab/src/lib/lease-state.mjs:81-88`), so
      "reserve a shared slot before observer CAS" has nothing to attach to.
    - The p03-t02 Verify list has no Claude composed case. Its suites are the
      Codex hook, Cursor hook, control, wake-envelope and composition tests,
      and the named assertions are CAS and Stop-callback races.

    Taken literally, a composed Claude session ends up with messaging `watch`
    inert, an observer Monitor that never announces inbox requests, and
    observation wakes that never consume the shared budget. That contradicts
    the plan's own "exact shared cap" and "inbox-first selection" assertions
    for that host. It also matters for the topology this project was designed
    around: a Claude reviewer that already runs an observer Monitor cannot
    pass the p02 `--confirm-no-observer-monitor` attestation, so p03-t02 is
    its only route to automatic message notification. Choosing how to close
    the gap is a scope decision, not a wording fix, and `plan.md:55-56` sends
    that kind of decision back to the user.

  - Fix: Pick one and write it into p03-t02 (and the matching sentence in
    `design.md` section 7):
    - Defer Claude composed wake explicitly. The observer Monitor stays the
      single wake owner and is outside the messaging budget. Messages reach a
      composed Claude session through the turn-start check and the
      inbox-first skill instruction on any wake. Say in p03-t02, in
      `runtime-claude-code.md` and in p03-t03's docs that message arrival
      alone does not wake a composed Claude session and that the shared cap
      covers Codex and Cursor Stop composition only. Add a test that enable
      under the observer controller on a `claude-code` pin reports this
      capability label instead of "shared budget". This is the smaller option
      and matches how the plan already treats unknown Cursor boundaries.
    - Or build a single composed Monitor command. Name its owner and file
      (a new observer-collab entrypoint that wraps the base watcher, or a
      change to `src/skills/session-observer/src/session-observer.ts` with
      that skill's version bump and changelog entry), add it to Create or
      Modify, state where slots are reserved for transcript notifications,
      and add Claude composed cases to `messaging-composition.test.ts`. This
      enlarges a task the third review already flagged as oversized, so it
      likely needs its own task ID.

### Medium

- **The Claude Stop-hook inventory is not bounded, and the "cannot be waived" rule can make Claude delivery permanently manual** (`plan.md:337-347`, `plan.md:329`, `plan.md:423-425`; `design.md:385-386`, `design.md:413-414`)
  - Issue: p02-t02 requires inspecting "user, project and plugin/session
    scopes that host actually loads", and says host scopes that cannot be
    inventoried retain manual fallback that acknowledgment cannot waive.
    p02-t03 applies the same checks to every Claude watch start. For Codex the
    sources are files, so this works. For Claude two things are unresolved:
    - Skill and agent frontmatter hooks are scoped to the live session
      (`design.md:385-386`; the plan itself uses them at `plan.md:329`). A CLI
      cannot enumerate which of those are active. Read strictly, that is a
      scope that cannot be inventoried, so every Claude enable and watch start
      refuses and no acknowledgment can fix it.
    - Plugin hooks must be resolved through enabled-plugin state. A read-only
      look at this host found Stop entries in `~/.claude/settings.json` (two
      commands), in the installed `codex` plugin cache, and in four
      marketplace catalog copies that are not necessarily enabled. Counting
      catalog copies would produce a fingerprint for hooks that never run;
      skipping the plugin cache would miss one that does.

    The plan leaves the choice to whoever writes `runtime-claude-code.md`. The
    wrong strict reading repeats the third review's problem on Claude, and the
    wrong loose reading overstates what the inventory covers.

  - Fix: In p02-t02, define the Claude inventory as the settings files the
    host loads (user, project, local, managed) plus enabled plugins' hook
    declarations, and state that session-scoped frontmatter hooks are outside
    the inventory and are disclosed as a limit in the first-enable notice and
    the runtime reference, not treated as unreadable scope. Add fixture cases
    for an enabled plugin Stop hook, a catalog-only plugin that must be
    ignored, and an unreadable settings file that must refuse. If the user
    prefers the strict reading, say that Claude automatic delivery stays
    manual and drop the Claude watch acknowledgment path.

### Minor

- **`effectiveLease` never retires a `triggered` lease, so the new owner-present rule has no end for that state** (`plan.md:361-366`; `design.md:402-405`)
  - Issue: The plan says a lease is owner-present when `effectiveLease`
    leaves it armed, waiting or triggered "after expiry and continuation/loop
    caps are evaluated". `effectiveLease` applies expiry and caps only to
    `armed` and `waiting`
    (`src/skills/session-observer-collab/src/lib/lease-state.mjs:504-544`). A
    `triggered` lease stays `triggered` past `expiresAt` and past its caps.
    The observer itself treats that lease as dead: only `armed` and `waiting`
    are eligible (`lib/runtime-adapter.mjs:232`), and re-arm writes a new
    `armed` lease (`collab-control.mjs:222-236`). Under the plan's rule, a
    session whose observer collaboration ended on a final trigger refuses
    standalone messaging until someone disarms or prunes the lease, and the
    parity test pinned to `effectiveLease` would lock that in.
  - Suggestion: In p02-t02, treat a `triggered` lease at or after `expiresAt`
    as inactive, keep unexpired `triggered` as owner-present, and have the
    refusal notice name the observer disarm command. Add an expired-triggered
    fixture to `owner-contract.test.ts` and correct the sentence in
    `design.md:402-403` that attributes the evaluation to effective expiry.

- **The schema-v1 activation record changes shape in two later tasks, after p02-t04 may have written live records** (`plan.md:263-266`, `plan.md:310-312`, `plan.md:539-541`; `design.md:551-579`)
  - Issue: p02-t01 creates the immutable epoch record. p02-t02 adds the
    acknowledgment and attestation fields, and p03-t02 adds `controller`. All
    three are in the design's `Activation` type under `schemaVersion: 1`.
    p02-t04 allows authorized live probes against the real store before
    p03-t02. Records from those probes lack `controller`, and the plan's rules
    (malformed records fail closed, corrupt predecessors never prove
    termination, no cleanup) leave that session namespace unable to re-enable
    or report status under the p03 validator. The exposure is one probe
    session, but the fix costs one sentence.
  - Suggestion: Have p02-t01 write the full design shape from the first
    record: `controller: 'standalone-messaging'` and both nullable metadata
    fields. p02-t02 and p03-t02 then populate values without changing the
    record shape.

- **The plan's "Approved baseline" still names only the pre-amendment design commits** (`plan.md:28-31`; `design.md:711-716`)
  - Issue: The header cites peer review at `e95a0d91` and approval
    bookkeeping at `2d399c33`. The design was amended at `c0a61d53` with the
    user-approved ownership policy that p02-t02 and p03-t02 now depend on. The
    Execution Boundaries tell the implementer to carry "the approved baseline"
    into a new worktree, and a reader who checks out the cited commit gets a
    design without sections 6-7's ownership rules or the three activation
    fields.
  - Suggestion: Add one sentence to the header naming the 2026-09-19
    user-approved amendment and its commit.

## Requirements/Design Alignment

**Evidence sources used:** `plan.md`, `discovery.md`, `design.md` (present and
approved, so used although optional in quick mode), `state.md`,
`implementation.md`, the third archived gate review, the diff
`e287517c..c0a61d53` for all project artifacts, observer-collab
`lib/lease-state.mjs`, `lib/runtime-adapter.mjs`, `lib/codex-install.mjs`,
`codex-lifecycle.mjs`, `hooks/codex-stop.mjs`, `collab-control.mjs`,
`references/runtime-claude-code.md`, the base
`session-observer/src/session-observer.ts`, `package.json` scripts, and a
read-only listing of Stop hook registrations in this machine's Claude settings
and plugin directories.

Checked directly in this pass:

- Third-round Important (ownership rule): resolved. p02-t02 now states that a
  recognized observer hook without a same-session lease is inert and permits
  standalone messaging, refuses active or uncertain observer state, and
  requires `--acknowledge-stop-hooks <fingerprint>` for unrecognized Stop
  commands with a boundary recheck (`plan.md:330-358`). Its Verify list has
  the no-lease, idle and disarmed enable cases and the refusal cases
  (`plan.md:394-401`). p02-t03, p02-t04 and p03-t02 carry the same rule
  (`plan.md:423-425`, `:462-468`, `:546-551`). Discovery and design record the
  user's approval (`discovery.md:138-147`, `design.md:400-417`, `:711-716`).
  The source still supports the premise: `runCodexStopHook` allows stop when
  the lease is missing (`hooks/codex-stop.mjs:211`).
- Third-round Medium (p03-t02 size): resolved by the alternative the review
  offered. Two ordered stages with the five messaging suites plus the shared
  activation and claims suites green before stage 2, one atomic commit
  (`plan.md:562-572`). Task IDs and counts are unchanged.
- Third-round Minor 1 (`triggered`): applied (`plan.md:361-366`, `:396-397`).
  See the first Minor finding for the remaining edge.
- Third-round Minor 2 (Claude proof source): resolved for standalone mode. The
  attestation flag, its record in the activation, fresh confirmation on watch
  re-arm, and the statement that it is not host proof are all present
  (`plan.md:368-377`, `:400-401`, `:424-425`; `design.md:427-434`).
- Exports the plan pins still exist: `LEASE_SCHEMA_VERSION = 6`, `leasePath`
  and `effectiveLease` in `lease-state.mjs:18`, `:213`, `:504`;
  `codexStopCommand` in `codex-lifecycle.mjs:166`; `installCodexStopBundle` in
  `codex-install.mjs:175`; the private `BUNDLE_OWNER` marker at
  `codex-install.mjs:15`. Leases live at `<root>/leases/<ownerSession>.json`
  under the same root resolver the plan reuses (`lease-state.mjs:47-63`).
- Every script the plan invokes exists in `package.json`: `test:vitest`,
  `type-check`, `build`, `build:check`, `validate`, `smoke`, `test`,
  `worktree:validate`, `validate:skill-versions`.
- `git merge-base origin/main HEAD` is still
  `d74abe671561053154d3012e1b8edd11fc079dcf`, matching p03-t03.
- `src/skills/agent-messaging/` and `src/shared/collaboration/` are absent,
  which matches their Create entries. The backlog item exists.
- The core project artifacts were clean in git before this review. `plan.md`,
  `design.md` and `discovery.md` are format-clean through
  `oxfmt --stdin-filepath`. The 12 task IDs are unique and monotonic, and all
  prior Reviews rows are preserved.

No `## Dispatch Profile` section is present; that is normal and not a finding.
The sequential-phase claim remains consistent with the shared write sets.

### Requirements Coverage

| Requirement (discovery success criterion / design component)           | Status  | Notes                                                                              |
| ---------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| N>=3 messaging with observation disabled, concurrent senders           | covered | p01-t02, p01-t03, p01-t05                                                          |
| Per-recipient acks, identifiable replay, no silent loss                | covered | p01-t01, p01-t03                                                                   |
| Start/stop integration only for active participants, finite budgets    | covered | p02-t01, p02-t02; Claude inventory bound (Medium)                                  |
| Messages survive restart; no always-on wake promise                    | covered | p01-t03, p02-t03                                                                   |
| Same storage and Markdown log across worktrees; concurrent log appends | covered | p01-t01, p01-t04, p03-t01                                                          |
| Optional observation, separate state, messages before catch-up         | partial | p03-t01, p03-t02; Codex and Cursor covered, Claude composed path absent (Imp)      |
| Status exposes identity, pending/acked, capability, paths              | covered | p01-t05, p02-t01                                                                   |
| Defined outcomes for malformed, replay, crash, ambiguity, expiry       | covered | p01-t01 to p02-t01                                                                 |
| Design §1 identity, takeover                                           | covered | p01-t02, p01-t05                                                                   |
| Design §2-§3 storage and publication                                   | covered | p01-t01                                                                            |
| Design §4 messages and receipts, composed-session ID dedup             | covered | p01-t03, p03-t02                                                                   |
| Design §5 activation, claims, limits, retry                            | covered | p02-t01; record shape stability (Minor 2)                                          |
| Design §6 adapters, Monitor, disclosure, ownership policy, probes      | covered | p02-t01 to p02-t04; Claude inventory (Medium), expired `triggered` lease (Minor 1) |
| Design §7 composition, controller binding, shared log                  | partial | p03-t01, p03-t02; Claude single-Monitor controller has no files or tests (Imp)     |
| Design §8 closeout, trust, retention                                   | covered | p01-t02, p01-t05, p02-t02, p02-t03                                                 |
| Ownership, packaging, versions, changelog, docs                        | covered | p01-t05, p03-t01, p03-t03                                                          |
| Backlog closure for BL-260619                                          | covered | p03-t03, conditional on acceptance criteria                                        |

### Extra Work (not in declared requirements)

None. The acknowledgment and attestation mechanisms added since the third
review each trace to the user's 2026-09-19 decision recorded in
`discovery.md:138-147`.

## Verification Commands

```bash
# Important: the Claude observer wake owner is the base watcher, and no task lists it
sed -n 29,44p src/skills/session-observer-collab/references/runtime-claude-code.md
grep -n "catch-up-then-watch" src/skills/session-observer/src/session-observer.ts
grep -n "src/skills/session-observer/" .oat/projects/shared/agent-messaging/plan.md   # expect no match today
sed -n 81,88p src/skills/session-observer-collab/src/lib/lease-state.mjs

# Important: after the fix, p03-t02 should state the Claude composed behavior and test it
sed -n '/### Task p03-t02/,/### Task p03-t03/p' .oat/projects/shared/agent-messaging/plan.md | grep -n -i "claude"

# Medium: Claude Stop registrations on this host (read-only)
node -e 'const j=JSON.parse(require("fs").readFileSync(process.env.HOME+"/.claude/settings.json","utf8"));for(const g of (j.hooks??{}).Stop??[])for(const h of g.hooks??[])console.log(String(h.command).slice(0,100))'
find ~/.claude/plugins -maxdepth 6 -name hooks.json

# Minor 1: effectiveLease only retires armed and waiting leases
sed -n 504,544p src/skills/session-observer-collab/src/lib/lease-state.mjs
sed -n 228,234p src/skills/session-observer-collab/src/lib/runtime-adapter.mjs

# Minor 2: which task first writes `controller`
grep -n "controller" .oat/projects/shared/agent-messaging/plan.md | head

# Prior fixes stay resolved
grep -n "acknowledge-stop-hooks\|confirm-no-observer-monitor\|Ordered implementation stages" .oat/projects/shared/agent-messaging/plan.md
git merge-base origin/main HEAD   # expect d74abe671561053154d3012e1b8edd11fc079dcf
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
