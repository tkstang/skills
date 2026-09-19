---
title: 'Installation'
description: 'Install the consensus or session plugin, choose optional standalone skill forms, and check prerequisites and release evidence.'
---

# Installation

The supported development path is **local marketplace installation from this
checkout**. The repo root contains provider marketplace entries for two
independently versioned plugins:

- `consensus` — peer workflows plus plugin-local `observer` and
  `observer-collab`.
- `session` — plugin-local `messaging`, `retro`, `handoff`,
  `export-transcript`, and `fork-to-destination`.

Run the commands below from the repository root. Choose a plugin or a declared
standalone form; installing both forms of the same skill may expose duplicate
host entries, and co-installation has not been verified across providers.

> Published Git / marketplace discovery (e.g. skills.sh) is not a release claim
> until indexing is verified after publication; local install is the supported
> v0.1 path.

## Install matrix

### Claude Code

```bash
claude plugin marketplace add "$PWD" --scope user
claude plugin install consensus@skills --scope user
claude plugin details consensus

# Session is a separate install and release boundary.
claude plugin install session@skills --scope user
claude plugin details session
```

### Codex

```bash
codex plugin marketplace add "$PWD"
codex plugin add consensus --marketplace skills
codex plugin list | rg 'consensus@skills'

# Session is a separate install and release boundary.
codex plugin add session --marketplace skills
codex plugin list | rg 'session@skills'
```

### Cursor Agent

```bash
cursor agent --plugin-dir "$PWD/plugins/consensus"
# or load the session plugin for that run:
cursor agent --plugin-dir "$PWD/plugins/session"
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

The session plugin has passed static packaging and isolated export execution.
Its live provider discovery and permission behavior remain unverified, so these
commands are local release-candidate instructions rather than a published
availability claim.

> If `skills` is already configured as a marketplace from a different local
> checkout, provider CLIs may reject adding this checkout under the same
> marketplace name. Remove or update the existing local marketplace first.

## Prerequisites

- Node.js 22 or newer.
- Consensus plugin only: the generated consensus CLI from this plugin, used for
  provider inventory, preflight, and peer invocation.
- Consensus plugin only: local provider CLIs for the requested peers. The first
  supported provider floor is `claude`, `codex`, and `cursor`.
- `observer-collab` / `session-observer-collab`: the `session-observer`
  workflow must be present, either as standalone `session-observer` or as the
  consensus plugin-local `observer`. The collaboration skill checks the local
  inventory and stops with the canonical install link when neither identity is
  available; it never installs the dependency automatically.

The consensus wrappers always invoke peers through the generated provider CLI.
There is no alternate backend selector in v0.1.

Shared TypeScript/runtime imports are a packaging concern rather than an
installed-skill prerequisite. The build materializes each skill's shared runtime
closure into its standalone or plugin installation unit, so installed payloads
do not import a sibling skill, this checkout, or developer dependencies.

## Install one standalone skill

### First-party installer

The first-party installer requires Node.js 22 or newer and Git. It reads only
the generated `skills/<name>/` payload at the exact tag selected by `--ref`.
The default repository is `https://github.com/tkstang/skills.git`; an optional
`--repository` accepts another Git URL or a local tagged repository.

`--skill`, `--agent`, `--scope`, and `--ref` are required. There is no default
scope. Project scope writes beneath your physical current directory; user
scope writes beneath `HOME`.

`v0.1.2` is the planned pinned example below. These commands become usable
once a release contains the helper and current generated payloads. They do not
claim that this tag has been published or tested live. Use that release's
checkout, including both `install.sh` and `scripts/install-standalone.mjs`:

```bash
mkdir skills-installer
git -C skills-installer init --quiet
git -C skills-installer remote add origin https://github.com/tkstang/skills.git
git -C skills-installer fetch --no-tags --depth=1 origin refs/tags/v0.1.2
git -C skills-installer checkout --detach --quiet 'FETCH_HEAD^{commit}'
INSTALLER="$PWD/skills-installer/install.sh"
cd /path/to/your/project
```

Choose one command for the host and scope you intend to install. For project
scope, run it from the project that should receive the skill:

```bash
bash "$INSTALLER" --skill next-steps --agent codex --scope project --ref v0.1.2
bash "$INSTALLER" --skill next-steps --agent claude-code --scope project --ref v0.1.2
bash "$INSTALLER" --skill next-steps --agent cursor --scope project --ref v0.1.2
```

User scope is a deliberate operator action that writes to the selected host's
directory under your real `HOME`. Choose it only when you want the skill
available across projects:

```bash
bash "$INSTALLER" --skill next-steps --agent codex --scope user --ref v0.1.2
bash "$INSTALLER" --skill next-steps --agent claude-code --scope user --ref v0.1.2
bash "$INSTALLER" --skill next-steps --agent cursor --scope user --ref v0.1.2
```

