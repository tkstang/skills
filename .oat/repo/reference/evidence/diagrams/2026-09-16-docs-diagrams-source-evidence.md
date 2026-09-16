> Source-verification record for the diagrams placed on 2026-09-16. Paths under `tmp/collab/` refer to the machine-local working directory at the time; the diagrams themselves live in the docs pages and `documentation/public/diagrams/`.

# Docs diagrams — proposal assets

Untracked proposal assets. Nothing here is wired into the docs site yet.

Convention: the `.mmd` Mermaid source is the source of truth for every diagram
(agents read it). A polished hand-authored `.svg` is an optional human-facing
counterpart. All three SVGs use an **830-unit viewBox** so units render 1:1 at
the site's ~830px content column: title 20px, card titles 17px, body 15px,
monospace 14px (13px where a path is long), band headers 13px. Nothing is
below 13px. Where both exist the page wraps them in a `=== "Diagram"` /
`=== "Source"` tab group with italic date captions.

Mermaid blocks here carry no `%%{init}` directive and no `style` / `classDef`
colour overrides, so they inherit the site's Mermaid `theme: 'base'` palette.

**Verification rule applied to every diagram below:** each node and labelled edge
is backed by a `file:line` reference to runtime source, workflow YAML, a hook
script, a JSON Schema, or a canonical `src/skills/**/SKILL.md`. Docs pages were
used only as a map. Claims that exist only as docs prose were removed. Claims
that exist only as skill *instructions* (prompt-level rules the runtime does not
enforce) are called out as such in the diagram label and in the evidence list.

**No Mermaid renderer is available in this worktree** (`mmdc` is not installed
and installing was out of scope), so the `.mmd` files are syntax-reviewed but not
render-verified. Both SVGs were rendered light and dark with `rsvg-convert` and
visually checked.

---

## Batch 1

| Slug | Placement page | SVG? | Caption | Date |
| --- | --- | --- | --- | --- |
| `one-skill-many-forms` | `engineering/architecture/index.md` | yes | A skill is authored once under `src/skills/` (`session-retro` is `SKILL.md` + assets), `pnpm run build` emits every declared form, and providers install those forms — the build never registers or releases a plugin. Standalone `session-retro`, Session plugin member `retro`. | 2026-09-16 |
| `consensus-host-peers-artifact` | `user-guide/consensus/index.md` | yes | The skill wrapper emits JSONL while the generated CLI returns one JSON envelope per run and spawns other providers' CLIs as independent OS subprocesses. `IMPASSE` is checked before convergence; a declined convergence consults escalation triggers. Every terminal outcome writes the refine artifact (`consensus-resolution` plus a separate `consensus-section-states` block and the `## Deliberation Log`); `decide` writes its own `consensus-decision.md`. | 2026-09-16 |
| `consensus-refine-panel-phone` | `user-guide/consensus/index.md` (or a workflow guide) | no | Three non-interchangeable shapes: `refine` deliberates to convergence or a reported impasse, `panel` returns attributed takes and refuses to synthesize, `phone-a-friend` returns one advisory take the host must disposition. The columns differ in who decides. | 2026-09-16 |
| `session-choose-output` | `user-guide/plugins/session/index.md` | no | Session skills are alternatives, not a pipeline: pick handoff, export transcript, fork to destination, or retro by the output you need. Observer is a declared optional integration for handoff, retro, **and fork-to-destination**; transcript export is one for handoff. | 2026-09-16 |
| `change-generate-verify-release` | `engineering/contributing/development/index.md` | no | Edit the canonical owner and its distribution declaration, bump `metadata.version`, run `pnpm run build`, then verify. The live-provider E2E is an **independent manual gate** — no workflow invokes it and the Release workflow does not require it. | 2026-09-16 |

## Batch 2

| Slug | Placement page | SVG? | Caption | Date |
| --- | --- | --- | --- | --- |
| `verdict-precedence` | `user-guide/consensus/refine.md` (§Escalation) | no | The order is load-bearing: an explicit `IMPASSE` short-circuits, convergence is tested next, and only a declined convergence consults the four escalation triggers — which are then routed to auto, host, or user by agency. | 2026-09-16 |
| `trust-boundary` | new `user-guide/trust-and-data-boundaries.md` (also reusable in the README) | yes | Transcripts, observer/collab state, and `.consensus/` run state stay local. No artifact **file** crosses — the skill reads it locally and compacts it into the argv prompt string; the schema goes inline in argv for Claude and as a path plus four `CONSENSUS_SUBMIT_*` vars for Codex; the child inherits an unconfined cwd. Everything that comes back is schema-validated untrusted data. | 2026-09-16 |
| `provider-readiness-states` **(two fences)** | `user-guide/consensus/configuration.md` (§Provider floor, inventory, and preflight) | no | Readiness is a state machine, not a boolean: `missing`, `auth_required`, `unavailable` (four distinct diagnostics), or `ready`. `consensus run` is a separate command that never probes; its terminal failures still exit 0 inside a JSON envelope, with `CONSENSUS_CLI_USAGE` (exit 2) the only exception. | 2026-09-16 |
| `where-gates-run` | `engineering/contributing/development/hooks-and-safety.md` | no | Six independent triggers, not a pipeline: no job declares `needs`, the PR-only jobs run in parallel with `validate`, and Deploy Docs and Live Provider E2E are separate workflows. | 2026-09-16 |
| `collab-lease-lifecycle` | `user-guide/skills/session-observer-collab.md` (§Manage local lifecycle state) | no | The five literal lease states and the demotions readers get wrong: expiry, cap exhaustion, and wait timeout all silently demote to `idle`; a non-terminal wake returns to `armed`; and `disarmed` is not terminal — `arm` writes a fresh lease from any non-`armed`/`waiting` state. | 2026-09-16 |
| `fork-qualification-gates` | `user-guide/skills/session-fork-to-destination.md` (§Choose an entry point) | no | `prepare` always runs discovery whatever the entry point. The gates in code order: for Cursor candidates only, `cwdEvidenceQuality` must be `independent-exact` (it never is today), then recorded-cwd equality, then the ambiguous-surface refusal, then documented fork semantics for that exact surface, then the `pwd -P` destination guard. | 2026-09-16 |
| `build-transaction` | `engineering/architecture/generated-runtime.md` (§When build or check fails) | no | The generated build is a staged transaction: stage, validate the complete unit before touching anything, move prior outputs aside, install. Validation failure aborts before any mutation; the three replacement outcomes need three different responses. | 2026-09-16 |

