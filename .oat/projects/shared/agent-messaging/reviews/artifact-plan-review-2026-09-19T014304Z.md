---
oat_generated: true
oat_generated_at: 2026-09-19T01:43:04Z
oat_review_scope: plan
oat_review_type: artifact
oat_review_invocation: gate
oat_project: .oat/projects/shared/agent-messaging
oat_gate_headless: true
oat_gate_run_id: f1bc5e2e-4077-4485-925e-6fc98bc9df59
oat_gate_target: claude-fable-skip-permissions
oat_gate_runtime: claude
oat_invocation_model: fable
oat_invocation_reasoning_effort: provider-default
oat_invocation_source: exec-target-config
---

# Artifact Review: plan

**Reviewed:** 2026-09-19T01:43:04Z
**Scope:** `plan.md` for the quick-mode `agent-messaging` project, reviewed against `discovery.md` and the approved `design.md` at HEAD `2e1c952c3d68df3daf8ebef3be59c3844a06d27f`
**Files reviewed:** 5 (`plan.md`, `design.md`, `discovery.md`, `state.md`, `implementation.md`) plus repository sources the plan names
**Commits:** not applicable (artifact review has no git range)

## Summary

The plan is a faithful, well-bounded decomposition of the approved design into
three sequential phases and twelve atomic tasks. Its repository claims were
checked directly: every named script exists, the recorded version-validation
base `d74abe671561053154d3012e1b8edd11fc079dcf` is the actual merge base with
`origin/main`, every existing file it modifies is present except one, the
Vitest and `tsc` globs already cover the proposed `src/shared/collaboration`
paths, and every directory it formats is currently oxfmt-clean. No blocking
findings. Three Medium findings cover one nonexistent "Modify" target, an
unowned design component, and a phase-ordering gap that leaves two Stop
continuation owners possible while phase 2 live probes run.

Findings: 0 critical, 0 important, 3 medium, 4 minor

**Dispatch audit:** `Dispatch: scope=plan action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:opus effort_axis=not-applicable dispatch_policy=high dispatch_ceiling=opus target=opus`
That stamp is the managed project reviewer resolution, copied verbatim. This
review did not run on that target: it is gate-originated, and the gate's exec
target is resolved independently of the project dispatch ceiling.
`Gate route: inline (runtime=claude, cliRoot=/Users/tstang/Library/pnpm/store/v11/links/@open-agent-toolkit/cli/0.2.79/8ca9b56072295bbba9acd47c440b3cf7b78bcdb55a6cc290bf101117d76b5c8b/node_modules)`.
The route helper reported the runtime marker matched and that model evidence
was unavailable; the frontmatter records configured invocation only.

## Findings

### Critical

None

### Important

None

### Medium

- **p01-t05 and p03-t03 list a file to modify that does not exist** (`plan.md:208`, `plan.md:232`, `plan.md:442`, `plan.md:479`)
  - Issue: `plugins/session/README.md` appears under **Modify** in p01-t05 and
    p03-t03 and in both Format commands. It is absent on this branch and on
    `origin/main` (`git ls-tree origin/main plugins/session/` returns only the
    three provider manifest directories and `skills/`). Only
    `plugins/consensus/README.md` exists. The Common Task Contract says a new
    path is "a proposed implementation file", but this one is filed under
    Modify, so the implementer must guess between silently creating a new
    maintained plugin-root document and silently dropping the step. The format
    command hides the problem: `oxfmt` exits 0 when at least one other listed
    path exists.
  - Fix: Decide it in the plan. Either move it to **Create** in p01-t05 with
    its purpose and owner stated (and confirm `pnpm run validate` and
    `build:check` accept a new maintained file in that plugin root), or remove
    it from p01-t05 and p03-t03 and keep Session plugin messaging docs in
    `documentation/docs/user-guide/plugins/session/index.md`, which p03-t03
    already modifies.

