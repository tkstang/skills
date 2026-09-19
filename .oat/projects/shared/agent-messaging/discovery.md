---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-09-19
oat_generated: false
oat_template: false
---

# Discovery: agent-messaging

## Initial Request

Start a quick-mode project for provider-neutral, addressed communication between
coding-agent sessions. An engineer should be able to run three or more sessions
in one worktree or across participating worktrees and have them exchange focused
questions, blockers, review requests, and handoffs without manually relaying
messages or requiring access to one another's transcripts.

Source: [BL-260619-inter-agent-direct-messaging — Inter-agent direct messaging (addressable, prioritized)](../../../repo/pjm/backlog/items/BL-260619-inter-agent-direct-messaging.md).
The user refined this scope in the current conversation; it was committed as
5f0fce74. Planning baseline 6ef6b5f7 also includes generated OAT sync state.

## Clarifying Questions

### Observation versus messaging

**Q:** Must sessions observe each other's transcripts to communicate?
**A:** The user wants sessions to coordinate using messaging alone.
**Decision:** Observation is optional. Joining messaging must not start a
transcript watcher or require peer transcript access. When observation is
enabled, addressed messages are considered before ambient transcript catch-up.

### Participant count

**Q:** Should messaging inherit the existing two-session observer collaboration boundary?
**A:** "3 or more agents exchanging messages should be fine."
**Decision:** Three-or-more-agent messaging is a v1 requirement. Safe N>2
transcript observation remains separate work, not a prerequisite.

### Delivery boundaries and activation

**Q:** When should recipients check messages, and are checks always active?
**A:** The user requested start and stop checks; the conversation settled on
installed hooks that handle messages only during enabled collaboration.
**Decision:** Target every turn's start and attempted stop, including follow-up
or resumed turns. Enable per exact session/project with finite continuation
limits and expiry. Verify host support; session creation alone is not an
every-turn start boundary. Manual inbox checks are an explicit fallback when
automatic delivery is unavailable.

### Shared storage and logs

**Q:** Where should messages and the existing agent-written collaboration log live?
**A:** The user favored user-level storage over Git metadata and explicitly
requested that messages and collaboration logs live in the same place.
**Decision:** Reuse the persistent XDG collaboration root and its existing
override. The later refinement uses flat collaboration UUIDs, with worktrees
and repositories as metadata, and exposes resolved paths.
Keep recipient messages, acknowledgments, and the agent-written Markdown log
together. Native provider transcripts and metadata-only observer event logs
remain distinct.

## Solution Space

### Owned local inbox protocol — recommended

A small file-backed runtime supplies registration, aliases, addressed messages,
recipient acknowledgments, and inspectable collaboration records. Host adapters
deliver context at supported boundaries; optional observation composes with the
same lifecycle.

This fits the dependency-free Node runtime and local workflow. We own the
concurrency, recovery, and receipt semantics: a shared directory alone does not
guarantee safe append or exactly-once processing.

### Adopt or wrap Agent Mail

Agent Mail supplies relevant project/agent identity, messaging, inbox, and
acknowledgment semantics. Its Python implementation introduces dependencies and
an MCP server; the Rust implementation adds a separately installed binary and
Git/SQLite storage. Adopting either changes the current runtime/distribution
contract. Neither was installed or live-tested during discovery.

This is appropriate if a separately managed coordination service is selected.
The current scope does not select that expansion. Use Agent Mail as prior art
and record the owned-build recommendation and tradeoff in design.

### Harness-native messaging

Native facilities can be useful delivery adapters within supported hosts.
Requiring one harness's messaging transport would not meet the selected
provider-neutral contract. Mailbox operations must remain available through the
local runtime independently of those adapters.

### Chosen Direction

**Approach:** Persistent recipient inboxes with optional transcript observation
and separately verified host delivery adapters.
**User validated:** Yes for the product direction, participant count, start/stop
checks, and shared storage. Schemas, command names, persistence mechanics, and
adapter support claims remain design work.

## Key Decisions

1. Messaging is independent and supports three or more sessions in v1, including
   cross-worktree and cross-repository collaboration on one local machine.
2. Address exact runtime/session identities through readable aliases. Never
   silently redirect an alias to the newest session. Explicit logged takeover
   by a replacement session is supported, preserving pending messages.
3. Each recipient owns consumption and acknowledgment state. Enqueue/read/ack
   does not prove that the agent acted.
4. Check messages at supported turn-start and stop boundaries only for active
   participants. Share continuation budgets with optional observation. Optional
   finite Claude Monitor notifications may provide idle wake when proven;
   Cursor uses manual fallback until current per-boundary probes pass.
