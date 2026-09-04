# Superengineering CLI Surface Reference

This reference covers the Orc-owned Superconductor `sc` CLI skill surface. It is
a CLI reference and safety guide only. It does not define orchestration policy
or wrap `sc` in a higher-level coordination workflow.

Treat live help and read-only probes as the source of truth. The
Superconductor app and CLI are on a fast-moving nightly surface, so command
availability, provider lists, models, selectors, and response fields can drift.

**Snapshot pin: API v31**, captured 2026-08-16 from a `build_channel: prod`
instance. The previous pin was v17; that 14-version gap had added entire command
groups (`team`, `browser`, `section`, `commands`, `instance`, `history`,
`project scripts`, `layout compose`), changed the `status` and
`layout capabilities` envelopes, and invalidated one documented error code. Run
the Drift Checks below before trusting this file for anything consequential, and
prefer a live probe over this snapshot whenever the two disagree.

Official reference: <https://super.engineering/docs/cli-local-api/>.

## Startup and Probes

Use the bundled CLI path unless `sc` is already known to be on `PATH`:

```bash
SC="$HOME/.superconductor/bin/sc"
test -x "$SC"
"$SC" status --json
"$SC" --help
```

Status shape pinned at **API v31** (observed 2026-08-16 from a `build_channel:
prod` instance). `status` now nests an `instance` object describing the exact
app that answered:

```json
{
  "ok": true,
  "api_version": 31,
  "app_version": "0.1.0",
  "cli_install_path": "/Users/example/.superconductor/bin/sc",
  "instance": {
    "schema_version": 1,
    "pid": 66745,
    "process_start_token": "66745-1786905065415",
    "socket_path": "/Users/example/.superconductor/local-api.sock",
    "started_at_ms": 1786905065415,
    "app_version": "9c618a3c401555275f39c65a4c49ffcd2c83fac3 (9c618a3)",
    "build_channel": "prod",
    "build_branch": null,
    "build_commit": "9c618a3c401555275f39c65a4c49ffcd2c83fac3",
    "source_worktree": null,
    "executable_path": "/Applications/super.engineering.app/Contents/MacOS/superconductor"
  }
}
```

There are two different `app_version` fields and they mean different things. The
top-level one is a coarse product string that has stayed `0.1.0` across many API
versions, so it does not discriminate builds. `instance.app_version` and
`instance.build_commit` carry the real build identity. **Attribute every
recorded observation to `api_version` plus `instance.pid` and
`instance.build_commit`**; a dated note without that attribution cannot be
checked later.

`sc` is a local API client for the running app. The app must be running, and the
bundled CLI normally lives under `~/.superconductor/bin/sc`. It normally
discovers the Unix socket from `~/.superconductor/local-api.json`, which
independently reports the serving `version` and `pid`. Use the global socket
override only when debugging a known alternate instance:

```bash
"$SC" --socket /path/to/socket status --json
SUPERCONDUCTOR_LOCAL_API_SOCKET=/path/to/socket "$SC" status --json
```

### Instance Identity and Multi-Instance Targeting

```bash
sc instance current [--socket PATH] [--json]
sc instance list [--socket PATH] [--json]
```

`instance current` reports the exact app inherited by this agent; an explicit
`--socket` selects that instance ahead of inherited environment values.
`instance list` returns every live instance in the standard local runtime
channels, ignoring stale manifests by checking PID liveness and the socket's
exact health identity. In text output, `*` marks the current instance; use JSON
for programmatic targeting.

Both return the same `instance` record shape shown above, under `instance` and
`instances[]` respectively.

When more than one instance is live, resolve the intended one before any read or
mutation. Do not assume the inherited socket is the instance the user means.

During the Superconductor -> super.engineering name transition, developer-facing
paths and names still use `superconductor`, including `~/.superconductor`,
`.superconductor/config.json`, the `sc` CLI, and `SUPERCONDUCTOR_*`
environment variables.

Recommended read-only probes (make the target worktree explicit for exact
agent discovery):

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

`sc instructions [TOPIC]` prints agent-facing operational guidance without
contacting the app, so it works even when the app is down. Available topics:
`workspace`, `project`, `commands`, `worktree`, `orchestration`, `layout`,
`review`, `browser`, `instance`. Run it without a topic to list the guides. It
states upstream's own operating rules: `sc` is the default control surface for
app-managed state, local API internals (sockets, endpoints, raw payloads) must
not be exposed, and managed state may be mutated only for an outcome the user
explicitly requested. Read-only discovery is always allowed.

Current read-only observations can change by session. Record only the target
scope, transport, stable selector, and capabilities needed for the operation;
do not preserve provider, model, or session inventories in this reference.

### Workspace and Worktree Scope

`sc` has both app-wide and worktree-scoped read surfaces. Layout and agent
targeting is scoped: without `--worktree PATH`, `layout views` and `agents
list` report the current/default workspace context rather than every open
worktree. For an exact target, `agents list --worktree PATH --output json` is
the primary inventory. `chat list --json` is supplemental API-chat/worktree
evidence only: it can reveal chat session `worktree_path` values but does not
enumerate terminal-backed agents.

To inspect a bounded set of worktrees, start from independently known,
user-supplied, or project-supplied worktree paths and query each path with
`agents list --worktree`. Use `chat list` only afterward as supplemental
API-chat context; it is not a complete worktree inventory:

```bash
"$SC" agents list --worktree /known/path/to/worktree-a --output json
"$SC" agents list --worktree /known/path/to/worktree-b --output json
"$SC" chat list --json
```

`layout capabilities --output json` is global to the running app. It reports
the app-level orchestration feature and provider capability surface and rejects
`--worktree` with a usage error. Do not treat it as a worktree-scoped probe.

Live verification has repeatedly shown default-scope reads under-reporting the
real inventory: a default `agents list` can return an empty or single-agent
result while explicit `--worktree` queries against known worktree paths return
registered agents in each. An empty default-scope result is therefore not
evidence that no agents exist.

Compare default-scope and explicit worktree results when they disagree. Prefer
the most target-specific, current result and report the scope discrepancy rather
than silently merging the inventories.

Layout tab counts are UI/layout counts. They are not equivalent to addressable
agent targets. Use `agents list --worktree PATH`, `agents get`, and
`layout state --worktree PATH --to TARGET` to identify targets that can be
read, sent to, or stopped.

## Output Conventions

There are two output flag families:

- Legacy commands use `--json`: `status`, `instance`, `workspace`, `worktree`,
  `section`, `commands`, `project scripts`, `browser`, `chat list/providers`,
  and some `tab` commands. Other chat commands vary: `chat stop` uses
  `--output text|json`, while `chat events` and `chat send` have no output flag.
  `history` has no output flag.
- Orchestration commands use `--output text|json`: newer `layout` commands,
  `agents`, `agent`, `team`, and `coordination-state`.
- Orchestration, observe/control, and coordination commands reject the older
  `--json` flag. Use `--output json` for `layout run/compose/send/state/read`,
  `agents ...`, `agent ...`, `team ...`, and `coordination-state ...`.

The split is not aesthetic: passing the wrong family returns
`error.code:"usage"`. When a group is unfamiliar, confirm its flag family from
help before scripting it.

JSON responses usually include a top-level `kind`. Orchestration responses
usually wrap data under `response`, and some responses repeat `kind` inside it:

```json
{
  "kind": "layout_views",
  "response": {
    "views": [
      { "index": 1, "view_id": 1, "active": true, "tab_count": 3 },
      { "index": 2, "view_id": 2, "active": false, "tab_count": 1 }
    ]
  }
}
```

`index` is the volatile 1-based positional value that shifts when the layout
changes. `view_id` (added since v17) is a separate identifier; prefer it when
correlating views across successive reads.

`workspace watch` is the one streaming read surface: it emits JSONL events —
an initial snapshot followed by revisioned deltas — rather than a single
envelope.

Error responses use a stable machine-readable code under `error.code`:

```json
{
  "kind": "cli_error",
  "error": { "code": "not_found", "message": "... (not_found)" }
}
```

Match automation on `error.code`, not the human-readable message.

Useful observed error codes (re-verified against API v31):

- `feature_disabled`: a required app setting is off — `Settings -> Experimental
-> Agent orchestration` for layout/agent/coordination commands, or
  `Settings > Experimental > Browser automation` for any `browser` verb.
- `invoking_identity_unknown`: `--self` was used outside a
  Superconductor-managed terminal or chat.
- `not_found`: a requested key, workspace, review item, or target was not
  found.
- `usage`: an unknown option, wrong output-flag family, or an invalid selector.
- `browser_consent_pending`: an act-tier `browser` verb is waiting on the
  one-time per-workspace Allow/Deny grant.
- `browser_not_implemented`: the verb is unsupported (`browser resize` always
  returns this).

**Do not match on `validation_failed`.** Earlier notes listed it as an
`error.code`; on v31 it appears only inside the human-readable message while the
actual code is `usage`:

```json
{
  "kind": "cli_error",
  "error": {
    "code": "usage",
    "message": "invalid agent target 'terminal:<uuid>': unknown selector kind 'terminal' (validation_failed) for target 'terminal:<uuid>'"
  }
}
```

Automation keyed to `validation_failed` silently never fires. This is the
concrete reason to read `error.code` and treat message text as detail only.

## Command Taxonomy

This taxonomy was captured at API v31. Re-run help before relying on it, and
read "Help Discovery" below first — no single help path is complete.

The layout orchestration, agent coordination, and `team` command groups require
`Settings -> Experimental -> Agent orchestration`. Every `browser` verb requires
`Settings > Experimental > Browser automation`. `workspace`, `chat`, `worktree`,
`section`, `commands`, `project`, and `tab` commands do not require either
toggle.

### Help Discovery

Three help paths exist and they disagree with each other:

```bash
sc --help                 # top-level usage; under-reports several groups
sc help GROUP             # long help for many but not all groups
sc GROUP SUBCOMMAND --help  # per-command detail where offered
```

- `sc help GROUP` returns real long help for `team`, `browser`, `section`,
  `worktree`, `workspace`, `project`, `agent`, `agents`, `tab`,
  `coordination-state`, and `commands`.
- It has no dedicated topic for `layout`, `chat`, or `history`, and silently
  falls back to the entire top-level usage.
- `-h` behaves inconsistently: it returns group help for `instructions`,
  `instance`, and `commands`, but falls back to full top-level usage for
  `history`, `project scripts`, `layout compose`, and `team run`.

Observed disagreements run in both directions, so neither path is a superset:

| Surface           | Top-level `--help`            | `sc help GROUP`                          |
| ----------------- | ----------------------------- | ---------------------------------------- |
| `browser`         | 6 verbs                       | ~28 verbs                                |
| `worktree`        | omits `ensure-child`          | lists `ensure-child`, `select --session` |
| `project scripts` | `check\|set\|unset`           | `check\|run\|stop\|status\|set\|unset`   |
| `tab title`       | expanded `--to`/`--item` form | older `TITLE [--json]` form only         |

Treat a disagreement as a finding to verify, not a choice to make silently. When
the two conflict, prefer the form that the command itself accepts and report the
discrepancy.

### Status and Instance

```bash
sc [--socket PATH] status [--json]
sc instance current [--socket PATH] [--json]
sc instance list [--socket PATH] [--json]
```

### Instructions

```bash
sc instructions [workspace|project|commands|worktree|orchestration|layout|review|browser|instance]
```

Read-only and app-independent. Useful for recovering upstream's own operating
rules for a surface before acting on it.

### History

```bash
sc history list --cwd PATH --main-repo PATH [--provider KEY] [--offset N] [--limit N]
sc history get --provider KEY --session ID --cwd PATH
```

Read-only provider session history, scoped by working directory and main repo.
Both arguments are required on `list`. There is no dedicated help topic for this
group.

### Chat

```bash
sc chat list [--json]
sc chat providers [--json]
sc chat new [--worktree PATH] [--provider KEY] [--model ID] [--reasoning LEVEL] [--activate]
sc chat select SESSION_ID
sc chat send SESSION_ID [--stdin] [--watch] [--model ID] [--reasoning LEVEL] [TEXT]
sc chat events SESSION_ID
sc chat cancel SESSION_ID
sc chat stop SESSION_ID [--output text|json]
sc chat close SESSION_ID
```

`chat providers --json` is the live source for provider enablement, models, and
supported reasoning efforts. Do not preserve provider or model inventories in
this reference.

Before a new launch, read the applicable repository instructions, such as
`AGENTS.md`, `CLAUDE.md`, and Cursor rules, for provider, model, and reasoning
policy. Then query `chat providers --json` and choose from the currently enabled
surface. Never silently select a model older than the family required by those
instructions. If the requested provider cannot satisfy the requirement, report
the mismatch or choose another provider permitted by the applicable
instructions.