### Placement note

The placement map called for `plugins/consensus/index.md`. In this worktree the
consensus overview still lives at
`documentation/docs/user-guide/consensus/index.md` (the new
`documentation/docs/user-guide/plugins/index.md` links to `../consensus/index.md`),
so the two consensus diagrams are mapped there. The session overview is already
at `documentation/docs/user-guide/plugins/session/index.md`.

---

## Evidence

Paths are repo-relative. `SKILL.md` references are canonical authored skill
source under `src/skills/`, not generated payloads.

### `one-skill-many-forms`

- `src/skills/session-retro/` owner, standalone target `skills/session-retro`, plugin target `plugins/session/skills/retro` — `src/distributions.ts:155-176`
- the owner directory holds `SKILL.md` and `assets/report-template.md` only — no runtime, no `build.json` (`src/skills/session-retro/`)
- `pnpm run build` → `scripts/build-generated.ts` — `package.json:7`
- `pnpm run build:check` → same owner with `--check` — `package.json:8`; `--check` parsing `scripts/build-generated.ts:115-118`, check path `scripts/build-generated.ts:668`, `checkDeclaredDistributions` `scripts/build-generated.ts:512`
- "release-owned, not generated": provider + marketplace manifests are declared in `src/distributions.ts:12-38` and are only *read/written* by `scripts/bump-version.ts:160-206` and *validated* by `scripts/validate.ts:514-520`; they are not emitted by `scripts/build-generated.ts`
- Claude Code / Codex / Cursor as install hosts — `src/distributions.ts:15-24` (`.claude-plugin`, `.cursor-plugin`, `.codex-plugin` manifests per plugin)
- "no install step" — the packager rejects runtime package dependencies: `scripts/lib/packaging.ts:516`

### `consensus-host-peers-artifact`

- `claude --print --output-format json` — `src/plugins/consensus/provider-cli/invocation.ts:50`
- `codex exec --json --output-last-message <file>` — `src/plugins/consensus/provider-cli/invocation.ts:97`
- `cursor-agent --output-format json --force` — `src/plugins/consensus/provider-cli/invocation.ts:138`
- "separate OS processes" — `spawn(invocation.executable, invocation.argv, …)` `src/plugins/consensus/provider-cli/subprocess.ts:86`
- adapter registration for the three executables — `src/plugins/consensus/provider-cli/adapters.ts:120,164,214`
- schema-validated verdict — `validateSchemaSubset` `src/plugins/consensus/provider-cli/structured-output.ts:292`; failure code `PROVIDER_SCHEMA_VALIDATION` at `:301`, `terminal_reason: 'schema_validation'` at `:308`
- `IMPASSE` checked before convergence — `src/plugins/consensus/core/consensus-loop.ts:508` (impasse) then `:522-530` (convergence); the ordering is stated at `:490-492` and `:549-551`
- alternating-mode impasse short-circuit — `src/plugins/consensus/core/consensus-loop.ts:802`, with convergence tested afterwards at `:827`
- artifact path `<input>.consensus.md` — `src/skills/refine/src/refine-shared.ts:278`, `src/skills/refine/src/refine-manifest.ts:180`
- the renderer emits **two** canonical blocks: `consensus-resolution` at `src/skills/refine/src/refine-render.ts:433` and a separate `consensus-section-states` at `:443`; `## Deliberation Log` at `:445`
- `## Dissent / Unresolved Disagreement` is a required `decide` heading — `src/skills/decide/src/consensus-decide.ts:424-429`; validated in each peer's decision text at `:957` and re-rendered at `:1009`; `decide` writes its own artifact `consensus-decision.md` at `:771`, which is **not** a section of the refine artifact
- a declined convergence consults escalation triggers and can terminate the run — `src/plugins/consensus/core/consensus-loop.ts:549-562`
- an **auto-routed** escalation is not an `escalation_required` event: it terminates as `status: 'converged'` — `consensus-loop.ts:397-408`; only sections whose status is `escalation` produce the event — `src/skills/refine/src/refine-escalation.ts:95-96`
- the CLI returns one JSON envelope per run (`writeJson`) — `src/plugins/consensus/provider-cli/commands.ts:398`; the JSONL status events come from the skill wrappers — `src/skills/refine/src/consensus-refine.ts:450`

### `consensus-refine-panel-phone`

