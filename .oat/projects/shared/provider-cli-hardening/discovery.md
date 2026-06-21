---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-06-21
oat_generated: false
---

# Discovery: provider-cli-hardening

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details.

- Prefer outcomes and constraints over concrete deliverables (no specific scripts, file paths, or function names).
- If an implementation detail comes up, capture it as an **Open Question** for design (or a constraint), not as a deliverable list.

## Initial Request

Spec-driven OAT project: **provider-CLI reliability hardening** of the owned
`consensus` provider CLI shipped by `bl-bb7e` (DR-023). One project, two backlog
items, **design pass first**:

1. **bl-3a88** — tool-based verdict submission for consensus peers (DESIGN FIRST,
   then build). Evaluate an MCP tool vs. a CLI the sandboxed agent runs to *submit*
   a validated verdict; how the orchestrator captures it; how it composes with
   stateless-per-turn agents and the deterministic engine. The mechanism validates
   against the per-mode schema and returns actionable, in-context errors the agent
   can self-correct, reducing wrapper retry churn. Demonstrate a reliability
   improvement vs. `--output-schema` on the 2026-06-13 dogfood flaky cases
   (synthesizer "finished without structured output"; codex/OpenAI strict-output
   rejections). Keep the engine deterministic and the artifact-as-audit-trail
   intact. Record the design as a DR if durable.
2. **bl-3291** — provider-exit retry classification (transient vs terminal),
   **additive ride-along**. Classify `PROVIDER_EXIT` by adapter-owned
   stderr/exit-signature matching; unknown/unmatched exits keep current behavior
   (strictly additive, no regression). Audit which classification fired without
   leaking stderr beyond redaction rules. Unit/integration coverage for
   transient-retry, terminal-stop, unknown-fallthrough per adapter that gains a
   signature.

This is **hardening, not build-vs-buy** — the CLI already owns peer invocation
(ownership question is closed). Cross-track: bl-3a88's verdict-submission decision
**de-risks** the parallel consensus-family synthesized-mode wrappers
(`bl-b9b9`/`bl-87ef`/`bl-0cb8`); aim to land the design (ideally the build) before
those fan out, and flag the family track when the decision is made.

Build/verify discipline: edit canonical TS under `src/consensus/provider-cli/`,
`pnpm run build` to regenerate `.mjs` (never hand-edit `// GENERATED` outputs),
shipped runtime stays dependency-free. Gate on `build:check`, `type-check`, `test`,
`validate`, `smoke`.

## Surface-State Findings (read 2026-06-20, at HEAD `e4e9348`)

Read directly from `src/consensus/provider-cli/` rather than the stale knowledge
index (the index records pre-squash SHA `d008a7e`; its 398-file delta is squash
inflation, not real churn). **Key finding that reshapes both items:**

- **bl-3291 is largely already shipped.** The transient-vs-terminal classifier
  landed in the *same* commit that shipped the CLI (`92a2711`, bl-bb7e), not
  deferred as the peer-invocation `design.md` implied. `adapters.ts` already has
  `COMMON_TRANSIENT_EXIT_PATTERNS` (429, rate limit, "temporarily unavailable",
  "try again", econnreset, etimedout) → `retryable: true`,
  `terminal_reason: provider_exit_transient`; plus auth-required, unsupported-option,
  and unavailable terminal branches. The retry loop in `structured-output.ts`
  (lines 161-181) already honors `classification.retryable` within `max_attempts`.
- **The shipped default contradicts bl-3291's written premise.** bl-3291 assumes
  the baseline "retries *all* nonzero exits within `max_attempts`" and asks to keep
  unknown exits retrying (strictly additive). But the shipped default for an
  *unmatched* `PROVIDER_EXIT` is `retryable: false` (`provider_exit_terminal`) —
  unknown exits already stop early. So implementing bl-3291 "as written" would
  *reverse* current behavior, not add to it. **This is the central reconciliation
  question for bl-3291** (see Open Questions).
