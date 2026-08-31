---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-08-31
oat_generated: false
---

# Discovery: coding-session-handoff

## Initial Request

Create one public standalone Agent Skill named `coding-session-handoff` that helps a user hand off explicitly selected Codex and Claude Code sessions from a source Git worktree into an existing target worktree. The source worktree is the default discovery boundary. Reuse the repository's read-only transcript discovery and sanitization substrate, delegate any session mutation to provider-native operations, and remain truthful when an active turn requires a post-turn handoff instead of immediate execution.

The kickoff requirements are authoritative. Cursor is experimental and outside the v1 support floor. Local commits are authorized; push, PR creation, publishing, release, and GitHub mutation are not.

## Clarifying Questions

### Question 1: Default continuity model

**Q:** Should v1 move one native identity or create a successor?
**A:** Create a provider-native successor by default. Same-ID resume is advanced and requires conservative proof that the source writer is closed.
**Decision:** Preserve the source session, expose lineage, and fail closed for ambiguous same-ID writers.

### Question 2: Target ownership

**Q:** May v1 create, move, or synchronize the target worktree?
**A:** No. The target must already exist and match the intended source repository.
**Decision:** Report safe Git evidence, but do not create worktrees or transfer branches, commits, or uncommitted changes.

### Question 3: Mutation timing

**Q:** Should native operations always run immediately after approval?
**A:** Only when the provider and host can do so honestly and safely. Otherwise return a precise post-turn plan.
**Decision:** A confirmed deferred operation is not a successful native operation; native and reporting outcomes remain separate.

### Question 4: Persistence

**Q:** Should v1 keep a durable lineage or retry registry?
**A:** No. Default persistence is none.
**Decision:** Return compact provider-qualified mappings and recoverable itemized outcomes without storing transcript bodies, credentials, or a new state machine.

### Question 5: Provider floor

**Q:** Which providers are supported in v1?
**A:** Codex and Claude Code. Cursor remains experimental until its fork and cross-workspace behavior are proven safe.
**Decision:** Do not claim Cursor support merely because transcript discovery exists.

## Solution Space

### Approach 1: Ephemeral native-command handoff skill _(Recommended)_

**Description:** Discover exact-worktree candidates through the existing read-only transcript substrate, require explicit selection and confirmation, validate the target repository, then plan or invoke provider-native continuity operations with itemized outcomes.
**When this is the right choice:** Same-machine handoff where provider stores remain authoritative and users need a safe cross-provider UX now.
**Tradeoffs:** Successor identifiers and target-cwd semantics sometimes require post-operation observation; there is no automatic cross-host history.

### Approach 2: Durable cross-provider registry

**Description:** Persist logical efforts, worktree aliases, session lineage, location events, retries, and reconciliation.
**When this is the right choice:** Multiple ADEs or non-agent clients need automatic continuity, crash recovery, or cross-host reconciliation.
**Tradeoffs:** Introduces a new identity model, concurrency rules, privacy surface, and long-lived ownership beyond the v1 need.

### Approach 3: Provider-store rebinding

**Description:** Rewrite provider session databases, transcript paths, or recorded cwd metadata so existing sessions appear native to the target.
**When this is the right choice:** Only when a provider publishes a supported, versioned migration API.
**Tradeoffs:** Current stores are private implementation details; direct rewriting risks corruption and breaks the immutable-store boundary.

### Chosen Direction

**Approach:** Ephemeral native-command handoff skill.
**Rationale:** It satisfies same-machine continuity while preserving provider ownership, transcript privacy, and reversible source sessions. It matches the repository's skill-first, read-only transcript architecture.
**User validated:** Yes — the kickoff explicitly makes these requirements authoritative and requests implementation rather than more brainstorming.

## Options Considered

### Option A: Exact selection versus recency selection

**Description:** Require one, several, or all provider-qualified candidates from the exact source-worktree set. Never infer a mutating selection from recency.

**Pros:**

- Keeps every selected mutation attributable to an explicit user choice.
- Supports several Codex and Claude sessions without hiding non-current work.

**Cons:**

- Adds a deliberate disambiguation step when metadata is sparse.

**Chosen:** A

**Summary:** Explicit selection is mandatory. Related-worktree and global candidates remain diagnostic until the user deliberately widens scope.

### Option B: Immediate execution versus truthful deferral

**Description:** Perform only native operations that the current host can launch and observe safely; otherwise emit exact post-turn operations.

**Pros:**

- Avoids pretending an active TUI moved in place.
- Keeps partial outcomes and retries honest.

**Cons:**

- Some confirmed handoffs require a second operator step.

**Chosen:** B

**Summary:** Safety and observability take precedence over a false one-click experience.

## Key Decisions

1. **Public concept:** Ship one cross-provider skill named `coding-session-handoff`; keep provider differences behind the common UX.
2. **Discovery boundary:** Enumerate all and only exact-source-worktree Codex and Claude candidates by default, deduplicated by provider-qualified native identity.
3. **Current identity:** Mark a session `current` only from direct identity evidence; never hide other candidates or promote recency into identity.
4. **Read-only inspection:** Enumeration, preview, comparison, and plan mode must not advance observer offsets, persist transcript content, or write transcript-discovery caches such as `codex-cwd-cache.json`. Design must reuse or introduce a mutation-free discovery seam instead of calling a cache-writing entry point.
5. **Git safety:** Require an existing target for the same intended repository, report branch/commit/dirty evidence, and fail closed on a distinct dirty source in v1.
6. **Continuity semantics:** Default to `successor`; make `resume` advanced and refuse unknown or concurrent source writers; keep `plan` read-only.
7. **Mutation boundary:** Show the complete batch and obtain explicit confirmation before any provider operation. CLI help authorizes only the exact syntax it reports; native cross-directory execution remains unavailable until a disposable two-worktree behavioral gate proves its semantics. Never add approval, sandbox, or hook-trust bypass flags.
8. **Outcome model:** Keep native-operation and reporting outcomes separate; mixed batches are itemized and only failed or deferred items may be retried.
9. **Persistence:** Retain no transcript bodies, credentials, or durable lineage registry by default.

