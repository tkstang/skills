---
oat_status: complete
oat_ready_for: oat-project-plan
oat_blockers: []
oat_last_updated: 2026-06-21
oat_generated: false
oat_template: false
---

# Design: provider-cli-hardening

## Overview

This project hardens the owned `consensus` provider CLI
(`src/consensus/provider-cli/`) along two reliability seams, run as one project on
a shared surface that is disjoint from the consensus-family lane.

**bl-3a88 (design-first, then build):** add a **verdict-submission seam** to the
provider turn. Instead of relying only on the peer ending its turn with
schema-valid final-message JSON, the peer invokes a new owned-CLI subcommand
(`consensus submit`) to submit a validated verdict. The submit action validates
against the same per-mode schema the run already uses and writes the verdict to a
**run-bound sidecar file**; the turn runner reads that file after the peer turn —
exactly analogous to how Codex's `--output-last-message` file is already captured
(`invocation.ts:97`, `subprocess.ts:284`) — and returns it through the unchanged
`ConsensusCliRunEnvelope`. The core loop (`consensus-loop.ts`, which spawns
`consensus run` and consumes `envelope.json`) is untouched, preserving engine
determinism and the artifact-as-audit-trail contract. The reaffirmed direction
(discovery + user direction this session): **submit-CLI primary; MCP a documented
rejected alternative; prompt+parse retained as the no-submission fallback.** See
[Design Decision DR-bl3a88](#design-decision-dr-bl3a88--verdict-submission-mechanism).

**bl-3291 (additive hardening of a shipped classifier):** direct source inspection
at HEAD shows the transient/terminal classifier already shipped in `92a2711`
(`adapters.ts` + `structured-output.ts`), and an *unmatched* `PROVIDER_EXIT`
already falls through as terminal (no retry). So this is **confirm the shipped
terminal-default contract and close real gaps**, not "add classification" and not
restoring retry-all. Gaps: decouple transient-exit retry from the
schema-validation-feedback prompt path, allow evidence-backed per-adapter
signatures, classify reliable interruption signals, and record the fired
classification in redacted diagnostics — all locked by tests.

Key architectural decision: the submission seam changes *only how `runProviderTurn`
captures the verdict* (a new preferred output source), so the envelope contract to
the core loop is byte-for-byte unchanged. Everything else is additive.

## Architecture

### System Context

The provider CLI sits between the deterministic consensus engine and external
provider CLIs. There are already **two subprocess layers**; bl-3a88 adds a third,
peer-initiated, capture-only invocation:

- **Layer 1 — engine → CLI:** `consensus-loop.ts` spawns `consensus run …`
  (`consensus-loop.ts:1288`), reads the `ConsensusCliRunEnvelope` from stdout
  (`:1376`), and uses `envelope.json` as the verdict (`:1387`) + records
  `raw_provider_response` (`:1388`).
- **Layer 2 — CLI → provider:** `runProviderTurn` (`structured-output.ts`) builds
  an invocation and spawns the provider (`claude`/`codex`/`cursor-agent`) via
  `runProviderSubprocess` (`subprocess.ts`), then extracts/parses/validates the
  output and retries within `max_attempts`.
- **Layer 3 (new, bl-3a88) — peer → submit:** during its turn the peer invokes
  `consensus submit …`, a capture-only subcommand that validates the verdict and
  writes it to a run-bound sidecar file. It does **not** spawn any provider, so it
  does not interact with the recursion guard.

This change is confined to Layer 2 (turn runner + adapters + a new submit command);
Layer 1 is unchanged.

**Key Components:**

- **`consensus submit` subcommand:** the peer-facing verdict-submission action;
  validates against the per-mode schema and writes the run-bound sidecar.
- **Run-bound capture:** a per-run sidecar file path + schema reference injected
  into the provider child environment; read by the turn runner after the turn.
- **Turn-runner integration:** sidecar becomes the *preferred* verdict source in
  the existing structured-output flow; falls back to the current parse path when
  absent.
- **Retry classifier hardening (bl-3291):** `adapters.ts` classifier +
  `structured-output.ts` retry loop changes — decoupled transient feedback,
  per-adapter signatures, signal classification, recorded basis.

### Component Diagram

```
 consensus engine (core/consensus-loop.ts)            [Layer 1 — unchanged]
        │ spawn: consensus run --provider … --schema … --json
        ▼
 provider CLI turn runner (structured-output.ts)      [Layer 2]
        │ inject child env: CONSENSUS_SUBMIT_FILE, CONSENSUS_SUBMIT_SCHEMA
        │ spawn provider (claude|codex|cursor-agent)   (subprocess.ts)
        ▼
 ┌──────────────── provider peer turn ────────────────┐
 │  agent reasons, then runs:                          │   [Layer 3 — new]
 │     consensus submit --json -   (verdict on stdin)  │
 │        │ validate vs CONSENSUS_SUBMIT_SCHEMA        │
 │        │  ok → write CONSENSUS_SUBMIT_FILE, exit 0  │
 │        │  bad → print schema error to stderr,exit≠0 │ ── agent self-corrects
 │  (agent may also end turn with final-message JSON)  │     in-turn, resubmits
 └─────────────────────────────────────────────────────┘
        │ turn ends
        ▼
 capture resolution (preferred → fallback):
   1) sidecar present + schema-valid  → use as verdict     (submit path)
   2) else existing extract/parse/validate of final msg    (parse fallback)
   3) else schema-validation retry within max_attempts
   4) else terminal (missing_provider_output / schema_validation)
        │
        ▼
 ConsensusCliRunEnvelope { json, attempts, diagnostics }   [contract UNCHANGED]
```

### Data Flow

**bl-3a88 happy path (submission):** engine spawns `consensus run` → turn runner
generates a run-bound sidecar path + injects `CONSENSUS_SUBMIT_FILE` /
`CONSENSUS_SUBMIT_SCHEMA` into the child env → provider peer runs → peer calls
`consensus submit --json -` with its verdict → submit validates against the schema,
writes the sidecar, exits 0 → turn ends → turn runner reads the sidecar, finds a
valid verdict, returns it as `envelope.json`. Diagnostics record `verdict_source:
submit`.

**bl-3a88 self-correction:** peer's first `consensus submit` fails validation (e.g.
missing field) → submit prints the specific error to stderr and exits nonzero → the
peer sees the error in its own command output → peer fixes and resubmits within the
same turn → sidecar ends valid.