- refine: verdict rounds and the impasse/convergence order — `src/plugins/consensus/core/consensus-loop.ts:508`, `:522-530`
- refine: impasse is resumable with `--user-direction` — `src/skills/refine/src/consensus-refine.ts:442-449` (escalation emission), `src/plugins/consensus/core/consensus-loop.ts:1041`, `:1058` (`decide_via: 'user'`)
- panel: at least two panelists required — `src/skills/panel/src/consensus-panel.ts:235-236`; `--panel-size` minimum 2 — `:256`
- panel: pass requires ≥2 successful responses — `src/skills/panel/src/consensus-panel.ts:1004-1006`
- panel: single-round and independent, host adds no synthesis/vote/recommendation — `src/skills/panel/SKILL.md:68`, `:198`, `:258` (**instruction-level**: node `N3` is labelled "(instruction, not code)", and `consensus-panel.ts` contains no synthesis code path, so this is verified by absence rather than by an assertion)
- phone-a-friend: one provider turn, `--max-depth 1` — `src/skills/phone-a-friend/SKILL.md:61`, `:70`, `:94`
- phone-a-friend: advisory payload fields — `src/skills/phone-a-friend/schemas/advisory.schema.json:6-13` (required list), `:15-40`
- phone-a-friend: host disposition vocabulary — `src/skills/phone-a-friend/SKILL.md:63`, `:118-120` (**instruction-level**; node `F3` is labelled "(instruction, not code)")

### `session-choose-output`

- Four Session members and their standalone names — `src/distributions.ts:107-134` (handoff), `:155-176` (retro); export-transcript and fork-to-destination entries in the same file
- handoff optional integrations are *declared*, not installed — `optionalSkills` `src/distributions.ts:110-121` (`session-observer`, `session-export-transcript`)
- retro optional integration — `optionalSkills` `src/distributions.ts:157-163` (`session-observer`)
- fork-to-destination optional integration — `optionalSkills` `src/distributions.ts:232-238` (`session-observer`)
- export-transcript: branch-named, `~/Downloads` by default — `src/skills/session-export-transcript/src/session-export-transcript.ts:6`, `:497-498`, branch resolution `:430-442`
- fork-to-destination: prepares instructions, does not run a provider or create a fork — `src/skills/session-fork-to-destination/SKILL.md:18`; the prepare path only emits instruction objects, `src/skills/session-fork-to-destination/src/guidance.ts:110-145`
- handoff produces continuation context — `src/skills/session-handoff/SKILL.md:3`, `:69-81`
- retro reports findings without applying them — `src/skills/session-retro/SKILL.md:3`

### `change-generate-verify-release`

- `pnpm run build` / `build:check` — `package.json:7-8`
- `type-check`, `test`, `validate`, `smoke` — `package.json:13`, `:10`, `:15`, `:18`
- the combined gate — `package.json:14` (`premerge`)
- `metadata.version` must be quoted stable semver and must increase — `scripts/validate-skill-versions.ts:139`, `:145`, `:154`, `:375`
- pre-push runs validate + build:check + type-check + skill-versions + internal-flags, and deliberately no tests — `tools/git-hooks/pre-push:10-14`, `:18`, `:23`
- live-provider E2E is an **independent manual gate**, not a release step — `package.json:12` (`test:live-e2e`), `.github/workflows/live-e2e.yml:37-38` (`workflow_dispatch` only); the Release workflow runs build + the static suite + the plugin version check and never invokes it — `.github/workflows/release.yml:27-44`
- manifest and catalog versions are written **before** tagging — `scripts/bump-version.ts:160-182`; the tag only verifies them via `checkTagVersion` — `scripts/bump-version.ts:186-210`, invoked at `.github/workflows/release.yml:40-44`
- release surfaces are independent of the skill build — `src/distributions.ts:12-38`, `scripts/bump-version.ts:102`

### `verdict-precedence`

- the mandated order and its comments — `src/plugins/consensus/core/consensus-loop.ts:490-492`, `:549-551`
- impasse short-circuit — `:508-517`
- convergence: synthesis stability for `parallel_synthesized`, parallel convergence otherwise — `:521-530`
- escalation consulted only after both decline — `:553-562`
- trigger set — `src/plugins/consensus/core/loop-escalation.ts:313-318`
- `persistent_disagreement` is synthesized-only, window of 3 — `loop-escalation.ts:320`, `:348-362`, `:477-480`
- detection order inside `detectEscalation` (persistent → oscillation → near-done → budget) — `loop-escalation.ts:466-490`
- `near_done_drift` fires on declared agreement with differing hashes — `loop-escalation.ts:410-429`
- `budget_exhausted` supplied when the round budget is spent — `loop-escalation.ts:431-441`, `:488`
- routing table trigger × agency → `auto` / `host` / `user` — `consensus-loop.ts:935-956`
- promotion to user on repeat-fire or `defer_to_user` — `consensus-loop.ts:997`, `:1038-1046`
- resume flags — `src/skills/refine/src/consensus-refine.ts:442-449`

### `trust-boundary`

