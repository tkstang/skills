---
oat_generated: true
oat_generated_at: 2026-09-19T02:12:41Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/agent-messaging
oat_gate_headless: true
oat_gate_run_id: a5a5f137-5011-4d64-81af-c4db88d3f3e7
oat_gate_target: claude-fable-skip-permissions
oat_gate_runtime: claude
oat_invocation_model: fable
oat_invocation_reasoning_effort: provider-default
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-09-19T02:12:41Z
**Scope:** Re-review of the revised `plan.md` for the quick-mode `agent-messaging` project, against `discovery.md` and the approved `design.md`, at HEAD `eec9583b9970cb2887773b3660d316309c2e2368`
**Files reviewed:** 5 (`plan.md`, `design.md`, `discovery.md`, `state.md`, `implementation.md`), the archived prior review, and the repository sources the plan names
**Commits:** not applicable (artifact review has no git range)

## Summary

No blocking findings. All seven corrections from the first gate review
(`reviews/archived/artifact-plan-review-2026-09-19T014304Z.md`) are present in
the plan and were checked against the repository: the nonexistent
`plugins/session/README.md` target is gone, persisted diagnostics are owned by
p02-t01 and p02-t02, phase 2 now fails closed on a competing continuation
owner, the named safety cases and close/leave reporting are in p01, and
`documentation/index.md` is an owned generated output. Two Medium findings
remain, and both follow from the new p02-t02 ownership guard: p03-t02 does not
own reversing that guard for composed sessions, and the guard depends on
observer-collab internals that no task names or pins with a test.

Findings: 0 critical, 0 important, 2 medium, 2 minor

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

None

### Medium

- **p03-t02 does not own reversing the p02 ownership guard for composed sessions** (`plan.md:328-333`, `plan.md:449-457`, `plan.md:469`; `design.md:417-424`)
  - Issue: p02-t02 makes `delivery enable`, registration, and every
    automatic-delivery boundary refuse messaging ownership when "an effective
    observer-collab Stop registration or active observer lease for the exact
    session" exists, and p02-t03 applies the same refusal to watch. The design's
    composed mode needs the opposite for that same session state: the observer
    Stop code "delegates to the same activation/claim mechanism", and "both
    modes share expiry and finite budget", so a session with an active observer
    lease must be able to hold a messaging activation. p03-t02 therefore has to
    change the guard from "refuse" to "compose under one controller". Its
    Modify list names only "shared activation/claims APIs and messaging
    registration if needed"; it does not name the messaging CLI enable path,
    the messaging hooks, or `watch.ts`, where the guard lives. Its Verify list
    runs only observer-collab suites, so the p02 tests that assert refusal
    (`hooks.test.ts`, `registration.test.ts`, `watch.test.ts`, `cli.test.ts`)
    are not run in the task that must change them. The first run that would
    catch a stale refusal is the full `pnpm run test` in p03-t03, which is the
    docs task.
  - Fix: In p03-t02, state the rule that distinguishes "composed, observer
    controller is the single owner" from "competing owner" (for example, an
    activation epoch whose mechanism names the observer controller for that
    exact session). Add the messaging CLI, hooks, and watch files to Modify,
    and add the messaging suites to Verify with named cases: enable succeeds
    when composed, the standalone messaging Stop hook stays inert when the
    observer controller owns the session, and an uncomposed competing
    registration is still refused.

