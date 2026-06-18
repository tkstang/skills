# consensus plugin

Status: v0.1 pre-release.

`plugins/consensus/` is a self-contained plugin package for consensus workflows. It ships `refine`, which refines markdown drafts by asking two Paseo-backed AI peers to deliberate toward a converged artifact with an audit trail, and `evaluate`, which judges an artifact against a rubric with unified findings, per-peer reasoning, and dissent preserved in the deliberation log.

The scope is intentionally narrow: the `refine` and `evaluate` skills, three iteration modes selected with `--iteration` (`alternating` default for refine, `parallel_revision` default for evaluate, `parallel_synthesized`), a configurable synthesizer (`--synthesizer`), an agency-gated escalation ladder with host/user decision re-entry (`--host-direction`), sequential sections by default for refine, opt-in host-mediated parallel section orchestration for refine, and the `--agency` flag. Future work may add the rest of the consensus skill family, a whole-document harmonization pass, and deliberation metrics/cost caps.

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

## Prerequisites

- Node.js 22 or newer.
- Paseo CLI on `PATH`: `npm install -g @getpaseo/cli`. v0.1 validates against tested range 0.1.0 to 0.9.0 and emits a warning outside that range.
- The peer CLIs configured in Paseo, usually `claude` and `codex`.

The plugin shells out to Paseo. It does not vendor Paseo and does not auto-install it. To use the opt-in helper, run from the repository root:

```bash
node scripts/install-paseo.mjs
```

The helper prompts before running `npm install -g @getpaseo/cli`; declining leaves your machine unchanged.

## Usage

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

## Permissions

The consensus `refine` and `evaluate` skills need permission to run:

- `node` for the wrapper and loop scripts.
- `paseo` for peer invocation.
- read/write access to input files, generated `.consensus/` run state, and output artifacts.

Refine parallel section mode additionally requires host-native subagent dispatch. Codex authorization must fail closed: if dispatch approval is unavailable or denied, the host should report that parallel mode did not run.

## Advanced Configuration

By default, host detection chooses `claude,codex` on Claude Code and Cursor, and `codex,claude` on Codex. Override peers with:

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md --peers claude,codex
```

Peer IDs come from `paseo provider ls --json`; the wrapper does not probe executables directly. Preflight fails closed with `PEER_UNAVAILABLE` when a requested peer is missing from the inventory or reports a non-ready status (`error`, `unavailable`, `not found`, or a `Disabled` provider), so a misconfigured peer is flagged up front rather than surfacing as a mid-run `paseo run` timeout. Custom ACP providers are supported when they are registered with Paseo and appear in that inventory.

Cursor is not a built-in Paseo peer at v0.1, so cursor-as-peer is opt-in. Register Cursor as a custom ACP provider — either through Paseo's one-click ACP catalog or by adding it to `~/.paseo/config.json`:

```json
{
  "agents": {
    "providers": {
      "cursor": {
        "extends": "acp",
        "label": "Cursor",
        "command": ["cursor-agent", "acp"]
      }
    }
  }
}
```

Then authenticate `cursor-agent` (it stores credentials in the OS keychain — a locked keychain makes the provider report `error`) and pass `--peers cursor,codex`. Note that Cursor runs through Paseo's generic ACP path, where `--output-schema` is enforced by prompt injection plus validation/retry rather than the native structured output `claude` and `codex` expose; expect more schema-retry churn, and treat cursor-as-peer as unverified end-to-end until a full deliberation run is exercised against an authenticated `cursor-agent`.

## Limitations

- v0.1 ships the `refine` and `evaluate` skills.
- Remaining consensus family skills are future work: `consensus-create`, `consensus-decide`, `consensus-plan`, and `consensus-research`.
- Ships three iteration modes (`alternating`, `parallel_revision`, `parallel_synthesized`); the independent-draft cold-start strategy is not exposed through `refine` or `evaluate` (shared-input only).
- Sections converge independently; whole-document harmonization and deliberation metrics/cost caps remain deferred.
- Cursor is supported as a host runtime, and as a peer only via a user-configured custom ACP provider (not a default Paseo peer); its structured-output path is softer than claude/codex and is unverified end-to-end at v0.1.
- Codex public marketplace submission is not assumed; Git/local install is the v0.1 path.
- skills.sh listing should not be claimed until indexing has been verified after publication.
- Prompt injection inside the input artifact is mitigated by prompt framing and schema validation, but peer CLIs may still produce structurally valid bad advice. Review the audit trail before publishing outputs.
- This plugin adds no telemetry. Paseo and configured peer CLIs may have their own behavior; review those tools separately.

## Package Layout

- `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` - provider plugin manifests.
- `skills/refine/` - implementation directory for the shipped `refine` skill.
- `skills/refine/references/operator-qa.md` - manual QA walkthrough of the iteration modes and escalation ladder, with runnable example inputs under `references/examples/`.
- `skills/evaluate/` - implementation directory for the shipped `evaluate` skill.
- `skills/evaluate/references/operator-qa.md` - manual QA walkthrough of artifact/rubric evaluation and dissent review.
- `agents/consensus-section-runner.md` - task contract for host-mediated parallel section runners.
