# skills

Status: v0.1 pre-release.

This repository is a personal Agent Skills home. It contains standalone skills under `skills/` and packaged plugins under `plugins/<name>/`.

## What Ships Here

### Consensus plugin

`plugins/consensus/` is a self-contained plugin package for consensus workflows. It ships `refine`, a markdown refinement skill that uses two Paseo-backed AI peers to deliberate toward a converged artifact with an audit trail, and `evaluate`, an artifact-vs-rubric evaluation skill that preserves unified findings, per-peer reasoning, and dissent.

The consensus scope is intentionally narrow: the `refine` and `evaluate` skills, three iteration modes (`alternating` default for refine, `parallel_revision` default for evaluate, `parallel_synthesized`) selected with `--iteration`, an agency-gated escalation ladder (`--host-direction` re-entry), a configurable synthesizer (`--synthesizer`), sequential sections by default for refine, opt-in host-mediated parallel section orchestration for refine, and the `--agency` flag. Future work may add the rest of the consensus skill family, a whole-document harmonization pass, and deliberation metrics/cost caps.

See `plugins/consensus/README.md` for consensus prerequisites, usage, resume behavior, parallel orchestration, permissions, advanced peer configuration, and limitations.

### Session observer skill

`skills/session-observer/` is a standalone Agent Skill for checking what another coding agent just did in the current project. It supports Claude Code, Codex, and Cursor agent transcript stores; renders tool-free digests by default; and tracks per-session read offsets so `catch-up` shows only new transcript records.

It also supports foreground watch mode. `watch` and top-level `--watch` poll the active peer transcript, debounce settled changes, emit catch-up digests to stdout, and can be controlled with `watch-ctl status`, `pause`, `resume`, `flush`, and `stop`. Continuous writes are emitted after `--max-pending-sec` even if the transcript never goes quiet. Automatic responses are bounded to the active agent invocation that keeps the watcher running and reads its output; backgrounded commands in yield-after-turn agent harnesses do not wake a future invocation.

The canonical user-facing documentation is `skills/session-observer/SKILL.md`. Runtime format details live in `skills/session-observer/references/transcript-formats.md`; implemented watch behavior and design notes live in `skills/session-observer/references/watch-design.md`.

### Export session transcript skill

`skills/export-session-transcript/` is a standalone Agent Skill that exports the current agent session to a sanitized Markdown transcript. The output is named after the current git branch (`/` replaced with `-`) and written by default to `~/Downloads`. It supports Claude Code, Codex, and Cursor transcript stores.

To identify which transcript is the live conversation, the agent announces a unique random-hex session marker to the user; the marker lands in the transcript, and the export script greps cwd candidates for it to select the current session unambiguously. If the marker has not yet been flushed, it falls back to the newest transcript for the cwd with a warning.

Modes:

- `--match <marker>` selects the current session by the announced marker (with newest-for-cwd fallback).
- `--session <id>` exports a specific session id.
- `--all` exports every session for the cwd, one file each.
- `--runtime <claude-code|codex|cursor|auto>` selects the runtime (default `auto`: env hint, then best-effort detection).
- `--out <path>` overrides the output file or directory (also accepted positionally).

Sanitization is two layers: a structural pass (`normalizeEntries` in transcript-core, which drops tool calls/results and command-message records) followed by an export-owned content sanitizer (`sanitizeEntries`) that drops hidden-payload messages surviving as ordinary text — environment-context wrappers, AGENTS.md/SKILL.md/skill-body payloads, system/developer instruction records, subagent notifications, and `turn_aborted` markers. The session-marker line and empty entries are stripped before render.

The canonical user-facing documentation is `skills/export-session-transcript/SKILL.md`; per-provider store locations and record shapes live in `skills/export-session-transcript/references/transcript-formats.md`.

### Shared transcript-core

Per-provider transcript knowledge (store locations, record parsing, structural filtering) has a single source of truth at `src/transcript/core/runtimes.ts`. Rather than cross-skill imports, each consuming skill ships a committed generated copy under its own `scripts/lib/runtimes.mjs`, materialized by `pnpm run build`.

`pnpm run sync:transcript-core` remains as a compatibility command for existing habits and automation. It delegates to `scripts/build-generated.mjs`, and `node scripts/sync-transcript-core.mjs --check` delegates to `scripts/build-generated.mjs --check`.

`pnpm run build:check` regenerates expected output in check mode and fails on any divergence. The same guard runs in `pnpm test` through `tests/generated-output-sync.test.mjs`, so editing the canonical module without rebuilding generated output breaks the suite. Edit `src/transcript/core/runtimes.ts`, then run `pnpm run build` to update consumers.

Current consumers: `session-observer` and `export-session-transcript`.

### Generated runtime outputs

Some shipped runtime `.mjs` files are generated from canonical TypeScript source under `src/` while staying committed at the same paths that provider manifests, docs, and users already execute under `plugins/` and `skills/`. Edit the canonical TypeScript source, not generated `.mjs` output with a `// GENERATED` banner.

The build contract is:

- `pnpm run build` runs `node scripts/build-generated.mjs` and writes generated runtime output.
- `pnpm run build:check` runs `node scripts/build-generated.mjs --check` without mutating tracked files.
- `tests/generated-output-sync.test.mjs` runs the drift guard as part of `pnpm test`.
- `pnpm run sync:transcript-core` is a compatibility wrapper around the same generated-output build.
- TypeScript, Vitest, and bundling are developer tooling only; shipped skills still run committed `.mjs` with no install step.

Current generated runtime outputs:

- `src/consensus/core/consensus-loop.ts` builds to `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` and `plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs`.
- `src/consensus/refine/consensus-refine.ts` builds to `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`.
- `src/consensus/evaluate/consensus-evaluate.ts` builds to `plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs`.
- `src/transcript/core/runtimes.ts` builds to `skills/session-observer/scripts/lib/runtimes.mjs` and `skills/export-session-transcript/scripts/lib/runtimes.mjs`.
- `src/transcript/export-session/sanitize.ts` builds to `skills/export-session-transcript/scripts/lib/sanitize.mjs`.
- `src/transcript/export-session/export-session-transcript.ts` builds to `skills/export-session-transcript/scripts/export-session-transcript.mjs`.

Wrappers type-check against canonical TypeScript imports such as `../core/consensus-loop.js`, `../core/runtimes.js`, and `./sanitize.js`; the build rewrites declared module specifiers to shipped local `.mjs` imports and fails if an expected source specifier is absent.

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

Consensus evaluation:

```bash
node plugins/consensus/skills/evaluate/scripts/consensus-evaluate.mjs artifact.md --rubric rubric.md
```

Session observer:

```bash
node skills/session-observer/scripts/session-observer.mjs review --runtime codex --cwd "$PWD"
node skills/session-observer/scripts/session-observer.mjs catch-up --runtime cursor --cwd "$PWD"
node skills/session-observer/scripts/session-observer.mjs watch --runtime codex --cwd "$PWD"
node skills/session-observer/scripts/session-observer.mjs watch-ctl status --json
```

## Permissions

The consensus `refine` and `evaluate` skills need permission to run `node` for wrapper scripts, `paseo` for peer invocation, and read/write access to input files, generated `.consensus/` run state, and output artifacts. Refine parallel section mode additionally requires host-native subagent dispatch.

`session-observer` needs permission to run `node`, read transcript stores under `~/.claude/projects/`, `~/.codex/sessions/`, and `~/.cursor/projects/`, and write read-offset, watcher, control, and optional metadata-only event-log state under `~/.local/state/session-observer/`. It does not write to peer transcripts.

## Advanced Configuration

Consensus peer IDs come from `paseo provider ls --json`; the wrapper does not probe executables directly. Custom ACP providers are supported when they are registered with Paseo and appear in that inventory. Cursor is not a built-in Paseo peer at v0.1, so cursor-as-peer is opt-in only through a user-configured custom ACP provider ID, for example `--peers cursor-acp,codex` if that provider exists locally.

Session observer defaults to `--runtime auto`, which resolves by host hint, prior same-cwd state, or candidate availability. Use `--runtime claude-code|codex|cursor` or `--session <runtime>:<sessionId>` when multiple matching sessions exist.

For watch mode, `--runtime both` watches Claude Code and Codex in one foreground process. Cursor remains supported through explicit `--runtime cursor` or `--runtime auto`. `watch-ctl status --json` includes the resolved session id, transcript path, current transcript record count, consumed offset, records behind, and health flags so consumers can distinguish peer idleness from watcher drift.

## Limitations

- The consensus plugin family ships the `refine` and `evaluate` skills in v0.1; the standalone `session-observer` and `export-session-transcript` skills (and the transcript-core generated runtime they use) ship alongside it but are not part of the consensus plugin.
- Remaining consensus family skills are future work: `consensus-create`, `consensus-decide`, `consensus-plan`, and `consensus-research`.
- Consensus ships three iteration modes (`alternating`, `parallel_revision`, `parallel_synthesized`); the parallel-revision and parallel-synthesized capabilities disclose their per-round call multiplier (2x peer calls, plus 1 synthesis call for synthesized) and escalate stuck states through the agency-gated ladder.
- Consensus sections converge independently; whole-document harmonization and deliberation metrics/cost caps remain deferred.
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
- `skills/export-session-transcript/` - standalone session transcript export skill.
- `src/transcript/` - canonical TypeScript source for transcript-core and export-session runtime code.
- `shared/transcript-core/` - compatibility documentation pointer for the former shared transcript-core source path.
- `plugins/consensus/` - self-contained consensus plugin package.
- `.claude-plugin/`, `.cursor-plugin/`, `.agents/plugins/` - repo-root marketplace entries.
- `.oat/` and `.agents/` - project-management infrastructure, not required by plugin consumers.

## Development

Run:

```bash
pnpm run type-check
pnpm test
pnpm run build:check
pnpm run validate
pnpm run smoke
```

Runtime plugin code uses Node ESM and the Node standard library only. Developer tooling uses pnpm-managed dev dependencies.
