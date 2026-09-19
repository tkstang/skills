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
Design approval bookkeeping is committed at 2d399c33. This plan is a draft;
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

p01 -> p02 -> p03 is sequential. p02 consumes p01's schemas, membership and
publication primitive; p03 consumes both and modifies the same shared runtime,
distribution declaration, generated outputs, skill versions, and changelog.
These phases are not independent write sets. Bounded read-only reconnaissance
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
**Modify:** src/distributions.ts, CHANGELOG.md, plugins/session/README.md,
documentation/docs/user-guide/skills/agent-messaging.md (new),
documentation/docs/user-guide/skills/index.md and meta.json.

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

**Verify:** pnpm run test:vitest src/skills/agent-messaging/src/cli.test.ts src/skills/agent-messaging/src/packaging.test.ts tests/tooling/generated-output-sync.test.ts
Also run all p01 shared suites, pnpm run build, pnpm run build:check,
pnpm run validate, and pnpm --dir documentation build. Check three participants
against the copied installed artifact and both declared distribution forms.
No release, marketplace availability, or fresh-host skill discovery claim.

**Format:** pnpm exec oxfmt --write src/skills/agent-messaging src/distributions.ts CHANGELOG.md plugins/session/README.md documentation/docs/user-guide/skills/agent-messaging.md documentation/docs/user-guide/skills/index.md documentation/docs/user-guide/skills/meta.json

**Commit:** feat(p01-t05): ship standalone and session messaging CLI

## Phase 2: Finite activation and host delivery (4 tasks)

### Task p02-t01: Implement activation epochs, finite claims, and recovery

**Create:** src/shared/collaboration/activation.ts, claims.ts,
activation.test.ts, claims.test.ts.
**Modify:** messaging CLI, CLI tests, shared types, new skill instructions.

**Implement:**

- One automatic delivery binding per exact session, with immutable activation
  epochs and direct hashed lookup. Terminated means revoked, expired,
  collaboration closed, binding superseded, or departed. Corrupt/unknown state
  never proves termination. Re-enable must exclusively follow a terminated epoch.
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

**Verify:** pnpm run test:vitest src/shared/collaboration/activation.test.ts src/shared/collaboration/claims.test.ts src/skills/agent-messaging/src/cli.test.ts
Fake clocks test all termination causes, hard/idle caps, gaps/replays, generation
races, overflow and corruption. Multi-process fault injection after every claim
stage tests duplicate/overlapping events, no-slot/no-message batches, concurrent
retries, close/revoke/takeover races, no cap overshoot and manual recovery.

**Format:** pnpm exec oxfmt --write src/shared/collaboration/activation.ts src/shared/collaboration/claims.ts src/shared/collaboration/activation.test.ts src/shared/collaboration/claims.test.ts src/shared/collaboration/types.ts src/skills/agent-messaging

**Commit:** feat(p02-t01): add bounded activation and retryable delivery claims

### Task p02-t02: Add fail-closed Codex and Claude boundary adapters

**Create:** src/skills/agent-messaging/src/hooks/codex.ts, claude-code.ts,
src/hooks.test.ts, src/registration.ts, src/registration.test.ts,
references/runtime-codex.md, references/runtime-claude-code.md.
**Modify:** messaging build.json, CLI, skill instructions and packaging tests;
shared activation/claims only for tested adapter contracts.

**Implement:**

- Native stdin identity/worktree validation, every-turn-start/manual safety net,
  attempted Stop with zero wait default and explicit finite reply-wait <=60s,
  host timeout grace, one continuation per verified turn/chain.
- Missing native event or unproven human-prompt identity means manual/fixed-expiry
  fallback, not a timestamp-generated identity. Interruption and uncertainty
  allow Stop. Errors cannot block a human prompt or generate a Stop loop.
- Complete bodies within the 6,000-character envelope; otherwise exact message
  IDs/full-read command. Attribute and escape untrusted peer text. stdout carries
  only valid host protocol, stderr redacted diagnostics.
- Explicit opt-in registration/config generation, first-enable disclosure,
  exact-command trust notice, inactive-session no-op, scoped uninstall/disable
  preserving unrelated hooks. Claude session-scoped declarations where supported.
  Do not modify existing observer Stop ownership yet; composition is p03-t02.
- Publish capability labels per boundary; fixture-tested is not installed/trusted/
  invoked/live-proven. Require a qualifying live receipt before marking automatic
  context injection or human-origin renewal supported for a host/version.

