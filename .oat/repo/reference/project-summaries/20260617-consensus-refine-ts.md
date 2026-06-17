---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-16
oat_generated: true
oat_summary_last_task: p04-t01
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: consensus-refine-ts

## Overview

This quick-mode project completed the next `bl-bfb4` TypeScript/Vitest migration
slice for the consensus plugin. The goal was to move the `consensus-refine` wrapper
and the in-scope consensus behavior tests onto the repository's canonical
TypeScript, generated-runtime, and Vitest substrate without changing shipped plugin
runtime paths or user-facing behavior.

## What Was Implemented

The consensus refine wrapper now has canonical TypeScript source at
`src/consensus/refine/consensus-refine.ts`. The committed provider-facing runtime
remains `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`, generated
from that canonical source and still importing the sibling `./consensus-loop.mjs`
runtime.

The generated-output build now supports per-mapping import rewrites. The wrapper
source type-checks against the canonical loop API through
`../core/consensus-loop.js`, while `scripts/build-generated.mjs` rewrites only
module specifier literals to the shipped sibling import. Final review follow-up
`p04-t01` tightened this from broad quoted-string replacement to parser-based
module-specifier rewriting and added regression coverage for non-import string
literals.

The in-scope consensus `node:test` suite moved to Vitest `.test.ts` files with
assertion-parity tracking. The project added a TypeScript declaration for the
shared process helper, removed active duplicate Node runners for migrated modules,
and kept the remaining non-consensus Node suites on `test:node`.

The repo reference docs and root contributor guidance were updated so developers
know both consensus generated runtimes are build outputs, never hand-edited files.
DR-021 records the wrapper import-rewrite decision, and `current-state.md` /
backlog reference material now reflect the completed wrapper and consensus-test
migration slice.

## Key Decisions

- Keep the two-tree contract from DR-020: canonical TypeScript under `src/`, committed
  generated `.mjs` under `plugins/`, and no canonical TypeScript shipped inside
  `plugins/consensus/skills`.
- Use a build-time import rewrite rather than bundling the wrapper. This preserved
  `bundle:false`, the existing shipped runtime layout, and a dependency-free plugin
  runtime.
- Port only consensus-related tests to Vitest. Session-observer, transcript-core,
  export-session, and other repo/tooling tests remain on Node's test runner and keep
  `pnpm test` as a two-runner command.
- Treat the final-review Minor as worth fixing before PR: constraining rewrites to
  module specifiers was small, local, and removed a future robustness footgun.

## Notable Challenges

The first final verification after p04 hit a transient session-observer CLI failure:
one Node test imported a generated transcript-core copy while the transcript-core
sync drift test was mutating that same copy for negative-case coverage. The generated
copy was in sync after the run, `pnpm run sync:transcript-core -- --check` passed,
and a full `pnpm test` rerun passed cleanly.

## Integration Notes

- Edit `src/consensus/refine/consensus-refine.ts`, then run `pnpm run build` to
  regenerate `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`.
- Use `pnpm run build:check` or `tests/generated-output-sync.test.mjs` to verify
  both generated consensus runtimes are in sync.
- Do not lint, format, or hand-edit generated runtime outputs with a `// GENERATED`
  banner.

## Follow-up Items

- `bl-bfb4` remains broader than this slice. Remaining work includes non-consensus
  `node:test` suites, selected long-tail runtime/test modules, and eventual
  retirement of the Node compatibility path once those suites move.
- `consensus-evaluate` remains the next feature lane after this TypeScript/Vitest
  substrate work.
