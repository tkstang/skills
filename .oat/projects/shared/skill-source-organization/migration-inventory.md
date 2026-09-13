---
oat_status: in_progress
oat_last_updated: 2026-09-13
oat_generated: false
oat_template: false
---

# Skill Source Migration Inventory

This inventory records the execution baseline for issue #74 before any product source moves. It is dated migration evidence, not an install manifest or compatibility registry.

## Kickoff evidence

- Repository: `tkstang/skills`, branch `feat/skill-source-organization`, kickoff HEAD `348d46caead591060ba00581dd6add22654120c8`.
- Public comparison base: `TASK_BASE_REF=origin/main`, resolved to `20bb893ef6bcdd30704c681e12c60702b7c89bb8`. `git merge-base HEAD "$TASK_BASE_REF"` resolves to that same commit. There is no pull request yet for the current branch, and GitHub reports `main` as the default branch.
- Prerequisite: PR #70 is `MERGED` at `20bb893ef6bcdd30704c681e12c60702b7c89bb8` on 2026-09-13. The merged owner is `skills/coding-session-handoff` with canonical TypeScript under `src/transcript/coding-session-handoff` and tests under `tests/coding-session-handoff`.
- Issue contract: public issue #74 is open and requires colocated authored owners, declared self-contained installation units, dependency-free Node 22 ESM, explicit base-relative version protection, safe complete-tree replacement, and installed-boundary tests.
- Public license: repository `LICENSE` is MIT; every current product `SKILL.md` also declares MIT.
- Portable handoff source: `tkstang/personal-skills` commit `80a5a76de093f812776efb5c90bdc40504dbedfb`, `src/skills/session-handoff/SKILL.md` plus `assets/handoff-template.md`, version `1.1.0`. Its instructions are provider-neutral and public-safe on inspection. The source has no separate license file at that revision, so attribution remains Thomas Stang and publication uses this repository's MIT license only under the confirmed same-owner promotion.
- Complexity-review source: the same personal-skills revision, `src/skills/complexity-review/SKILL.md` plus `references/evidence-guide.md`, version `1.0.2`. The public owner is version `1.0.0` and MIT. The personal repository's `external-skills.json` does not externalize either owner yet; the later private cutover remains p05 work.
- No global installations, private transcripts, live providers, or publication surfaces were changed or invoked during this inventory.

Use this exact base for phase version checks:

```bash
TASK_BASE_REF=origin/main
test "$(git rev-parse "$TASK_BASE_REF")" = 20bb893ef6bcdd30704c681e12c60702b7c89bb8
```

## Product ownership and distribution map

