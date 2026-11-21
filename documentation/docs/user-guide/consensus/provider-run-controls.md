---
title: 'Provider run controls'
description: 'Consensus run output modes, retries, timeouts, process cleanup, Claude and Codex write policies, and read-only isolation.'
---

# Provider run controls

These `consensus run` controls apply to every caller, through flags or
`--request-json`, and are checked after the runtime policy is normalized and
before any provider process starts.

## Output modes

`--output json` (the default) returns a schema-validated JSON reply and needs
`--schema`. `--output text` returns the provider's final reply as free-form
text and takes no schema; passing both is a usage error. In request JSON the
fields are `output` and `schema_path`, with the same pairing rule.

A text-mode turn reads no schema, adds nothing to your prompt, validates
nothing, and turns `consensus submit` capture off: no `.consensus/submit`
sidecar, no submit instructions, and every `CONSENSUS_SUBMIT_*` variable is
removed from the provider's environment, even one named with `--env-allow`.

The success envelope stays `schema_version: "v1"` and carries `output_kind`:

| Mode | `output_kind` | Reply fields                             |
| ---- | ------------- | ---------------------------------------- |
| JSON | `"json"`      | `json` holds the validated reply         |
| Text | `"text"`      | `text` holds the reply; `json` is `null` |

`stdout`, `attempts`, `diagnostics`, and `continuation` keep their meaning in
both modes.

Text extraction is strict, and output that cannot be read is a failure, never
raw-text success:

- Claude and Cursor: stdout must be the provider's JSON result object with a
  non-blank string `result`. Unparseable output, a result without a string
  `result`, `is_error: true`, or a `subtype` other than `success` (for Claude, a
  missing `subtype` too) fails with `PROVIDER_MALFORMED_RESULT`, unless it is a
  recognized provider limit error as described below.
- Codex: the `--output-last-message` file must exist and hold non-blank text.
- Empty output or whitespace-only text fails with `PROVIDER_EMPTY_OUTPUT`.

Neither failure is retried: the provider finished its turn, so only a
transient process failure on a read-only profile is retried.