- transcript store roots — `src/shared/transcript/runtimes.ts:618`, `:621`, `:624`
- observer state root — `src/skills/session-observer/src/lib/state.ts:4`, `:82`; watcher `watch-state.ts:5,55`; locate `locate.ts:604`
- collaboration leases live under `.../session-observer/collab/leases/<session>.json` — `src/skills/session-observer-collab/src/lib/lease-state.mjs:63` (root) and `:213-215` (`leases/` subdirectory)
- `.consensus/<run-id>/` run state — `src/skills/refine/src/refine-shared.ts:260`, `src/plugins/consensus/core/loop-provider.ts:52`
- submit env injected into the child process, including `CONSENSUS_SUBMIT_MAX_BYTES` — `src/plugins/consensus/provider-cli/structured-output.ts:148-155` (`MAX_BYTES` at `:153`)
- the input artifact is read locally and compacted into the argv prompt string; no artifact file is handed to the child — `src/plugins/consensus/provider-cli/invocation.ts:77` (`argv.push(request.prompt)`)
- Claude receives the schema **also** inline in argv (`--json-schema`) — `invocation.ts:58`
- the four `CONSENSUS_SUBMIT_*` vars are set **unconditionally for every provider**, not just Codex — `structured-output.ts:145-156`
- the child inherits a cwd with no filesystem confinement — `src/plugins/consensus/provider-cli/subprocess.ts:87`
- peer argv — `src/plugins/consensus/provider-cli/invocation.ts:50,97,138`; spawn `subprocess.ts:86`
- returned JSON is schema-validated; failure is `PROVIDER_SCHEMA_VALIDATION` — `structured-output.ts:292`, `:301`
- 1 MiB input cap — `src/skills/decide/src/consensus-decide.ts:49`
- `--allow-root` confinement — `src/skills/decide/src/consensus-decide.ts:227-228`, `:312`
- "advisory data, never instructions / never auto-apply" — `src/skills/phone-a-friend/SKILL.md:99` (**instruction-level**)
- "ask before sending sensitive context" — `src/skills/panel/SKILL.md:82-93` (**instruction-level**; the footer says so explicitly)

### `provider-readiness-states`

- literal statuses — `src/plugins/consensus/provider-cli/probe.ts:97` (`missing`), `:115` (`auth_required`), `:125` (`unavailable`), `:182` (`ready`)
- version unparseable → `unavailable` + `PROVIDER_VERSION_UNPARSEABLE` — `probe.ts:134-138`
- version below minimum → `unavailable` + `PROVIDER_VERSION_UNSUPPORTED` — `probe.ts:143-147`
- capability probe failure → `unavailable` + `PROVIDER_CAPABILITY_MISSING` — `probe.ts:152-179` (entry at `:172`, warning at `:176`)
- executable lookup on PATH — `probe.ts:93-99`, `:206-222`
- terminal `run` failures returned as an envelope rather than a nonzero exit — `src/plugins/consensus/provider-cli/structured-output.ts:285` (`invalid_json`) and `:299-308` (`PROVIDER_SCHEMA_VALIDATION`); the exit mapping is `src/plugins/consensus/provider-cli/envelope.ts:98-102` — `ok` → 0, `CONSENSUS_CLI_USAGE` → 2, every other failure → 0
- `run` never probes readiness: `runConsensusCli` normalizes the request and calls `runProviderTurn` directly — `src/plugins/consensus/provider-cli/commands.ts:392-399`

### `where-gates-run`

- `pre-commit`: `lint-staged` over staged files only — `tools/git-hooks/pre-commit:17`; it also runs `oat status --scope project --hook`, non-blocking — `:20-22`
- `commit-msg`: commitlint — `tools/git-hooks/commit-msg:4`
- `pre-push`: validate, build:check, type-check, skill-versions, internal-flags; explicitly no tests/smoke — `tools/git-hooks/pre-push:10-11` (comment), `:12-14`, `:18`, `:23`
- `validate` job runs on both `pull_request` and `push` to main — `.github/workflows/validate.yml:3-8`, steps `:35-41`
- PR-only jobs — job keys at `.github/workflows/validate.yml:43`, `:73`, `:94`, `:126`; their `if: github.event_name == 'pull_request'` guards at `:47`, `:80`, `:96`, `:130`
- **no job declares `needs:`** anywhere in `.github/workflows/validate.yml`, so the **four** PR-only jobs run in parallel with `validate`, not downstream of it
- Deploy Docs is an independent workflow, not gated on `validate`, and is **also dispatchable** — `.github/workflows/deploy-docs.yml:12` (`workflow_dispatch`), plus pushes to `main` under `documentation/**` and the workflow file itself at `:13`, `:16-18`. Live Provider E2E is the dispatch-**only** workflow — `.github/workflows/live-e2e.yml:37-38`
- lint/format only changed files — `.github/workflows/validate.yml:153`, `:168`
- docs-ci is PR-only and path-scoped — `.github/workflows/docs-ci.yml:8-12`
- deploy-docs on push to main + path filter, plus manual dispatch — `.github/workflows/deploy-docs.yml:11-18`
- release on `consensus-v*` / `session-v*` tags — `.github/workflows/release.yml:3-7`; builds then asserts generated outputs are committed `:27-32`; full static suite `:33-39`; plugin version check `:40`
- live E2E is manual dispatch only — `.github/workflows/live-e2e.yml:37-38` (header rationale at `:3-8`)

### `collab-lease-lifecycle`

