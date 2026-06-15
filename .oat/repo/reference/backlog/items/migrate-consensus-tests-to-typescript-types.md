---
id: bl-bfb4
title: 'Migrate consensus + tests to real TypeScript types'
status: open # open | in_progress | closed | wont_do
priority: medium # urgent | high | medium | low | none
scope: initiative # idea | task | feature | initiative
scope_estimate: L # XS | S | M | L | XL | XXL
labels: [tooling, typescript, testing, dx, migration]
assignee: null
created: '2026-06-14T15:02:51Z'
updated: '2026-06-14T15:02:51Z'
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

Convert the existing codebase from `allowJs` `.mjs` to **real TypeScript types**:
~6k lines of consensus skill code (`consensus-loop.mjs` ~2,900, the refine
wrapper ~3,100) and ~18k lines of `node:test` tests. "Compiles as TS" is not the
goal — the goal is genuine types on the domain that benefits most: mode-aware
verdicts, the unified v1 record schema, synthesis payloads, escalation/agency
states, and JSONL event payloads. That domain is discriminated-union-heavy and is
where types prevent the bugs the recent codex/verdict compat shims were patching.

**Depends on [[bl-853a]]** (toolchain standup). This is the long-tail, opt-in
body of work; it is deliberately split so the standup can land fast and this can
proceed module-by-module. [[bl-853a]] and this item may be executed as a single
project or independently — that is a scoping decision at kickoff, not a
precondition.

### Approach

- Migrate module by module; keep the suite green at every step (no big-bang).
- Prioritize the verdict/record/event/agency types first — highest bug-prevention
  ROI — then radiate outward to the loop, wrapper, and tests.
- Migrate `node:test` files to vitest as their modules are typed, retiring the
  compatibility path stood up in [[bl-853a]].
- Natural to sequence alongside (or fold into) the peer-layer work
  ([[bl-bb7e]] / [[bl-3a88]]), whose new code would be typed from day one and
  whose `~/code/stoa` reference (`provider-adapter.ts`, `final-json-contract.ts`)
  is already TypeScript.

## Acceptance Criteria

- Consensus skill code is real TypeScript (no remaining `allowJs` `.mjs` sources
  in the migrated scope), with typed models for verdicts, records, synthesis
  payloads, events, and agency/escalation states.
- The test suite runs entirely on vitest; the `node:test` compatibility path from
  [[bl-853a]] is removed. Coverage is preserved (no net loss of assertions).
- Shipped `.mjs` build output and the drift guard from [[bl-853a]] remain intact;
  `validate` and `smoke` pass; no new user-facing install step.
- `tsconfig` `allowJs` is tightened (or removed) for the migrated scope so new
  untyped `.mjs` cannot silently re-enter it.
- Docs updated to reflect the now-TypeScript source layout.
