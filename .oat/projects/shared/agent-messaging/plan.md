---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-19
oat_phase: plan
oat_phase_status: in_progress
oat_plan_parallel_groups: []
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
oat_template: true
---

# Implementation Plan: agent-messaging

**Goal:** Let three or more local coding-agent sessions exchange addressed
messages without observing transcripts, with persistent shared collaboration
logs and optional bounded delivery at verified host boundaries.

**Architecture:** A dependency-free Node CLI and shared collaboration runtime
publish immutable records under the existing XDG/override collaboration root.
Host adapters consume the same protocol. Optional observer integration retains
separate cursors and shares one autonomous continuation owner and finite budget.

**Approved baseline:** [design.md](design.md), peer-reviewed at e95a0d91 and
approved by the user after selecting High dispatch with Frontier gate review.
Design approval bookkeeping is committed at 2d399c33; the user-approved
2026-09-19 ownership-policy amendment is committed at c0a61d53. Carry the latest
complete committed project, not either historical baseline alone. This plan is a draft;
only its completed review and gate disposition may make it implementation-ready.

**Stack:** Node >=22, TypeScript, Node standard library, colocated Vitest tests;
existing observer-collab MJS entrypoints retain adjacent declaration contracts.
No daemon, database, MCP server, third-party runtime dependency, or Git subprocess.

## Execution Boundaries

- This checkout owns planning. Before implementation, create a visible Codex
  project task/worktree on this machine, carrying the committed project and
  approved baseline. Do not silently use a manual/hidden worktree or remote host.
- High is the managed dispatch ceiling in state.md. Independent configured gates
  must meet the user's Frontier requirement. Verify actual invocation evidence;
  no silent lower/default fallback. Keep reusable commands provider-neutral.
- Additional cross-runtime per-phase gates are disabled by explicit user choice.
  Built-in root phase reviews and the configured final gate still run. Keep the
  configured lifecycle gates enabled; no project gate override is added.
- Live hook installation/trust, global skill installation, paid provider calls,
  publication, push, and merge need their own explicit authority. Do not infer
  any of those from design/plan approval.
- Root owns cross-phase decisions and reviews; a phase implementer owns only its
  phase files and atomic task commits. Shared-worktree write turns stay serial.
- The observer identity and digest follow-ups are separate backlog items, not
  prerequisites or opportunistic repairs in this project.
- Any material departure from the approved protocol returns to the user; naming
  an implementation task does not authorize redesign.

## Parallelism

p01 -> p02 -> p03 -> p04 is sequential. p02 consumes p01's schemas, membership and
publication primitive; p03 consumes both and modifies the same shared runtime,
distribution declaration, generated outputs, skill versions, and changelog.
p04 adds the dedicated Claude composed Monitor on p03's controller contract and
shares its observer/runtime/docs owners. These phases are not independent write sets. Bounded read-only reconnaissance
may run alongside implementation; phase ownership and reviews remain with root.

## Common Task Contract

Every task uses an atomic Conventional Commit. Start testable behavior with a
failing focused test, implement, refactor, then run the listed scoped checks.
A new path below is a proposed implementation file, not an existing capability.

Before source changes read src/AGENTS.md. Before packaging/tooling changes read
documentation/docs/engineering/architecture/generated-runtime.md. Before docs
changes read documentation/AGENTS.md. Use the existing Vitest runner
(pnpm run test:vitest <paths>), not a new test runner.

For every task that changes a canonical skill or a declared shared dependency:
update the affected owner's quoted metadata.version and CHANGELOG.md Unreleased
in the same change as required by version-impact validation. Initialize the new
agent-messaging skill at 1.0.0. Determine later bumps against the implementation
base, never by editing generated copies. Regenerate affected committed payloads
with pnpm run build; inspect the diff, then run pnpm run build:check and
pnpm run validate. Add those affected version/changelog files and owned generated
outputs to that task's staging set. No user-level install is part of a task.

Format only the supplied authored paths with the repository's oxfmt write
command, plus affected version/changelog files. Never format generated
distributions, generated documentation inventories, or AGENTS/CLAUDE files.
Run pnpm exec oxlint on each task's changed JS/TS paths and pnpm run type-check.
Do not use broad git add; stage exact task files and generated owned outputs.
For documentation builds, snapshot git status before the build and inspect it
afterward. Stage the owned generated documentation/index.md inventory; restore
only unrelated changes proven to have been made by that build, preserving all
pre-existing user/peer edits. Escalate ambiguous overlap instead of discarding it.

Preserve immutable publication and fail-closed semantics across separately
bundled entrypoints. A temporary fixture is not a live provider installation.
At each phase exit run its focused suites plus build:check and validate, then
perform root code review and any configured independent gate. Confirm actual
HiLL pauses when implementation starts; none is invented by this plan.

## Phase 1: Independent mailbox and shared log (5 tasks)

### Task p01-t01: Define schemas, root resolution, and no-clobber publication

**Create:** src/shared/collaboration/types.ts, paths.ts, records.ts, records.test.ts
(all under src/shared/collaboration/).

**Implement:**

- Schema-v1 validated records, bounded identifiers and pin hashing, canonical
  payload hashes, direct session namespace lookup, and flat collaboration UUIDs.
- Existing root precedence: absolute SESSION_OBSERVER_STATE_DIR, then
  XDG_STATE_HOME/session-observer/collab, then ~/.local/state/session-observer/collab.
  Do not import transcript parsing or modify the existing observer lease store.
- Private owner-checked directories/files, symlink/containment checks, bounded
  enumeration, explicit unknown-schema/capacity errors.
- Exclusive temp creation, fsync/close, hard-link publication, directory sync,
  temp cleanup; identical retry, conflicting final ID, and COMMIT_UNCERTAIN.
  No replacing rename for authoritative records and no persistent mailbox lock.

**Verify:** pnpm run test:vitest src/shared/collaboration/records.test.ts
Tests cover same-ID concurrency, conflicting payloads, symlinks/wrong file
types, malformed/oversized input, unsupported hard links, caps, and process
kills before/after each publication step. No partial final file or overwritten
winner; uncertainty is not reported as absence. Power-loss durability remains
explicitly filesystem-dependent.
Also test wrong owner, relative override rejection, and mismatched absolute root
overrides: stores stay separate and a missing collaboration is reported, never
silently joined through a fallback root.

**Format:** pnpm exec oxfmt --write src/shared/collaboration/types.ts src/shared/collaboration/paths.ts src/shared/collaboration/records.ts src/shared/collaboration/records.test.ts

**Commit:** feat(p01-t01): add immutable collaboration storage primitives

### Task p01-t02: Implement membership, takeover, departure, and closure

**Create:** src/shared/collaboration/membership.ts, membership.test.ts.
**Modify:** shared types/paths/records only as needed for these records.

**Implement:**

- Open collaboration, unique alias join with generation-zero binding, exact
  native identity, cwd as validated metadata, and cross-repository membership.
