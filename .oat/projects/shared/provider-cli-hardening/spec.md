---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-06-21
oat_generated: false
oat_template: false
---

# Specification: provider-cli-hardening

## Phase Guardrails (Specification)

Specification is for requirements and acceptance criteria, not design/implementation details.

- Avoid concrete deliverables (specific scripts, file paths, function names).
- Keep the “High-Level Design” section to architecture shape and component boundaries only.
- If a design detail comes up, record it under **Open Questions** for `oat-project-design`.

## Problem Statement

The owned `consensus` provider CLI (`src/consensus/provider-cli/`, shipped by
`bl-bb7e` / DR-023) is the reliability boundary for invoking AI peers
(Claude/Codex/Cursor) and returning schema-valid structured verdicts to the
deterministic consensus engine. Two reliability weaknesses remain on that
boundary, both surfaced by the 2026-06-13 iteration-modes dogfood.

First, **structured-output capture is structurally fragile**. The CLI obtains a
verdict by asking the peer to *end its turn* with a JSON message matching a
per-mode schema, then parsing and locally validating that final message and
re-prompting from outside the turn on failure. In the dogfood this failed two
ways: a peer "finished without a structured-output message" (no JSON at all), and
Codex/OpenAI strict-output rejected the schema. "Get the model to end its message
with valid JSON" is prompt-and-parse-and-retry, not a hard contract. This is
`bl-3a88`: give the peer an explicit, validated **verdict submission** action that
validates in-context and returns a correctable error the agent self-corrects
*inside its own turn*.

Second, **provider-exit retry classification needs hardening** (`bl-3291`). A
prior reading assumed retries were "retry-all except a terminal set." Direct
source inspection at HEAD shows the transient-vs-terminal classifier already
shipped (in `92a2711`, the same commit as the CLI): rate-limit/429/transient
signatures retry, auth/unsupported/unavailable stop, and an **unmatched exit
already falls through as terminal (no retry)**. So `bl-3291` is *not* "add
classification" — it is **confirm the shipped terminal-default contract and finish
the real hardening gaps** (a defect where transient retries contaminate the next
prompt, evidence-backed per-adapter signatures, signal/interruption
classification, distinctly recorded redacted audit basis, and contract-locking
tests). The backlog item's "additive / keep unknown retrying" wording is recorded
as drift, not implemented — restoring retry-all would *reverse* the shipped
fail-fast behavior.

This is **hardening, not build-vs-buy** — peer-invocation ownership is closed
(DR-023). The `bl-3a88` decision is **design-first** and durable: it must land as a
decision record before the parallel consensus-family synthesized-mode wrappers
(`bl-b9b9`/`bl-87ef`/`bl-0cb8`) fan out, because a reliable verdict contract
de-risks them.

## Goals

### Primary Goals

- **(bl-3a88)** Land a durable **decision record** selecting a verdict-submission
  mechanism (submit-CLI primary; MCP a documented rejected alternative), with
  deterministic capture, defined no-submission behavior, and dogfood evidence —
  then **build** it.
- **(bl-3a88)** Demonstrate a reliability improvement over the current
  `--output-schema`/final-message path on the two 2026-06-13 failure classes.
- **(bl-3291)** Confirm and lock the shipped terminal-default retry contract and
  close the real hardening gaps without regressing it.
- Keep the consensus engine deterministic and the artifact-as-audit-trail intact;
  keep the shipped runtime dependency-free.
- Record the `bl-3a88` decision and **flag the consensus-family track** when it
  lands.

### Secondary Goals

- Reduce wrapper-level retry churn by moving validation + self-correction inside
  the peer's own turn.
- Improve diagnostics so audit records make the classification basis explicit
  without leaking provider stderr.

## Non-Goals

- Reopening peer-invocation **ownership** (build-vs-buy) — closed by DR-023.
- **Restoring retry-all** semantics for unknown provider exits (rejected absent
  evidence that fail-fast harms real runs).
