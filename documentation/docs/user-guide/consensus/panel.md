---
title: 'Panel'
description: 'Run consensus-panel to ask multiple provider-backed panelists the same question while the host stays a neutral moderator.'
---

# Panel

`panel` runs `consensus-panel`, a non-converging workflow for asking multiple
provider-backed AI panelists the same question. The output is a side-by-side,
attributed panel artifact with each response, shortfalls, diagnostics, and run
metadata.

The host is a neutral moderator. It frames the approved question, invokes the
wrapper, reads JSONL status, and presents attributed responses. It does not add a
host-authored panel answer, synthesize a recommendation, vote, or claim consensus.

Use `panel` when you want multiple independent perspectives on one question. Use
[`refine`](refine.md) when peers should converge on an improved artifact,
[`evaluate`](evaluate.md) when peers should judge an artifact against a rubric,
and [`phone-a-friend`](phone-a-friend.md) when one advisory peer is enough.

## Invocation

Run an inline question:

```bash
node plugins/consensus/skills/panel/scripts/consensus-panel.mjs \
  --question <text> \
  --panelists claude,codex \
  --output panel.md
```

Run a file-backed question:

```bash
node plugins/consensus/skills/panel/scripts/consensus-panel.mjs \
  --question-file <path> \
  --panel-size 3 \
  --allow-root .
```

Exactly one of `--question <text>` or `--question-file <path>` is required. Use
question files for longer prompts or structured approved context.

## Panel selection

Use `--panelists <provider-id,provider-id>` when you want specific panelists.
The list must contain at least two providers.

Use `--panel-size <n>` when you want a target panel size of two or more. If no
explicit panelists are supplied, the wrapper resolves configured defaults and
then built-in fallback composition.

Inspect or set defaults with `consensus config`:

```bash
consensus config get --json --scope effective --workflow panel
consensus config set --json --scope user --panelists claude,codex --panel-size 2
consensus config set --json --scope project --panelists claude,codex,cursor --panel-size 3
```

From a repository checkout, the same provider CLI is available at
`plugins/consensus/scripts/consensus.mjs`:

```bash
node plugins/consensus/scripts/consensus.mjs config get --json --scope effective --workflow panel
```

See [Configuration](configuration.md) for config file paths and precedence.

## Output

The wrapper emits JSONL status events on stdout and writes a markdown artifact.
Without `--output`, file-backed questions write `<question-file>.panel.md`;
inline questions write `.consensus/panel-<run-id>/panel.md`.

Important JSONL events include:

- `run_started`
- `panel_resolved`
- `panelist_unavailable`
- `panelist_started`
- `panelist_completed`
- `artifact_written`
- `run_completed`

Use `run_completed.status` and the artifact frontmatter to determine final
status. A passed panel has at least two successful panelist responses. A failed
panel records whether fewer than two responses succeeded or an explicitly
requested panelist was unavailable.

The artifact includes:

- original question
- resolved panelist attribution, including model or effort when configured
- one section per panelist response, unavailable panelist, or provider error
- shortfalls and diagnostics
- canonical JSON blocks for the panelist responses and panel artifact

## Context approval

Panelists run through provider CLIs. Ask for explicit approval before sending
sensitive or private context, credentials, customer data, personal data,
proprietary documents, broad workspace dumps, or incident details to
provider-backed panelists.

Only include context the user has approved in `--question`, `--question-file`, or
files referenced by the question.

## Limitations

`consensus-panel` is single-round and independent in v1. Panelists do not see
each other's answers, debate, cross-examine, vote, or converge. Multi-round panel
discussion is deferred to `BL-260701-add-multi-round-panel`.

The host can give a separate recommendation after the panel only if the user asks
for that follow-up. That recommendation is not part of the panel result.