- **The p02-t02 ownership guard depends on observer-collab internals that no task names or pins** (`plan.md:328-333`, `plan.md:230-232`, `plan.md:306-310`)
  - Issue: Detecting the observer's owner means reading two observer-collab
    contracts. The Stop registration has no fixed location: its command is
    built from a caller-supplied `scriptPath`
    (`src/skills/session-observer-collab/src/codex-lifecycle.mjs:166-177`) and
    is recognizable only by the launcher marker `session-observer-collab-codex-stop`
    (`src/skills/session-observer-collab/src/lib/codex-install.mjs:15`). The
    lease lives at `<root>/leases/<ownerSession>.json` under
    `LEASE_SCHEMA_VERSION = 6`
    (`src/skills/session-observer-collab/src/lib/lease-state.mjs:18`,
    `:213-216`). p01-t05 restricts the messaging owner's `allowedSourceRoots`
    to the new shared collaboration root, so the messaging runtime cannot
    import either module and must carry its own copy of the marker, the lease
    path, and the lease-liveness rule. The plan names none of these, and the
    p02-t02 tests use fixtures only. An unknown lease schema degrades safely
    (absence cannot be established, so refuse). A renamed marker or moved lease
    path degrades unsafely: the guard sees no owner and two Stop owners become
    possible, which is the invariant the guard exists to protect. This guard
    ships permanently, not only until p03-t02.
  - Fix: In p02-t02, name the detection contract (hooks-config scope searched,
    launcher marker, lease path, and what counts as an active lease) and where
    the reader lives (`registration.ts` is already in Create). Add a colocated
    parity test that imports the observer's exported `leasePath`,
    `LEASE_SCHEMA_VERSION`, and install marker and fails when the messaging
    copy drifts. A test-only import does not widen the shipped runtime's
    source roots. Alternatively, move a minimal read-only owner probe into
    `src/shared/collaboration` in p02-t02 and have observer-collab consume it
    in p03-t01.

### Minor

- **Composed-session message-ID dedup guidance has no owning task** (`plan.md:422-435`, `plan.md:449-467`; `design.md:261-265`)
  - Issue: Design §4 says that in a composed session message IDs are the dedup
    key, a transcript quotation carrying the same ID is context rather than a
    new request, and agents must not fuzzy-match prose. This is
    instruction-level behavior. p03-t01 edits the observer-collab `SKILL.md`
    only for log commands, and p03-t02 lists neither skill's `SKILL.md`. The
    cursor half ("no ack-driven observer cursor advancement") is tested in
    p03-t02; the agent-facing half is not assigned.
  - Suggestion: Add both `SKILL.md` files to p03-t02's Modify list with one
    bullet for the message-ID dedup rule and inbox-before-observation order.

- **p03-t03 cites a "documented" stdin formatter mode that the repository does not document** (`plan.md:527-528`)
  - Issue: `.oxfmtrc.json` ignores `.oat/**`, so PJM prose cannot be formatted
    by path, and the plan correctly reaches for stdin. No `AGENTS.md`, PJM
    guide, or package script mentions a stdin mode. `oxfmt` does support
    `--stdin-filepath=PATH`, so the step is feasible but the implementer has to
    discover the command.
  - Suggestion: Replace "the documented Markdown formatter's stdin mode" with
    the exact command, for example
    `pnpm exec oxfmt --stdin-filepath=item.md < item.md`, and keep the note
    about not touching managed blocks.

## Requirements/Design Alignment

**Evidence sources used:** `plan.md`, `discovery.md`, `design.md` (present and
approved, so used although optional in quick mode), `state.md`,
`implementation.md` (0/12, scaffold plus the Review Received record), the
archived first gate review, `src/distributions.ts`, `package.json`,
`documentation/package.json`, `tsconfig.json`, `vitest.config.mjs`,
`.oxfmtrc.json`, `scripts/build-generated.ts`, and observer-collab
`build.json`, `codex-install.mjs`, `codex-lifecycle.mjs`, `lease-state.mjs`,
`hooks/codex-stop.mjs`.

Checked directly in this pass:

- Every existing file the plan modifies is present. Every path it creates is
  absent. `plugins/session/README.md` no longer appears in the plan.
- All named scripts exist (`test:vitest`, `build`, `build:check`, `validate`,
  `type-check`, `smoke`, `validate:skill-versions`, `worktree:validate`).
- `git merge-base origin/main HEAD` is
  `d74abe671561053154d3012e1b8edd11fc079dcf`, matching p03-t03.
- Every existing Format target is currently oxfmt-clean (47 files), so the
  task Format commands will not create unrelated churn.
- `src/distributions.ts` already supports `allowedSourceRoots` and explicit
  per-target names, so `skills/agent-messaging` and
  `plugins/session/skills/messaging` fit the existing shape. Observer-collab
  ships standalone and in the consensus plugin, as p03-t01 and p03-t03 assume.
- TypeScript shared runtime bundled into `.mjs` entrypoints has precedent
  (`selected-prefix.mjs` imports `src/shared/transcript/*.ts` via `.js`
  specifiers through esbuild), so p03-t01's bundling is feasible.
