# consensus plugin

Status: v0.1 pre-release.

`plugins/consensus/` is a self-contained plugin package for consensus workflows. It currently ships one skill, `consensus-refine`, which refines markdown drafts by asking two Paseo-backed AI peers to deliberate toward a converged artifact with an audit trail.

The v0.1 scope is intentionally narrow: `consensus-refine`, alternating iteration mode, sequential sections by default, opt-in host-mediated parallel section orchestration, and the `--agency` flag. Future work may add the rest of the consensus skill family, additional iteration modes, and a whole-document harmonization pass.

## Install Matrix

These are release-candidate install paths. Re-check the provider CLIs and marketplace flows before tagging v0.1.

| Provider | Command |
| --- | --- |
| Claude Code | `claude plugin add https://github.com/<username>/skills --plugin consensus` |
| Cursor | `cursor plugin add https://github.com/<username>/skills --plugin consensus` |
| Codex | `codex plugin install https://github.com/<username>/skills --path plugins/consensus` |
| Local development | `git clone https://github.com/<username>/skills.git && cd skills && npm test` |

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
node plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs draft.md --goal "Make this clearer."
```

The wrapper parses the document into sections, runs the configured peers through alternating verdict rounds, and writes a deliberation artifact beside the input as `<input>.consensus.md` unless `--output <path>` is provided. The artifact contains the final output, resolution metadata, section states, and a per-section deliberation log.

Resume from a prior artifact with `--resume <artifact-path>`. Use `--user-direction "<direction>"` when continuing after an impasse or max-rounds stop, and use the corrupt-section controls only when the wrapper reports blocked resume state:

```bash
node plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs draft.md \
  --resume draft.consensus.md \
  --user-direction "Prefer the shorter introduction."
```

Parallel section orchestration is host mediated. Prepare packets first, dispatch section runners with the host runtime, then fan in the completed section outputs:

```bash
node plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs draft.md --prepare-parallel --goal "Tighten the draft."
node plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs --fan-in .consensus/<run-id>/manifest.json
```

## Permissions

`consensus-refine` needs permission to run:

- `node` for the wrapper and loop scripts.
- `paseo` for peer invocation.
- read/write access to the input markdown file, generated `.consensus/` run state, and the output deliberation artifact.

Parallel mode additionally requires host-native subagent dispatch. Codex authorization must fail closed: if dispatch approval is unavailable or denied, the host should report that parallel mode did not run.

## Advanced Configuration

By default, host detection chooses `claude,codex` on Claude Code and Cursor, and `codex,claude` on Codex. Override peers with:

```bash
node plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs draft.md --peers claude,codex
```

Peer IDs come from `paseo provider ls --json`; the wrapper does not probe executables directly. Custom ACP providers are supported when they are registered with Paseo and appear in that inventory. Cursor is not a built-in Paseo peer at v0.1, so cursor-as-peer is opt-in only through a user-configured custom ACP provider ID, for example `--peers cursor-acp,codex` if that provider exists locally.

## Limitations

- v0.1 ships `consensus-refine` only.
- The rest of the consensus family is deferred: `consensus-create`, `consensus-evaluate`, `consensus-decide`, `consensus-plan`, and `consensus-research`.
- Alternating iteration mode only; parallel-revision and parallel-synthesized modes are future work.
- Sections converge independently; there is no whole-document harmonization pass in v0.1.
- Cursor is supported as a host runtime, not as a default Paseo peer.
- Codex public marketplace submission is not assumed; Git/local install is the v0.1 path.
- skills.sh listing should not be claimed until indexing has been verified after publication.
- Prompt injection inside the input artifact is mitigated by prompt framing and schema validation, but peer CLIs may still produce structurally valid bad advice. Review the audit trail before publishing outputs.
- This plugin adds no telemetry. Paseo and configured peer CLIs may have their own behavior; review those tools separately.

## Package Layout

- `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` - provider plugin manifests.
- `skills/consensus-refine/` - the shipped consensus skill.
- `agents/consensus-section-runner.md` - task contract for host-mediated parallel section runners.
