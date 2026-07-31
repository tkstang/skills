---
title: 'Installation'
description: 'Install the consensus plugin per provider, check prerequisites, and recover standalone consensus skill installs.'
---

# Installation

The v0.1 install path is **local marketplace installation from this checkout**.
The repo root contains the provider marketplace entries, and `plugins/consensus/`
contains the provider plugin manifests. Run the commands below from the
repository root.

> Published Git / marketplace discovery (e.g. skills.sh) is not a release claim
> until indexing is verified after publication; local install is the supported
> v0.1 path.

## Install matrix

### Claude Code

```bash
claude plugin marketplace add "$PWD" --scope user
claude plugin install consensus@skills --scope user
claude plugin details consensus
```

### Codex

```bash
codex plugin marketplace add "$PWD"
codex plugin add consensus --marketplace skills
codex plugin list | rg 'consensus@skills'
```

### Cursor Agent

```bash
cursor agent --plugin-dir "$PWD/plugins/consensus"
```

`--plugin-dir` is session-scoped: the plugin loads for that run only, and
nothing is written under `~/.cursor/`. (`cursor agent`, `cursor-agent`, and
`agent` are interchangeable entry points.)

Cursor Agent does expose `cursor agent plugin marketplace add|list|remove|update`,
but `add` indexes a **git repository URL**, not a local path — so the `"$PWD"`
local-marketplace pattern used for Claude Code and Codex does not apply here.
Adding a marketplace only makes the plugin discoverable; there is no
`plugin install` verb on the CLI, and installing is done from the interactive
plugin picker.

Cursor Agent also lists plugins that **Claude Code** has enabled, tagged
`(Claude Code)` and matching the `enabledPlugins` entries in
`~/.claude/settings.json`. On a machine where consensus is installed for Claude
Code, Cursor Agent picks it up with no separate Cursor install and no
`--plugin-dir` flag. Observed against Cursor Agent 2026.07.23; treat it as
current behavior rather than a guaranteed contract, and prefer `--plugin-dir`
on machines without a Claude Code install.

> If `skills` is already configured as a marketplace from a different local
> checkout, provider CLIs may reject adding this checkout under the same
> marketplace name. Remove or update the existing local marketplace first.

## Prerequisites

- Node.js 22 or newer.
- Consensus plugin only: the generated consensus CLI from this plugin, used for
  provider inventory, preflight, and peer invocation.
- Consensus plugin only: local provider CLIs for the requested peers. The first
  supported provider floor is `claude`, `codex`, and `cursor`.

The consensus wrappers always invoke peers through the generated provider CLI.
There is no alternate backend selector in v0.1.

## Updating an install

Claude Code and Codex install this repo as a **local directory marketplace**, so
the installed plugin tracks your checkout rather than a published release.
Updating is a pull, followed by restarting the provider CLI to reload:

```bash
git -C /path/to/skills pull
```

For Claude Code, `~/.claude/settings.json` records only the enabled plugin and a
`{"source": "directory", "path": ...}` marketplace pointer. There is no copied
plugin tree under `~/.claude/`, so the pull _is_ the update.

Two commands look like they should do this job and do not:

- `claude plugin update consensus@skills` compares the plugin manifest version
  in `plugins/consensus/.claude-plugin/plugin.json`. That version tracks
  releases, not individual skill `SKILL.md` version bumps, so the command can
  report `already at the latest version (0.1.0)` while the checkout genuinely
  contains newer skill content. It also requires the qualified
  `consensus@skills` id — a bare `consensus` fails with `Plugin not found`.
- `claude plugin marketplace update skills` re-validates the marketplace
  manifest. That matters for git-backed marketplaces; for a directory source it
  fetches nothing.

Neither is harmful, but neither is the signal. Use the pull.

## Standalone consensus recovery

Use the full consensus plugin install when possible. If a consensus skill was
installed standalone through skills.sh without the plugin tree, the wrapper will
look for a shared provider CLI at `~/.consensus/consensus.mjs`. Provision it with
the pinned installer:

```bash
curl -fsSL https://raw.githubusercontent.com/tkstang/skills/v0.1.2/install.sh | bash
```

The remote one-liner becomes usable once `v0.1.2` is released. Before that tag
exists, run the installer from a clone instead:

```bash
bash install.sh
```

Checkout mode copies `plugins/consensus/scripts/consensus.mjs` into
`~/.consensus/consensus.mjs` without network access. Re-run the installer after
updating the checkout if the consensus runtime changes.

## Check provider readiness

Check provider inventory and readiness before an expensive run:

```bash
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json
```

In an installed plugin environment, the same provider CLI may be exposed as
`consensus` — for example `consensus provider ls --json` and
`consensus preflight --json`.

Next: head to [Consensus](consensus/index.md) to run the consensus workflows,
including `phone-a-friend`, or the standalone [Skills](skills/index.md).
