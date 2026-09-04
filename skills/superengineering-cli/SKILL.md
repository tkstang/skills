---
name: superengineering-cli
version: 1.2.2
description: Use when operating the Superconductor `sc` CLI. Provides command taxonomy, read-only probes, selectors, JSON envelopes, and safety rules.
argument-hint: '[status|instance|chat|layout|agents|agent|team|browser|coordination-state|workspace|worktree|section|commands|tab] [--json|--output json]'
user-invocable: true
allowed-tools: Bash, Read, Grep, AskUserQuestion
metadata:
  source: repo
---

# superengineering-cli

> **Do not edit installed copies of this skill.** This file is a deployment
> artifact installed from the `orc` repository (`skills/` tree). Make changes
> upstream in that repo and reinstall; the installer detects local edits as
> drift and refuses to update over them.

Use this skill when an agent needs to inspect or operate the Superconductor
(`super.engineering`) `sc` CLI directly. This is a pure CLI reference and
safety guide. Coordination policy belongs in a higher-level
`superengineering-orchestration` skill.

For the complete live command taxonomy, output conventions, envelope examples,
and mutation matrix, read `references/cli-surface.md` before using a command
surface that is not summarized below.

## When to Use

Use when:

- Checking whether the Superconductor app and local API are available, or which
  app instance is answering.
- Listing chats, providers, layout views, agents, groups, team runs, workspaces,
  coordination state, or worktree review data through `sc`.
- Reading an explicit target with `layout state`, `layout read`, `agents get`,
  or `agent read`.
- Preparing a safe, explicitly confirmed `sc` mutation after reading state.

## When NOT to Use

Do not use this skill when:

- The user wants Orca-specific terminal control; use `orca-orchestration` or
  `orca-cli`.
- The user wants multi-agent coordination policy; use
  `superengineering-orchestration`.
- The task can be handled by portable `orc` sensing alone.

## Step 1: Probe the CLI

Use the bundled CLI path unless `sc` is known to be on `PATH`:

```bash
SC="$HOME/.superconductor/bin/sc"
test -x "$SC"
"$SC" status --json
"$SC" --help
```

`sc` is a local API client for the running super.engineering app. The app must
be running, and the bundled CLI normally lives under `~/.superconductor/bin`.
It discovers the Unix socket from `~/.superconductor/local-api.json`; override
with `--socket PATH` or `SUPERCONDUCTOR_LOCAL_API_SOCKET` only when debugging a
known alternate instance.

`status --json` returns `api_version` plus a nested `instance` object. Attribute
every observation you record to `api_version`, `instance.pid`, and
`instance.build_commit` — the top-level `app_version` has stayed `0.1.0` across
many API versions and does not identify a build. When `sc instance list --json`
shows more than one live app, resolve which one you mean before acting instead
of assuming the inherited socket.

During the Superconductor -> super.engineering name transition, upstream local
developer paths and upstream environment variables still use `superconductor` /
`SUPERCONDUCTOR_*`.

super.engineering is on the nightly channel and drifts fast — the reference
snapshot moved 14 API versions between captures, gaining whole command groups.
Treat live help and status as the source of truth every run.

No single help path is complete. `sc --help`, `sc help GROUP`, and
`sc GROUP SUBCOMMAND --help` are each partial and are known to disagree (for
example, top-level help lists 6 `browser` verbs while `sc help browser` lists
~28). Never conclude a command or flag does not exist from one path alone.

## Step 2: Prefer Read-Only JSON

Use read-only probes first:

```bash
"$SC" instance current --json
"$SC" agents list --worktree /path/to/worktree --output json
"$SC" chat providers --json
"$SC" layout views --output json
"$SC" layout capabilities --output json
"$SC" agents group list --output json
"$SC" team list --output json
"$SC" workspace list --json
```

Output flag convention:

- Legacy surfaces use `--json`: `status`, `instance`, `workspace`, `worktree`,
  `section`, `commands`, `project scripts`, `browser`, `chat list/providers`,
  and some `tab` commands. Other chat commands vary: `chat stop` uses
  `--output text|json`, while `chat events` and `chat send` have no output flag.
