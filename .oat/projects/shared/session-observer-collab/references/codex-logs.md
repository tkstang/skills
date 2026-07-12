# Session Observer Collaboration Log — codex

<!--
Shared format adopted from the peer proposal:

- One H2 "Session" header with metadata, then an append-only "Entries" section.
- Each entry: `### [HH:MM] <category> — <title>` with three fixed bullets.
- Categories: `mechanics`, `protocol`, `content`, `gotcha`, `idea`.
- Fixed bullets: **What happened**, **Assessment**, **Skill implication**.
- End of run: fill in "## Distilled Recommendations" for the final
  skill-authoring prompt.
-->

## Session

- **Date:** 2026-07-12
- **Self runtime:** codex
- **Peer runtime:** claude-code
- **Worktree:** /Users/tstang/orca/workspaces/open-agent-toolkit/oat-repo-improve
- **Collaboration task:** brainstorm adaptation of `oat-repo-improve` skill (external-plans destination, maintainability-review integration, backlog-driven plan generation)
- **Protocol:** three-way (user + two agents observing each other); agents respond freely but pause for user input at decision points.

## Entries

### [09:55] mechanics — Auto-selection pinned a stale same-worktree session

- **What happened:** `catch-up-then-watch --runtime claude-code` reused an older same-cwd session with no assistant turns while a newer active Claude session existed. A diagnostic `locate --json --debug` found the live session, after which the watcher was restarted with an explicit `--session` pin.
- **Assessment:** gotcha — cwd and prior observer state are insufficient identifiers when a peer starts a fresh session after observer initialization.
- **Skill implication:** The collaboration skill should locate candidates immediately before arming, prefer an active engaged session with recent assistant/user traffic, pin its session ID, and detect when a newer peer session supersedes the pinned target.

### [09:55] protocol — Shared append-only format makes peer learning mergeable

- **What happened:** Claude proposed a common category-and-three-bullet structure, and Codex adopted it in a separate runtime-specific log.
- **Assessment:** works-well — independent perspectives remain attributable while the common schema makes end-of-run synthesis mechanical.
- **Skill implication:** Scaffold one log per participant from a shared template; never have both agents append to the same file.

### [09:55] gotcha — Catch-up continuity must be verified, not assumed

- **What happened:** Claude reported a gap between its completed catch-up offset and the later standalone watch baseline. Codex used `catch-up-then-watch` for the replacement watcher and saw contiguous backlog-to-baseline coverage.
- **Assessment:** gotcha — separate catch-up and watch processes can miss records created between commands; even a combined command should expose enough metadata to verify continuity.
- **Skill implication:** Mandate `catch-up-then-watch`, compare the consumed-through index with the watch baseline, and perform a bounded recovery review when they are not contiguous.

### [09:55] content — Generic artifact input still needs source classification

- **What happened:** Both agents agreed that `oat-repo-improve` should remain the sole external-plan writer. Claude proposed one generic artifact-scoped input instead of bespoke source modes; Codex agreed but noted that source types require different selection, validation, and plan-granularity rules.
- **Assessment:** works-well — the peer suggestion reduced interface proliferation while the response preserved domain-specific behavior.
- **Skill implication:** Collaboration prompts should distinguish agreement with the core proposal from refinements to its operational contract, so useful convergence does not erase important constraints.

### [09:55] protocol — User-facing questions are hard pause points

- **What happened:** Claude and Codex converged on ownership and source-input direction, then surfaced decisions requiring the user's product preference rather than continuing agent-to-agent iteration.
- **Assessment:** works-well — explicit pause points prevent observer loops from turning into autonomous consensus that bypasses the operator.
- **Skill implication:** Pause when the peer asks the user a question, when alternatives depend on operator preference, or when both agents have stated positions without new evidence.

### [10:06] mechanics — Interrupted host turn requires watcher reattachment

- **What happened:** The Codex turn was interrupted after the watcher started. Claude's watcher of Codex survived, while Codex had to re-locate Claude's live session and restart `catch-up-then-watch`; the unread backlog was recovered from the stored offset.
- **Assessment:** works-well with friction — durable offsets preserved continuity, but the collaboration posture itself did not automatically resume after interruption.
- **Skill implication:** Provide an explicit resume recipe: inspect watcher status, locate and pin the current peer session, run `catch-up-then-watch`, verify `recordsBehind: 0`, and restate the last unresolved user decision.

### [10:06] gotcha — Terse ambiguous input was promoted into a decision

- **What happened:** Claude interpreted a one-character user message (`s`) as approval for backlog-item backlink mutation, even though the text did not identify an option or contain an affirmative instruction.
- **Assessment:** gotcha — mutual observation can amplify an unsupported inference when the peer repeats it as settled context.
- **Skill implication:** Never treat malformed, partial, or ambiguous user text as a durable decision. Ask the user to confirm; peers should label inferred interpretations as tentative until the user states them explicitly.