5. Reuse the existing collaboration root: $XDG_STATE_HOME/session-observer/collab/,
   default ~/.local/state/session-observer/collab/, with the existing
   SESSION_OBSERVER_STATE_DIR override. Use flat collaboration UUID directories;
   worktrees/repositories are membership metadata, not routing restrictions.
6. Standardize the shared agent-written Markdown log in the same directory and
   update the existing collaboration skill and user guide.
7. Closeout/expiry disables delivery. History deletion requires explicit cleanup
   or a defined retention policy; do not silently move/delete historical logs.
8. Peer messages are not user authorization and do not grant permission to edit
   shared source files concurrently.
9. Store immutable files per message, superseding the original JSONL inbox
   direction. Ship a dedicated messaging skill and deliver one project in phases.
10. First enablement explains scope, permissions, trust, limits, and fallback.
    Approved expiry is a two-hour human-only idle renewal window, a 24-hour hard
    cap, visible expiry notice, and a continuation budget reset only by explicit
    re-enable. Use disclosed fixed expiry where human provenance is unproven.

These refinements were read and raw-record verified from the user's messages
in Fable's pinned Claude session on 2026-09-18 (records 350, 408, and 472).
They guide design; they do not authorize privileged installation in this session.

## Constraints

- Node >=22; dependency-free shipped runtime with no required install step.
- No required daemon, MCP server, network transport, or managed database.
  A finite session-owned Monitor is optional, not an always-on service.
- Preserve observer offsets and private continuation state. Messaging must not
  consume another recipient's acknowledgments or observation state.
- Preserve provider-native transcripts in their existing stores.
- Canonical skill edits require version bumps, regenerated distributions,
  changelog entries, documentation, and applicable repository checks.
- No paid calls, live hook installation/trust changes, or global installation
  were performed here. Live acceptance needs an explicitly scoped run.
- A separate implementation worktree must be a visible Codex task on this
  machine; this checkout currently owns planning.

## Success Criteria

- Three or more registered sessions exchange addressed messages with observation
  disabled, including concurrent senders targeting the same recipient.
- Acknowledgments remain per-recipient. Repeated delivery is identifiable and
  retry behavior cannot silently corrupt or discard queued messages.
- Supported start/stop integration checks only active participants and respects
  finite budgets; unsupported boundaries and manual fallback are clearly stated.
- Messages survive application restart and remain available for the next check.
  Queued messages are not represented as an always-on wake guarantee.
- Participants resolve the same storage and Markdown log across worktrees.
  Concurrent log publication preserves complete append-only entries.
- Optional observation uses separate state and considers messages before catch-up.
- Status makes participant identity, pending/acknowledged messages, delivery
  capability, and resolved storage paths inspectable.
- Malformed/replayed messages, partial writes, crashes, identity ambiguity,
  expiry, and cleanup have defined outcomes and focused verification.

## Current Evidence

### Reusable storage and policy

The canonical session-observer-collab skill requires a shared append-only
Markdown log but supplies no deterministic path (SKILL.md, lines 228–252).
Co-location is new product work.

The existing lease-state.mjs resolves the XDG/override root and provides
session-owned leases, locking, atomic JSON replacement, expiry, and compare-and-swap
patterns. Those patterns are reusable; they do not establish safe concurrent
JSONL append.

DR-260724-separate-observation requires public observation and private
continuation state to remain distinct. DR-260724-stateful-work-requires-exact
rules out recency/cwd-only ownership. Messaging-only identity must avoid requiring
peer transcript access.

The June vault proposal's targeted-signal rationale remains relevant. Its
daemon/shared-log dependency and .consensus placement are superseded by the
current user's direction.

### Host adapter inventory

This is repository-source and historical evidence, not a fresh probe of installed hosts.

