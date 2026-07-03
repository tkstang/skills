---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-07-02
oat_phase: plan
oat_phase_status: complete
oat_plan_parallel_groups: []
oat_plan_hill_phases: ["p05"]
oat_auto_review_at_hill_checkpoints: true
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: consensus-panel

> Execute this plan using `oat-project-implement`.

**Goal:** Ship configurable default consensus composition and a new
`consensus-panel` workflow that runs a neutral, single-round, 2+ panelist
breadth gather.

**Architecture:** Add shared config/store/resolver source under `src/consensus`,
expose config management through the provider CLI, consume the resolver
in-process from generated wrappers, and add a direct panel wrapper over
`consensus run` without extending the convergence loop.

**Tech Stack:** Node.js 22+, TypeScript source under `src/consensus`, generated
dependency-free `.mjs` runtime output under `plugins/consensus`, Vitest, Fumadocs
docs, and repo structural validators.

**Commit Convention:** `type(scope): description`

## Planning Checklist

- [x] Discovery completed through OAT boundary.
- [x] Lightweight design drafted, reviewed, and updated.
- [x] Evaluated phases for parallelism opportunities.
- [x] Set `oat_plan_parallel_groups` in frontmatter.

## Parallelism

This plan is sequential. Phase 1 creates the shared config schema, store, and
resolver used by every later phase. Phase 2 updates all existing convergence
wrappers and generated outputs. Phase 3 adds the panel wrapper and uses the same
config module/build mapping. Phase 4 updates shared docs, manifests, and repo
metadata. These phases touch overlapping files such as `scripts/build-generated.mjs`,
`plugins/consensus/skills/*/SKILL.md`, generated `.mjs` outputs, repo structural
tests, and consensus docs. Parallel worktrees would create avoidable merge and
generated-output conflicts, so `oat_plan_parallel_groups: []` is intentional.

## Phase 1: Shared Consensus Config Foundation

### Task p01-t01: Add config schema, store, and resolver tests

**Files:**

- Create: `src/consensus/config/consensus-config.ts`
- Create: `tests/consensus/config/consensus-config.test.ts`

**Step 1: Write tests**

Cover:

- valid and invalid `ConsensusDefaultsConfig` parsing
- user/project/built-in precedence
- explicit invocation override precedence
- convergence workflow returns exactly two agents
- panel workflow returns at least two agents
- deterministic `panel_size` first-N selection
- inventory-order expansion when `panel_size` exceeds configured panelists
- reserved `roles.advisor` accepted in config but not returned by the live v1
  resolver workflow

Run: `pnpm exec vitest run tests/consensus/config/consensus-config.test.ts`
Expected: tests fail because the module does not exist.

**Step 2: Implement**

Implement dependency-free config types, validation, XDG/user path resolution,
project `.consensus/config.json` path resolution, atomic writes, clear-key
support for `peers|panelists|panel-size|roles|all`, and
`resolveConsensusComposition()`.

Run: `pnpm exec vitest run tests/consensus/config/consensus-config.test.ts`
Expected: tests pass.

**Step 3: Verify**

Run: `pnpm run type-check`
Expected: TypeScript passes.

**Step 4: Commit**

```bash
git add src/consensus/config/consensus-config.ts tests/consensus/config/consensus-config.test.ts
git commit -m "feat(p01-t01): add consensus config resolver"
```

### Task p01-t02: Add provider CLI config commands

**Files:**

- Modify: `src/consensus/provider-cli/args.ts`
- Modify: `src/consensus/provider-cli/commands.ts`
- Modify: `src/consensus/provider-cli/cli.ts` if exports need widening
- Modify: `src/consensus/provider-cli/types.ts` if shared envelope types are needed
- Create: `tests/consensus/provider-cli/config-commands.test.ts`

**Step 1: Write tests**

Cover:

- `consensus config get --json --scope user|project|effective`
- `consensus config list --json`
- `consensus config set --json --scope user|project --peers ...`
- `consensus config set --json --scope user|project --panelists ... --panel-size ...`
- `consensus config set --json --from-file ...`
- `consensus config clear --json --scope ... --key peers|panelists|panel-size|roles|all`
- temp `HOME`, `XDG_CONFIG_HOME`, and cwd isolation
- usage errors for missing `--json`, invalid scope, invalid key, malformed config,
  and unsupported workflow

Run: `pnpm exec vitest run tests/consensus/provider-cli/config-commands.test.ts`
Expected: tests fail because `config` is not parsed.