- Explicit human-directed takeover with exact expected previous pin, reason,
  exclusive next generation, stable participant inbox, and inherited ack-ID/hash
  snapshot including prior inherited receipts. No silent alias redirection.
- Departures and idempotent close; current-member authority; post-publication
  closed-marker rechecks for join/takeover. Preserve in-flight records but label
  them inert/closed; stale sessions receive a supersession notice.
- Read/status/history remain available after closure. No automatic cleanup,
  historical-log move, membership deletion, or cross-machine transport.

**Verify:** pnpm run test:vitest src/shared/collaboration/membership.test.ts
Race duplicate joins, competing successors, close against join/takeover,
stale send/ack ownership, late old-binding ack versus inherited snapshot, and
three participants across separate cwd metadata. No guessing identity from
recency. Corrupt predecessor state fails closed rather than resetting history.

**Format:** pnpm exec oxfmt --write src/shared/collaboration/membership.ts src/shared/collaboration/membership.test.ts src/shared/collaboration/types.ts src/shared/collaboration/paths.ts src/shared/collaboration/records.ts

**Commit:** feat(p01-t02): add exact membership and logged session succession

### Task p01-t03: Implement addressed messages and explicit receipts

**Create:** src/shared/collaboration/messages.ts, messages.test.ts.
**Modify:** shared types and membership interfaces as needed.

**Implement:**

- One immutable file per message, caller-supplied UUID idempotency, recipient
  participant ID plus addressed binding generation, attributed sender and reply
  reference, request/update kinds, normal/high priority.
- Update is the default; only requests can later initiate autonomous attention.
  Preserve approximate deterministic ordering without promising causality.
- Bounded inbox/manual reads, full-body reads by ID, explicit recipient ack with
  hash/generation, inherited receipts, stale-binding rejection and race reporting.
  Printing does not ack, reply does not prove completion, and priority leaves
  unacknowledged holes visible.

**Verify:** pnpm run test:vitest src/shared/collaboration/messages.test.ts
Multi-process senders target one recipient concurrently; three participants work
without an observer install. Test full-body limits, wrong recipient, same-ID
retry/conflict, dropped stdout, out-of-order ack, takeover replay, close races,
and restart persistence. No global queue cursor may hide unacknowledged mail.

**Format:** pnpm exec oxfmt --write src/shared/collaboration/messages.ts src/shared/collaboration/messages.test.ts src/shared/collaboration/types.ts src/shared/collaboration/membership.ts

**Commit:** feat(p01-t03): add durable inboxes and recipient acknowledgments

### Task p01-t04: Implement authoritative log entries and a regenerable view

**Create:** src/shared/collaboration/log.ts, log.test.ts.
**Modify:** shared types as needed.

**Implement:** Agent-authored immutable entry files with UUID/hash, category,
title, author/time, what happened, assessment, and skill implication; render
collaboration.md with deterministic ordering and source-set digest. Detect stale
views in log show/status. Corrections append records; Markdown is never the
authority. Preserve membership/closure history when an explanatory append fails.

**Verify:** pnpm run test:vitest src/shared/collaboration/log.test.ts
Concurrent authors, duplicate/conflicting IDs, render racing append, stale-view
detection, deterministic rebuild, malformed entries/caps, and explicit correction.
No text loss, hidden file overwrite, or automatic native transcript copying.

**Format:** pnpm exec oxfmt --write src/shared/collaboration/log.ts src/shared/collaboration/log.test.ts src/shared/collaboration/types.ts

**Commit:** feat(p01-t04): add immutable collaboration log and rendered view

### Task p01-t05: Ship the manual CLI and dedicated skill in both forms

**Create:** src/skills/agent-messaging/SKILL.md, build.json,
src/agent-messaging.ts, src/cli.test.ts, src/packaging.test.ts.
**Modify:** src/distributions.ts, CHANGELOG.md,
documentation/docs/user-guide/skills/agent-messaging.md (new),
documentation/docs/user-guide/skills/index.md and meta.json.
**Generated owned output:** documentation/index.md, regenerated by the docs build.
Session plugin documentation remains in the documentation site, not a new
plugin-root README; p03-t03 updates its existing plugin landing page.

**Implement:**

- Open/join/send/inbox/ack/log/status/leave/close commands and JSON/exit contracts
  from design. CLI invocation is node <installed-skill>/scripts/agent-messaging.mjs;
  "mail" in design is shorthand, not a required global executable or alias.
- Teach exact identity, explicit human-directed takeover, request versus update,
  ack versus action, manual start/stop checks, untrusted peer context, and serial
  shared-file ownership. No activation or idle delivery is claimed in this slice.
- Declare owner agent-messaging with allowedSourceRoots containing only the new
  shared collaboration root; standalone skills/agent-messaging and Session plugin
  plugins/session/skills/messaging. No observer workflow dependency.
- Build copied payloads and prove they execute with Node alone outside this repo.
  Shell-looking bodies are data; large bodies use stdin and bounded envelopes.
- Close/leave output reports unresolved messages without acknowledging them or
  claiming their work completed. Preserve bounded reads and explicit capacity
  errors; closure remains authoritative even if its summary cannot be rendered.

**Verify:** pnpm run test:vitest src/skills/agent-messaging/src/cli.test.ts src/skills/agent-messaging/src/packaging.test.ts tests/tooling/generated-output-sync.test.ts
Also run all p01 shared suites, pnpm run build, pnpm run build:check,
pnpm run validate, and pnpm --dir documentation build. Check three participants
against the copied installed artifact and both declared distribution forms.
Test that an explicit --self pin conflicting with an available harness signal
fails with exit 2 before mutation. Test close/leave with unresolved mail, including
capacity failure while reporting it; history and receipts remain unchanged.
Inspect docs-build changes and stage only owned outputs per the common contract.
No release, marketplace availability, or fresh-host skill discovery claim.

**Format:** pnpm exec oxfmt --write src/skills/agent-messaging src/distributions.ts CHANGELOG.md documentation/docs/user-guide/skills/agent-messaging.md documentation/docs/user-guide/skills/index.md documentation/docs/user-guide/skills/meta.json

**Commit:** feat(p01-t05): ship standalone and session messaging CLI

## Phase 2: Finite activation and host delivery (4 tasks)

### Task p02-t01: Implement activation epochs, finite claims, and recovery

**Create:** src/shared/collaboration/activation.ts, claims.ts, diagnostics.ts,
activation.test.ts, claims.test.ts, diagnostics.test.ts.
**Modify:** messaging CLI, CLI tests, shared types, new skill instructions.

**Implement:**

- One automatic delivery binding per exact session, with immutable activation
  epochs and direct hashed lookup. Terminated means revoked, expired,
  collaboration closed, binding superseded, or departed. Corrupt/unknown state
  never proves termination. Re-enable must exclusively follow a terminated epoch.
  Publish the full design Activation schema-v1 shape from this first task:
  controller is standalone-messaging and thirdPartyHookAcknowledgment and
  noObserverMonitorAttestation are nullable fields. Later adapters populate
  metadata and composition selects controller values for new epochs; neither
  changes schema-v1 shape nor rewrites existing immutable records. Test phase-2
  records remain readable/terminable after composition support is added.