Each provider record carries `provider_key`, `display_name`, `enabled`,
`models[]`, and `supported_reasoning_efforts[]`. Read all four; they vary
independently:

- **`enabled: true` does not imply a selectable model.** A provider has been
  observed enabled with an empty `models` array but a non-empty reasoning-effort
  list. Check `models` for non-emptiness separately before selecting one.
- **Effort vocabularies are per-provider and must not be normalized.** Some
  providers expose `max`, others `xhigh`, others neither. Never map one
  provider's effort label onto another's.
- **An empty `supported_reasoning_efforts` does not mean "no effort control."**
  A provider may encode effort in the model ID instead (observed with model IDs
  suffixed `-low`, `-high`, `-xhigh`, and `-fast` variants). Do not pass
  `--reasoning` to such a provider; choose the encoded model ID instead.
- **CLI-accepted values are not proof of provider support.** `sc commands`
  accepts a wider `--reasoning auto|low|medium|high|xhigh|max|ultra` vocabulary
  than any single provider currently advertises. Validate against
  `chat providers --json`, not against what the parser tolerates.

`chat providers` is also not the complete provider universe.
`layout capabilities --output json` returns a `providers[]` array whose `key`
values overlap but do not match: it includes launcher/provider keys that
`chat providers` never returns. Use `chat providers` for chat model selection
and `layout capabilities` for orchestration capability questions.

Automation recipes commonly use stdin plus event replay:

```bash
sc chat send SESSION_ID --stdin --watch < prompt.txt
sc chat events SESSION_ID
```

`chat events SESSION_ID` reads events retained by the running local API
process. Treat replay as process-local and bounded by the current app process,
not a durable audit log.

### Layout

```bash
sc layout set --target workspace [--count N] [--arrangement grid|vertical|horizontal|SPEC] [--active keep|view:N] [--keep active-view,view:N] [--worktree PATH] [--provider KEY] [--ui auto|chat|terminal] [--json]
sc layout set --target tab [--count N] [--arrangement grid|vertical|horizontal|SPEC] [--active keep|pane:N] [--worktree PATH] [--provider KEY] [--ui auto|chat|terminal] [--json]
sc layout close --target view:N|active-view[,view:N...] [--worktree PATH] [--json]
sc layout insert --target view:N|active-view [--active keep|new] [--worktree PATH] [--provider KEY] [--ui auto|chat|terminal] [--json]
sc layout save NAME [--scope user|worktree] [--from view] [--worktree PATH] [--provider KEY] [--ui auto|chat|terminal] [--json]
sc layout apply NAME [--scope user|worktree] [--worktree PATH] [--provider KEY] [--ui auto|chat|terminal] [--json]
sc layout list [--scope user|worktree] [--worktree PATH] [--json]
sc layout show NAME [--scope user|worktree] [--worktree PATH] [--json]
sc layout delete NAME [--scope user|worktree] [--worktree PATH] [--json]
sc layout run views|tabs|panes [--prompt TEXT...] [--initial-message TEXT...] [--label LABEL] [--replace-label] [--message label:NAME=TEXT...] [--from-file PATH] [--model ID] [--reasoning LEVEL] [--system-prompt TEXT] [--count N] [--prefill] [--dry-run] [--worktree PATH] [--open-if-needed] [--provider KEY] [--ui auto|chat|terminal] [--active keep|new|view:N|pane:N] [--arrangement grid|vertical|horizontal|SPEC] [--replace] [--view N] [--tab N] [--output text|json]
sc layout compose (--stdin|--from-file PATH) [--dry-run|--refresh-guard] [--worktree PATH] [--output text|json]
sc layout send --to TARGET [--to TARGET...] --prompt TEXT [--prefill] [--dry-run] [--worktree PATH] [--open-if-needed] [--output text|json]
sc layout views [--worktree PATH] [--output text|json]
sc layout capabilities [--output text|json]
sc layout state (--self|--to TARGET [--to TARGET...]) [--worktree PATH] [--output text|json]
sc layout read --to TARGET [--to TARGET...] [--last N] [--worktree PATH] [--output text|json]
sc layout stop --to TARGET [--to TARGET...] [--kill] [--dry-run] [--worktree PATH] [--output text|json]
sc layout move --from tab:N|view:N/tab:N|active-tab|id:ID|label:NAME|group:NAME [--from TARGET...] --to view:N|active-view|new-view[:N] [--position start|end|before:tab:N|after:tab:N] [--active keep|new|view:N|tab:N] [--dry-run] [--worktree PATH] [--output text|json]
```

`layout compose` applies a declarative layout description from stdin or a file
instead of imperative `set`/`insert`/`run` calls. It is gated by the
`layout_orchestration.compose` capability. Use `--dry-run` first;
`--refresh-guard` and `--dry-run` are mutually exclusive.

`layout capabilities --output json` is the live source for supported layout
orchestration operations. The v31 envelope adds feature flags and a per-provider
capability array:

```json
{
  "kind": "layout_capabilities",
  "response": {
    "kind": "layout_capabilities",
    "team_runs": true,
    "team_runs_read": true,
    "layout_orchestration": {
      "run": ["views", "tabs", "panes"],
      "compose": true,
      "send": true,
      "stop": true,
      "state": true,
      "read": true,
      "move": true
    },
    "providers": [
      {
        "key": "claude",
        "available": true,
        "terminal_chat_compatible": true,
        "terminal_to_api_chat": true,
        "structured_read": true,
        "stop": { "cancel": true, "kill_terminal": true }
      }
    ]
  }
}
```

Read the flags rather than assuming them: `team_runs` gates mutating `team`
workflows, `team_runs_read` gates read-only `team status`/`team list`, and
`layout_orchestration.compose` gates `layout compose`.

The `providers[]` array is the authoritative per-provider capability source.
Check `available` before targeting a provider (a key can be listed but
unavailable) and check `structured_read` before preferring `agent read` over
`layout read` — providers split roughly evenly on structured-read support, and
that split does not follow whether the provider is popular or enabled for chat.
Do not preserve the provider roster here; read it live.

`layout capabilities` is an app-global read surface and rejects `--worktree`
with `error.code:"usage"`. Use worktree-scoped `layout views`, `agents list`,
`agents get`, and `layout state` for target-specific state.

`layout run` creates agent sessions across visible layout slots and maps prompts
to them. Use `views` for top-level splits, `tabs` for tabs inside a view, and
`panes` for panes inside a tab. Prefer `--dry-run --output json` first to see
the planned selectors and prompt mapping.

