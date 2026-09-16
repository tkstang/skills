---
title: 'Consensus Runtime'
description: 'How converging consensus workflows coordinate wrappers, the deterministic loop, provider CLI subprocesses, structured verdicts, and durable run records.'
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
request. Claude receives prompt/output flags and optional inline schema flags;
Codex uses `exec`, a last-message file, and optional output-schema/config flags;
Cursor uses its own JSON output flags. Every provider invocation sets
`shell: false`.

The normalized envelope keeps the loop provider-neutral. It carries success or
failure, structured output, redacted arguments, diagnostics, and attempt data.
The loop then applies its own verdict rules rather than trusting provider exit
status or provider-specific response syntax as a consensus decision.

## Guardrails, not isolation

When host context is available, the [host guard](https://github.com/tkstang/skills/blob/main/src/plugins/consensus/provider-cli/host-guard.ts)
tracks the host, run id, and recursion
depth. It blocks
same- or cross-provider spawning beyond the configured maximum depth and adds
child host metadata to allowed calls. Unknown or absent host context cannot
provide that recursion check. The runtime policy defaults calls to
non-interactive mode and builds a child environment from base variables,
provider credential variables, explicitly allowed additions, and host metadata.

These are process and configuration safeguards, not a security sandbox. Actual
sandbox and approval behavior depends on the selected provider and requested
runtime policy. Environment allowlisting reduces inheritance; it does not make
peer output trustworthy or prove containment.

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
