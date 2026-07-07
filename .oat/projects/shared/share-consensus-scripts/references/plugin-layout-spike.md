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

Provider status: Claude Code pass.

Command/discovery sequence:

```bash
claude plugin --help
claude plugin marketplace --help
claude plugin list
claude plugin details consensus
cat ~/.claude/plugins/installed_plugins.json
find ~/.claude/plugins -path '*consensus*' -maxdepth 8 -print
test -d ~/.claude/plugins/cache/skills/consensus/0.1.0/scripts
test -d ~/.claude/plugins/cache/skills/consensus/0.1.0/skills
node -e 'new URL("../../../scripts/consensus.mjs", wrapper)'
```

| Command/discovery step | Installed or local-load plugin root | `plugins/consensus/scripts/` preserved beside `skills/` | Wrapper import path tested | Status | Notes |
| ---------------------- | ----------------------------------- | ------------------------------------------------------- | -------------------------- | ------ | ----- |
| `claude plugin details consensus`; `find ~/.claude/plugins -path '*consensus*' -maxdepth 8 -print`; directory tests | `/Users/tstang/.claude/plugins/cache/skills/consensus/0.1.0` | Yes. `scripts/` and `skills/` are siblings in the installed cache. | `../../../scripts/consensus.mjs` resolves to the installed plugin-local CLI; `../../../scripts/consensus-loop.mjs` resolves to the same plugin-local `scripts/` directory for the proposed shared loop. | pass | `claude plugin details consensus` reports `consensus@skills` enabled with 7 skills and 1 agent. `installed_plugins.json` records install path `/Users/tstang/.claude/plugins/cache/skills/consensus/0.1.0`; marketplace `skills` currently points at `/Users/tstang/Code/skills`, not this worktree. |

## Codex

Provider status: Codex pass.

Command/discovery sequence:

```bash
codex plugin --help
codex plugin marketplace list
codex plugin list
ls -la ~/.codex/plugins/cache/skills/consensus/0.1.0
test -d ~/.codex/plugins/cache/skills/consensus/0.1.0/scripts
test -d ~/.codex/plugins/cache/skills/consensus/0.1.0/skills
node -e 'new URL("../../../scripts/consensus.mjs", wrapper)'
```

| Command/discovery step | Installed or local-load plugin root | `plugins/consensus/scripts/` preserved beside `skills/` | Wrapper import path tested | Status | Notes |
| ---------------------- | ----------------------------------- | ------------------------------------------------------- | -------------------------- | ------ | ----- |
| `codex plugin marketplace list`; `codex plugin list`; cache tree and directory tests | `/Users/tstang/.codex/plugins/cache/skills/consensus/0.1.0` (runtime cache); `/Users/tstang/Code/skills/plugins/consensus` (configured `skills` marketplace source) | Yes. `scripts/` and `skills/` are siblings in the runtime cache. | `../../../scripts/consensus.mjs` resolves to the installed plugin-local CLI; `../../../scripts/consensus-loop.mjs` resolves to the same plugin-local `scripts/` directory for the proposed shared loop. | pass | `codex plugin list` reports `consensus@skills` installed/enabled from the configured local marketplace. The configured marketplace is `/Users/tstang/Code/skills`, so this spike did not disrupt the user-level marketplace to point at the current worktree. |

## Cursor Agent

Provider status: Cursor Agent pass.

Command/discovery sequence:

```bash
cursor agent --help
cursor-agent --help
cursor agent --version
cursor-agent --version
test -d plugins/consensus/scripts
test -d plugins/consensus/skills
node -e 'new URL("../../../scripts/consensus.mjs", wrapper)'
```

