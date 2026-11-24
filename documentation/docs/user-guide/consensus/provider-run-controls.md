---
title: 'Provider run controls'
description: 'Consensus run output modes, retries, timeouts, process cleanup, Claude and Codex write policies, and extended-provider runs.'
---

# Provider run controls

These `consensus run` controls apply to every caller, through flags or
`--request-json`, and are checked after the runtime policy is normalized and
before any provider process starts. A registered provider that is not admitted
is refused before these checks, and declared prerequisites are checked last,
before spawn; see
[Prerequisites, version pins, and admission](provider-setup.md#prerequisites-version-pins-and-admission).

## Output modes

`--output json` (the default) returns a schema-validated JSON reply and needs
`--schema`. `--output text` returns the provider's final reply as free-form
text and takes no schema; passing both is a usage error. In request JSON the
fields are `output` and `schema_path`, with the same pairing rule.

A text-mode turn reads no schema, adds no schema or submit instructions to
your prompt (an extended provider's prompt still gets consensus's read-only
lines; see
[What every extended run gets](provider-setup.md#what-every-extended-run-gets)),
validates nothing, and turns `consensus submit` capture off: no `.consensus/submit`
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
- Extended providers: the ACP session must end its turn (`end_turn`) with
  non-blank answer text; see [Extended provider runs](#extended-provider-runs).
- Empty output or whitespace-only text fails with `PROVIDER_EMPTY_OUTPUT`.

Neither failure is retried: the provider finished its turn, so only a
transient process failure on a read-only profile is retried.

Cursor text mode accepts only `--permission-mode read-only`. Every other Cursor
profile, including an omitted one, runs `cursor-agent --print --force`, which
auto-approves commands, so text mode rejects it before spawn with
`PROVIDER_UNSUPPORTED_OPTION`. JSON-mode Cursor runs are unchanged.

## Attempts and retries

`--max-attempts` (`max_attempts`) above 1 is accepted only for a profile that
is explicitly read-only, so the provider's own tools cannot write on a
retried turn. A retry starts a new provider invocation, so hooks, helpers, or
MCP servers that the provider loads from repository or user configuration at
startup run again:

- Codex with `--sandbox read-only` set explicitly.
- Claude with `--permission-mode read-only` and no edit or Bash grant.
- Cursor with `--permission-mode read-only`.

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

Extended providers differ in one way: their process group is signalled on
every exit path, a normal exit included (on Windows, the agent process only).
Consensus closes the ACP session where the agent supports that (not after an
output-cap breach), closes its stdin, and waits up to two seconds for the
agent to exit (no wait after an interrupt). It then signals the group with
SIGTERM, or the forwarded interrupt signal, sends SIGKILL half a second later
if anything in the group survives, and waits up to a second more for the group
to go. Helpers in the agent's process group, such as MCP servers it started,
are stopped with it unless teardown cannot confirm the group exited (below);
a helper that moves to its own process group escapes it, as Droid's MCP
servers do. When a timeout, output-cap breach, interrupt,
or mode change stops a turn whose prompt is in flight, it sends
`session/cancel` first. `diagnostics.acp.teardown` records the signals sent
and `settled_by`, the step that ended teardown. `settlement_timeout` means
the group was still present after SIGKILL and the final wait, so its exit was
not confirmed; the run keeps its own outcome and adds a warning to
`diagnostics.warnings`. If removing Antigravity's private settings directory
then fails, the run fails with that error instead, and the error ends with
the same warning.

## Claude permission profiles

Each accepted pairing of `--permission-mode` and Claude grants maps to one set
of Claude flags. Any other pairing is rejected with
`PROVIDER_UNSUPPORTED_OPTION` before spawn. `--tools` is always explicit when
grants apply, because `--allowedTools` alone does not exclude other tools.

| Profile                                        | `--permission-mode` | Tools (`--tools`)                                          | Pre-approved (`--allowedTools`)      | Other flags                                     |
| ---------------------------------------------- | ------------------- | ---------------------------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| `read-only`                                    | `plan`              | Claude's default for plan mode                             | none                                 | none                                            |
| `read-only` + `--allow-read <file>`            | `dontAsk`           | `Read,Glob,Grep`                                           | `Read(/<file>)` per grant            | `--permission-prompts none --strict-mcp-config` |
| `non-interactive` (the default)                | none                | Claude's default                                           | none                                 | none                                            |
| `non-interactive` + read, edit, or web grants  | `dontAsk`           | the granted tools                                          | each grant                           | `--permission-prompts none --strict-mcp-config` |
| `workspace-write`, optionally + `--allow-bash` | `acceptEdits`       | `Read,Glob,Grep,Edit,Write`, plus `Bash` with a Bash grant | `Bash(<pattern>)` per `--allow-bash` | `--permission-prompts none --strict-mcp-config` |

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
paths and command arguments stay out of diagnostics.

These are Claude Code permission rules, not an operating-system sandbox. An
authorized live check (Claude Code 2.1.322, 2026-11-11, linked worktree) found
that `workspace-write` denied Write-tool and shell-redirection writes outside
the worktree and an ungranted `python3` command, and allowed a granted
`git status`. Two limits remain:

- `acceptEdits` auto-approves simple filesystem commands such as `touch`
  inside the working directory, even with no Bash grant.
- Your own user and project allow rules still apply. An interpreter you have
  allowlisted yourself, such as `Bash(node:*)`, is not blocked.

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

## Extended provider runs

The extended providers (`antigravity`, `gemini`, `droid`) are experimental;
setup, sign-in, and per-provider limits are in
[Extended providers](provider-setup.md#extended-providers). Every run is
read-only, text-only, and single-attempt, and needs a model. Consensus confirms
the provider's read-only mode and the model before it sends the prompt, and
answers every permission request with a denial.

An extended peer loads its own CLI's configuration, except an Antigravity run
on `GEMINI_API_KEY`, which uses a private temporary settings directory that is
removed after the run. Either way the CLI can run code from its configuration
without a permission request: repository hooks, plugins, and MCP servers, and,
outside that private directory, your user ones. The read-only controls govern
the agent's tool calls, not that code, and the
working-tree check below is a backstop, not isolation: run extended peers
only in checkouts and with provider configuration you control. See
[What every extended run gets](provider-setup.md#what-every-extended-run-gets).

### Working-tree check

Consensus checks the whole git work tree that contains the working directory
around every extended read-only turn, so direct `consensus run` calls are
covered as well as delegate:

- Before launch it records `HEAD`; the entries of
  `git status --porcelain=v1 -z --untracked-files=all`; a fingerprint of
  every path that status lists and of every index entry marked
  assume-unchanged or skip-worktree, which status never reports; the
  permission bits of every other tracked file; and `.git/info/exclude`. A
  fingerprint is a SHA-256 of the content plus the permission bits for a
  regular file, a SHA-256 of the target for a symbolic link, and a fixed
  marker for a directory. Tracked entries are listed from the repository
  root, so a working directory in a subdirectory still covers the whole tree.
- The snapshot writes nothing and runs no filters: no `git add`, no index
  refresh, and every filter driver configured for the repository, or for any
  checked-out submodule, is switched off. Status is git's own comparison with
  the index and HEAD, made with those filters off; git's built-in conversions
  still apply (see the limits below). If a filter driver's name or a
  checked-out submodule's path is not valid UTF-8, consensus cannot switch
  that filter off, so the snapshot fails. git
  runs with fsmonitor and the untracked cache turned off and `core.filemode`
  on, so a repository setting cannot hide a content or file-mode change. From
  your environment git gets only `PATH`, `HOME`, `XDG_CONFIG_HOME`, the
  temporary directory and locale variables, `USER`, `LOGNAME`, and
  `GIT_CEILING_DIRECTORIES`, so it sees no credentials and an inherited
  `GIT_DIR` or `GIT_INDEX_FILE` cannot point it at another repository.
- If the working directory is not inside a git work tree, or the snapshot
  fails, the run is refused before launch with `PROVIDER_UNSUPPORTED_OPTION`
  and `attempts.terminal_reason: "working_tree_unavailable"`.
- Once the bounded teardown of the agent's process group has returned (see
  [Timeouts and process cleanup](#timeouts-and-process-cleanup)), it takes the
  same snapshot again. Teardown does not always confirm that the group exited;
  `settled_by: "settlement_timeout"` and its warning say when it did not.
- Any change to `HEAD`, the status entries, or a recorded file's content or
  permission bits fails the run with `PROVIDER_WORKTREE_CHANGED`
  (`retryable: false`, `attempts.terminal_reason: "working_tree_changed"`),
  even when the turn succeeded. The message names up to 20 changed paths,
  `HEAD` first when it moved, and says how the turn itself ended;
  `diagnostics.working_tree_changes` lists them all. A checkout that cannot
  be read afterwards is reported as changed, without a list. The receipt's
  `turn` keeps the turn's own state.
- A run that fails with an error, instead of returning a result, is checked
  too. If the checkout changed or cannot be re-read, the run returns
  `PROVIDER_WORKTREE_CHANGED` with no `stdout` or `stderr`, and the error,
  redacted, at the end of the message and in `diagnostics.warnings` as
  `The run failed: <error>`. `turn` is `"unknown"`, or `"not_started"` with
  `attempts.cli_attempts` 0 when the run failed before the agent was
  launched, such as while writing Antigravity's private settings directory.
  If the checkout is unchanged, the CLI prints the redacted error to stderr
  and exits 1 without an envelope.

The check is a loud backstop, not the prevention: the confirmed read-only mode
and the denials are what keep the agent from writing. It cannot tell the
agent's changes from your own edits made during the run, and it does not see:

- ignored files;
- a byte change that git's built-in conversions (line endings, `ident`,
  `working-tree-encoding`) normalize back to the indexed content;
- a case-only rename on a case-insensitive file system;
- changes inside an untracked nested git repository;
- a change inside a checked-out submodule beyond what `git status` reports
  for it;
- writes outside the work tree, including any made by provider hooks or MCP
  servers.

### Failure codes

- `PROVIDER_PERMISSION_DENIED`: the agent asked for a tool outside read-only,
  was denied, and ended the turn without an answer: an empty `end_turn`
  reply, or a turn cancelled after a denial, as Droid does. The message names
  the denied tools; `turn` is `completed`. Text a cancelled turn sent before
  it ended stays in `stdout` and is not an answer. A turn that was denied a
  tool but still ended normally with answer text succeeds, with a warning. In both cases `diagnostics.permission_denials`
  gives `count`, `tools`, and `requests`: each denied request's `tool`, ACP
  `kind`, and first `path`, relative to the working directory when inside it.
  It never holds tool input or file content.
- `PROVIDER_WORKTREE_CHANGED`: see above.
- `PROVIDER_AUTH_REQUIRED`: the agent is not signed in; the message adds the
  provider's sign-in hint.
- `PROVIDER_UNSUPPORTED_OPTION`, refused before launch: an unsupported
  option, no model (`model_required`), or no git checkout
  (`working_tree_unavailable`). After launch but before the prompt is sent,
  with `turn: "not_started"`: a model the agent does not offer
  (`provider_unsupported_option`; the message names up to five that it does),
  or a read-only mode or model the agent did not confirm, or a contrary mode
  or autonomy update reported while the read-only mode is being confirmed or
  held (`acp_setup_unconfirmed`). A mode report that arrives before setup,
  even before the agent's `session/new` reply, counts as the starting state.
  If it disagrees with the mode that reply names, or was dropped because
  early reports for four sessions were already held, a provider whose
  read-only mode is its starting mode (Antigravity's `default`) cannot
  confirm it and fails here.
- `PROVIDER_LIMIT_REACHED`: a `max_tokens` or `max_turn_requests` stop, or a
  quota error the provider returned as answer text.
- `PROVIDER_EMPTY_OUTPUT`: the turn ended with no answer text and no denial.
- `PROVIDER_EXIT` with `attempts.terminal_reason: "acp_mode_changed"`: the
  agent reported leaving its read-only mode during the turn. Consensus
  cancelled the turn and does not return it as an answer; `turn` is
  `unknown`.

A failure envelope's `stdout` holds only the answer text gathered before the
failure, never the internal turn record. It is empty after
`acp_mode_changed`. Redaction is pattern- and value-based, so it cannot
recognize every secret:

- Answer text, in `text` or `stdout`, loses the values of the provider's
  credential variables (values shorter than six characters are not matched)
  and provider patterns such as Droid's pairing code.
- When the answer is error text or a stop at a limit
  (`attempts.terminal_reason` `acp_error_text` or `provider_limit_reached`),
  its `stdout`, and any of it the message quotes, also lose common credential
  shapes: Google
  API keys, `sk-`, `ghp_`, `github_pat_`, and similar tokens, JWTs, and
  `Bearer` tokens.
- Messages, metadata, denial details, working-tree change paths, and `stderr`
  get the same full redaction. Consensus keeps up to 64 KiB of `stderr`.
  Once a chunk is cut, by that limit or by the combined output cap, nothing
  later is kept, and the kept text ends at its last complete line before the
  cut, so redaction never sees a partial line.
  `diagnostics.output_bytes.stderr` counts the stderr bytes observed up to
  and including the chunk that crosses the combined output cap, so it can
  exceed what was kept.

`diagnostics.acp` records the agent's name and version, whether the run used
an API key or the saved sign-in, each setup step and what confirmed it, the
stop reason, and the teardown. It never holds answer text, raw ACP messages,
or tool input; the agent-supplied strings it does hold are redacted like other
metadata.

For provider readiness and authentication, see [Provider setup](provider-setup.md).
Saved workflow defaults live in [Configuration](configuration.md).
