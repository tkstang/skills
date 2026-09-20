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
each installed plugin tracks your checkout rather than a published release. A
pull is the first step, but on its own it does not change what a provider loads:

```bash
git -C /path/to/skills pull
```

What the pull is enough for depends on how the plugin was installed:

- **Marketplace installs** (Claude Code, Codex, and Cursor marketplace entries)
  copy the plugin tree into a per-provider cache and pin that copy. These need
  the explicit refresh commands below.
- **Cursor `--plugin-dir`** loads from your checkout for that run only and
  writes nothing under `~/.cursor/`, so the pull is the whole update — just
  start a new run.
- **Cursor picking up a Claude Code-enabled plugin** has no separate Cursor
  install; refreshing it is the Claude Code procedure below.

Restart the provider CLI after any refresh so the new copy is loaded.

### Claude Code

Claude Code copies the plugin to
`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` and records the
resolved commit in `~/.claude/plugins/installed_plugins.json`:

```json
"consensus@skills": [
  {
    "scope": "user",
    "installPath": "~/.claude/plugins/cache/skills/consensus/0.2.0",
    "version": "0.2.0",
    "gitCommitSha": "be6cab1e85..."
  }
]
```

Because that copy is pinned to a commit, the pull alone leaves the running
plugin untouched. Refresh each plugin explicitly:

```bash
claude plugin update consensus@skills
claude plugin update session@skills
```

`claude plugin update` compares the **plugin manifest version** in
`plugins/<plugin>/.claude-plugin/plugin.json`, not individual skill `SKILL.md`
versions. When skills changed but the plugin release version did not, it
reports `already at the latest version` and keeps the stale copy. There is no
`--force`; reinstall to re-copy at the current checkout:

```bash
claude plugin uninstall consensus@skills --keep-data
claude plugin install consensus@skills
```

`--keep-data` matters: without it, uninstalling the last installation of a
plugin also deletes its persistent data directory at
`~/.claude/plugins/data/{id}/`. Pass it whenever you are uninstalling only to
force a content refresh. On a CLI old enough to lack the flag, back that
directory up first.

Qualified `consensus@skills` ids are used above so the selection is
unambiguous. A bare `consensus` also resolves on Claude Code 2.1.278 when
exactly one installed marketplace entry matches; it fails only when the name is
ambiguous or absent.

Superseded version directories are left behind under
`~/.claude/plugins/cache/`; removing them is optional cleanup.

`claude plugin marketplace update skills` re-validates the marketplace
manifest. That matters for git-backed marketplaces; for a directory source it
fetches nothing.

### Codex

```bash
codex plugin add consensus@skills
codex plugin add session@skills
```

Codex copies to `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/` and
prints the installed plugin root on success. A bare plugin name is rejected:
pass `<plugin>@<marketplace>`, or `--marketplace <name>`. Note that the path
column in `codex plugin list` shows the marketplace **source** directory, not
the installed copy under `~/.codex/`.

### Cursor Agent

Cursor marketplaces are **git URL** sources, so Cursor clones the repository to
`~/.cursor/plugins/marketplaces/github.com/<owner>/<repo>/<sha>/`, one directory
per resolved commit.

`plugin marketplace update` is intended to refresh that clone, and the CLI does
contain a path that resolves the remote ref before cloning. It cannot be relied
on blindly: on cursor-agent 2026.09.18-9a7762b a `skills` marketplace stayed
pinned to a clone that was roughly two months old, and `update` reported
`✓ Updated marketplace skills: 1 plugin indexed` for a manifest that declared
two plugins, leaving the second undiscoverable.

Check the reported count against the marketplace manifest after an update. When
it disagrees, or the clone directory has not moved to the expected commit,
remove and re-add the marketplace to force a fresh clone:

```bash
cursor-agent plugin marketplace remove skills
cursor-agent plugin marketplace add https://github.com/tkstang/skills
```

`add` reports how many plugins it indexed; confirm that count matches the
marketplace manifest. Because the source is a git URL, Cursor reads the
**pushed** repository rather than your local checkout — push first, then
re-add. Re-adding drops any non-default ref the original entry pinned, so
re-apply that if you relied on it.

There is no `plugin install` verb on the Cursor CLI, so install or reinstall the
refreshed plugins from the interactive picker with `/plugins`.

## Update a standalone skill

The first-party installer refuses an existing destination and has no update
mode, so refreshing a standalone skill means replacing its payload. Where a
user-level install is the canonical copy under `~/.agents/skills/<name>/` with
provider entries symlinked to it, replace that directory from the generated
payload in an updated checkout:

Stage the new payload, keep the old one as a backup, and delete that backup
only after the replacement is verified. Run it with `set -euo pipefail` so a
failed step stops the sequence instead of continuing toward the cleanup:

```bash
set -euo pipefail
name=<name>
repo=/path/to/skills

git -C "$repo" pull
test -f "$repo/skills/$name/SKILL.md"

cp -R "$repo/skills/$name" ~/.agents/skills/"$name".new
test -f ~/.agents/skills/"$name".new/SKILL.md

mv ~/.agents/skills/"$name" ~/.agents/skills/"$name".bak
mv ~/.agents/skills/"$name".new ~/.agents/skills/"$name"
test -f ~/.agents/skills/"$name"/SKILL.md

ln -sfn "../../.agents/skills/$name" ~/.claude/skills/"$name"
```

Now confirm the installed version is the one you expect:

```bash
sed -n 's/^  version: *.\(.*\).$/\1/p' ~/.agents/skills/"$name"/SKILL.md | head -1
```

Only then remove the backup:

```bash
rm -rf ~/.agents/skills/"$name".bak
```

To roll back, clear the destination before restoring — a bare
`mv <name>.bak <name>` would move the backup _inside_ the new directory rather
than replace it:

```bash
rm -rf ~/.agents/skills/"$name"
mv ~/.agents/skills/"$name".bak ~/.agents/skills/"$name"
```

The two `mv` calls leave a brief window in which `~/.agents/skills/<name>` does
not exist and provider symlinks pointing at it dangle. Run the swap when no
provider session is loading skills, and re-check the symlink afterwards. If you
need to eliminate that window entirely, keep payloads in versioned directories
and make `~/.agents/skills/<name>` a symlink you repoint atomically — that is a
different install layout than the one described here.

This replaces the directory wholesale, so any local edits inside an installed
payload are lost — copy them out first. Copy from the generated
`skills/<name>/` payload, never `src/skills/<name>/`. Repeat the symlink for
each provider directory you mirror into, and re-run any provider view sync your
setup uses.

A renamed skill is a new directory, not an in-place upgrade: install the new
name and remove the old directory together with its provider symlinks, or the
retired name keeps resolving.

To confirm what a machine actually has, read the version out of each installed
payload:

```bash
for d in ~/.agents/skills/*/; do
  printf '%s\t' "$(basename "$d")"
  sed -n 's/^  version: *.\(.*\).$/\1/p' "$d/SKILL.md" | head -1
done
```

Compare that against the `metadata.version` values in `src/skills/*/SKILL.md`
on the branch you expect to be installed.

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