| Old authored/install owner | Current version | New authored owner | Declared installation output | Installed name | Runtime/workflow notes |
| --- | ---: | --- | --- | --- | --- |
| `skills/session-observer` | 1.0.33 | `src/skills/session-observer` | standalone `skills/session-observer`; consensus `plugins/consensus/skills/observer` | standalone `session-observer`; plugin `observer` | TypeScript runtime plus transcript shared closure |
| `skills/session-observer-collab` | 1.0.20 | `src/skills/session-observer-collab` | standalone `skills/session-observer-collab`; consensus `plugins/consensus/skills/observer-collab` | standalone `session-observer-collab`; plugin `observer-collab` | authored MJS/declarations migrate to TS; requires the observer workflow |
| `skills/export-session-transcript` | 1.0.10 | `src/skills/session-export-transcript` | standalone `skills/session-export-transcript`; session `plugins/session/skills/export-transcript` | standalone `session-export-transcript`; plugin `export-transcript` | executable with transcript shared closure; clean-break rename |
| `skills/coding-session-handoff` | 0.1.12 | `src/skills/session-fork-to-destination` | standalone `skills/session-fork-to-destination`; session `plugins/session/skills/fork-to-destination` | standalone `session-fork-to-destination`; plugin `fork-to-destination` | merged experimental guidance/runtime; clean-break rename |
| personal `src/skills/session-handoff` | 1.1.0 | `src/skills/session-handoff` | standalone `skills/session-handoff`; session `plugins/session/skills/handoff` | standalone `session-handoff`; plugin `handoff` | prompt/resource owner; observer/export integrations optional |
| `skills/complexity-review` plus newer personal source | public 1.0.0; personal 1.0.2 | `src/skills/complexity-review` | standalone `skills/complexity-review` | `complexity-review` | prompt-only; no `build.json`, runtime, or empty `src` directory |
| `plugins/consensus/skills/create` | 0.1.6 | `src/skills/create` | consensus `plugins/consensus/skills/create` | `create` | wrapper plus plugin CLI/config/shared closure |
| `plugins/consensus/skills/decide` | 0.1.6 | `src/skills/decide` | consensus `plugins/consensus/skills/decide` | `decide` | wrapper plus plugin CLI/config/shared closure |
| `plugins/consensus/skills/plan` | 0.1.6 | `src/skills/plan` | consensus `plugins/consensus/skills/plan` | `plan` | wrapper plus plugin CLI/config/shared closure |
| `plugins/consensus/skills/refine` | 0.1.9 | `src/skills/refine` | consensus `plugins/consensus/skills/refine` | `refine` | wrapper plus plugin-shared consensus loop/config |
| `plugins/consensus/skills/evaluate` | 0.1.9 | `src/skills/evaluate` | consensus `plugins/consensus/skills/evaluate` | `evaluate` | wrapper plus plugin-shared consensus loop/config |
| `plugins/consensus/skills/panel` | 0.1.2 | `src/skills/panel` | consensus `plugins/consensus/skills/panel` | `panel` | wrapper plus provider CLI/config |
| `plugins/consensus/skills/phone-a-friend` | 0.1.2 | `src/skills/phone-a-friend` | consensus `plugins/consensus/skills/phone-a-friend` | `phone-a-friend` | instruction/schema only; invokes plugin provider CLI |

Only configured outputs are supported. The two renamed session skills have no old-name payload, wrapper, alias, or redirect after p03. Historical old-to-new paths above exist solely for version comparison.

## Runtime, resources, and tests

- Transcript shared owner: `src/transcript/core/{runtimes,cursor-frames,cursor-analysis}.ts` with `tests/transcript-core`; it becomes `src/shared/transcript` and is bundled into observer, export, and fork outputs as required by actual imports.
- Session observer owner: `src/transcript/session-observer`, `skills/session-observer/SKILL.md`, two references, and `tests/session-observer` including fixtures.
- Session observer collaboration owner: `skills/session-observer-collab/SKILL.md`, three runtime references, authored control/lifecycle/hook/library MJS plus declarations, and `tests/session-observer-collab`. Its dependency on session-observer is a workflow prerequisite, not shared code.
- Export owner: `src/transcript/export-session`, the standalone SKILL/reference, and `tests/export-session-transcript`. Its installed entrypoint consumes the shared transcript closure.
- Fork skill owner: `src/skills/session-fork-to-destination`, the standalone SKILL/reference, and its eight product-guidance tests. Retained tooling owner: `src/tools/coding-session-handoff` and its five behavior/CLI/handoff/provider/reconcile tests. `tools/coding-session-handoff/{README.md,coding-session-handoff.mjs,guidance-capabilities.md}` stays experimental repository tooling and is not a distributable skill resource.
- Consensus skill owners: each directory under `plugins/consensus/skills` owns its SKILL, schemas, references, and corresponding wrapper-specific source/tests under `src/consensus/{create,decide,plan,refine,evaluate,panel}` and `tests/consensus`. Phone-a-friend owns its schema/reference tests but no wrapper.
- Consensus plugin owner: `src/consensus/{core,config,provider-cli,shared}`, plugin-level tests, `plugins/consensus/agents`, plugin references, provider manifests, root marketplaces, `install.sh`, and plugin README. Existing CLI entrypoints are `plugins/consensus/scripts/consensus.mjs`, `consensus-loop.mjs`, `loop-*.mjs`, and `consensus-cli-helpers.mjs`; these remain plugin-owned rather than being assigned to an arbitrary skill.
- Current generation is a hand-maintained table in `scripts/build-generated.mjs`. `scripts/lib/discover-skills.mjs` discovers `skills/*` and `plugins/*/skills/*`; `scripts/bump-version.mjs` hardcodes consensus manifest/catalog surfaces. p01-t02 adds a declaration pipeline while retaining the table only as the migration bridge.
- Provider/catalog surfaces are `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`, and `plugins/consensus/.{claude,cursor,codex}-plugin/plugin.json`. All currently declare only consensus version 0.1.0. Session is added in p03 with an independent release version.
- Maintained clean-break references occur in the root/documentation manifests and docs, current SKILL instructions, release/validation fixtures, build mappings, installation tests, and generated banners found by repository-wide searches for `coding-session-handoff` and `export-session-transcript`. They are updated in their owning tasks; generated payloads are never hand-edited.

