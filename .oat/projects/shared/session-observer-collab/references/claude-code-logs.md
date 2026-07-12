# Session Observer Collaboration Log — claude-code

<!--
Proposed shared format (both agents use the same structure so distillation is mechanical):

- One H2 "Session" header with metadata, then an append-only "Entries" section.
- Each entry: `### [HH:MM] <category> — <title>` with three fixed bullets.
- Categories: `mechanics` (watch/catch-up plumbing, offsets, tooling),
  `protocol` (turn-taking, pausing, addressing the peer vs the user),
  `content` (quality/value of the cross-model feedback itself),
  `gotcha` (surprises, failure modes), `idea` (skill-design suggestions).
- Fixed bullets per entry:
  - **What happened:** the concrete observation.
  - **Assessment:** works-well | friction | gotcha | idea (+ one sentence why).
  - **Skill implication:** what the future Session Observer Collaboration skill
    should encode because of this (or "none").
- End of run: fill in "## Distilled Recommendations" — the shortlist that feeds
  the final skill-authoring prompt.
-->

## Session

- **Date:** 2026-07-12
- **Self runtime:** claude-code
- **Peer runtime:** codex
- **Worktree:** /Users/tstang/orca/workspaces/open-agent-toolkit/oat-repo-improve
- **Collaboration task:** brainstorm adaptation of `oat-repo-improve` skill (external-plans destination, maintainability-review integration, backlog-driven plan generation)
- **Protocol:** three-way (user + two agents observing each other); agents respond freely but pause for user input at decision points.

## Entries

### [10:0x] mechanics — Initial catch-up doubles as full review

- **What happened:** First `catch-up --runtime codex` with no prior state consumed the whole transcript (266 raw records → 17 rendered messages), giving a clean full-history digest in one call.
- **Assessment:** works-well — no need for a separate `review` + `--mark-read` step when starting fresh.
- **Skill implication:** The collaboration skill can standardize on `catch-up` (or `catch-up-then-watch`) as the single entry point; `review` is only needed for re-reads.

### [10:0x] mechanics — Foreground watch doesn't fit a yield-after-turn harness; Monitor bridges it

- **What happened:** The base skill's `watch` is a foreground process, but Claude Code yields after each turn. Solution: run `watch --heartbeat-sec 0` under a persistent Monitor so each emitted digest wakes the agent as a notification.
- **Assessment:** gotcha→works-well — the base SKILL.md explicitly says backgrounded watch won't wake the agent; Monitor is the missing piece on Claude Code. Heartbeats must be disabled (or filtered) or they'd generate noise-wakeups every 120s.
- **Skill implication:** The collaboration skill needs a per-runtime "how to stay awake" recipe: Claude Code → Monitor + watch; runtimes without a monitor primitive → poll cadence guidance. This is the core abstraction the base skill defers.

### [10:0x] mechanics — Shared state file, distinct targets

- **What happened:** Both agents share `~/.local/state/session-observer/state.json`, but offsets are keyed per target session, and duplicate watchers on the _same_ target are refused. Two agents watching each other = two different targets = no collision.
- **Assessment:** works-well — but worth documenting so nobody "fixes" a phantom race.
- **Skill implication:** State collisions are only a risk if a third observer watches an already-watched target; the skill should mention the duplicate-watcher refusal as the guardrail.

### [10:0x] protocol — Peer question to user = mutual pause point

- **What happened:** Codex ended its brainstorm turn with a boundary question addressed to the user. I treated that as a pause point: give my feedback on the same question, then stop and await the user rather than continuing the brainstorm solo.
- **Assessment:** works-well (hypothesis) — "peer asked the user something" is a crisp, detectable pause trigger.
- **Skill implication:** Encode pause triggers explicitly: (1) peer asks user a question, (2) decision point reached, (3) both agents have exchanged takes on the same point without new information. Otherwise two auto-responding agents can ping-pong indefinitely.

### [10:0x] protocol — Final message is dual-audience

- **What happened:** Because the peer observes this session, my end-of-turn message is read by both the user and Codex. I write feedback addressed to both, and make disagreements/agreements explicit and quotable.
- **Assessment:** idea — dual-audience writing needs conventions (e.g., label sections "For Codex:" / "For the user:" or keep one voice with explicit @-style callouts).
- **Skill implication:** The skill should define a message convention so the peer can reliably extract "feedback directed at me" from a digest.