- Building an **MCP server** surface for verdict submission.
- **Speculative** transient signatures without provider evidence.
- Changes to the consensus-family lane (`src/consensus/core/` deliberation logic)
  beyond the minimal seam needed to consume a submitted verdict.
- **Backoff/jitter** between transient retries (adds wall-clock nondeterminism;
  deferred).

## Requirements

### Functional Requirements

**FR1: Verdict submission mechanism (submit-CLI)**

- **Description:** Provide an explicit action a sandboxed peer invokes to submit
  its verdict for the active mode, implemented as a subcommand of the owned CLI
  (submit-CLI). The peer runs it during its turn instead of relying solely on
  final-message JSON.
- **Acceptance Criteria:**
  - A submit action accepts a verdict payload (inline and/or file/stdin) and the
    target mode/schema context for the run.
  - It is usable by Claude, Codex, and Cursor peers within their sandbox/permission
    posture.
  - The shipped runtime gains no install-time dependency; the submit action is an
    invocation of the owned CLI.
- **Priority:** P0

**FR2: In-context validation and self-correction**

- **Description:** The submit action validates the payload against the per-mode
  schema and returns an actionable, in-context error on failure so the peer can
  self-correct within the same turn.
- **Acceptance Criteria:**
  - Invalid submissions return a non-success result whose message identifies the
    specific schema problem (missing field, wrong type, etc.).
  - The error surfaces in the peer's own tool/command output (not only the
    orchestrator log), enabling in-turn retry.
  - A valid submission is accepted exactly once with deterministic semantics for
    repeated submissions.
- **Priority:** P0

**FR3: Deterministic verdict capture into the audit trail**

- **Description:** The orchestrator captures a submitted verdict deterministically
  after the peer turn and records it in the existing run envelope/audit trail,
  without the engine interactively conversing with the peer's tool calls.
- **Acceptance Criteria:**
  - A submitted verdict is captured via a run-bound durable artifact read after the
    turn and surfaced through the existing `ConsensusCliRunEnvelope` contract
    (`json` + diagnostics) unchanged for the core loop.
  - The audit trail (`raw_provider_response` / diagnostics) reflects that a
    submission path produced the verdict.
  - Capture is deterministic and reproducible (no reliance on timing/race).
- **Priority:** P0

**FR4: Defined no-submission behavior**

- **Description:** Define and implement what happens when a peer ends its turn
  without a valid submission.
- **Acceptance Criteria:**
  - The decision record selects and justifies one behavior among: terminal
    "missing submission" failure, one bounded retry with clearer instructions, or
    fallback to the existing parse path (or a justified combination).
  - The chosen behavior is implemented with a distinct, recorded terminal/attempt
    reason and is covered by tests.
- **Priority:** P0

**FR5: Reliability evidence vs. the prior path**

- **Description:** Demonstrate that the submission mechanism converts the two
  2026-06-13 failure classes to self-corrected success.
- **Acceptance Criteria:**
  - Deterministic fixtures reproduce (a) "finished without a structured-output
    message" and (b) Codex/OpenAI strict-output rejection, and show failure →
    self-corrected success under the new mechanism.
  - At least one live-provider E2E confirms prompt-driven submission on a real CLI.
- **Priority:** P0

**FR6: Confirm the shipped terminal-default retry contract**

- **Description:** Lock the existing behavior whereby an unmatched nonzero
  `PROVIDER_EXIT` is terminal (no retry); do not restore retry-all.
- **Acceptance Criteria:**
  - Unknown/unmatched exits remain terminal with the existing terminal reason.
  - No change broadens or narrows transient/terminal classification except the
    evidence-backed additions in FR8/FR9.
- **Priority:** P0

**FR7: Fix transient-retry prompt contamination**

- **Description:** Separate the transient process-exit retry path from the
  schema-validation-feedback path so provider-exit messages are not injected into
  the next prompt as "Schema validation failed: …".
- **Acceptance Criteria:**
  - A transient `PROVIDER_EXIT` retry re-invokes the provider without mutating the
    prompt with schema-validation feedback.
  - Schema-validation retries are unaffected (still re-prompt with feedback).
- **Priority:** P0

