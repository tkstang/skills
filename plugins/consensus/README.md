# consensus plugin

Status: v0.1 pre-release.

`plugins/consensus/` is a self-contained plugin package for consensus workflows. It ships `create`, which drafts a new artifact from a brief with independent peer drafts and synthesis; `decide`, which chooses between documented options with minimal agency and explicit dissent surfacing; `plan`, which turns a goal and inline constraints into a structured plan with steps, dependencies, and risks; `refine`, which refines markdown drafts by asking two provider CLI-backed AI peers to deliberate toward a converged artifact with an audit trail; `evaluate`, which judges an artifact against a rubric with unified findings, per-peer reasoning, and dissent preserved in the deliberation log; `panel`, which asks multiple provider-backed panelists the same question and writes side-by-side attributed responses while the host stays a neutral moderator; and `phone-a-friend`, which asks one other provider-backed peer for a structured advisory take without a deliberation loop.

Consensus peers run through the generated provider CLI. The CLI owns provider inventory, preflight, bounded subprocess execution, conservative retry classification, schema delivery, and the internal `consensus submit` sidecar-verdict path used to capture peer verdicts before final-message parsing fallback.

The scope is intentionally narrow: the `create`, `decide`, `plan`, `refine`, `evaluate`, `panel`, and `phone-a-friend` skills, three iteration modes selected with `--iteration` (`parallel_synthesized` default for create, decide, and plan, `alternating` default for refine, `parallel_revision` default for evaluate), a configurable synthesizer (`--synthesizer`), an agency-gated escalation ladder with host/user decision re-entry (`--host-direction`), sequential sections by default for refine, opt-in host-mediated parallel section orchestration for refine, the `--agency` flag, single-round neutral panel questions through `consensus-panel`, and one-shot advisory peer consultation through `consensus run`. Future work may add `consensus-research`, a whole-document harmonization pass, multi-round panel discussion, and deliberation metrics/cost caps.

## Local Git Repository Install

Install from the repository root as a local marketplace while the plugin is in v0.1 pre-release.

Claude Code:

```bash
claude plugin marketplace add "$PWD" --scope user
claude plugin install consensus@skills --scope user
claude plugin details consensus
```

Codex:

```bash
codex plugin marketplace add "$PWD"
codex plugin add consensus --marketplace skills
codex plugin list | rg 'consensus@skills'
```

Cursor Agent:

```bash
cursor agent --plugin-dir "$PWD/plugins/consensus"
```

The Cursor CLI does not currently expose `cursor plugin marketplace` or `cursor plugin install`; local plugin loading is session-scoped through Cursor Agent's `--plugin-dir` option.

Published Git and provider marketplace install flows are not release claims yet. Re-check provider CLIs and marketplace flows before tagging v0.1.

If `skills` is already configured as a marketplace from another local checkout, provider CLIs may reject adding this checkout under the same marketplace name. Remove or update the existing local marketplace before using the commands above as release-candidate install evidence.

## Prerequisites

- Node.js 22 or newer.
- The generated consensus CLI from this plugin, used for provider inventory, preflight, peer invocation, and peer verdict submission.
- Local provider CLIs for the requested peers. The first supported provider floor is `claude`, `codex`, and `cursor`.

The wrappers always invoke peers through the generated provider CLI. There is no alternate backend selector in v0.1.

Check provider inventory and readiness from the repository root:

```bash
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json
```

In an installed plugin environment, the same provider CLI may be exposed as `consensus`, for example `consensus provider ls --json` and `consensus preflight --json`. The `consensus submit --json -` command is an internal provider-turn command; wrappers inject its exact path through `CONSENSUS_SUBMIT_COMMAND`.

## Usage

### Create

Create a new artifact from a brief:

```bash
node plugins/consensus/skills/create/scripts/consensus-create.mjs \
  --brief-file brief.md \
  --output created.md
```

Use `--brief <text>` for short inline briefs and `--template <path>` when the user has a preferred structure or style sample. The create wrapper defaults to `independent_draft`, `parallel_synthesized`, and `maximum` agency. The artifact contains generated content under `## Created Artifact`, a `consensus-resolution` block, and a `## Deliberation Log` with peer verdicts and synthesis records.

For an operator walkthrough of brief inputs, expected JSONL, sidecar output, and resolution metadata, see `skills/create/references/operator-qa.md`.

### Decide

Choose between documented options:

```bash
node plugins/consensus/skills/decide/scripts/consensus-decide.mjs \
  --options options.md \
  --output decision.md
```