The non-dry-run response identifies the created conversation/session result, but
durable targeting still comes from `agents get` or `agents list`. A dry run does
not echo the requested model, so verify provider/model/reasoning on the actual
launched agent:

```bash
"$SC" agents get --to label:implementer --worktree /path/to/worktree --output json
"$SC" agents list --worktree /path/to/worktree --output json
```

Use `layout run` for initial launch only. Send follow-up prompts to existing
agents with `agent send`.

`--open-if-needed` applies to `layout run`, `layout send`, `agent send`, and
`agent wait`. Use it only when the user wants the target worktree opened if it
is not already visible.

### Agents

```bash
sc agents list [--worktree PATH] [--output text|json]
sc agents get --to TARGET [--worktree PATH] [--output text|json]
sc agents label set --to TARGET LABEL [--replace] [--worktree PATH] [--output text|json]
sc agents label clear --to TARGET [--worktree PATH] [--output text|json]
sc agents group create|add|remove NAME --agent TARGET [--agent TARGET...] [--worktree PATH] [--output text|json]
sc agents group delete NAME [--worktree PATH] [--output text|json]
sc agents group list [--worktree PATH] [--output text|json]
```

`agents list --worktree PATH --output json` returns an `agents` response with
stable target IDs, current selectors, provider/UI state, and capabilities. Its
`ui` identifies the transport: `ui:"chat"` pairs with `chat:*` stable IDs;
`ui:"terminal"` pairs with `terminal:*` stable IDs. Do not equate either
transport with the other:

```json
{
  "kind": "agents",
  "response": {
    "agents": [
      {
        "stable_target_id": "terminal:<uuid>",
        "current_selector": "view:1/tab:1/pane:1",
        "capabilities": { "send": true, "read": true, "stop": true }
      }
    ]
  }
}
```

**Record shape carried from the v17 capture — not re-observed at v31.** The
envelope above (`{"kind":"agents","response":{"agents":[...]}}`) was confirmed at
this pin, but the per-agent record fields were not. Every v31 probe of this
surface returned an empty `agents` array — no registered agents in the default
workspace scope (re-confirmed 2026-08-17 against `api_version: 31`,
`app_version: 0.1.0`, pid 66745) — so the field shape above is carried forward
from the v17 capture and is unverified at v31. Treat `capabilities.send` and
`capabilities.stop` as especially provisional: they gate send and stop routing,
so a shape change there is safety-relevant. Re-probe a workspace that actually
has a registered agent before relying on these fields, and prefer the observed
response over this example whenever the two disagree.

Groups are stateful labels over resolved targets:

```bash
sc agents group create review-team --agent label:reviewer --agent label:validator --output json
sc agents group add review-team --agent id:terminal:00000000-0000-0000-0000-000000000000 --output json
sc agents group remove review-team --agent label:validator --output json
sc agents group list --output json
```

### Agent

```bash
sc agent send (--to TARGET --prompt TEXT|--message TARGET=TEXT|--from-file PATH) [--queue|--wait-until-idle] [--timeout-ms N] [--idempotency-key KEY] [--prefill] [--worktree PATH] [--open-if-needed] [--output text|json]
sc agent read --to TARGET [--last N] [--worktree PATH] [--output text|json]
sc agent wait (--to TARGET [--to TARGET...]|--group NAME) --idle [--timeout-ms N] [--worktree PATH] [--open-if-needed] [--output text|json]
sc agent subscribe --to TARGET [--pattern TEXT] [--from-sequence N|--live-only] [--worktree PATH] [--output text|json]
sc agent stop --to TARGET [--to TARGET...] [--kill] [--worktree PATH] [--output text|json]
sc agent interrupt --to TARGET [--to TARGET...] [--signal interrupt|escape|ctrl-c] [--worktree PATH] [--output text|json]
sc agent should-stop --self [--worktree PATH] [--output text|json]
```

`agent send` has no `--dry-run`. Use it only after explicit user approval for
the exact target and prompt. For conversational follow-ups, use a separate wait
for idle, send with `--wait-until-idle` and an idempotency key, wait separately
for response completion, then read structured output:

```bash
"$SC" agent wait --to label:implementer --idle --timeout-ms 120000 --worktree /path/to/worktree --output json
"$SC" agent send --to label:implementer --prompt "Address the review findings." --wait-until-idle --idempotency-key review-fix-1 --worktree /path/to/worktree --output json
"$SC" agent wait --to label:implementer --idle --timeout-ms 600000 --worktree /path/to/worktree --output json
"$SC" agent read --to label:implementer --last 80 --worktree /path/to/worktree --output json
```

`--wait-until-idle` on `agent send` gates delivery; it does not prove the target
completed its response. Use `--queue` only for intentional deferred delivery,
because queued conversational messages may need later steering. Use `--prefill`
only when the user explicitly wants staged text rather than immediate execution.

### Team

```bash
sc team run --label LABEL [--provider KEY] --prompt TEXT [--label LABEL [--provider KEY] --prompt TEXT...] [--notify self] [--worktree PATH] [--output text|json]
sc team report --run ID --role LABEL --status done|failed --summary TEXT [--result-file PATH] [--worktree PATH] [--output text|json]
sc team status [--run ID] [--worktree PATH] [--output text|json]
sc team list [--worktree PATH] [--output text|json]
sc team cancel --run ID [--worktree PATH] [--output text|json]
```

`team run` launches **1-8 labeled roles in parallel as separate tabs**. It is a
fan-out primitive, not a sequencer: for strict ordering (A finishes, then B
starts), use `agent wait --to label:A --idle` between separate launches instead.

Lifecycle rules that affect correctness:

- Every role must finish by calling `sc team report`. A role that exits without
  reporting leaves the run unresolved.
- Results are delivered to a registered launching agent. Other CLI callers get
  only a completion notification and must read results with
  `team status --run ID`.
- Report summaries are capped at **16 KiB**; use `--result-file PATH` for
  anything larger rather than truncating the summary.
- `team cancel` is not guaranteed: the run stays active if any working role does
  not confirm it stopped. Verify with `team status` rather than assuming.
- After an app restart, every previously nonterminal run is marked `Interrupted`
  and is **not** resumed automatically.

`team status` and `team list` are read-only (gated by `team_runs_read`).
`team run`, `team report`, and `team cancel` mutate (gated by `team_runs`).

### Workspace

