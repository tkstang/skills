# skills

Status: v0.1 pre-release.

This repository is a personal Agent Skills home. Standalone skills live in `skills/`; packaged plugins live under `plugins/<name>/`. The first packaged plugin is `consensus`, which contains `consensus-refine`: a markdown refinement skill that uses two Paseo-backed AI peers to deliberate toward a converged artifact with an audit trail.

The v0.1 scope is intentionally narrow: `consensus-refine`, alternating iteration mode, sequential sections by default, opt-in host-mediated parallel section orchestration, and the `--agency` flag. Future work may add the rest of the consensus skill family, additional iteration modes, and a whole-document harmonization pass.

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

- Node.js 20 or newer.
- Paseo CLI on `PATH`: `npm install -g @getpaseo/cli`.
- The peer CLIs configured in Paseo, usually `claude` and `codex`.

The plugin shells out to Paseo. It does not vendor Paseo and does not auto-install it.

## Permissions

`consensus-refine` needs permission to run:

- `node` for the wrapper and loop scripts.
- `paseo` for peer invocation.
- read/write access to the input markdown file, generated `.consensus/` run state, and the output deliberation artifact.

Parallel mode additionally requires host-native subagent dispatch. Codex authorization must fail closed: if dispatch approval is unavailable or denied, the host should report that parallel mode did not run.

## Limitations

- v0.1 ships `consensus-refine` only.
- Alternating iteration mode only; parallel-revision and parallel-synthesized modes are future work.
- Sections converge independently; there is no whole-document harmonization pass in v0.1.
- Cursor is supported as a host runtime, not as a default Paseo peer.
- Codex public marketplace submission is not assumed; Git/local install is the v0.1 path.
- skills.sh listing should not be claimed until indexing has been verified after publication.

## Repository Layout

- `skills/` - standalone personal skills.
- `plugins/consensus/` - self-contained consensus plugin package.
- `.claude-plugin/`, `.cursor-plugin/`, `.agents/plugins/` - repo-root marketplace entries.
- `.oat/` and `.agents/` - project-management infrastructure, not required by plugin consumers.

## Development

Run:

```bash
npm test
npm run validate
```

The project uses Node ESM and the Node standard library only.
