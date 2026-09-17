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
updated: 2026-09-16T15:55:57.279Z
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