- the five literal states — `src/skills/session-observer-collab/src/lib/lease-state.mjs:19-25`
- `arm` creates `armed` — `src/skills/session-observer-collab/src/collab-control.mjs:236`
- `armed` → `waiting` requires a generation-bound waiter identity — `lease-state.mjs:818-830` (state set at `:825`)
- expiry demotes `armed`/`waiting` → `idle` (`lease-expired`) — `lease-state.mjs:506-515` (diagnostic at `:511`)
- cap exhaustion demotes → `idle` (`cap-reached`) — `lease-state.mjs:518-528` (diagnostic at `:523`)
- wait deadline demotes → `idle` (`wait-timeout` / `wait-timing-rearm-required`) — `lease-state.mjs:530-544` (diagnostics at `:536-537`)
- dead waiter recovery → `idle` (`waiter-terminated`) — `lease-state.mjs:911-921` (diagnostic at `:917`)
- explicit release of a `waiting` lease → `idle` — `lease-state.mjs:844`, `:862-870`
- consume: `terminal === false` → `armed`, otherwise `triggered` — `lease-state.mjs:716`
- consume refuses unless effective state is `armed`/`waiting` — `lease-state.mjs:690-696`
- `disarm` sets `disarmed` — `collab-control.mjs:350`; `removeScript` is an option, so hook preservation is conditional — `collab-control.mjs:333`
- `disarmed` is **not terminal**: `arm` short-circuits only when the effective state is `armed`/`waiting` (`collab-control.mjs:220-229`) and otherwise writes a fresh `state: 'armed'` lease (`:236`), so `disarmed --> armed` and `triggered --> armed` are real transitions
- caps — `lease-state.mjs:26-31` (`MAX_WAIT_MS` at `:27`)

### `fork-qualification-gates`

- the three entry points are recorded on the output; they do **not** branch the gate path — `src/skills/session-fork-to-destination/src/guidance-cli.ts:60`, `:143-147`
- `prepare` always runs `discoverGuidanceCandidates`, whatever the entry point, scoped to `[providerForKey(key)]` — `guidance-cli.ts:352-356` (scope at `:354`)
- `--provider` accepts `claude|codex|cursor|all` and defaults to `all` — `guidance-cli.ts:124-130`; the default provider set is `['claude','codex','cursor']` — `guidance-discovery.ts:190`
- gate order inside `prepareForkGuidance`: recorded-cwd equality → `invalid-source-candidate` (`guidance.ts:119-120`) **before** the ambiguous-surface refusal (`:123`) and before any capability lookup
- "select a candidate explicitly" is **instruction-level**, labelled as such in the diagram
- the `cwdEvidenceQuality` gate is **Cursor-scoped**: `provider === 'cursor' && transcript.cwdEvidenceQuality !== 'independent-exact'` → `discovery-incomplete` with reason `cwd-evidence-incomplete` — `src/skills/session-fork-to-destination/src/guidance-discovery.ts:235-243`; Claude and Codex candidates never enter it
- `destination-fresh` does change the output: an `exit-current-session` instruction is prepended when `destinationSwitch.status !== 'documented'` — `src/skills/session-fork-to-destination/src/guidance.ts:190-201`
- Cursor surface is `ambiguous` with `store-origin-ambiguous` origin evidence — `guidance-discovery.ts:173-175`
- an ambiguous surface yields an `unsupported` instruction, never a command — `src/skills/session-fork-to-destination/src/guidance.ts:123-142`
- recorded cwd must equal the canonical source, else `invalid-source-candidate` — `guidance.ts:119-121` (error type at `:62`)
- documented fork semantics per surface: Claude `--resume <id> --fork-session` — `src/skills/session-fork-to-destination/src/guidance-capabilities.ts:86-89`; Codex `codex fork <id>` — `:135-138`; Cursor fork `status: 'unsupported'` — `:193-196`, with "CLI resume is not fork semantics and must never be substituted for a fork" at `:218`
- destination-path command guard (`pwd -P` comparison, else refuse) — `guidance.ts:107`

### `build-transaction`

- staging root per unit — `scripts/build-generated.ts:588`, `:604-607`; `scripts/lib/packaging.ts:804`
- repo-relative + collision checks before any mutation — `scripts/lib/packaging.ts:973-1001`
- staged replacements validated, then `validateBeforeMutation` (the complete-unit check) — `packaging.ts:1042-1045`; wired to `validateBuiltDistributions` at `scripts/build-generated.ts:610-638`
- prior output renamed aside to `.<name>.recovery-<uuid>` (ENOENT tolerated) — `packaging.ts:1023`, `:1071-1076`
- staged unit renamed into place — `packaging.ts:1086`
- rollback in reverse order: remove installed, restore backups — `packaging.ts:1095`, `:1113-1132`
- outcome "replacement failed; all prior outputs restored" — `packaging.ts:1140-1141`
- outcome "replacement failed and rollback was incomplete" — `packaging.ts:1135-1137`
- outcome "installed but backup cleanup failed" — `packaging.ts:1159-1161`; cleanup only touches entries that actually had a backup (`if (!entry.movedPrior) continue`) — `packaging.ts:1147`
- orphan removal after a successful replacement — `scripts/build-generated.ts:640-642`; the staging roots are removed in a `finally`, so cleanup also happens on failure — `:651-653`
- a validation failure aborts before any mutation: `validateBeforeMutation` runs at `packaging.ts:1045`, before the first `rename` at `:1072`

---

## Doc/code mismatches found

1. **Provider readiness statuses.** `documentation/docs/user-guide/consensus/configuration.md:106-116`
   lists seven `PROVIDER_*` diagnostics and the survey described states
   `missing / auth_required / version unsupported / capability missing / usable`.
   The code has only **four** inventory statuses — `missing`, `auth_required`,
   `unavailable`, `ready` (`src/plugins/consensus/provider-cli/probe.ts:97,115,125,182`).
   Version and capability problems are *diagnostics attached to `unavailable`*,
   not states, and the ready state is spelled `ready`, not `usable`. The diagram
   draws the code.