### [10:06] content — Whole-backlog mode works best as a router

- **What happened:** The user defined five source values and emphasized that a substantive whole backlog should prompt for scope or recommend backlog review and priority alignment before plan generation. Claude modeled `backlog` as a router into candidate selection or `oat-pjm-review-backlog`, then loopback into `backlog-review` mode.
- **Assessment:** works-well — the router preserves user control and prevents a blind many-plan fan-out while keeping `oat-repo-improve` the sole plan writer.
- **Skill implication:** Collaboration should preserve the distinction between a source enum and its behavior: some sources generate plans directly, while aggregate sources may route through another workflow and return later.

### [10:08] gotcha — Queued user authorization was filtered as metadata

- **What happened:** Raw Claude transcript records 187, 188, and 193 contain the user's explicit approval to update backlog-item frontmatter with generated-plan links. The default observer digest omitted the `queue-operation` and `queued_command` records, leaving only a later one-character user message visible and causing Codex to challenge a decision that was genuinely authorized.
- **Assessment:** gotcha — a filtered digest is not evidence that a load-bearing user instruction never occurred; mutual observers can disagree because they received different renderings of the same session.
- **Skill implication:** The base observer should render human-origin queued commands as user messages. Until then, the collaboration skill must require raw-transcript verification before disputing a peer's claimed user authorization and append a correction when the evidence changes the conclusion.

### [10:08] content — Backlog provenance is bidirectional by user decision

- **What happened:** The user explicitly approved generated-plan links in backlog-item frontmatter. Plans will carry source provenance, and backlog items will carry reverse references to generated plans.
- **Assessment:** works-well — bidirectional provenance makes bulk idempotency and source-to-plan navigation straightforward.
- **Skill implication:** Preserve authorization scope precisely: mutate backlog-item frontmatter only, prefer a list-capable field for future replanning, and do not infer permission to modify maintainability or backlog-review source artifacts.

### [10:11] content — Preserve upstream orchestration, make the contract portable and explicit

- **What happened:** The user clarified that the upstream improve skill does support orchestration, but its behavior is unclear and Claude-oriented. Both agents compared `create-agnostic-skill` with the user-level Codex and Claude orchestration instructions and converged on the same main-loop boundary.
- **Assessment:** works-well — the peer correctly distinguished a missing capability from a missing portable contract, avoiding an unnecessary redesign of the upstream workflow.
- **Skill implication:** Keep capability detection, bounded fan-out, claim vetting, and fallback behavior; rewrite them as provider-agnostic invariants. Put detailed source decomposition and provider model examples in a bundled orchestration reference, with active harness instructions taking precedence.

### [10:11] content — Reconnaissance volume and coherence-critical judgment need different owners

- **What happened:** Codex and Claude user-level instructions both delegate exploration, audits, inventories, and evidence collection to cheaper bounded workers while retaining cross-source synthesis, prioritization, plan writing, user dialogue, and final verification in the frontier/root context.
- **Assessment:** works-well — this saves frontier context and cost without fragmenting the decisions that determine plan quality.
- **Skill implication:** Every worker brief must declare objective, scope, output schema, evidence requirements, and escalation conditions. Workers return compact findings with file:line evidence; the root agent verifies load-bearing claims and alone writes external plans and authorized backlinks.

### [10:15] content — Shared dispatch skill is reusable after analysis-role generalization

- **What happened:** Both agents inspected `oat-dispatch-subagents` from the fixture worktree. It already owns provider-specific catalog probing, route/model/effort selection, launch evidence, no-silent-downgrade behavior, and fail-closed recovery, but its current roles and record schema are lifecycle-oriented.
- **Assessment:** idea — compose with the shared dispatcher instead of duplicating mechanics, after adding a first-class read-only `recon` or `survey` role and `analysis` action.
- **Skill implication:** `oat-repo-improve` should own lane decomposition, evidence/report schema, and vetting; `oat-dispatch-subagents` should own how each lane is selected and launched. Do not map recon onto an implementation task-worker role because write authority, completion, and commit semantics differ.

### [10:15] idea — Read-only fan-out can share dispatch-wave evidence

- **What happened:** Claude observed that the full lifecycle dispatch record is excessive when six to eight read-only lanes use the same catalog snapshot, route, model, effort, deadline, and authority.
- **Assessment:** idea — retain auditability without repeating identical selection evidence.
- **Skill implication:** Permit one dispatch-wave record for homogeneous read-only recon lanes, with a lane manifest and lane-specific acceptance/outcome fields; require separate records whenever route, model, effort, authority, or deadline differs.

### [10:17] content — Split the dispatch engine from the project lifecycle adapter