- Proven human-only two-hour idle renewal, 24-hour absolute cap, fixed-expiry
  fallback when provenance is unproven, visible expiry/re-enable notice.
  Chronologically validate activity receipts so a late prompt cannot resurrect
  an expired activation. Peer events/replays never renew or replenish slots.
- Default 20/max 100 non-reusable continuation slots; event claim -> budget slot
  with proposed keys -> per-message claims -> final active-state validation ->
  bounded output attempt. No claim/emit is an acknowledgment.
- Explicit idempotent retry generations covering pre-slot/pre-message crashes.
  Stop-chain dedup survives message retry. Request-only deterministic watch batch
  event keys include activation, binding, sorted message IDs and retry generations.
- Status explains spent/remaining slots, attempted-but-unacknowledged mail and
  exact retry command. Known incomplete stages say "interrupted attempt — retry
  available"; a post-claim attempt without receipt says outcome unknown, not a
  fabricated proof that the host did or did not receive it.
- Own immutable schema-v1 diagnostics at
  activations/<sessionKey>/diagnostics/<attemptId>.json, using the same no-clobber
  publisher. Allowlist bounded attempt/event/activation identifiers, boundary,
  timestamp, stage and outcome/error codes; omit bodies, prompts, environment,
  credentials and raw host errors. Cap each record at 8 KiB and enumeration at
  4,096 records/session, using the design's explicit soft-cap semantics. No
  silent truncation, overwrite or cleanup. Status exposes the latest recorded
  event/outcome and diagnostic-capacity errors, never proof of delivery; missing
  or failed diagnostic publication leaves the attempt outcome unknown.

**Verify:** pnpm run test:vitest src/shared/collaboration/activation.test.ts src/shared/collaboration/claims.test.ts src/shared/collaboration/diagnostics.test.ts src/skills/agent-messaging/src/cli.test.ts
Fake clocks test all termination causes, hard/idle caps, gaps/replays, generation
races, overflow and corruption. Multi-process fault injection after every claim
stage tests duplicate/overlapping events, no-slot/no-message batches, concurrent
retries, close/revoke/takeover races, no cap overshoot and manual recovery.
Diagnostics tests cover redaction, oversized records, directory overflow,
same-attempt retries/conflicts and failed publication. CLI status tests assert
"outcome, not delivery" and visible capacity/unknown states.

**Format:** pnpm exec oxfmt --write src/shared/collaboration/activation.ts src/shared/collaboration/claims.ts src/shared/collaboration/diagnostics.ts src/shared/collaboration/activation.test.ts src/shared/collaboration/claims.test.ts src/shared/collaboration/diagnostics.test.ts src/shared/collaboration/types.ts src/skills/agent-messaging

**Commit:** feat(p02-t01): add bounded activation and retryable delivery claims

### Task p02-t02: Add fail-closed Codex and Claude boundary adapters

**Create:** src/skills/agent-messaging/src/hooks/codex.ts, claude-code.ts,
src/hooks.test.ts, src/registration.ts, src/registration.test.ts,
src/owner-contract.test.ts,
references/runtime-codex.md, references/runtime-claude-code.md.
**Modify:** messaging build.json, CLI, skill instructions and packaging tests;
shared types/activation/claims/diagnostics and activation tests only for tested
adapter contracts, including acknowledgment and attestation metadata.

**Implement:**

- Native stdin identity/worktree validation, every-turn-start/manual safety net,
  attempted Stop with zero wait default and explicit finite reply-wait <=60s,
  host timeout grace, one continuation per verified turn/chain.
- Missing native event or unproven human-prompt identity means manual/fixed-expiry
  fallback, not a timestamp-generated identity. Interruption and uncertainty
  allow Stop. Errors cannot block a human prompt or generate a Stop loop.
- Complete bodies within the 6,000-character envelope; otherwise exact message
  IDs/full-read command. Attribute and escape untrusted peer text. stdout carries
  only valid host protocol, stderr redacted diagnostics. Publish bounded
  attempt diagnostics through p02-t01's API. A diagnostic-write failure must
  neither block a human prompt nor trigger a continuation/error loop.
- Explicit opt-in registration/config generation, first-enable disclosure,
  exact-command trust notice, inactive-session no-op, scoped uninstall/disable
  preserving unrelated hooks. Claude session-scoped declarations where supported.
  Before registration/enable and at automatic-delivery boundaries, apply the
  ownership truth table below for the exact session. Registration is not itself
  ownership: a recognized observer hook without a same-session lease is inert
  and permits standalone messaging. Refuse active or uncertain observer
  ownership with a manual-fallback notice, including a lease armed after enable.
  Do not remove/replace the observer's hook or lease; Stop composition is
  p03-t02 and Claude Monitor composition is p04-t01.
  Apply the same refusal to the messaging watch owner in p02-t03.
- Put the read-only owner detector in registration.ts. Inspect the effective
  Stop registrations from each host's explicitly bounded inventory; record the
  inventory and visibility limits in its runtime reference. For Claude, inspect
  loaded user/project/local/managed settings plus hook declarations of enabled
  plugins resolved to installed versions, respecting configured scope and
  enablement. Do not scan marketplace/catalog-only copies as active hooks.
  Missing optional settings are empty; unreadable configured sources, unresolved
  enabled plugins or unsupported source resolution mean manual fallback.
  Session-scoped skill/agent frontmatter hooks are outside that file inventory,
  not an unreadable file error. Disclose this limit on first enable; the acting
  session must not arm a known competing observer/Monitor through such hooks.
  Do not claim global enumeration or allow this exclusion to waive a known
  observer conflict. Codex's existing observer registration
  uses the explicitly supplied hooksPath (normally ~/.codex/hooks.json), with
  a caller-supplied absolute scriptPath, not a fixed launcher location. Resolve
  supported command forms without executing them; inspect the launcher for
  session-observer-collab-codex-stop and its owned bundle manifest. Missing,
  validated idle or disarmed exact-session leases do not confer ownership;
  armed, waiting or triggered leases do. Unreadable/invalid observer state and
  required inventory sources that cannot be read retain manual fallback.
  For inventoried but unrecognized third-party Stop commands, disclose the exact
  scoped registrations and require explicit operator acknowledgment before
  enablement via --acknowledge-stop-hooks <fingerprint>. Bind acknowledgment to
  their canonical configuration fingerprint
  in the immutable activation; a changed inventory requires disable/re-enable
  and renewed acknowledgment under existing authority/budget rules. Recheck the
  fingerprint at delivery boundaries. No acknowledgment means manual fallback.
  Preserve those hooks; never execute them to classify them. Acknowledgment
  accepts possible third-party continuation interference, not proof that those
  hooks are inert, trustworthy or coordinated with the shared budget. It cannot
  waive unreadable inventory or active/uncertain known observer ownership.