- Orchestration surfaces use `--output text|json`: `layout` orchestration,
  `agents`, `agent`, `team`, and `coordination-state`.
- The orchestration surfaces reject the older `--json` flag. Use
  `--output json` there; the wrong family returns `error.code:"usage"`.

`sc instructions [TOPIC]` prints upstream's own agent-facing rules for a surface
and works even when the app is down.

Provider/model facts drift. Source valid providers, models, and reasoning
efforts from `chat providers --json`, not from older notes. Read `enabled`,
`models`, and `supported_reasoning_efforts` separately: a provider can be
enabled with an empty model list, and an empty effort list can mean effort is
encoded in the model ID rather than that effort is unsupported. Effort
vocabularies differ per provider and must never be normalized across providers.
`layout capabilities` returns a different, non-identical `providers[]` set —
use it for orchestration capability questions (`available`, `structured_read`),
and `chat providers` for chat model selection.

Before launching a new chat, tab, pane, view, or agent, read the applicable
repository instructions, such as `AGENTS.md`, `CLAUDE.md`, and Cursor rules, for
provider, model, and reasoning policy. Then query `chat providers --json` and
choose from the currently enabled surface. Never silently select a model older
than the family required by those instructions. If the requested provider
cannot satisfy the requirement, report the mismatch or choose another provider
permitted by the applicable instructions.

Layout orchestration, agent coordination, and `team` runs require the app
setting `Settings -> Experimental -> Agent orchestration`; every `browser` verb
requires `Settings > Experimental > Browser automation`. When the relevant
toggle is off, those commands return `feature_disabled`.

Scope matters. `agents list --worktree PATH --output json` is the primary
exact-target inventory. `layout views` and `agents list` without `--worktree`
report the current/default Superconductor workspace context, not every open
worktree. Use `chat list --json` only as supplemental API-chat and worktree
evidence: it does not enumerate terminal-backed agents. Query the intended
worktree explicitly:

```bash
"$SC" layout views --worktree /path/to/worktree --output json
"$SC" agents list --worktree /path/to/worktree --output json
```

`layout capabilities --output json` is global to the running app and does not
accept `--worktree`; use it once to discover the orchestration feature surface,
then use worktree-scoped `layout views`, `agents list`, `agents get`, and
`layout state` for target-specific facts.

Layout tab counts are UI/layout counts. They are not the same as registered
send/read targets; use `agents list --worktree PATH` and `layout state --to
TARGET --worktree PATH` to find addressable agents.

An agent's `ui` and `stable_target_id` identify its transport: `ui: chat` with
`chat:*` is an API-chat target, while `ui: terminal` with `terminal:*` is a
terminal-backed target. Do not infer one transport from the other or treat a
chat inventory as a complete worktree inventory.

## Step 3: Address Explicit Targets

External observers must use explicit `--to` selectors. Do not use `--self`
from an ordinary shell.

Common selectors:

- `active-tab`
- `tab:N`
- `view:N`
- `view:N/tab:N`
- `view:N/tab:N/pane:N`
- `id:ID`
- `label:NAME`
- `group:NAME`

Current live targets expose a `stable_target_id` such as `terminal:<uuid>` or
`chat:<uuid>`. Use `--to id:<stable_target_id>` for a stable ID, or use the
target's `current_selector`. Passing a raw `terminal:<uuid>` value is not a
valid selector.

`layout run` returns the created conversation/session result, but do not derive
durable send/read targets from that response alone. After an actual launch,
discover the target with `agents get --to label:NAME --worktree PATH --output
json` or `agents list --worktree PATH --output json` and use the returned
`stable_target_id`, `current_selector`, or label for follow-ups. A new-session
dry run does not echo the requested model; verify launched model/provider facts
from `agents get` or `agents list`.

Visual selectors are 1-based and ordered by the current layout. They are
volatile if the layout changes. Prefer `id:<stable_target_id>` or `label:NAME`
for durable targeting.

For cross-worktree communication, include `--worktree PATH` on layout, agent,
agents, and coordination commands that support it, or address chat sessions
directly with their `SESSION_ID` through `chat send`. A multi-target
`layout send` batches one prompt to multiple targets within the selected
worktree scope; issue separate scoped sends for separate worktrees.

