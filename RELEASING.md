# Releasing

v0.1 is not ready to tag until the full project validation and provider smoke tests pass.

## Checklist

- Run `pnpm run build`.
- Run `pnpm run type-check`.
- Run `pnpm run build:check`.
- Run `pnpm run test`.
- Run `pnpm run validate`.
- Run `pnpm run smoke`.
- Run the live provider E2E release gate in
  `plugins/consensus/references/live-e2e.md` and capture Refine plus Evaluate
  evidence.
- Verify sequential `consensus-refine` on a real markdown artifact when the
  live E2E runbook does not already cover the release delta.
- Verify resume from a generated deliberation artifact.
- Verify user-direction continuation after an impasse or max-rounds stop.
- Verify corrupt resume handling with explicit skip controls before continuing from damaged state.
- Verify host-mediated parallel prepare, section dispatch, and fan-in on a multi-section markdown artifact.
- Verify Claude Code plugin install and Bash permission shape.
- Verify Cursor plugin install and exec permission shape.
- Verify Codex Git/local install, interface metadata, skill path syntax, and exec permission shape.
- Verify `npx skills add <username>/skills` discovery.
- Confirm the README install matrix matches the live provider CLIs.
- Confirm no plugin manifest references `.oat/` or project-local infrastructure.

## v0.1 Readiness Snapshot

Last updated: 2026-06-20.

### Automated checks

| Check                  | Status | Evidence                                                                                                 |
| ---------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `pnpm run build`       | passed | Generated all committed runtime outputs from canonical TypeScript source                                 |
| `pnpm run type-check`  | passed | `tsc --noEmit` completed                                                                                 |
| `pnpm run build:check` | passed | All generated outputs reported `in sync`                                                                 |
| `pnpm run test`        | passed | Vitest-only suite: 72 test files passed, 726 tests passed                                                |
| `pnpm run validate`    | passed | `validation passed`                                                                                      |
| `pnpm run smoke`       | passed | `smoke passed`                                                                                           |
| `pnpm run premerge`    | passed | Build, type-check, build-check, test, validate, and smoke all passed                                     |
| Prior live dogfood     | reused | PR #9 verified `consensus-refine` with live Claude+Codex across all iteration modes and escalation flows |
| Provider CLI inventory | passed | `claude`, `codex`, and `cursor` ready after unlocking the SSH-session keychain                           |
| Default peers          | passed | Per-provider preflight passed for `claude` and `codex`                                                   |

### Manual provider checks

| Provider     | Status   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code  | verified | `claude` CLI `2.1.185` is present and provider CLI preflight reports `usable: true`. `claude plugin validate plugins/consensus` passed with warnings only. `claude plugin marketplace add "$PWD"` and `claude plugin install consensus@skills` passed, and `claude plugin details consensus` reports 2 skills (`evaluate`, `refine`) plus 1 agent (`consensus-section-runner`). Interactive smoke passed in a live Claude Code runtime on 2026-06-20: the operator approved the `Bash(node)` permission prompt and the consensus wrapper ran `preflight --json` to `ok: true` / `usable: true`.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Cursor       | verified | `cursor-agent` `2026.06.19-20-24-33-653a7fb` is present. In SSH sessions, the macOS login keychain may need to be unlocked in that same shell before `cursor-agent` and provider CLI preflight report ready. After unlocking, direct provider CLI smoke, Refine E2E, and Evaluate E2E passed with Cursor as a peer using `strategy_used: "prompt_only"` and first-attempt schema success. Submit-tool support remains reserved and is not selected by default. Plugin load verified on 2026-06-20 via `cursor agent --plugin-dir "$PWD/plugins/consensus"`: Cursor surfaced a `node` exec permission prompt, and after approval the consensus wrapper ran `preflight --json` to `ok: true` / `usable: true`.                                                                                                                                                                                                                                                                                                          |
| Codex        | verified | `codex-cli 0.139.0` is present and provider CLI preflight reports `usable: true`. `codex plugin marketplace add "$PWD"` confirms local marketplace support but cannot add this release-candidate worktree while the configured `skills` marketplace already points at `/Users/tstang/Code/skills`. `codex plugin add consensus --marketplace skills --json` passed and installed `consensus@skills` 0.1.0 from the configured local marketplace. Interactive runtime smoke passed on 2026-06-20: in a live Codex session, tested under both the default and `--ask-for-approval on-request` policies, the consensus wrapper ran under Codex's sandboxed exec path and `preflight --json` returned `ok: true` / `usable: true`. Codex did not surface an approval prompt for this read-only command under either policy — by design, its `on-request` approval gates sandbox _escalation_ (writes/network outside the workspace), not in-sandbox read-only execution, so a read-only preflight runs without prompting. |
| Agent Skills | partial  | `npx skills@latest --help` resolves `skills` 1.5.12. `npx skills@latest add tkstang/skills --list --full-depth` cloned the GitHub source and listed 60 source-discovered skills. This is not a post-tag skills.sh indexing check and does not prove public listing/discovery for the consensus plugin; do not claim skills.sh availability until indexing is verified after publication.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

All interactive provider permission/runtime checks above are green as of
2026-06-20 (Claude Code and Cursor surfaced and approved a `node` exec prompt;
Codex ran the wrapper under its sandboxed exec path, which by design does not
prompt for read-only commands even under `on-request`).

**v0.1.0 is released (2026-06-20).** The tag is pushed on `main` (`e4e9348`),
`release.yml` ran green (build, type-check, build:check, test, validate, smoke,
`--check-tag v0.1.0`), and the GitHub Release is published at
<https://github.com/tkstang/skills/releases/tag/v0.1.0>. Post-tag `npx skills add
tkstang/skills` source discovery passes; skills.sh **hosted indexing is not yet
live** (expected async lag) and stays a non-claim until it indexes.

## Versioning

Update `CHANGELOG.md` and all provider manifests together.

Use:

```bash
node scripts/bump-version.mjs 0.1.0
```

The bump script updates the three provider plugin manifests, the shipped consensus skill metadata listed in `scripts/bump-version.mjs`, and any marketplace `version` fields that are already present. It does not add version fields to marketplace schemas that omit them.

Before pushing a release tag, verify the tag and manifests match:

```bash
node scripts/bump-version.mjs --check-tag v0.1.0
```

The structural validator enforces provider manifest consistency during normal development; the release workflow also checks the pushed tag against provider manifests, shipped consensus skill metadata, and present marketplace version fields.