## Formatter path contracts

The arrays below contain shell-quoted, format-eligible authored paths. They exclude deleted paths, generated payloads, raw JSONL fixtures, upstream mirrors, lockfiles, and AGENTS/CLAUDE files. If a destination changes before its task, update this inventory before formatting; append only directly affected authored callers/tests/config/resources.

<!-- FORMATTER_ARRAYS -->

### p01-t02

~~~bash
task_format_paths=(
  'package.json'
  'scripts/build-generated.ts'
  'scripts/lib/packaging.ts'
  'src/distributions.ts'
  'tests/tooling/generated-output-sync.test.ts'
  'tests/tooling/skill-packaging.test.ts'
  'tests/tooling/vitest-config.test.ts'
  'tsconfig.json'
  'vitest.config.mjs'
)
test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"
~~~

### p01-t03

~~~bash
task_format_paths=(
  'scripts/lib/packaging.ts'
  'tests/tooling/skill-packaging.test.ts'
)
test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"
~~~

### p02-t01

~~~bash
task_format_paths=(
  'scripts/build-generated.ts'
  'scripts/lib/packaging.ts'
  'src/distributions.ts'
  'src/shared/transcript/cursor-analysis.test.ts'
  'src/shared/transcript/cursor-analysis.ts'
  'src/shared/transcript/cursor-fixtures.test.ts'
  'src/shared/transcript/cursor-frames.test.ts'
  'src/shared/transcript/cursor-frames.ts'
  'src/shared/transcript/runtimes.test.ts'
  'src/shared/transcript/runtimes.ts'
  'src/skills/complexity-review/SKILL.md'
  'src/skills/session-export-transcript/SKILL.md'
  'src/skills/session-export-transcript/references/transcript-formats.md'
  'src/skills/session-export-transcript/src/cli.test.ts'
  'src/skills/session-export-transcript/src/export-session-transcript.ts'
  'src/skills/session-export-transcript/src/sanitize.test.ts'
  'src/skills/session-export-transcript/src/sanitize.ts'
  'src/skills/session-fork-to-destination/SKILL.md'
  'src/skills/session-fork-to-destination/references/provider-guidance.md'
  'src/skills/session-fork-to-destination/src/behavior-contracts.ts'
  'src/tools/coding-session-handoff/behavior-gate.test.ts'
  'src/skills/session-fork-to-destination/src/behavior-gate.ts'
  'src/tools/coding-session-handoff/cli.test.ts'
  'src/skills/session-fork-to-destination/src/cli.ts'
  'src/skills/session-fork-to-destination/src/discovery.test.ts'
  'src/skills/session-fork-to-destination/src/discovery.ts'
  'src/skills/session-fork-to-destination/src/git-target.test.ts'
  'src/skills/session-fork-to-destination/src/git-target.ts'
  'src/skills/session-fork-to-destination/src/guidance-capabilities.test.ts'
  'src/skills/session-fork-to-destination/src/guidance-capabilities.ts'
  'src/skills/session-fork-to-destination/src/guidance-cli.test.ts'
  'src/skills/session-fork-to-destination/src/guidance-cli.ts'
  'src/skills/session-fork-to-destination/src/guidance-discovery.test.ts'
  'src/skills/session-fork-to-destination/src/guidance-discovery.ts'
  'src/skills/session-fork-to-destination/src/guidance.test.ts'
  'src/skills/session-fork-to-destination/src/guidance.ts'
  'src/tools/coding-session-handoff/handoff.test.ts'
  'src/skills/session-fork-to-destination/src/handoff.ts'
  'src/skills/session-fork-to-destination/src/preview.test.ts'
  'src/skills/session-fork-to-destination/src/preview.ts'
  'src/tools/coding-session-handoff/providers.test.ts'
  'src/skills/session-fork-to-destination/src/providers.ts'
  'src/tools/coding-session-handoff/reconcile.test.ts'
  'src/skills/session-fork-to-destination/src/types.test.ts'
  'src/skills/session-fork-to-destination/src/types.ts'
  'src/skills/session-observer-collab/SKILL.md'
  'src/skills/session-observer-collab/references/runtime-claude-code.md'
  'src/skills/session-observer-collab/references/runtime-codex.md'
  'src/skills/session-observer-collab/references/runtime-cursor.md'
  'src/skills/session-observer-collab/src/ambient-types.ts'
  'src/skills/session-observer-collab/src/codex-hook.test.ts'
  'src/skills/session-observer-collab/src/codex-install.test.ts'
  'src/skills/session-observer-collab/src/codex-lifecycle-declaration.test.ts'
  'src/skills/session-observer-collab/src/codex-lifecycle.ts'
  'src/skills/session-observer-collab/src/collab-control.ts'
  'src/skills/session-observer-collab/src/completion.test.ts'
  'src/skills/session-observer-collab/src/control.test.ts'
  'src/skills/session-observer-collab/src/cursor-hook.test.ts'
  'src/skills/session-observer-collab/src/fixtures/lease-v1.json'
  'src/skills/session-observer-collab/src/hooks/codex-stop.ts'
  'src/skills/session-observer-collab/src/hooks/cursor-stop.ts'
  'src/skills/session-observer-collab/src/lib/codex-install.ts'
  'src/skills/session-observer-collab/src/lib/completion-selection.ts'
  'src/skills/session-observer-collab/src/lib/lease-state.ts'
  'src/skills/session-observer-collab/src/lib/runtime-adapter.ts'
  'src/skills/session-observer-collab/src/lib/selected-prefix.ts'
  'src/skills/session-observer-collab/src/runtime-claude-code-reference.test.ts'
  'src/skills/session-observer-collab/src/runtime-reference-routing.test.ts'
  'src/skills/session-observer-collab/src/tsconfig.types.json'
  'src/skills/session-observer-collab/src/wake-envelope-contract.test.ts'
  'src/skills/session-observer/SKILL.md'
  'src/skills/session-observer/references/transcript-formats.md'
  'src/skills/session-observer/references/watch-design.md'
  'src/skills/session-observer/src/cli-session-override.test.ts'
  'src/skills/session-observer/src/cli.test.ts'
  'src/skills/session-observer/src/cursor-state.test.ts'
  'src/skills/session-observer/src/digest.test.ts'
  'src/skills/session-observer/src/helpers/tmpdir.ts'
  'src/skills/session-observer/src/integration.test.ts'
  'src/skills/session-observer/src/lib/cursor-state.ts'
  'src/skills/session-observer/src/lib/digest.ts'
  'src/skills/session-observer/src/lib/locate.ts'
  'src/skills/session-observer/src/lib/observe.ts'
  'src/skills/session-observer/src/lib/rank.ts'
  'src/skills/session-observer/src/lib/session-classifier.ts'
  'src/skills/session-observer/src/lib/state.ts'
  'src/skills/session-observer/src/lib/types.ts'
  'src/skills/session-observer/src/lib/watch-state.ts'
  'src/skills/session-observer/src/lib/watch.ts'
  'src/skills/session-observer/src/locate.test.ts'
  'src/skills/session-observer/src/observe.test.ts'
  'src/skills/session-observer/src/probe-local.ts'
  'src/skills/session-observer/src/rank.test.ts'
  'src/skills/session-observer/src/session-classifier.test.ts'
  'src/skills/session-observer/src/session-observer.ts'
  'src/skills/session-observer/src/state.test.ts'
  'src/skills/session-observer/src/watch-state.test.ts'
  'src/skills/session-observer/src/watch.test.ts'
  'tests/tooling/skill-packaging.test.ts'
  'tsconfig.json'
)
test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"
~~~