The decide wrapper defaults to `independent_draft`, `parallel_synthesized`, and `minimal` agency. The artifact contains `## Recommendation`, `## Reasoning`, `## Alternatives`, `## Dissent / Unresolved Disagreement`, a `consensus-resolution` block, and a `## Deliberation Log` with peer verdicts and synthesis records. Minimal agency means unresolved disagreement remains visible rather than being silently decided.

For an operator walkthrough of options input, expected JSONL, sidecar output, and dissent review, see `skills/decide/references/operator-qa.md`.

### Plan

Turn a goal and inline constraints into a structured plan:

```bash
node plugins/consensus/skills/plan/scripts/consensus-plan.mjs \
  --goal "Plan a staged rollout for the migration" \
  --constraints "Keep downtime under five minutes and preserve rollback." \
  --output plan.md
```

The plan wrapper defaults to `independent_draft`, `parallel_synthesized`, and `moderate` agency. The artifact contains `## Steps`, `## Dependencies`, `## Risks`, a `consensus-resolution` block, and a `## Deliberation Log` with peer verdicts and synthesis records. Constraints are inline-only for this version; do not pass a path input for constraints.

For an operator walkthrough of goal input, expected JSONL, sidecar output, and resolution metadata, see `skills/plan/references/operator-qa.md`.

### Refine

For the default sequential flow, run the wrapper against a markdown file:

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md --goal "Make this clearer."
```

The wrapper parses the document into sections, runs the configured peers through alternating verdict rounds, and writes a deliberation artifact beside the input as `<input>.consensus.md` unless `--output <path>` is provided. The artifact contains the final output, resolution metadata, section states, and a per-section deliberation log.

Resume from a prior artifact with `--resume <artifact-path>`. Use `--user-direction "<direction>"` when continuing after an impasse or max-rounds stop, and use the corrupt-section controls only when the wrapper reports blocked resume state:

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md \
  --resume draft.consensus.md \
  --user-direction "Prefer the shorter introduction."
```

### Iteration modes

Select how the two peers deliberate with `--iteration`. The default is `alternating`.

```bash
# Both peers revise in parallel each round; converge on emergent agreement (2x peer calls).
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md \
  --goal "Tighten the draft." --iteration parallel_revision

# Parallel revision plus a per-round synthesis merge (2x peer calls + 1 synthesis call).
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md \
  --goal "Tighten the draft." --iteration parallel_synthesized --synthesizer claude
```

Parallel modes disclose their per-round call multiplier in the `run_started` JSONL event (`calls_per_round`) and report actual `peer_calls`/`synthesis_calls` totals at completion. The synthesizer defaults to the first peer and must be present in the peer inventory (`SYNTHESIZER_UNAVAILABLE` otherwise); it is warned-and-ignored outside `parallel_synthesized`.

When a parallel-mode section gets stuck (persistent disagreement, oscillation, budget exhaustion, or near-done drift), the wrapper emits an `escalation_required` JSONL event routed by `--agency` to the user or the host. A host decision re-enters with `--resume <artifact> --host-direction "<text>"` (optionally `--host-decision-kind <kind>`) and records as an attributed orchestrator round; a user decision re-enters with `--user-direction` as before.

For a hands-on QA walkthrough of all three modes and the escalation ladder against live peers — exact commands, example inputs, and expected output — see `skills/refine/references/operator-qa.md`.

For the shorter repeatable live provider E2E release gate covering both `refine`
and `evaluate`, see `references/live-e2e.md`.

Parallel section orchestration is host mediated. Prepare packets first, dispatch section runners with the host runtime, then fan in the completed section outputs:

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md --prepare-parallel --goal "Tighten the draft."
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs --fan-in .consensus/<run-id>/manifest.json
```

### Evaluate

Evaluate an artifact against a rubric:

```bash
node plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs artifact.md --rubric rubric.md
```

The evaluate wrapper defaults to `shared_input` cold start, `parallel_revision` iteration, and `minimal` agency. Without `--output`, it writes `<artifact>.evaluation.md`; with `--output <path>`, it writes the evaluation there. The artifact contains unified findings, embedded `consensus-verdict` records for each peer turn, and either `## Dissent` or `## Unresolved dissent` when peer disagreement remains.

For an operator walkthrough of evaluation inputs, expected JSONL, sidecar output, and dissent review, see `skills/evaluate/references/operator-qa.md`.

For the shared live provider E2E release gate and the small checked-in
evaluation fixture pair, see `references/live-e2e.md` and `references/e2e/`.

#### Guided rubric creation

If you want an evaluation but do not have a rubric yet — or you ask for help authoring one — the `evaluate` skill runs a host-model guided flow: it elicits your evaluation goals, adapts one of the bundled example rubrics, writes a draft to a path you approve, then invokes the wrapper with `--rubric`. The raw `--rubric` contract above is unchanged for users who already have a rubric. Rubric criteria are the `##`–`######` headings and `-`/`*` bullets in the file, and the wrapper uses the first 12 distinct criteria, so keep the load-bearing ones near the top; weights and scoring scales are peer-facing guidance, not machine-parsed structure.