**Verify:** pnpm run test:vitest src/skills/agent-messaging/src/hooks.test.ts src/skills/agent-messaging/src/registration.test.ts src/skills/agent-messaging/src/packaging.test.ts
Native fixtures cover human/automatic turns, malformed payloads, continuation
markers, identity mismatch, escaped bodies, oversize references, double callbacks,
expiry, interruption, zero wait, 60s ceiling and unrelated hook preservation.
Registration tests operate only in isolated fixture homes/configs.

**Format:** pnpm exec oxfmt --write src/skills/agent-messaging src/shared/collaboration/activation.ts src/shared/collaboration/claims.ts

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

**Verify:** pnpm run test:vitest src/skills/agent-messaging/src/probe.test.ts src/skills/agent-messaging/src/hooks.test.ts
Tests prove opt-in enforcement, bounded time/count budgets, sanitized receipts,
cleanup of only owned registrations/processes, unrelated-session inertness,
timeout/interruption and honest unsupported/unknown results. Separately authorized
live runs verify real start context, Stop continuation, idle notification,
restart/re-arm and disable cleanup; record failures without repeated spend.
Phase exit runs all p02 suites plus build:check, type-check and validate.

**Format:** pnpm exec oxfmt --write src/skills/agent-messaging

**Commit:** test(p02-t04): add explicit host delivery acceptance probes

## Phase 3: Observer composition and complete distribution (3 tasks)

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
**Modify:** shared activation/claims APIs and messaging registration if needed.

**Implement:** One controller selects inbox requests before observation ranges.
When messaging wins, defer observation; otherwise reserve a shared slot before
observer CAS. A CAS loss spends at most the reserved slot and emits nothing.
Keep observer public/private cursor semantics and its N=2 boundary unchanged.
Prevent competing standalone/observer Stop registrations from both becoming
owners. Reuse the verified Claude notification owner where composed; unknown
Cursor boundaries retain manual fallback. Both modes share expiry and finite
budget, and neither can renew it through peer/automatic activity. Close/disable/
takeover terminates the relevant delivery without deleting observation history.

**Verify:** pnpm run test:vitest src/skills/session-observer-collab/src/messaging-composition.test.ts src/skills/session-observer-collab/src/codex-hook.test.ts src/skills/session-observer-collab/src/cursor-hook.test.ts src/skills/session-observer-collab/src/control.test.ts src/skills/session-observer-collab/src/wake-envelope-contract.test.ts
Race message arrival versus observation selection, CAS failure, competing host
callbacks and close/revoke. Assert inbox-first selection, exact shared cap,
at-most-one continuation owner, no ack-driven observer cursor advancement, and
three messaging peers without a third stateful observer.

**Format:** pnpm exec oxfmt --write src/skills/session-observer-collab src/skills/agent-messaging src/shared/collaboration

**Commit:** feat(p03-t02): share bounded continuation ownership with observation

### Task p03-t03: Finish docs, release surfaces, and project-wide verification

**Modify:** documentation/docs/user-guide/skills/agent-messaging.md,
session-observer-collab.md, skills/index.md and meta.json;
documentation/docs/user-guide/plugins/session/index.md;
documentation/docs/engineering/architecture/index.md and meta.json.
**Create:** documentation/docs/engineering/architecture/agent-messaging.md.
**Modify as actually affected:** plugins/session/README.md,
plugins/consensus/README.md, RELEASING.md, src/distributions.ts, CHANGELOG.md,
canonical skill versions and maintained plugin manifests when a release bump is
required; tests/tooling/generated-output-sync.test.ts for new distribution
invariants. Generated outputs/inventory are produced only by owning commands.
Backlog lifecycle files are modified only if the acceptance criteria are met.

**Implement:** Document N>=3 messaging alone, cross-repository paths, exact self
identity, explicit takeover, receipts versus actions, bounded start/stop/manual/
Monitor behavior, interrupted attempts and recovery, shared log authority,
expiry/capacity/retention, and per-host evidence. Explain why messages can wait
without automatic attention; never promise exactly-once actions. Reconcile
standalone Session messaging and existing Consensus observer-collab distribution
references. Record clean breaks and actual versions in Unreleased.

**Verify:**