### p02-t02

~~~bash
task_format_paths=(
  '.claude-plugin/marketplace.json'
  '.cursor-plugin/marketplace.json'
  'plugins/consensus/.claude-plugin/plugin.json'
  'plugins/consensus/.codex-plugin/plugin.json'
  'plugins/consensus/.cursor-plugin/plugin.json'
  'plugins/consensus/README.md'
  'plugins/consensus/agents/consensus-section-runner.md'
  'plugins/consensus/references/live-e2e.md'
  'scripts/build-generated.ts'
  'scripts/lib/packaging.ts'
  'src/distributions.ts'
  'src/plugins/consensus/config/consensus-config.test.ts'
  'src/plugins/consensus/config/consensus-config.ts'
  'src/plugins/consensus/core/consensus-loop.ts'
  'src/plugins/consensus/core/escalation.test.ts'
  'src/plugins/consensus/core/independent-draft-loop.test.ts'
  'src/plugins/consensus/core/independent-draft-prompts.test.ts'
  'src/plugins/consensus/core/loop-args.ts'
  'src/plugins/consensus/core/loop-cli.test.ts'
  'src/plugins/consensus/core/loop-convergence.test.ts'
  'src/plugins/consensus/core/loop-escalation.ts'
  'src/plugins/consensus/core/loop-prompts.ts'
  'src/plugins/consensus/core/loop-provider.ts'
  'src/plugins/consensus/core/loop-records.test.ts'
  'src/plugins/consensus/core/loop-records.ts'
  'src/plugins/consensus/core/loop-rounds.ts'
  'src/plugins/consensus/core/loop-types.ts'
  'src/plugins/consensus/core/loop-validation.ts'
  'src/plugins/consensus/core/provider-cli-invocation.test.ts'
  'src/plugins/consensus/core/provider-cli-timeout.test.ts'
  'src/plugins/consensus/core/provider-retry-boundary.test.ts'
  'src/plugins/consensus/core/resolve-consensus-cli-path.test.ts'
  'src/plugins/consensus/core/verdict-validation.test.ts'
  'src/plugins/consensus/generated-config-import.test.ts'
  'src/plugins/consensus/generated-evaluate-import.test.ts'
  'src/plugins/consensus/generated-refine-import.test.ts'
  'src/plugins/consensus/install-contract.test.ts'
  'src/plugins/consensus/install-sh.test.ts'
  'src/plugins/consensus/provider-cli/adapters.test.ts'
  'src/plugins/consensus/provider-cli/adapters.ts'
  'src/plugins/consensus/provider-cli/args.test.ts'
  'src/plugins/consensus/provider-cli/args.ts'
  'src/plugins/consensus/provider-cli/cli-process.test.ts'
  'src/plugins/consensus/provider-cli/cli.ts'
  'src/plugins/consensus/provider-cli/commands.test.ts'
  'src/plugins/consensus/provider-cli/commands.ts'
  'src/plugins/consensus/provider-cli/config-commands.test.ts'
  'src/plugins/consensus/provider-cli/e2e/submit-live.e2e.test.ts'
  'src/plugins/consensus/provider-cli/envelope.test.ts'
  'src/plugins/consensus/provider-cli/envelope.ts'
  'src/plugins/consensus/provider-cli/evidence/no-structured-output.test.ts'
  'src/plugins/consensus/provider-cli/evidence/strict-output-rejection.test.ts'
  'src/plugins/consensus/provider-cli/host-guard.test.ts'
  'src/plugins/consensus/provider-cli/host-guard.ts'
  'src/plugins/consensus/provider-cli/invocation.test.ts'
  'src/plugins/consensus/provider-cli/invocation.ts'
  'src/plugins/consensus/provider-cli/missing-cli-message.test.ts'
  'src/plugins/consensus/provider-cli/probe.test.ts'
  'src/plugins/consensus/provider-cli/probe.ts'
  'src/plugins/consensus/provider-cli/runtime-policy.test.ts'
  'src/plugins/consensus/provider-cli/runtime-policy.ts'
  'src/plugins/consensus/provider-cli/schema-validate.test.ts'
  'src/plugins/consensus/provider-cli/schema-validate.ts'
  'src/plugins/consensus/provider-cli/source-cleanup.test.ts'
  'src/plugins/consensus/provider-cli/structured-output.test.ts'
  'src/plugins/consensus/provider-cli/structured-output.ts'
  'src/plugins/consensus/provider-cli/submit-capture.test.ts'
  'src/plugins/consensus/provider-cli/submit-capture.ts'
  'src/plugins/consensus/provider-cli/subprocess.test.ts'
  'src/plugins/consensus/provider-cli/subprocess.ts'
  'src/plugins/consensus/provider-cli/types.test.ts'
  'src/plugins/consensus/provider-cli/types.ts'
  'src/plugins/consensus/shared/cli-helpers.ts'
  'src/skills/create/SKILL.md'
  'src/skills/create/references/examples/artifact-brief.md'
  'src/skills/create/references/operator-qa.md'
  'src/skills/create/schemas/synthesis.schema.json'
  'src/skills/create/schemas/verdict-alternating.schema.json'
  'src/skills/create/schemas/verdict-parallel.schema.json'
  'src/skills/create/src/consensus-create.ts'
  'src/skills/create/src/provider-cli-integration.test.ts'
  'src/skills/create/src/wrapper.test.ts'
  'src/skills/decide/SKILL.md'
  'src/skills/decide/references/examples/contested-options.md'
  'src/skills/decide/references/operator-qa.md'
  'src/skills/decide/schemas/synthesis.schema.json'
  'src/skills/decide/schemas/verdict-alternating.schema.json'
  'src/skills/decide/schemas/verdict-parallel.schema.json'
  'src/skills/decide/src/consensus-decide.ts'
  'src/skills/decide/src/provider-cli-integration.test.ts'
  'src/skills/decide/src/wrapper.test.ts'
  'src/skills/evaluate/SKILL.md'
  'src/skills/evaluate/references/examples/code-review.md'
  'src/skills/evaluate/references/examples/design-architecture.md'
  'src/skills/evaluate/references/examples/general-purpose.md'
  'src/skills/evaluate/references/examples/technical-writing.md'
  'src/skills/evaluate/references/operator-qa.md'
  'src/skills/evaluate/schemas/synthesis.schema.json'
  'src/skills/evaluate/schemas/verdict-alternating.schema.json'
  'src/skills/evaluate/schemas/verdict-parallel.schema.json'
  'src/skills/evaluate/src/consensus-evaluate.ts'
  'src/skills/evaluate/src/output.test.ts'
  'src/skills/evaluate/src/prompt-profile.test.ts'
  'src/skills/evaluate/src/provider-cli-integration.test.ts'
  'src/skills/evaluate/src/rubric-example-criteria-cap.test.ts'
  'src/skills/evaluate/src/schema-parity.test.ts'
  'src/skills/evaluate/src/wrapper.test.ts'
  'src/skills/panel/SKILL.md'
  'src/skills/panel/references/examples/design-risk-question.md'
  'src/skills/panel/references/examples/privacy-boundary-question.md'
  'src/skills/panel/references/operator-qa.md'
  'src/skills/panel/schemas/panel-response.schema.json'
  'src/skills/panel/src/consensus-panel.ts'
  'src/skills/panel/src/panel-schema.test.ts'
  'src/skills/panel/src/provider-cli-integration.test.ts'
  'src/skills/panel/src/provider-cli-timeout.test.ts'
  'src/skills/panel/src/wrapper.test.ts'
  'src/skills/phone-a-friend/SKILL.md'
  'src/skills/phone-a-friend/references/examples/registry-cache.advisory.json'
  'src/skills/phone-a-friend/references/examples/registry-cache.prompt.md'
  'src/skills/phone-a-friend/references/operator-qa.md'
  'src/skills/phone-a-friend/schemas/advisory.schema.json'
  'src/skills/phone-a-friend/src/advisory-schema.test.ts'
  'src/skills/plan/SKILL.md'
  'src/skills/plan/references/examples/goal-and-constraints.md'
  'src/skills/plan/references/operator-qa.md'
  'src/skills/plan/schemas/synthesis.schema.json'
  'src/skills/plan/schemas/verdict-alternating.schema.json'
  'src/skills/plan/schemas/verdict-parallel.schema.json'
  'src/skills/plan/src/consensus-plan.ts'
  'src/skills/plan/src/provider-cli-integration.test.ts'
  'src/skills/plan/src/wrapper.test.ts'
  'src/skills/refine/SKILL.md'
  'src/skills/refine/references/examples/architecture-note.md'
  'src/skills/refine/references/examples/contested-tradeoffs.md'
  'src/skills/refine/references/examples/email-announcement.md'
  'src/skills/refine/references/operator-qa.md'
  'src/skills/refine/schemas/synthesis.schema.json'
  'src/skills/refine/schemas/verdict-alternating.schema.json'
  'src/skills/refine/schemas/verdict-parallel.schema.json'
  'src/skills/refine/src/consensus-refine.ts'
  'src/skills/refine/src/error-handling.test.ts'
  'src/skills/refine/src/escalation-lifecycle.test.ts'
  'src/skills/refine/src/event-payload-inventory.test.ts'
  'src/skills/refine/src/host-dispatch-docs.test.ts'
  'src/skills/refine/src/parallel-errors.test.ts'
  'src/skills/refine/src/parallel-fan-in.test.ts'
  'src/skills/refine/src/parallel-integration.test.ts'
  'src/skills/refine/src/parallel-modes.test.ts'
  'src/skills/refine/src/parallel-prepare.test.ts'
  'src/skills/refine/src/path-safety.test.ts'
  'src/skills/refine/src/provider-cli-integration.test.ts'
  'src/skills/refine/src/provider-subprocess.test.ts'
  'src/skills/refine/src/refine-args.ts'
  'src/skills/refine/src/refine-escalation.ts'
  'src/skills/refine/src/refine-manifest.ts'
  'src/skills/refine/src/refine-render.ts'
  'src/skills/refine/src/refine-resume.ts'
  'src/skills/refine/src/refine-sections.ts'
  'src/skills/refine/src/refine-shared.ts'
  'src/skills/refine/src/refine-types.ts'
  'src/skills/refine/src/resume-corruption.test.ts'
  'src/skills/refine/src/resume-matrix.test.ts'
  'src/skills/refine/src/resume-parse.test.ts'
  'src/skills/refine/src/section-parser.test.ts'
  'src/skills/refine/src/sequential-wrapper.test.ts'
  'src/skills/refine/src/user-intervention.test.ts'
  'src/skills/refine/src/wrapper-options.test.ts'
  'tests/tooling/skill-packaging.test.ts'
  'tsconfig.json'
)
test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"
~~~