**bl-3a88 no-submission fallback:** peer ends its turn without a valid sidecar →
turn runner falls back to the existing parse path on the final message (today's
behavior, no regression). If that also yields nothing usable, the existing
`missing_provider_output` / `schema_validation` retry+terminal logic applies.

**bl-3291 retry path:** provider exits nonzero → `adapter.classifyRunFailure`
classifies transient/terminal/unknown → transient re-invokes the provider **without
mutating the prompt** (decoupled from schema-validation feedback); terminal/unknown
stop with the recorded basis.

## Component Design

### Design Decision DR-bl3a88 — Verdict-submission mechanism

> Promote to `decision-record.md` as the next `DR-NNN` at project completion
> (FR12). Captured here so design review approves the durable decision.

**Context.** The provider turn obtains a verdict by asking the peer to end its turn
with schema-valid final-message JSON, then parsing + locally validating and
re-prompting from *outside* the turn. The 2026-06-13 dogfood hit two failure
classes: (a) the synthesizer "finished without a structured-output message," and
(b) Codex/OpenAI strict-output rejected the schema. This is prompt-and-parse, not a
contract.

**Decision.** Add a **submit-CLI** seam: a new `consensus submit` subcommand the
sandboxed peer invokes mid-turn to submit a verdict that is validated against the
per-mode schema in-context, captured via a **run-bound sidecar file**, and read by
the turn runner after the turn. The submitted verdict is surfaced through the
existing `ConsensusCliRunEnvelope` unchanged.

**Why submit-CLI over MCP (rejected alternative).**

