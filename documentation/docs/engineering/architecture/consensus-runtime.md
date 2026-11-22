---
title: 'Consensus Runtime'
description: 'How consensus coordinates wrappers, the deterministic loop, provider CLI subprocesses, the extended-provider ACP adapter, verdicts, and run records.'
---

# Consensus Runtime

The consensus runtime turns a workflow-specific artifact into validated peer
turns, durable records, and a terminal result. It separates workflow concerns
from provider execution: wrappers own inputs and final artifacts, the core loop
owns deliberation state, and the provider CLI owns local provider processes.

This page explains execution responsibilities. For packaging and generated
installation units, see [Build & Distribution](generated-runtime.md).
For operator options and provider setup, use [Configuration](../../user-guide/consensus/configuration.md)
and the individual [consensus guides](../../user-guide/consensus/index.md).

## Execution spine

A converging workflow follows these boundaries:

1. A wrapper such as `create` or `refine` resolves inputs, peers, paths, and its
   prompt profile, then calls `runConsensusLoop` with injected peer invokers.
2. The core loop selects alternating or parallel execution, validates verdicts,
   updates the current artifact, appends records, and evaluates terminal states.
3. The loop provider bridge invokes the generated consensus CLI with a JSON
   request on stdin and parses its JSON envelope.
4. The provider CLI selects a provider adapter, constructs provider-specific
   arguments, runs a child process, and returns a normalized envelope.

Wrappers remain responsible for workflow semantics. `create`, for example,
builds an initial artifact and later renders creation metadata and the
deliberation log. `refine` runs the same loop per section and supplies persisted
records and host or user direction when resuming an in-flight section.

## Provider subprocess boundary

