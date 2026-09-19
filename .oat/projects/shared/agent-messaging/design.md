---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-19
oat_generated: false
oat_template: false
---

# Design: agent-messaging

## Overview

Build a local, provider-neutral mailbox for coding-agent sessions. An engineer
can ask a driver, implementer, and reviewer to exchange questions, blockers,
review requests, and results without relaying messages between terminals or
sharing transcripts. Support three or more participants, including sessions in
different worktrees and repositories, from the first release.

Ship a dedicated `agent-messaging` skill with a dependency-free Node runtime.
Messages are immutable files addressed to a collaboration member. Optional
`session-observer-collab` integration shares the directory and agent-authored
collaboration log; observation cursors remain separate and its two-stateful-peer
limit does not constrain messaging. No daemon, MCP server, database, network
transport, or required third-party package.

This is the **approved design**, not an implementation-ready plan. The user
approved the peer-reviewed design after selecting High dispatch with Frontier
gate review. User decisions in [discovery.md](discovery.md) include the direction
observed in Fable's Claude session: file-per-message storage, one project in
phases, flat collaboration IDs, cross-repo participation, explicit logged
session takeover, dedicated skill, and first-enable disclosure. Exact protocol
details below form the approved planning baseline. The user also approved human-only idle renewal,
a 24-hour hard cap, visible expiry, and a separately reset continuation budget.

### How engineers and agents use it

1. The driver opens a collaboration for a bounded task and reports its UUID,
   own alias, and shared storage paths.
2. Each participant explicitly joins that UUID under its own native session
   identity. Joining does not install hooks or start transcript observation.
3. The driver sends a `request` to `reviewer`. Enqueue success means saved,
   not read, acted on, or guaranteed to wake the recipient.
4. The recipient checks at every turn's start and attempted stop. A verified
   host adapter may automate checks or provide bounded idle notification.
5. The recipient acknowledges receipt, works within its existing authorization,
   and sends an `update` reply. A new question is another explicit request.
6. Agents append decisions/observations to the shared Markdown collaboration
   record. A participant closes the collaboration when the task ends, retaining
   messages and unresolved-work history.

Messaging does not assign source-file ownership or authorize simultaneous
edits. Shared-worktree peers still announce and hand off the mutation turn.

## Architecture

```text
dedicated messaging skill / Node CLI
                    |
                    v
shared collaboration runtime <---- optional observer-collab integration
  membership and session bindings       | separate transcript/cursor state
  immutable messages and receipts       |
  finite activation and claims ---------+ one continuation owner/budget
  immutable log entries -> Markdown view
                    ^
                    |
     host start/stop adapters or bounded Monitor
                    |
                    v
<collaboration-root>/collaborations/<uuid>/
```

The filesystem is the transport. Adapters do not create a second queue.
Messages remain available without a watcher or active recipient.

### Guarantees

| State        | Meaning                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| Enqueued     | Complete immutable message published and sync completed                    |
| Attempted    | Runtime reserved an output/notification attempt; host receipt is unknown   |
| Acknowledged | Exact current recipient explicitly confirmed receipt of the full body      |
| Replied      | A separate message references the original; not proof of successful action |

Presentation is replayable. Exactly-once agent actions and unconditional eventual
delivery are not promised. Lost output leaves mail unacknowledged. Expiry,
missing turns, disabled integration, or exhausted budgets can leave it queued.
No state named “delivered” should collapse these distinctions.

## Component Design

### 1. Flat identity and cross-worktree membership

A random UUID identifies the collaboration. Its label and bounded-task
description are human context, not routing keys. All commands name the UUID;
never select the newest group by cwd. Worktree and repository paths are metadata,
not restrictions derived from Git. No Git subprocess or remote-URL inference is
needed. Cross-repo participation means sharing one local filesystem root on
one machine, not network messaging.

Each member has an immutable `participantId` UUID and a unique normalized alias
(`[a-z][a-z0-9-]{0,31}`). Exact native pins are structured
`{runtime, sessionId}`; CLI syntax is `runtime:sessionId`, split at the first
colon. Support Codex, Claude Code, and Cursor initially. Hooks obtain identity
from native stdin. The CLI uses non-conflicting harness identity signals or
an explicit self pin confirmed by the acting session. Do not infer self from
nickname, cwd, transcript recency, or another agent's statement.

