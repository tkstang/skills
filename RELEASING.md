# Releasing

v0.1 is not ready to tag until the full project validation and provider smoke tests pass.

## Checklist

- Run `pnpm run build`.
- Run `pnpm run type-check`.
- Run `pnpm run build:check`.
- Run `pnpm run test`.
- Run `pnpm run validate`.
- Run `pnpm run smoke`.
- Verify sequential `consensus-refine` on a real markdown artifact.
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

Last updated: 2026-06-19.

### Automated checks

| Check                  | Status  | Evidence                                                                                                 |
| ---------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm run build`       | passed  | Generated all committed runtime outputs from canonical TypeScript source                                 |
| `pnpm run type-check`  | passed  | `tsc --noEmit` completed                                                                                 |
| `pnpm run build:check` | passed  | All generated outputs reported `in sync`                                                                 |
| `pnpm run test`        | passed  | Vitest-only suite: 53 test files passed, 572 tests passed                                                |
| `pnpm run validate`    | passed  | `validation passed`                                                                                      |
| `pnpm run smoke`       | passed  | `smoke passed`                                                                                           |
| Prior live dogfood     | reused  | PR #9 verified `consensus-refine` with live Claude+Codex across all iteration modes and escalation flows |
| Provider CLI inventory | pending | Re-run during provider checks                                                                            |
| Default peers          | pending | Re-run during provider checks                                                                            |

### Manual provider checks

| Provider     | Status             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code  | partial            | `claude` CLI `2.1.183` is present. `claude plugin validate plugins/consensus` passed with warnings only. `claude plugin marketplace add "$PWD"` and `claude plugin install consensus@skills --scope local` passed against this release-candidate checkout, and `claude plugin details consensus` reports 2 skills (`evaluate`, `refine`) plus 1 agent (`consensus-section-runner`). Interactive `Bash(node)` / `Bash(consensus)` permission-prompt smoke still needs a Claude Code runtime pass before tag. |
| Cursor       | blocked before tag | `cursor` CLI `3.5.33` is present, but `cursor agent --help` is currently blocked by the locked macOS login keychain (`security unlock-keychain` required). `consensus provider ls --json` reports Cursor as `auth_required` in the local provider inventory. Cursor plugin marketplace/install and `exec` permission behavior remain unverified.                                                                                                                                                            |
| Codex        | partial            | `codex-cli 0.139.0` is present. `codex plugin marketplace add "$PWD"` confirms local marketplace support but cannot add this release-candidate worktree while the configured `skills` marketplace already points at `/Users/tstang/Code/skills`. `codex plugin add consensus --marketplace skills --json` passed and installed `consensus@skills` 0.1.0 from the configured local marketplace. Exec-permission prompt behavior still needs an interactive Codex runtime pass before tag.                    |
| Agent Skills | partial            | `npx skills@latest --help` resolves `skills` 1.5.12. `npx skills@latest add tkstang/skills --list --full-depth` cloned the GitHub source and listed 60 source-discovered skills. This is not a post-tag skills.sh indexing check and does not prove public listing/discovery for the consensus plugin; do not claim skills.sh availability until indexing is verified after publication.                                                                                                                    |

Do not tag or publish v0.1 until the blocked provider checks above are green or the release notes explicitly call out the unsupported path.

## Versioning

Update `CHANGELOG.md` and all provider manifests together.

Use:

```bash
node scripts/bump-version.mjs 0.1.0
```

The bump script updates the three provider plugin manifests, the shipped consensus skill metadata (`refine` and `evaluate`), and any marketplace `version` fields that are already present. It does not add version fields to marketplace schemas that omit them.

Before pushing a release tag, verify the tag and manifests match:

```bash
node scripts/bump-version.mjs --check-tag v0.1.0
```

The structural validator enforces provider manifest consistency during normal development; the release workflow also checks the pushed tag against provider manifests, shipped consensus skill metadata, and present marketplace version fields.