**Step 2: Implement**

Extend the provider CLI parser, help text, command dispatcher, JSON envelopes, and
diagnostics for `get`, `list`, `set`, and `clear`. Use the shared config
store/resolver internally; do not shell out to the CLI from the CLI.

Run: `pnpm exec vitest run tests/consensus/provider-cli/config-commands.test.ts tests/consensus/config/consensus-config.test.ts`
Expected: tests pass.

**Step 3: Verify**

Run: `node plugins/consensus/scripts/consensus.mjs --help`
Expected: generated CLI help is not updated yet; source-level tests remain the
source of truth until the build task regenerates runtime output.

**Step 4: Commit**

```bash
git add src/consensus/provider-cli tests/consensus/provider-cli/config-commands.test.ts
git commit -m "feat(p01-t02): add consensus config cli commands"
```

### Task p01-t03: Regenerate provider CLI runtime output

**Files:**

- Modify: `plugins/consensus/scripts/consensus.mjs`
- Modify: `tests/consensus/provider-cli/*` if generated CLI integration coverage needs adjustment

**Step 1: Build**

Run: `pnpm run build`
Expected: provider CLI output is regenerated with `config` command support.

**Step 2: Verify generated output**

Run: `pnpm run build:check`
Expected: generated output is synchronized.

**Step 3: Verify CLI behavior**

Run: `node plugins/consensus/scripts/consensus.mjs config get --json --scope effective`
Expected: JSON envelope is returned with built-in defaults or empty config plus
diagnostics, without touching real user/project config unless temp env is passed.

Run: `node plugins/consensus/scripts/consensus.mjs config list --json`
Expected: JSON envelope lists available config scopes/keys without mutating user
or project config.

**Step 4: Commit**

```bash
git add plugins/consensus/scripts/consensus.mjs
git commit -m "build(p01-t03): regenerate consensus provider cli"
```

## Phase 2: Existing Wrapper Default-Config Integration

### Task p02-t01: Integrate create, decide, and plan wrappers

**Files:**

- Modify: `src/consensus/create/consensus-create.ts`
- Modify: `src/consensus/decide/consensus-decide.ts`
- Modify: `src/consensus/plan/consensus-plan.ts`
- Modify: `tests/consensus/create/wrapper.test.ts`
- Modify: `tests/consensus/decide/wrapper.test.ts`
- Modify: `tests/consensus/plan/wrapper.test.ts`
- Modify: provider CLI integration tests for these wrappers as needed

**Step 1: Write tests**

Cover:

- no config preserves current built-in peer order
- project/user defaults are used only when `--peers` is absent
- explicit `--peers` wins over project/user config
- configured panel defaults do not leak more than two peers into convergence
  workflows

Run: `pnpm exec vitest run tests/consensus/create tests/consensus/decide tests/consensus/plan`
Expected: new default-config tests fail.

**Step 2: Implement**

Import and call `resolveConsensusComposition({ workflow: 'convergence', ... })`
from each wrapper after parsing arguments and before existing provider preflight.
Keep current parse-time validation for explicit `--peers`.

Run: `pnpm exec vitest run tests/consensus/create tests/consensus/decide tests/consensus/plan`
Expected: tests pass.

Ensure existing wrapper tests run with temp `HOME`, `XDG_CONFIG_HOME`, and cwd so
machine-local consensus config cannot change no-config expectations.

**Step 3: Verify**

Run: `pnpm run type-check`
Expected: TypeScript passes. Generated wrapper outputs are intentionally not
regenerated until p02-t03, so source-level tests remain the source of truth for
this intermediate commit.

**Step 4: Commit**

```bash
git add src/consensus/create src/consensus/decide src/consensus/plan tests/consensus/create tests/consensus/decide tests/consensus/plan
git commit -m "feat(p02-t01): apply default consensus config to creation wrappers"
```

### Task p02-t02: Integrate refine and evaluate wrappers

**Files:**

- Modify: `src/consensus/refine/consensus-refine.ts`
- Modify: `src/consensus/evaluate/consensus-evaluate.ts`
- Modify: `tests/consensus/refine/wrapper-options.test.ts`
- Modify: `tests/consensus/evaluate/wrapper.test.ts`
- Modify: provider CLI integration tests for refine/evaluate as needed

**Step 1: Write tests**

Cover:

