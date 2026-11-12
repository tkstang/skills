---
name: delegate
description: Use when the user asks to hand a task to another AI provider (Codex, Claude, or Cursor), such as implementing a change, fixing a bug, or investigating a failure, and the host must verify the result. Code changes run in a dedicated git worktree; questions and investigations run read-only. For an opinion use phone-a-friend; for a bounded review use review.
license: MIT
compatibility: Agent Skills baseline; requires Node.js 22+, git, and the generated consensus CLI.
allowed-tools: Bash(node:*), Bash(git:*), Read, Write
argument-hint: ["<task>"] [--peer <provider-id>] [--model <model>] [--effort <effort>]
metadata:
  author: Thomas Stang
  version: '0.1.0'
---

# Delegate

Hand one task to another provider through the bundled consensus CLI, then check
its work yourself. The peer's reply and its list of changes are claims. You
compute the changes from your own baseline, read the full diff, rerun the
verification command, and hand the result to the user. Nothing is merged or
pushed: the skill ends at "diff reviewed by the host; the user decides".

Use `phone-a-friend` when you want an opinion to disposition, and `review` when
an independent reviewer should inspect a bounded branch, file set, or document.

## Choose the mode

- **Write**: the user asks you to delegate a task and the task calls for
  changing code or files ("have Codex fix the flaky test", "get Claude to add
  the flag"). The user does not have to say "write".
- **Read-only**: you consult a peer on your own initiative, or the user's ask
  is a question, review, or investigation ("have Codex look into why X fails").
- If you genuinely cannot tell, ask one short question.

Cursor runs read-only only. For a write task naming Cursor, say so and offer a
read-only run or another peer.

## Prerequisites

Resolve `<skill-dir>` to the absolute directory containing this loaded
`SKILL.md`. Node.js 22+, git, and the peer's provider CLI must be installed and
authenticated. Do not assume a globally installed `consensus` command.

Pick the peer: the provider the user named, or else a ready provider other than
you. Preflight only that provider:

```bash
node <skill-dir>/scripts/consensus.mjs preflight --json --provider <peer> --capability run
```

If it is not `ready`, try the next provider other than you (skip Cursor for a
write run). If none is ready, report it and stop; the user may name any peer,
including your own provider.

## Workflow

1. **Write the brief** from the [brief template](references/brief-template.md):
   `<task>`, `<output_contract>`, and `<verification_loop>` blocks, with the
   exact verification command. Include only the context the task needs, and
   never secrets or credentials. Save it outside the worktree so it does not
   show up as a change.
2. **Write mode only: set up the worktree.** Follow
   [worktree writes](references/worktree-writes.md): create a dedicated linked
   worktree from a commit, never your own checkout, then take the baseline
   snapshot in [accounting](references/accounting.md). One writer per worktree:
   do not edit it yourself while the peer runs.
3. **Run once** with the command in [Invocation](#invocation). Save the JSON
   envelope to a file outside the worktree.
4. **Read the envelope**, not the exit code. Provider failures exit `0` with
   `ok: false`; usage errors exit `2`. See [Failures](#failures).
5. **Write mode: account for the changes** with the after-run procedure in
   [accounting](references/accounting.md). Report any commit the peer made;
   never accept one silently.
6. **Verify.** Read the full diff (write mode) or check the load-bearing claims
   against source (read-only). Rerun the brief's verification command yourself
   in the same directory. Give a reason for every claim or change you dismiss.
7. **Report and stop.** Give the user the report from
   [accounting](references/accounting.md#report), your verification result, and
   your assessment. The user decides what happens next: commit, bring the
   changes into their branch, continue with the peer, or discard. Do those only
   when asked, and never merge or push.

## Invocation

Run from the caller project:

```bash
node <skill-dir>/scripts/consensus.mjs run --provider <peer> \
  [--model <model>] [--effort <effort>] <mode-flags> \
  --cwd <dir> --prompt-file <brief> --timeout-sec <seconds> \
  [--env-allow <NAME>]... --consultation-id <id> --round 1 \
  --output text --max-attempts 1 --max-depth 1 --json > <state-dir>/turn-1.json
```

| Input         | Default                                     | Notes                                                             |
| ------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `peer`        | a ready provider other than you             | `--provider`; the user may name any peer                          |
| `model`       | provider default                            | `--model`, only when asked; Cursor takes none                     |
| `effort`      | provider default                            | `--effort`, only when asked; Cursor takes none                    |
| `brief`       | required                                    | `--prompt-file`                                                   |
| `mode`        | by [Choose the mode](#choose-the-mode)      | `<mode-flags>` below                                              |
| `cwd`         | repo root (read-only); the worktree (write) | `--cwd`                                                           |
| `env_allow`   | none                                        | repeatable `--env-allow`; `CONSENSUS_SUBMIT_*` is always stripped |
| `timeout_sec` | 900 read-only, 1800 write                   | `--timeout-sec`                                                   |
| `continue`    | none                                        | Claude and Codex only; see [Continue](#continue)                  |

| Peer   | Read-only flags               | Write flags                                                          |
| ------ | ----------------------------- | -------------------------------------------------------------------- |
| Codex  | `--sandbox read-only`         | `--sandbox workspace-write --approval-policy never`                  |
| Claude | `--permission-mode read-only` | `--permission-mode workspace-write`, plus `--allow-bash '<pattern>'` |
| Cursor | `--permission-mode read-only` | not supported                                                        |

For a Claude write run, grant the brief's verification command, such as
`--allow-bash 'pnpm run test:*'`, and any other command the task needs. Claude
runs no other Bash commands.

Always pass `--output text --max-attempts 1 --max-depth 1 --json`. Use any
stable `--consultation-id`, such as `delegate-<slug>`.

The run can take the whole `--timeout-sec`. If your command tool's limit is
shorter than that plus a minute, run it in the background and wait for it to
exit. Never start a second run in the same worktree meanwhile.

## Reading the envelope

A success has `ok: true`, `output_kind: "text"`, and the peer's final reply in
`text`. Both successes and failures can carry:

- `continuation`: `session_id`, `consultation_id`, `round`, `runtime_policy`,
  `requested_model`, `requested_effort`, `observed_models`, and `turn`.
- `attempts.terminal_reason`.
- `diagnostics.permission_denials`, `diagnostics.permission_profile`, and
  `diagnostics.termination`.

`ok: true` proves that a reply came back, not that the task is done.

## Failures

- `turn: not_started`, or a usage or preflight error: nothing reached the
  peer. Fix the cause and run again.
- `PROVIDER_TIMEOUT`, an interrupt, or `turn: unknown`: the peer may have
  changed files. Inspect the worktree with the after-run procedure and report.
  Never resend the brief.
- `turn: completed` with `PROVIDER_EMPTY_OUTPUT` or
  `PROVIDER_MALFORMED_RESULT`: the turn ran but its reply is unusable. Account
  for the worktree and report; do not resend.
- Authentication, setup, or `HOST_RECURSION_BLOCKED` failures stop the run.
  Report them; do not switch providers on your own.

## Continue

Continue only when the user asks, with the same peer, model, effort, and mode
flags, on Claude or Codex:

```bash
node <skill-dir>/scripts/consensus.mjs run --provider <peer> <same-controls> \
  --cwd <same-dir> --prompt-file <follow-up> --timeout-sec <seconds> \
  --resume <continuation.session_id> --consultation-id <id> --round <n> \
  --output text --max-attempts 1 --max-depth 1 --json > <state-dir>/turn-<n>.json
```

In write mode, first check that the worktree has changed only in what the
previous turn's report recorded; see
[accounting](references/accounting.md#continue). If anything else changed, tell
the user and wait for their decision. Confirm the new receipt shows
`mode: native-resume` with the same `session_id`. If the session cannot be
resumed, report it rather than starting a new session silently.

## References

- [Brief template](references/brief-template.md): the brief's three blocks and
  the write and read-only constraints. Read it when writing a brief.
- [Worktree writes](references/worktree-writes.md): creating the worktree,
  what each provider can and cannot do in it, and what to do after. Read it
  before every write run.
- [Accounting](references/accounting.md): the baseline snapshot, the after-run
  report, and the continuation check. Read it before every write run.
