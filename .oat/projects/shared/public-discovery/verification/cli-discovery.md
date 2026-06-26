# CLI Discovery Verification

**Date:** 2026-06-26
**Scope:** p03-t01 - verify standalone discovery/install/run behavior and the local consensus recovery path.

## Environment

- Repository cwd: `/Users/tstang/Code/feat-public-discovery`
- Node: `v25.9.0`
- npm: `11.13.0`
- Published Skills CLI checked: `skills@1.5.13`
- HOME safety: all installs and consensus recovery checks used `mktemp` HOME, npm cache, and XDG directories under `/tmp` or `/private/tmp`.

## Summary

| Check | Result | Notes |
| ----- | ------ | ----- |
| Exact plan command `npx skills add tkstang/skills --list` | non-blocking command-form failure | From this checkout, `npx` resolves the repo's local package named `skills`, which has no bin. Version-pinning the package avoids the local package shadow. |
| Discovery list via `skills@1.5.13` | pass | `export-session-transcript`, `session-observer`, and all five consensus skills are visible. OAT tooling skills are also still visible, which is the known cat-3 deferred upstream outcome. |
| Install/run `session-observer` standalone | pass | Installed into isolated `~/.agents/skills/session-observer`; installed entrypoint `--help` exited 0. |
| Install/run `export-session-transcript` standalone | pass | Installed into isolated `~/.agents/skills/export-session-transcript`; installed entrypoint `--help` exited 0. |
| Consensus standalone missing-CLI message | pass | A copied `refine` skill without the plugin tree exits 78 with `CONSENSUS_PROVIDER_CLI_MISSING` and names the pinned installer recovery. |
| Consensus recovery after `install.sh` | pass | Checkout-mode `install.sh` wrote isolated `~/.consensus/consensus.mjs`; the copied skill resolver returned `source: "shared-home"`. |

## 1. Discovery List

### Exact plan command

Command:

```bash
tmp_home=$(mktemp -d /tmp/public-discovery-home-exact-npx.XXXXXX)
tmp_cache=$(mktemp -d /tmp/public-discovery-npm.XXXXXX)
HOME="$tmp_home" \
  npm_config_cache="$tmp_cache" \
  XDG_CONFIG_HOME="$tmp_home/.config" \
  XDG_STATE_HOME="$tmp_home/.local/state" \
  XDG_CACHE_HOME="$tmp_home/.cache" \
  CI=1 \
  DO_NOT_TRACK=1 \
  npx skills add tkstang/skills --list
```

Result: exit 1.

Output:

```text
npm error could not determine executable to run
npm error A complete log of this run can be found in: /tmp/public-discovery-npm.GYAUGw/_logs/2026-06-26T22_56_39_854Z-debug-0.log
```

Decision: non-blocking for this phase. The checkout's root `package.json` is named `skills`, so unversioned `npx skills` resolves the local package before the public CLI package from this cwd. The functional discovery check used the published package version explicitly.

### Published CLI package metadata

Command:

```bash
npm_config_cache="$(mktemp -d /tmp/public-discovery-npm.XXXXXX)" \
  npm view skills name version bin dist-tags --json
```

Output:

```json
{
  "name": "skills",
  "version": "1.5.13",
  "bin": {
    "skills": "bin/cli.mjs",
    "add-skill": "bin/cli.mjs"
  },
  "dist-tags": {
    "snapshot": "1.5.12-snapshot.2",
    "latest": "1.5.13"
  }
}
```

### Functional discovery command

Command:

```bash
tmp_home=$(mktemp -d /tmp/public-discovery-home.XXXXXX)
tmp_cache=$(mktemp -d /tmp/public-discovery-npm.XXXXXX)
HOME="$tmp_home" \
  npm_config_cache="$tmp_cache" \
  XDG_CONFIG_HOME="$tmp_home/.config" \
  XDG_STATE_HOME="$tmp_home/.local/state" \
  XDG_CACHE_HOME="$tmp_home/.cache" \
  CI=1 \
  DO_NOT_TRACK=1 \
  npx -y skills@1.5.13 add tkstang/skills --list
```