2. **`PROVIDER_UNSUPPORTED_OPTION`** appears in the docs diagnostic list
   (`configuration.md:113`) but is not produced by `probe.ts` (it is emitted by the adapter and runtime-policy code, per Astra). It was left out of
   the diagram; it may live elsewhere or be stale.
3. **Pre-push scope.** The survey said `build:check`/test/validate/smoke "also
   run on push". The push-side *hook* runs validate, build:check, type-check and
   the two gates and explicitly skips the test suite and smoke
   (`tools/git-hooks/pre-push:10-14,18,23`); it is the CI `validate` job that runs
   tests on push to `main` (`.github/workflows/validate.yml:3-8,35-41`). The
   diagram separates the two.
4. **`cursor-agent` argv.** README and docs quote
   `cursor-agent --output-format json`; the code also passes `--force`
   (`src/plugins/consensus/provider-cli/invocation.ts:138`). Likewise `codex exec --json`
   is really `codex exec --json --output-last-message <file>` (`invocation.ts:97`).
   The diagrams use the code's argv.

No mismatch was found for the build failure table: the three documented outcomes
in `generated-runtime.md` map exactly onto `packaging.ts:1135-1161`.

---

## Batch 2 notes — dropped for lack of evidence

- **"This repo adds no telemetry"** (`trust-boundary`): docs-prose only, with no
  code artifact to point at. Removed rather than marked.
- **"auth_required is an operator fix, not a retryable failure"**: kept, because
  the code never retries an `auth_required` entry, but it is phrased as guidance
  and is sourced from `configuration.md` wording; the state name and warning
  string are code-verified (`probe.ts:115-118`).
- **`PROVIDER_UNSUPPORTED_OPTION`**: dropped from `provider-readiness-states`
  (see mismatch 2).
- **Escalation "budget_exhausted" as a detected trigger**: drawn as *supplied by
  the loop when the budget is spent* rather than as a detector, matching
  `loop-escalation.ts:461-483` (it is gated on the `budgetExhausted` argument),
  not the survey's flat trigger list.
- **A `--provider all` "fails closed" node** in `fork-qualification-gates` was
  rewritten: the code has no `all`-specific refusal, it simply includes `cursor`
  in the provider set and the Cursor evidence gate then throws
  (`guidance-cli.ts:349`, `guidance-discovery.ts:235-242`).
- **Survey items 1, 3, 5, 7, 9, 11, 14, 15** were not drawn (out of the
  requested batch-2 list).

---

## Tab-group snippets

Paste for `one-skill-many-forms` (on `engineering/architecture/index.md`):

````markdown
=== "Diagram"

    ![One skill, every installation form](/diagrams/one-skill-many-forms.svg)

    *SVG regenerated 2026-09-16*

=== "Source"

    ```mermaid
    <contents of one-skill-many-forms.mmd>
    ```

    *Mermaid updated 2026-09-16*
````

Paste for `consensus-host-peers-artifact` (on the consensus overview):

````markdown
=== "Diagram"

    ![Consensus: host, peers, artifact](/diagrams/consensus-host-peers-artifact.svg)

    *SVG regenerated 2026-09-16*

=== "Source"

    ```mermaid
    <contents of consensus-host-peers-artifact.mmd>
    ```

    *Mermaid updated 2026-09-16*
````

Paste for `trust-boundary`:

````markdown
=== "Diagram"

    ![Trust boundary: what leaves the machine](/diagrams/trust-boundary.svg)

    *SVG regenerated 2026-09-16*

=== "Source"

    ```mermaid
    <contents of trust-boundary.mmd>
    ```

    *Mermaid updated 2026-09-16*
````

> **Unverified:** the image path `/diagrams/<slug>.svg` is written as a
> site-absolute path. The site deploys under a `/skills` base path, and whether
> Next.js/Fumadocs rewrites `<img src>` for that base path has not been checked
> here. Run a base-path build and inspect the emitted `src` before committing;
> if it is not prefixed, use a page-relative path or an MDX image component.

---

## Verifier fix pass — 2026-09-16

Three independent verifiers checked all twelve diagrams against source. Every
defect they raised was fixed; nothing was disputed. Summary of what changed:

| Diagram | Change |
| --- | --- |
| `one-skill-many-forms` | mmd + svg: `SRC` now reads "SKILL.md + assets" (the owner directory has no runtime). |
| `consensus-refine-panel-phone` | `N3` and `F3` labelled "(instruction, not code)". |
| `verdict-precedence` | No change. |
| `session-choose-output` | Added the missing `OBS -.-> F` optional edge (`src/distributions.ts:232-238`); handoff evidence corrected to `:107-134`. |
| `consensus-host-peers-artifact` | mmd + svg: split the two canonical blocks; moved `## Dissent` onto `decide`'s own `consensus-decision.md`; the declined-convergence edge now shows the escalation check; the host column now says the wrapper emits JSONL and the CLI returns one envelope. |
| `fork-qualification-gates` | Redrawn: removed the `source-current` bypass, re-based the Cursor gate on `cwdEvidenceQuality`, put recorded-cwd equality before the ambiguous-surface refusal, and marked explicit selection instruction-level. |
| `provider-readiness-states` | `run` is now a separate disconnected component with a "never probes readiness" description; added the `CONSENSUS_CLI_USAGE` → exit 2 exception; dropped the redundant `x: x` descriptions. |
| `collab-lease-lifecycle` | Added `disarmed --> armed` and `triggered --> armed`; `disarmed` is no longer terminal; hook preservation is no longer asserted; redundant descriptions dropped. |
| `trust-boundary` | mmd + svg: argv is consistent across both; the input artifact no longer crosses as a file; Claude's inline `--json-schema` separated from Codex's schema-path + env route; added `CONSENSUS_SUBMIT_MAX_BYTES` and the unconfined child cwd; lease path corrected to `.../collab/leases/`. |
| `change-generate-verify-release` | Live E2E redrawn as an independent manual gate; the E2E → release edges removed. |
| `build-transaction` | Validation failure is now its own terminal outcome; cleanup is scoped to entries with a backup; the staging-root `finally` is noted; `&lt;name&gt;` / `&lt;uuid&gt;` escaped. |
| `where-gates-run` | Redrawn as six independent trigger columns with an explicit "no job declares `needs`" note; added the `oat status` pre-commit step and Deploy Docs as an independent workflow. |