- **Dependency-free contract (load-bearing):** the submit action is another
  invocation of the *owned* CLI; an MCP tool requires standing up a server/transport
  surface, which cuts against "shipped runtime dependency-free; provider subprocess
  is the only external execution boundary" (NFR1).
- **Uniformity:** all three providers (claude/codex/cursor) can run a shell
  subcommand; Cursor has neither a schema flag nor a tool surface we control, and
  provider MCP support is uneven.
- **Determinism + audit:** a sidecar read *after* the turn reuses the proven
  `last_message_file` capture pattern and keeps the engine from interactively
  conversing with tool calls.
- MCP remains legitimate in general; here it adds a server/config boundary without
  enough added reliability to justify the complexity.

**No-submission behavior (FR4) — decided.** Default = **prefer-submit, fall back to
the existing parse path, terminal only if both are absent.** Rationale: this makes
the submit seam *strictly additive* — when the peer submits, we get a hard
contract; when it doesn't, we are no worse than today. The sidecar is simply the
first verdict source checked; absence degrades to current behavior, so there is no
new failure mode in the common case and no extra latency/bounded-retry that would
add wall-clock nondeterminism. A stricter **require-submission** mode (terminal
`missing_submission` when no sidecar) is specified as an opt-in for a future
tightening once adoption evidence is strong; it is **not** the default. (Rejected:
"hard terminal by default" — would regress runs where the peer answers correctly via
final message; "bounded extra retry" — adds latency/nondeterminism for marginal
gain over the parse fallback.)

**Adoption reliability (first-class).** Submit-CLI only helps if the peer calls it.
Mitigations: (1) the per-mode prompt instructs the peer to submit via
`consensus submit` and is part of the evidence gate; (2) validation errors are
returned in-context for in-turn self-correction; (3) the parse-path fallback bounds
the downside to today's behavior; (4) FR5 requires dogfood evidence that the prompt
*reliably drives* submission on the two flaky classes before we rely on it.

**Evidence gate (FR5).** Deterministic fixtures reproduce both 2026-06-13 failure
classes and show failure → self-corrected success under submit; plus ≥1
live-provider E2E confirming prompt-driven submission. Fixtures gate the decision;
live E2E confirms at build.

**Consequences.** De-risks the consensus-family synthesized-mode wrappers
(`bl-b9b9`/`bl-87ef`/`bl-0cb8`) by giving them a reliable verdict contract; the
family track is flagged when this lands (FR12). `submit_tool_candidate` (already
reserved in `STRUCTURED_OUTPUT_STRATEGIES`) and `supports_submit_tool` become live
for adapters that opt in.

### Component: `consensus submit` subcommand

**Purpose:** peer-facing, capture-only verdict submission.

**Responsibilities:**

- Read a verdict payload from stdin (`--json -`) or `--verdict-file <path>`.
- Resolve the per-mode schema and capture path from the child env
  (`CONSENSUS_SUBMIT_SCHEMA`, `CONSENSUS_SUBMIT_FILE`), overridable by explicit
  flags for testing.
- Validate the payload with the existing schema-subset validator (the same one used
  in `structured-output.ts`).
- Always emit **exactly one `SubmitResult` JSON line on stdout** (success *and*
  failure), consistent with the `--json` contract of `provider ls`/`preflight`/`run`
  (`writeJson`). The human-readable confirmation/error text lives in
  `SubmitResult.message`, never as free-form stdout.
- On success: atomically write the validated verdict to the capture path; emit
  `{ ok: true, captured: true, message: "verdict captured" }`; exit 0.
- On failure: emit `{ ok: false, captured: false, message: <specific schema
  problem> }` on stdout **and mirror** the actionable schema error to **stderr**
  (so the peer self-corrects via stderr + nonzero exit); do not write/overwrite a
  prior valid capture with an invalid one.
- Never spawn a provider (no recursion-guard interaction).

**Interfaces (illustrative — camelCase fns, snake_case data):**