| Command/discovery step | Installed or local-load plugin root | `plugins/consensus/scripts/` preserved beside `skills/` | Wrapper import path tested | Status | Notes |
| ---------------------- | ----------------------------------- | ------------------------------------------------------- | -------------------------- | ------ | ----- |
| `cursor agent --help`; `cursor-agent --help`; local root directory tests | `/Users/tstang/Code/share-consensus-scripts/plugins/consensus` via `cursor agent --plugin-dir "$PWD/plugins/consensus"` | Yes. The local-load root itself contains sibling `scripts/` and `skills/`. | `../../../scripts/consensus.mjs` resolves to the plugin-local CLI; `../../../scripts/consensus-loop.mjs` resolves to the same plugin-local `scripts/` directory for the proposed shared loop. | pass | Cursor Agent version `2026.07.01-41b2de7`; help exposes `--plugin-dir <path>` as a repeatable local plugin directory. No interactive Cursor model session was launched in this evidence phase. |

## Copilot

Provider status: Copilot pass.

Command/discovery sequence:

```bash
copilot --help
gh copilot --help
gh copilot -- --help
HOME="$(mktemp -d)/home" npm_config_cache="$(mktemp -d)/npm-cache" npx -y @github/copilot --help
HOME="$tmp/home" npm_config_cache="$tmp/npm-cache" npx -y @github/copilot plugin --help
HOME="$tmp/home" npm_config_cache="$tmp/npm-cache" npx -y @github/copilot plugin install "$PWD/plugins/consensus"
find "$tmp/home/.copilot/installed-plugins" -maxdepth 5 -print
```

Primary-doc checks:

- GitHub Copilot CLI plugin install/reference docs for `copilot plugin install`.
- GitHub Copilot CLI plugin creation docs for plugin root and `skills/`.
- GitHub Copilot CLI marketplace docs for local filesystem marketplaces.
- GitHub Copilot CLI plugin reference docs for installed plugin file locations.

| Command/discovery step | Installed or local-load plugin root | `plugins/consensus/scripts/` preserved beside `skills/` | Wrapper import path tested | Status | Notes |
| ---------------------- | ----------------------------------- | ------------------------------------------------------- | -------------------------- | ------ | ----- |
| Primary docs; `gh copilot --help`; isolated `npx -y @github/copilot`; temporary-HOME local install | `/var/folders/fp/rnl_nlcj5ngfqfh8nb92vktr0000gn/T/tmp.o66VF6HrRc/home/.copilot/installed-plugins/_direct/consensus` | Yes. Isolated direct install copied sibling `scripts/` and `skills/`; install output: `Plugin "consensus" installed successfully. Installed 7 skills.` | `../../../scripts/consensus.mjs` resolves to the installed plugin-local CLI; `../../../scripts/consensus-loop.mjs` resolves to the same plugin-local `scripts/` directory for the proposed shared loop. | pass | `copilot` is not installed in PATH, and `gh copilot -- --help` reports `Copilot CLI not installed`. Isolated npm-run CLI help exposes `--plugin-dir <directory>` and `copilot plugin install`. The direct local install path works today but warns it is deprecated; marketplace install should be the durable release path for Copilot. Primary docs also state local path install and installed plugin file locations under `~/.copilot/installed-plugins`. |

## standalone recovery

Provider status: standalone recovery pass.

Command/discovery sequence:

```bash
pnpm exec vitest run \
  tests/consensus/core/resolve-consensus-cli-path.test.ts \
  tests/consensus/provider-cli/missing-cli-message.test.ts
```

| Command/discovery step | Installed or local-load plugin root | `plugins/consensus/scripts/` preserved beside `skills/` | Wrapper import path tested | Status | Notes |
| ---------------------- | ----------------------------------- | ------------------------------------------------------- | -------------------------- | ------ | ----- |
| Focused Vitest recovery tests | Simulated standalone skill install | N/A for single-skill install | Plugin CLI fallback to `~/.consensus/consensus.mjs`; shared `CONSENSUS_PROVIDER_CLI_MISSING` error | pass | `pnpm exec vitest run tests/consensus/core/resolve-consensus-cli-path.test.ts tests/consensus/provider-cli/missing-cli-message.test.ts` passed: 2 files, 6 tests. The tests cover explicit/env/plugin/shared-home resolution order, `~/.consensus/consensus.mjs` fallback, and the shared actionable missing-CLI message across wrappers. |

## Go/no-go

Recommendation: pending p01-t03.

Required checkpoint: stop after p01-t03 for the configured go/no-go decision
before Phase 2 changes any generated-output mappings.
