---
title: 'Configuration'
description: 'Shared consensus configuration: peer and panelist selection, default config paths, precedence, cold starts, the provider floor, preflight diagnostics, synthesizer, agency, Cursor auth, and required permissions.'
---

# Configuration

Configuration shared by [`create`](create.md), [`decide`](decide.md),
[`plan`](plan.md), [`refine`](refine.md), [`evaluate`](evaluate.md), and
[`panel`](panel.md).
For the full reference, see the
[consensus plugin README](https://github.com/tkstang/skills/blob/main/plugins/consensus/README.md).

## Config paths and precedence

The generated provider CLI owns default composition through `consensus config`.
Defaults are stored in JSON config files:

- User config: `${XDG_CONFIG_HOME:-$HOME/.config}/consensus/config.json`.
- Project config: `<project root>/.consensus/config.json`, resolved from the
  invocation cwd or `--cwd`.

Effective composition is resolved in this order:

1. Invocation flags such as `--peers`, `--panelists`, and `--panel-size`.
2. Project config from `.consensus/config.json`.
3. User config from `.config/consensus/config.json` or `XDG_CONFIG_HOME`.
4. Built-in defaults.

Inspect defaults with:

```bash
consensus config get --json --scope effective
consensus config get --json --scope effective --workflow panel
consensus config list --json
```

Set or clear defaults with:

```bash
consensus config set --json --scope user --peers claude,codex
consensus config set --json --scope project --panelists claude,codex,cursor --panel-size 3
consensus config clear --json --scope project --key panelists
```

From a repository checkout, run the same commands through
`plugins/consensus/scripts/consensus.mjs` with `node`.

## Peer selection

By default, host detection chooses `claude,codex` on Claude Code and Cursor, and
`codex,claude` on Codex. Override peers with `--peers`:

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md --peers claude,codex
```

Converging workflows always resolve exactly two peers. `--peers` has precedence
over project config, user config, and built-in defaults.

## Panelist selection

[`panel`](panel.md) resolves at least two provider-backed panelists. Override
panelists for one run with `--panelists`:

```bash
node plugins/consensus/skills/panel/scripts/consensus-panel.mjs \
  --question "What risks should we inspect?" \
  --panelists claude,codex
```

Set a target size with `--panel-size`:

```bash
node plugins/consensus/skills/panel/scripts/consensus-panel.mjs \
  --question-file question.md \
  --panel-size 3
```

`--panelists` must list at least two provider ids. `--panel-size` must be 2 or
larger. If `--panel-size` is smaller than the configured panelist list, the first
N configured panelists are selected. If it is larger, the resolver appends ready
providers from inventory order when possible.

## Provider floor, inventory, and preflight

Peer IDs come from provider inventory. The first supported provider floor is
`claude`, `codex`, and `cursor`; future providers are extension points, not v0.1
support claims. Requested peers must be present and usable in provider inventory
and preflight before live use:

```bash
consensus provider ls --json
consensus preflight --json --provider claude
```

From a repository checkout the same provider CLI lives at
`plugins/consensus/scripts/consensus.mjs` and can be run with `node`:

```bash
node plugins/consensus/scripts/consensus.mjs provider ls --json
node plugins/consensus/scripts/consensus.mjs preflight --json
```

## Diagnostics

The wrappers surface provider-neutral diagnostics when a requested peer cannot be
used:

- `PROVIDER_MISSING`
- `PROVIDER_AUTH_REQUIRED`
- `PROVIDER_UNAVAILABLE`
- `PROVIDER_UNSUPPORTED_OPTION`

## Synthesizer

In `parallel_synthesized` mode the synthesis call defaults to the first
configured peer's provider. Override it with `--synthesizer <provider-id>` to run
routine merging on a cheaper model; the provider must be present and usable in the
provider inventory or preflight fails (`SYNTHESIZER_UNAVAILABLE`). The flag is
warned-and-ignored outside `parallel_synthesized` mode.

## Cold starts

`create`, `decide`, and `plan` default to
`--cold-start independent_draft`: in round 1 each peer drafts from the brief,
options, or goal/constraints before the deliberation converges. `refine` and
`evaluate` remain `shared_input` only because they operate on an existing draft
or artifact.

## Agency

`--agency` controls who resolves a stuck section. At `minimal` agency, unresolved
peer disagreement is surfaced to the user rather than silently decided; this is
the default for `evaluate`. Escalations are routed by `--agency` to the user or
the host (see [Refine → Escalation](refine.md#escalation)).

## Cursor auth

Cursor is included in the provider floor, but local auth state is still
operator-owned. If inventory or preflight reports Cursor as `auth_required`,
unlock the OS keychain or authenticate the Cursor CLI in the current user session
before retrying. Cursor submit-tool support is reserved for a later acceptance
path and is not selected by default.

## Permissions

The consensus `create`, `decide`, `plan`, `refine`, and `evaluate` skills need
permission to run:

- `node` for the wrapper and loop scripts.
- `consensus` for provider inventory/preflight when exposed as a command.
- read/write access to input files, generated `.consensus/` run state, and output
  artifacts.

Refine parallel section mode additionally requires host-native subagent dispatch.
Codex authorization must fail closed: if dispatch approval is unavailable or
denied, the host should report that parallel mode did not run.