- **Gaps that remain real for bl-3291:** (a) no *per-adapter* provider-specific
  transient class — all three adapters share one `COMMON` pattern set; (b)
  signal-based interruption (SIGTERM/SIGKILL, `signal != null`) isn't classified as
  transient; (c) no backoff between transient retries; (d) transient retries reuse
  the *validation-feedback* prompt path (`structured-output.ts:164`
  `validationFeedback = classification.message`), so a "rate limit" string is
  injected into the next prompt as "Schema validation failed: …" — a prompt-shape
  defect; (e) audit records `terminal_reason` but `AttemptSummary.retryable` is not
  populated on the terminal failure path.
- **bl-3a88 is genuinely not built (design-first is correct).** Only a *type-level
  reservation* exists: `submit_tool_candidate` in `STRUCTURED_OUTPUT_STRATEGIES`,
  cursor lists it as a capability, `supports_submit_tool: false` on all adapters,
  and `invocation.ts` maps `submit_tool_candidate` → `prompt_only` (a no-op
  placeholder). The peer-invocation design's FR10 already anticipated a "Cursor
  submit-tool spike to prove or reject reliability." Current structured output is
  prompt+parse+local-validate+re-prompt (`structured-output.ts`), exactly the
  fragile path the 2026-06-13 dogfood hit.

## Discovery Focus (user-selected)

All four candidate areas were selected for exploration: bl-3291 scope
reconciliation, bl-3a88 mechanism direction, bl-3a88 capture + determinism, and
the reliability evidence bar. Build ambition: **bl-3a88 design+DR then build;
bl-3291 finish gaps** (full hardening).

## Clarifying Questions

### Question 1: Is bl-3291 "add retry classification" or "confirm contract + fill gaps"?

**Q:** The shipped code (`adapters.ts` classifier + `structured-output.ts` retry
loop, both from `92a2711`) already classifies transient vs terminal, and an
unmatched `PROVIDER_EXIT` already falls through as **terminal (no retry)**. The
backlog item assumes a "retry-all" baseline and asks to keep unknown exits
retrying ("strictly additive"). Which is the real task?

**A:** Treat the backlog item as **drifted against shipped reality**. The decision
is *not* "add retry classification" — that exists — it is "**confirm the shipped
terminal-default contract and finish the hardening gaps**." Do **not** restore
unknown-exit retry; that would be a *semantic change*, not an additive
implementation of the old AC. Only restore retry-all if evidence emerges that
fail-fast is hurting real provider runs.