Four ready-to-adapt example rubrics ship under `skills/evaluate/references/examples/`: `general-purpose.md`, `code-review.md`, `technical-writing.md`, and `design-architecture.md`.

### Panel

Ask multiple provider-backed panelists the same question:

```bash
node plugins/consensus/skills/panel/scripts/consensus-panel.mjs \
  --question "What risks should we inspect before launch?" \
  --panelists claude,codex \
  --output panel.md
```

Use `--question-file <path>` for longer prompts, `--panelists` to name explicit
providers, and `--panel-size` to set a target panel size. Without explicit
panelists, the wrapper resolves defaults from `consensus config` using invocation
flags, project config, user config, then built-in fallback.

The panel wrapper emits JSONL status events, writes a markdown `consensus-panel`
artifact, and records each panelist's response with attribution, diagnostics,
shortfalls, and run metadata. The host remains a neutral moderator: it presents
the attributed responses and does not synthesize, vote, or add a host-authored
panel answer.

For the host-facing workflow, see `skills/panel/SKILL.md`. For the panel response
schema and manual QA walkthrough, see
`skills/panel/schemas/panel-response.schema.json` and
`skills/panel/references/operator-qa.md`.

### Phone-a-friend

Ask one other provider-backed peer for a structured advisory take:

```bash
node plugins/consensus/scripts/consensus.mjs run \
  --provider claude \
  --schema plugins/consensus/skills/phone-a-friend/schemas/advisory.schema.json \
  --prompt-file prompt.md \
  --json \
  --max-depth 1
```

The `phone-a-friend` skill is instruction-only: it has no generated wrapper and
does not run a deliberation loop. The host infers or confirms the advisory
question, compacts relevant context into a prompt file, prefers a peer provider
different from the host, reads the schema-validated advisory payload, and
dispositions the take before acting. Peer output is advisory only.

For the full host-facing workflow, see `skills/phone-a-friend/SKILL.md`. For the
schema contract and manual QA walkthrough, see
`skills/phone-a-friend/schemas/advisory.schema.json` and
`skills/phone-a-friend/references/operator-qa.md`.

## Permissions

The consensus `create`, `decide`, `plan`, `refine`, `evaluate`, `panel`, and
`phone-a-friend` skills need permission to run:

- `node` for the wrapper and loop scripts.
- `consensus` for provider inventory/preflight/submit when exposed as a command.
- read/write access to input files, generated `.consensus/` run state, provider-turn submit sidecars, and output artifacts.

`phone-a-friend` uses the generated provider CLI directly through `consensus run`
with the advisory schema, not a generated wrapper. It needs read access to the
prompt file and schema, and any write access the host uses to prepare temporary
prompt files or record the advisory disposition.

`panel` uses the generated panel wrapper, writes `.consensus/` run state and a
markdown panel artifact, and should ask before sending sensitive/private context
to provider-backed panelists.

Refine parallel section mode additionally requires host-native subagent dispatch. Codex authorization must fail closed: if dispatch approval is unavailable or denied, the host should report that parallel mode did not run.

## Advanced Configuration

By default, host detection chooses `claude,codex` on Claude Code and Cursor, and `codex,claude` on Codex. Override peers with:

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md --peers claude,codex
```

Panel defaults use the same config surface:

```bash
consensus config get --json --scope effective --workflow panel
consensus config set --json --scope project --panelists claude,codex,cursor --panel-size 3
node plugins/consensus/skills/panel/scripts/consensus-panel.mjs \
  --question-file question.md \
  --panelists claude,codex \
  --panel-size 2