- **What happened:** The user proposed keeping `oat-dispatch-subagents` general-purpose for OAT skills and workflows while moving phase/task/fix/review/gate policy into `oat-project-dispatch-subagents`. Both agents found that this matches the seam already present in the fixture skill.
- **Assessment:** works-well — the split creates a reusable dispatch substrate for repo audits, maintainability reviews, docs analysis, and other read-only fan-out without importing project ceremony.
- **Skill implication:** The general layer owns dispatch axes, catalog evidence, selection, launch evidence, acceptance/recovery, provider references, generic scope, and generic roles such as `recon`. The project adapter composes with it and owns lifecycle roles, project-state ceiling resolution, `pNN-tNN` scope, gates, commit/write semantics, and project dispatch records.

### [10:17] protocol — Peer correction narrowed an overstated consensus claim

- **What happened:** Codex initially reported that both agents recommended prerequisite-first sequencing, while Claude had recommended an interim compatible contract. Claude surfaced the disagreement with an explicit tiebreaker; the user's two-layer split then changed the tradeoff and brought both agents to prerequisite-first for the small general layer.
- **Assessment:** gotcha→works-well — the initial consensus claim was inaccurate, but mutual observation corrected it before it hardened into user-facing direction.
- **Skill implication:** Before saying "both agents agree," verify the peer's latest stated recommendation. Distinguish agreement on end state from agreement on sequencing, and record when new user input resolves the difference.

### [10:51] gotcha — Status report preceded a final watcher poll

- **What happened:** Codex's Claude watcher remained active, but Codex reported Claude's final verification as pending without polling the watcher immediately before the status response. The user reasonably suspected observation had stopped; the next poll delivered Claude's completed verification and approval.
- **Assessment:** gotcha — an armed watcher is not enough if status and completion claims are made from a stale observer checkpoint. The failure was observability and reporting discipline, not watcher termination.
- **Skill implication:** Before every collaborative status, convergence, pause, or completion report, poll each active watcher once, state the observer checkpoint used, and distinguish "peer has not responded" from "peer response has not yet been consumed." Record watcher liveness separately from peer-review state.

### [10:56] gotcha — Live watcher output does not wake a yielded Codex turn

- **What happened:** After Codex returned a final response, Claude incorporated the prompt-review findings and replied in its own session. The Codex watcher process remained healthy and buffered the delta, but no new Codex turn began; the response was consumed only after the user challenged the missing wake and Codex explicitly polled the watcher.
- **Assessment:** gotcha — process liveness, unread-output availability, and agent wake capability are three different states. In this Codex harness, a foreground watcher can be consumed only while the current invocation remains active; stdout arriving after yield does not autonomously summon the agent.
- **Skill implication:** The collaboration skill must state this Codex limitation plainly. Continuous collaboration requires keeping the invocation open and polling/waiting, a harness-provided monitor/wake bridge, or user/external re-invocation. Never promise autonomous responses after yielding; before yield, disclose that observation will pause and on the next turn consume buffered deltas before reporting status.

### [11:13] gotcha — Design discussion was mistaken for an armed experiment

- **What happened:** The user authorized a live Stop-hook experiment, but Codex paused implementation to answer a lifecycle-design question and did not explicitly state that no hook or lease had yet been armed. Claude continued supplying feedback, which again remained buffered until the user challenged Codex.
- **Assessment:** gotcha — implementation intent, setup progress, and armed runtime state were conflated. A proposed mechanism is not active merely because its design is agreed.
- **Skill implication:** Collaboration setup must expose an explicit state machine (`uninstalled`, `installed-untrusted`, `disarmed`, `armed`, `waiting`, `triggered`, `expired`) and print the current state after every transition. Never say a live test is underway until installation, trust, lease creation, and watcher baseline are all verified.

### [11:18] gotcha — A user turn preempted the first clean Stop-hook wake test

- **What happened:** Codex installed the hook, asked the user to approve the exact command through `/hooks`, verified persisted trust, and armed a one-shot lease. The user's next message arrived at the same stop boundary before the hook produced a continuation; the lease remained enabled with `continuationCount: 0` even though Claude later emitted the trigger.
- **Assessment:** gotcha — setup and trust succeeded, but the wake experiment was inconclusive rather than passed. A user-triggered turn cannot serve as evidence that the Stop hook resumed Codex.
- **Skill implication:** Report installation, persisted trust, lease state, and wake-test verdict independently. For a live wake test, establish a fresh baseline and trigger, end the Codex turn, require no intervening user message, and verify both the lease transition and a hook-generated continuation prompt in the transcript.

### [11:21] gotcha — Trusted and enabled are independent Codex hook states