- At the same resolved collaboration root, read the observer contract
  leases/<ownerSession>.json (native owner session ID, not the messaging hash).
  Match exact runtime/session/worktree. Current schema is 6; a validated lease
  uses effectiveLease for armed/waiting expiry and continuation/loop caps.
  Triggered is a separate conservative owner-present state; effectiveLease
  does not expire it, and messaging must not silently do so. In particular,
  triggered remains owner-present at final validation during a reply-wait:
  that observer may already have emitted this Stop's continuation. Only missing
  or validated idle/disarmed state is inactive. Unknown schema or invalid identity/
  state is uncertainty, never absence. Do not migrate or write observer state.
  Explain this conservative refusal and print the exact scoped recovery command:
  node <observer-collab-skill>/scripts/collab-control.mjs disarm --session
  <native-owner-session> (with the same resolved root). The acting session may
  explicitly disarm after its current continuation finishes; never automatically
  disarm/prune to enable messaging. Test expired-triggered refusal, byte-unchanged
  lease state and successful enable after explicit scoped disarm, without
  removing hooks or affecting another session.
  Claude's existing Monitor is not represented by that Codex/Cursor lease:
  require the acting session to confirm no observer Monitor is armed via
  --confirm-no-observer-monitor at standalone delivery enable and every watch
  start/re-arm. Record the initial attestation with its pin/epoch in activation;
  a watch re-arm validates it and requires a fresh acting-session confirmation,
  without editing the epoch or refreshing its allowance. This is an agent
  attestation, not an enumerable host inventory or proof of exclusive ownership.
  Missing confirmation or lost session context means manual until reconfirmed;
  retire the owned Monitor before handing off ownership. Hooks do not invent
  confirmations. p04-t01 replaces this only for verified Claude composed ownership.
- Pin that reader with owner-contract.test.ts: test-only imports of exported
  leasePath, LEASE_SCHEMA_VERSION, effectiveLease and codexStopCommand, plus
  an isolated launcher produced by installCodexStopBundle (its marker is private,
  not an invented exported constant). Assert path/schema, lease-state outcomes,
  caller-selected launcher paths and positive owner detection from the real
  generated launcher/manifest; independently mutate fixtures to prove drift is
  caught. Shipped messaging never imports observer modules or parses transcripts;
  keep allowedSourceRoots unchanged and verify copied-bundle independence.
- Publish capability labels per boundary; fixture-tested is not installed/trusted/
  invoked/live-proven. Require a qualifying live receipt before marking automatic
  context injection or human-origin renewal supported for a host/version.

**Verify:** pnpm run test:vitest src/skills/agent-messaging/src/hooks.test.ts src/skills/agent-messaging/src/registration.test.ts src/skills/agent-messaging/src/owner-contract.test.ts src/skills/agent-messaging/src/packaging.test.ts
Native fixtures cover human/automatic turns, malformed payloads, continuation
markers, identity mismatch, escaped bodies, oversize references, double callbacks,
expiry, interruption, zero wait, 60s ceiling and unrelated hook preservation.
Test recognized observer registration with no lease and idle/disarmed leases
enables standalone; active same-session, triggered or uncertain observer state
refuses. Test an armed-to-triggered transition during reply-wait final validation
and a new lease after enable: no second coordinated owner or continuation.
Third-party fixtures cover absent acknowledgment, acknowledged unchanged config,
config changes after enable and unreadable inventory; no hook is removed or
executed. Claude inventory fixtures include enabled-plugin Stop hooks, disabled
or catalog-only copies ignored, unreadable settings refused and session-only
hooks disclosed as a visibility limit rather than an unreadable-file failure.
Claude fixtures cover missing, wrong-pin and lost-context attestations,
fresh watch re-arm confirmation and ownership handoff. Manual inbox access stays
available. Test diagnostic
write failures without human-prompt blocking or error-triggered continuation.
Registration tests operate only in isolated fixture homes/configs.

**Format:** pnpm exec oxfmt --write src/skills/agent-messaging src/shared/collaboration/types.ts src/shared/collaboration/activation.ts src/shared/collaboration/activation.test.ts src/shared/collaboration/claims.ts src/shared/collaboration/diagnostics.ts

**Commit:** feat(p02-t02): add bounded prompt and stop delivery adapters

### Task p02-t03: Add finite request-only watch notifications

**Create:** src/skills/agent-messaging/src/watch.ts, watch.test.ts.
**Modify:** CLI, build declaration, Claude runtime reference and skill instructions.

**Implement:** Finite foreground own-inbox watch, max 30 minutes and no later
than activation expiry; bounded request metadata only, deterministic batch keys,
shared claims/slots, termination/interruption cleanup and no self-rearm/daemon.
Monitor and native Stop must not compete as autonomous owners. Re-arm requires
the same still-valid activation and remaining budget, never a fresh allowance.
Manual/start checks continue to expose all unacknowledged kinds regardless of
notification attempt suppression. Native asyncRewake remains a probe candidate,
not an automatic second implementation.
Apply p02-t02's owner/acknowledgment checks on watch start and before emitting;
Claude standalone watch also requires its explicit no-observer-Monitor
confirmation on every start/re-arm. It never creates an activation or new budget.

**Verify:** pnpm run test:vitest src/skills/agent-messaging/src/watch.test.ts src/shared/collaboration/claims.test.ts
Updates do not wake; unchanged, overlapping, retried and reordered batches are
deduplicated correctly; pre-slot crash plus unchanged batch is inspectable and
retryable. Test duration cap, expiry, close/takeover, process interruption, re-arm
with exhausted budget and absence of spawned daemon/replacement watchers.

**Format:** pnpm exec oxfmt --write src/skills/agent-messaging

**Commit:** feat(p02-t03): add finite inbox notification source

### Task p02-t04: Build bounded host probes and acceptance evidence

**Create:** src/skills/agent-messaging/src/probe.ts, probe.test.ts,
references/live-acceptance.md, references/runtime-cursor.md,
src/hooks/cursor.ts and Cursor fixtures only if current evidence supports a
bounded adapter; do not fabricate an integration when the boundary is unavailable.
**Modify:** new skill build.json/instructions and runtime references as warranted.

**Implement:**

- Explicit opt-in probe commands with exact host version/surface/command, event
  provenance and receipt evidence. No live provider execution in normal tests.
- Current Cursor boundary investigation is time-boxed to one documented probe
  per relevant boundary and one configuration correction/retry, then retain
  manual fallback with the observed result. No daemon or alternate product.
- Measure cold/warm validation of 4,096 activity receipts on the recorded machine,
  with elapsed times and host timeout headroom. Preserve exact idle semantics;
  no approximate receipt coalescing without a new user decision.
- Acceptance matrix for Codex/Claude/Cursor separates documented, fixture-tested,
  installed, trusted, invoked, recipient-context-observed, continuation-observed,
  and cleanup verified. Test human versus automatic provenance explicitly.
- A live run requires the operator's exact host/session scope, hook/trust changes,
  quota budget, timeout and cleanup approval in the acting session. Without it,
  complete the probe tooling and report live rows unverified, leaving those
  automatic capabilities disabled/manual. Do not treat that as a passing live gate.