- No build or validate step rejects shared source that has no declared owner,
  so p01-t01 to p01-t04 can commit before p01-t05 declares the distribution.
- The docs `prebuild` runs `oat docs generate-index`; the common contract's
  snapshot-and-restore rule covers its side effects.

No `## Dispatch Profile` section is present; that is normal and not a finding.
Plan frontmatter `oat_template: true` with `oat_status: in_progress` is the
quick-start skill's documented pre-readiness state, not a defect. The
sequential-phase claim is consistent with the shared write sets. Task IDs are
stable and monotonic, no task was added or renumbered by the corrections, and
all prior Reviews rows are preserved.

### Requirements Coverage

| Requirement (discovery success criterion / design component)           | Status  | Notes                                                                        |
| ---------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| N>=3 messaging with observation disabled, concurrent senders           | covered | p01-t02, p01-t03, p01-t05 (copied artifact, three participants)              |
| Per-recipient acks, identifiable replay, no silent loss                | covered | p01-t01, p01-t03                                                             |
| Start/stop integration only for active participants, finite budgets    | covered | p02-t01, p02-t02; standalone now fails closed on a competing owner           |
| Messages survive restart; no always-on wake promise                    | covered | p01-t03, p02-t03                                                             |
| Same storage and Markdown log across worktrees; concurrent log appends | covered | p01-t01, p01-t04, p03-t01                                                    |
| Optional observation, separate state, messages before catch-up         | partial | p03-t01, p03-t02; guard reversal under composition unowned (Medium 1)        |
| Status exposes identity, pending/acked, capability, paths              | covered | p01-t05, p02-t01 (diagnostics and capacity states now included)              |
| Defined outcomes for malformed, replay, crash, ambiguity, expiry       | covered | p01-t01 to p02-t01; wrong-owner, override, and `--self` conflict cases named |
| Design §1 identity, takeover                                           | covered | p01-t02, p01-t05                                                             |
| Design §2-§3 storage and publication                                   | covered | p01-t01                                                                      |
| Design §4 messages and receipts                                        | partial | p01-t03; composed-session ID dedup guidance unassigned (Minor 1)             |
| Design §5 activation, claims, limits, retry                            | covered | p02-t01                                                                      |
| Design §6 adapters, Monitor, disclosure, probes, diagnostics           | partial | p02-t01 to p02-t04; owner-detection contract unpinned (Medium 2)             |
| Design §7 composition and shared log                                   | partial | p03-t01, p03-t02 (Medium 1)                                                  |
| Design §8 closeout, trust, retention                                   | covered | p01-t02, p01-t05 (unresolved-mail reporting), p02-t02, p02-t03               |
| Ownership, packaging, versions, changelog, docs                        | covered | p01-t05, p03-t01, p03-t03; stdin formatter command unnamed (Minor 2)         |
| Backlog closure for BL-260619                                          | covered | p03-t03, conditional on acceptance criteria                                  |

### Extra Work (not in declared requirements)

None. The diagnostic record bounds added by the corrections (8 KiB per record,
4,096 records per session) give numbers to a bound the design left unspecified
and reuse its soft-cap semantics; they do not change the approved protocol.

## Verification Commands

```bash
# Prior findings stay resolved
grep -n "plugins/session/README" .oat/projects/shared/agent-messaging/plan.md   # expect no output
grep -n -i "diagnostic" .oat/projects/shared/agent-messaging/plan.md
git merge-base origin/main HEAD   # expect d74abe671561053154d3012e1b8edd11fc079dcf

# Medium 1: p03-t02 should name the messaging files and suites
sed -n '/### Task p03-t02/,/### Task p03-t03/p' .oat/projects/shared/agent-messaging/plan.md | grep -n "agent-messaging\|watch\|hooks.test\|registration.test\|cli.test"

# Medium 2: the observer contracts the guard must track
grep -n "BUNDLE_OWNER" src/skills/session-observer-collab/src/lib/codex-install.mjs
grep -n "LEASE_SCHEMA_VERSION =\|export function leasePath" src/skills/session-observer-collab/src/lib/lease-state.mjs

# Minor 2: stdin formatting is available but undocumented in the repo
pnpm exec oxfmt --help | grep -i stdin
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