**Decision:** bl-3291 reframes from "additive classification" to
"contract-confirmation + gap-fill." The old AC line ("unknown exits retain
retry-within-max_attempts") is recorded as **backlog drift** to be corrected, not
implemented. Root cause noted: the impl (`92a2711`) overshot `design.md:564`'s
"defer signature matching" promise, and the item was written against that
never-shipped deferral.

### Question 2: bl-3291 concrete remaining scope?

**Q:** Which gaps are in scope, given classification already ships?

**A / Decision:** Five explicit gaps:

1. **Transient-retry prompt contamination** — provider-exit messages are fed back
   through the validation-feedback path (`structured-output.ts:164`) as "Schema
   validation failed: …". Separate the transient process-exit retry path from the
   schema-validation-feedback path. (Correctness fix.)
2. **Evidence-backed per-adapter transient signatures** — replace/augment the one
   shared `COMMON_TRANSIENT_EXIT_PATTERNS` set with provider-specific signatures
   **only where real evidence exists**; no broad speculative matching.
3. **Signal/interruption classification** — classify interrupted/signal-terminated
   runs as transient **only where the runtime exposes reliable evidence** (e.g.
   non-null `signal`); do not guess.
4. **Redacted audit fields** — record which classification fired
   (transient/terminal/unknown) and populate retryability in the attempt summary,
   **preserving existing stderr redaction rules** (no stderr leakage).
5. **Contract-locking tests** — unit/integration tests that lock the *confirmed*
   default: transient → retry within budget, terminal → stop early, unknown →
   terminal (the now-confirmed fall-through), per adapter that gains a signature.

### Question 3: bl-3a88 submission mechanism?

**Q:** Submit-CLI vs MCP tool vs hardened prompt+parse as the primary design?

**A:** **Submit-CLI is the primary design.** It fits the repo constraints better
than MCP: reuses the owned CLI/subprocess boundary, works across
Claude/Codex/Cursor, keeps the shipped runtime dependency-free, and captures a
sidecar artifact the deterministic engine reads after the turn. MCP is a
legitimate mechanism in general but here adds a server/config boundary that does
not buy enough reliability to justify the complexity.

**Decision:** Design pass leads with submit-CLI; **MCP is documented as a rejected
alternative for this repo** (extra server/config boundary, uneven provider MCP
support, cuts against "subprocess is the only external execution boundary"). The
hardened prompt+parse path remains the **fallback** baseline, not the primary.

### Question 4: bl-3a88 adoption risk + evidence bar?

**Q:** Submit-CLI only helps if the peer actually calls it. What gates the DR?

**A / Decision:** Make **adoption reliability first-class** in the DR. The DR must
define **what happens when a peer ends its turn without submitting** — choosing
among: a terminal `missing submission` failure, one bounded retry with clearer
instructions, or a fallback to the existing parse path (the DR decides and
justifies). The DR must also require **dogfood evidence on the exact 2026-06-13
flaky cases**: (a) "finished without a structured-output message" and (b)
Codex/OpenAI strict-output rejection — showing the prompt reliably drives
submission and converts those failures to self-corrected success.

## Solution Space

### bl-3a88 — verdict submission mechanism

#### Approach 1: Submit-CLI _(Recommended — selected)_

**Description:** A `consensus submit …` subcommand the sandboxed peer invokes
mid-turn. It validates the payload against the per-mode schema, writes a verdict to
a run-bound sidecar artifact on success (exit 0), and prints the validation error
to stderr + exits nonzero on failure so the agent self-corrects **inside its own
turn**. The orchestrator reads the sidecar after the turn (same pattern as codex's
`last_message_file`).
**When this is the right choice:** Dependency-free runtime; uniform peer support
needed across providers with uneven schema/tool surfaces (cursor has neither);
deterministic post-turn capture into the audit trail.
**Tradeoffs:** Depends on the peer actually calling the command (prompt-adoption
risk — made first-class in the DR); needs run→capture binding and
single-submission/last-write-wins semantics; sandbox/permission posture must permit
the command.

#### Approach 2: MCP submit-tool _(rejected for this repo)_

**Description:** A registered `submit_verdict` MCP tool the peer calls; an MCP
server validates and captures.
**When this is the right choice:** When all target providers have reliable MCP
support and a server surface/dependency is already acceptable; maximal nativeness
to trained tool-calling.
**Tradeoffs:** Adds a server/config boundary that cuts against the repo's
"dependency-free shipped runtime; subprocess is the only external execution
boundary" contract; uneven MCP support across claude/codex/cursor; deterministic
run-bound capture is more complex. Net: extra complexity without enough added
reliability here.

#### Approach 3: Harden the current prompt+parse path _(fallback, not primary)_

**Description:** Keep relying on final-message JSON, improve prompts/parsing/
re-prompt feedback.
**When this is the right choice:** As the fallback when a peer doesn't submit, or
if submit-CLI adoption proves unreliable.
**Tradeoffs:** Structurally fragile (depends on the model ending its turn with
schema-valid JSON) — exactly the path that failed in the 2026-06-13 dogfood.

### Chosen Direction

**Approach:** Submit-CLI as the primary bl-3a88 design (DR), prompt+parse retained
as fallback; MCP documented as rejected alternative. bl-3291 = confirm shipped
terminal-default contract + fill the five gaps.
**Rationale:** Submit-CLI satisfies the dependency-free / single-subprocess-boundary
contract, is uniform across the three providers, and yields deterministic,
audit-friendly capture. bl-3291's classification already ships; the value left is
correctness (prompt contamination), evidence-backed signatures, and locking the
contract with tests.
**User validated:** Yes — explicit buy-in on both forks (this turn).

## Options Considered

### Option A: bl-3a88 verdict capture — run-bound sidecar artifact

**Description:** Peer's submit writes to a run-bound sidecar file path; the
deterministic engine reads it *after* the turn and records it in the JSONL audit
trail. Mirrors the existing `last_message_file` capture in `invocation.ts`.

**Pros:**

- Deterministic: engine never interactively converses with tool calls.
- Audit-trail-native; reuses an existing, proven capture pattern.

**Cons:**

- Requires run→file binding and single-submission semantics (design detail).

**Chosen:** A

**Summary:** Sidecar capture is the cleanest deterministic fit and keeps the
artifact-as-audit-trail contract intact; details (binding, last-write-wins) are
design-pass work.

## Key Decisions

1. **bl-3291 framing:** Confirm the shipped **terminal-default for unknown
   provider exits**; record the old "additive/retry-all" AC as **backlog drift**.
   Do not restore retry-all absent evidence that fail-fast harms real runs.
2. **bl-3291 scope:** Five gaps — prompt-contamination fix, evidence-backed
   per-adapter signatures, signal/interruption classification (where reliable),
   redacted audit fields, and contract-locking tests.
3. **bl-3a88 mechanism:** **Submit-CLI primary**; MCP a documented rejected
   alternative for this repo; prompt+parse retained as fallback.
4. **bl-3a88 capture:** Run-bound **sidecar artifact** read post-turn; engine stays
   deterministic; audit trail intact.
5. **bl-3a88 adoption + evidence:** DR must define **no-submission behavior** and
   require **dogfood evidence** on the two 2026-06-13 flaky classes.
6. **Build ambition:** bl-3a88 **design+DR → build**; bl-3291 **finish gaps**.
   Design is a HiLL checkpoint so the durable DR is approved before
   implementation fans out (de-risking the parallel consensus-family track).
7. **Single cohesive project:** Split signals `below` threshold (shared
   `provider-cli/` surface); the two items run as one project, disjoint from the
   family lane.

## Constraints

- Edit canonical TypeScript under `src/consensus/provider-cli/`; run
  `pnpm run build` to regenerate committed `.mjs`; never hand-edit `// GENERATED`
  outputs.
- Shipped runtime stays **dependency-free**; provider CLI subprocesses are the only
  external execution boundary (this is the load-bearing reason MCP is rejected).
- Keep the consensus **engine deterministic** and the **artifact-as-audit-trail**
  contract intact.
- Preserve existing **stderr redaction** rules — audit fields must not leak provider
  stderr beyond what's already permitted.
- bl-3291 must be a **no-regression** change to the *confirmed* shipped contract
  (terminal-default for unknown exits is the baseline being locked, not changed).
- Gate on `pnpm run build:check`, `type-check`, `test`, `validate`, `smoke`.
- Tests that create temporary git repos must scrub `GIT_DIR`/`GIT_*` env so running
  under a git hook can't corrupt the real repo (see repo memory on git-test
  isolation).