```

Peer IDs come from provider inventory:

```bash
consensus provider ls --json
consensus preflight --json --provider claude
```

The first supported provider floor is `claude`, `codex`, and `cursor`; future providers are extension points, not v0.1 support claims. Requested peers must be present and usable in provider inventory/preflight before live use. The wrappers surface provider-neutral diagnostics such as `PROVIDER_MISSING`, `PROVIDER_AUTH_REQUIRED`, `PROVIDER_UNAVAILABLE`, and `PROVIDER_UNSUPPORTED_OPTION`.

Provider exits are classified conservatively. Unknown exits are terminal by default; reliable external interrupts can retry; timeout and output-cap failures remain terminal; provider-specific transient signatures are evidence-backed and redacted in diagnostics through `exit_classification`.

Verdict submission is enabled through an injected submit command and environment: `CONSENSUS_SUBMIT_COMMAND`, `CONSENSUS_SUBMIT_SCHEMA`, `CONSENSUS_SUBMIT_FILE`, and `CONSENSUS_SUBMIT_MAX_BYTES`. Peers submit schema-valid verdict JSON with the injected command. Successful submit sidecars are preferred and reported with `verdict_source: "submit"`; when no valid sidecar exists, wrappers fall back to final-message parsing and report `verdict_source: "final_message"`. Submit-enabled Codex turns avoid native `--output-schema`, so strict-output rejection does not block the peer before it can run the submit command.

Cursor is included in the provider floor, but local auth state is still operator-owned. If inventory or preflight reports Cursor as `auth_required`, unlock the OS keychain or authenticate the Cursor CLI in the current user session before retrying. Native Cursor submit-tool support is reserved for a later acceptance path; the provider-neutral submit CLI path is used instead.

## Limitations

- v0.1 ships the `create`, `decide`, `plan`, `refine`, `evaluate`, `panel`, and
  `phone-a-friend` skills.
- Remaining consensus family skills are future work: `consensus-research`.
- `consensus-panel` is single-round and independent. Multi-round panel
  discussion remains future work.
- Ships three iteration modes (`alternating`, `parallel_revision`, `parallel_synthesized`); the independent-draft cold-start strategy is exposed through `create`, `decide`, and `plan`, while `refine` and `evaluate` remain shared-input only.
- Sections converge independently; whole-document harmonization and deliberation metrics/cost caps remain deferred.
- Verdict submission is best-effort by default: successful submit sidecars are preferred, then wrappers fall back to final-message parsing. A strict require-submission mode and Codex read-only submit capture-path relocation remain future work.
- Cursor is supported as a host runtime and as a first-floor peer when its local CLI is authenticated. Treat `auth_required` inventory/preflight results as a local setup issue, not a retryable consensus failure.
- Codex public marketplace submission is not assumed; Git/local install is the v0.1 path.
- skills.sh listing should not be claimed until indexing has been verified after publication.
- Prompt injection inside the input artifact is mitigated by prompt framing and schema validation, but peer CLIs may still produce structurally valid bad advice. Review the audit trail before publishing outputs.
- This plugin adds no telemetry. Configured provider CLIs may have their own behavior; review those tools separately.

## Package Layout

- `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` - provider plugin manifests.
- `skills/create/` - implementation directory for the shipped `create` skill.
- `skills/create/references/operator-qa.md` - manual QA walkthrough of brief-to-artifact creation, with a runnable brief under `references/examples/`.
- `skills/decide/` - implementation directory for the shipped `decide` skill.
- `skills/decide/references/operator-qa.md` - manual QA walkthrough of options-to-decision runs and dissent review, with a runnable options file under `references/examples/`.
- `skills/plan/` - implementation directory for the shipped `plan` skill.
- `skills/plan/references/operator-qa.md` - manual QA walkthrough of goal-to-plan runs, with a runnable goal and constraints example under `references/examples/`.
- `skills/panel/` - implementation directory for the shipped `panel` skill.
- `skills/panel/references/operator-qa.md` - manual QA walkthrough of single-round panel runs, config defaults, JSONL events, and artifact review.
- `skills/panel/references/examples/` - runnable question examples for design risk and privacy-boundary panels.
- `skills/panel/schemas/panel-response.schema.json` - structured panelist response contract.
- `skills/refine/` - implementation directory for the shipped `refine` skill.
- `skills/refine/references/operator-qa.md` - manual QA walkthrough of the iteration modes and escalation ladder, with runnable example inputs under `references/examples/`.
- `skills/evaluate/` - implementation directory for the shipped `evaluate` skill.
- `skills/evaluate/references/operator-qa.md` - manual QA walkthrough of artifact/rubric evaluation and dissent review.
- `skills/evaluate/references/examples/` - four ready-to-adapt example rubrics (general-purpose, code review, technical writing, design/architecture) used by guided rubric creation.
- `skills/phone-a-friend/` - instruction-only advisory peer consultation skill.
- `skills/phone-a-friend/schemas/advisory.schema.json` - structured advisory response contract.
- `skills/phone-a-friend/references/operator-qa.md` - manual QA walkthrough of one-shot advisory calls, expected JSON, and host disposition.
- `skills/phone-a-friend/references/examples/` - example advisory prompt and response payload.
- `references/live-e2e.md` - repeatable live provider E2E release-gate runbook for Refine and Evaluate.
- `references/e2e/` - small checked-in artifacts and rubrics used by the live E2E runbook.
- `agents/consensus-section-runner.md` - task contract for host-mediated parallel section runners.