Joining publishes an immutable alias record containing participant ID and
generation-zero binding: native pin, canonical worktree, and timestamp.
The alias record is published exclusively; a concurrent conflicting join loses
without overwriting the winner. A retry of the identical join succeeds
idempotently. Existing aliases are never implicitly redirected.

A replacement session uses `join --alias reviewer --succeeds <old-pin>`.
It requires explicit human direction in the acting session and must name the
expected current binding. The skill enforces that authority boundary; the CLI
validates the exact `--succeeds` pin, records the reason, and publishes the next
immutable binding generation exclusively. A flag is not cryptographic proof
of human consent. Concurrent
successors race for the same generation; only one wins. The winning record
includes the reason and previous binding, so takeover is itself durable history.
The takeover record captures a bounded snapshot of valid acknowledgment IDs
and hashes from the previous binding, including inherited receipts. Those
receipts remain effective for the successor; old-binding acknowledgments arriving
after the snapshot are conservatively replayed. The stable inbox and pending
mail remain with the alias;
messages retain original sender and addressed-generation provenance.

Agents must disclose takeover to peers, append its interpretation to the
collaboration log, inspect pending mail, and obtain a new activation. Old
activations do not grant the successor
automatic authority. The old binding cannot send, acknowledge, activate, or
take over again once superseded; its next check reports the replacement and
terminated activation. A send or ack already in flight can still
publish: final readers validate binding generations and report that race
rather than treating stale ownership as current.

One exact session may join multiple collaborations manually but has one active
automatic delivery binding at a time. Its activation namespace is keyed by a
hash of its structured native pin, not cwd. This provides direct hook lookup;
do not scan every historical collaboration on every prompt.

### 2. Persistent shared storage

Reuse collaboration's existing resolver:

```text
SESSION_OBSERVER_STATE_DIR                 # explicit absolute root override
otherwise $XDG_STATE_HOME/session-observer/collab
otherwise ~/.local/state/session-observer/collab

<root>/
  activations/<sessionKey>/
    epochs/<generation>.json
    revoked/<activationId>.json
    activity/<activationId>/<humanEventKey>.json
    claims/<activationId>/events/<eventKey>.json
    claims/<activationId>/messages/<deliveryKey>.json
    claims/<activationId>/slots/<number>.json
    diagnostics/<attemptId>.json
  collaborations/<collaborationId>/
    collaboration.json
    members/<alias>.json
    bindings/<participantId>/<generation>.json
    departures/<participantId>/<generation>.json
    inbox/<participantId>/<messageId>.json
    acks/<participantId>/<bindingGeneration>/<messageId>.json
    retries/<participantId>/<priorAttemptId>.json
    log/entries/<entryId>.json
    collaboration.md                       # regenerable human-readable view
    closed.json
```

Hash native pins into path-safe `sessionKey`; use validated UUIDs or bounded
integers for all other dynamic paths. Metadata preserves readable identities.
All participants must resolve the same root; open/join/status print it. An
override selects a store, not an automatic merge across multiple stores.
Reject relative overrides. No path depends on a Git checkout's lifetime.

Create directories as 0700 and files as 0600, with explicit chmod. Validate
owner, file type, and canonical containment; reject symlinked state entries.
The trust boundary is one OS user's account, not cryptographic protection from
other processes running as that user. Initially support local macOS/Linux
filesystems with atomic exclusive hard-link publication. Network/synced stores
and Windows require separate validation.

Keep observer's different `STATE_DIR` read-offset store unchanged. Native
transcripts, public observation offsets, and private observation continuity
remain separate. Historical ad hoc logs are not automatically moved or deleted.

### 3. Immutable publication without a collaboration-wide lock

Write each record to a unique private temporary sibling, fsync and close it,
then `fs.link(temp, final)` to publish its complete bytes only if the final
name is absent. Sync the parent directory, then unlink the temporary name.
A plain replacing rename is not a no-clobber operation. Unsupported hard-link
semantics fail explicitly; do not substitute an unsafe fallback.

On an existing final name, compare schema and canonical payload hash. An
identical retry returns the original receipt; a different payload is a conflict.
Temporary files never count as messages or claims. A crash before publication
leaves no visible record; after publication it may leave a committed operation
without a success response. Retry the same ID. A post-publication directory
sync failure returns `COMMIT_UNCERTAIN`, not “nothing happened.”