## Success Criteria

- **bl-3291:** transient-retry prompt contamination removed; per-adapter signatures
  are evidence-backed (no speculative matching); signal/interruption classified only
  where runtime evidence is reliable; audit records which classification fired with
  redaction preserved; tests lock transient-retry / terminal-stop / unknown-terminal
  per adapter. Backlog item updated to reflect the confirmed contract.
- **bl-3a88:** a durable **DR** selecting submit-CLI (MCP rejected with rationale),
  specifying deterministic sidecar capture, defining no-submission behavior, and
  backed by dogfood evidence converting the two 2026-06-13 failure classes to
  self-corrected success; then a **build** delivering the mechanism.
- The bl-3a88 design decision is recorded and the **consensus-family track is
  flagged** when it lands (it de-risks the synthesized-mode wrappers).
- All gates green; both backlog items + repo reference (completed/current-state/
  roadmap/decision-record) updated at completion.

## Out of Scope

- Reopening peer-invocation **ownership** (build-vs-buy) — closed by DR-023.
- Restoring **retry-all** semantics for unknown provider exits (explicitly rejected
  absent new evidence).
- Building an **MCP server** surface for verdict submission.
- Broad **speculative** transient signatures without provider evidence.
- Changes to the consensus-family lane (`src/consensus/core/`) — disjoint track.
- Backoff/jitter between transient retries (deferred — adds wall-clock
  nondeterminism; revisit only with evidence).

