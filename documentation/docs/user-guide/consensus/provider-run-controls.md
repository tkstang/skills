---
title: 'Provider run controls'
description: 'Consensus run output modes, retries, timeouts, process cleanup, and Claude and Codex write policies.'
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
  missing `subtype` too) fails with `PROVIDER_MALFORMED_RESULT`.
- Codex: the `--output-last-message` file must exist and hold non-blank text.
- Empty output or whitespace-only text fails with `PROVIDER_EMPTY_OUTPUT`.

Neither failure is retried: the provider finished its turn, so only a
transient process failure on a read-only profile is retried.

Cursor text mode accepts only `--permission-mode read-only`. Every other Cursor
profile, including an omitted one, runs `cursor-agent --print --force`, which
auto-approves commands, so text mode rejects it before spawn with
`PROVIDER_UNSUPPORTED_OPTION`. JSON-mode Cursor runs are unchanged.

## Attempts and retries

`--max-attempts` (`max_attempts`) above 1 is accepted only for a profile that
is explicitly read-only, so a retried turn cannot repeat writes:

- Codex with `--sandbox read-only` set explicitly.
- Claude with `--permission-mode read-only` and no edit or Bash grant.
- Cursor with `--permission-mode read-only`.

Every other profile runs once, and a higher value is rejected as
`CONSENSUS_CLI_USAGE` before spawn. That includes an omitted Codex sandbox,
Claude's default `non-interactive` mode (which installs no restrictions), any
Bash or edit grant, and `workspace-write`. Native resume is always a single
attempt.

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

For provider readiness and authentication, see [Provider setup](provider-setup.md).
Saved workflow defaults live in [Configuration](configuration.md).
