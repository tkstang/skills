# Superengineering Orchestration Workflows

This reference defines workflow policy for coordinating Superengineering agents
with `sc`. It intentionally avoids duplicating the full command taxonomy; use
`superengineering-cli` for syntax, selectors, output flags, and safety guards.

## Baseline Checks

Start every workflow with read-only probes:

```bash
SC="$HOME/.superconductor/bin/sc"
"$SC" status --json
"$SC" chat list --json
"$SC" chat providers --json
"$SC" layout capabilities --output json
"$SC" agents list --worktree /path/to/intended-worktree --output json
```

The orchestration surfaces use `--output json`, not `--json`. If they return
`feature_disabled`, the user must enable `Settings -> Experimental -> Agent
orchestration`.

`layout capabilities --output json` is app-global and rejects `--worktree`.
Use it to discover available layout operations and provider capability classes,
then switch to worktree-scoped probes for targets.

Provider/model selection combines repository policy with live data. Read the
applicable `AGENTS.md`, `CLAUDE.md`, and Cursor rules before dispatch, then query
`chat providers --json`. Never silently select a model older than the family
required by those instructions. If the requested provider cannot satisfy the
requirement, report the mismatch or choose another provider permitted by the
applicable instructions. Provider reasoning surfaces differ: pass `--reasoning`
only when the selected provider advertises a separate compatible effort.

## Target and Scope Model

Treat worktree scope as part of the target:

- `chat send SESSION_ID` addresses an existing API-chat session directly.
- `layout` and `agent` commands address tracked layout/agent targets in a
  worktree scope.
- `agents list --worktree PATH --output json` is the primary exact-target
  inventory and source for
  `stable_target_id`, current visual selector, labels, and capabilities.
- `chat list --json` is supplemental API-chat/worktree evidence; it cannot
  discover terminal-backed agents.
- `ui: chat`/`chat:*` identifies an API-chat target. `ui: terminal`/
  `terminal:*` identifies a terminal-backed target. Do not collapse the two
  transports into one inventory.
- `layout send --worktree PATH --to TARGET ...` sends within one worktree
  scope. For multiple worktrees, run one scoped send per worktree.

Prefer durable selectors:

- `id:<stable_target_id>` for exact tracked targets.
- `label:<label>` for role-based targets.
- `group:<name>` for repeated fanout to a known team.

Visual selectors such as `view:1/tab:2/pane:1` are 1-based and in current
visual order. Use them only for immediate actions after a fresh read because
layout changes can invalidate them.

## Fanout Workflow

Use `layout run` when creating a new set of agents:

```bash
: "${PROVIDER_KEY:?set from repository policy and chat providers output}"
: "${MODEL_ID:?set from repository policy and chat providers output}"

"$SC" layout run views \
  --worktree /path/to/worktree \
  --ui terminal \
  --provider "$PROVIDER_KEY" \
  --model "$MODEL_ID" \
  --label implementer \
  --prompt "Implement the focused change." \
  --label reviewer \
  --prompt "Review the diff for regressions." \
  --dry-run \
  --output json
```

After the dry run looks correct, ask for approval before the non-dry-run
command. `layout run` maps prompts across visible layout slots:

- `views`: top-level splits.
- `tabs`: tabs inside one view.
- `panes`: panes inside one tab.

After a real launch, verify the durable target and actual provider/model facts:

```bash
"$SC" agents get --to label:implementer --worktree /path/to/worktree --output json
"$SC" agents list --worktree /path/to/worktree --output json
```

Do not derive `stable_target_id` values from `layout run` response fields. A
new-session dry run does not echo the requested model; use `agents get/list` on
the actual launched target.

Use `--open-if-needed` only when the user wants Superengineering to open the
worktree if it is not already visible.

## Labels and Groups

Use labels for roles and groups for repeated team actions:

```bash
"$SC" agents label set --to id:terminal:00000000-0000-0000-0000-000000000000 reviewer --output json
"$SC" agents group create review-team --agent label:reviewer --agent label:validator --output json
"$SC" agents group add review-team --agent label:implementer --output json
"$SC" agents group remove review-team --agent label:validator --output json
"$SC" agents group list --output json
```

Labels and groups are worktree-scoped when `--worktree PATH` is supplied.
Always list agents again after labelling or grouping so later sends use the
current selector, stable ID, or label state.