- Before any phase-2 automatic-continuation probe, apply p02-t02's truth table:
  no active/uncertain observer owner, a readable hook inventory and acknowledgment
  of exact third-party registrations where present; Claude uses the explicit
  acting-session Monitor attestation. Record these limits rather than asserting
  proof about arbitrary third-party hooks. Phase-2 evidence describes standalone
  delivery only. Composed
  Stop acceptance must run after p03-t02 and composed Monitor acceptance after
  p04-t01, each under separate live authority.

**Verify:** pnpm run test:vitest src/skills/agent-messaging/src/probe.test.ts src/skills/agent-messaging/src/hooks.test.ts
Tests prove opt-in enforcement, bounded time/count budgets, sanitized receipts,
cleanup of only owned registrations/processes, unrelated-session inertness,
timeout/interruption and honest unsupported/unknown results. Separately authorized
live runs verify real start context, Stop continuation, idle notification,
restart/re-arm and disable cleanup; record failures without repeated spend.
Phase exit runs all p02 suites plus build:check, type-check and validate.

**Format:** pnpm exec oxfmt --write src/skills/agent-messaging

**Commit:** test(p02-t04): add explicit host delivery acceptance probes

## Phase 3: Observer Stop composition and distribution docs (3 tasks)

### Task p03-t01: Put observer collaboration logs in the shared container

**Modify:** src/skills/session-observer-collab/SKILL.md, build.json,
src/collab-control.mjs and adjacent .d.mts, src/control.test.ts;
src/distributions.ts and CHANGELOG.md.
**Create:** src/skills/session-observer-collab/src/shared-log.test.ts.
**Modify if needed:** shared membership/log APIs with focused regression coverage.

**Implement:** Existing collaboration setup opens/joins the same UUID container
and prints the deterministic immutable-log/rendered-view paths, even with
messaging delivery disabled. Bundle shared primitives, without requiring the
standalone messaging workflow to be installed. Retain the existing required
session-observer workflow and separate offset/private continuity stores.
Teach immutable append/correction/render commands instead of hand-editing the
Markdown view. Leave historical logs/transcripts untouched and disclose the
clean break. No aliases, automatic migration or compatibility wrappers.

**Verify:** pnpm run test:vitest src/skills/session-observer-collab/src/control.test.ts src/skills/session-observer-collab/src/shared-log.test.ts src/shared/collaboration/log.test.ts
Run messaging CLI and observer control from separate generated bundles against
one store. Observation-only use creates no active mailbox delivery; log writers
coexist with messaging-only participants, and old observer offsets remain byte-
for-byte unchanged by mailbox/log operations. Verify both existing collab forms.

**Format:** pnpm exec oxfmt --write src/skills/session-observer-collab src/shared/collaboration src/distributions.ts CHANGELOG.md

**Commit:** feat(p03-t01): unify messaging and observer collaboration log storage

### Task p03-t02: Compose one continuation owner and preserve observer cursors

**Modify:** src/skills/session-observer-collab/src/hooks/codex-stop.mjs,
src/hooks/cursor-stop.mjs and adjacent .d.mts where changed;
src/lib/runtime-adapter.mjs, src/lib/lease-state.mjs and their .d.mts;
src/collab-control.mjs, src/codex-lifecycle.mjs and affected .d.mts;
src/codex-hook.test.ts, src/cursor-hook.test.ts, src/control.test.ts,
src/wake-envelope-contract.test.ts, references/runtime-codex.md,
references/runtime-claude-code.md, references/runtime-cursor.md.
**Create:** src/skills/session-observer-collab/src/messaging-composition.test.ts.
**Modify:** src/shared/collaboration/types.ts, activation.ts, claims.ts and
affected tests; src/skills/agent-messaging/src/agent-messaging.ts,
src/registration.ts, src/hooks/codex.ts, src/hooks/claude-code.ts, src/watch.ts,
src/cli.test.ts, src/hooks.test.ts, src/registration.test.ts, src/watch.test.ts,
src/owner-contract.test.ts; any Cursor messaging adapter created in p02-t04.
Both src/skills/agent-messaging/SKILL.md and
src/skills/session-observer-collab/SKILL.md own the composed-session instructions.

**Implement:** One controller selects inbox requests before observation ranges.
When messaging wins, defer observation; otherwise reserve a shared slot before
observer CAS. A CAS loss spends at most the reserved slot and emits nothing.
Keep observer public/private cursor semantics and its N=2 boundary unchanged.
Prevent competing standalone/observer Stop registrations from both becoming
owners. This task implements Codex and any verified Cursor Stop composition;
Claude composed Monitor is owned by p04-t01. Until that task passes, a Claude
observer controller request reports composed-monitor-unavailable and refuses
automatic enablement, preserving manual/start inbox checks. Do not substitute
the existing unbounded observer Monitor or claim its wakes spend shared slots.
Unknown Cursor boundaries retain manual fallback. Implemented composed modes share expiry and finite
budget, and neither can renew it through peer/automatic activity. Close/disable/
takeover terminates the relevant delivery without deleting observation history.

Replace p02's active-observer conflict refusal only for explicitly composed
sessions. Bind the selected controller (standalone messaging or observer-collab)
to the immutable activation epoch alongside its existing stop/monitor mechanism
and exact session/member/worktree identity. A matching observer lease alone is
not proof of composition: require a verified composed-capable observer adapter
using that same epoch and shared claims. The observer controller may then own
delivery enable and the single Stop/Monitor route; the standalone messaging
Stop/watch entrypoints stay inert for that epoch. A messaging-only session with
a recognized composed-capable observer hook but no lease selects standalone
messaging. Active mismatched, legacy or uncomposed observer owners still refuse;
unknown observer state remains uncertain. Unrelated third-party hooks retain
p02-t02's explicit acknowledgment policy in both modes, not a blanket refusal
and not inclusion in the coordinated single-owner guarantee. Never switch owners
implicitly: changing an active controller requires explicit disable/re-enable
under the existing authority and budget rules, not a second activation or owner.
Update the CLI enable path, hooks, watch, registration and their p02 tests in
this task, preserving standalone refusal cases while adding Stop-composed cases.

Teach both skills to inspect addressed inbox requests before observation and
deduplicate by exact message ID in working context: an observed transcript quote
of an already-presented ID is context, not another request. Do not fuzzy-match
prose or advance public/private observer cursors because a message was acked.

**Ordered implementation stages (one task; no renumbering):**

1. Implement shared controller binding and the messaging-side enable/registration/
   hooks/watch exception against an observer fixture. Run the five messaging
   suites listed below plus shared activation/claims suites and require green
   before stage 2. The fixture grants no installed capability: without a real
   verified composed-capable adapter, active observer ownership stays fail-closed.
2. Implement observer delegation, shared-slot-before-CAS and composition tests,
   then both skills' instructions and runtime references. Run the complete
   Verify list before the task's atomic commit. Isolate stage failures before
   adding more integration work; do not commit a half-composed live capability.