- no config preserves current host-aware defaults
- project/user defaults are used only when `--peers` is absent
- explicit `--peers` wins over defaults
- unavailable explicit peers still fail closed
- configured defaults surface provider-neutral diagnostics when unavailable

Run: `pnpm exec vitest run tests/consensus/refine tests/consensus/evaluate`
Expected: new default-config tests fail.

**Step 2: Implement**

Integrate the resolver at the same boundary currently used by `resolvePeers` and
preflight. Keep existing two-peer constraints and escalation behavior unchanged.

Run: `pnpm exec vitest run tests/consensus/refine tests/consensus/evaluate`
Expected: tests pass.

Ensure existing wrapper tests run with temp `HOME`, `XDG_CONFIG_HOME`, and cwd so
machine-local consensus config cannot change no-config expectations.

**Step 3: Verify**

Run: `pnpm run type-check`
Expected: TypeScript passes. Generated wrapper outputs are intentionally not
regenerated until p02-t03, so source-level tests remain the source of truth for
this intermediate commit.

**Step 4: Commit**

```bash
git add src/consensus/refine src/consensus/evaluate tests/consensus/refine tests/consensus/evaluate
git commit -m "feat(p02-t02): apply default consensus config to review wrappers"
```

### Task p02-t03: Update generated wrapper outputs and skill versions

**Files:**

- Modify: `scripts/build-generated.mjs`
- Modify: `plugins/consensus/skills/create/scripts/*.mjs`
- Modify: `plugins/consensus/skills/decide/scripts/*.mjs`
- Modify: `plugins/consensus/skills/plan/scripts/*.mjs`
- Modify: `plugins/consensus/skills/refine/scripts/*.mjs`
- Modify: `plugins/consensus/skills/evaluate/scripts/*.mjs`
- Modify: `plugins/consensus/skills/{create,decide,plan,refine,evaluate}/SKILL.md`
- Create or modify: `tests/consensus/generated-config-import.test.ts`

**Step 1: Update build mappings**

Add generated-output mappings and import rewrites for shared config/resolver
runtime modules as sibling `.mjs` files for each wrapper that imports them.

Run: `pnpm run build`
Expected: generated wrapper outputs include the shared config runtime module
without hand edits.

Add generated-import assertions for all five convergence wrappers:

- generated wrapper `.mjs` files contain `from './consensus-config.mjs'`
- generated wrapper `.mjs` files do not contain `'../config/'`

**Step 2: Bump touched skill versions**

Increase top-level and `metadata.version` for the five changed shipped skills.
Use the repo's established versioning style and keep fields in sync.

Run: `pnpm run validate:skill-versions -- --base-ref origin/main`
Expected: changed skills have version bumps.

**Step 3: Verify**

Run: `pnpm run build:check && pnpm exec vitest run tests/consensus/generated-config-import.test.ts tests/tooling/generated-output-sync.test.ts && pnpm run validate`
Expected: generated outputs, import rewrites, and structural validation pass.

**Step 4: Commit**

```bash
git add scripts/build-generated.mjs plugins/consensus/skills/create plugins/consensus/skills/decide plugins/consensus/skills/plan plugins/consensus/skills/refine plugins/consensus/skills/evaluate tests/consensus/generated-config-import.test.ts
git commit -m "build(p02-t03): regenerate consensus wrappers for default config"
```

## Phase 3: Consensus Panel Runtime

### Task p03-t01: Add panel schema, parser, prompt, and artifact renderer

**Files:**

- Create: `src/consensus/panel/consensus-panel.ts`
- Create: `plugins/consensus/skills/panel/schemas/panel-response.schema.json`
- Create: `tests/consensus/panel/wrapper.test.ts`
- Create: `tests/consensus/panel/panel-schema.test.ts`

**Step 1: Write tests**

Cover:

- `--question` and `--question-file` parsing
- exactly one question source required
- empty and oversized question rejection
- `--panelists`, `--panel-size`, `--output`, `--run-dir`, `--allow-root`
- prompt frames the question as untrusted data and preserves moderator neutrality
- response schema accepts valid payloads and rejects missing/wrong-typed fields
- artifact renderer includes status, question, panelists, attributed responses,
  diagnostics, shortfalls, and metadata

Run: `pnpm exec vitest run tests/consensus/panel/wrapper.test.ts tests/consensus/panel/panel-schema.test.ts`
Expected: tests fail because panel runtime does not exist.

**Step 2: Implement**