## Send, Read, Wait Loops

Use this loop for follow-ups:

1. Read state and recent output.
2. Wait for idle if needed.
3. Send with `--wait-until-idle` and an idempotency key.
4. Wait for idle with a timeout to detect response completion.
5. Read back the response.

```bash
"$SC" agents get --to label:implementer --worktree /path/to/worktree --output json
"$SC" agent wait --to label:implementer --idle --timeout-ms 120000 --worktree /path/to/worktree --output json
"$SC" agent send --to label:implementer --prompt "Address the review findings." --wait-until-idle --idempotency-key review-fix-1 --timeout-ms 120000 --worktree /path/to/worktree --output json
"$SC" agent wait --to label:implementer --idle --timeout-ms 600000 --worktree /path/to/worktree --output json
"$SC" agent read --to label:implementer --last 80 --worktree /path/to/worktree --output json
```

`--wait-until-idle` on `agent send` gates delivery; it does not mean the target
finished responding. Avoid `--queue` as the default for conversational
follow-ups. Use `--queue` only when intentionally deferring delivery, because a
queued chat message may require steering after the active turn completes.

Use `chat send SESSION_ID --stdin --watch < prompt.txt` when the target is an
API-chat session. Use layout/agent targeting for terminal-backed agents with
tracked selectors.

For a one-time peer read, discover the intended worktree first and inspect the
exact target state. Prefer `agent read` when structured read is advertised. For
a readable unstructured terminal target, use `layout read`. Preserve reported
partial/live consistency, cursors, and truncation rather than calling terminal
output a full transcript. If `agent read` returns `no_provider_session`, re-read
state once; use `layout read` only if that exact terminal remains readable.
Otherwise return the mismatch for transcript fallback. Do not create/open a
workspace or worktree to make a native read possible.

## Bounded Review Loops

Define the loop bound before starting:

- Maximum rounds.
- Timeout per wait.
- Budget or token cap.
- Stop when no actionable findings remain.
- User stop condition.

Example policy:

```text
Run at most two review rounds. Stop early when the reviewer returns no
Important or Critical findings. If the reviewer is not idle within 120000 ms,
report partial results instead of waiting indefinitely.
```

Record each round's state in coordination state if multiple agents need to
observe it:

```bash
"$SC" coordination-state get review/status --worktree /path/to/worktree --output json
"$SC" coordination-state set review/status '{"round":1,"open_findings":3}' --if-version 4 --worktree /path/to/worktree --output json
```

Use `--if-version` when updating an existing key to avoid overwriting another
agent's update.

## Cross-Worktree Coordination

Coordinate across worktrees by making scope explicit:

```bash
"$SC" agents list --worktree /path/to/worktree-a --output json
"$SC" agents list --worktree /path/to/worktree-b --output json
"$SC" layout send --worktree /path/to/worktree-a --to label:reviewer --prompt "Review worktree A." --output json
"$SC" layout send --worktree /path/to/worktree-b --to label:reviewer --prompt "Review worktree B." --output json
```

Do not assume a label in one worktree resolves in another. Repeat discovery and
state reads per worktree. For shared progress, use namespaced coordination keys
such as `review/worktree-a/status` and `review/worktree-b/status`.

## Branch Rename Caveat

`sc worktree rename-branch NEW_NAME` renames the Git branch associated with the
worktree. It is not a generated worktree display-name rename and does not
rename a generated directory. Treat it as a Git branch mutation and ask for
explicit approval before running it.

`sc worktree create` has no dry-run. It creates a managed worktree and launches
setup, so it requires an explicit task and approval; it is never read recovery.

## API-v17 Help Drift

Treat direct `-h` output as live capability evidence. Some direct nested help
requests can print the enclosing command-group synopsis rather than detailed
subcommand prose, so use the returned usage signature and any offered long-help
path rather than assuming a separate direct help page. API v17 exposes whole-
file `worktree review-add --anchor file`, `worktree review-reply --resolve`, and
repeatable `layout run` `--prompt`, `--initial-message`, and `--message`
inputs. Inspect those surfaces with `-h`; do not execute them to verify help.

## Reporting Template

When finishing an orchestration workflow, report:

```text
Scope: /path/to/worktree
Targets: label:implementer, label:reviewer
Actions: fanout, wait, read, one review round
Stop condition: reviewer returned no blocking findings
Unresolved: none
```