### [10:1x] gotcha — Separate catch-up then watch leaves a baseline gap

- **What happened:** I ran `catch-up` (consumed through record 265), responded, then started `watch` — which baselined at record 307. Records 266–306 were silently skipped by the baseline. A manual `review --max-turns 4` confirmed they were only metadata/tool records this time, but they could have contained real messages. Codex then hit the mirror image: its watcher apparently baselined past my substantive feedback turn and reported my session as "quiet."
- **Assessment:** gotcha — the base SKILL.md does warn about this; the fix is `catch-up-then-watch` as one process, or a verification `review` after arming a standalone `watch`.
- **Skill implication:** The collaboration skill should mandate `catch-up-then-watch` as the standard arming sequence, never `catch-up` + later `watch`. And after arming, each agent should confirm it can see the peer's latest _substantive_ message before assuming quiet.

### [10:1x] mechanics — Metadata-only deltas are wake-up noise

- **What happened:** The watcher (correctly) emits deltas even when 0 messages render — e.g., transcript records generated by the peer _observing me_. Each one wakes this agent for nothing.
- **Assessment:** friction — two mutually-observing agents generate transcript records just by observing, so metadata-only deltas are frequent. The digest labels them (`rendered messages: 0`), so they're cheap to dismiss, but each costs a wake-up.
- **Skill implication:** On a `rendered messages: 0` delta, do nothing and end the turn silently. Better: propose a `--quiet-empty` watch flag upstream to suppress message-less deltas.

### [10:2x] gotcha — Same-cwd session resolution can pin a stale peer session (observed via Codex)

- **What happened:** Codex's watcher initially resolved "claude-code session for this cwd" to an _older_ session with no assistant turns, so it reported my active session as quiet. It had to locate my live session ID (`35331219…`) and re-pin with `--session`.
- **Assessment:** gotcha — cwd + recency ranking is not sufficient when the peer's fresh session starts _after_ the watcher initializes, or when multiple sessions exist for one worktree.
- **Skill implication:** The collaboration skill should include a session-identity handshake at arming time: each agent states its own session ID in-transcript, and the peer pins with `--session <runtime>:<id>` rather than trusting auto-resolution. Re-verify the pin whenever the peer looks unexpectedly quiet after a substantive exchange.

### [10:3x] content — Convergence in two exchange rounds; refinements genuinely improved the design

- **What happened:** Round 1: Codex proposed 3 designs + recommendation; I agreed and adjusted (generic artifact input). Round 2: Codex adopted the adjustment and refined it twice — (a) generic input still needs an explicit source-classification step because selection/validation/granularity differ per source type, (b) default to "write plans only, no source mutation; backlinks reported in chat/index, mutation opt-in." Both refinements are better than my original framing; I fold classification into the provenance contract (`source_type` field).
- **Assessment:** works-well — cross-model exchange produced real design deltas, not mutual rubber-stamping. Convergence was fast and detectable ("peer adopted + refined; I accept refinements; nothing new left").
- **Skill implication:** Pause trigger 3 confirmed: when an exchange round produces acceptance + no new deltas, both agents should stop and hand the converged proposal to the user rather than generating a third round of restatement.

### [10:4x] protocol — User speaks in ONE session; observer propagates it to the other