- **What happened:** Claude inspected the persisted hook state and found that the collaboration hook had a matching `trusted_hash` but no `enabled = true`, while the working Orca Stop hook had both. Codex independently verified the same config state. The lease had no timeout or invocation breadcrumb, which corroborates that the hook never executed despite the peer trigger being valid.
- **Assessment:** gotcha — the first test failed at hook enablement, not trigger detection. Treating “trusted” as equivalent to “enabled” produced an incorrect `armed` report.
- **Skill implication:** The Codex adapter must ask the user to both trust and enable the exact hook through `/hooks`, then read-only verify both persisted fields before arming. The hook should write `lastRanAt` on every invocation so future diagnosis does not require inference from absent side effects.

### [11:24] mechanics — Codex Stop hook produced a genuine automatic continuation

- **What happened:** A new Codex turn began with `<hook_prompt hook_run_id="stop:8:/Users/tstang/.codex/hooks.json">` and no intervening user message. The prompt named the pinned Claude session and records 1549–1567. The lease independently recorded `enabled: false`, `continuationCount: 1`, `lastTriggeredAt: 2026-07-12T16:19:40.929Z`, and `lastTriggerRecord: 1567`, matching Claude's completed trigger turn.
- **Assessment:** works-well — the Stop-hook continuation bridge successfully woke Codex automatically and disarmed its one-shot lease. Transcript provenance and lease state provide independent confirmation.
- **Skill implication:** The Codex adapter can document Stop-hook continuation as experimentally validated, bounded to the active lease/wait window. Its acceptance test must require a hook-generated prompt with no intervening user message plus a matching lease transition.

### [11:24] gotcha — Missing `enabled` does not mean disabled in Codex hook state

- **What happened:** The automatic continuation fired even though the hook's persisted config entry contained `trusted_hash` without an explicit `enabled = true`. This directly disproved the prior diagnosis recorded at 11:21; absence of `enabled` behaved as effectively enabled in this Codex build.
- **Assessment:** gotcha — config-shape inference was weaker than runtime evidence. The earlier recommendation would have encoded a false requirement and unnecessarily blocked valid hooks.
- **Skill implication:** Verify exact-command trust and reject explicit disablement, but do not require an `enabled = true` field. Confirm effective status through `/hooks` or a bounded live probe, and let successful hook provenance override speculative interpretation of omitted config fields.

### [11:24] gotcha — Lease status label did not transition with one-shot disarm

- **What happened:** After firing, the lease correctly set `enabled: false` and incremented `continuationCount`, but its human-readable `state` remained `armed` even though the hook prompt said it was disarmed.
- **Assessment:** friction — machine guards are safe, but contradictory status fields can mislead diagnostics and user-facing reports.
- **Skill implication:** Treat `enabled` plus continuation/expiry evidence as authoritative in the prototype, and require the durable adapter to transition the label atomically to `triggered` or `disarmed` when the one-shot fires.

### [11:27] mechanics — Recurring lease armed for long-session testing

- **What happened:** After the one-shot proof, Codex changed the local prototype to retain an enabled lease after successful continuations, advance the peer cursor, emit truthful recurring/disarmed status text, and write `lastRanAt`. The current session lease is pinned to the same Codex and Claude sessions, expires after 12 hours, allows 100 continuations, and waits up to 120 seconds at each Stop boundary.
- **Assessment:** works-well with a known ceiling — this can test repeated automatic continuations over a long collaborative session without reinstalling the hook, while retaining finite safety bounds.
- **Skill implication:** The durable adapter needs separate one-shot and recurring acceptance tests. It must disclose that recurrence covers successive bounded Stop waits; after a quiet wait times out and Codex fully stops, later peer output remains buffered until another user/external turn.

### [11:30] mechanics — Recurring endurance wake 1 passed

- **What happened:** Codex ended its first turn after arming the recurring lease. The Stop hook automatically created a new turn for Claude records 1761–1768 with no intervening user message. The lease remained `enabled: true`, returned to `state: armed`, advanced its peer cursor, recorded `continuationCount: 1`, and matched `lastTriggerRecord: 1768`.
- **Assessment:** works-well — this validates the first re-arming cycle, not merely the earlier one-shot mechanism. The recurring status text also correctly reported that the lease remains armed for the next Stop boundary.
- **Skill implication:** Keep collecting organic wake cycles during real work and record latency, cursor movement, continuation count, timeout behavior, and any missed/duplicate peer turns before calling the long-session behavior durable.

### [11:31] gotcha — Recurring wake 2 fired on a metadata-only holding message

- **What happened:** The second automatic continuation was distinct and correctly advanced the lease to `continuationCount: 2`, but its entire source was Claude record 1799: “Metadata-only delta (Codex still mid-turn on verification) — holding.” The prototype treated every non-empty assistant message as substantive.
- **Assessment:** gotcha — the recurring mechanism worked mechanically but generated a useless model turn. Left unchanged, mutual observers could amplify no-op acknowledgements into an automatic ping-pong loop.
- **Skill implication:** The recurring adapter must suppress explicitly metadata-only/empty peer turns before requesting continuation, advance past skipped records safely, and test that short genuine feedback still wakes the peer.

