---
title: 'Configuration'
description: 'Shared consensus configuration: peer selection, the provider floor, preflight diagnostics, synthesizer, agency, Cursor auth, and required permissions.'
---

# Configuration

Configuration shared by both [`refine`](refine.md) and [`evaluate`](evaluate.md).
For the full reference, see the
[consensus plugin README](https://github.com/tkstang/skills/blob/main/plugins/consensus/README.md).

## Peer selection

By default, host detection chooses `claude,codex` on Claude Code and Cursor, and
`codex,claude` on Codex. Override peers with `--peers`:

```bash
node plugins/consensus/skills/refine/scripts/consensus-refine.mjs draft.md --peers claude,codex
```

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

The consensus `refine` and `evaluate` skills need permission to run:

- `node` for the wrapper and loop scripts.
- `consensus` for provider inventory/preflight when exposed as a command.
- read/write access to input files, generated `.consensus/` run state, and output
  artifacts.

Refine parallel section mode additionally requires host-native subagent dispatch.
Codex authorization must fail closed: if dispatch approval is unavailable or
denied, the host should report that parallel mode did not run.