## Deferred Ideas

- **Transient-retry backoff/jitter** — deferred; introduces wall-clock
  nondeterminism into a deterministic engine and lacks evidence of need.
- **Making unknown-exit default configurable** — deferred; only worth a request-level
  knob if real runs show fail-fast is harmful.
- **Submit-tool for the orchestrator/host-native path** — out of first scope;
  `supports_host_native_dispatch` stays reserved.

## Open Questions

_(For design — captured, not decided in discovery.)_

- **No-submission behavior:** terminal `missing_submission` vs one bounded retry
  with clearer instructions vs fallback to parse path — the DR must choose and
  justify.
- **Run→capture binding:** how a submit invocation is bound to its run and sidecar
  path (env var vs arg), and single-submission/last-write-wins semantics.
- **Sandbox/permission posture:** what each provider needs to permit the peer to run
  `consensus submit` (codex `--sandbox`, claude `--permission-mode`).
- **Per-adapter signature evidence:** which providers actually have documented/
  observed transient signatures distinct from the common set.
- **Signal-evidence reliability:** whether non-null `signal` is a trustworthy
  "interrupted run" indicator vs. ambiguous (e.g. our own timeout SIGTERM path).
- **Evidence medium:** deterministic fixtures vs live-provider E2E (or both) to gate
  the DR — leaning fixtures-for-decision + live-E2E-at-build, to confirm in design.

## Assumptions

- The shipped terminal-default for unknown exits is acceptable product behavior
  (no current evidence it harms real runs).
- The peer providers (claude/codex/cursor) can each invoke a local subcommand within
  their sandbox/permission posture (to be confirmed in design).
- The 2026-06-13 dogfood failure classes are reproducible enough to serve as the
  evidence gate.
- The consensus-family track has not yet fanned out the synthesized-mode wrappers,
  so landing the bl-3a88 DR first still de-risks them.

## Risks

- **Submit-CLI adoption (peer doesn't call it):** Description: the mechanism only
  helps if the prompt reliably drives the peer to submit.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** DR defines explicit no-submission behavior + fallback;
    dogfood evidence required to prove prompt-driven adoption before adoption.
- **bl-3291 silent semantic drift:** Description: a "fix" accidentally restores
  retry-all or changes the confirmed default.
  - **Likelihood:** Low
  - **Impact:** Medium
  - **Mitigation Ideas:** Contract-locking tests for unknown→terminal; treat any
    default change as out-of-scope.
- **Speculative signatures cause false transient retries:** Description: broad
  patterns retry genuinely terminal failures.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Evidence-backed signatures only; tests per adapter.
- **Audit fields leak stderr:** Description: recording classification basis leaks
  redacted provider stderr.
  - **Likelihood:** Low
  - **Impact:** High
  - **Mitigation Ideas:** Reuse existing redaction; assert no-leak in tests.

## Next Steps

Use this discovery artifact to drive the next workflow step:

- **Spec-driven mode:** continue to `oat-project-design` (which confirms
  requirements and produces both `spec.md` and `design.md`).
- **Spec-driven mode → formalize-only:** use `oat-project-spec` standalone
  if you want a formalized requirements artifact but aren't ready to
  design yet.
- **Quick mode → straight to plan:** proceed directly to `plan.md` when
  scope is clear and no architecture decisions remain.
- **Quick mode → optional lightweight design:** produce a focused
  `design.md` (architecture, components, data flow, testing) before
  planning. Choose this when discovery surfaced architecture choices
  or component boundaries.
- **Quick mode → promote:** escalate to spec-driven if discovery revealed
  the scope is larger or more complex than expected.