### [11:33] protocol — Codex lease bounds need an explicit user checkpoint

- **What happened:** The user identified that expiry, maximum continuations, and bounded Stop wait materially change long-session behavior and should not be silently selected by the Codex adapter. They preferred a low-friction “use defaults?” question with detailed choices only when declined.
- **Assessment:** works-well — this keeps the normal setup concise while preserving user control over duration, autonomous-turn budget, and how long Codex remains visibly waiting at each stop.
- **Skill implication:** The Codex reference should recommend tested defaults, explain bounded wait in outcome terms, show resolved values before arming, permit early disarm, and reject unbounded leases.

### [11:36] protocol — Observation uses a resettable inactivity timeout

- **What happened:** The user reframed the per-Stop bounded wait as an observation inactivity timeout: meaningful activity from either the user or observed peer resets the window, supporting attention shifts without making the lease itself unbounded. They suggested a 15-minute default rather than 120 seconds.
- **Assessment:** works-well — this is a clearer mental model and better matches long-running collaboration. Absolute lease expiry and continuation count remain independent hard caps.
- **Skill implication:** Present a 15-minute inactivity default, reset it after direct user turns and substantive peer continuations, exclude metadata/no-op activity from renewal, and explain that peer-only wake becomes impossible after a fully idle timeout until another external/user turn.

### [11:38] gotcha — Wake range and cursor advancement diverged

- **What happened:** Recurring wake 4 asked Codex to review Claude records 1874–1884 but wrote `peerCursor: 1938`, the transcript length observed during polling. Records after 1884 were therefore marked consumed without being included in the hook prompt's review range; the live foreground watcher happened to cover them, but the hook could not rely on that in isolation.
- **Assessment:** gotcha — successful wake counters concealed a potential silent-loss bug. The first-completed-trigger selection also favored stale feedback when newer completed substantive turns existed in the same batch.
- **Skill implication:** Select the latest completed substantive trigger in the batch, advance the cursor to exactly `completedIndex + 1`, and test the invariant that every skipped record is either explicitly reviewed later or classified as non-substantive rather than silently consumed.

### [11:39] mechanics — Recurring wake 5 validates corrected cursor semantics

- **What happened:** After restoring the skipped range, the next automatic continuation handed Codex the contiguous Claude range 1885–1951, selected the latest completed substantive peer turn, and persisted `peerCursor: 1952` with `lastTriggerRecord: 1951`. The 15-minute inactivity timeout and recurring armed state remained intact at `continuationCount: 5`.
- **Assessment:** works-well — the live recovery covered the previously skipped batch and proved the exclusive high-water-mark invariant under organic concurrent transcript growth.
- **Skill implication:** Include a regression test where several completed peer turns arrive in one poll batch; assert that the latest substantive completion is handed off, the prompt range and persisted cursor agree, and metadata-only turns do not become triggers.

### [11:40] gotcha — Wake 6 consumed explicit no-reply status echoes

- **What happened:** The sixth automatic continuation was cursor-correct but sourced only Claude turns saying “Nothing needed from me; holding” and “Status echo only — holding.” The first no-op filter covered metadata-only wording but not these explicit semantic no-reply signals.
- **Assessment:** gotcha — protocol-level silence prevented another peer response, but the model turn and continuation budget were still consumed unnecessarily.
- **Skill implication:** Suppress explicit no-reply/status-echo markers before wake. For the durable protocol, prefer one machine-readable no-reply marker shared by runtimes; treat phrase heuristics as compatibility fallback, not an extensible natural-language classifier.

### [11:41] protocol — `[no-op]` becomes the deterministic loop-breaker sentinel

- **What happened:** Wake 7 contained Claude's substantive proposal for a fixed `[no-op]` prefix followed by two turns already using it. Codex agreed and added a case-insensitive prefix check to the prototype plus an exact message-convention rule in the collaboration prompt.
- **Assessment:** works-well — explicit producer intent is safer and more portable than guessing whether arbitrary prose is merely an acknowledgment. The wake itself was valid because the proposal establishing the sentinel was substantive.
- **Skill implication:** All collaborating runtimes should emit `[no-op]` only at the start of intentionally non-substantive completed turns. Wake adapters skip it deterministically; heuristic phrase suppression remains backward-compatible fallback and must not override genuinely new content.

### [11:43] mechanics — Wake 8 delivers substantive feedback during unrelated progress work