No send, ack, hook claim, close, or log append takes a persistent lock.
Do not use the existing lease lock for mailboxes. Immutable complete files
avoid torn records; exclusive final names arbitrate conflicts. Mutable rendered
views use temp-write/rename and are never authoritative. Power-loss durability
still depends on the filesystem honoring sync; process-crash consistency alone
is not proof of that stronger property.

There is no multi-file transaction. Operation ordering is chosen so a crash
can waste a continuation opportunity but cannot invent an acknowledgment or
overspend a configured budget. Publication before a close race is not recalled;
every subsequent delivery check verifies the closed marker and current binding.

Bound input and work: 32 KiB UTF-8 body, 256-byte subject, 128 active members,
8 messages/48 KiB per CLI result, and 6,000 total characters per hook envelope
including provenance. The hook renders complete bodies that fit; otherwise it
returns IDs/subjects plus an exact `inbox --message` command, never a misleading
partial body. Bound directory enumeration to 4,096 messages per inbox, 4,096
log entries, 64 binding generations/member, and 64 activation epochs/session.
If a bound is exceeded, fail with an explicit capacity diagnostic; never silently
omit data. Concurrent publishers can cross a soft directory threshold; do not
claim an atomic global quota without a quota protocol. Capacity recovery means
explicit inspection/archive/cleanup, not implicit deletion.

Malformed/unsupported authoritative records fail the affected operation closed.
Do not skip corrupt records, reset receipts, repair bodies, or reinterpret
unknown schemas. Keep failures scoped: one broken recipient does not prohibit
unrelated recipients from sending.

### 4. Message protocol and receipts

Every message addresses one stable participant and captures the alias's exact
binding generation at send time. The sender supplies a UUID before its first
attempt. That ID is the idempotency key within the recipient inbox; same ID
with changed content or sender is rejected.

There is no global queue sequence. Sort presentation by priority, then
`createdAt`, sender pin, and message ID for deterministic results. Timestamp
ordering across concurrent senders is approximate, not a causal or commit-order
guarantee. Reply references explicitly identify participant and message ID.

Kinds are `request` and `update`, with `update` the default. A blocker that
requires attention is a request. Priorities are `normal` and `high`. Only a
request can initiate automatic attention; high priority alone cannot. Replies
default to update; acknowledgments never create messages.

Recipients explicitly acknowledge after receiving the full body. Ack files
contain message hash, exact native pin, binding generation, and timestamp.
They are immutable and idempotent. A receipt committed by a superseded binding
is effective for the successor only if included in the takeover's receipt
snapshot; otherwise the successor re-reads/re-acks it. This conservative replay resolves takeover races without
pretending receipt and reassignment were an atomic transaction.

CLI and hook output are attempts, not receipts. Unacknowledged mail remains
available until explicit close/cleanup. In a composed observation session,
message IDs are the dedup key: rendering a message from the inbox records that
ID in the agent's working context; a transcript quotation carrying the same ID
is context, not another request. Do not fuzzy-match prose or advance observer
cursors merely because a message was acknowledged.

### 5. Activation, exclusive claims, and limits

Activation is explicit and finite. A session's immutable epoch record binds
collaboration, participant generation, exact native pin/worktree, mechanism,
expiry policy, and maximum continuations. The approved default is a two-hour
idle window renewed only by confirmed human prompts, with a hard 24-hour
lifetime from explicit activation. Continuation budget is separate: proposed
default 20, maximum 100, reset only by explicit re-enable.

For a host with proven human-origin discrimination, publish an immutable
activity receipt keyed by its native human event ID. Effective expiry is the
lesser of the hard deadline and two hours after the latest valid human activity
(activation time supplies the initial activity). Validate/deduplicate event
provenance; a hook named UserPromptSubmit is not enough by itself. Peer messages,
notifications, tool results, continuations, and replayed events never renew.
A prompt arriving after effective expiry produces a notice, not automatic
resurrection. Re-enable is explicit. Activity timestamps come from the local
receiver and must fall within the previously live activation window. Validate
receipts chronologically from activation time; a gap past the then-effective
deadline cannot be bridged by a later receipt. Cap activity enumeration at
4,096 records and fail closed on overflow.