**Verify:** pnpm run test:vitest src/skills/session-observer-collab/src/messaging-composition.test.ts src/skills/session-observer-collab/src/codex-hook.test.ts src/skills/session-observer-collab/src/cursor-hook.test.ts src/skills/session-observer-collab/src/control.test.ts src/skills/session-observer-collab/src/wake-envelope-contract.test.ts src/skills/agent-messaging/src/cli.test.ts src/skills/agent-messaging/src/hooks.test.ts src/skills/agent-messaging/src/registration.test.ts src/skills/agent-messaging/src/watch.test.ts src/skills/agent-messaging/src/owner-contract.test.ts src/shared/collaboration/activation.test.ts src/shared/collaboration/claims.test.ts
Race message arrival versus observation selection, CAS failure, competing host
callbacks and close/revoke. Assert inbox-first selection, exact shared cap,
at-most-one continuation owner, no ack-driven observer cursor advancement, and
three messaging peers without a third stateful observer.
Enable succeeds with a verified composed observer controller; standalone Stop
and watch cannot emit for its epoch. A recognized observer hook without a lease
selects standalone. Active uncomposed or mismatched owners still fail
closed. Race both bundles against one epoch and assert one shared budget/owner.
Review both generated skill forms for the exact-ID dedup instruction and test
that inbox presentation/ack never advances either observer cursor.
Explicitly test Claude composed enable remains unavailable until p04-t01's
adapter exists; a recipe around the legacy base watcher is not capability proof.

**Format:** pnpm exec oxfmt --write src/skills/session-observer-collab src/skills/agent-messaging src/shared/collaboration

**Commit:** feat(p03-t02): share bounded continuation ownership with observation

### Task p03-t03: Prepare docs, release surfaces, and distribution verification

**Modify:** documentation/docs/user-guide/skills/agent-messaging.md,
session-observer-collab.md, skills/index.md and meta.json;
documentation/docs/user-guide/plugins/session/index.md;
documentation/docs/engineering/architecture/index.md and meta.json.
**Create:** documentation/docs/engineering/architecture/agent-messaging.md.
**Generated owned output:** documentation/index.md, regenerated by the docs build.
**Modify as actually affected:** plugins/consensus/README.md, RELEASING.md, src/distributions.ts, CHANGELOG.md,
canonical skill versions and maintained plugin manifests when a release bump is
required; tests/tooling/generated-output-sync.test.ts for new distribution
invariants. Generated outputs/inventory are produced only by owning commands.
Final acceptance and backlog closure belong to p04-t01 after Claude composition.

**Implement:** Document N>=3 messaging alone, cross-repository paths, exact self
identity, explicit takeover, receipts versus actions, bounded start/stop/manual/
Monitor behavior, interrupted attempts and recovery, shared log authority,
expiry/capacity/retention, and per-host evidence. Explain why messages can wait
without automatic attention; never promise exactly-once actions. Reconcile
standalone Session messaging and existing Consensus observer-collab distribution
references. Record clean breaks and actual versions in Unreleased.
Label Claude composed Monitor as pending p04-t01, not already supported; that
task updates these same docs from its verified evidence before final acceptance.

**Verify:**

- pnpm run build; inspect generated diffs, then pnpm run build:check
- pnpm run test; pnpm run type-check; pnpm run validate; pnpm run smoke
- pnpm run validate:skill-versions -- --base-ref d74abe671561053154d3012e1b8edd11fc079dcf
  (verified merge base of this branch and origin/main at planning time; before
  source edits, the implementation root verifies ancestry and records any
  deliberate replacement after a rebase rather than silently changing the base).
- pnpm --dir documentation build; verify local maps/links/sidebar and inspect
  any affected diagrams at desktop/mobile in both themes per documentation rules.
  Inspect pre/post-build status and stage the owned documentation/index.md;
  preserve unrelated existing edits per the common task contract.
- Scoped oxlint/oxfmt checks on changed authored paths, no generated formatting.
- Review the live matrix: unverified rows remain unverified/manual; do not run the
  unrelated paid Consensus live gate. Run only explicitly authorized messaging
  acceptance probes.
- Leave the messaging backlog open and final Frontier gate pending p04-t01.
  This distribution check does not close out the newly approved Claude work.

**Format:** pnpm exec oxfmt --write documentation/docs/user-guide/skills/agent-messaging.md documentation/docs/user-guide/skills/session-observer-collab.md documentation/docs/user-guide/skills/index.md documentation/docs/user-guide/skills/meta.json documentation/docs/user-guide/plugins/session/index.md documentation/docs/engineering/architecture/agent-messaging.md documentation/docs/engineering/architecture/index.md documentation/docs/engineering/architecture/meta.json plugins/consensus/README.md RELEASING.md src/distributions.ts CHANGELOG.md tests/tooling/generated-output-sync.test.ts
Also format changed canonical version files and maintained manifests; never the
generated inventory. For the messaging backlog item, run
`pnpm exec oxfmt --stdin-filepath=agent-messaging-backlog.md < .oat/repo/pjm/backlog/items/BL-260619-inter-agent-direct-messaging.md`
before archiving it, then apply the returned prose with apply_patch, preserving
managed blocks. For another changed PJM prose file, substitute its actual input
path and a non-ignored virtual .md filename; never redirect output over the input
or hand-format a generated index.

**Commit:** docs(p03-t03): document and verify agent messaging delivery

## Phase 4: Claude composed Monitor and final acceptance (1 task)

### Task p04-t01: Add the single finite Claude composed Monitor

**Create:** src/skills/session-observer-collab/src/claude-monitor.mjs and
claude-monitor.d.mts; src/claude-monitor.test.ts and src/claude-monitor-packaging.test.ts.
**Modify:** observer-collab build.json, SKILL.md, src/generated-runtime.d.ts,
src/collab-control.mjs/.d.mts, src/lib/lease-state.mjs/.d.mts,
src/lib/runtime-adapter.mjs/.d.mts, src/control.test.ts,
src/messaging-composition.test.ts, src/runtime-claude-code-reference.test.ts,
references/runtime-claude-code.md; messaging SKILL.md, CLI, registration, watch,
their tests and references/runtime-claude-code.md plus live-acceptance.md;
shared collaboration claims/types and tests only for composed observation keys.
**Modify:** the two user skill pages and architecture page created in p03-t03,
src/distributions.ts if the new entrypoint requires a declaration, affected
canonical versions and CHANGELOG.md. Regenerate owned skill/plugin payloads and
documentation/index.md through their owning builds. No base observer source
change or base-skill version bump is planned: its existing non-mutating reader
is already a permitted bundled dependency of observer-collab.

**Implement:**

- Ship node <observer-collab-skill>/scripts/claude-monitor.mjs with explicit
  collaboration UUID, self pin, exact peer pin/transcript/cwd, activation ID,
  and finite max-runtime <=30 minutes, bounded additionally by activation and
  observer-lease expiry. It is a foreground command for a proven harness
  Monitor, not a native Stop hook, daemon or shell around catch-up-then-watch.
  Emit one bounded structured automatic notification at most, then exit; the
  acting agent may explicitly start another finite run within the same epoch's
  remaining lifetime/budget. Never self-rearm or spawn a replacement process.