Result: exit 0.

Relevant output:

```text
Source: https://github.com/tkstang/skills.git
Repository cloned
Found 64 skills

Available Skills
  export-session-transcript
  session-observer
  ...
  create
  decide
  evaluate
  plan
  refine
```

Interpretation:

- Category 1 standalone entries are present: `session-observer`, `export-session-transcript`.
- Category 2 consensus entries are present: `create`, `decide`, `evaluate`, `plan`, `refine`.
- Category 3 OAT tooling entries are still present. This is expected before the upstream `open-agent-toolkit` `metadata.internal: true` change lands and syncs back; that hiding outcome remains deferred to `BL-260621`.

## 2. Standalone Install And Entrypoint Smoke

### session-observer

Install command:

```bash
tmp_home=$(mktemp -d /tmp/public-discovery-install-session-observer-codex.XXXXXX)
tmp_cache=$(mktemp -d /tmp/public-discovery-npm.XXXXXX)
HOME="$tmp_home" \
  npm_config_cache="$tmp_cache" \
  XDG_CONFIG_HOME="$tmp_home/.config" \
  XDG_STATE_HOME="$tmp_home/.local/state" \
  XDG_CACHE_HOME="$tmp_home/.cache" \
  CI=1 \
  DO_NOT_TRACK=1 \
  npx -y skills@1.5.13 add tkstang/skills@session-observer -g -a codex -y --copy
```

Result: exit 0.

Output snippet:

```text
Selected 1 skill: session-observer
Installation Summary
  ~/.agents/skills/session-observer
    copy -> Codex
Installed 1 skill
  yes session-observer (copied)
    -> ~/.agents/skills/session-observer
```

Entrypoint command:

```bash
HOME="/tmp/public-discovery-install-session-observer-codex.2Ocp5v" \
  XDG_CONFIG_HOME="/tmp/public-discovery-install-session-observer-codex.2Ocp5v/.config" \
  XDG_STATE_HOME="/tmp/public-discovery-install-session-observer-codex.2Ocp5v/.local/state" \
  XDG_CACHE_HOME="/tmp/public-discovery-install-session-observer-codex.2Ocp5v/.cache" \
  node /tmp/public-discovery-install-session-observer-codex.2Ocp5v/.agents/skills/session-observer/scripts/session-observer.mjs --help
```

Result: exit 0.

Output snippet:

```text
Usage: session-observer <subcommand> [options]

Subcommands:
  review     One-shot full digest of the most relevant peer session
  catch-up   Incremental: only records added since the last read
  locate     Diagnostic: ranked candidate list
  state      Manage high-water marks: get, reset, clear
  watch      Foreground watcher for debounced catch-up updates
```

### export-session-transcript

Install command:

```bash
tmp_home=$(mktemp -d /tmp/public-discovery-install-export-session-transcript.XXXXXX)
tmp_cache=$(mktemp -d /tmp/public-discovery-npm.XXXXXX)
HOME="$tmp_home" \
  npm_config_cache="$tmp_cache" \
  XDG_CONFIG_HOME="$tmp_home/.config" \
  XDG_STATE_HOME="$tmp_home/.local/state" \
  XDG_CACHE_HOME="$tmp_home/.cache" \
  CI=1 \
  DO_NOT_TRACK=1 \
  npx -y skills@1.5.13 add tkstang/skills@export-session-transcript -g -a codex -y --copy
```

Result: exit 0.

Output snippet:

```text
Selected 1 skill: export-session-transcript
Installation Summary
  ~/.agents/skills/export-session-transcript
    copy -> Codex
Installed 1 skill
  yes export-session-transcript (copied)
    -> ~/.agents/skills/export-session-transcript
```

Entrypoint command:

```bash
HOME="/tmp/public-discovery-install-export-session-transcript.38aH3S" \
  XDG_CONFIG_HOME="/tmp/public-discovery-install-export-session-transcript.38aH3S/.config" \
  XDG_STATE_HOME="/tmp/public-discovery-install-export-session-transcript.38aH3S/.local/state" \
  XDG_CACHE_HOME="/tmp/public-discovery-install-export-session-transcript.38aH3S/.cache" \
  node /tmp/public-discovery-install-export-session-transcript.38aH3S/.agents/skills/export-session-transcript/scripts/export-session-transcript.mjs --help
```

Result: exit 0.

Output snippet:

```text
export-session-transcript - export the current conversation to sanitized Markdown

Usage:
  node export-session-transcript.mjs [output-path] [flags]

Flags:
  --runtime <claude-code|codex|cursor|auto>  default: auto
  --help                this message
```

## 3. Consensus Recovery Simulation

Setup: copied `plugins/consensus/skills/refine` into `/private/tmp/public-discovery-consensus-sim.eVMCqs/plugins/consensus/skills/refine` without copying `plugins/consensus/scripts/consensus.mjs`; used isolated HOME `/private/tmp/public-discovery-consensus-home.wIvrxg`.

### Missing CLI before installer

Command:

```bash
sim_root=$(realpath /tmp/public-discovery-consensus-sim.eVMCqs)
sim_home=$(realpath /tmp/public-discovery-consensus-home.wIvrxg)
input="$sim_root/draft.md"
HOME="$sim_home" \
  XDG_CONFIG_HOME="$sim_home/.config" \
  XDG_STATE_HOME="$sim_home/.local/state" \
  XDG_CACHE_HOME="$sim_home/.cache" \
  CONSENSUS_CLI_PATH= \
  node "$sim_root/plugins/consensus/skills/refine/scripts/consensus-refine.mjs" "$input" --goal "smoke recovery path"
```

Result: exit 78.

Output:

```text
{"event":"error","code":"CONSENSUS_PROVIDER_CLI_MISSING","exit_code":78,"message":"Consensus provider CLI is missing. Install the consensus plugin, or run the pinned install.sh installer from the README alternative-install section to provision ~/.consensus/consensus.mjs.","details":{"attemptedPaths":["/private/tmp/public-discovery-consensus-sim.eVMCqs/plugins/consensus/scripts/consensus.mjs","/private/tmp/public-discovery-consensus-home.wIvrxg/.consensus/consensus.mjs"]}}
Consensus provider CLI is missing. Install the consensus plugin, or run the pinned install.sh installer from the README alternative-install section to provision ~/.consensus/consensus.mjs.
EXIT=78
```

### Recovery after checkout-mode `install.sh`

Command:

```bash
sim_root=$(realpath /tmp/public-discovery-consensus-sim.eVMCqs)
sim_home=$(realpath /tmp/public-discovery-consensus-home.wIvrxg)
HOME="$sim_home" \
  XDG_CONFIG_HOME="$sim_home/.config" \
  XDG_STATE_HOME="$sim_home/.local/state" \
  XDG_CACHE_HOME="$sim_home/.cache" \
  bash install.sh

HOME="$sim_home" node --input-type=module -e 'import path from "node:path"; const simRoot = process.argv[1]; const home = process.argv[2]; const mod = await import(path.join(simRoot, "plugins/consensus/skills/refine/scripts/consensus-loop.mjs")); const defaultCliPath = path.join(simRoot, "plugins/consensus/scripts/consensus.mjs"); const result = mod.resolveConsensusCliPathDetails({ env: { HOME: home }, defaultCliPath }); console.log(JSON.stringify(result, null, 2));' "$sim_root" "$sim_home"
```

Result: install exit 0; resolver exit 0.

Output:

```text
Installed consensus provider CLI to /private/tmp/public-discovery-consensus-home.wIvrxg/.consensus/consensus.mjs
{
  "status": "resolved",
  "source": "shared-home",
  "path": "/private/tmp/public-discovery-consensus-home.wIvrxg/.consensus/consensus.mjs"
}
SHARED_EXISTS=yes
```

Conclusion: pre-merge local simulation demonstrates the intended standalone consensus recovery path without touching the real `HOME`.
