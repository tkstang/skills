# skills

Status: v0.1 pre-release.

This repository is a personal Agent Skills home. It contains standalone skills under `skills/` and packaged plugins under `plugins/<name>/`.

## What Ships Here

### Consensus plugin

`plugins/consensus/` is a self-contained plugin package for consensus workflows. Its first shipped skill is `refine`, a markdown refinement skill that uses two Paseo-backed AI peers to deliberate toward a converged artifact with an audit trail.

The v0.1 consensus scope is intentionally narrow: the `refine` skill, alternating iteration mode, sequential sections by default, opt-in host-mediated parallel section orchestration, and the `--agency` flag. Future work may add the rest of the consensus skill family, additional iteration modes, and a whole-document harmonization pass.

See `plugins/consensus/README.md` for consensus prerequisites, usage, resume behavior, parallel orchestration, permissions, advanced peer configuration, and limitations.

### Session observer skill

`skills/session-observer/` is a standalone Agent Skill for checking what another coding agent just did in the current project. It supports Claude Code, Codex, and Cursor agent transcript stores; renders tool-free digests by default; and tracks per-session read offsets so `catch-up` shows only new transcript records.

It also supports foreground watch mode. `watch` and top-level `--watch` poll the active peer transcript, debounce settled changes, emit catch-up digests to stdout, and can be controlled with `watch-ctl status`, `pause`, `resume`, `flush`, and `stop`. Continuous writes are emitted after `--max-pending-sec` even if the transcript never goes quiet. Automatic responses are bounded to the active agent invocation that keeps the watcher running and reads its output; backgrounded commands in yield-after-turn agent harnesses do not wake a future invocation.

The canonical user-facing documentation is `skills/session-observer/SKILL.md`. Runtime format details live in `skills/session-observer/references/transcript-formats.md`; implemented watch behavior and design notes live in `skills/session-observer/references/watch-design.md`.

## Local Git Repository Install

The current v0.1 path is local marketplace installation from this checkout. The repo root contains provider marketplace entries, and `plugins/consensus/` contains the provider plugin manifests.

From this repository root, install the consensus plugin for Claude Code:

```bash
claude plugin marketplace add "$PWD" --scope user
claude plugin install consensus@skills --scope user
claude plugin details consensus
```

Install the consensus plugin for Codex:

```bash
codex plugin marketplace add "$PWD"
codex plugin add consensus --marketplace skills
codex plugin list | rg 'consensus@skills'
```

Load the consensus plugin for a Cursor Agent session:

```bash
cursor agent --plugin-dir "$PWD/plugins/consensus"
```

The Cursor CLI does not currently expose `cursor plugin marketplace` or `cursor plugin install`; local plugin loading is session-scoped through Cursor Agent's `--plugin-dir` option.

Published Git and marketplace install flows are not yet release claims. Re-check provider CLIs and marketplace flows before tagging v0.1.

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
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md --goal "Make this clearer."
```

Session observer:

```bash
node skills/session-observer/scripts/session-observer.mjs review --runtime codex --cwd "$PWD"
node skills/session-observer/scripts/session-observer.mjs catch-up --runtime cursor --cwd "$PWD"
node skills/session-observer/scripts/session-observer.mjs watch --runtime codex --cwd "$PWD"
node skills/session-observer/scripts/session-observer.mjs watch-ctl status --json
```

## Permissions

The consensus `refine` skill needs permission to run `node` for wrapper scripts, `paseo` for peer invocation, and read/write access to the input markdown file, generated `.consensus/` run state, and the output deliberation artifact. Parallel mode additionally requires host-native subagent dispatch.

`session-observer` needs permission to run `node`, read transcript stores under `~/.claude/projects/`, `~/.codex/sessions/`, and `~/.cursor/projects/`, and write read-offset, watcher, control, and optional metadata-only event-log state under `~/.local/state/session-observer/`. It does not write to peer transcripts.

## Advanced Configuration

Consensus peer IDs come from `paseo provider ls --json`; the wrapper does not probe executables directly. Custom ACP providers are supported when they are registered with Paseo and appear in that inventory. Cursor is not a built-in Paseo peer at v0.1, so cursor-as-peer is opt-in only through a user-configured custom ACP provider ID, for example `--peers cursor-acp,codex` if that provider exists locally.

Session observer defaults to `--runtime auto`, which resolves by host hint, prior same-cwd state, or candidate availability. Use `--runtime claude-code|codex|cursor` or `--session <runtime>:<sessionId>` when multiple matching sessions exist.

For watch mode, `--runtime both` watches Claude Code and Codex in one foreground process. Cursor remains supported through explicit `--runtime cursor` or `--runtime auto`. `watch-ctl status --json` includes the resolved session id, transcript path, current transcript record count, consumed offset, records behind, and health flags so consumers can distinguish peer idleness from watcher drift.

## Limitations

- v0.1 ships the `refine` skill only.
- The rest of the consensus family is deferred: `consensus-create`, `consensus-evaluate`, `consensus-decide`, `consensus-plan`, and `consensus-research`.
- Consensus alternating iteration mode only; parallel-revision and parallel-synthesized modes are future work.
- Consensus sections converge independently; there is no whole-document harmonization pass in v0.1.
- Cursor is supported as a host runtime for the consensus plugin, not as a default Paseo peer.
- Session observer supports Cursor agent transcript JSONL only; `~/.cursor/chats/*/store.db` SQLite chat history is out of scope.
- Session observer watch mode only responds while the active agent invocation keeps the foreground watcher running and actively reads stdout or re-polls `watch-ctl status`; provider-hook automation for future self-triggered turns is out of scope. Starting `watch` in a backgrounded shell does not notify Claude Code/Codex/Cursor after the current invocation yields.
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
