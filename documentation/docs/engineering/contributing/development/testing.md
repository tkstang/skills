---
title: 'Testing'
description: 'Choose tests for behavior, shared code, generated installation units, and mocked provider flows without confusing them with live acceptance.'
---

# Testing

Test the boundary you changed. Source tests establish behavior; packaging tests
establish what ships; live provider acceptance is a separate, opt-in activity.

## Choose the smallest useful proof

| Change                    | Focused verification                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Skill behavior            | Colocated owner tests plus a manual inspection of the changed instructions or outputs.                |
| Shared runtime            | Shared-owner tests and tests for affected consumers.                                                  |
| Distribution or packaging | Root packaging/tooling tests and `pnpm run build:check`.                                              |
| Installed runtime layout  | A synthetic install outside the checkout, with isolated home/config and deterministic provider stubs. |
| Documentation             | Local links, sidebar, production export, and rendered light/dark examples.                            |

Keep behavior tests beside their owner under `src/skills/`, `src/shared/`, or
`src/plugins/`. Root `tests/` protects repository-wide contracts such as
packaging, manifests, release tooling, and generated-output freshness. Tests
normally import canonical source; execute generated entrypoints when the
installed-artifact boundary is what you need to prove.

## Focused and complete runs

The test wrapper forwards filters to Vitest and always uses run mode:

```bash
# One owner
pnpm run test:vitest src/skills/session-export-transcript

# Installed payload boundaries
pnpm run test:vitest tests/tooling/skill-packaging.test.ts

# Complete deterministic suite
pnpm test
```

The packaging suite already covers representative instruction-only,
shared-runtime, standalone, and complete-plugin boundaries. Extend an existing
proof surface rather than adding a skill-by-provider matrix, prose snapshots,
or a test-count quota.

## Generated output is part of verification

`pnpm test` includes the generated-output drift guard. After an intentional
source change, rebuild before expecting the whole suite to pass:

```bash
pnpm run build
pnpm run type-check
pnpm run build:check
pnpm test
pnpm run validate
pnpm run smoke
```

When auditing an existing branch, run `build:check` before a repairing build so
you retain evidence of the original drift. The smoke command is a mocked
end-to-end Consensus flow; it does not call authenticated providers.

## What passing tests do not prove

A green source test does not prove the packaged unit includes its resources.
A green packaging test does not prove a fresh provider session discovers the
skill. A green mocked smoke flow does not prove authentication, permissions, or
native provider behavior.

Live tests require explicit authorization and can spend real quota. Do not use
them as a default docs or packaging check. See [CI & Quality Gates](../../operations/ci.md)
for workflow triggers and [Releases & Versioning](../../operations/releases-and-versioning.md)
for the separate acceptance boundary.