### p02-t03

~~~bash
task_format_paths=(
  '.oat/repo/pjm/backlog/archived/BL-260723-guard-transitive-shared.md'
  '.oat/repo/pjm/backlog/completed.md'
  '.oat/repo/pjm/backlog/index.md'
  'package.json'
  'scripts/bump-version.ts'
  'scripts/lib/discover-skills.ts'
  'scripts/lib/skill-frontmatter.ts'
  'scripts/validate-skill-versions.ts'
  'scripts/validate.ts'
  'src/distributions.ts'
  'tests/release/skill-version-bumps.test.ts'
  'tests/release/validate-script.test.ts'
  'tests/release/versioning.test.ts'
  'tests/repo/skill-frontmatter.test.ts'
  'tsconfig.json'
)
test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"
~~~

### p02-t04

~~~bash
task_format_paths=(
  '.lintstagedrc.mjs'
  '.oxfmtrc.json'
  '.oxlintrc.json'
  'package.json'
  'scripts/apply-internal-flags.ts'
  'scripts/build-generated.ts'
  'scripts/smoke-test.mjs'
  'scripts/validate-internal-flags.ts'
  'tests/release/smoke-test-script.test.ts'
  'tests/release/validate-script.test.ts'
  'tests/repo/package-metadata.test.ts'
  'tests/scripts/apply-internal-flags.test.ts'
  'tests/scripts/validate-internal-flags.test.ts'
  'tests/tooling/generated-output-sync.test.ts'
  'tests/tooling/git-hooks.test.ts'
  'tests/tooling/vitest-config.test.ts'
  'tools/git-hooks/README.md'
  'vitest.config.mjs'
)
test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"
~~~