`--self` resolves only inside a Superconductor-managed terminal or chat via
`SUPERCONDUCTOR_TERMINAL_ID`. From an external shell it should be expected to
return the stable error code `invoking_identity_unknown`.

## Step 4: Read Before Acting

Before any send, stop, move, or layout mutation, inspect the target:

```bash
"$SC" agents get --to "view:1/tab:1/pane:1" --output json
"$SC" layout state --to "view:1/tab:1/pane:1" --output json
"$SC" agent read --to "view:1/tab:1/pane:1" --last 20 --output json
```

For a one-time native read, first use the worktree-scoped agent inventory and
target state. If `capabilities.structured_read` (or the equivalent
`can_read_structured`) is advertised, prefer normalized `agent read`. For a
readable unstructured `ui: terminal` target, use `layout read` instead. Native
read output can be partial or live; preserve its consistency, cursor, and
truncation metadata and do not describe terminal history as a complete
provider transcript.

If `agent read` returns `error.code:"no_provider_session"`, re-read target
state once. Use `layout read` only when that exact terminal target remains
readable; otherwise report the capability mismatch and use the transcript
fallback chosen by the higher-level routing policy. Never create or open a
workspace or worktree to recover a read.

Honor target state and capability fields:

- `can_send`
- `can_stop`
- `has_active_turn`
- `managed`
- `can_read`
- `can_read_structured`
- `capabilities.send`
- `capabilities.read`
- `capabilities.stop`
- `capabilities.subscribe`
- `capabilities.structured_read`

Wait for idle before sending. Never target yourself.

## Step 5: Mutate Only With Guards

Do not run non-dry-run mutating commands unless the user explicitly requested
the exact action and target.

Dry-run support exists on:

```bash
"$SC" layout run views --prompt "..." --dry-run --output json
"$SC" layout send --to TARGET --prompt TEXT --dry-run --output json
"$SC" layout stop --to TARGET --dry-run --output json
"$SC" layout move --from TARGET --to DESTINATION --dry-run --output json
```

Important caveats:

- `agent send` has no `--dry-run`; use `--prefill` only when staging text is
  explicitly desired, and use `--idempotency-key` for replay safety.
- `agent send` can use `--queue` or `--wait-until-idle`. Prefer a separate
  `agent wait --idle`, then send with `--wait-until-idle` and
  `--idempotency-key`, then wait again for response completion before a
  structured read. `--wait-until-idle` on send gates delivery; it does not prove
  the response completed.
- Avoid `--queue` as the default for conversational follow-ups. Use it only for
  intentional deferred delivery because queued chat messages may need later
  steering.
- `chat send SESSION_ID --stdin --watch < prompt.txt` submits a prompt to a
  live API-chat session. Use it only after the user explicitly confirms the
  session ID, prompt source, and send action.
- `layout run` maps prompts onto visible layout slots; use `views`, `tabs`, or
  `panes` depending on whether you want top-level splits, tabs in a view, or
  panes in a tab.
- Use `layout run` only for initial launches. Follow-up prompts to existing
  agents use `agent send`, not another `layout run`.
- `worktree create` has no `--dry-run`. It creates a managed worktree and is a
  mutation requiring an explicit task and approval; it is never a recovery
  step for target discovery or reading.
- `--open-if-needed` applies to `layout run`, `layout send`, `agent send`, and
  `agent wait` when the user explicitly wants the target worktree opened.
- `coordination-state set/delete` support optimistic concurrency with
  `--if-version`; read the key first.
- Bound any `agent wait`, subscription, or review loop with an explicit timeout,
  max round count, budget, or user stop condition.
- `workspace open`, `worktree review-add/reply/set-status`,
  `worktree rename-branch`, `worktree set-target-branch`, `tab split`,
  `tab split-view`, `tab stop`, and `tab title` are state-changing.
- `worktree rename-branch` renames the Git branch only; it does not rename a
  generated worktree directory or display label. `worktree set-label` changes
  only the sidebar label and likewise renames nothing.