Until a host proves that distinction, select an explicitly disclosed fixed
expiry at enablement (default two hours, selectable up to 24). Do not infer
human supervision from a prompt-shaped callback. Renewal changes neither the
activation ID nor its consumed budget slots.

An activation is **terminated** when any of these validated conditions holds:
explicit revocation, effective expiry, collaboration closure, superseded member
binding, or departure of that binding. To enable again, require the previous
epoch to be terminated, then exclusively publish its successor generation.
This allows activation in another open collaboration after closure, takeover,
or departure without first disabling an already terminated epoch. Missing,
corrupt, or unknown state is not proof of termination and fails closed.
Concurrent enablers target the
same successor and only one wins. A hook reads only its exact session namespace,
selects the highest valid contiguous epoch, and validates identity/worktree,
membership, revocation, closure, expiry, and mechanism. Missing or inconsistent
state means no automatic action. Restart requires explicit re-arm.

Each automatic check follows this order:

1. Read a bounded snapshot; select eligible pending requests. Verify the host
   boundary and current activation.
2. Exclusively publish the activation's event claim. A duplicate event cannot
   independently emit another continuation. Record the attempt token and proposed
   delivery keys so interrupted pre-message attempts remain inspectable/retryable.
3. Exclusively occupy one free numbered budget slot from 1 through the configured
   maximum. A slot contains the event/attempt token and **proposed** delivery
   keys, not a claim that those messages were owned or presented. Existing slots
   are never removed or reused. Exhaustion stops here without claiming messages.
4. Exclusively publish per-message attempt claims. Only the process whose claim
   token owns a message may include it. Do not wake for a batch with no owned
   messages; the already reserved slot may be wasted. Derive the actual owned
   subset from these immutable claims, never from the slot's proposed list.
5. Recheck epoch, revocation, closure, exact membership, and host continuation
   constraints. On failure, emit nothing; the spent slot is not refunded.
6. Emit one bounded host response. Do not acknowledge mail automatically.

Reserve a slot before message claims so budget exhaustion or a crash during slot
reservation does not make messages ineligible to other events. Event-first
ordering suppresses duplicate callbacks before they spend slots. Its tradeoff is
conservative under-delivery: a crash after the event claim suppresses replay of
that same event, including an unchanged Monitor batch. A later distinct host
boundary may still claim messages that have no message claim; explicit retry
provides recovery without waiting for a different batch.

Crashes at any intermediate point can suppress an automatic retry or waste a
slot, but queued unacknowledged content remains available to manual/start checks.
Slot count cannot exceed the finite namespace. An event claim without a slot,
or a slot without message claims, is an interrupted attempt, not delivery.
`delivery retry --message` explicitly creates a retry generation keyed by the
prior attempt, permitting a new claim without restoring budget. Competing
retries for the same prior attempt are exclusive/idempotent. Retry after an
aborted pre-slot or pre-message claim must be supported using the event's
proposed delivery keys, not just after emitted output. Retry never bypasses
the one-continuation-per-Stop-chain limit or restores consumed slots.

For Monitor/watch, which has no native host event ID, derive `eventKey` as a
domain-separated hash of the activation ID, exact binding generation, and
sorted delivery keys of the selected eligible **request** batch. Each delivery
key includes message ID and its explicit retry generation. Repeated polling or
re-arming with the same batch therefore reuses the same event key; a retry
generation creates a distinct key. Per-message claims still arbitrate overlapping
batches. Updates never produce wake-bearing watch events and wait for a regular
start/manual check. Hash native host IDs and all derived keys before using them
as path segments; no wall-clock/random poll token stands in for event identity.

At Stop, allow at most one continuation per host turn/chain. Use native event
identity where available. If the host lacks a stable event ID, derive the chain
from a verified new human-prompt epoch; if that cannot be established, fall back
to manual rather than inventing a fresh event from time. Treat continuation
markers conservatively. Interruption, unsuccessful completion, uncertainty, or
exhaustion means allow stop.

Default Stop wait is zero. A session explicitly awaiting a reply may opt into
a short finite catch window; maximum 60 seconds, with adapter finalization grace
inside the host timeout. Warn that waits may delay human steering. Existing
Codex registration uses 65 seconds for a 60-second wait ceiling. Never wait
while holding filesystem ownership or claim a queued late message woke anyone.