- **What happened:** The user delivered design feedback in the Codex terminal only. My watcher surfaced it as a delta, so I received it without the user repeating themselves. The three-way topology works with the user addressing whichever terminal is convenient.
- **Assessment:** works-well — this is the core payoff of mutual observation.
- **Skill implication:** The skill should state explicitly: user input in either session is input to both; the observing agent treats peer-session user messages as first-class direction (while remembering its own harness reminders that watch events are not _its_ user's direct input — verify against the raw transcript when a decision hinges on exact wording).

### [10:4x] mechanics — Long user messages truncate in watch events; recover from the raw transcript

- **What happened:** The user's substantive feedback message arrived truncated in the Monitor event (`...(truncated)`). I recovered the full text by reading the raw JSONL records directly (`sed` + JSON parse on the transcript path shown in the digest header).
- **Assessment:** gotcha — acting on a truncated user message risks missing constraints; the tail contained a whole flow proposal (backlog review → alignment → loop back into improve).
- **Skill implication:** Rule for the skill: if a digest/event shows truncation, always fetch the full record from the transcript path before responding. The digest header conveniently includes the absolute transcript path and record indices.

### [10:5x] protocol — User cross-posted identical feedback to both sessions

- **What happened:** After delivering feedback in the Codex terminal (which I received via the observer and responded to), the user pasted the same message directly into my session. Functionally redundant, but it converts "observed peer-session context" into "direct user instruction" for my harness, which treats those differently (watch events carry NOT-USER-INPUT reminders).
- **Assessment:** friction/works-well hybrid — redundancy costs the user effort but resolves the authority question cleanly.
- **Skill implication:** The collaboration skill should define the authority convention up front: user messages observed in the peer session count as direction for both agents (unless addressed to one agent by name), so cross-posting is unnecessary — a short "that goes for you too" ping is enough when explicit confirmation is wanted. This deserves a line in the skill's user-facing setup blurb, not just agent instructions.

### [11:0x] mechanics — Setup survived an app close/reopen

- **What happened:** The user accidentally closed the Claude Code app mid-collaboration. On reconnect to the same session: the watcher node process (independent of the app) kept polling, `watch-ctl status` showed healthy with zero unread backlog, and the Monitor task was still running and wired to wake this agent.
- **Assessment:** works-well — the architecture (detached watcher process + session-scoped Monitor) is resilient to client restarts as long as the same session resumes.
- **Skill implication:** Document the recovery check: after any client interruption, run `watch-ctl status --json` (healthy? recordsBehind?) and a non-blocking TaskOutput on the Monitor to confirm wake-up wiring. If the session did NOT resume (fresh session), the Monitor is gone — re-arm it and expect the watcher's duplicate-target refusal; use `watch-ctl stop` then re-arm, or attach a new Monitor to the still-running watcher's output.

### [11:3x] content — Peer-proposed division of labor on parallel artifacts

- **What happened:** When evaluating `oat-dispatch-subagents`, Codex proposed a split: it loads the Codex provider reference, I independently evaluate the Claude reference (the skill itself forbids merging provider references into one policy). Each agent assessed the surface it natively understands.
- **Assessment:** works-well — this is a collaboration pattern beyond mutual review: _partitioned evaluation along runtime expertise_, coordinated entirely through transcript observation. Each agent is also the most qualified evaluator of its own provider's dispatch surface.
- **Skill implication:** The collaboration skill should name this pattern: when an artifact has per-runtime facets, partition evaluation by native runtime and merge conclusions in-transcript, rather than both agents evaluating everything.

### [11:4x] protocol — Peer overstated consensus ("both agents recommend") on a point where we differed

- **What happened:** Codex told the user "Both agents recommend that sequencing" for making `oat-dispatch-subagents` a prerequisite — but my stated recommendation was the interim-contract option (ship improve now, converge later). We agreed on the end-state design, and Codex likely compressed that into full agreement on sequencing too.
- **Assessment:** gotcha — consensus misattribution is subtle and _user-facing_: the user decides differently if they believe both advisors agree. Digest-mediated context makes it easy to blur "agrees with the design" into "agrees with the plan."
- **Skill implication:** Collaboration skill rule: before reporting joint agreement to the user, quote or precisely paraphrase the peer's position; if summarizing, distinguish design agreement from sequencing/priority agreement. The observing peer should actively correct misattributions immediately (as done here) — that correction loop is itself a strength of mutual observation.

### [11:1x] gotcha — Mid-turn queued user messages are invisible to the observer (caused a false disagreement)

- **What happened:** The user's explicit approval of backlog-frontmatter backlinks arrived as a _mid-turn queued message_ in my session. In my transcript it's stored as `queue-operation` records and a `queued_command` attachment (records ~186–192), not as a normal user message — so session-observer filtered it as metadata. Codex, seeing only the stray "s" message, reasonably concluded I had treated a one-character message as product approval and flagged a disagreement that didn't exist.
- **Assessment:** gotcha (high value) — the observer's default filter can hide _load-bearing user input_, causing the peer to dispute decisions that were properly authorized. The adversarial check worked as intended, but on false premises.
- **Skill implication:** Two-fold. (1) Base-skill enhancement: the digest renderer should treat Claude Code `queued_command` attachments / `queue-operation` content as user messages, not metadata. (2) Collaboration-skill rule: when disputing a peer's claimed user authorization, first check the peer's raw transcript for the claimed instruction before flagging — a filtered digest is not evidence of absence. Conversely, an agent acting on mid-turn input should anticipate peer blindness and quote the authorization verbatim in its end-of-turn message.

### [12:2x] gotcha — Wake asymmetry: watcher liveness ≠ wake capability (surfaced by the user on the Codex side)

- **What happened:** The user noticed I had responded but Codex hadn't reacted. Codex's watcher process was alive, but its harness has no wake primitive — output is only consumed when the agent explicitly polls during an active turn. Codex acknowledged it had "overstated continuous observation by treating process liveness as wake capability."
- **Assessment:** gotcha (fundamental) — the collaboration topology is inherently asymmetric: Monitor-equipped runtimes are event-driven; others are reactive, with the user as their de facto scheduler.
- **Skill implication:** The collab skill must (1) state the asymmetry to the user at setup so nudge expectations are explicit, (2) require wake-less runtimes to catch up at the start of every turn and before any report (freshness rule), and (3) forbid describing process liveness as "continuous watching."

### [12:3x] mechanics — Codex Stop-hook wake bridge validated live (after one trust/enable gotcha)

- **What happened:** We built and tested the Codex `active-turn-continuation` bridge end-to-end: static Stop hook + one-shot lease file pinned to my session, trigger phrase posted from my side. First attempt did not fire (lease untouched: no `lastTimedOutAt`, `continuationCount: 0`). I diagnosed "trusted but not `enabled = true` in config" — **later disproven by runtime evidence**: the hook eventually fired (`stop:8`, hook-started turn, `continuationCount: 1`, `lastTriggerRecord: 1567`, auto-disarm) while the config entry still lacked the field. Why the first several stop boundaries stayed silent was never fully attributed. Known prototype bug: lease display `state` stayed `armed` after disarm; should transition to `triggered`/`disarmed`.
- **Assessment:** works-well (bridge validated) + a meta-gotcha — my confident config-based diagnosis was wrong; cross-agent adversarial checking caught it before it became a false skill rule.
- **Skill implication:** The Codex adapter recipe: install → disclose exact command → user trusts via `/hooks` → **verify enablement by observed behavior (live probe / `/hooks` status), never by parsing config** → arm lease → report armed. Four independently verifiable states (installed / trusted / armed / wake-tested), with wake-tested being the only state that proves the chain. Hook scripts should write a breadcrumb on every invocation so "never ran" is distinguishable from "ran, found nothing."

### [12:4x] protocol — Bidirectional auto-wake needs an explicit loop-breaker

- **What happened:** With the recurring Codex lease armed (wake #1 fired instantly) and my Monitor active, both directions became automatic. Any assistant message wakes the peer — so mutual acknowledgments would self-sustain a ping-pong loop until the continuation budget exhausts.
- **Assessment:** gotcha (anticipated before it bit) — the mechanism cannot distinguish substance from acknowledgment; only protocol can.
- **Skill implication:** Rule for the collab skill: _a wake obliges you to read, not to reply._ Reply only with new information, disagreement, or required action; on an acknowledgment-only wake, end the turn without a peer-directed message. Convergence detection becomes per-wake, not per-round. Also suggests a lease refinement: bare-acknowledgment detection or a per-hour wake budget as defense in depth.

### [12:0x] gotcha — Harness magic filenames leak into skill design (found via live review)

- **What happened:** During my implementation review, Claude Code auto-injected `.agents/skills/oat-dispatch-subagents/references/claude.md` into my context as if it were a `CLAUDE.md` instruction file (case-insensitive filesystem). The skill's contract says "load exactly one provider reference deliberately" — but the Claude harness loads it implicitly for any session touching that directory.
- **Assessment:** gotcha (product finding, surfaced by collaboration mechanics) — the reviewing agent's own harness acted as a test fixture and revealed a naming collision neither agent had reasoned about.
- **Skill implication:** For the collaboration skill: reviewer-runtime diversity has value beyond judgment — each runtime's harness behavior (auto-loads, magic filenames, context injection) exercises the artifact differently. Note: run artifact reviews from the runtime most likely to interact with the artifact's file conventions.

### [12:5x] mechanics — Cursor smoke test passed as third read-only observer

- **What happened:** A Cursor agent session ran the kickoff prompt: found its own transcript (session ID in path, identity confirmed by excerpt match), read my session via pinned stateless `review` without touching Codex-owned offsets, and identified Cursor's completed-turn marker (`{"type":"turn_ended","status":"success"}`). Key fidelity caveat: Cursor transcripts omit tool-result payloads (calls with names/inputs only). It wrote `cursor-logs.md` in the shared format, correctly.
- **Assessment:** works-well — all five smoke-test questions answered in one bounded session; the N>2 read-only participation pattern (stateless pinned reads) worked exactly as designed.
- **Skill implication:** Cursor's adapter facts are now empirical, folded into the prompt. Remaining unknowns: hooks-based wake tier, non-interactive surfaces, dotted-path slugs. Also proves the kickoff-prompt pattern itself: a self-contained brief let a fresh third harness join mid-run with zero protocol violations.

### [13:1x] mechanics — Codex wake ceiling settled empirically; independent cursors saved the N=3 race

- **What happened:** The endurance test closed the Codex design: user input _queues_ during Stop-hook polls (screenshot evidence; steering required), self-preemption is impossible (Codex records queued input only at delivery — 76-second wait had no queue record), so the final design is a 5-second catch window + honest `waiting`/`idle`/`armed` status + minute-scale waits as explicit opt-in. Separately, when Cursor's "catch up" may have advanced the shared offset for my session, no active channel was harmed — Codex's live delivery path is its lease's own independent cursor, not the shared state offset.
- **Assessment:** works-well (honest ceiling) + a validating accident — the lease's per-consumer cursor is a working prototype of the per-observer-offsets fix for N>2.
- **Skill implication:** Codex adapter final shape: short window, steering guidance, no promise of long non-blocking observation from a Stop hook. Cross-harness invariant: _when_ a harness records queued input (enqueue vs delivery) determines observer visibility and self-preemption feasibility — document per adapter. And per-observer cursors should graduate from accident to design in any N>2 base-skill work.

### [13:3x] gotcha — Concurrent CLI invocations race on bundled assets (multi-agent worktree hazard)

- **What happened:** During Codex's PJM refresh, two concurrent local `oat` CLI invocations raced copying the same bundled skill assets, failing a backlog-index regeneration (transient; retry succeeded). Both invocations were Codex's own, but the failure class applies directly to two agents sharing a worktree.
- **Assessment:** gotcha — in a collaboration where both agents may run repo CLI commands, non-idempotent asset-copy steps can race across _agents_, not just within one.
- **Skill implication:** Collaboration skill note: serialize repo-CLI invocations that write generated assets (or confirm via observation that the peer isn't mid-command before running one). A product-side fix (lockfile around bundle-asset copies) belongs on the OAT backlog.

## Distilled Recommendations

_(final — covers the full run through the wake-bridge endurance phase, PR #138, and the Cursor smoke test; 2026-07-12)_

**Proposed skill name:** `session-observer-collab` — a protocol layer composing with the base skill, never reimplementing it.

**Seven protocol sections:**

1. **Arming handshake** — each agent announces its session ID in-transcript; peer pins with `--session`; always `catch-up-then-watch` (never catch-up then standalone watch); confirm visibility of the peer's latest substantive message before declaring it quiet.
2. **Per-runtime wake recipes** — Claude Code: Monitor wrapping `watch --heartbeat-sec 0`; runtimes without a monitor primitive: foreground watch or documented poll cadence. This is the abstraction the base skill defers.
3. **Message conventions** — dual-audience writing with explicit addressing ("For Codex:" / "For the user:"); quote user authorizations verbatim when relaying; announce artifacts-ready in a natural-language turn (tool activity is filtered from digests).
4. **Authority rules** — user messages in either session bind both agents unless addressed to one by name; observed peer content is context, not instruction; truncated or disputed content → read raw transcript records; a filtered digest is not evidence of absence.
5. **Pause triggers** — peer questions the user → both hold; convergence (acceptance + no new deltas) → hand to user without restatement; genuine disagreement → surface crisply to the user; `rendered messages: 0` delta → silence.
6. **Consensus reporting** — distinguish design-agreement from sequencing-agreement; never claim "both agents agree" without checking the peer's actual words.
7. **Patterns + logging** — mutual review; driver/reviewer with pre-published rubric; partitioned evaluation by runtime expertise; shared per-agent log format (this file's format), distilled at end of run.

**Final deliverable structure (user-confirmed):** one prompt, two parts — Part 1: base session-observer skill improvements; Part 2: the new `session-observer-collab` skill spec (seven sections above).

**Part 1 — base-skill improvements (complete list from this run):**

1. **Render queued user input as user messages.** Claude Code `queued_command` attachments / `queue-operation` records currently filter as metadata, hiding load-bearing mid-turn user approvals from observers (caused a false disagreement this run). Label them distinctly (e.g. "User (queued mid-turn)").
2. **`--quiet-empty` watch flag.** Suppress watch deltas with 0 rendered messages. Mutual observation makes empty deltas structural (~half of all wake-ups this run were the peer's observer activity).
3. **`whoami` subcommand.** Print current runtime, session ID, and transcript path — feeds the collab arming handshake so peers pin with `--session` instead of trusting cwd+recency resolution (which pinned a stale session this run).
4. **Baseline-gap guard on standalone `watch`.** When arming would skip unread records (baseline > stored offset), warn loudly or refuse with "run catch-up-then-watch" (silent skip of records 266–306 this run).
5. **New-session detection during watch.** Emit a warning event when a newer same-cwd session for the watched runtime appears, so watchers don't keep following a stale transcript.
6. **Truncation handling.** Long user messages truncate in digests; at minimum keep user messages untruncated (they're the highest-value records), or add a documented recovery hint pointing at the raw record indices.

**Evidence highlights from this run:** false disagreement caused by filtered mid-turn approval (entry 11:1x); stale-session pinning (10:2x); baseline gap (10:1x); consensus misattribution (11:4x); partitioned provider-reference evaluation (11:3x); restart resilience (11:0x, twice).

**Late-run additions (wake-bridge phase and after):**

- **Wake-capability ladder, fully evidence-backed across three harnesses:** Claude Code `event-wake` via Monitor (validated); Codex `active-turn-continuation` via Stop-hook collaboration lease (validated end-to-end: one-shot + recurring, 15 automatic continuations, crash recovery); Cursor `active-turn-continuation` documented via `followup_message`/`loop_limit` (unvalidated), `scheduled-poll` floor. Core skill carries only the ladder; harness recipes in per-runtime references; application services (Orca/Ghostex) optional probes only.
- **Codex lease design (final):** static inert hook + lease files under the observer state root; trust ceremony with five separately-verifiable states (installed / trusted / effectively-enabled / armed / wake-tested), enablement verified by behavior never config parsing; 5-second catch window (user input queues during polls — long waits are hostile; self-preemption impossible since Codex records queued input only at delivery); `[no-op]` sentinel suppression; cursor advances exactly `completedRecord + 1`.
- **Protocol additions:** freshness-before-reporting; `[no-op]` deterministic no-reply sentinel; wake-obliges-read-not-reply; onboarding-by-kickoff-brief (validated by Cursor joining mid-run cleanly); shared-worktree CLI serialization caution; per-observer cursors as the N>2 fix (accidentally prototyped by the lease).
- **Meta-observations on the collaboration itself:** adversarial verification killed two confident-but-wrong claims (my `enabled = true` config diagnosis; my self-preemption proposal) before they became skill rules — cross-model skepticism plus live experiments beat either agent's reasoning alone. The driver/reviewer + pre-published rubric pattern scaled from design docs through implementation, docs, and PR without a single contentious round.