- **Persisted delivery diagnostics have no owning task** (`plan.md:291-293`, `plan.md:260-263`; `design.md:162`, `design.md:411-412`, `design.md:576-577`)
  - Issue: The design's storage layout includes
    `activations/<sessionKey>/diagnostics/<attemptId>.json`, requires adapters
    to "store bounded immutable diagnostic records by attempt ID", and has
    `status` report "diagnostics" and "the latest event/outcome". The plan
    only covers the stderr half ("stderr redacted diagnostics" in p02-t02).
    No task creates, bounds, redacts, or tests the persisted records, and
    p02-t01's status bullet does not mention them. This is an in-scope design
    component that is neither mapped to a task nor explicitly deferred.
  - Fix: Add the record type, its bound and redaction rule, and the status
    surface to p02-t01 (shared claims/status) or p02-t02 (adapters), with a
    named test for overflow, redaction, and "status reports outcome, not
    delivery". If it is intentionally dropped, say so in the plan and return
    the departure to the user per `plan.md:55-56`.

- **Phase 2 can run live Stop probes before anything prevents a second continuation owner** (`plan.md:294-297`, `plan.md:357-367`, `plan.md:419-420`; `design.md:417-419`)
  - Issue: The design's invariant is one autonomous continuation owner per
    session. p02-t02 adds a messaging Stop registration, explicitly preserves
    unrelated hooks, and defers all observer interaction to p03-t02, which is
    where "prevent competing standalone/observer Stop registrations from both
    becoming owners" lives. p02-t04 then permits separately authorized live
    runs that "verify real ... Stop continuation". The existing
    observer-collab Codex Stop bundle is an installable, real registration
    (`src/skills/session-observer-collab/src/lib/codex-install.mjs:15-17`,
    `175`). On a host that has it, a phase 2 live run has two independent
    Stop owners with separate budgets, so it can emit two continuations and
    produce acceptance evidence that does not describe the shipped composed
    behavior, while spending real quota.
  - Fix: Make phase 2 fail closed on its own. In p02-t02, have
    registration/enable detect an existing observer-collab Stop registration
    (or an active observer lease for the same exact session) and refuse
    automatic Stop ownership with a manual-fallback notice, with a fixture
    test. Alternatively, add "no other continuation owner registered for this
    session, verified and recorded" as a precondition of any p02-t04 live
    run, and defer live Stop-continuation rows to after p03-t02.

### Minor

- **Several design Testing Strategy cases are not named in any task** (`plan.md:118-123`, `plan.md:226-230`; `design.md:105-108`, `design.md:180`, `design.md:629`)
  - Issue: The design's Safety row lists "wrong owner" and "mismatched root
    overrides", and the design rejects relative overrides. p01-t01 implements
    owner checks and root precedence but its test list omits those cases.
    Likewise the design says the CLI uses "non-conflicting harness identity
    signals or an explicit self pin"; p01-t05 teaches exact identity but no
    test covers a `--self` pin that conflicts with an available harness
    signal (exit 2).
  - Suggestion: Add these three cases to the p01-t01 and p01-t05 Verify
    lists so they are not left to implementer recall.

- **Docs build side effects are not in the staging contract** (`plan.md:226-228`, `plan.md:465`, `plan.md:90`)
  - Issue: `pnpm --dir documentation build` runs a `prebuild` that executes
    `oat docs generate-index` (`documentation/package.json`), which rewrites
    the generated inventory `documentation/index.md` once a new page exists.
    p01-t05 and p03-t03 run that build but their Modify lists and the exact
    staging rule do not name the inventory, and p03-t03 ends with
    `worktree:validate`, which asserts a clean tree.
  - Suggestion: Name `documentation/index.md` as a generated owned output of
    p01-t05 and p03-t03, and add "inspect `git status` after the docs build
    and restore any unrelated file the generator rewrote before staging".
    Reviewer note, not verified in this pass: this generator has previously
    been seen rewriting `.oat/config.json` in this repo at CLI 0.2.79.

- **Closeout reporting from design §8 is not explicit** (`plan.md:141-145`; `design.md:456-460`)
  - Issue: The design has leave revoke that session's activation and has
    closeout "stop watchers/Monitor processes ... and report unresolved
    messages". p02-t01 covers departure as a termination cause and p02-t03
    covers watcher cleanup, but no task states that `close`/`leave` report
    unresolved mail.
  - Suggestion: Add one bullet and one test case to p01-t05 (CLI `close` and
    `leave` output) so the behavior is owned.