**FR8: Evidence-backed per-adapter transient signatures**

- **Description:** Allow per-adapter transient signatures beyond the shared common
  set, added only where real provider evidence exists.
- **Acceptance Criteria:**
  - At least one provider-specific transient signature is added where evidence
    supports it, or the absence of evidence is recorded explicitly.
  - No speculative/broad patterns are added; each signature cites its evidence.
- **Priority:** P1

**FR9: Signal/interruption classification (where reliable)**

- **Description:** Classify signal-terminated/interrupted runs as transient only
  where the runtime exposes a reliable indicator and it is not the CLI's own
  timeout/cap termination.
- **Acceptance Criteria:**
  - An externally-interrupted run with a reliable signal indicator is classified
    transient; the CLI's own timeout/output-cap terminations remain terminal as
    today.
  - Ambiguous cases default to the confirmed terminal behavior.
- **Priority:** P1

**FR10: Redacted audit recording of the classification basis**

- **Description:** Record which classification fired (transient / terminal /
  unknown) distinctly in diagnostics/attempt summary, preserving stderr redaction.
- **Acceptance Criteria:**
  - The fired classification is recoverable from the envelope without inspecting
    raw stderr.
  - No provider stderr is leaked beyond existing redaction rules (asserted by a
    no-leak test).
- **Priority:** P0

**FR11: Contract-locking tests**

- **Description:** Tests lock the confirmed retry contract and the new behaviors.
- **Acceptance Criteria:**
  - Per adapter that gains a signature: transient → retry within budget; terminal →
    stop early; unknown → terminal (confirmed default).
  - Prompt-contamination regression test; redaction no-leak test.
- **Priority:** P0

**FR12: Decision record + family-track flag**

- **Description:** Record the `bl-3a88` design as a durable decision and flag the
  consensus-family track when the decision lands.
- **Acceptance Criteria:**
  - A decision record entry captures mechanism, rejected alternative (MCP),
    capture, no-submission behavior, and evidence.
  - The family track is notified that the verdict contract is decided.
- **Priority:** P0

### Non-Functional Requirements

**NFR1: Dependency-free shipped runtime**

- **Description:** Shipped skills/runtime install with no dependencies; provider
  CLI subprocesses are the only external execution boundary.
- **Acceptance Criteria:** No runtime dependency is added; the submit mechanism is
  an invocation of the owned CLI (this is the load-bearing reason MCP is rejected).
- **Priority:** P0

**NFR2: Engine determinism + audit-trail integrity**

- **Description:** The consensus engine stays deterministic and the
  artifact-as-audit-trail contract is preserved.
- **Acceptance Criteria:** Verdict capture happens via a durable artifact read
  after the turn; the `ConsensusCliRunEnvelope` contract to the core loop is
  unchanged; existing core-loop behavior/tests pass unmodified.
- **Priority:** P0

**NFR3: Redaction preserved**

- **Description:** New diagnostics/audit fields honor existing stderr redaction.
- **Acceptance Criteria:** A no-leak test asserts new fields never expose redacted
  stderr.
- **Priority:** P0

**NFR4: Generated-output discipline**

- **Description:** Edit canonical TypeScript; regenerate committed `.mjs`; never
  hand-edit `// GENERATED` outputs.
- **Acceptance Criteria:** `pnpm run build:check` is clean; no `// GENERATED` file
  is hand-edited.
- **Priority:** P0

**NFR5: Gates green**

- **Description:** All repo gates pass.
- **Acceptance Criteria:** `build:check`, `type-check`, `test`, `validate`, `smoke`
  all pass.
- **Priority:** P0

## Constraints

- Canonical source is TypeScript under `src/consensus/provider-cli/`; runtime
  `.mjs` is generated by `pnpm run build` (never hand-edit `// GENERATED`).
- Shipped runtime is dependency-free; provider subprocesses are the only external
  execution boundary.
- Tests use Vitest (`.test.ts`) with subprocess dependency-injection
  (`runSubprocess`); temp-git tests must scrub `GIT_DIR`/`GIT_*` to avoid
  corrupting the real repo under hooks.
