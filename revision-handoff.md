# Sol handoff: destination-tab fork guidance

## Start here

Workspace: `/Users/tstang/orca/workspaces/skills/coding-session-handoff`.
Project: `.oat/projects/synced/coding-session-handoff` (separate synced project ref).
Read AGENTS.md, pull project records with `oat project pull coding-session-handoff`,
then read the accepted revision sections in discovery.md, spec.md, and design.md,
plan.md's current routing and p-rev1, and implementation.md's revision entry.
Use `oat-project-implement` beginning at **prev1-t01**, not p04-t02. The user requested
Sol for the next implementation session; do not launch implementation in the planning
session or silently change shared/user model policy. Confirm the applicable revision
HiLL checkpoint before execution; the preserved historical setting names p06.

## Product contract

1. Inside the exact session to fork: use direct, corroborated identity or ask for
   explicit selection; never infer current identity from recency.
2. In another source session: discover sessions for that source worktree and select.
3. In a fresh destination session: ask for the source worktree, discover/select there,
   then explain how the user enters the fork in this destination tab.

All entry points prepare instructions only. The user creates/opens the fork in the
existing destination worktree. For an already-open destination provider, use supported
native switching if verified applicable; otherwise exit the fresh session and run the
fork-and-open command in the same tab. No nested interactive provider and no history
merge. Fork is not original-session resume.

Cover Codex, Claude, and Cursor with explicit surface/capability limits. Cursor IDE
transcript discovery does not prove CLI resume/fork interoperability. Unsupported
paths return explanations, not invented commands. The intended minimal output is a
destination-only shell-safe interactive command (or clearly labeled manual sequence),
with cwd guard and evidence limitations, not the old readiness-turn invocation.

## Task sequence

- prev1-t01: dated official-source capability matrix and guidance-only types.
- prev1-t02: all-three-provider bounded read-only discovery/preview/current identity.
- prev1-t03: pure destination-side instructions, cwd/quoting checks, switch fallback.
- prev1-t04: experimental public guidance-only CLI/skill/bundle, isolated from execution.
- prev1-t05: docs/status and full synthetic regression verification.

The plan declares file ownership, format/verify commands, commit boundaries, review,
and closeout. Preserve old task IDs, review rows, review-cap usage, and deferrals.

## Reuse and traps

- Reuse `discovery.ts`, `preview.ts`, `git-target.ts`, and transcript core helpers.
- Existing Cursor `discover` route currently ignores bounded discovery options;
  extending only the provider enum is insufficient.
- Existing `cli.ts` plan path calls provider probes. The public guidance path needs
  its own thin read-only entrypoint and must not import reachable execution/gate logic.
- Existing `behavior-contracts.ts` builds noninteractive readiness calls, not the
  desired interactive continuation commands. Keep its exact-version guards unchanged.
- Do not widen the paused executor's provider union to Cursor merely to reuse types.
- Shared runtime edits require canonical skill version bumps and generated parity.
  Keep main-installed user skills unchanged unless separate dogfooding approval exists.
- The docs site is the primary documentation surface, not only README.

## Experimental status and evidence

### Revision plan review

Independent structured artifact review completed on 2026-09-13 UTC: 0 Critical,
0 Important, 1 Medium, 0 Minor. The scope/entrypoints/paused-automation boundary are
aligned. This is not a zero-finding pass. The reviewer wrote no artifact; the current
plan review event is recorded as received with this nonblocking residual:

**M1 — prev1-t04 verification:** explicitly list `tests/repo/layout.test.ts` and
`tests/release/versioning.test.ts` in that task's file/format/verify scope. They contain
exact standalone-skill inventories. The existing task already requires affected
inventory edits, but only prev1-t05's full suite currently runs these tests. Suggested
focused verification: `pnpm exec vitest run tests/coding-session-handoff tests/tooling tests/repo/layout.test.ts tests/release/versioning.test.ts`;
format the two files with `pnpm exec oxfmt --write tests/repo/layout.test.ts tests/release/versioning.test.ts`.
This improvement was offered to the user and remains unapplied pending direction.
Do not claim it was accepted or fixed.

Dispatch: `handoff-rev1-plan-20260913-01`; native exact role
`oat-reviewer-gpt-5-6-sol-max`, configured Sol/max, Frontier project ceiling,
read-only structured review, 600-second deadline, no launch retries or fallback.
Parent effort was unknown, so the exact-ceiling exception was used rather than
unverified inheritance. Runtime identity was not independently reported. This was
a planning review, not a live native-session gate or implementation dispatch.

Additional phase-gate and per-skill lifecycle-gate choices were offered but unanswered
at bookkeeping time. No gates were disabled or newly enabled. Preserve current config;
confirm the revision HiLL checkpoint before implementation as noted above.

### Preserved implementation evidence

Retain old automation as experimental/incomplete/unverified/paused. Original p04/p05
live/receipt gates remain unpassed; original p05 activation and p06 packaging work is
superseded, not completed. They are not dependencies of read-only guidance. Passing
synthetic tests does not establish real fork/cwd/ADE behavior. Add prominent notices
to the tool README, public skill/help/output and docs during implementation.

Code baseline: local branch includes main integration and p03-t19 at `12cf6edf`, plus
decision-only commits `ae382960` and `30da3e20`. Verify actual HEAD/status on arrival. These local code
changes have not been feature-pushed to PR #70. Synced project-record pushes are
separate; always use `--no-refresh-pr` unless PR mutation is separately authorized.

No live provider operation (including help/version/auth), installation, cleanup,
automatic retry, feature push, PR mutation, merge, or release is authorized. Use public
docs/source and mocks; ask for fresh bounded approval if a live check is necessary.
Do not expose real session IDs, transcript bodies, credentials, or private evidence
locators in artifacts. Commands use only the minimum locally requested source selector
and destination; committed examples use synthetic values.

The local session-fidelity research packet informs parser reuse and limitations; it
does not prove native continuation. Portable any-agent `session-handoff`, its eventual
migration from personal-skills, and opt-in tool-activity enrichment remain separate.
