# skills

Status: v0.1 pre-release.

This repository is a personal Agent Skills home. It contains standalone skills under `skills/` and packaged plugins under `plugins/<name>/`.

## What Ships Here

### Consensus plugin

`plugins/consensus/` is a self-contained plugin package for consensus workflows. Its first shipped skill is `consensus-refine`, a markdown refinement skill that uses two Paseo-backed AI peers to deliberate toward a converged artifact with an audit trail.

The v0.1 consensus scope is intentionally narrow: `consensus-refine`, alternating iteration mode, sequential sections by default, opt-in host-mediated parallel section orchestration, and the `--agency` flag. Future work may add the rest of the consensus skill family, additional iteration modes, and a whole-document harmonization pass.

See `plugins/consensus/README.md` for consensus prerequisites, usage, resume behavior, parallel orchestration, permissions, advanced peer configuration, and limitations.

### Session observer skill

`skills/session-observer/` is a standalone Agent Skill for checking what another coding agent just did in the current project. It supports Claude Code, Codex, and Cursor agent transcript stores; renders tool-free digests by default; and tracks per-session read offsets so `catch-up` shows only new transcript records.

The canonical user-facing documentation is `skills/session-observer/SKILL.md`. Runtime format details live in `skills/session-observer/references/transcript-formats.md`; the deferred watcher design lives in `skills/session-observer/references/watch-design.md`.

## Install Matrix

These are release-candidate install paths. Re-check the provider CLIs and marketplace flows before tagging v0.1.

| Provider | Command |
| --- | --- |
| Claude Code | `claude plugin add https://github.com/<username>/skills --plugin consensus` |
| Cursor | `cursor plugin add https://github.com/<username>/skills --plugin consensus` |
| Codex | `codex plugin install https://github.com/<username>/skills --path plugins/consensus` |
| Agent Skills | `npx skills add <username>/skills` |
| Local development | `git clone https://github.com/<username>/skills.git && cd skills && npm test` |

## Prerequisites

- Node.js 22 or newer.
- Consensus plugin only: Paseo CLI on `PATH`: `npm install -g @getpaseo/cli`. v0.1 validates against tested range 0.1.0 to 0.9.0 and emits a warning outside that range.
- Consensus plugin only: peer CLIs configured in Paseo, usually `claude` and `codex`.

The consensus plugin shells out to Paseo. It does not vendor Paseo and does not auto-install it. To use the opt-in helper, run:

```bash
node scripts/install-paseo.mjs
```

The helper prompts before running `npm install -g @getpaseo/cli`; declining leaves your machine unchanged.

## Usage

Consensus refinement:

```bash
node plugins/consensus/skills/consensus-refine/scripts/consensus-refine.mjs draft.md --goal "Make this clearer."
```

Session observer:

```bash
node skills/session-observer/scripts/session-observer.mjs review --runtime codex --cwd "$PWD"
node skills/session-observer/scripts/session-observer.mjs catch-up --runtime cursor --cwd "$PWD"
```

## Permissions

`consensus-refine` needs permission to run `node` for wrapper scripts, `paseo` for peer invocation, and read/write access to the input markdown file, generated `.consensus/` run state, and the output deliberation artifact. Parallel mode additionally requires host-native subagent dispatch.

`session-observer` needs permission to run `node`, read transcript stores under `~/.claude/projects/`, `~/.codex/sessions/`, and `~/.cursor/projects/`, and write read-offset state under `~/.local/state/session-observer/`. It does not write to peer transcripts.

## Advanced Configuration

Consensus peer IDs come from `paseo provider ls --json`; the wrapper does not probe executables directly. Custom ACP providers are supported when they are registered with Paseo and appear in that inventory. Cursor is not a built-in Paseo peer at v0.1, so cursor-as-peer is opt-in only through a user-configured custom ACP provider ID, for example `--peers cursor-acp,codex` if that provider exists locally.

Session observer defaults to `--runtime auto`, which resolves by host hint, prior same-cwd state, or candidate availability. Use `--runtime claude-code|codex|cursor` or `--session <runtime>:<sessionId>` when multiple matching sessions exist.

## Limitations

- v0.1 ships `consensus-refine` only.
- The rest of the consensus family is deferred: `consensus-create`, `consensus-evaluate`, `consensus-decide`, `consensus-plan`, and `consensus-research`.
- Consensus alternating iteration mode only; parallel-revision and parallel-synthesized modes are future work.
- Consensus sections converge independently; there is no whole-document harmonization pass in v0.1.
- Cursor is supported as a host runtime for the consensus plugin, not as a default Paseo peer.
- Session observer supports Cursor agent transcript JSONL only; `~/.cursor/chats/*/store.db` SQLite chat history is out of scope.
- Session observer watch mode is designed but not implemented.
- Codex public marketplace submission is not assumed; Git/local install is the v0.1 path.
- skills.sh listing should not be claimed until indexing has been verified after publication.
- Prompt injection inside input artifacts or transcripts is mitigated by prompt framing, filtering, and schema validation where applicable, but peer CLIs may still produce structurally valid bad advice. Review outputs before publishing them.
- This repository adds no telemetry. Paseo and configured peer CLIs may have their own behavior; review those tools separately.

## Repository Layout

- `skills/` - standalone personal skills.
- `skills/session-observer/` - standalone peer transcript review and catch-up skill.
- `plugins/consensus/` - self-contained consensus plugin package.
- `.claude-plugin/`, `.cursor-plugin/`, `.agents/plugins/` - repo-root marketplace entries.
- `.oat/` and `.agents/` - project-management infrastructure, not required by plugin consumers.

## Development

Run:

```bash
npm test
npm run validate
npm run smoke
```

The project uses Node ESM and the Node standard library only.