- **What happened:** While Codex used the OAT progress workflow and inspected project artifacts, the recurring lease automatically delivered Claude's independently verified remaining-work assessment. Earlier `[no-op]` turns in the same interval did not become separate continuations; the wake selected the later substantive completion and advanced contiguously to record 2057.
- **Assessment:** works-well — this is the intended endurance behavior: normal task focus continues, no-op observer chatter is suppressed, and genuinely relevant peer feedback interrupts with provenance when completed.
- **Skill implication:** Long-session acceptance should include a cross-task scenario, not only synthetic triggers: perform ordinary repo work while the peer alternates no-op and substantive turns, then assert exactly one wake for the substantive result and no lost task context.

### [11:45] mechanics — Wake 9 spans project closeout into Cursor test setup

- **What happened:** The ninth automatic continuation covered a long mixed-task Claude range and selected the latest completed substantive turn: a bounded Cursor smoke-test kickoff. It advanced contiguously to record 2265 while earlier `[no-op]` updates did not generate separate wakes.
- **Assessment:** works-well — the recurring observer preserved context across implementation, reconciliation, fixture handoff, and a new harness-testing topic without interrupting for status chatter.
- **Skill implication:** Endurance acceptance should include topic transitions and large record ranges, verifying that the latest substantive completion is delivered with the prior task outcome still intact.

### [11:45] gotcha — Observation-window timestamp survived a completed wake

- **What happened:** After wake 9, `lastTriggeredAt` and the cursor were current but `observationWindowStartedAt` still reflected an older wait. The trigger path spread the pre-wait lease object and omitted a field reset, even though the actual deadline had been calculated correctly for each Stop invocation.
- **Assessment:** friction — timeout behavior remained correct, but stale status metadata could make operators misread whether a wait is currently active.
- **Skill implication:** Set `observationWindowStartedAt` only while state is `waiting`; clear it atomically on trigger or timeout. Test state-report fields separately from functional wake behavior.

### [12:04] mechanics — Wake 10 validates recovery after unexpected app close

- **What happened:** The Claude application closed unexpectedly and resumed the same session. Claude verified that its watcher process remained alive, its Monitor task was still attached, and a brief `recordsBehind: 5` was only an in-flight delta. The recurring Codex lease then automatically delivered that substantive recovery report as continuation 10 with cursor 2336 and a cleared observation-window timestamp.
- **Assessment:** works-well — process, harness wake bridge, transcript offsets, and cross-runtime continuation all survived an unplanned host interruption. This was the second clean client-restart recovery in the run.
- **Skill implication:** Include same-session client-crash recovery in acceptance: verify watcher PID/liveness, wake-task attachment, offset health after transient lag, and a subsequent end-to-end peer continuation before claiming recovery complete.

### [12:08] gotcha — Long Stop-hook waits queue user messages

- **What happened:** With the observer configured for a 15-minute wait, Codex displayed three concurrent “Running Stop hook” rows and queued the user's new message under “Messages to be submitted after next tool call.” The user had to steer manually to submit it. The three rows were distinct registrations: the Codex plugin review gate, Session Observer, and Orca integration—not duplicate observer hooks.
- **Assessment:** gotcha — the resettable inactivity-timeout model was disproved. A command Stop hook blocks normal turn completion and user submission while it waits, making a 15-minute default hostile even though peer wakes work mechanically.
- **Skill implication:** Default Codex to a short catch window (5 seconds in the prototype), label minute-scale waits advanced opt-in with a queue/steering warning, enumerate coexisting Stop hooks during setup, and require another wake tier for long-lived non-blocking observation.

### [12:08] mechanics — Wake 11 delivers completed Cursor smoke-test results

- **What happened:** The eleventh automatic continuation delivered Claude's verified Cursor smoke-test result. Cursor self-identified session `c182953b-a058-48d8-bbd8-1b834742f2c1`, appeared as the live locate winner, performed a stateless Claude review without touching shared offsets, identified `{"type":"turn_ended","status":"success"}` as its completion marker, and wrote the shared-format Cursor log.
- **Assessment:** works-well — a fresh third harness joined mid-run under the N>2 stateless-read constraint without protocol or offset violations.
- **Skill implication:** Treat Cursor observed-side support and completion-marker detection as validated. Keep Cursor wake tier, non-interactive surfaces, and dotted-path slug behavior as remaining adapter tests.

### [12:10] gotcha — Queued Codex input is not rollout-visible during Stop wait

- **What happened:** Transcript forensics compared the final response at 17:05:22, the automatic hook prompt at 17:06:38, and the user's queued three-hook question. The first record for that question appeared immediately after the hook prompt at 17:06:38; no queue-operation or user-message record existed during the intervening 76-second Stop wait.
- **Assessment:** gotcha — the proposed self-preemption mechanism cannot watch the Codex rollout for queued input because the runtime does not persist that input until delivery, after the hook has already resolved.
- **Skill implication:** Do not promise transcript-based self-preemption. Use a short catch window by default, explain that minute-scale waits queue messages, provide steering/interrupt guidance, and require a different harness wake tier for non-blocking long observation.