## Constraints

- Shipped runtime code is dependency-free and requires Node.js 22+.
- Canonical TypeScript and skill sources generate committed runtime outputs; provider mirrors are generated, not hand-edited.
- Provider session stores and transcript databases are immutable inputs.
- Enumeration, preview, comparison, and plan mode must leave both observer state and transcript-discovery caches unchanged, including when Codex cwd resolution starts from an empty cache.
- V1 does not create/move worktrees, transfer Git state, push/pull, or synchronize uncommitted changes.
- No Orc repository or adapter changes belong in this project.
- Installed evidence on 2026-08-31 is Codex CLI 0.151.0 and Claude Code 2.1.251; capability drift must fail closed.
- Neither installed CLI exposes a trustworthy active-writer preflight.
- CLI help/version probes establish command shape only. They do not prove target cwd persistence, child identity, source resumability, or metadata effects.

## Success Criteria

- Exact-worktree discovery lists several Codex and Claude candidates without recency auto-selection, related/global leakage, or provider-ID collisions.
- Users can preview or compare selected candidates through bounded sanitized conversation rounds without state mutation.
- Exact-worktree enumeration, preview, comparison, and plan mode leave a temporary empty observer-state directory unchanged, including no `codex-cwd-cache.json` creation.
- Single, multi, and all selection produce a complete target-validated batch preview and explicit confirmation boundary.
- Successor, resume, and plan semantics remain distinct; current/active-turn and one-writer limitations produce truthful deferral or refusal.
- Provider capability drift, dirty-source risk, ambiguous target identity, and unverified cross-directory semantics fail closed with actionable diagnostics.
- Disposable two-worktree verification records parent/child identity, runtime cwd, source resumability, and metadata effects for every executable Codex and Claude operation. Any operation whose behavior cannot be established remains `plan`/deferred and is labeled unverified.
- Mixed native outcomes produce a recoverable parent-to-child ledger without repeating successful operations.
- Plans and results contain no transcript bodies, hidden instructions, secrets, provider-store mutations, or dangerous bypass flags.
- Repository tests, generated-output checks, validation, smoke, docs, and cross-provider installation compatibility pass.

## Out of Scope

- Cursor mutation support in v1.
- Cross-host or cross-machine session payload synchronization.
- Worktree creation, movement, branch synchronization, dirty-diff transfer, or Git push/pull.
- Persistent lineage databases, daemons, hooks, journals, or automatic operation registries.
- Generic provider write abstractions or changes in `~/code/orc`.
- Rewriting provider session databases, JSONL transcripts, or recorded cwd metadata.

## Deferred Ideas

- **Cursor capability experiment:** Verify current explicit-ID fork and cross-workspace behavior before promoting support.
- **Durable lineage:** Add operation IDs or a local event ledger only when a non-agent consumer or crash-recovery requirement appears.
- **Cross-host continuity:** Design authenticated/encrypted export separately from same-machine discovery.

## Open Questions

- **Writer evidence:** Which provider- or host-native lifecycle evidence can ever prove a source writer closed, rather than merely looking idle?
- **Successor reconciliation:** Which native outputs can safely reveal the child identity immediately, and when must target-worktree rediscovery finish the mapping?
- **Safe labels:** Which provider metadata fields are safe and stable enough to display without reading conversation content?

## Assumptions

- Same-machine transcript stores and provider CLIs are locally available to the invoking user.
- The target path is accessible before handoff begins.
- Provider-qualified native IDs are the only durable session identities in v1.
- Transcript modification time is activity evidence, not proof of a live writer or permission to resume the same ID.

## Risks

- **Provider capability drift:** Help shape or semantics may change after upgrade.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Probe exact syntax, then require disposable two-worktree behavioral evidence before enabling execution; help output alone is insufficient.
- **Inspection side effects:** Reusing the existing Codex discovery entry point can populate `codex-cwd-cache.json` even when no provider store changes.
  - **Likelihood:** High
  - **Impact:** Medium
  - **Mitigation Ideas:** Introduce a read-only discovery seam and test from an empty temporary observer-state directory that remains byte-for-byte unchanged.
- **False writer inference:** Recent or quiet transcripts can be mistaken for open or closed sessions.
  - **Likelihood:** High
  - **Impact:** High
  - **Mitigation Ideas:** Separate activity hints from one-writer proof and refuse same-ID resume on unknown evidence.
- **Privacy leakage:** Candidate previews or reports could expose injected instructions, tools, secrets, or transcript paths.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Reuse structural filtering plus the shared hidden-payload sanitizer and retain only bounded conversation and safe metadata.
- **Partial batch ambiguity:** A native fork can succeed before child mapping or reporting completes.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Preserve per-item native/reporting states and never retry successful parents automatically.
- **Dirty Git divergence:** A target session can start without source-only uncommitted changes.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Fail closed on a distinct dirty source and state that Git transfer is outside scope.

## References

- Supporting evidence packet: `/Users/thomas.stang/Documents/Codex/2026-08-30/new-realtime-voice-chat-2/ade-session-portability-handoff.md`
- Installed provider help verified locally on 2026-08-31.
- Current transcript discovery, sanitization, generated-runtime, test, and documentation contracts verified directly in this checkout.

## Next Steps

Run independent artifact review, complete the discovery HiLL gate under the autonomy contract, then continue to specification and design.
