# Plugin Layout Spike Evidence

Date: 2026-07-07
Phase: p01
Purpose: decide whether Consensus generated runtime output can be shared from
`plugins/consensus/scripts/` and imported by skill wrappers beside
`plugins/consensus/skills/`.

## Source Starting Points

- `plugins/consensus/README.md`: local install/load commands for Claude Code,
  Codex, and Cursor Agent; v0.1 provider-support caveats.
- `RELEASING.md`: provider install/load verification is a release checklist
  gate.
- Local CLI help checked for `claude plugin --help`, `codex plugin --help`,
  `cursor agent --help`, `cursor-agent --help`, `copilot --help`, and
  `gh copilot --help`.
- GitHub Copilot CLI primary docs checked for plugin install, local-path
  install, marketplace, plugin structure, and installed plugin file locations.
- Current wrapper baseline: generated wrappers import local
  `./consensus-loop.mjs`; generated loop files resolve the plugin-local CLI via
  `../../../scripts/consensus.mjs`, then fall back to
  `~/.consensus/consensus.mjs`.

## Evidence Table Fields

Each provider table records:

| Field | Meaning |
| ----- | ------- |
| Command/discovery step | Exact command or primary-doc lookup used. |
| Installed or local-load plugin root | Root path inspected or expected. |
| `plugins/consensus/scripts/` preserved beside `skills/` | Whether the plugin-level scripts directory exists beside the skills directory in the tested layout. |
| Wrapper import path tested | Path a generated wrapper would use from `skills/<name>/scripts/`. |
| Status | `pass`, `fail`, or `blocked`. |
| Notes | Caveats and source evidence. |

## Claude Code

Planned command/discovery sequence:

```bash
claude plugin --help
claude plugin marketplace --help
claude plugin list
claude plugin details consensus
ls -la ~/.claude/plugins ~/.claude/plugins/cache
find ~/.claude/plugins -path '*consensus*' -maxdepth 8 -print
```

| Command/discovery step | Installed or local-load plugin root | `plugins/consensus/scripts/` preserved beside `skills/` | Wrapper import path tested | Status | Notes |
| ---------------------- | ----------------------------------- | ------------------------------------------------------- | -------------------------- | ------ | ----- |
| Pending p01-t02 live check | Pending | Pending | `../../../scripts/consensus-loop.mjs` | pending | README starts from `claude plugin marketplace add "$PWD" --scope user`, `claude plugin install consensus@skills --scope user`, and `claude plugin details consensus`. |

## Codex

Planned command/discovery sequence:

```bash
codex plugin --help
codex plugin marketplace list
codex plugin list
ls -la ~/.codex/plugins/cache/skills/consensus/0.1.0
test -d ~/.codex/plugins/cache/skills/consensus/0.1.0/scripts
```

| Command/discovery step | Installed or local-load plugin root | `plugins/consensus/scripts/` preserved beside `skills/` | Wrapper import path tested | Status | Notes |
| ---------------------- | ----------------------------------- | ------------------------------------------------------- | -------------------------- | ------ | ----- |
| Pending p01-t02 live check | Pending | Pending | `../../../scripts/consensus-loop.mjs` | pending | README starts from `codex plugin marketplace add "$PWD"`, `codex plugin add consensus --marketplace skills`, and `codex plugin list`. |

## Cursor Agent

Planned command/discovery sequence:

```bash
cursor agent --help
cursor-agent --help
test -d plugins/consensus/scripts
test -d plugins/consensus/skills
```

| Command/discovery step | Installed or local-load plugin root | `plugins/consensus/scripts/` preserved beside `skills/` | Wrapper import path tested | Status | Notes |
| ---------------------- | ----------------------------------- | ------------------------------------------------------- | -------------------------- | ------ | ----- |
| Pending p01-t02 live check | `plugins/consensus` local load | Pending | `../../../scripts/consensus-loop.mjs` | pending | README says Cursor Agent local plugin loading is session-scoped with `cursor agent --plugin-dir "$PWD/plugins/consensus"`; no Cursor marketplace install is claimed. |

## Copilot

Planned command/discovery sequence:

```bash
copilot --help
gh copilot --help
gh copilot -- --help
```

Primary-doc checks:

- GitHub Copilot CLI plugin install/reference docs for `copilot plugin install`.
- GitHub Copilot CLI plugin creation docs for plugin root and `skills/`.
- GitHub Copilot CLI marketplace docs for local filesystem marketplaces.
- GitHub Copilot CLI plugin reference docs for installed plugin file locations.

| Command/discovery step | Installed or local-load plugin root | `plugins/consensus/scripts/` preserved beside `skills/` | Wrapper import path tested | Status | Notes |
| ---------------------- | ----------------------------------- | ------------------------------------------------------- | -------------------------- | ------ | ----- |
| Pending p01-t02 live/doc check | Pending | Pending | `../../../scripts/consensus-loop.mjs` | pending | Local `copilot` binary is not in PATH; `gh copilot` is the available launcher. p01-t02 will record whether local installation is possible or blocked in this environment. |

## standalone recovery

Planned command/discovery sequence:

```bash
pnpm exec vitest run \
  tests/consensus/core/resolve-consensus-cli-path.test.ts \
  tests/consensus/provider-cli/missing-cli-message.test.ts
```

| Command/discovery step | Installed or local-load plugin root | `plugins/consensus/scripts/` preserved beside `skills/` | Wrapper import path tested | Status | Notes |
| ---------------------- | ----------------------------------- | ------------------------------------------------------- | -------------------------- | ------ | ----- |
| Pending p01-t02 focused tests | Simulated standalone skill install | N/A for single-skill install | Plugin CLI fallback to `~/.consensus/consensus.mjs` | pending | PR #38 recovery must remain actionable if a standalone single-skill install lacks the plugin-local CLI. |

## Go/no-go

Recommendation: pending p01-t03.

Required checkpoint: stop after p01-t03 for the configured go/no-go decision
before Phase 2 changes any generated-output mappings.