```bash
sc workspace list [--json]
sc workspace watch [--json]
sc workspace open PATH [--activate] [--json]
sc workspace create NAME [--type individual|shared-context|remote] [OPTIONS] [--json]
sc workspace get WORKSPACE_ID [--json]
sc workspace update WORKSPACE_ID [--name NAME] [ICON] [--json]
sc workspace add WORKSPACE_ID (--project PATH|--repository PATH|--remote-project PATH) [--json]
sc workspace theme WORKSPACE_ID [OPTIONS] [--json]
sc workspace move WORKSPACE_ID (--before TARGET_ID|--after TARGET_ID) [--json]
sc workspace delete WORKSPACE_ID --confirm [--json]
sc workspace select WORKSPACE_ID [--activate] [--json]
```

`workspace list` is the broadest read-only inventory: it prints workspaces in
sidebar order with sections, project groups, worktree rows (resolved sidebar
title, status, diff, PR), and nested agent-session rows with context usage where
known. Those nested session IDs (e.g. `v1.p0.t2`) are what
`worktree select --session` consumes.

`workspace watch` streams JSONL events — an initial snapshot plus revisioned
deltas — for observing changes without polling.

`workspace open PATH` opens the workspace containing `PATH`. A linked Git
worktree of a known project stays in that project's existing workspace; an
unknown project root creates a new app workspace. `select` changes the in-app
selection, and `--activate` additionally foregrounds the app.

Everything except `list`, `watch`, and `get` is state-changing. `add` mutates
type-specific contents in the background, and `delete` requires `--confirm`.

### Coordination State

```bash
sc coordination-state get KEY [--worktree PATH] [--output text|json]
sc coordination-state set KEY JSON [--if-version N] [--worktree PATH] [--output text|json]
sc coordination-state delete KEY [--if-version N] [--worktree PATH] [--output text|json]
sc coordination-state watch [KEY|--key KEY] [--from-version N] [--worktree PATH] [--output text|json]
```

Use `get` before `set` or `delete`. `set` and `delete` support optimistic
concurrency with `--if-version`; include it when updating an existing key.
A missing key returns `error.code:"not_found"`.

### Worktree

```bash
sc worktree status [--json]
sc worktree create --workspace WORKSPACE_ID --project PROJECT_ID [--worktree-name NAME] [--branch BRANCH | --existing-branch BRANCH] [--background] [--skip-setup-scripts] [--json]
sc worktree create [--project NAME_OR_ID] [--prompt TEXT|--stdin|--from-file PATH] [--provider KEY] [--model ID] [--reasoning LEVEL] [--background] [--skip-setup-scripts] [--json]
sc worktree ensure-child REPO_NAME [--json]
sc worktree open [PATH] [--activate] [--json]
sc worktree select ITEM_ID [--session SESSION_ID] [--workspace WORKSPACE_ID] [--activate] [--json]
sc worktree close ITEM_ID [--json]
sc worktree delete ITEM_ID [--force] [--json]
sc worktree checks [ITEM_ID] [--json]
sc worktree set-label ITEM_ID LABEL [--json]
sc worktree diff-summary [--file PATH] [--json]
sc worktree review-checklist [--json]
sc worktree review-list [--file PATH] [--status STATUS] [--json]
sc worktree review-get COMMENT_ID [--json]
sc worktree review-set-status COMMENT_ID STATUS [--json]
sc worktree review-add --file PATH (--start-line N --end-line N|--anchor file) [--provider KEY|--author NAME] [--side left|right] [--anchor-text TEXT] [--stdin|BODY] [--json]
sc worktree review-reply COMMENT_ID --provider KEY [--resolve] [--stdin|BODY] [--json]
sc worktree rename-branch NEW_NAME [--json]
sc worktree set-target-branch BRANCH [--json]
```

Worktree commands resolve from the current directory. In a directory without a
live Superconductor workspace, read probes such as `worktree status`,
`worktree diff-summary`, and review list/get/checklist commands can return
`error.code:"not_found"`.

Worktree and tab commands resolve the target worktree from the CLI process's
current directory. Run them from the live worktree root when possible.

`worktree create` now has two forms: an explicit
`--workspace WORKSPACE_ID --project PROJECT_ID` form with optional branch
selection, and the older prompt-driven form. Both create a managed worktree and
launch setup, both gained `--background` and `--skip-setup-scripts`, and neither
has a `--dry-run`. Creation requires an explicit task and user approval. Never
run it for target discovery, read recovery, or as a substitute for a missing
native session.

Other lifecycle commands and their exact blast radius:

- `worktree open [PATH]` registers an existing worktree — including one created
  outside the app with plain `git worktree add` — and selects it. Without
  `PATH` it opens the caller's own worktree.
- `worktree select ITEM_ID` changes only the in-app selection; `--activate`
  also foregrounds the app. `--session SESSION_ID` activates one nested
  agent-session row (IDs come from `workspace list`). `--workspace` disambiguates
  when a project belongs to several app workspaces; without it the active
  workspace wins if it contains the project, otherwise a sole containing
  workspace wins, and multiple candidates return an ambiguity error.
- `worktree close ITEM_ID` ends session state but preserves the checkout.
- `worktree delete ITEM_ID` removes the Git worktree and **refuses primary,
  dirty, or unpushed work unless `--force`**. Treat `--force` as destructive and
  never supply it to clear a refusal without explicit user instruction.
- `worktree checks [ITEM_ID]` prints PR/branch check details, refreshing missing
  detail through the app's PR service before returning. Read-only.
- `worktree ensure-child REPO_NAME` appears only in `sc help worktree`, not in
  top-level help.

Two separate rename-like commands exist and neither does what its name might
suggest. `worktree rename-branch` renames the Git branch only; it does not
rename a generated worktree directory or display label. `worktree set-label`
writes an explicit non-primary worktree's manual sidebar label and never renames
the branch or directory. Review mutations and target branch updates are also
state-changing.

### Tab

```bash
sc tab split --direction up|down|left|right [--active new|keep] [--worktree PATH] [--provider KEY] [--ui auto|chat|terminal] [--json]
sc tab split-view --direction up|down|left|right [--active new|keep] [--worktree PATH] [--provider KEY] [--ui auto|chat|terminal] [--json]
sc tab stop [--pane N] [--kill] [--output text|json]
sc tab title TITLE [--to TARGET [--worktree PATH] | --item ITEM_ID --session SESSION_ID [--workspace WORKSPACE_ID]] [--json]
```

Splitting, stopping, and title changes are state-changing.