- Extend the observer lease owner runtime and adjacent declarations to accept
  claude-code for this new adapter, preserving existing Codex/Cursor schemas and
  records. Initial/re-arm control validates the exact owner, peer, private cursor
  and same immutable observer-collab/monitor activation. Re-arm preserves the
  current private cursor and shared slot history; it cannot reset the messaging
  budget, revive expiry or implicitly switch the peer. Do not call the generic
  arm path with default cursor zero. No automatic migration of the old Monitor.
- Before enable and every run, the acting session explicitly confirms the old
  observer-only Monitor and any standalone messaging watcher are stopped. Bind
  that confirmation to exact epoch/pins; uncertain or lost context remains
  manual. Use p02's bounded hook inventory/acknowledgment contract and attestations,
  not a claim that the CLI enumerates harness Monitors. Advertise composed
  capability only for the new verified entrypoint; p03's unavailable label is
  replaced here. Standalone messaging Stop/watch remains inert for this epoch.
- Poll inbox requests first through p01/p02 shared APIs. If selected, use the
  existing request-batch event key and event -> slot -> message claims sequence;
  do not inspect/advance the observer cursor for that message attempt.
- For transcript candidates, call the existing buildDigest from the permitted
  session-observer source using the exact peer runtime, transcript, session and
  private cursor, without observeCatchUp or base watcher execution (both would
  consume public state too early). Reuse selectCompletedContinuation and the
  selected-prefix/continuity helpers, including observeCursorCompletion for
  Cursor peers. Metadata/no-op progress may advance only the private cursor via
  advanceAdapterCursor without a wake or shared slot; public offsets stay intact.
- For a substantive observation, derive a domain-separated event key from
  activation, exact owner/peer pins, selected range/index base and verified
  selected-prefix identity, not wall clock or re-arm lease ID. Recheck inbox
  priority immediately before committing that selection. Reserve an exclusive
  event claim and shared slot before claimAdapterTrigger's private-cursor CAS.
  A CAS loser emits nothing and may waste its reserved slot. These are
  observation claims, not fabricated mailbox messages or acknowledgments.
  Recheck exact activation, closure, owner, inventory acknowledgment, deadline
  and peer continuity immediately before either notification. Shared slot history
  bounds message and observation wakes together across races and re-arm.
- Notification contains type, activation/attempt identity and bounded message
  IDs or exact peer range, not uncontrolled transcript prose. The receiving skill
  revalidates, checks inbox first, reads the exact referenced range through normal
  observer workflow and applies exact-ID dedup. Public observer offsets change
  only through that explicit observer read, never merely because mail was acked.
  Heartbeats, quiet intervals, errors and termination print no wake-bearing
  stdout; redacted diagnostics use the existing diagnostic path/stderr.
- Document explicit interruption/re-arm, disarm and closeout; preserve history.
  Keep observation-only use unchanged outside a composed activation. A live
  Claude composed receipt remains separately authorized and is required before
  marking that host/version wake tier live-supported.

**Verify:** pnpm run test:vitest src/skills/session-observer-collab/src/claude-monitor.test.ts src/skills/session-observer-collab/src/claude-monitor-packaging.test.ts src/skills/session-observer-collab/src/messaging-composition.test.ts src/skills/session-observer-collab/src/control.test.ts src/skills/session-observer-collab/src/runtime-claude-code-reference.test.ts src/skills/agent-messaging/src/cli.test.ts src/skills/agent-messaging/src/registration.test.ts src/skills/agent-messaging/src/watch.test.ts src/shared/collaboration/claims.test.ts src/shared/collaboration/activation.test.ts
Use synthetic transcripts and fake clocks: request-only wake with a quiet peer,
observation-only wake, simultaneous request/range inbox priority, no-op quiet
progress, duplicate runners, CAS loss, same-range re-arm dedup, exhaustion,
expiry/revocation/takeover, changed peer prefix, truncation, wrong identity,
old-Monitor-not-stopped refusal and interrupted output. Both wake kinds share
one cap; mail never advances either observer cursor; monitor transcript selection
changes private state only. Copied standalone and plugin bundles execute with
Node alone outside the repo and no base watcher process or public-state writes.
Test both existing phase-2 activation fixtures and all supported peer runtimes.

Repeat p03-t03's complete repository/build/docs/version checks after this task's
changes. Then, if every backlog acceptance criterion is met, run PJM adoption
preflight, close/archive BL-260619-inter-agent-direct-messaging and regenerate
its managed index in the same shipping change. Otherwise keep it open and
report unmet criteria. After task commit, root runs pnpm run worktree:validate
on the clean visible worktree and performs final Frontier review. No PR/push/
merge, global install or live provider probe is implicitly authorized.

**Format:** pnpm exec oxfmt --write src/skills/session-observer-collab src/skills/agent-messaging src/shared/collaboration src/distributions.ts CHANGELOG.md documentation/docs/user-guide/skills/agent-messaging.md documentation/docs/user-guide/skills/session-observer-collab.md documentation/docs/engineering/architecture/agent-messaging.md
Use p03-t03's exact stdin command for any changed backlog prose before archiving;
never format generated distributions or the generated documentation inventory.

**Commit:** feat(p04-t01): compose bounded Claude inbox and observation notifications

## Reviews

| Scope  | Type     | Status          | Date       | Artifact                                                    | Reviewed Head | Invocation | Gate Target |
| ------ | -------- | --------------- | ---------- | ----------------------------------------------------------- | ------------- | ---------- | ----------- |
| p01    | code     | pending         | -          | -                                                           | -             | -          | -           |
| p02    | code     | pending         | -          | -                                                           | -             | -          | -           |
| final  | code     | pending         | -          | -                                                           | -             | -          | -           |
| spec   | artifact | pending         | -          | -                                                           | -             | -          | -           |
| design | artifact | pending         | -          | -                                                           | -             | -          | -           |
| p03    | code     | pending         | -          | -                                                           | -             | -          | -           |
| plan   | artifact | passed          | 2026-09-19 | -                                                           | -             | -          | -           |
| plan   | artifact | fixes_completed | 2026-09-19 | reviews/archived/artifact-plan-review-2026-09-19T014304Z.md | -             | -          | -           |
| plan   | artifact | fixes_completed | 2026-09-19 | reviews/archived/artifact-plan-review-2026-09-19T021241Z.md | -             | -          | -           |
| plan   | artifact | fixes_completed | 2026-09-19 | reviews/archived/artifact-plan-review-2026-09-19T030934Z.md | -             | -          | -           |
| plan   | artifact | fixes_completed | 2026-09-19 | reviews/archived/artifact-plan-review-2026-09-19T125014Z.md | -             | -          | -           |
| p04    | code     | pending         | -          | -                                                           | -             | -          | -           |
| plan   | artifact | received        | 2026-09-19 | reviews/artifact-plan-review-2026-09-19T131345Z.md          | -             | -          | -           |

