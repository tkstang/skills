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
| Paseo availability     | pending | Re-run during provider checks                                                                            |
| Default peers          | pending | Re-run during provider checks                                                                            |

### Manual provider checks

| Provider     | Status             | Notes                                                                                                                                                                                                                                                                                                     |
| ------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code  | blocked before tag | `claude` CLI is present and supports `--plugin-dir` / `--allowed-tools`, but the plugin install plus `Bash(node)` / `Bash(paseo)` permission profile still needs an interactive runtime smoke test.                                                                                                       |
| Cursor       | blocked before tag | `cursor` CLI is present, but this local CLI surface does not expose a non-interactive plugin marketplace install check. Verify marketplace install and `exec` permission behavior manually.                                                                                                               |
| Codex        | blocked before tag | `codex plugin marketplace add` supports local marketplace roots, and static manifest resolution confirms `./skills/consensus-refine` exists under `plugins/consensus`; no safe non-mutating dry-run was found, so local install acceptance and `exec` permission behavior still need manual verification. |
| Agent Skills | blocked before tag | Run `npx skills add <username>/skills` against the published repo or a release candidate source before claiming skills.sh discovery.                                                                                                                                                                      |

Do not tag or publish v0.1 until the blocked provider checks above are green or the release notes explicitly call out the unsupported path.

## Versioning

Update `CHANGELOG.md` and all provider manifests together.

Use:

```bash
node scripts/bump-version.mjs 0.1.0
```

The bump script updates the three provider plugin manifests, `consensus-refine` skill metadata, and any marketplace `version` fields that are already present. It does not add version fields to marketplace schemas that omit them.

Before pushing a release tag, verify the tag and manifests match:

```bash
node scripts/bump-version.mjs --check-tag v0.1.0
```

The structural validator enforces provider manifest consistency during normal development; the release workflow also checks the pushed tag against provider manifests, `consensus-refine` skill metadata, and present marketplace version fields.