`sc tab split` divides the active tab into panes; `split-view` divides the
active workspace view into views. `--direction left|right` arranges
side-by-side, `up|down` stacks. `--provider` launches a session in the new pane
or view; without it the new pane or view starts empty. For a new tab with two
providers side-by-side, run `sc layout run tabs --provider KEY_A` first, then
`sc tab split --direction right --provider KEY_B`.

`sc tab title` is no longer caller-identity-only. With no target flags it still
identifies the calling tab from `SUPERCONDUCTOR_TERMINAL_ID` and must be run
from a Superconductor-launched terminal. It now also accepts an explicit target
via `--to TARGET` or `--item ITEM_ID --session SESSION_ID`, which lets an
external shell retitle a specific tab. Note that `sc help tab` still documents
only the old form; the expanded signature comes from top-level help.

### Section

```bash
sc section list [--json]
sc section create NAME (--manual|--branch-glob GLOB|--rule DIMENSION=VALUES) [--json]
sc section edit SECTION [--name NAME] [--manual|--branch-glob GLOB|--rule DIMENSION=VALUES] [--priority N] [--json]
sc section delete SECTION [--json]
sc section move SECTION (--before TARGET|--after TARGET) [--json]
sc section assign SECTION [--json]
sc section unassign [--json]
```

Sidebar sections. Names or IDs are accepted; use `projects` for Projects. Filter
rules are repeatable and take comma-separated values, and priority is one-based.
`assign` moves the caller's worktree into a manual section; `unassign` removes
that manual placement. Only `list` is read-only.

### Commands

```bash
sc commands list [--scope global|workspace|project|shared] [--json]
sc commands get ID [--scope global|workspace|project|shared] [--json]
sc commands create NAME --command TEXT --scope global|workspace|project|shared [OPTIONS] [--json]
sc commands update ID --scope global|workspace|project|shared [OPTIONS] [--json]
sc commands delete ID --scope global|workspace|project|shared [--json]
```

Custom command CRUD. **IDs are the CRUD identity — names need not be unique**,
so never resolve a command by name for a mutation. Reads show effective commands
in launch order: global, workspace, shared, then project.

Scope determines both storage and blast radius. Personal `global`, `workspace`,
and `project` scopes live in App Settings and require the running app. `shared`
is **repository-owned**: scoped reads and mutations operate offline on the
effective `.superconductor/config.json`, so a `shared` mutation edits tracked
repo state rather than user settings. Confirm that intent before writing.

Worktree config inheritance has a sharp edge: in a linked worktree without a
config, reads inherit the main-repository config, and the first mutation copies
that complete config into the current worktree before editing. **Creating a
worktree config shadows the entire main-repo config, including scripts** — a
narrow command edit can therefore silently detach unrelated shared
configuration. Shared edits preserve unknown JSON fields, validate before
replacement, and use an atomic same-directory rename.

Create options include `--command TEXT` (required), `--dispatch
current-chat|new-tab`, `--view default|terminal|superconductor`,
`--provider KEY` (`none` runs a plain terminal), `--model ID`,
`--reasoning auto|low|medium|high|xhigh|max|ultra`, `--icon NAME_OR_EMOJI`, and
`--no-auto-submit`. Update also accepts `--name` and `--auto-submit`, plus
`--clear-provider`, `--clear-model`, `--clear-reasoning`, and `--clear-icon` to
remove an override.

### Project

```bash
sc project scripts [check|run|stop|status|set|unset] [OPTIONS] [--json]
```

Project configuration resolved for the current Git worktree. `scripts` reads
effective setup/run/lifecycle configuration. **Mutations require
`--scope user|repo`** so personal App Project Settings and repo-owned overrides
cannot be confused. Note that top-level help lists only `check|set|unset`; the
`run|stop|status` subcommands appear in `sc help project`. Run
`sc project scripts --help` for details.

### Browser

Every verb requires `Settings > Experimental > Browser automation`; when
disabled, commands return `feature_disabled` before reading or changing
anything. Top-level `--help` lists only a handful of verbs — run
`sc help browser` for the full set.

```bash
sc browser open URL [--split] [--tab ID] [--json]
sc browser back|forward|reload [--tab ID] [--json]
sc browser snapshot [--interactive-only] [--depth N] [--scope SELECTOR] [--diff] [--tab ID] [--json]
sc browser text [--tab ID] [--json]
sc browser find QUERY [--by text|role] [--tab ID] [--json]
sc browser get --what text|html|value|url|title|count|box [--ref REF] [--tab ID] [--json]
sc browser is --what visible|enabled|checked --ref REF [--tab ID] [--json]
sc browser screenshot [--out PATH] [--ref REF] [--tab ID] [--json]
sc browser pdf --out PATH [--tab ID] [--json]
sc browser console [--limit N] [--clear] [--tab ID] [--json]
sc browser network [--limit N] [--tab ID] [--json]
sc browser cookies get|set|delete [...] [--tab ID] [--json]
sc browser storage get|set|clear [--area local|session] [...] [--tab ID] [--json]
sc browser click REF [--double] [--tab ID] [--json]
sc browser hover|focus|clear|check|uncheck REF [--tab ID] [--json]
sc browser fill REF VALUE [--tab ID] [--json]
sc browser fill-form JSON [--tab ID] [--json]
sc browser press KEY [--tab ID] [--json]
sc browser scroll [--direction up|down|left|right] [--amount PX] [--ref REF] [--tab ID] [--json]
sc browser select REF VALUE... [--tab ID] [--json]
sc browser upload REF --files PATH... [--tab ID] [--json]
sc browser dialog accept|dismiss [--text TEXT] [--tab ID] [--json]
sc browser eval SCRIPT [--tab ID] [--json]
sc browser resize WIDTH HEIGHT [--tab ID] [--json]
sc browser tab list|new URL [--split]|switch ID|close [ID] [--json]
sc browser wait (--text TEXT|--selector SEL|--url URL|--load|--fn JS) [--state visible|hidden] [--timeout MS] [--tab ID] [--json]
```

The permission model has two tiers, and the boundary is not simply
read-versus-write:

- **Read tier** — runs for any authenticated caller: `snapshot`, `text`, `find`,
  `get`, `is`, `screenshot`, `pdf`, `console` (without `--clear`), `network`,
  `storage get`, `tab list`, and `wait` without `--fn`.
- **Act tier** — needs a one-time per-workspace grant from the user. The first
  act verb surfaces an Allow/Deny prompt in the app and returns
  `browser_consent_pending` until it is answered.