On the next user-visible check after expiry, report the state, pending count,
and re-enable action. Do not silently label delivery active. In manual mode,
the inbox CLI provides the same notice. The user approved this policy in Fable's
session (raw record 472); fixed expiry is a provenance-limited fallback, not an
undecided product direction.

### 6. Host adapters, Monitor, and first-enable disclosure

| Runtime     | Target mechanism                                                                                                              | Evidence boundary                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Codex       | Prompt-start context and bounded Stop continuation                                                                            | Documented API; new messaging integration still needs fixtures, exact-command trust/invocation, and live delivery proof |
| Claude Code | Session-scoped prompt-start safety net plus a locally proven finite Monitor for inbox notification; native Stop is a fallback | Monitor and native hooks have independent evidence; select one automatic wake owner                                     |
| Cursor      | Probe current IDE/CLI start/context and Stop callback surfaces in phase 2                                                     | Manual is the fallback until an individual boundary passes, not a permanent v1 exclusion                                |

Codex documents `UserPromptSubmit` context and Stop block responses. The locally
inspected CLI is 0.155.1, but no messaging hook was probed.
[Codex hooks](https://developers.openai.com/codex/hooks).
Claude documents prompt context, Stop feedback, and skill hooks scoped from
invocation through the session; automatic-turn coverage still needs a probe.
[Claude hooks](https://code.claude.com/docs/en/hooks).
Cursor documents prompt validation, session-start context, and Stop follow-ups,
which are different boundaries. Historical failed callbacks do not settle
current support. [Cursor hooks](https://cursor.com/docs/hooks).
Official sources checked 2026-09-18.

Before first activation disclose mechanism, scope, exact command, permissions,
timeouts, expiry, budgets, storage, and stop/fallback behavior. A plugin can
supply code but does not prove user consent, trust, invocation, or delivery.
Codex command-content changes may require renewed manual `/hooks` trust.
Preserve unrelated hooks. Approval stated in a peer session does not perform
local privileged installation or trust approval.

Claude's Monitor watches only its own inbox via a finite foreground command.
Its lifetime is at most 30 minutes and never beyond activation expiry.
Re-arm only within remaining user-authorized lifetime/budget after exact
identity/freshness checks. A failed restart becomes manual; no notification
guarantee survives session/Monitor termination. Start checks provide a safety
net without being a second autonomous wake owner. Native `asyncRewake` is
documented prior art for a bounded probe, not a selected implementation promise.

Adapters validate native payloads and exact session/worktree, emit only valid
host output on stdout, and send redacted diagnostics to stderr. Unknown events
or missing identity fail closed. Messaging failures must not block a human
prompt or create an error-triggered Stop loop. Store bounded immutable diagnostic
records by attempt ID; status reports the latest event/outcome, not delivery.
Unenrolled hooks remain inert and do not create member records.

### 7. Optional observation and the collaboration log

One controller owns autonomous continuation for a session. Existing observer
Stop code delegates to the same activation/claim mechanism when composed with
messaging; do not install competing continuation owners. Check inbox requests
before selecting a transcript range. If a message batch wins, defer observation
continuation. Otherwise reserve a shared budget slot, then use existing observer
CAS to claim its completed substantive range. A CAS loss can waste one slot,
never emit a duplicate continuation. Public observation offsets and private
continuity remain unchanged.

The shared log remains agent-authored observations, assessments, decisions, and
corrections, not an automatic copy of inboxes. Publish one immutable structured
entry per UUID using the same no-clobber primitive. Include category, title,
What happened, Assessment, Skill implication, author, timestamp, and content
hash. Render `collaboration.md` in the existing Markdown format with creation
context and ordered entries. Entry files are authoritative; the Markdown file
is a regenerable view. Concurrent renders may publish a stale view, never lose
entries. Include a source-set digest; `log show`/status detects stale views and
`log render` rebuilds from a validated snapshot. No direct hand-editing of the
view; corrections append new entries. Joining/takeover/closure history also
remains in its authoritative protocol records if an explanatory log append fails.

Observer collaboration without messaging opens/joins the same metadata/log
container, with messaging delivery disabled. Third messaging participants do
not gain a stateful observer cursor. Update existing collaboration instructions
to use this deterministic path; do not move historical logs automatically.

### 8. Closeout, trust, and retention

Any current member may explicitly close the group by publishing `closed.json`.
Close is idempotent, preserves history, rejects new admissions/activations, and
prevents subsequent delivery checks from claiming work. Sends/acks already in
flight may publish after the marker; status labels them closed/in-flight, and
they cannot reactivate delivery. Closure cannot recall context already emitted.
Join, takeover, and enable also recheck `closed.json` after publication. If closure
won that race, report the published record as closed/in-flight, not successful
active membership/delivery. Readers treat it as inert; do not delete it, reopen
the collaboration, or automatically retry in a new group.
Agents revalidate active state before acting on automatic envelopes.

Leaving publishes a generation-specific departure marker and revokes that
session's activation. Disabling delivery revokes only its activation, retaining
membership. A successor uses the explicit takeover path; no member deletion.
Stop watchers/Monitor processes at closeout and report unresolved messages.
Global hooks stay installed unless removal is separately requested.

Keep history indefinitely by default. No automatic garbage collector or broad
recursive delete command in v1. Capacity or retention cleanup requires explicit
operator-selected closed targets and quiescent writers. Preserve native
transcripts and existing observer stores.

Render peer text as a factual, attributed, untrusted report. Escape encoded
bodies so they cannot spoof wrapper boundaries. Never evaluate bodies as shell
commands or infer approval from them, even when host context looks privileged.
Paths/links are plain text, not permission to access them; no attachments in v1.
Publishing, paid operations, credentials, destruction, and other privileged
actions retain the acting session's normal approval boundary.

## Data Models

All records declare schemaVersion 1. UUID and generation fields are validated.
Unknown versions fail closed. Essential shapes:

```typescript
type Pin = { runtime: 'codex' | 'claude-code' | 'cursor'; sessionId: string };
type Binding = {
  participantId: string;
  generation: number;
  pin: Pin;
  worktree: string;
  previousPin: Pin | null;
  reason: string;
  createdAt: string;
  inheritedAckRefs: { messageId: string; messageHash: string }[];
};
type Message = {
  schemaVersion: 1;
  id: string;
  collaborationId: string;
  from: { participantId: string; generation: number; pin: Pin };
  to: { participantId: string; generation: number };
  kind: 'request' | 'update';
  priority: 'normal' | 'high';
  subject: string;
  body: string;
  replyTo: { participantId: string; messageId: string } | null;
  createdAt: string;
  contentHash: string;
};
type Ack = {
  schemaVersion: 1;
  messageId: string;
  messageHash: string;
  recipient: Pin;
  bindingGeneration: number;
  receivedAt: string;
};
type Activation = {
  schemaVersion: 1;
  id: string;
  epoch: number;
  previousEpoch: number | null;
  collaborationId: string;
  participantId: string;
  bindingGeneration: number;
  pin: Pin;
  worktree: string;
  mechanism: 'stop' | 'monitor';
  startedAt: string;
  hardExpiresAt: string;
  expiryMode: 'human-idle' | 'fixed';
  idleTimeoutMs: number | null;
  fixedExpiresAt: string | null;
  maxContinuations: number;
  waitMs: number;
};
type Claim = {
  schemaVersion: 1;
  activationId: string;
  token: string;
  eventKey: string;
  messageIds: string[];
  attemptedAt: string;
};
```

Common metadata records include schema version, UUID/key, author pin, timestamp,
and canonical content hash. Hash send fields plus resolved identities, excluding
server-created receipt timestamps and the hash itself. A reply reference must
exist in the same collaboration and involve the replying participant. Reject
unknown kinds, invalid integers/IDs, self-send, stale bindings, and malformed
references. Receipt state names individual IDs, not high-water offsets.

## API Design

Canonical invocation: `node <skill-dir>/scripts/agent-messaging.mjs`.
Below `mail` is explanatory shorthand, not a new global executable.
All operations support `--json`; text bodies can use stdin.

| Operation      | Command shape                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Open           | `mail open --label design --task <text> --self <pin> --alias driver`                                                                                   |
| Join           | `mail join --collab <uuid> --self <pin> --alias reviewer`                                                                                              |
| Take over      | `mail join --collab <uuid> --self <new-pin> --alias reviewer --succeeds <old-pin> --reason <text>`                                                     |
| Send           | `mail send --collab <uuid> --self <pin> --to reviewer --id <uuid> --kind request --subject <text> --body-stdin`                                        |
| Read           | `mail inbox --collab <uuid> --self <pin>`; `--message <uuid>` for full body, `--all` for history                                                       |
| Ack            | `mail ack --collab <uuid> --self <pin> --message <uuid>`                                                                                               |
| Enable         | `mail delivery enable --collab <uuid> --self <pin> --idle-timeout 2h --max-duration 24h --max-continuations 20 --wait-ms 0`                            |
| Disable/retry  | `mail delivery disable` / `mail delivery retry --message <uuid>`, both with explicit collab/self                                                       |
| Monitor source | `mail watch --collab <uuid> --self <pin> --max-runtime-min 30`                                                                                         |
| Record         | `mail log append --collab <uuid> --self <pin> --id <uuid> --category content --title <text> --assessment works-well --what-stdin --implication <text>` |
| Inspect/render | `mail status --collab <uuid>`; `mail log show` / `mail log render` with explicit collab                                                                |
| Leave/close    | `mail leave --collab <uuid> --self <pin>` / `mail close --collab <uuid> --self <pin>`                                                                  |

Send returns ID, queued status, duplicate flag, and paths, never a wake promise.
Hosts without verified human-origin signals use `--expires-in 2h` instead of
idle renewal, with the fallback disclosed before activation.
`send --reply-to <participantId>/<messageId>` sets the reply reference.
Watch emits bounded metadata notifications, never daemonizes or self-rearms,
and applies the same claims/budget before any wake-bearing notification.
Status reports resolved root/log, membership generations, pending/acknowledged
counts, activation, claim/budget state, diagnostics, and per-boundary support.

JSON success is `{ok, operation, collaborationId, data}`; failure is
`{ok:false, operation, code, message, retryable, paths}`. Exit 0 includes empty
inbox/idempotent retry; 2 is invalid input/identity; 3 is closed/inactive or
unavailable capability; 1 is runtime/storage failure. `COMMIT_UNCERTAIN` needs
same-ID retry or inspection. Corruption, stale binding, conflict, and unknown
schema never trigger blind retry. Inspection and log correction remain possible
after closure; they do not reopen delivery.

### Ownership and packaging

- Add canonical `src/skills/agent-messaging/`: instructions, TS runtime,
  adapters, tests, and build declaration.
- Extract genuinely shared primitives into `src/shared/collaboration/`.
  Messaging-only execution must not require transcript parsing or an observer
  install. Share the existing collaboration root contract, not observer's
  unrelated `STATE_DIR`.
- Declare standalone `skills/agent-messaging` and session-plugin
  `plugins/session/skills/messaging` in `src/distributions.ts`.
- Bundle shared runtime into existing observer-collab outputs (standalone and
  consensus plugin). Teach first-enable disclosure, exact identity, takeover,
  request versus update, receipts, deterministic log use, and closeout.
- Bump affected canonical versions, regenerate distributions, update changelog
  and user/engineering docs. Test protocol parity across independently bundled
  CLI/hooks. No compatibility aliases or global installs implied by this work.

### Delivery slices: one project

1. CLI, flat membership/takeover, immutable messages/acks/log entries, manual
   checks, and three-participant crash/concurrency tests.
2. Codex/Claude adapters and bounded notification, time-boxed current Cursor
   probes, first-enable disclosure, and separately authorized live acceptance.
3. Existing collaboration-log integration, composed observation/shared budget,
   final packaging/docs, and regression coverage.

These slices are not an execution-ready task plan.

## Testing Strategy

Quick mode has no separate spec; map discovery criteria to concrete tests:

| Contract            | Verification and essential cases                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Independent N>=3    | Multi-process tests with no observer installed; same worktree, sibling worktrees, and different repositories                                                                        |
| Membership/takeover | Alias collision, duplicate generation race, exact pin conflict, dead/replaced session, pending-mail inheritance, stale ack/send, no silent redirect                                 |
| Publication/dedup   | Kill before/after temp sync/link/dir sync; same-ID retry; conflicting ID; no overwrites, partial records, or hidden temp consumption                                                |
| Receipts/order      | Discarded output, priority leaves unacked holes, approximate cross-sender order labeled, wrong recipient rejected, reply not completion                                             |
| Claims/budgets      | Concurrent duplicate hooks, different events claiming one request, all slots contended, kill after each claim stage, no cap overshoot, explicit retry after pre-slot crash          |
| Start/Stop/Monitor  | Human/automatic turns, own continuation, unknown event identity, interruption, expiry, late arrival, close racing output, Monitor expiry/re-arm within remaining budget             |
| Log                 | Concurrent authors, immutable entries, duplicate/conflicting IDs, stale concurrent render detected, rebuild from authoritative set                                                  |
| Observation         | Inbox priority, deferred transcript selection, failed CAS wastes at most one slot, unchanged public/private cursors, N=2 observation boundary                                       |
| Safety              | Symlinks, wrong owner, malformed/oversized files, directory limits, unknown schema, wrapper injection, shell characters, mismatched root overrides                                  |
| Distribution        | Copied standalone payload runs with Node alone; protocol fixtures across CLI/hook bundles; optional/required skill references correct                                               |
| Live support        | Separate version/surface/event evidence for install/trust/invocation, real context injection, bounded continuation, restart, interruption, unrelated-session inertness, and cleanup |

Use temp directories, fake clocks, deterministic IDs, and child-process fault
injection. No real transcript reads, live hook edits, or API spend in automated
tests. Run focused Vitest, full `pnpm run test`, `pnpm run build:check`,
`pnpm run validate`, `pnpm run smoke`, changed-skill version validation, and
scoped lint/format during implementation. Live probes are opt-in and separately
authorized. A mock host response never passes a live delivery row.

## Review Status

Fable's first review challenged shared locking, full-directory hook lookup,
oversized injection, and omission of an idle tier. This revision replaces the
shared lock with immutable claims, uses direct per-session activation lookup,
bounds hook envelopes separately, and includes finite Claude notification.

Fable reviewed commit `aaa5322e`: the original four blockers were resolved, with
one required termination correction and five refinements. This revision defines
termination across all five terminal conditions (F1), reserves budget before
message claims with explicit crash recovery (F2), defines request-only watch
event keys (F3), clarifies human takeover authority (F5), and rechecks close after
join/takeover/enable publication (F6). Fable passed exact commit
`e95a0d919237bca283d33b54322b096b3f832478` with no remaining findings (completed
Claude assistant record 721, checked against the raw transcript). The user
subsequently approved this design in the driver session. Approval permits plan
generation, not implementation, live hook installation, or provider acceptance.

For F4, retain one receipt per proven human event and exact two-hour idle expiry.
Thirty-minute receipt coalescing would expire up to thirty minutes before the
approved last-human-activity deadline. Defer that policy-changing optimization;
phase 2 must measure worst-case bounded validation at 4,096 receipts and preserve
exact expiry if an optimization is necessary. Native prompt identity is a probe
requirement, not an assumed supported field. Do not enable renewal without
trustworthy human/automatic discrimination; disclose fixed expiry as fallback.

The live driver identity probe returned no match while diagnostic locate found
two transcripts carrying the same Codex session ID. Messaging uses exact native
identity without depending on that transcript resolver. Observer discovery
repair is separate unless composed integration proves it necessary.

## References

- [Discovery](discovery.md) and [backlog](../../../repo/pjm/backlog/items/BL-260619-inter-agent-direct-messaging.md).
- [Separate observation state](../../../repo/reference/decisions/DR-260724-separate-observation.md).
- [Exact stateful identity](../../../repo/reference/decisions/DR-260724-stateful-work-requires-exact.md).
- Existing source seams: `src/skills/session-observer-collab/src/lib/lease-state.mjs`,
  `src/skills/session-observer-collab/src/hooks/codex-stop.mjs`,
  `src/skills/session-observer-collab/src/collab-control.mjs`, `src/distributions.ts`.
- Vault reference: `04 - Resources/AI/Harnesses/Hooks and Agent Continuation.md`
  (cross-harness evidence, not this project's executable source of truth).

## Draft Self-Review

Author's four-check pass completed: no template placeholders; architecture,
commands, and tests reconciled; scoped to one local phased project; ambiguous
receipt/takeover and expiry rules made explicit. Peer review and user approval
are complete; the plan is the next artifact and must pass its own reviews. Regression
coverage must include all terminal predecessor conditions, corrupt predecessor
fail-closed behavior, every claim-stage crash, unchanged/overlapping/retried watch
batches, and close racing admission or activation.