### p03-t01

~~~bash
task_format_paths=(
  '.claude-plugin/marketplace.json'
  '.cursor-plugin/marketplace.json'
  'plugins/consensus/.claude-plugin/plugin.json'
  'plugins/consensus/.codex-plugin/plugin.json'
  'plugins/consensus/.cursor-plugin/plugin.json'
  'plugins/session/.claude-plugin/plugin.json'
  'plugins/session/.codex-plugin/plugin.json'
  'plugins/session/.cursor-plugin/plugin.json'
  'scripts/build-generated.ts'
  'scripts/lib/packaging.ts'
  'src/distributions.ts'
  'tests/release/versioning.test.ts'
  'tests/repo/layout.test.ts'
  'tests/repo/marketplace-manifests.test.ts'
  'tests/repo/plugin-manifests.test.ts'
  'tests/tooling/skill-packaging.test.ts'
)
test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"
~~~

### p03-t02

~~~bash
task_format_paths=(
  'src/distributions.ts'
  'src/skills/session-handoff/SKILL.md'
  'src/skills/session-handoff/assets/handoff-template.md'
  'tests/tooling/skill-packaging.test.ts'
)
test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"
~~~

### p03-t03

~~~bash
task_format_paths=(
  'src/skills/complexity-review/SKILL.md'
  'src/skills/complexity-review/references/evidence-guide.md'
  'tests/tooling/skill-packaging.test.ts'
)
test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"
~~~