Three act-tier classifications are easy to get wrong:

- **Cookie reads are act-tier**, not read-tier, because they expose session
  credentials.
- **`console --clear` is act-tier**: a read verb with a mutating flag becomes an
  act verb.
- **`eval` and `wait --fn` are always act-tier**, since both execute arbitrary
  script in the page.

`browser resize` is documented as unsupported and always returns
`browser_not_implemented`.

## Target Model

Commands that act on sessions, panes, tabs, views, labels, or groups use
`--to TARGET`, `--from TARGET`, `--agent TARGET`, or group names depending on
the command.

Common selectors:

- `active-tab`
- `tab:N`
- `view:N`
- `view:N/tab:N`
- `view:N/tab:N/pane:N`
- `id:ID`
- `label:NAME`
- `group:NAME`

Visual selectors are 1-based and ordered by the current layout. They are
volatile if the layout changes. For durable automation, read stable IDs from
`agents list --output json` and target `id:<stable_target_id>` or apply and
target `label:NAME`.

Stable target IDs come from `agents list` or `agents get`. Current live stable
IDs can use `terminal:<uuid>` as well as earlier `chat:<uuid>` shapes. When
addressing a stable ID, include the selector prefix:

```bash
"$SC" agents get --to "id:terminal:00000000-0000-0000-0000-000000000000" --output json
```

The target's `current_selector` can also be used directly:

```bash
"$SC" agents get --to "view:1/tab:1/pane:1" --output json
"$SC" layout state --to "view:1/tab:1/pane:1" --output json
```

Do not pass a raw stable ID such as `terminal:<uuid>` without `id:`. That form
has been observed to fail validation.

`--self` is only for code running inside a Superconductor-managed terminal or
chat with `SUPERCONDUCTOR_TERMINAL_ID` set. External observers should not use
`--self`; from an ordinary shell it returns `invoking_identity_unknown`.

Never target yourself for send, stop, interrupt, move, or close operations.

### Cross-Worktree Targeting

For cross-worktree communication, first identify target worktrees and agents:

```bash
"$SC" chat list --json
"$SC" agents list --worktree /path/to/worktree-a --output json
"$SC" agents list --worktree /path/to/worktree-b --output json
```

Then scope sends, reads, waits, labels, groups, and coordination state to the
intended worktree when the command supports `--worktree PATH`:

```bash
"$SC" layout send \
  --worktree /path/to/worktree-a \
  --to view:1/tab:2/pane:1 \
  --to view:2/tab:1/pane:1 \
  --prompt "..." \
  --dry-run \
  --output json
```

`layout send` with multiple `--to` flags creates one send action per target
within the selected worktree scope. It is useful for broadcasting the same
prompt to several registered agents in one worktree. For multiple worktrees,
issue one scoped command per worktree, or use `chat send SESSION_ID` when a
specific chat session ID is the right target.

Native `sc chat ...` commands target API-chat sessions. Terminal-backed agents
are addressable through layout orchestration when the layout response returns a
tracked selector.

## Read-Only Probe Patterns

Use read-only probes before every mutation:

```bash
"$SC" agents get --to TARGET --output json
"$SC" layout state --to TARGET --output json
"$SC" layout read --to TARGET --last 20 --output json
"$SC" agent read --to TARGET --last 20 --output json
```

For an exact one-time read, start with `agents list --worktree PATH --output
json`, then inspect `agents get` or `layout state`. When structured reading is
advertised (`can_read_structured` or `capabilities.structured_read`), use
normalized `agent read`. For a readable unstructured `ui:"terminal"` target,
use `layout read`. Native output may be partial/live or truncated: retain the
reported consistency, cursor, and truncation metadata rather than presenting it
as a complete provider transcript.

If `agent read` returns `error.code:"no_provider_session"`, re-read the exact
target's state once. Use `layout read` only if it remains a readable terminal
target; otherwise report the mismatch and defer to the higher-level transcript
fallback. Do not create/open a workspace or worktree as read recovery.

For agent or layout state, honor fields such as:

- `can_send`
- `can_stop`
- `has_active_turn`
- `managed`
- `can_read`
- `can_read_structured`
- `capabilities.send`
- `capabilities.read`
- `capabilities.stop`
- `capabilities.interrupt`
- `capabilities.queue`
- `capabilities.subscribe`
- `capabilities.structured_read`
- `capabilities.prefill`
- `capabilities.model_override`
- `capabilities.reasoning_override`

If a target has `has_active_turn:true`, wait for idle before sending unless the
user explicitly requests queueing or interruption:

```bash
"$SC" agent wait --to TARGET --idle --timeout-ms 600000 --output json
```

Bound review and coordination loops before they start. Typical stop conditions
are no actionable findings, a max round count, a timeout, a budget, or an
explicit user stop.

## Mutating Surfaces and Guards

Do not run non-dry-run mutating commands without an explicit user request for
the exact action and target.

Dry-run support:

```bash
"$SC" layout run views --prompt "..." --dry-run --output json
"$SC" layout send --to TARGET --prompt "..." --dry-run --output json
"$SC" layout stop --to TARGET --dry-run --output json
"$SC" layout move --from TARGET --to DESTINATION --dry-run --output json
```

Important guard flags:

- `--prefill`: stage text when supported instead of immediately submitting.
- `--idempotency-key KEY`: make an approved `agent send` safer to retry.
- `--queue`: queue an `agent send` behind active work only when intentionally
  deferring delivery.
- `--wait-until-idle`: wait for target idle before delivery; wait separately
  after send for response completion.
- `--if-version N`: protect `coordination-state set/delete` from overwriting a
  changed key.

State-changing surfaces include:

- `chat new`, `chat select`, `chat send`, `chat cancel`, `chat stop`,
  `chat close`
- `layout set`, `layout close`, `layout insert`, `layout save`,
  `layout apply`, `layout delete`, non-dry-run `layout run`, `layout compose`,
  `layout send`, `layout stop`, and `layout move`
- `agents label set`, `agents label clear`, and all `agents group`
  create/add/remove/delete operations
- `agent send`, `agent stop`, and `agent interrupt`
- `team run`, `team report`, and `team cancel` (`team status` and `team list`
  are read-only)
- `workspace open`, `workspace create`, `workspace update`, `workspace add`,
  `workspace theme`, `workspace move`, `workspace select`, and
  `workspace delete` (requires `--confirm`)
- `section create`, `section edit`, `section delete`, `section move`,
  `section assign`, and `section unassign`