- `worktree delete` is destructive and refuses primary, dirty, or unpushed work
  unless `--force`. Never add `--force` to clear that refusal on your own.
- `team run` fans out 1-8 labeled roles in parallel as separate tabs and is
  mutating; each role must finish with `sc team report`. `team status` and
  `team list` are read-only. `team cancel` is best-effort — confirm with
  `team status`. Runs do not survive an app restart. Use `agent wait --idle`
  between launches when you need sequencing, not `team run`.
- `commands` mutations with `--scope shared` write repository-owned
  `.superconductor/config.json`, and creating a worktree config shadows the
  entire main-repo config including scripts. Confirm that intent before writing.
  IDs, not names, are the CRUD identity.
- `browser` act-tier verbs need a one-time per-workspace user grant and return
  `browser_consent_pending` until it is answered. Cookie reads, `console
--clear`, `eval`, and `wait --fn` are act-tier despite looking read-only.

## Examples

### Basic Usage

```bash
SC="$HOME/.superconductor/bin/sc"
"$SC" status --json
"$SC" agents list --output json
"$SC" layout state --to "id:terminal:00000000-0000-0000-0000-000000000000" --output json
```

### Conversational

```text
Use superengineering-cli to inspect the current Superconductor agents.
```

```text
Check the sc provider/model surface and tell me which providers are enabled.
```

## Troubleshooting

**`sc` is not found:**

- Use `~/.superconductor/bin/sc`.
- Confirm the app is running with `~/.superconductor/bin/sc status --json`.

**`invoking_identity_unknown`:**

- You used `--self` outside a Superconductor-managed session. Use an explicit
  `--to` selector.

**`not_found` for worktree commands:**

- Worktree commands resolve from the current directory and require a live
  Superconductor workspace. Open/register the workspace only when the user
  explicitly wants that state-changing action.
- Worktree and tab commands resolve their target worktree from the CLI
  process's current directory when no explicit worktree argument exists.
- `worktree rename-branch` renames the Git branch associated with the worktree;
  it is not a display-name or generated directory rename command.

**Expected agents are missing:**

- Query the intended worktree explicitly with `agents list --worktree PATH`
  using `--output json`; the default agent list may only reflect the
  current/default workspace.
- Use `chat list --json` only to supplement worktree context for API-chat
  sessions; it cannot reveal missing terminal agents.
- Remember that layout tabs can exist without being registered agent targets.

**Target-level `ok:false` from `agent read`:**

- The target may not support structured read. Check `layout state` and
  `agents get` capabilities first; for a readable unstructured terminal, use
  `layout read`.
- On `no_provider_session`, re-read state once and use `layout read` only if
  that same terminal target is still readable. Otherwise use the higher-level
  transcript fallback; do not create/open state as recovery.

**`feature_disabled`:**

- Enable `Settings -> Experimental -> Agent orchestration` for `layout`
  orchestration, `agents`, `agent`, `team`, and `coordination-state` commands.
- Enable `Settings > Experimental > Browser automation` for any `browser` verb.

**`usage`:**

- An unknown option, the wrong output-flag family, or an invalid selector.
  Match this code — **not** `validation_failed`, which appears only inside the
  message text and is never the `error.code`. Automation keyed to
  `validation_failed` will silently never fire.

**`browser_consent_pending`:**

- An act-tier `browser` verb is waiting on the one-time per-workspace
  Allow/Deny prompt in the app. Ask the user to answer it; do not retry blindly.

**`tab title` cannot identify the tab:**

- Run `sc tab title` only from a Superconductor-launched terminal; the app uses
  `SUPERCONDUCTOR_TERMINAL_ID` to identify the calling tab.

## Success Criteria

- Live status and help were checked before relying on command details, and the
  answering instance was recorded with any observation kept.
- More than one help path was consulted before concluding a command or flag is
  unavailable.
- Read-only JSON probes were used before mutation.
- External observers used explicit `--to` selectors, not `--self`.
- Provider/model facts came from `chat providers --json`.
- Error handling matched `error.code`, not message text.
- Any mutation was explicit, target-specific, and guarded by dry-run or a clear
  user confirmation.