```typescript
// args.ts — new parsed command
export interface ParsedSubmitCommand {
  kind: 'submit';
  json: true;
  verdictSource?: PromptSource;     // stdin | file (reuse PromptSource)
  schemaPath?: string;              // default from CONSENSUS_SUBMIT_SCHEMA
  outPath?: string;                 // default from CONSENSUS_SUBMIT_FILE
}

// commands.ts — new handler
export async function runSubmit(
  command: ParsedSubmitCommand,
  io: ConsensusCliIo,
): Promise<number>;                  // 0 = captured, nonzero = validation/usage

// the single JSON line printed to stdout (machine-readable; one per invocation)
interface SubmitResult {
  schema_version: 'v1';
  ok: boolean;
  captured?: boolean;
  message: string;                  // success confirmation, or the specific schema problem on failure
}
```

**Dependencies:** `validateSchemaSubset` (extracted/shared from
`structured-output.ts`), `args.ts` parser, atomic file write helper.

**Design Decisions:** reuse the *same* schema-subset validator the turn runner uses
so submit-time and capture-time validation cannot diverge. Validation runs both in
`submit` (for in-context errors) and again at capture (defense-in-depth; the turn
runner never trusts an unvalidated sidecar).

### Component: Run-bound capture + turn-runner integration

**Purpose:** deterministically bind a submit invocation to its run and surface the
captured verdict through the unchanged envelope.

**Responsibilities:**

- Generate a per-run sidecar path (`randomUUID`, `tmpdir`) — mirror
  `codexLastMessageFile()` (`invocation.ts:191`).
- Inject `CONSENSUS_SUBMIT_FILE` and `CONSENSUS_SUBMIT_SCHEMA` into the provider
  child env via `hostEnv` (merged last in `buildChildEnvironment`,
  `runtime-policy.ts:124`), so it survives the env allowlist deterministically.
- After the provider turn, read the sidecar; if present and schema-valid, use it as
  the verdict (set `diagnostics.verdict_source = 'submit'`); else fall through to
  the existing `extractProviderOutput`/parse/validate path
  (`diagnostics.verdict_source = 'final_message'`).
- Clean up the sidecar (best-effort `rm`, like `cleanupInvocationFiles`).

**Interfaces:**

```typescript
// structured-output.ts — output source resolution gains a preferred branch
type VerdictSource = 'submit' | 'final_message';
// extractProviderOutput(): check sidecar first, then current logic
```

**Design Decisions:** capture is a post-turn file read (deterministic; no race —
the turn has fully exited before we read). Last-write-wins within a turn (a peer
that submits twice leaves the final valid payload). The envelope shape is unchanged;
only an additive `verdict_source` diagnostic is introduced.

### Component: Retry classifier hardening (bl-3291)

**Purpose:** confirm the shipped terminal-default contract and close real gaps.

**Responsibilities / changes:**

- **Confirm contract (FR6):** keep `defaultRunFailureClassifier`'s fall-through →
  `retryable: false` / `provider_exit_terminal` for unmatched exits. Lock with
  tests; do not restore retry-all.