Cursor text mode accepts only `--permission-mode read-only`. Every other Cursor
profile, including an omitted one, runs `cursor-agent --print --force`, which
auto-approves commands, so text mode rejects it before spawn with
`PROVIDER_UNSUPPORTED_OPTION`. JSON-mode Cursor runs are not subject to this
gate. In either mode, a read-only Cursor run is refused when the repository
configures hooks; see [Read-only isolation](#read-only-isolation).

## Attempts and retries

`--max-attempts` (`max_attempts`) above 1 is accepted only for a profile that
is explicitly read-only, so a retried turn cannot repeat writes:

- Codex with `--sandbox read-only` set explicitly.
- Claude with `--permission-mode read-only` and no edit or Bash grant.
- Cursor with `--permission-mode read-only`.

These are also the profiles that get read-only isolation: Claude and Codex
load no repository configuration, and Cursor is refused when the repository
configures hooks; see [Read-only isolation](#read-only-isolation).

Every other profile runs once, and a higher value is rejected as
`CONSENSUS_CLI_USAGE` before spawn. That includes an omitted Codex sandbox,
Claude's default `non-interactive` mode (which installs no restrictions), any
Bash or edit grant, and `workspace-write`. Native resume is always a single
attempt.

Recognized usage, quota, and rate-limit rejections return
`PROVIDER_LIMIT_REACHED`, `retryable: false`, and
`attempts.terminal_reason: "provider_limit_reached"`. They stop this run even
when attempts remain. The envelope's `message` contains the provider's human
message, including Claude's reset time when supplied.

Detection uses Claude API-error metadata, grounded Codex provider error-event
messages, and explicit 429 or rate-limit rejections on stderr. Cursor's internal
quota codes are not exposed by its headless CLI in a stable form, so they are
not matched speculatively. A successful peer reply quoting a limit is not a
provider rejection.

A limit can occur after work has started. `continuation.turn` is `not_started`
only when a first-attempt Claude rejection reports `num_turns: 1`, zero aggregate
input/output tokens, absent or zero cache-read/cache-creation counters, and no
model-usage entries. Missing input/output counters, prior output,
and prior attempts leave it `unknown`; inspect possible file changes before
resubmitting. Exit status zero does not turn a recognized error into success.

## Timeouts and process cleanup

`--timeout-sec` defaults to 300 seconds. On macOS and Linux the provider runs
as the leader of its own process group. When a run times out or exceeds
`--max-output-bytes`, consensus sends SIGTERM to the whole group, then SIGKILL
to the group after a short grace period, even if the provider itself has
already exited, so a descendant that ignores SIGTERM does not survive. A group
that is already gone counts as stopped, settlement is time-bounded, and the
envelope's `diagnostics.termination` records the signals sent and which step
ended the run. A provider that exits normally is never signalled. An interrupt
(SIGINT, SIGTERM, or SIGHUP, such as Ctrl-C) sent to the consensus CLI is
forwarded to the provider's group and escalates to SIGKILL after the same grace
period, or at once if the interrupt is repeated. An interrupted run is never
retried. The CLI then re-raises the signal and exits by it, unless another
listener in the same process owns it; `diagnostics.termination.reason` is
`interrupt`. A process
that moves itself to another process group or session escapes this cleanup.
On Windows only the provider process is signalled, as before.

## Claude permission profiles

Each accepted pairing of `--permission-mode` and Claude grants maps to one set
of Claude flags. Any other pairing is rejected with
`PROVIDER_UNSUPPORTED_OPTION` before spawn. `--tools` is always explicit when
grants apply, because `--allowedTools` alone does not exclude other tools.

| Profile                                        | `--permission-mode` | Tools (`--tools`)                                          | Pre-approved (`--allowedTools`)      | Other flags                                                            |
| ---------------------------------------------- | ------------------- | ---------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `read-only`                                    | `plan`              | Claude's default for plan mode                             | none                                 | `--setting-sources user --strict-mcp-config`                           |
| `read-only` + `--allow-read <file>`            | `dontAsk`           | `Read,Glob,Grep`                                           | `Read(/<file>)` per grant            | `--permission-prompts none --setting-sources user --strict-mcp-config` |
| `non-interactive` (the default)                | none                | Claude's default                                           | none                                 | none                                                                   |
| `non-interactive` + read, edit, or web grants  | `dontAsk`           | the granted tools                                          | each grant                           | `--permission-prompts none --strict-mcp-config`                        |
| `workspace-write`, optionally + `--allow-bash` | `acceptEdits`       | `Read,Glob,Grep,Edit,Write`, plus `Bash` with a Bash grant | `Bash(<pattern>)` per `--allow-bash` | `--permission-prompts none --strict-mcp-config`                        |

A read grant prefixes the absolute path with `/`, so `--allow-read /repo/a.md`
becomes `Read(//repo/a.md)`, Claude's form for an absolute path.

`--allow-bash <pattern>` is repeatable and accepted only with
`workspace-write`. A pattern such as `git status:*` is at most 256 characters,
has no leading or trailing whitespace, contains no parentheses, commas, or
control characters (so it is one line), and must name a command rather than
only wildcards.
The envelope's `diagnostics.permission_profile` records the Claude mode, tool
list, and allow list that the run applied; Read/Edit paths and Bash patterns
appear as `Read(<path>)`, `Edit(<path>)`, and `Bash(<pattern>)`, so private
paths and command arguments stay out of diagnostics. The read-only isolation
flags appear in `diagnostics.redacted_command`, not in `permission_profile`.

These are Claude Code permission rules, not an operating-system sandbox. An
authorized live check (Claude Code 2.1.322, 2026-11-11, linked worktree) found
that `workspace-write` denied Write-tool and shell-redirection writes outside
the worktree and an ungranted `python3` command, and allowed a granted
`git status`. Two limits remain:

- `acceptEdits` auto-approves simple filesystem commands such as `touch`
  inside the working directory, even with no Bash grant.
- Your own user and project allow rules still apply, because write profiles
  load project settings. An interpreter you have allowlisted yourself, such as
  `Bash(node:*)`, is not blocked.

A resumed write turn (`--resume`) repeats the same flags; the same live check
confirmed that the resumed session kept its mode, tool set, and allowlist.

## Codex write runs

Codex `--sandbox workspace-write --approval-policy never` edits inside the
working directory and is denied writes outside it. Network access is whatever
your Codex sandbox configuration says: the invocation does not override it,
so do not assume network is off. A resumed turn sets the same sandbox through
`-c sandbox_mode=...`, which a live check (codex-cli 0.166.0, 2026-11-11)
confirmed applies over an ambient `danger-full-access` config.

In a linked worktree, Codex cannot stage or commit: the worktree's git index
lives under the main checkout's `.git/worktrees/`, outside the writable root,
so `git add` and `git commit` fail with `Operation not permitted`. consensus
never widens the sandbox for this. The peer leaves its changes unstaged, and
the host stages and commits them.

## Read-only isolation

The three read-only profiles listed under
[Attempts and retries](#attempts-and-retries) keep a repository from running
code through a peer that is only meant to read it. Read-only Claude and Codex
peers do not load configuration that the repository controls. Read-only Cursor
has no such flags: it still trusts the workspace and loads the repository's
other Cursor configuration and instructions, and consensus only refuses the
run when the repository configures hooks. Every other profile is unchanged and
still loads repository configuration. That includes `non-interactive`, `workspace-write`,
`delegate` write runs, and the `create`, `decide`, `plan`, `refine`,
`evaluate`, and `panel` loops, which send no runtime policy.

- **Claude** adds `--setting-sources user --strict-mcp-config` to every turn,
  including `--resume`. The peer loads no project or local settings, so no
  repository hooks, `env`, helper commands, permission rules (deny rules
  included), or `enabledPlugins`. It connects no MCP server at all: not
  `.mcp.json`, not your user `.claude.json` servers, and not claude.ai
  connectors. It also does not load the project's `CLAUDE.md`, `AGENTS.md`,
  `.claude/rules`, or project skills, agents, and commands. Your user settings
  and hooks, user allow rules, user `CLAUDE.md`, auto memory, and managed
  policy still apply. Plan mode is still not strictly read-only: user allow
  rules, user `PermissionRequest` hooks, and, where auto mode is available,
  classifier-approved commands can still run shell commands.
- **Codex** adds `--ignore-user-config --ignore-rules --disable hooks` to new
  and resumed turns. `$CODEX_HOME/config.toml` is not loaded, and because
  project trust lives there, the repository's `.codex/` config, hooks, and MCP
  servers are skipped. Execpolicy `.rules` files are ignored, so your allow
  rules no longer run commands outside the sandbox, and hooks are off. The
  peer also loses your MCP servers, `notify`, profiles, `model_provider`, and
  `model_providers`; a custom provider defined only in `config.toml` is not
  used unless your [provider program](provider-setup.md#provider-programs)
  passes it inline. When the request sets no model or effort, consensus reads
  the top-level `model` and `model_reasoning_effort` string values from the
  provider's `$CODEX_HOME/config.toml` (or `$HOME/.codex/config.toml`) and
  passes them as `--model` and `-c model_reasoning_effort=...`. Nothing else
  from that file is used, an explicit `--model` or `--effort` wins, and a
  relative `CODEX_HOME` leaves the defaults to Codex.
- **Cursor** has no flag that disables repository hooks, and `cursor-agent`
  runs them without a permission request, even in ask mode. Immediately
  before every spawn, retries included, consensus finds the root `cursor-agent` uses: the
  nearest ancestor of the working directory (resolved physically) that holds a
  `.git` entry, where a linked worktree's `.git` file stops at the worktree,
  or else the working directory itself. It refuses the run with `PROVIDER_UNSUPPORTED_OPTION` and
  `attempts.terminal_reason: "cursor_repo_hooks"`, without launching that
  attempt, when
  `<root>/.cursor/hooks.json`, `<root>/.claude/settings.json`, or
  `<root>/.claude/settings.local.json` has a `hooks` object with any non-empty
  array, or cannot be read or parsed; it also refuses when the working
  directory cannot be resolved. The envelope's message names the file and the
  cause. If hooks appear between retries, the earlier attempts have already
  run, and `attempts.cli_attempts` counts them. The rule is deliberately broader than
  Cursor's own loader. A root that is your home directory gets no exemption,
  since a checkout rooted there can track those files. Read-only Cursor is therefore
  unavailable in a repository that configures Claude Code or Cursor hooks.

The trade-off: a read-only Claude peer no longer reads the repository's
`CLAUDE.md`, `AGENTS.md`, or `.claude/rules`, a read-only Codex peer runs
without your `config.toml` settings, and read-only Cursor is unavailable in a
repository with hooks. Put the repository conventions a
read-only peer needs into its prompt or brief.

For provider readiness and authentication, see [Provider setup](provider-setup.md).
Saved workflow defaults live in [Configuration](configuration.md).