### SVG rendering

All three SVGs were rebuilt at an **830-unit viewBox** so units render 1:1 in the
site's ~830px content column (the previous 1240-unit viewBox shrank 12-unit text
to about 8px). Layouts were re-flowed from side-by-side columns to vertical
bands to buy the horizontal room.

| SVG | viewBox | Title | Card title | Body | Mono | Band header |
| --- | --- | --- | --- | --- | --- | --- |
| `one-skill-many-forms.svg` | `0 0 830 740` | 20 | 17 | 15 | 14 (13 for the long plugin path) | 13 |
| `consensus-host-peers-artifact.svg` | `0 0 830 1240` | 20 | 17 | 15 | 14 | 13 |
| `trust-boundary.svg` | `0 0 830 1000` | 20 | 17 | 15 | 14 (13 in the two schema cards) | 13 |

Each was rendered at `-w 830` on white and on `#0d1117` and inspected; no label
overflows its card and no text is drawn on the page background in black or
white. Because the viewBox now matches the display width, the 1240-wide render
is an upscale and is no longer produced.

---

## Round-2 verifier pass — 2026-09-16

| Diagram | Change |
| --- | --- |
| `one-skill-many-forms` (mmd+svg) | Release-owned arrow now lands mid-bus, not on Cursor. Per the repo rule against claiming complete provider support before the release checklist: row header → "DECLARED TARGETS", bus label → "declared targets — no install step", subtitle → "declared for each provider", mmd subgraph → "Install targets · declared". |
| `consensus-host-peers-artifact` (mmd+svg) | The "no impasse" pill moved to the edge *leaving* the impasse card; the VERDICT ROUNDS band extended to contain "Converged?"; `ESCOUT` no longer claims `auto` routing (an auto-routed trigger terminates as `status: 'converged'` and emits no event). |
| `trust-boundary` (mmd+svg) | Subtitle no longer says "only a prompt string". The submit env is now correctly shown as set for **every** provider, and Claude's inline `--json-schema` as *also*, not *instead*. `CWD` given an inbound edge in the mmd. |
| `change-generate-verify-release` | Order inverted to match the code: `bump-version.ts` writes manifests and catalogs → tag → the Release workflow reruns the static suite and `checkTagVersion` verifies the tag against the already-written manifests. |
| `where-gates-run` | Job count corrected to four; Deploy Docs shown as dispatchable in addition to its push trigger, with Live Provider E2E labelled dispatch-**only**. |
| `fork-qualification-gates` | The `cwdEvidenceQuality` gate is now explicitly Cursor-scoped, with Claude and Codex bypassing it; the entry-point label notes that `destination-fresh` prepends an `exit-current-session` step. |

---

## Display-size reshape — 2026-09-16

Three Mermaid diagrams were reshaped for the ~830px content column. **No
semantics changed**; every evidence row above still applies unaltered.

### `provider-readiness-states.mmd` is now TWO diagrams

Mermaid lays disconnected components side by side, which pushed the chart to
~1832 units. The file now contains two `stateDiagram-v2` blocks separated by a
line reading `%% ---- second diagram ----`. **Place them in two separate
`mermaid` fences**; do not paste the marker line into either fence.

- Fence 1 — the probe state machine: 6 states (`probing`, `missing`,
  `auth_required`, `unavailable`, `ready`, plus start/end), 4 parallel branches,
  3 levels. Roughly 950 × 420 units.
- Fence 2 — `consensus run`: 5 states, 2 levels. Roughly 560 × 300 units.