Current official documentation independently describes prompt-start context and
Stop continuation for [Codex](https://developers.openai.com/codex/hooks) and
[Claude Code](https://code.claude.com/docs/en/hooks), plus distinct validation,
session-start context, and Stop surfaces for [Cursor](https://cursor.com/docs/hooks).
Checked 2026-09-18: documented does not mean implemented, installed, or live-proven.
The table below inventories shipped/historical evidence, not the entire current
capability of those products. Design includes probes before promoting support.

| Host        | Existing evidence                                                                                                                                                          | Discovery implication                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex       | Shipped registration and adapter handle Stop only. The adapter returns decision:block with a bounded wake envelope. Recorded targeted live validation is dated 2026-07-12. | Reuse only after adapting the message contract. No shipped every-turn start adapter was found; installed/trusted/invoked/live-wake facts require separate verification. |
| Claude Code | Runtime guidance uses callable Monitor notifications. A 2026-09-16 session recorded repeated event delivery and expiry/re-arm; restart was not exercised.                  | A Monitor event is not a demonstrated start/stop hook. No bundled Claude start/stop adapter is established; verify host boundaries or disclose manual fallback.         |
| Cursor      | Testable Stop module exists, but the July 24 recorded top-level and managed callback probes produced no effective callback/follow-up.                                      | Module presence does not establish usable integration. Buffered-manual remains the recorded fallback; new evidence is needed to claim automatic delivery.               |

Evidence paths:

- src/skills/session-observer-collab/src/codex-lifecycle.mjs:174–215
- src/skills/session-observer-collab/src/hooks/codex-stop.mjs:104–123
- src/skills/session-observer-collab/references/runtime-codex.md:9–18,131–162,245–264
- src/skills/session-observer-collab/references/runtime-claude-code.md:7–22,179–200
- src/skills/session-observer-collab/references/runtime-cursor.md:402–410,587–606
- src/skills/session-observer-collab/SKILL.md:39–84

Existing observation's two-peer topology must not be imported into messaging
registration or recipient state. No messaging turn-boundary integration has
been live-validated by this discovery.

## Out of Scope

- Safe N>2 transcript observer meshes, merged activity views, and session fidelity.
- Cross-machine transport, guaranteed always-on idle wake, or a new background
  service. Optional bounded session-owned notification is now in scope.
- Broadcast groups, task orchestration, file-reservation enforcement, and web UIs.
- Automatic migration/deletion of historical logs or provider transcripts.
- Implicit new authority or automatic simultaneous edits to shared source files.

## Assumptions

- Initial coordination uses one local user's filesystem; filesystem identity is
  not cryptographic authentication against other processes with that user's access.
- Participating sessions can execute the shipped Node CLI or invoke an adapter.
- Manual inbox use remains valuable when automatic context injection is unsupported.

## Questions Addressed by the Design Draft

1. Stable project/collaboration identity across worktrees; alias collisions,
   session replacement/resume, membership, and participant expiry.
2. Message/receipt schema, priorities, reply references, limits, ordering, and
   the exact distinctions between enqueue, presentation, acknowledgment, and action.
3. Concurrency and recovery for immutable message files and log entries, including
   interrupted publication, exclusive claims, idempotent retry, and deduplication.
4. Per-host start/stop integration and evidence requirements, duplicate hook
   events, manual fallback, interruption, and shared continuation budgets.
5. Public skill/CLI ownership, distribution units, and the minimum shared
   primitive extraction needed for messaging-only operation.
6. Closeout, retention, and inspectable cleanup that preserves active participants.

## Risks

- **Host variability:** Hook names/configuration do not prove context injection.
  Require per-boundary evidence and explicit support/fallback labels.
- **Lost or duplicate work:** Receipt and acknowledgment can be interrupted.
  Define replay semantics and do not promise exactly-once agent action.
- **Hidden coupling:** Existing leases carry peer transcript identity and N=2
  policies. Reuse primitives without requiring transcript observation.
- **Scope growth:** Concurrent messaging needs lifecycle tests. Keep observer
  meshes, orchestration, and cross-machine delivery outside the project.

## References

- [Backlog item](../../../repo/pjm/backlog/items/BL-260619-inter-agent-direct-messaging.md).
- [Separate observation and collaboration cursors](../../../repo/reference/decisions/DR-260724-separate-observation.md).
- [Exact identity for stateful work](../../../repo/reference/decisions/DR-260724-stateful-work-requires-exact.md).
- [Collaboration sibling layer](../../../repo/reference/decisions/DR-260713-collaboration-uses-a-sibling.md)
  provides context only; its Decision/Consequences sections are still TODO.
- Vault source read through Stoa on 2026-09-18:
  02 - Projects/Skills/Ideas/2026-06-19-inter-agent-messaging.md.
- [Agent Mail Python dependency contract](https://github.com/Dicklesworthstone/mcp_agent_mail/blob/ac4966c64d7e39692a4fb9c707448a1718ab29db/pyproject.toml)
  and [messaging model](https://github.com/Dicklesworthstone/mcp_agent_mail/tree/ac4966c64d7e39692a4fb9c707448a1718ab29db), inspected 2026-09-18.
- [Agent Mail Rust architecture and installation](https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/f341e840801e53c7772cc48c9e33d160d9e92cbf/README.md),
  inspected 2026-09-18. Neither implementation was executed.

## Next Steps

Discovery is validated complete. The complete lightweight design has been
drafted and revised after Fable's initial critique and the user's newer decisions.
Review that revision before generating an execution-ready plan. Draft-and-review
overrides the reusable selective preference for this run only; quick mode remains.
