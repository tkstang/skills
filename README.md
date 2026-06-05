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

The canonical user-facing documentation is `skills/session-observer/SKILL.md`. Runtime format details live in `skills/session-observer/references/transcript-formats.md`; the deferred watcher design lives in `skills/session-observer/references/watch-design.md`.

### Export session transcript skill

`skills/export-session-transcript/` is a standalone Agent Skill that exports the current agent session to a sanitized Markdown transcript. The output is named after the current git branch (`/` replaced with `-`) and written by default to `~/Downloads`. It supports Claude Code, Codex, and Cursor transcript stores.

To identify which transcript is the live conversation, the agent announces a unique random-hex session marker to the user; the marker lands in the transcript, and the export script greps cwd candidates for it to select the current session unambiguously. If the marker has not yet been flushed, it falls back to the newest transcript for the cwd with a warning.

Modes:

- `--match <marker>` selects the current session by the announced marker (with newest-for-cwd fallback).
- `--session <id>` exports a specific session id.
- `--all` exports every session for the cwd, one file each.
- `--runtime <claude-code|codex|cursor|auto>` selects the runtime (default `auto`: env hint, then best-effort detection).
- `--out <path>` overrides the output file or directory (also accepted positionally).

Sanitization is two layers: a structural pass (`normalizeEntries` in the shared transcript-core, which drops tool calls/results and command-message records) followed by an export-owned content sanitizer (`scripts/lib/sanitize.mjs`, `sanitizeEntries`) that drops hidden-payload messages surviving as ordinary text — environment-context wrappers, AGENTS.md/SKILL.md/skill-body payloads, system/developer instruction records, subagent notifications, and `turn_aborted` markers. The session-marker line and empty entries are stripped before render.

The canonical user-facing documentation is `skills/export-session-transcript/SKILL.md`; per-provider store locations and record shapes live in `skills/export-session-transcript/references/transcript-formats.md`.

### Shared transcript-core

Per-provider transcript knowledge (store locations, record parsing, structural filtering) has a single source of truth at `shared/transcript-core/runtimes.mjs`. Rather than cross-skill imports, each consuming skill ships a committed, byte-identical vendored copy under its own `scripts/lib/runtimes.mjs`, materialized by `npm run sync:transcript-core`. The synced copies carry a generated banner; the canonical source is banner-free.

A `--check` drift guard (`node scripts/sync-transcript-core.mjs --check`) regenerates the expected banner-stamped content and diffs the committed copies, failing on any divergence. It runs as part of `npm test` via `tests/transcript-core/sync.test.mjs`, so editing the canonical module without re-syncing breaks the suite. Edit `shared/transcript-core/runtimes.mjs`, then run `npm run sync:transcript-core` to update consumers.

Current consumers: `session-observer` and `export-session-transcript`.

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
```

## Permissions

The consensus `refine` skill needs permission to run `node` for wrapper scripts, `paseo` for peer invocation, and read/write access to the input markdown file, generated `.consensus/` run state, and the output deliberation artifact. Parallel mode additionally requires host-native subagent dispatch.

`session-observer` needs permission to run `node`, read transcript stores under `~/.claude/projects/`, `~/.codex/sessions/`, and `~/.cursor/projects/`, and write read-offset state under `~/.local/state/session-observer/`. It does not write to peer transcripts.

## Advanced Configuration

Consensus peer IDs come from `paseo provider ls --json`; the wrapper does not probe executables directly. Custom ACP providers are supported when they are registered with Paseo and appear in that inventory. Cursor is not a built-in Paseo peer at v0.1, so cursor-as-peer is opt-in only through a user-configured custom ACP provider ID, for example `--peers cursor-acp,codex` if that provider exists locally.

Session observer defaults to `--runtime auto`, which resolves by host hint, prior same-cwd state, or candidate availability. Use `--runtime claude-code|codex|cursor` or `--session <runtime>:<sessionId>` when multiple matching sessions exist.

## Limitations

- v0.1 ships the `refine` skill only.
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
- `skills/export-session-transcript/` - standalone session transcript export skill.
- `shared/transcript-core/` - canonical per-provider transcript module synced into each consuming skill.
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