Peer execution crosses two child-process boundaries: a wrapper/core process
invokes the generated consensus CLI, and that CLI invokes the selected provider
executable. Provider adapters hide incompatible command shapes behind one run
request. The core tier (`claude`, `codex`, `cursor`) uses each provider's
native CLI; the extended tier runs through one ACP adapter, described
[below](#extended-providers-over-acp). Claude receives output flags and optional inline schema flags;
Codex uses `exec`, a last-message file, and optional output-schema/config flags;
Cursor uses its own JSON output flags. Every provider reads the prompt from
stdin, so a large prompt never reaches argv; an oversized argument such as
Claude's inline schema fails as `PROVIDER_ARGV_TOO_LARGE`. Every provider
invocation sets `shell: false`.

The [subprocess runner](https://github.com/tkstang/skills/blob/main/src/plugins/consensus/provider-cli/subprocess.ts)
spawns the provider detached on POSIX, so it leads its own process group. A
timeout or output-cap breach sends SIGTERM to the group and keeps the SIGKILL
escalation running after the leader exits, until the group is gone (`ESRCH`)
or the settlement bound expires; `diagnostics.termination` records the steps.
A normal exit never signals the group. While a run is active, SIGINT, SIGTERM,
and SIGHUP received by the CLI are forwarded to that run's group through the
same escalation (a repeat escalates to SIGKILL at once). The interrupted run
is never retried, and the signal is re-raised on the CLI after the run settles
when no other listener remains.
Windows keeps single-process termination.

The normalized envelope keeps the loop provider-neutral. It carries success or
failure, structured output, redacted arguments, diagnostics, and attempt data.
The loop then applies its own verdict rules rather than trusting provider exit
status or provider-specific response syntax as a consensus decision. Every
in-repo caller, including the loop, runs in JSON mode (`output_kind: "json"`).
`consensus run --output text` is a schema-free surface for free-form replies:
it turns submit capture off, strips `CONSENSUS_SUBMIT_*` from the child
environment, and fails unreadable output as `PROVIDER_EMPTY_OUTPUT` or
`PROVIDER_MALFORMED_RESULT` rather than returning raw text.

### Extended providers over ACP

The extended tier (`antigravity`, `gemini`, `droid`) is experimental and used
only when named. Each provider is a plain data descriptor in
[`acp/descriptors.ts`](https://github.com/tkstang/skills/blob/main/src/plugins/consensus/provider-cli/acp/descriptors.ts):
launch arguments, credential and override variables, minimum version, the
read-only mode and how it is confirmed, how the model is set, auth and
redaction patterns, error-text patterns, and extra brief lines.
`acpAdapter(descriptor)` in
[`acp/adapter.ts`](https://github.com/tkstang/skills/blob/main/src/plugins/consensus/provider-cli/acp/adapter.ts)
turns each into a `ProviderAdapter` with tier `extended`, and the module has
no provider branches.

- **Transport.** An in-house client speaks newline-delimited JSON-RPC 2.0 over
  the agent's stdin and stdout. There is no acpx or other dependency, and the
  agent command is the only process started besides `git`. The client sits
  behind an `AcpTransport` interface so another backend could be added.
- **Run hook.** An adapter can supply `run`, which `runStructuredTurn` uses in
  place of `runProviderSubprocess`; only ACP adapters do. Its result's
  `stdout` is a serialized, normalized turn result (text, stop reason, session,
  models, sanitized denials, setup evidence), never raw frames, and the
  adapter's hooks parse it back. The envelope's `text`, and a failure
  envelope's `stdout`, hold only the answer text, never the turn record.
- **Session.** `initialize` advertises no file system or terminal;
  `authenticate` runs only when the descriptor's API-key variable is set;
  `session/new` sends `mcpServers: []`. The read-only mode and the model are
  set and confirmed before `session/prompt`, or the run stops as
  `not_started`. The mode stays watched: any contrary mode or autonomy update
  before the prompt stops the run as `not_started`, and one during the turn
  cancels it (`PROVIDER_EXIT`, `acp_mode_changed`). Permission requests get a
  `reject_once` (else `reject_always`) option chosen by its kind, or
  `cancelled`; every other agent request gets `-32601`. Each denial keeps only
  the tool, its ACP kind, and the first path it named (relative to the
  working directory when inside it), reported in
  `diagnostics.permission_denials.requests`; never tool input.
- **Redaction.** The values of the descriptor's credential variables and its
  redaction patterns (such as Droid's pairing code) are removed from answer
  text, metadata, denial details, working-tree change paths, and stderr.
- **Process group.** The ACP client tears down the agent's process group on
  every exit path, a normal exit included (a single process on Windows),
  using the spawn primitive in
  [`acp/process.ts`](https://github.com/tkstang/skills/blob/main/src/plugins/consensus/provider-cli/acp/process.ts).
  The client sends `session/close` where the agent advertises it (not after
  an output-cap breach), closes stdin, and waits a bounded time for exit (no
  wait after an interrupt). It then signals the group with SIGTERM, or the
  forwarded interrupt signal, and escalates to SIGKILL only if the group
  outlives the grace period. When a timeout, output-cap breach, interrupt, or
  mode change stops a turn whose prompt is in flight, it sends
  `session/cancel` first.
- **Model.** `runProviderTurn` requires a model for an extended adapter:
  `request.model`, else `defaults.provider_models.<id>` from the consensus
  config (project before user). With neither it refuses the run before launch.
  A configured model is recorded in the receipt as `default_model`.
- **Working-tree check.** `runProviderTurn` wraps every extended read-only
  turn with a snapshot of the whole git work tree that contains the working
  directory
  ([`working-tree.ts`](https://github.com/tkstang/skills/blob/main/src/plugins/consensus/provider-cli/working-tree.ts)).
  It runs `git` with `shell: false`, git's repository-local environment
  variables cleared, and no optional locks, and it writes no objects or index.
  No checkout refuses the run before launch. A changed HEAD, or any change to
  a tracked or non-ignored untracked path (content or file mode), to an
  assume-unchanged or skip-worktree entry, or to `.git/info/exclude`, fails the
  run with `PROVIDER_WORKTREE_CHANGED` and lists the paths in
  `diagnostics.working_tree_changes`; a checkout that cannot be re-read fails
  the same way. It is a backstop behind the read-only mode and deny-all, and
  it does not see ignored files, changes a clean filter normalizes, case-only
  renames on a case-insensitive file system, changes inside an untracked
  nested repository, or writes outside the work tree.
- **Preflight.** The probe runs only `<command> --version`, without the
  provider's credential variables, and reports only the parsed version. It
  never opens a session, because Droid mints a new pairing code on each one,
  so a `ready` extended provider is installed at or above its minimum
  version, but its sign-in and model are first checked by a run.

## Guardrails, not isolation

When host context is available, the [host guard](https://github.com/tkstang/skills/blob/main/src/plugins/consensus/provider-cli/host-guard.ts)
tracks the host, run id, and recursion
depth. It blocks
same- or cross-provider spawning beyond the configured maximum depth and adds
child host metadata to allowed calls. Unknown or absent host context cannot
provide that recursion check. The runtime policy defaults calls to
non-interactive mode and builds a child environment from base variables,
provider credential variables, explicitly allowed additions, and host metadata.
Each provider's program defaults to its CLI name, resolved against the absolute
`PATH` entries to the absolute path that both readiness probes and runs start; a
`CONSENSUS_<PROVIDER>_EXECUTABLE` absolute path in the parent environment
replaces it for both
([`executable.ts`](https://github.com/tkstang/skills/blob/main/src/plugins/consensus/provider-cli/executable.ts)).

These are process and configuration safeguards, not a security sandbox. Actual
sandbox and approval behavior depends on the selected provider and requested
runtime policy. Environment allowlisting reduces inheritance; it does not make
peer output trustworthy or prove containment.

## Provider session continuation

`consensus run` can continue a single advisory consultation across calls. This
is separate from the loop's `records.json` resume described below: it runs one
provider turn, and the host carries the consultation state between calls. The
[continuation module](https://github.com/tkstang/skills/blob/main/src/plugins/consensus/provider-cli/continuation.ts)
validates requests and builds receipts, and `runProviderTurn` in
[`structured-output.ts`](https://github.com/tkstang/skills/blob/main/src/plugins/consensus/provider-cli/structured-output.ts)
runs the state machine.

- **Modes.** A request is `new` (the default), `native-resume` (`--resume
<session-uuid>`), or `reconstructed` (`--continuation reconstructed`). Native
  resume targets one explicit session UUID. Titles, names, and "latest"
  selectors are rejected because Claude resolves titles and Codex silently
  opens a new thread for an unknown name.
- **Session identity.** Session IDs come only from provider machine output:
  Claude's result JSON `session_id` and Codex's JSONL `thread.started`
  `thread_id`. If a resumed turn reports a different or missing session, the
  run fails with `PROVIDER_SESSION_MISMATCH`. This is also the runtime guard
  when a newer CLI changes its resume grammar.
- **Controls.** Codex runs `exec resume` with `-c sandbox_mode=...`, because
  resume rejects `--sandbox`, and passes the thread ID and a stdin `-`
  positionally. Claude adds `--resume <uuid>` to the usual print-mode flags.
  Model, effort, schema, permission, and approval controls are passed again
  on every call, and all round instructions travel in the user prompt. The
  wrapper never uses `--last`, `--continue`, `--fork-session`, or
  `--no-session-persistence`.
- **No duplicate turns.** Native resume is single-attempt. The receipt's `turn`
  is `not_started`, `completed`, or `unknown`. A reconstructed fallback runs
  only after an explicit `--resume-fallback reconstructed` request and only
  when the adapter is unverified or the provider definitively rejected the
  session: a not-found message on stderr and empty stdout. A turn with any
  provider stdout counts as `unknown`, never `not_started`. A
  timeout, an authentication failure, or an unknown exit never falls back or
  retries.
- **Disclosure.** Reconstructed runs start a new session, and the wrapper
  prepends a notice that the peer has no memory of earlier rounds. After a
  fallback, the envelope counts both attempts and keeps a warning in the
  diagnostics.
- **Receipt.** The envelope's `continuation` object sits beside the advisory
  `json`. It records the mode, provider, session IDs (current, requested, and
  previous), the consultation ID and round, the working directory, the
  requested model and effort, observed models where the provider reports them,
  the redacted runtime policy, the turn state, the fallback reason, and the
  adapter's capability evidence.

Each adapter's continuation capability is either `verified`, `unverified`, or
`unsupported`, and only `verified` adapters reach a native resume. Extended
adapters declare none, so they never reach one. A `--resume` request is
refused before launch with `PROVIDER_UNSUPPORTED_OPTION`
(`native_resume_unsupported`), unless `--resume-fallback reconstructed`
supplies a packet, which then runs a new reconstructed session.
Verification means that a live same-session marker smoke passed for the
recorded CLI version. It does not certify later versions or every policy
combination.

| Provider | Documented by provider    | Accepted by installed CLI                | Live raw-CLI smoke                                    | Through wrapper      | Capability   |
| -------- | ------------------------- | ---------------------------------------- | ----------------------------------------------------- | -------------------- | ------------ |
| Claude   | yes                       | Claude Code 2.1.284                      | passed 2026-09-28                                     | passed 2026-09-28    | `verified`   |
| Codex    | yes                       | codex-cli 0.157.1                        | passed 2026-09-28                                     | passed 2026-09-28    | `verified`   |
| Cursor   | yes (`--resume [chatId]`) | cursor-agent 2026.09.28 lists `--resume` | passed 2026-09-29 (answer replayed once on reconnect) | refused (unverified) | `unverified` |

By default Cursor runs with `--force`, which trusts the workspace and
auto-approves every command. `--permission-mode read-only` runs it with
`--trust --mode ask --sandbox enabled` instead. Ask mode allows only read-only
tools, including read-only shell commands (a live check ran `ls` but refused a
file write), and the peer answers through its final message rather than
`consensus submit`.

## From provider output to a verdict

The provider CLI prefers a submitted verdict only when the submit capture exists,
fits its byte limit, parses as JSON, and satisfies the supplied schema. If no
valid submitted verdict is available, it parses and schema-validates the
provider's final message. This fallback is another extraction path for the same
provider turn, not another vote or deliberation round.

Schema validation is only the first layer. The core loop enforces the verdict
vocabulary for the selected iteration mode, required and allowed fields, field
types, and byte/count caps. Alternating mode accepts `ACCEPT`, `REVISE`, or
`IMPASSE`; parallel modes use their parallel verdict vocabulary. Invalid shapes
or caps can be retried within the configured provider attempt budget.

## Durable records and resume

Each accepted peer or synthesis result is appended to `records.json` with a
schema version and timestamp. The [records writer](https://github.com/tkstang/skills/blob/main/src/plugins/consensus/core/loop-records.ts)
rewrites that array through a
same-directory temporary file, sync, and rename. Terminal status is normalized
and written separately with turn, round, hash, and available cost data.

Resume state comes from these records. In parallel synthesized mode, a complete
durable peer pair without a following synthesis record means synthesis is
pending. Resume re-runs only that synthesis step, then evaluates the completed
round; it does not replay the already committed peer pair. User or host
intervention is also appended as attributed loop state before execution
continues with a refreshed budget.

## Outcomes are mode- and agency-dependent

The parallel terminal evaluator checks an explicit peer `IMPASSE` before
convergence, then considers escalation triggers when neither applies. Budget
exhaustion is considered after the round budget is spent. Escalation routing and
some convergence decisions depend on agency and iteration mode.

Do not generalize that sequence into one universal outcome order. Alternating
mode has its own turn-by-turn terminal path, and maximum agency can resolve some
otherwise stuck outcomes differently. Report the persisted status,
termination reason, and agency decision rather than inferring an outcome from a
single verdict or from round count alone.

## Related workflows outside the loop

`review` is outside the loop and owns a distinct one-reviewer path. Its
canonical skill owns the executable and build closure, and the standalone
`consensus-review` and Consensus plugin-local `review` forms ship the same
generated runtime. The executable calls the shared provider-turn transport for
one attempt with submit capture disabled, then applies Review's own deep
validation, selected-scope drift comparison, external run-state persistence,
and deterministic Markdown rendering. It does not add a `consensus review`
dispatcher command or import `runConsensusLoop`. See
[Review](../../user-guide/consensus/review.md) for the user contract.

`panel` uses the provider CLI but owns a separate one-shot multi-panelist path.
It preserves independently attributed responses and does not ask panelists to
converge through `runConsensusLoop`. The current wrapper invokes ready panelists
individually and determines success from response availability and validation.

`phone-a-friend` is also outside the loop. It requests one structured advisory
turn, after which the host must disposition the advice. Neither panel responses
nor an advisory take should be described as a consensus-loop outcome. See
[Panel](../../user-guide/consensus/panel.md) and
[Phone-a-friend](../../user-guide/consensus/phone-a-friend.md) for their user
contracts; see [Create](../../user-guide/consensus/create.md) and
[Refine](../../user-guide/consensus/refine.md) for converging workflow usage.

`delegate` is outside the consensus loop too. Each `consensus run --output text`
turn has a single attempt, after which the host computes the changes from its
own git baseline and verifies them. Ordinary verification failures within the
original task trigger a host-authored follow-up in the same Claude or Codex
session with the same permissions. The host accounts for and verifies each
turn; the transport never retries a write turn. See
[Delegate](../../user-guide/consensus/delegate.md).