Implement parser, prompt builder, schema path resolution, path confinement, run
directory/output resolution, and markdown artifact rendering. Keep the wrapper
dependency-free.

Run: `pnpm exec vitest run tests/consensus/panel/wrapper.test.ts tests/consensus/panel/panel-schema.test.ts`
Expected: tests pass.

**Step 3: Verify**

Run: `pnpm run type-check`
Expected: TypeScript passes.

**Step 4: Commit**

```bash
git add src/consensus/panel plugins/consensus/skills/panel/schemas tests/consensus/panel
git commit -m "feat(p03-t01): add consensus panel artifact contract"
```

### Task p03-t02: Implement panel provider execution and shortfall handling

**Files:**

- Modify: `src/consensus/panel/consensus-panel.ts`
- Create or modify: `tests/consensus/panel/provider-cli-integration.test.ts`
- Modify: `tests/helpers/process.mjs` if helper coverage needs extension

**Step 1: Write tests**

Cover:

- one provider turn per usable panelist using stubbed invokers
- configured defaults used when `--panelists` is absent
- explicit `--panelists` wins over config
- `panel_size` expansion and first-N selection
- configured unavailable panelists produce diagnostics and shortfalls
- at least two successful responses produces `status: passed`
- fewer than two successful responses exits non-zero and writes `status: failed`
  failure evidence when the output path is writable

Run: `pnpm exec vitest run tests/consensus/panel/provider-cli-integration.test.ts`
Expected: tests fail until execution is implemented.

**Step 2: Implement**

Wire panel execution through `consensus run --json`, use `provider ls` for
inventory, `preflight` for readiness, validate each payload, and preserve
per-panelist diagnostics. Do not feed panelist responses to other panelists.

Run: `pnpm exec vitest run tests/consensus/panel`
Expected: panel tests pass.

**Step 3: Verify**

Run: `pnpm run type-check`
Expected: TypeScript passes.

**Step 4: Commit**

```bash
git add src/consensus/panel tests/consensus/panel tests/helpers
git commit -m "feat(p03-t02): execute consensus panel provider turns"
```

### Task p03-t03: Generate panel runtime output

**Files:**

- Modify: `scripts/build-generated.mjs`
- Create: `plugins/consensus/skills/panel/scripts/consensus-panel.mjs`
- Create: `plugins/consensus/skills/panel/scripts/consensus-config.mjs` if the
  panel wrapper imports the shared config module as a sibling output
- Modify: `tests/tooling/generated-output-sync.test.ts` if output enumeration is asserted

**Step 1: Add build mappings**

Add panel wrapper source/output mapping and required import rewrites.

Run: `pnpm run build`
Expected: panel generated runtime outputs are created.

**Step 2: Verify generated sync**

Run: `pnpm run build:check`
Expected: generated output is synchronized.

**Step 3: Verify targeted runtime**

Run: `node plugins/consensus/skills/panel/scripts/consensus-panel.mjs --help`
Expected: wrapper usage/help exits successfully, or the wrapper reports expected
usage output if no `--help` branch exists.

**Step 4: Commit**

```bash
git add scripts/build-generated.mjs plugins/consensus/skills/panel/scripts tests/tooling/generated-output-sync.test.ts
git commit -m "build(p03-t03): generate consensus panel runtime"
```

## Phase 4: Shipped Skill, Docs, and Distribution Surfaces

### Task p04-t01: Add panel skill instructions and examples

**Files:**

- Create: `plugins/consensus/skills/panel/SKILL.md`
- Create: `plugins/consensus/skills/panel/references/operator-qa.md`
- Create: `plugins/consensus/skills/panel/references/examples/*`
- Modify: `scripts/bump-version.mjs`
- Modify: `tests/repo/skill-frontmatter.test.ts`
- Modify: `tests/repo/docs-presence.test.ts`
- Modify: `tests/repo/layout.test.ts`

**Step 1: Write tests**

Cover:

- panel skill frontmatter is portable, versioned, and name matches directory
- panel skill has argument hint, usage sections, success criteria, output
  contract, and clear "When NOT to Use"
- panel references/operator QA and examples exist
- panel skill is included in version bump tooling

Run: `pnpm exec vitest run tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts`
Expected: tests fail until skill files and test expectations exist.

**Step 2: Implement**

Write the skill instructions for neutral moderation, context approval, provider
selection/defaults, wrapper invocation, JSONL reading, output disposition, and
multi-round deferral to `BL-260701-add-multi-round-panel`.