- **Decouple transient feedback (FR7):** in `structured-output.ts` the transient
  retry branch must re-invoke **without** assigning the classifier message to
  `validationFeedback` (today line 164 sets `validationFeedback =
  classification.message`, contaminating the next prompt as "Schema validation
  failed: …"). Transient process-exit retries leave the prompt unchanged;
  schema-validation retries keep their feedback.
- **Per-adapter signatures (FR8):** allow each adapter to extend
  `transient_exit_patterns` with evidence-backed, provider-specific signatures;
  default stays the shared `COMMON_TRANSIENT_EXIT_PATTERNS`. Each added signature
  cites its evidence in a comment; absence of evidence is recorded, not guessed.
- **Signal classification (FR9):** classify an externally interrupted run (reliable
  non-null `signal` that is *not* the CLI's own timeout/output-cap SIGTERM path) as
  transient `provider_exit_interrupted`. The existing `terminal` markers
  (`timeout`, `output_cap`, `spawn_error` in `subprocess.ts`) remain terminal;
  ambiguous cases default to terminal.
- **Recorded basis (FR10):** surface the fired classification distinctly in
  diagnostics (e.g. `diagnostics.exit_classification ∈
  {transient,terminal,unknown,interrupted}`), in addition to the existing
  `terminal_reason` and the already-populated `attempts.retryable`, honoring
  redaction.

**Design Decisions:** keep all classification adapter-owned (no cross-provider
leakage); reuse existing redaction; no backoff (deferred — wall-clock
nondeterminism).

## Data Models

### Submission payload (verdict)

**Purpose:** the verdict the peer submits; identical shape to what the engine
expects today as `envelope.json` for the active mode.

**Schema:** the existing per-mode verdict schema referenced by `request.schema_path`
(verdict-alternating / verdict-parallel / synthesis). No new verdict schema is
introduced; submit validates against the *same* file.

**Validation Rules:** schema-subset validation (`validateSchemaSubset`) — required
fields present, declared property types match. Same rules at submit-time and
capture-time.

**Storage:** transient run-bound sidecar file in `tmpdir`; deleted after capture.

### Capture/diagnostics additions

**Purpose:** make the verdict source and exit classification auditable without
changing the envelope contract.

**Schema (additive diagnostics — `types.ts ProviderDiagnostics`):**

```typescript
interface ProviderDiagnostics {
  // …existing fields…
  verdict_source?: 'submit' | 'final_message';          // bl-3a88
  exit_classification?:                                  // bl-3291
    'transient' | 'terminal' | 'unknown' | 'interrupted';
}
```

**Validation/Storage:** populated by the turn runner / classifier; serialized in the
envelope and audit record; subject to existing redaction (no stderr content).

## API Design

### `consensus submit` (CLI surface)

**Command:** `consensus submit --json [-|--verdict-file <path>] [--schema <path>] [--out <path>]`

**Inputs:**

- `--json` required (consistent with other subcommands).
- Verdict source: `-` (stdin) or `--verdict-file <path>` (exactly one; reuse the
  run command's single-source rule).
- `--schema <path>` optional; defaults to `CONSENSUS_SUBMIT_SCHEMA` env.
- `--out <path>` optional; defaults to `CONSENSUS_SUBMIT_FILE` env.

**stdout:** exactly one `SubmitResult` JSON line in all cases (machine-readable,
consistent with `provider ls`/`preflight`/`run` via `writeJson`). The success
confirmation and the failure schema-problem text both live in
`SubmitResult.message` — no free-form text on stdout, so callers/tests can always
parse it.

**stderr:** on validation failure, the same actionable schema problem is mirrored
to stderr (the peer's in-context self-correction signal), honoring redaction. On
success, stderr is empty.

**Exit codes:** `0` captured; `2` usage error (missing source/schema/out, conflicts)
consistent with `processExitForEnvelope` usage mapping; `1` validation failure
(verdict did not match schema) so the peer's shell sees a nonzero exit it can react
to.

**Child-env contract (turn runner → peer → submit):**

- `CONSENSUS_SUBMIT_FILE` — run-bound capture path (injected via `hostEnv`).
- `CONSENSUS_SUBMIT_SCHEMA` — per-mode schema path for in-context validation.

**Authorization:** none beyond the existing sandbox/permission posture; submit is
capture-only and never spawns providers.

The `run`, `provider ls`, and `preflight` surfaces are unchanged.

## Security Considerations

**Sandbox/permission posture (FR1, open-question resolved here):** the peer must be
permitted to run the submit subcommand within its provider posture. Claude runs
under `--permission-mode` (default non-interactive); Codex under `--sandbox`
(`read-only` is sufficient to *run* a command but the capture file lives in
`tmpdir` — Codex `workspace-write` or a tmpdir carve-out is required to write the
sidecar). Design choice: the submit writes to a path the runner controls
(`CONSENSUS_SUBMIT_FILE` in `tmpdir`); for sandboxes that block tmpdir writes, the
runner may place the capture path under the run `cwd`. The exact per-provider
posture is validated by the live E2E (FR5) and recorded.

**Env allowlist:** `CONSENSUS_SUBMIT_FILE`/`CONSENSUS_SUBMIT_SCHEMA` are injected via
`hostEnv` (controlled by us, merged last in `buildChildEnvironment`), not by
widening the user-facing `env_allowlist`. No secrets are added to the child env.

**Path safety:** capture path is runner-generated (`randomUUID`), not
peer-supplied in production; `--out`/`--verdict-file` are for tests. Validate that
`--out` writes only where intended; atomic write to avoid partial captures.

**Redaction (NFR3):** new diagnostics (`verdict_source`, `exit_classification`)
carry no stderr content. The submit's stderr error is the peer's own in-context
feedback and is subject to the existing `redaction.include_stderr` rules when
surfaced in diagnostics.

**Threat mitigation:** a peer cannot escalate via submit (capture-only, no provider
spawn, no recursion); a malformed/oversized verdict is rejected by schema-subset
validation and the existing output caps.

## Performance Considerations

Negligible. The submit seam adds one peer-initiated subprocess (validate + small
file write) and one post-turn file read by the runner — both cheap relative to a
provider turn. No caching, no database. The bl-3291 changes only affect *which*
failures retry; no backoff is added (deferred to avoid wall-clock nondeterminism),
so worst-case retry latency is unchanged or reduced (fewer wasteful retries).

## Error Handling

### Error categories

- **Peer/submission errors:** invalid verdict at submit → in-context stderr +
  nonzero exit → peer self-corrects in-turn. No valid sidecar at turn end → parse
  fallback (default) → existing `missing_provider_output`/`schema_validation`
  handling if the final message is also unusable.
- **Provider-exit errors (bl-3291):** classified transient (retry, prompt
  unchanged) / terminal (stop) / unknown (terminal, confirmed default) /
  interrupted (transient where reliable). `terminal_reason` + `exit_classification`
  record the basis.
- **System/usage errors:** unchanged (`CONSENSUS_CLI_USAGE` exit 2, etc.).

### Retry logic

- **Transient `PROVIDER_EXIT` / interrupted:** re-invoke the provider within
  `max_attempts`, **no prompt mutation** (FR7).
- **Schema-validation / invalid-JSON / missing-output:** re-prompt with feedback
  within `max_attempts` (today's behavior, unchanged).
- **Terminal / unknown:** stop immediately with the recorded terminal reason (FR6 —
  confirmed default).

### Logging / diagnostics

Augment diagnostics with `verdict_source` and `exit_classification`; preserve
existing redaction. No new logging surface.

## Testing Strategy

### Requirement-to-Test Mapping

| ID   | Verification                            | Key Scenarios |
| ---- | --------------------------------------- | ------------- |
| FR1  | unit + integration                      | `consensus submit` parses stdin/`--verdict-file`; resolves schema/out from env; rejects bad usage |
| FR2  | unit + integration                      | stdout is always exactly one `SubmitResult` JSON line; invalid verdict → `ok:false` JSON on stdout + schema error mirrored to stderr + nonzero exit; valid → `ok:true` captured; resubmit overwrites |
| FR3  | integration                             | sidecar present+valid → `envelope.json` equals submitted verdict; `verdict_source: submit`; envelope contract unchanged |
| FR4  | unit + integration                      | no sidecar → parse fallback (default) → today's behavior; (opt-in strict) → `missing_submission` terminal |
| FR5  | integration (fixtures) + e2e (live)     | fixture A "no structured-output message" and B "strict-output rejection" → self-corrected success via submit; ≥1 live provider submits |
| FR6  | unit                                    | unmatched `PROVIDER_EXIT` → terminal (no retry); contract locked |
| FR7  | unit                                    | transient exit retry re-invokes with **unchanged** prompt; schema-validation retry still appends feedback |
| FR8  | unit                                    | per-adapter signature classifies transient; common set still applies; no speculative patterns |
| FR9  | unit                                    | external interrupt signal → transient; CLI timeout/output-cap SIGTERM → terminal; ambiguous → terminal |
| FR10 | unit                                    | `exit_classification` recorded per branch; no stderr leakage (no-leak assertion) |
| FR11 | unit + integration                      | per-adapter matrix: transient-retry / terminal-stop / unknown-terminal |
| FR12 | manual                                  | DR promoted to decision-record; family track flagged |
| NFR1 | static + integration                    | no new runtime dependency; smoke passes |
| NFR2 | integration                             | core-loop envelope consumption unchanged; existing core tests pass |
| NFR3 | unit                                    | no-leak test on new diagnostics |
| NFR4 | static                                  | `build:check` clean; no `// GENERATED` hand-edit |
| NFR5 | integration                             | `build:check` + `type-check` + `test` + `validate` + `smoke` green |

### Unit Tests

- **Scope:** `consensus submit` arg parsing + handler; schema-subset validator
  shared use; classifier transient/terminal/unknown/interrupted branches; decoupled
  transient feedback; diagnostics recording + redaction.
- **Key cases:** the FR6–FR11 rows above. Extend existing
  `structured-output.test.ts` (`retries retryable provider exits`, `does not retry
  adapter-classified terminal provider exits`, `keeps submit-tool candidate
  reserved`) and `adapters.test.ts`. Use `fakeSubprocess([...])` DI for exit
  scenarios.

### Integration Tests

- **Scope:** end-to-end through `runProviderTurn` with a stubbed provider that
  "runs `consensus submit`" by writing the sidecar (and one that doesn't, to
  exercise fallback); envelope-contract invariance for the core loop.
- **Environment:** Vitest with subprocess DI; temp dirs for sidecars. Temp-git
  tests (if any) must scrub `GIT_DIR`/`GIT_*`.

### End-to-End Tests

- **Scope:** ≥1 live provider (claude/codex/cursor) actually invoking
  `consensus submit` on the two flaky-case prompts; confirm prompt-driven submission
  and self-correction. Gated/skippable when no live provider is available (mirror
  existing live-e2e gating).

## Deployment Strategy

Standard for this repo: edit canonical TypeScript under
`src/consensus/provider-cli/` (+ minimal `commands.ts`/`args.ts` wiring), run
`pnpm run build` to regenerate committed `.mjs`, and verify with
`pnpm run build:check`. No service deployment. **Rollback** = revert the commit(s);
the submit seam is additive and the parse-path fallback means reverting cannot
strand runs. **Configuration:** new child-env vars `CONSENSUS_SUBMIT_FILE` /
`CONSENSUS_SUBMIT_SCHEMA` (runner-managed); optional opt-in require-submission flag
(future). No feature flags required for the default prefer-submit-fallback behavior.

## Migration Plan

No data or schema migration. The change is additive and backward-compatible: the
existing prompt+parse path is the fallback, so runs that never call `consensus
submit` behave exactly as today. No breaking change to the `ConsensusCliRunEnvelope`
contract.

## Open Questions

- **Per-adapter signature evidence (FR8):** the specific provider-specific transient
  signatures to add are gathered during build from real evidence; if none exists for
  a provider, that is recorded rather than guessed.
- **Sandbox tmpdir writes (resolved 2026-06-21):** local gated live E2E confirmed
  Codex `read-only` reaches the injected `CONSENSUS_SUBMIT_COMMAND` but cannot
  write the current `tmpdir` sidecar (`EPERM` on the atomic temp file). The same
  E2E passed with Codex `workspace-write`, `approval_policy=never`, and
  `diagnostics.verdict_source: submit`. Current source of truth for the implemented
  posture is therefore: tmpdir sidecar capture is live-confirmed for Codex
  `workspace-write`; Codex `read-only` requires a future capture-path relocation
  under an allowed cwd/workspace path before it can be claimed.
- **Live E2E provider availability:** which provider(s) are available in CI vs.
  local for the FR5 live confirmation; E2E is gated/skippable accordingly.

## Implementation Phases

### Phase 1: bl-3291 hardening (independent, low-risk — lands first)

**Goal:** confirm the terminal-default contract and close the retry gaps.

**Tasks:**

- Decouple transient-exit retry from schema-validation feedback (FR7).
- Add `exit_classification` diagnostic + recorded basis with redaction (FR10).
- Signal/interruption classification where reliable (FR9).
- Evidence-backed per-adapter signature hooks (FR8) — add where evidence exists.
- Contract-locking tests: transient-retry / terminal-stop / unknown-terminal,
  prompt-contamination regression, no-leak (FR6, FR11).

**Verification:** unit suite green; `build:check`/`type-check` clean; no envelope
change.

### Phase 2: bl-3a88 submission mechanism (build)

**Goal:** ship the `consensus submit` seam with deterministic capture.

**Tasks:**

- Extract/share `validateSchemaSubset`; add `consensus submit` parse + handler
  (FR1, FR2).
- Run-bound capture: generate sidecar path, inject child env, post-turn read +
  preferred-source resolution + `verdict_source` diagnostic + cleanup (FR3).
- No-submission default (prefer-submit → parse fallback → terminal-if-both-absent),
  plus the opt-in strict mode wiring (FR4).
- Unit + integration tests incl. envelope-contract invariance (NFR2).

**Verification:** unit + integration green; core-loop tests pass unmodified; smoke
green.

### Phase 3: evidence, E2E, and decision promotion

**Goal:** prove the reliability improvement and record the decision.

**Tasks:**

- Deterministic fixtures for the two 2026-06-13 failure classes → self-corrected
  success (FR5).
- ≥1 live-provider E2E confirming prompt-driven submission (FR5); record
  sandbox/tmpdir findings.
- Promote DR-bl3a88 to `decision-record.md`; flag the consensus-family track
  (FR12); update backlog items + repo reference.

**Verification:** all gates green; evidence captured; DR + family flag done.

## Dependencies

### Internal Dependencies

- `structured-output.ts` (turn runner — primary integration point), `adapters.ts`
  (classifier), `subprocess.ts` (signal/terminal markers), `args.ts` / `commands.ts`
  (submit subcommand), `runtime-policy.ts` (child env), `invocation.ts` (sidecar
  pattern), `types.ts` / `envelope.ts` (additive diagnostics).
- `core/consensus-loop.ts` — consumer; must remain unchanged (NFR2).

### External Dependencies

- Live provider CLIs (claude/codex/cursor) for FR5 E2E only; none added to the
  shipped runtime (NFR1).

### Development Dependencies

- Vitest; existing build/validate/smoke tooling.

## Risks and Mitigation

- **Submit-CLI adoption (peer doesn't call it):** Medium | High
  - **Mitigation:** prefer-submit-with-parse-fallback bounds downside to today;
    in-context errors; FR5 adoption evidence required before reliance.
  - **Contingency:** keep parse path as default fallback; only enable strict mode
    after strong evidence.
- **Sandbox blocks sidecar write:** Medium | Medium
  - **Mitigation:** capture path under runner control (tmpdir or `cwd`); validated
    by live E2E per provider.
  - **Contingency:** fall back to parse path (no regression); document posture.
- **bl-3291 silent semantic drift (retry-all restoration):** Low | Medium
  - **Mitigation:** contract-locking unknown→terminal tests; drift treated as
    out-of-scope.
  - **Contingency:** revert offending change.
- **Speculative signatures cause false transient retries:** Medium | Medium
  - **Mitigation:** evidence-backed signatures only; per-adapter tests.
  - **Contingency:** remove the signature; fall back to common set.
- **Audit fields leak stderr:** Low | High
  - **Mitigation:** reuse existing redaction; no-leak test.
  - **Contingency:** strip field; patch redaction.

## References

- Specification: `spec.md`
- Discovery: `discovery.md`
- Knowledge Base: `.oat/repo/knowledge/project-index.md`
- Conventions: `.oat/repo/knowledge/conventions.md`
- Prior design: `consensus-peer-invocation` (DR-023; FR10 Cursor submit-tool spike)
- Backlog: `bl-3a88`, `bl-3291`; priority-alignment Phase 3