- pnpm run build; inspect generated diffs, then pnpm run build:check
- pnpm run test; pnpm run type-check; pnpm run validate; pnpm run smoke
- pnpm run validate:skill-versions -- --base-ref d74abe671561053154d3012e1b8edd11fc079dcf
  (verified merge base of this branch and origin/main at planning time; before
  source edits, the implementation root verifies ancestry and records any
  deliberate replacement after a rebase rather than silently changing the base).
- pnpm --dir documentation build; verify local maps/links/sidebar and inspect
  any affected diagrams at desktop/mobile in both themes per documentation rules.
- Scoped oxlint/oxfmt checks on changed authored paths, no generated formatting.
- Review the live matrix: unverified rows remain unverified/manual; do not run the
  unrelated paid Consensus live gate. Run only explicitly authorized messaging
  acceptance probes.
- If all messaging backlog acceptance criteria are met, follow PJM adoption
  preflight and close/archive BL-260619-inter-agent-direct-messaging in the same
  shipping change, regenerate its managed index, and update completion history.
  Otherwise leave it open and report the unmet criterion rather than closing it.
- After task commit, the implementation root runs pnpm run worktree:validate on
  the clean visible worktree and performs final Frontier gate review. PR/push/
  merge remain separate actions.

**Format:** pnpm exec oxfmt --write documentation/docs/user-guide/skills/agent-messaging.md documentation/docs/user-guide/skills/session-observer-collab.md documentation/docs/user-guide/skills/index.md documentation/docs/user-guide/skills/meta.json documentation/docs/user-guide/plugins/session/index.md documentation/docs/engineering/architecture/agent-messaging.md documentation/docs/engineering/architecture/index.md documentation/docs/engineering/architecture/meta.json plugins/session/README.md plugins/consensus/README.md RELEASING.md src/distributions.ts CHANGELOG.md tests/tooling/generated-output-sync.test.ts
Also format changed canonical version files and maintained manifests; never the
generated inventory. Format any PJM prose through the documented Markdown
formatter's stdin mode, then apply its result without touching managed blocks.

**Commit:** docs(p03-t03): document and verify agent messaging delivery

## Reviews

| Scope  | Type     | Status  | Date       | Artifact | Reviewed Head | Invocation | Gate Target |
| ------ | -------- | ------- | ---------- | -------- | ------------- | ---------- | ----------- |
| p01    | code     | pending | -          | -        | -             | -          | -           |
| p02    | code     | pending | -          | -        | -             | -          | -           |
| final  | code     | pending | -          | -        | -             | -          | -           |
| spec   | artifact | pending | -          | -        | -             | -          | -           |
| design | artifact | pending | -          | -        | -             | -          | -           |
| p03    | code     | pending | -          | -        | -             | -          | -           |
| plan   | artifact | passed  | 2026-09-19 | -        | -             | auto       | -           |

The original scaffold rows are preserved. Spec is not applicable in quick
mode. Fable's design collaboration review passed e95a0d91, followed by explicit
user approval; it is documented in design.md and is not fabricated as an OAT
review artifact. Plan artifact auto-review passed after one local correction:
the version-validation command now names the verified base instead of a shell
placeholder. Structured review returned no residual findings; no review artifact
was written for this inline pass. The configured independent gate remains pending.

Dispatch: selection_reason=inherit; route=planning-parent-inline;
parent=gpt-6-astra/high (launcher turn_context); reviewer-threshold=gpt-5.6-sol/high
(High project resolver, complete ladder); scope=artifact:plan;
output=structured; child-launch=none. Inherited self-review does not replace
independent Frontier gate review. Additional phase gates were explicitly declined.

## Implementation Complete

**Planned, not implemented:**

- Phase 1: 5 tasks — independent storage, membership, messages, logs and CLI.
- Phase 2: 4 tasks — finite activation, host adapters, watch and acceptance probes.
- Phase 3: 3 tasks — shared observer logs, one continuation owner and final checks.

**Total: 12 tasks. Completed: 0/12. First task: p01-t01.**
Planning approval is not implementation, live acceptance, release or merge.

## References

- [Approved design](design.md)
- [Discovery and constraints](discovery.md)
- [Project state and dispatch policy](state.md)
- [Implementation tracking](implementation.md)
- [Messaging backlog item](../../../repo/pjm/backlog/items/BL-260619-inter-agent-direct-messaging.md)
- [Separate observation state](../../../repo/reference/decisions/DR-260724-separate-observation.md)
- [Exact stateful identity](../../../repo/reference/decisions/DR-260724-stateful-work-requires-exact.md)
