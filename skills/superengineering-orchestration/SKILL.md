---
name: superengineering-orchestration
version: 1.1.2
description: Use when coordinating multiple Superengineering agents through the `sc` CLI. Defines fanout, labels, groups, waits, reviews, and cross-worktree workflow policy.
argument-hint: '[fanout|send|read|wait|review|coordinate] [target]'
user-invocable: true
allowed-tools: Bash, Read, Grep, AskUserQuestion
metadata:
  source: repo
  dependencies:
    - superengineering-cli
---

# superengineering-orchestration

> **Do not edit installed copies of this skill.** This file is a deployment
> artifact installed from the `orc` repository (`skills/` tree). Make changes
> upstream in that repo and reinstall; the installer detects local edits as
> drift and refuses to update over them.

Use this skill for multi-agent workflow policy on top of Superengineering's
`sc` CLI. It depends on `superengineering-cli` for exact command syntax, output
flags, selectors, and safety rules.

Before running unfamiliar `sc` commands, load the `superengineering-cli` skill
as the portable command reference. If direct file lookup is needed, prefer the
installed `superengineering-cli` skill, wherever skills are installed on this
machine; the repo-source `skills/superengineering-cli` path is a
development-checkout fallback only. For detailed workflow recipes bundled with
this skill, read `references/orchestration-workflows.md`.

## When to Use

Use when:

- Fanning out work to multiple Superengineering agents.
- Coordinating labelled or grouped agents.
- Running send/read/wait loops across one worktree or several worktrees.
- Sharing machine-readable coordination state between agents.
- Managing bounded implement/review/fix loops through `sc` targets.

## When NOT to Use

Do not use this skill when:

- The task only needs command syntax or read-only CLI probes; use
  `superengineering-cli`.
- The target is an Orca ADE pane or leaf; use `orca-orchestration`.
- The user has not asked for live agent coordination and a read-only summary is
  sufficient.

## Arguments

Parse from `$ARGUMENTS`:

- **fanout**: (mode) Run one prompt across multiple agents (`layout run`).
- **send**: (mode) Send to an existing chat or agent target.
- **read**: (mode) Read recent output or state from a target.
- **wait**: (mode) Bounded wait for idle or completion.
- **review**: (mode) Bounded implement/review/fix loop through `sc` targets.
- **coordinate**: (mode) Shared `coordination-state` get/set/watch.
- **target**: (optional) Worktree path or stable `id:`/`label:` selector.

## Step 1: Establish Scope

Confirm the Superengineering app is running and Agent orchestration is enabled:

```bash
SC="$HOME/.superconductor/bin/sc"
"$SC" status --json
"$SC" chat providers --json
"$SC" layout capabilities --output json
"$SC" agents list --worktree /path/to/intended-worktree --output json
```

If layout, agent, agents, or coordination commands return `feature_disabled`,
stop and ask the user to enable `Settings -> Experimental -> Agent
orchestration`.

`layout capabilities` is global to the app and rejects `--worktree`. Use it for
the feature/provider capability surface, then use worktree-scoped `layout
views`, `agents list`, and `agents get` for target discovery.

For new dispatches, read the applicable repository instructions, such as
`AGENTS.md`, `CLAUDE.md`, and Cursor rules, for provider, model, and reasoning
policy. Then choose from the live `chat providers --json` result. Never silently
select a model older than the family required by those instructions. If the
requested provider cannot satisfy the requirement, report the mismatch or
choose another provider permitted by the applicable instructions. Apply
`--reasoning` only when the selected provider exposes a separate compatible
reasoning surface.

## Step 2: Discover Targets

Resolve worktree scope before sending or reading anything:

1. Use `agents list --worktree PATH --output json` as the primary inventory for
   each intended worktree.
2. Use `chat list --json` only as supplemental API-chat/worktree evidence; it
   does not enumerate terminal-backed agents.
3. Branch on transport: `ui: chat`/`chat:*` is an API-chat target, while
   `ui: terminal`/`terminal:*` is a terminal-backed target.
4. Prefer `id:<stable_target_id>` or `label:<label>` selectors.
5. Avoid durable plans based only on visual selectors such as `view:1/tab:2`;
   they are 1-based, visual-order, and volatile.

## Step 3: Choose the Mechanism

Use the narrowest mechanism that fits:

- Existing API-chat session: `chat send SESSION_ID`.
- Existing terminal-backed agent with a tracked selector: `layout send` or
  `agent send`.
- Structured native read (`capabilities.structured_read`): `agent read`.
- Readable unstructured terminal: `layout read`; describe output as partial or
  live terminal history when indicated, not as a complete provider transcript.
- New multi-agent fanout: `layout run views|tabs|panes`.
- Reusable role set: `agents label ...` and `agents group ...`.
- Shared state: `coordination-state get/set/delete/watch`.

Use `layout run` only for initial launches. Its response contains the created
conversation/session result, not the durable target identifier to derive by
hand. After launch, run `agents get --to label:NAME --worktree PATH --output
json` or `agents list --worktree PATH --output json` and use the returned
`stable_target_id`, current selector, or label. Follow-up prompts go through
`agent send`, not another `layout run`.

`layout send` broadcasts one prompt to one or more targets within the selected
worktree scope. For multiple worktrees, send one scoped command per worktree or
address API-chat sessions directly.

## Step 4: Coordinate Safely

For every coordination loop:

1. Read the target state and recent output first.
2. Wait for idle before sends unless the user explicitly asks for deferred
   queueing.
3. Use labels for role clarity and groups for repeated fanout.
4. Bound waits, subscriptions, and review loops with timeout, max rounds,
   budget, or a user stop condition.
5. Record shared state with optimistic concurrency when updating existing
   coordination keys.

For conversational follow-ups, use this sequence: wait idle; send with
`--wait-until-idle` and `--idempotency-key`; wait idle again for completion;
then perform a structured read. `--wait-until-idle` on send gates delivery, not
response completion. Avoid `--queue` as the default because queued chat messages
may require steering.

Do not message your own Superengineering target. `--self` only works inside a
Superengineering-managed terminal or chat with `SUPERCONDUCTOR_TERMINAL_ID`.

If structured `agent read` returns `no_provider_session`, re-read exact target
state once. Use `layout read` only for the same still-readable terminal target;
otherwise return the capability mismatch to the caller so its transcript
fallback can run. Never open/create a workspace or worktree as read recovery.

## Step 5: Report Results

Report:

- Worktree scope.
- Targets addressed, by stable ID or label.
- Commands run at the workflow level.
- Wait/review loop outcome and stop condition.
- Any unresolved agent output or state conflict.

## Examples

### Basic Usage

```text
/superengineering-orchestration fanout /path/to/worktree
```

### Conversational

```text
Use superengineering-orchestration to start implementer and reviewer agents for this worktree, wait for them, and summarize the result.
```

```text
Coordinate the labelled Superengineering review team across these two worktrees.
```

## Success Criteria

- Superengineering app availability and Agent orchestration were checked.
- Targets were discovered before sends.
- Stable IDs, labels, or groups were used for durable targeting.
- Every wait/review loop had a clear bound and stop condition.
- `superengineering-cli` remained the command syntax source of truth.