- **The existing plan review row is shaped unlike the ledger contract** (`plan.md:496`)
  - Issue: The `plan | artifact | passed` row records `Invocation: auto`
    with no artifact. The ledger convention uses `-` in Invocation for
    non-code reviews. The prose below the table explains the inline pass
    honestly, so nothing is misrepresented.
  - Suggestion: No deletion. This review appends its own row rather than
    claiming that one. Optionally normalize the Invocation cell to `-` when
    the plan is next edited.

## Requirements/Design Alignment

**Evidence sources used:** `plan.md`, `discovery.md`, `design.md` (present and
approved, so used although optional in quick mode), `state.md`,
`implementation.md` (scaffold only, as `state.md` says), `src/distributions.ts`,
`package.json`, `documentation/package.json`, `vitest.config.mjs`,
`tsconfig.json`, `scripts/worktree/validate.sh`, observer-collab `build.json`
and sources, `documentation/AGENTS.md`.

No `## Dispatch Profile` section is present; that is normal and not a finding.
Plan frontmatter `oat_template: true`, `oat_status: in_progress` is the
documented interruption-safe pre-review state for a quick plan, not a defect.
The sequential-phase claim is consistent with the shared write sets.

### Requirements Coverage

| Requirement (discovery success criterion / design component)           | Status  | Notes                                                                         |
| ---------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| N>=3 messaging with observation disabled, concurrent senders           | covered | p01-t02, p01-t03, p01-t05 (copied artifact, three participants)               |
| Per-recipient acks, identifiable replay, no silent loss                | covered | p01-t01, p01-t03                                                              |
| Start/stop integration only for active participants, finite budgets    | partial | p02-t01, p02-t02; second-owner gap before p03-t02 (Medium 3)                  |
| Messages survive restart; no always-on wake promise                    | covered | p01-t03, p02-t03                                                              |
| Same storage and Markdown log across worktrees; concurrent log appends | covered | p01-t01, p01-t04, p03-t01                                                     |
| Optional observation, separate state, messages before catch-up         | covered | p03-t01, p03-t02                                                              |
| Status exposes identity, pending/acked, capability, paths              | partial | p01-t05, p02-t01; persisted diagnostics unowned (Medium 2)                    |
| Defined outcomes for malformed, replay, crash, ambiguity, expiry       | partial | p01-t01 to p02-t01; a few named safety cases missing from tests (Minor 1)     |
| Design §1 identity, takeover                                           | covered | p01-t02; CLI harness-signal conflict untested (Minor 1)                       |
| Design §2-§3 storage and publication                                   | covered | p01-t01                                                                       |
| Design §4 messages and receipts                                        | covered | p01-t03                                                                       |
| Design §5 activation, claims, limits, retry                            | covered | p02-t01                                                                       |
| Design §6 adapters, Monitor, disclosure, probes                        | partial | p02-t02, p02-t03, p02-t04; diagnostics records (Medium 2)                     |
| Design §7 composition and shared log                                   | covered | p03-t01, p03-t02                                                              |
| Design §8 closeout, trust, retention                                   | partial | p01-t02, p02-t02; unresolved-mail reporting implicit (Minor 3)                |
| Ownership, packaging, versions, changelog, docs                        | partial | p01-t05, p03-t01, p03-t03; nonexistent `plugins/session/README.md` (Medium 1) |
| Backlog closure for BL-260619                                          | covered | p03-t03, conditional on acceptance criteria                                   |

### Extra Work (not in declared requirements)

None. The plan adds no machinery beyond the approved design, and it keeps the
observer identity and digest follow-ups out of scope.

## Verification Commands

```bash
# Medium 1: confirm the target is absent on the branch and on main
ls plugins/session/README.md; git ls-tree --name-only origin/main plugins/session/

# Base ref recorded in p03-t03
git merge-base origin/main HEAD   # expect d74abe671561053154d3012e1b8edd11fc079dcf

# Medium 2 / Medium 3: confirm the revised plan names the owning tasks
grep -n -i "diagnostic" .oat/projects/shared/agent-messaging/plan.md
grep -n -i "continuation owner\|observer.*Stop\|Stop registration" .oat/projects/shared/agent-messaging/plan.md

# Minor 2: confirm what the docs build regenerates
node -e 'console.log(require("./documentation/package.json").scripts.prebuild)'
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