- bl-3291 must not regress the confirmed terminal-default contract.
- Conventions: camelCase functions, snake_case data/payload fields, provider-neutral
  error codes (no backend-specific aliases).

## Dependencies

- Existing provider-CLI modules: `adapters.ts`, `invocation.ts`, `subprocess.ts`,
  `structured-output.ts`, `runtime-policy.ts`, `args.ts`, `commands.ts`,
  `envelope.ts`, `types.ts`.
- The core consensus loop (`src/consensus/core/consensus-loop.ts`) which spawns the
  CLI and consumes `ConsensusCliRunEnvelope.json` as the verdict.
- Per-mode verdict schemas consumed via `request.schema_path` (alternating /
  parallel / synthesis).
- Live provider CLIs (claude/codex/cursor) for E2E evidence.

## High-Level Design (Proposed)

`bl-3a88` adds a **verdict-submission seam** to the provider turn. The peer invokes
the owned CLI to submit a verdict; the submit action validates against the same
per-mode schema the run already uses and writes the verdict to a **run-bound
sidecar artifact**. The turn runner reads that artifact after the peer turn —
exactly analogous to how Codex's last-message file is already captured — and
returns it through the unchanged `ConsensusCliRunEnvelope`. This keeps the core
loop and audit trail untouched while making the verdict a submitted, validated
contract rather than parsed final-message prose. The existing prompt+parse path
remains the baseline and a candidate fallback; the chosen no-submission behavior is
a decision-record output.

`bl-3291` is a contained hardening of the existing classifier and retry loop:
confirm the terminal-default for unknown exits, decouple transient-exit retry from
schema-validation feedback, allow evidence-backed per-adapter signatures, classify
reliable interruption signals, and record the fired classification in redacted
diagnostics — all locked by tests.

**Key Components:**

- **Verdict-submission action** — a new owned-CLI subcommand the peer runs to submit
  a validated verdict.
- **Run-bound capture** — a sidecar artifact + run binding the turn runner reads
  after the peer turn.
- **Turn runner integration** — capture/validation/no-submission handling folded
  into the existing structured-output turn flow without changing the envelope.
- **Retry classifier hardening** — adapter-owned transient/terminal classification
  with decoupled retry feedback and recorded basis.

**Alternatives Considered:**

- **MCP submit-tool** — rejected for this repo: adds a server/config boundary that
  cuts against the dependency-free / single-subprocess-boundary contract, with
  uneven provider MCP support and more complex deterministic capture.
- **Restore retry-all for unknown exits** — rejected: reverses shipped fail-fast
  behavior; only revisit with evidence.