### p03-t04

~~~bash
task_format_paths=(
  'src/distributions.ts'
  'src/plugins/consensus/provider-cli/probe.test.ts'
  'src/plugins/consensus/provider-cli/probe.ts'
  'src/plugins/consensus/provider-cli/runtime-policy.test.ts'
  'src/plugins/consensus/provider-cli/runtime-policy.ts'
  'src/skills/create/SKILL.md'
  'src/skills/decide/SKILL.md'
  'src/skills/evaluate/SKILL.md'
  'src/skills/panel/SKILL.md'
  'src/skills/phone-a-friend/SKILL.md'
  'src/skills/plan/SKILL.md'
  'src/skills/refine/SKILL.md'
  'src/skills/session-handoff/SKILL.md'
  'src/skills/session-observer-collab/SKILL.md'
  'src/skills/session-observer/SKILL.md'
  'tests/tooling/skill-packaging.test.ts'
)
test "${#task_format_paths[@]}" -gt 0 && pnpm exec oxfmt --write "${task_format_paths[@]}"
~~~

## Reconciliation result

Every current product SKILL has an authored owner, version baseline, destination owner, and declared output above. Repository source/test/resource sweeps found no additional product skill outside those rows. Upstream `.agents/skills` mirrors are intentionally excluded. The merged prerequisite and both personal source revisions reconcile with discovery/design; no scope change or ownership conflict blocks p01.
