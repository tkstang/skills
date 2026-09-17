---
id: BL-260916-add-a-first-party-install
title: Add a first-party install command for standalone skills
status: open
priority: medium
scope: feature
scope_estimate: S
labels:
  - installation
  - standalone
  - onboarding
assignee: null
created: 2026-09-16T15:55:57.279Z
updated: 2026-09-17T01:12:08Z
associated_issues: []
external_plans: []
---

## Description

There is no first-party way to install a standalone skill: install.sh installs only the consensus wrapper (plugins/consensus/scripts/consensus.mjs) into .consensus/, pinned to v0.1.2, and the docs' standalone path depends on the third-party Skills CLI (npx skills add ... --agent <host>). Add an install command (e.g. install.sh --skill <name> --agent <claude-code|codex|cursor> --scope <project|user> --ref <tag>) that installs a generated standalone payload from a pinned tag into the selected host and explicit scope, verifies the payload, and prints the invocation name. Adapt the proven direct-installer and pinned-Git patterns from the sibling `tkstang/personal-skills` repository rather than designing a parallel installer framework. Document it on the Installation page beside the Skills CLI path; the release checklist verifies it live.

## Acceptance Criteria

- A first-party command installs any generated standalone payload from a pinned tag into the chosen host's explicitly selected project or user scope, verifies the copied files, and prints the invocation name for that host.
- It refuses to install from `src/skills/` and reports clearly when the tag or skill does not exist.
- Documented on the Installation page next to the Skills CLI path; the release checklist verifies it live for each host.
- Covered by tests that install into temporary project and user roots from a local tagged repository without mutating the real home directory.

## Implementation evidence

Installer behavior and documentation are implemented in `4fc228e9` and
`1606a5c9`. Recovery commit `372a69c0` places standalone tests under `tests/`
and restores the original Consensus tests. This avoids treating installer
test changes as changes to distributed skill runtimes. No skill version or
generated payload changed.

Automated verification passed on the recovery commit:

- Focused standalone, Consensus, documentation-contract, and README suites:
  65 tests passed.
- `pnpm run build:check`: generated payloads are in sync.
- `pnpm run validate:skill-versions -- --base-ref origin/main`: zero changed
  skills. The same check against phase base
  `01e459687e33459357774a4aa584c44d6a64a9a2` also passed.
- `pnpm run premerge`: build, type-check, freshness, 2,029 tests passed with
  one opt-in live test skipped, repository validation, and smoke passed.
- `pnpm --dir documentation build`: passed.
- Changed-file formatting/lint, `git diff --check`, and `oat pjm doctor --json`:
  passed.

## Pending live acceptance

| Host | Scope | Automated install and payload checks | Live install, discovery, invocation, and permissions |
| --- | --- | --- | --- |
| Codex | project | Passed in a temporary project | Pending separate authorization |
| Codex | user | Passed with a temporary HOME | Pending separate authorization |
| Claude Code | project | Passed in a temporary project | Pending separate authorization |
| Claude Code | user | Passed with a temporary HOME | Pending separate authorization |
| Cursor | project | Passed in a temporary project | Pending separate authorization |
| Cursor | user | Passed with a temporary HOME | Pending separate authorization |

All installer fixtures use local tagged repositories without network access.
Real user-home mutation was not authorized or performed. Live host checks and
real user-scope installation remain separate release acceptance steps.
The documented `v0.1.2` example remains conditional on a release containing the
helper and current generated payloads; no release was published by this work.

Keep this item active until the authorized release checks pass for every
advertised host and scope. The kickoff handoff remains in place.