The original scaffold rows are preserved. Spec is not applicable in quick
mode. Fable's design collaboration review passed e95a0d91, followed by explicit
user approval; it is documented in design.md and is not fabricated as an OAT
review artifact. Plan artifact auto-review passed after one local correction:
the version-validation command now names the verified base instead of a shell
placeholder. Structured review returned no residual findings; no review artifact
was written for this inline pass. The first configured independent gate passed
its Important threshold (0 Critical, 0 Important, 3 Medium, 4 Minor). The user
approved resolving all seven findings directly in this plan; no tasks were added.
All are fixes_completed, pending re-review, not a clean plan-review pass.
Gate run f1bc5e2e-4077-4485-925e-6fc98bc9df59 returned status=ok,
receiveEligible=true and a corroborated artifact handoff. Scope provenance is
legacy-plan-only (configured command); the reviewer also checked discovery/design.
Configured target claude-fable-skip-permissions reported fable from exec-target
configuration; runtime identity was absent from the gate envelope. Follow-up
inspection of that run's Claude transcript c079e4e6-8818-465d-841a-4518c7e405ec
verified assistant message.model=claude-fable-5-1 (lines 19 and 266; final
stop_reason=end_turn; run ID in the same transcript). Frontier identity is
therefore corroborated independently of the configured label. Revised-plan
readiness remains withheld until re-review.

Approved dispositions (all resolve_in_artifact): M1 removes the nonexistent
README target; M2 assigns bounded diagnostics/status/tests to p02-t01 and adapter
publication to p02-t02; M3 fails closed on competing ownership before composition;
m1 adds named safety cases; m2 owns the generated docs inventory and safe staging;
m3 adds unresolved-mail closeout reporting; m4 normalizes the inline ledger cell.

Dispatch: selection_reason=inherit; route=planning-parent-inline;
parent=gpt-6-astra/high (launcher turn_context); reviewer-threshold=gpt-5.6-sol/high
(High project resolver, complete ladder); scope=artifact:plan;
output=structured; child-launch=none. Inherited self-review does not replace
independent Frontier gate review. Additional phase gates were explicitly declined.

Revised-plan inline self-review on 2026-09-19 returned no findings after the seven
approved corrections. Reused deliberate planning-parent inheritance:
gpt-6-astra/high from the current launcher turn_context is above the freshly
resolved gpt-5.6-sol/high reviewer threshold; ladder completeness=true.
Read discovery/design/plan/implementation, checked task/phase IDs and local links,
and verified the existing observer registration and docs-build seams. This is
not the independent gate; the archived event remains fixes_completed until the
configured re-review concludes.

Second gate a5a5f137-5011-4d64-81af-c4db88d3f3e7 verified the first seven
corrections at eec9583b and returned 0 Critical, 0 Important, 2 Medium, 2 Minor.
Its status=ok, receiveEligible=true and matched handoff were validated.
The user approved all four additional corrections, now resolve_in_artifact:
M1 assigns the explicit composed-controller exception and all messaging files/
tests to p03-t02; M2 pins read-only owner detection with test-only parity checks
in p02-t02; m1 assigns exact-ID dedup guidance to both skills in p03-t02; m2
supplies the exact PJM stdin-formatting command. Task IDs/counts are unchanged.
The second review is archived, fixes_completed, pending re-review. Its native
Claude transcript 7c6df088-35f6-47be-b380-71abd861dd71 confirms
claude-fable-5-1 at assistant lines 19 and 247 (final end_turn); this corroborates
the configured Frontier target without changing its invocation metadata.

Third gate 09f3c2b9-f6ec-4cda-91f4-966ba80a9f20 verified the second corrections
at e287517c, then returned 0 Critical, 1 Important, 1 Medium and 2 Minor.
The user approved all four corrections, now resolve_in_artifact:
I1 distinguishes dormant observer registration from active ownership and records
explicit acknowledgment for inventoried third-party hooks; M1 stages p03-t02
with green focused tests between stages; m1 counts triggered observer leases as
owner-present; m2 names Claude's acting-session attestation and re-arm checks.
Discovery/design carry the approved policy clarification. IDs/counts and gate
configuration remain unchanged. The third event is fixes_completed, not passed;
its native transcript f6953764-c455-4bce-aaaa-072771890652 corroborated
claude-fable-5-1 (assistant lines 19 and 252, final end_turn).

Correction-scoped inline self-review used discovery/design/plan/implementation
and the actual observer lease semantics; no residual findings. Task inventory
remains 12 unique IDs, all prior review events preserved, format and diff checks
pass. Deliberate parent inheritance remains gpt-6-astra/high (current launcher
turn_context), above the freshly resolved High gpt-5.6-sol/high threshold;
ladder completeness=true. This self-review is not the independent gate.

Fourth gate c94b55d0-0138-409d-aca6-ed4703fa8c99 verified c0a61d53's approved
corrections, then found the Claude composed implementation gap (I1), inventory
boundary (M1), triggered recovery (m1), activation shape (m2) and baseline
pointer (m3). The user approved the dedicated Monitor and root's other remedies.
All are resolved in artifacts; m1 retains conservative refusal with explicit
disarm instead of the review's unsafe expiry-only release suggestion. A dedicated
p04-t01 adds the requested implementation scope without renumbering prior tasks;
final acceptance/backlog closure now follows it. The review is archived with
fixes_completed, not passed. Its exact runtime was claude-fable-5-1 in correlated
transcript 51f413a7-4496-47a2-82e0-7b76ae8f2fb7 (lines 19/253, final end_turn).

Correction-scoped inherited inline review checked the amended task boundaries,
source seams, activation shape, ownership recovery, verification commands and
tracking consistency. No residual findings. All 12 existing task IDs and review
events are preserved; p04-t01 is the sole new task. Deliberate parent inheritance
remains gpt-6-astra/high, above the resolved High gpt-5.6-sol/high threshold with
a complete ladder. Independent Frontier re-review remains required.

## Implementation Complete

**Planned, not implemented:**

- Phase 1: 5 tasks — independent storage, membership, messages, logs and CLI.
- Phase 2: 4 tasks — finite activation, host adapters, watch and acceptance probes.
- Phase 3: 3 tasks — shared observer logs, Stop composition and distribution docs.
- Phase 4: 1 task — dedicated Claude composed Monitor and final acceptance.

**Total: 13 tasks. Completed: 0/13. First task: p01-t01.**
Planning approval is not implementation, live acceptance, release or merge.

## References

- [Approved design](design.md)
- [Discovery and constraints](discovery.md)
- [Project state and dispatch policy](state.md)
- [Implementation tracking](implementation.md)
- [Messaging backlog item](../../../repo/pjm/backlog/items/BL-260619-inter-agent-direct-messaging.md)
- [Separate observation state](../../../repo/reference/decisions/DR-260724-separate-observation.md)
- [Exact stateful identity](../../../repo/reference/decisions/DR-260724-stateful-work-requires-exact.md)