| Host        | Directory beneath the selected root | Printed invocation                          |
| ----------- | ----------------------------------- | ------------------------------------------- |
| Codex       | `.agents/skills/next-steps/`        | `$next-steps`                               |
| Claude Code | `.claude/skills/next-steps/`        | `/next-steps`                               |
| Cursor      | `.cursor/skills/next-steps/`        | `next-steps`, with skill inventory guidance |

The installer writes only the selected provider directory. It does not create
cross-provider mirrors or run `oat sync`. It requires a generated `SKILL.md`
and copies the whole payload, including runtime and resources. It never falls
back to `src/skills/` and never builds or executes the selected source.

An existing destination is refused, including a symlink or a previous partial
install. Symlinked provider ancestors are also refused. There is no update,
force, merge, or automatic replacement mode. A failure after reserving a new
destination retains the partial directory with `.standalone-install-incomplete`
and reports its path. Inspect that exact directory and preserve anything you
need before deliberately moving or removing it to retry. The installer never
automatically deletes a partial destination.

Success reports the selected tag, scope, verified path, and invocation. The
installer resolves the exact tag and verifies copy fidelity by comparing every
payload path, SHA-256 of its bytes, and executable mode. This is not signed-tag
verification or independent release attestation. It also does not prove
fresh-session discovery or live behavior. Start a fresh host session, check
its skill inventory, and try the bounded request in
[Getting Started](getting-started/index.md) when live verification is authorized.

Automated installer tests use local tagged repositories, temporary project
roots, and a temporary `HOME`. Real user-level installation and live host
acceptance require separate operator authorization; passing these tests does
not perform either step.

### Skills CLI

Run this from the project where you want the skill available. This example
installs the generated Next Steps payload for Codex:

```bash
npx skills add https://github.com/tkstang/skills/tree/main/skills/next-steps --agent codex
```

Use `--agent claude-code` or `--agent cursor` for those hosts. The
[Skills CLI](https://github.com/vercel-labs/skills#install-a-skill) defaults to
project scope; review the installer confirmation and avoid `--global` unless
you want a user-wide install. This direct source URL does not depend on a
skills.sh search listing.

For a local checkout, replace the URL with the absolute path to the generated
payload, such as `/path/to/skills/skills/next-steps`. Do not install from
`src/skills/`: executable owners need their generated runtime and resources.

Verify the installer lists the intended skill and target agent, then start a
fresh agent session and check its skill inventory. Try the bounded request in
[Getting Started](getting-started/index.md). A successful file install alone
does not establish fresh-session discovery or live workflow behavior.

## Standalone catalog

Only skills explicitly declared for standalone output have a generated directory
under `skills/`:

| Canonical standalone name     | Plugin-local form             | Source link                                                                                         |
| ----------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `agent-messaging`             | session `messaging`           | [standalone source](https://github.com/tkstang/skills/tree/main/skills/agent-messaging)             |
| `next-steps`                  | none                          | [standalone source](https://github.com/tkstang/skills/tree/main/skills/next-steps)                  |
| `must-we`                     | none                          | [standalone source](https://github.com/tkstang/skills/tree/main/skills/must-we)                     |
| `session-retro`               | session `retro`               | [standalone source](https://github.com/tkstang/skills/tree/main/skills/session-retro)               |
| `session-observer`            | consensus `observer`          | [standalone source](https://github.com/tkstang/skills/tree/main/skills/session-observer)            |
| `session-observer-collab`     | consensus `observer-collab`   | [standalone source](https://github.com/tkstang/skills/tree/main/skills/session-observer-collab)     |
| `session-handoff`             | session `handoff`             | [standalone source](https://github.com/tkstang/skills/tree/main/skills/session-handoff)             |
| `session-export-transcript`   | session `export-transcript`   | [standalone source](https://github.com/tkstang/skills/tree/main/skills/session-export-transcript)   |
| `session-fork-to-destination` | session `fork-to-destination` | [standalone source](https://github.com/tkstang/skills/tree/main/skills/session-fork-to-destination) |
| `complexity-review`           | none                          | [standalone source](https://github.com/tkstang/skills/tree/main/skills/complexity-review)           |
| `consensus-review`            | consensus `review`            | [standalone source](https://github.com/tkstang/skills/tree/main/skills/consensus-review)            |

Qualified invocation syntax depends on the host. Claude Code and Codex include
the plugin namespace; Cursor's local `--plugin-dir` load exposes the local name
without a universal namespace promise.

## Updating an install

Claude Code and Codex install this repo as a **local directory marketplace**, so
each installed plugin tracks your checkout rather than a published release.
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
node plugins/consensus/scripts/consensus.mjs preflight --json --provider <selected-provider-id> --capability run
```

In an installed plugin environment, the same provider CLI may be exposed as
`consensus` — for example `consensus provider ls --json` and
`consensus preflight --json --provider <selected-provider-id> --capability run`.

Next: head to [Consensus](consensus/index.md) to run peer workflows and the
plugin-local observer skills, or [Skills](skills/index.md) for the session plugin
map and standalone forms.