Run: `pnpm exec vitest run tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts`
Expected: tests pass.

**Step 3: Verify skill versioning**

Run: `pnpm run validate`
Expected: structural validation passes.

**Step 4: Commit**

```bash
git add plugins/consensus/skills/panel scripts/bump-version.mjs tests/repo/skill-frontmatter.test.ts tests/repo/docs-presence.test.ts tests/repo/layout.test.ts
git commit -m "feat(p04-t01): add consensus panel skill"
```

### Task p04-t02: Update docs and navigation

**Files:**

- Create: `documentation/docs/user-guide/consensus/panel.md`
- Modify: `documentation/docs/user-guide/consensus/index.md`
- Modify: `documentation/docs/user-guide/consensus/configuration.md`
- Modify: `documentation/docs/user-guide/consensus/meta.json`
- Modify: `documentation/AGENTS.md` only if the docs contract requires an index update
- Modify: `tests/repo/readme-scope.test.ts` or docs tests as needed

**Step 1: Write/adjust tests**

Cover:

- docs page exists and is navigable
- consensus index lists panel as shipped
- configuration docs explain default config paths, precedence, `--panelists`,
  `--panel-size`, and `consensus config`
- docs no longer list `consensus-panel` as future work

Run: `pnpm exec vitest run tests/repo/docs-presence.test.ts tests/repo/readme-scope.test.ts`
Expected: tests fail until docs are updated.

**Step 2: Implement docs**

Author concise Fumadocs pages with examples from repository checkout paths and
installed-plugin command paths. Keep README expansion minimal.

Run: `pnpm exec vitest run tests/repo/docs-presence.test.ts tests/repo/readme-scope.test.ts`
Expected: docs tests pass.

**Step 3: Verify formatting scope**

Run: `pnpm exec oxfmt --check documentation/docs/user-guide/consensus/panel.md documentation/docs/user-guide/consensus/index.md documentation/docs/user-guide/consensus/configuration.md documentation/docs/user-guide/consensus/meta.json`
Expected: touched docs files are formatted.

**Step 4: Commit**

```bash
git add documentation/docs/user-guide/consensus tests/repo/docs-presence.test.ts tests/repo/readme-scope.test.ts
git commit -m "docs(p04-t02): document consensus panel"
```

### Task p04-t03: Update plugin manifests, README, and repo metadata

**Files:**

- Modify: `plugins/consensus/.claude-plugin/plugin.json`
- Modify: `plugins/consensus/.codex-plugin/plugin.json`
- Modify: `plugins/consensus/.cursor-plugin/plugin.json`
- Modify: `plugins/consensus/README.md`
- Modify: `README.md` only for concise shipped-surface summary if tests require it
- Modify: `CHANGELOG.md` if unreleased feature notes are maintained there
- Modify: `tests/repo/plugin-manifests.test.ts`
- Modify: `tests/repo/readme-scope.test.ts`

**Step 1: Write/adjust tests**

Cover provider manifests and README/plugin README mention panel as shipped and
position it separately from `refine`, `evaluate`, and `phone-a-friend`.

Run: `pnpm exec vitest run tests/repo/plugin-manifests.test.ts tests/repo/readme-scope.test.ts`
Expected: tests fail until manifests/docs are updated.

**Step 2: Implement metadata/docs updates**

Update short descriptions, long descriptions, default prompts, and high-level
README/plugin README feature lists. Avoid marketplace claims not verified in the
release checklist.

Run: `pnpm exec vitest run tests/repo/plugin-manifests.test.ts tests/repo/readme-scope.test.ts`
Expected: tests pass.

**Step 3: Verify**

Run: `pnpm run validate`
Expected: structural validation passes.

**Step 4: Commit**

```bash
git add plugins/consensus/.claude-plugin/plugin.json plugins/consensus/.codex-plugin/plugin.json plugins/consensus/.cursor-plugin/plugin.json plugins/consensus/README.md README.md CHANGELOG.md tests/repo/plugin-manifests.test.ts tests/repo/readme-scope.test.ts
git commit -m "docs(p04-t03): update consensus panel distribution surfaces"
```

## Phase 5: Final Validation and Backlog Bookkeeping

### Task p05-t01: Run full generated-output and validation gates

**Files:**

- Modify only files needed to resolve validation drift from prior phases.

**Step 1: Run full verification**

