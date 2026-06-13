# consensus plugin

Status: v0.1 pre-release.

`plugins/consensus/` is a self-contained plugin package for consensus workflows. It currently ships one skill, `refine`, which refines markdown drafts by asking two Paseo-backed AI peers to deliberate toward a converged artifact with an audit trail.

The scope is intentionally narrow: the `refine` skill, three iteration modes selected with `--iteration` (`alternating` default, `parallel_revision`, `parallel_synthesized`), a configurable synthesizer (`--synthesizer`), an agency-gated escalation ladder with host/user decision re-entry (`--host-direction`), sequential sections by default, opt-in host-mediated parallel section orchestration, and the `--agency` flag. Future work may add the rest of the consensus skill family, a whole-document harmonization pass, and deliberation metrics/cost caps.

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

## Permissions

The consensus `refine` skill needs permission to run:

- `node` for the wrapper and loop scripts.
- `paseo` for peer invocation.
- read/write access to the input markdown file, generated `.consensus/` run state, and the output deliberation artifact.

Parallel mode additionally requires host-native subagent dispatch. Codex authorization must fail closed: if dispatch approval is unavailable or denied, the host should report that parallel mode did not run.

## Advanced Configuration

By default, host detection chooses `claude,codex` on Claude Code and Cursor, and `codex,claude` on Codex. Override peers with:

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md --peers claude,codex
```

Peer IDs come from `paseo provider ls --json`; the wrapper does not probe executables directly. Custom ACP providers are supported when they are registered with Paseo and appear in that inventory. Cursor is not a built-in Paseo peer at v0.1, so cursor-as-peer is opt-in only through a user-configured custom ACP provider ID, for example `--peers cursor-acp,codex` if that provider exists locally.

## Limitations

- v0.1 ships the `refine` skill only.
- The rest of the consensus family is deferred: `consensus-create`, `consensus-evaluate`, `consensus-decide`, `consensus-plan`, and `consensus-research`.
- Ships three iteration modes (`alternating`, `parallel_revision`, `parallel_synthesized`); the independent-draft cold-start strategy is not exposed through `refine` (shared-input only).
- Sections converge independently; whole-document harmonization and deliberation metrics/cost caps remain deferred.
- Cursor is supported as a host runtime, not as a default Paseo peer.
- Codex public marketplace submission is not assumed; Git/local install is the v0.1 path.
- skills.sh listing should not be claimed until indexing has been verified after publication.
- Prompt injection inside the input artifact is mitigated by prompt framing and schema validation, but peer CLIs may still produce structurally valid bad advice. Review the audit trail before publishing outputs.
- This plugin adds no telemetry. Paseo and configured peer CLIs may have their own behavior; review those tools separately.

## Package Layout

- `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` - provider plugin manifests.
- `skills/refine/` - implementation directory for the shipped `refine` skill.
- `skills/refine/references/operator-qa.md` - manual QA walkthrough of the iteration modes and escalation ladder, with runnable example inputs under `references/examples/`.
- `agents/consensus-section-runner.md` - task contract for host-mediated parallel section runners.