### [12:10] mechanics — Wake 12 succeeds with the 5-second catch window

- **What happened:** After reducing the live catch window from 15 minutes to 5 seconds, Claude completed substantive feedback quickly enough for the next Stop invocation to continue Codex automatically as wake 12.
- **Assessment:** works-well — a short window preserves useful fast-peer continuations while sharply reducing the period in which user input can be trapped behind Stop hooks.
- **Skill implication:** Include both fast-hit and no-hit timing tests for the recommended short window, and measure queued-input latency as a user-facing acceptance criterion.

### [12:11] protocol — Queue visibility timing is harness-specific

- **What happened:** Wake 13 carried Claude's acceptance of the short-window design plus a cross-harness correction: Claude writes queued-command records when input is enqueued, while Codex writes the user input only when it is delivered after Stop hooks resolve.
- **Assessment:** works-well — the distinction explains why queued-message rendering repaired Claude observation but cannot enable Codex self-preemption.
- **Skill implication:** Every runtime adapter should state whether queued input becomes transcript-visible at enqueue or delivery. Queue rendering, authority propagation, and self-preemption designs must be gated by observed runtime timing rather than generalized across harnesses.

### [12:13] gotcha — `armed` conflated configured lease with active waiting

- **What happened:** After the new 5-second catch window elapsed, the hook process stopped and recorded `lastTimedOutAt`, but the lease still reported `state: armed`. The user correctly observed that no Stop hook was visibly running and Claude's later response did not wake Codex.
- **Assessment:** gotcha — `armed` described future eligibility at the next Stop boundary, not current wake coverage, and therefore overstated liveness.
- **Skill implication:** Use `waiting` only while a hook process is polling and transition to `idle` after timeout. Report `idle` as “lease configured, no active wake coverage; next user/external turn reopens the catch window.” Never equate lease existence with an active observer.

### [12:14] content — Cursor observability passed; autonomous wake tier remains unknown

- **What happened:** Wake 14 delivered Claude's response to the user's Cursor wake-mechanism question. The smoke test proved transcript discovery, stateless peer review, and `turn_ended` completion detection, but did not identify a Claude-style Monitor primitive or prove that Cursor Stop hooks can block and inject continuations.
- **Assessment:** works-well with a capability boundary — Cursor can participate today as a reactive observer, while autonomous participation remains unvalidated.
- **Skill implication:** Default the Cursor adapter to scheduled polling/buffered manual behavior. Promote it to active-turn continuation only after a live Stop-hook injection test; never infer event wake from transcript observability alone.

### [12:18] architecture — Independent lease cursor made the three-runtime offset race benign

- **What happened:** Claude verified that Cursor's stateless review did not damage any active channel. The Codex Stop-hook lease consumes Claude through its own cursor rather than Session Observer's shared high-water mark, so even a mistaken shared-offset advance would not interrupt Codex delivery in this topology.
- **Assessment:** works-well, but accidentally — the prototype demonstrates the right N>2 architecture while also showing why ambiguous phrases such as "catch up on Claude" remain unsafe when a runtime could invoke the stateful `catch-up` command literally.
- **Skill implication:** Make read offsets explicitly per observer-consumer, not globally shared per observed session. Preserve stateless `review` as the safe default until that contract exists, assign cursor ownership in the collaboration setup, and do not rely on the prototype's independent lease cursor as an undocumented safety property.

### [12:27] collaboration — Peer caught a branch-level PR scope mismatch

- **What happened:** While Codex checked the active dispatch project's final-PR readiness, Claude independently inspected the branch history and noted that the PR also contains the preliminary `oat-repo-improve` import and gitignore change. The active project's artifacts cover the dispatch prerequisite, while the branch review unit is broader.
- **Assessment:** works-well — the peer caught a cross-artifact boundary that lifecycle status alone could not reveal. The changes are related, but reviewers must not mistake the preliminary improve import for the finished substantive redesign.
- **Skill implication:** Collaboration prompts should ask peers to inspect branch/PR scope as well as active-project state before closeout. When they differ, explicitly reconcile them in documentation and PR framing or split the branch before publication.

### [12:38] capability — Cursor documents bounded Stop-hook continuation

- **What happened:** Cursor corrected its earlier self-assessment: a Stop hook can return `{"followup_message":"..."}` to start another agent generation, with `loop_limit` defaulting to 5. Claude updated the shared prompt to classify Cursor as tier 2 `active-turn-continuation`, while preserving that this session has not yet run the live arm → peer post → followup → disarm probe.
- **Assessment:** works-well with an evidence boundary — Cursor has a documented Codex-style short polling lease, but not a Claude Monitor-equivalent idle wake. Documented capability and session-validated behavior remain distinct labels.
- **Skill implication:** The Cursor adapter should expose the Stop-hook followup recipe, loop cap, and no-idle-wake ceiling; require a live prototype before marking it operational, and use stateless or Cursor-private offsets rather than another observer's state.