_Design-related open questions are tracked in the [Open Questions](#open-questions) section below._

## Success Metrics

- Both 2026-06-13 failure classes convert from failure to self-corrected success in
  deterministic fixtures, plus ≥1 live-provider E2E success.
- Zero regression on the confirmed terminal-default contract (locked by tests).
- No new runtime dependency; `build:check`/`type-check`/`test`/`validate`/`smoke`
  all green.
- No stderr leakage in new audit fields (no-leak test passes).
- `bl-3a88` decision recorded and family track flagged.

## Requirement Index

| ID   | Description                                              | Priority | Verification                          | Planned Tasks                      |
| ---- | ------------------------------------------------------- | -------- | ------------------------------------- | ---------------------------------- |
| FR1  | Verdict-submission action (submit-CLI)                  | P0       | unit + integration: submit subcommand | TBD - see plan.md                  |
| FR2  | In-context validation + self-correction                | P0       | unit: schema-error messages; integration: in-turn retry | TBD - see plan.md |
| FR3  | Deterministic capture into envelope/audit trail         | P0       | integration: sidecar capture → envelope.json | TBD - see plan.md          |
| FR4  | Defined no-submission behavior                          | P0       | unit + integration: no-submission path | TBD - see plan.md                 |
| FR5  | Reliability evidence vs. prior path                     | P0       | integration (fixtures) + e2e (live)   | TBD - see plan.md                  |
| FR6  | Confirm terminal-default retry contract                 | P0       | unit: unknown-exit → terminal         | TBD - see plan.md                  |
| FR7  | Fix transient-retry prompt contamination                | P0       | unit: transient retry prompt unchanged | TBD - see plan.md                 |
| FR8  | Evidence-backed per-adapter transient signatures        | P1       | unit: per-adapter signature           | TBD - see plan.md                  |
| FR9  | Signal/interruption classification (reliable)           | P1       | unit: signal → transient; timeout → terminal | TBD - see plan.md           |
| FR10 | Redacted audit recording of classification basis        | P0       | unit: basis recorded; no-leak assertion | TBD - see plan.md               |
| FR11 | Contract-locking tests                                  | P0       | unit + integration: per-adapter matrix | TBD - see plan.md                 |
| FR12 | Decision record + family-track flag                     | P0       | manual: DR entry + family flag        | TBD - see plan.md                  |
| NFR1 | Dependency-free shipped runtime                         | P0       | static: no new dep; integration: smoke | TBD - see plan.md                 |
| NFR2 | Engine determinism + audit integrity                    | P0       | integration: envelope contract unchanged | TBD - see plan.md              |
| NFR3 | Redaction preserved                                     | P0       | unit: no-leak test                    | TBD - see plan.md                  |
| NFR4 | Generated-output discipline                             | P0       | static: build:check clean             | TBD - see plan.md                  |
| NFR5 | Gates green                                             | P0       | integration: all gates               | TBD - see plan.md                  |

**Notes:**

- ID: FR# functional, NFR# non-functional.
- Verification: `method: pointer` (method ∈ unit/integration/e2e/manual/perf).

## Open Questions

_(For design — resolved in design.md / the DR.)_

- **No-submission behavior:** terminal `missing_submission` vs one bounded retry vs
  parse-path fallback — the DR must choose and justify.
- **Run→capture binding:** how a submit invocation is bound to its run + sidecar
  path (env var vs arg) and single-submission/last-write-wins semantics.
- **Sandbox/permission posture:** what each provider needs to permit the peer to run
  the submit subcommand (codex `--sandbox`, claude `--permission-mode`), and how the
  capture path is allowlisted in the child environment.
- **Per-adapter signature evidence:** which providers actually have documented/
  observed transient signatures distinct from the common set.
- **Signal-evidence reliability:** whether a non-null `signal` reliably indicates an
  external interruption vs. the CLI's own timeout SIGTERM path.
- **Evidence medium split:** deterministic fixtures gate the decision; live E2E at
  build (to confirm).

## Assumptions

- The shipped terminal-default for unknown exits is acceptable product behavior (no
  current evidence it harms real runs).
- Peers (claude/codex/cursor) can each invoke a local subcommand within their
  sandbox/permission posture.
- The 2026-06-13 failure classes are reproducible enough to serve as the evidence
  gate.
- The consensus-family synthesized-mode wrappers have not yet fanned out, so landing
  the DR first still de-risks them.

## Risks

- **Submit-CLI adoption (peer doesn't call it):**
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** DR defines explicit no-submission behavior + fallback; dogfood
    evidence required to prove prompt-driven adoption before adoption.
- **bl-3291 silent semantic drift (accidental retry-all restoration):**
  - **Likelihood:** Low
  - **Impact:** Medium
  - **Mitigation:** Contract-locking tests for unknown → terminal; treat any default
    change as out-of-scope.
- **Speculative signatures cause false transient retries:**
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation:** Evidence-backed signatures only; per-adapter tests.
- **Audit fields leak stderr:**
  - **Likelihood:** Low
  - **Impact:** High
  - **Mitigation:** Reuse existing redaction; no-leak test.

## References

- Discovery: `discovery.md`
- Knowledge Base: `.oat/repo/knowledge/project-index.md`
- Backlog: `bl-3a88` (tool-based verdict submission), `bl-3291` (provider-exit retry
  classification); priority-alignment Phase 3.
- Prior design: `consensus-peer-invocation` (DR-023, FR10 Cursor submit-tool spike).
