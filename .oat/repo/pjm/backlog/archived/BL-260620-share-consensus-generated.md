---
id: BL-260620-share-consensus-generated
title: Share consensus generated runtime output at the plugin level
status: closed
priority: medium
scope: task
scope_estimate: M
labels:
  - consensus
  - generated-runtime
  - plugin-install
  - maintainability
assignee: null
created: 2026-06-20T00:17:51Z
updated: 2026-07-07T14:27:34Z
associated_issues: []
legacy_id: bl-e0e7
---

## Description

The consensus plugin currently generates duplicate shared runtime output for
each shipped skill. In particular, `src/consensus/core/consensus-loop.ts` builds
to both:

- `plugins/consensus/skills/refine/scripts/consensus-loop.mjs`
- `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs`

This duplication was conservative when each skill might have needed to be
copied or installed in isolation. Now that Consensus is treated as a plugin
package whose skills ship together, the cleaner shape is likely a plugin-local
shared script:

```text
plugins/consensus/scripts/consensus.mjs
plugins/consensus/scripts/consensus-loop.mjs
plugins/consensus/skills/refine/scripts/consensus-refine.mjs
plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs
```

The wrappers would import the shared loop through a relative plugin-root path
such as `../../../scripts/consensus-loop.mjs`. This should stay plugin-local and
hermetic; do **not** use a global path such as `~/.consensus/scripts`, which
would create version, cleanup, and cross-install coupling problems.

**Sequencing constraints (2026-06-20):**

- **Not concurrent with the consensus-family project.** This item changes how
  `consensus-loop.mjs` is *emitted*, while the family project (`bl-2ed7` →
  `bl-b9b9` → `bl-87ef`/`bl-0cb8`) actively modifies `consensus-loop` source and
  its generated output. Running both at once means fighting over generated `.mjs`
  + drift guards. Land this **before the family project starts or after it
  merges**, not in parallel.
- **Spike is informed by the release work.** The multi-host install spike below
  wants the same installed-layout knowledge that `bl-d85f` produces while
  verifying provider installs across Claude/Codex/Cursor. Prefer doing the spike
  informed by that evidence rather than ahead of it. The code change is small; the
  spike is the real work and a genuine go/no-go.

Before changing the generated-output layout, run a spike to prove that
plugin-local shared scripts work from the installed plugin layout in every host
we care about: Cursor, Copilot, Claude, and Codex at minimum. The spike should
confirm whether each host preserves the plugin root beside `skills/` and whether
skill wrapper scripts can resolve and execute `../../../scripts/*.mjs` after
installation or local plugin loading.

## Acceptance Criteria

- Spike documents the installed/local plugin layout for Cursor, Copilot, Claude,
  and Codex, including the exact install or local-load command used and whether
  `plugins/consensus/scripts/` is preserved beside `skills/`.
- Spike proves that shared plugin-local scripts resolve and execute from each
  host's installed plugin layout, or records a concrete blocker and recommends
  keeping duplicated per-skill output.
- If the spike passes, `scripts/build-generated.mjs` emits one shared
  `plugins/consensus/scripts/consensus-loop.mjs` instead of per-skill duplicate
  loop outputs.
- Refine and Evaluate generated wrappers import the shared loop from the
  plugin-local shared location, and generated-output drift checks cover the new
  mapping.
- Per-skill duplicated `consensus-loop.mjs` outputs are removed from maintained
  source/runtime/docs/tests after the migration.
- Tests or release checks simulate or exercise the installed plugin-root layout
  so future changes do not accidentally break plugin-local shared imports.
- Documentation states that Consensus supports plugin installs/local plugin
  loading as the runtime contract; standalone copying of a single skill folder is
  a non-goal unless a future project reinstates per-skill self-contained output.