- `commands create`, `commands update`, and `commands delete` — note that
  `--scope shared` writes repository-owned `.superconductor/config.json`
- `project scripts set`, `project scripts unset`, `project scripts run`, and
  `project scripts stop` (mutations require `--scope user|repo`)
- `coordination-state set` and `coordination-state delete`
- `worktree review-set-status`, `worktree review-add`,
  `worktree review-reply`, `worktree rename-branch`,
  `worktree set-target-branch`, and `worktree set-label`
- `worktree create` (no dry-run), `worktree ensure-child`, `worktree open`,
  `worktree select`, `worktree close`, and `worktree delete` (destructive;
  `--force` overrides refusal on primary, dirty, or unpushed work)
- `tab split`, `tab split-view`, `tab stop`, and `tab title`
- every act-tier `browser` verb, including cookie reads, `console --clear`,
  `eval`, and `wait --fn`

Read-only surfaces safe for discovery: `status`, `instance current/list`,
`instructions`, `history list/get`, `chat list/providers`, `layout views`,
`layout capabilities`, `layout state`, `layout read`, `agents list/get`,
`agents group list`, `agent read`, `agent wait`, `agent subscribe`,
`agent should-stop`, `team status`, `team list`, `workspace list/watch/get`,
`section list`, `commands list/get`, `project scripts check/status`,
`coordination-state get/watch`, `worktree status/checks/diff-summary` and the
review read commands, and read-tier `browser` verbs.

## Safety Rules

Follow these rules for every `sc` session:

1. Probe `status --json` first and record the answering instance
   (`api_version`, `instance.pid`, `instance.build_commit`). Then check help via
   more than one path: `sc --help`, `sc help GROUP`, and
   `sc GROUP SUBCOMMAND --help` are each incomplete and are known to disagree,
   so never conclude a command or flag is absent from a single path.
2. Prefer read-only JSON probes.
3. Read target state and recent output before sending, stopping, moving, or
   closing anything.
4. Use explicit `--to` selectors from `agents list`, `agents get`, or
   `layout views`; do not use external-shell `--self`.
5. Wait for idle before sends unless the user explicitly requests queueing or
   interruption.
6. Honor `can_send`, `can_stop`, `has_active_turn`, `managed`, and capability
   fields.
7. Never target yourself.
8. Use dry-run where available before layout mutations.
9. Never run non-dry-run mutations without an explicit user request.
10. Match errors on `error.code`, not message text. `usage` — not
    `validation_failed` — is the code for bad options and selectors.
11. Resolve the target instance when `instance list` shows more than one live
    app; do not assume the inherited socket.

## Limits

- The Superconductor app must be running (except for `sc instructions`, which
  answers offline, and offline `commands --scope shared` reads/writes).
- The local API controls native API-chat sessions.
- Terminal-backed agents are controlled through layout orchestration when they
  have tracked selectors.
- Event replay is memory/process-local.
- `team` runs do not survive an app restart: previously nonterminal runs become
  `Interrupted` and are not resumed.
- `team cancel` is best-effort; a run stays active until every working role
  confirms it stopped.
- `team report` summaries are capped at 16 KiB.
- `browser resize` always returns `browser_not_implemented`.
- No single help path enumerates the full surface.

## Drift Checks

This snapshot is pinned to **API v31**. The surface moved 17 -> 31 between
captures, adding whole command groups, so treat any version delta as a signal to
re-probe rather than to trust this file.

Re-verify whenever the recorded `api_version` or `instance.build_commit`
differs from what `status --json` answers now, when a documented command or flag
is rejected, when an error code does not match, or before relying on this file
for a mutation.

### Step 1: Attribute the instance

```bash
SC="$HOME/.superconductor/bin/sc"
"$SC" status --json          # api_version + instance.pid + instance.build_commit
"$SC" instance list --json   # confirm which app answered; * marks current in text
```

Record `api_version`, `instance.pid`, and `instance.build_commit` with every
observation. An undated or unattributed note is not evidence and must be
re-probed rather than trusted.

### Step 2: Refresh the core read surfaces

```bash
"$SC" --help
"$SC" chat providers --json
"$SC" layout capabilities --output json
"$SC" layout views --output json
"$SC" agents list --output json
"$SC" team list --output json
"$SC" workspace list --json
```

Use `chat providers --json` for provider enablement and model/reasoning facts.
Do not preserve stale provider or model lists in downstream instructions. Check
`enabled` and non-empty `models` separately, and read
`layout capabilities.providers[]` for `available` and `structured_read` rather
than assuming either.

### Step 3: Cross-check help paths

Top-level help under-reports several groups, so also read group help and
per-command help. Inspect help only; do not execute mutations while verifying:

```bash
"$SC" help browser            # ~28 verbs vs 6 in top-level help
"$SC" help worktree           # ensure-child, select --session
"$SC" help workspace
"$SC" help project            # run|stop|status beyond check|set|unset
"$SC" help team
"$SC" help section
"$SC" help commands
"$SC" help agent
"$SC" instructions            # upstream's own agent-facing rules, app-independent
"$SC" worktree create --help
"$SC" project scripts --help
"$SC" layout compose -h
"$SC" layout run -h
"$SC" agent read -h
"$SC" layout read -h
```

Record any disagreement between paths as a finding. Note that `sc help` has no
topic for `layout`, `chat`, or `history`, and that `-h` on some subcommands
falls back to the entire top-level usage — that fallback means "no detail
available," not "no such flag."

### Step 4: Re-verify error codes

Error-code drift is silent and breaks automation without failing loudly. These
probes are read-only and safe:

```bash
"$SC" coordination-state get __drift_probe_missing__ --output json   # not_found
"$SC" agents get --to "label:__drift_probe_missing__" --output json  # not_found
"$SC" layout state --self --output json                              # invoking_identity_unknown (external shell)
"$SC" layout capabilities --worktree /tmp --output json              # usage
"$SC" agents get --to "terminal:00000000-0000-0000-0000-000000000000" --output json  # usage
```

Confirm `error.code` itself, not the message. The last two must return `usage`;
if guidance anywhere still matches `validation_failed` as a code, that guidance
is stale.

### Step 5: Check envelope shape

Confirm the fields this file pins still exist: `status.instance`,
`layout_capabilities.team_runs` / `team_runs_read` /
`layout_orchestration.compose` / `providers[]`, and `layout_views` `view_id`.
A missing or renamed field means downstream parsing assumptions need review.