Transition labels were shortened (for example "version at or above minimum and
every requested capability probe passes" → "version and capabilities pass"); all
seven `PROVIDER_*` diagnostic codes and the exit-code rules are unchanged.

### `fork-qualification-gates.mmd`

16 nodes, 11 levels, every label ≤ 6 words and single-line. Roughly 780 × 900
units. Gate order, the Cursor-only scoping, and every terminal are unchanged.

**Adjacent prose** (place beside the diagram):

- `prepare` always runs discovery, whatever the entry point — `guidance-cli.ts:352-356`, scope at `:354`.
- The entry point is recorded on the output rather than branching the gates, but `destination-fresh` prepends an `exit-current-session` instruction when `destinationSwitch.status !== 'documented'` — `guidance.ts:190-201`.
- The `cwdEvidenceQuality` gate is Cursor-only: `provider === 'cursor' && transcript.cwdEvidenceQuality !== 'independent-exact'` — `guidance-discovery.ts:235-243`. Claude and Codex candidates never enter it. Cursor stores never qualify today, so Cursor always stops at `discovery-incomplete` with reason `cwd-evidence-incomplete`.
- Choosing a candidate explicitly is instruction-level, not a code gate.
- `recordedCwd` must equal the canonical source path or `prepareForkGuidance` throws `invalid-source-candidate` — `guidance.ts:119-120`. This runs **before** the ambiguous-surface refusal at `:123` and before any capability lookup.
- An ambiguous surface (Cursor, `store-origin-ambiguous` — `guidance-discovery.ts:174`) returns an `unsupported` instruction and never a fork or resume command — `guidance.ts:123-142`.
- Documented fork semantics: Claude `--resume <id> --fork-session` — `guidance-capabilities.ts:86-89`; Codex `codex fork <id>` — `:135-138`; Cursor fork `status: 'unsupported'` — `:193-196`, because "CLI resume is not fork semantics and must never be substituted for a fork" — `:218`.
- The emitted command compares `pwd -P` against the canonical destination and otherwise refuses — `guidance.ts:107`.

### `consensus-refine-panel-phone.mmd`

Three `direction TB` subgraphs, 5–6 nodes each, 16 nodes and 6 levels total.
Roughly 900 × 540 units, down from ~5011 wide. The `(instruction, not code)`
markers on `N3` and `F3` are retained.

**Adjacent prose** (place beside the diagram):

- **refine** deliberates over verdict rounds to convergence or to a reported impasse; an impasse is handed back to you with `--user-direction` — `consensus-loop.ts:508`, `:522-530`; `consensus-refine.ts:442-449`.
- **panel** requires at least two panelists (`consensus-panel.ts:235-236`, `:256`) and passes only with two or more successful responses (`:1004-1006`). It is single-round and independent: panelists never see each other. The host adds no synthesis, vote, or recommendation — `src/skills/panel/SKILL.md:68`, `:198`, `:258` (instruction-level; `consensus-panel.ts` has no synthesis code path).
- **phone-a-friend** is one provider turn under `--max-depth 1` returning `take`, `recommendation`, `risks`, `follow_up_questions`, and `confidence` — `advisory.schema.json:6-13`, `:15-40`; `src/skills/phone-a-friend/SKILL.md:61`, `:70`, `:94`. The host must state a disposition of agree, disagree, apply, ignore, or follow-up — `SKILL.md:63`, `:118-120` (instruction-level).

### Semicolon parse fix

A semicolon inside a `stateDiagram-v2` description terminates the statement and
renders the trailing clause as a stray state. Every sentence-separating
semicolon was replaced with an em dash or a comma in
`provider-readiness-states.mmd`, `collab-lease-lifecycle.mmd` (×2),
`build-transaction.mmd` (×2), and — defensively, though flowchart labels are
quoted and safe — `trust-boundary.mmd` (×2) and `where-gates-run.mmd` (×2).
Semicolons that are part of HTML entities (`&lt;`, `&gt;`) were left alone.
`session-choose-output.mmd:5` still contains one semicolon inside a quoted
flowchart label; it is harmless there and that file was left untouched as
requested.

### `where-gates-run.mmd`

Rebuilt from one wide row (~5500 units) into two rows of three trigger
subgraphs, forced with invisible `~~~` links: top row commit / push /
pull_request, bottom row push-to-main / workflow_dispatch / tag. 23 nodes,
labels ≤ 6 words, no `<br/>`. Roughly 950 × 700 units. Semantics unchanged.

**Adjacent prose** (place beside the diagram):

- These are independent triggers, not a pipeline. **No job declares `needs:`** anywhere in `.github/workflows/validate.yml`, so the four PR-only jobs run in parallel with `validate`, not downstream of it — job keys at `:43`, `:73`, `:94`, `:126`, guards at `:47`, `:80`, `:96`, `:130`.
- The `validate` job itself runs on both `pull_request` and pushes to `main` — `.github/workflows/validate.yml:3-8`, steps `:35-41`.
- The pre-push hook runs validate, build:check, type-check and the two gates, and deliberately skips the test suite and smoke to stay fast — `tools/git-hooks/pre-push:10-14`, `:18`, `:23`.
- `oat status --scope project --hook` in pre-commit is non-blocking (`|| true`) — `tools/git-hooks/pre-commit:20-22`.
- Docs CI is PR-only and path-scoped — `.github/workflows/docs-ci.yml:8-12`.
- Deploy Docs is an independent workflow, **also** dispatchable on top of its push-to-`main` trigger — `.github/workflows/deploy-docs.yml:12`, `:13`, `:16-18`. Live Provider E2E is the dispatch-**only** workflow, and nothing invokes it — `.github/workflows/live-e2e.yml:37-38`.
- The Release workflow fires on `consensus-v*` / `session-v*` tags — `.github/workflows/release.yml:3-7`; it builds then asserts generated outputs are committed `:27-32`, reruns the static suite `:33-39`, and verifies the tag against the already-written manifests `:40-44`.


## Post-placement sync — 2026-09-16

Sources for `consensus-refine-panel-phone.mmd` and `trust-boundary.mmd` were re-synced from the shipped pages after Astra's final patch (commit 4997abe):

- `consensus-refine-panel-phone`: refine's impasse branch now routes `R4 --> RU["User direction required"]`; "Decided by: the peers" remains only on the convergence branch (`consensus-refine.ts:442-449`).
- `trust-boundary`: local band relabelled "Stored locally — selected contents can enter the prompt"; CWD node "Working directory and provider policy — wrapper path guards do not sandbox the child"; SVG title/desc/labels aligned. This qualifies, not contradicts, the verified rows above.
- Reader-facing "adjacent prose" on three pages was rewritten by Astra without file:line cites; the evidence remains in this README.