Run: `pnpm run build && pnpm run build:check && pnpm run type-check && pnpm run test && pnpm run validate && pnpm run smoke`
Expected: all gates pass in a temp config environment so `pnpm run smoke` is not
affected by machine-local `~/.config/consensus/config.json` or `.consensus/config.json`.

**Step 2: Fix drift**

If any gate fails, fix only drift caused by this project. Do not format unrelated
files or broaden scope.

Run: `pnpm run build:check && pnpm run type-check && pnpm run test && pnpm run validate && pnpm run smoke`
Expected: all gates pass.

**Step 3: Commit**

```bash
git add src/consensus plugins/consensus tests scripts documentation README.md CHANGELOG.md
git diff --cached --quiet || git commit -m "chore(p05-t01): pass consensus panel validation gates"
```

### Task p05-t02: Update backlog records for completed panel/config items

**Files:**

- Modify: `.oat/repo/pjm/backlog/items/BL-260626-configure-default-consensus.md`
- Modify: `.oat/repo/pjm/backlog/items/BL-260626-add-consensus-panel-skill.md`
- Modify: `.oat/repo/pjm/backlog/index.md`
- Modify: `.oat/repo/pjm/backlog/completed.md` if the backlog workflow uses it

**Step 1: Verify acceptance against implementation**

Review the two backlog items and confirm their acceptance criteria are met by
the shipped code/docs/tests.

Run: `rg -n "consensus-panel|consensus config|panelists|panel_size|default consensus" plugins/consensus src/consensus documentation/docs tests`
Expected: implementation evidence exists across source, docs, and tests.

**Step 2: Update backlog**

Mark the two active backlog items as done or move/archive them according to the
repo's PJM conventions. Regenerate the managed backlog index with
`oat backlog regenerate-index`.

Run: `oat backlog regenerate-index`
Expected: managed backlog table updates cleanly.

**Step 3: Verify**

Run: `pnpm run validate`
Expected: repository validation passes.

**Step 4: Commit**

```bash
git add .oat/repo/pjm/backlog/items/BL-260626-configure-default-consensus.md .oat/repo/pjm/backlog/items/BL-260626-add-consensus-panel-skill.md .oat/repo/pjm/backlog/index.md .oat/repo/pjm/backlog/completed.md
git commit -m "chore(p05-t02): close consensus panel backlog items"
```

## Reviews

| Scope  | Type     | Status          | Date       | Artifact                                                   |
| ------ | -------- | --------------- | ---------- | ---------------------------------------------------------- |
| p01    | code     | passed          | 2026-07-03 | reviews/p01-rereview-2026-07-03.md                        |
| p02    | code     | fixes_completed | 2026-07-03 | reviews/p02-review-2026-07-03-v2.md                       |
| p03    | code     | pending         | -          | -                                                          |
| p04    | code     | pending         | -          | -                                                          |
| p05    | code     | pending         | -          | -                                                          |
| final  | code     | pending         | -          | -                                                          |
| spec   | artifact | pending         | -          | -                                                          |
| design | artifact | fixes_completed | 2026-07-01 | reviews/archived/artifact-design-review-2026-07-01.md     |
| plan   | artifact | fixes_completed | 2026-07-02 | reviews/archived/artifact-plan-review-2026-07-01.md      |

**Status values:** `pending` -> `received` -> `fixes_added` -> `fixes_completed`
-> `passed`

## Implementation Complete

**Summary:**

- Phase 1: 3 tasks - shared config schema, resolver, and provider CLI commands.
- Phase 2: 3 tasks - existing convergence wrappers consume default config and
  generated outputs/versions are updated.
- Phase 3: 3 tasks - panel wrapper, schema, execution, shortfall behavior, and
  generated runtime.
- Phase 4: 3 tasks - shipped panel skill, docs, manifests, README/plugin README,
  and repo metadata.
- Phase 5: 2 tasks - full validation and backlog closure.

**Total: 14 tasks**

Ready for implementation.

## References

- Discovery: `discovery.md`
- Design: `design.md`
- Design review: `reviews/archived/artifact-design-review-2026-07-01.md`
- Backlog: `.oat/repo/pjm/backlog/items/BL-260626-configure-default-consensus.md`
- Backlog: `.oat/repo/pjm/backlog/items/BL-260626-add-consensus-panel-skill.md`
- Deferred follow-up: `.oat/repo/pjm/backlog/items/BL-260701-add-multi-round-panel.md`