### [12:45] collaboration — Peer independently approves the final PR framing

- **What happened:** After Codex opened PR #138, Claude spot-checked the published body against the reviewed branch. It confirmed that the preliminary improve import, future substantive redesign, retrospective execution deviation, lifecycle-adoption boundary, runtime-broker backlog, observer-experiment exclusion, evidence axes, and cross-pack behavior were all represented accurately.
- **Assessment:** works-well — the peer that originally identified the branch/project scope mismatch verified the correction at the final external artifact boundary and reported no findings.
- **Skill implication:** Assign the discovering peer a final verification pass over the published PR or handoff artifact, not only the local draft. Close the loop with an explicit no-findings or findings report before declaring collaborative closeout complete.

### [13:05] collaboration — Portable handoff packet passes final peer review

- **What happened:** Codex made the packet self-contained with the byte-matching Codex hook prototype, sanitized hook/lease examples, normative Codex and Cursor setup contracts, synthetic-control authority rules, Cursor completion buffering, implementation layout, acceptance matrix, v2 backlog requirement, and closeout runbook. Claude then read the full current directory and reported a no-findings verdict across runtime consistency, setup completeness, authority safety, deferred-work tracking, and shutdown ordering.
- **Assessment:** works-well — the peer review closed the exact gaps discovered during the final packet audit and verified the transferred directory as an implementation-ready unit rather than relying on live-session tribal knowledge.
- **Skill implication:** A collaboration handoff should be portable by construction: copy tested prototypes and sanitized schemas, separate normative contracts from incident history, require deferred work to become backlog records, verify the full directory from a peer runtime, and retain the source until destination integrity is confirmed.

## Distilled Recommendations

1. **Keep the abstraction layered.** `session-observer-collab` should compose
   with the base observer for transcript discovery, normalization, offsets, and
   watch control. Runtime wake behavior belongs in load-one-only harness
   references; application integrations remain optional tier upgrades.
2. **Pin identities and consumers explicitly.** Add `whoami`, use exact peer
   session pins, and never treat cwd recency as authoritative. For N>2, either
   scope v1 to one observer per target or add per-observer consumer namespaces;
   stateless `review` is the safe interim read path.
3. **Separate watcher, unread-output, and wake state.** A running process does
   not imply the model can resume. Announce the selected capability tier and
   distinguish documented, probed, and live-validated support.
4. **Treat hooks as bounded leases.** Codex and Cursor continuation hooks need
   finite expiry, continuation/loop caps, short catch windows, explicit
   `armed`/`waiting`/`idle` status, atomic cursors, no-op suppression, and
   deterministic disarm/cleanup.
5. **Make Codex trust a first-class user step.** Install inertly, show the exact
   command, require `/hooks` inspection and trust, reject explicit disablement,
   and prove effective execution with a breadcrumb or live probe. Preserve
   unrelated hooks and never infer security approval.
6. **Use the tested Codex defaults honestly.** Recommend 12-hour lease expiry,
   100 maximum continuations, and a 5-second Stop-boundary catch window. Warn
   that long command-hook waits queue user messages and require steering;
   queued input is not rollout-visible early enough for self-preemption.
7. **Make peer completion and cursor advancement atomic.** Gate on each
   runtime's completed-turn marker, select the latest completed substantive
   peer turn, hand the agent the exact contiguous range, and advance to
   `completedRecord + 1`—never the transcript tail observed later.
8. **Build loop prevention into mechanism and protocol.** Suppress empty
   deltas and exact `[no-op]` turns without spending continuations; reserve
   phrase heuristics for compatibility. Agents evaluate every substantive peer
   turn but reply only with new information, disagreement, requested work, or
   a user-relevant correction.
9. **Keep authority and consensus explicit.** Cross-session user messages may
   carry design direction, but privileged action approval remains local to the
   acting harness. Verify disputed or truncated content against bounded raw
   records, and never report consensus beyond the peer's actual words.
10. **Provide an operational closeout.** Finalize each agent's log, perform one
    freshness poll and peer review of the published handoff, stop foreground
    watchers/Monitor tasks, disarm and remove session leases, prune clearly
    stale worktree leases, and retain or uninstall the static global hook only
    by explicit user choice.
11. **Ship evidence and tests with the handoff.** Include the working Codex hook
    prototype plus a sanitized lease example, an explicit skill/reference/
    script file layout, and an acceptance matrix covering Claude Monitor,
    Codex one-shot and recurring leases, Cursor `followup_message`, restart,
    trust, timeout, queued input, no-op loops, coexisting hooks, and cleanup.
