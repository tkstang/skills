---
oat_status: complete
oat_ready_for: oat-project-implement
oat_blockers: []
oat_last_updated: 2026-06-21
oat_phase: plan
oat_phase_status: complete
oat_plan_hill_phases: ["p03"] # phases to pause AFTER completing; workflow.hillCheckpointDefault=final
oat_auto_review_at_hill_checkpoints: true # workflow.autoReviewAtHillCheckpoints=true
oat_plan_parallel_groups: [] # groups of phases that run concurrently in worktrees; [] = fully sequential
oat_plan_source: spec-driven # spec-driven | quick | imported
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_generated: false
---

# Implementation Plan: provider-cli-hardening

> Execute this plan using `oat-project-implement` — sequential by default, parallel when `oat_plan_parallel_groups` is declared.

**Goal:** Harden the owned `consensus` provider CLI on two seams — add a validated
verdict-submission mechanism (bl-3a88, submit-CLI) and finish the provider-exit
retry-classification gaps while confirming the shipped terminal-default contract
(bl-3291) — keeping the engine deterministic, the envelope/audit contract
unchanged, and the runtime dependency-free.

**Architecture:** A new `consensus submit` subcommand the sandboxed peer invokes
mid-turn writes a validated verdict to a run-bound sidecar file; the turn runner
reads it post-turn as the preferred verdict source and returns it through the
**unchanged** `ConsensusCliRunEnvelope`. bl-3291 hardens the existing
adapter-owned classifier + retry loop in place.

**Tech Stack:** TypeScript (canonical `src/`), generated `.mjs` runtime via
`pnpm run build`, Vitest (`.test.ts`) with `runSubprocess` dependency injection,
Node ≥22 stdlib only (no runtime deps).

**Commit Convention:** `{type}({scope}): {description}` — e.g.,
`fix(p01-t02): decouple transient-exit retry from validation feedback`.

## Planning Checklist

- [x] Defer HiLL checkpoint confirmation to oat-project-implement
- [x] Evaluated phases for parallelism opportunities (p01/p02 share
      `structured-output.ts` + `types.ts`; p03 depends on both → fully sequential)
- [x] Set `oat_plan_parallel_groups` in frontmatter (`[]`)

---

## Parallelism

Phases are **not** file-disjoint: p01 (bl-3291) and p02 (bl-3a88) both modify
`structured-output.ts` and `types.ts`; p03 depends on p01+p02. Fully sequential
(`oat_plan_parallel_groups: []`).

---

## Dispatch Profile

_No per-phase overrides. Runtime selection chooses tiers within the resolved
dispatch ceiling._

---

## Phase 1: bl-3291 — retry-classification hardening (confirm contract + fill gaps)

Independent, low-risk, additive to the shipped classifier. Lands first.

### Task p01-t01: Lock the confirmed terminal-default contract (FR6)

**Files:**

- Modify: `tests/consensus/provider-cli/adapters.test.ts`
- Modify: `tests/consensus/provider-cli/structured-output.test.ts`

**Step 1: Write test (RED→GREEN, contract-lock)**

Lock existing behavior so future edits cannot silently restore retry-all.

```typescript
// adapters.test.ts — classifier fall-through
it('classifies an unmatched provider exit as terminal (no retry)', () => {
  // classifyRunFailure({ code:'PROVIDER_EXIT', stdout:'', stderr:'boom', ... })
  //   → { retryable:false, terminal_reason:'provider_exit_terminal' }
});
// structured-output.test.ts — loop honors it
it('does not retry an unknown-signature provider exit within max_attempts', () => {
  // runProviderTurn with max_attempts:3 + fakeSubprocess unknown exit → cli_attempts:1
});
```

Run: `pnpm exec vitest run tests/consensus/provider-cli/adapters.test.ts tests/consensus/provider-cli/structured-output.test.ts`
Expected: Passes against current source (locks the contract).

**Step 2: Implement (GREEN)** — none; this task only adds lock tests. Confirm no
source change is required.

**Step 3: Refactor** — none.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/adapters.test.ts tests/consensus/provider-cli/structured-output.test.ts && pnpm run type-check`
Expected: green.

**Step 5: Commit**

```bash
git add tests/consensus/provider-cli/adapters.test.ts tests/consensus/provider-cli/structured-output.test.ts
git commit -m "test(p01-t01): lock terminal-default contract for unknown provider exits"
```

---

### Task p01-t02: Decouple transient-exit retry from validation feedback (FR7)

**Files:**

- Modify: `src/consensus/provider-cli/structured-output.ts`
- Modify: `tests/consensus/provider-cli/structured-output.test.ts`

**Step 1: Write test (RED)**

```typescript
it('retries a transient provider exit without mutating the prompt', async () => {
  // fakeSubprocess: [transient PROVIDER_EXIT (429), success]
  // capture invocation prompts per attempt → attempt 2 prompt === attempt 1 prompt
  // (no "Schema validation failed: …" injected)
});
it('still appends validation feedback on schema-validation retries', async () => {
  // unchanged behavior assertion (guards against over-correction)
});
```

Run: `pnpm exec vitest run tests/consensus/provider-cli/structured-output.test.ts`
Expected: first test fails (RED) — today line ~164 sets `validationFeedback = classification.message`.

**Step 2: Implement (GREEN)**

In the `!processResult.ok` retry branch, separate the transient process-exit path
from the validation-feedback path:

```typescript
// outline (structured-output.ts retry loop)
if (classification.retryable && attempt < maxAttempts) {
  // transient/interrupted PROVIDER_EXIT → re-invoke, DO NOT touch validationFeedback
  continue;
}
// validationFeedback continues to be set only on schema-validation / invalid-JSON paths
```

Run: `pnpm exec vitest run tests/consensus/provider-cli/structured-output.test.ts`
Expected: GREEN.

**Step 3: Refactor** — keep the transient vs validation branches clearly named.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/structured-output.test.ts && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/structured-output.ts tests/consensus/provider-cli/structured-output.test.ts
git commit -m "fix(p01-t02): decouple transient-exit retry from schema validation feedback"
```

---

### Task p01-t03: Record classification basis via redacted `exit_classification` diagnostic (FR10, NFR3)

**Files:**

- Modify: `src/consensus/provider-cli/types.ts`
- Modify: `src/consensus/provider-cli/adapters.ts`
- Modify: `src/consensus/provider-cli/structured-output.ts`
- Modify: `tests/consensus/provider-cli/structured-output.test.ts`

**Step 1: Write test (RED)**

```typescript
it('records which exit classification fired in diagnostics', async () => {
  // transient exit → diagnostics.exit_classification === 'transient'
  // unknown exit  → 'terminal'/'unknown'; assert no provider stderr content leaks
});
```

**Step 2: Implement (GREEN)**

```typescript
// types.ts ProviderDiagnostics (additive)
exit_classification?: 'transient' | 'terminal' | 'unknown' | 'interrupted';
// classifier returns the basis; turn runner merges it into diagnostics (no stderr)
```

Run: `pnpm exec vitest run tests/consensus/provider-cli/structured-output.test.ts`
Expected: GREEN; no-leak assertion passes.

**Step 3: Refactor** — derive `exit_classification` from the classifier result, not a second code path.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/{structured-output,adapters}.test.ts && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/{types,adapters,structured-output}.ts tests/consensus/provider-cli/structured-output.test.ts
git commit -m "feat(p01-t03): record redacted exit-classification basis in diagnostics"
```

---

### Task p01-t04: Classify reliable interruption signals as transient (FR9)

**Files:**

- Modify: `src/consensus/provider-cli/subprocess.ts`
- Modify: `src/consensus/provider-cli/adapters.ts`
- Modify: `tests/consensus/provider-cli/{subprocess,adapters}.test.ts`

**Step 1: Write test (RED)**

```typescript
it('classifies an externally-interrupted run (reliable signal) as transient', () => {
  // failure with signal!=null that is NOT the CLI's own timeout/output-cap SIGTERM
  //   → retryable:true, terminal_reason:'provider_exit_interrupted'
});
it('keeps CLI timeout/output-cap terminations terminal', () => { /* unchanged */ });
it('defaults ambiguous signal cases to terminal', () => { /* conservative */ });
```

**Step 2: Implement (GREEN)**

`subprocess.ts` already distinguishes its own `terminal` reasons (`timeout`,
`output_cap`, `spawn_error`). Surface an "external interrupt" indicator only when
the failure is a plain nonzero/`signal` exit *not* driven by those internal
terminations; classifier maps it to transient `provider_exit_interrupted`.

```typescript
// adapters.ts — before the generic terminal fall-through:
// if (isReliableInterrupt(failure)) → { retryable:true, terminal_reason:'provider_exit_interrupted' }
```

Run: `pnpm exec vitest run tests/consensus/provider-cli/{subprocess,adapters}.test.ts`

**Step 3: Refactor** — keep "reliable interrupt" detection in one helper.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/{subprocess,adapters}.test.ts && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/{subprocess,adapters}.ts tests/consensus/provider-cli/{subprocess,adapters}.test.ts
git commit -m "feat(p01-t04): classify reliable interrupted runs as transient"
```

---

### Task p01-t05: Evidence-backed per-adapter transient signatures (FR8)

**Files:**

- Modify: `src/consensus/provider-cli/adapters.ts`
- Modify: `tests/consensus/provider-cli/adapters.test.ts`

**Step 1: Write test (RED)**

```typescript
it('applies an evidence-backed provider-specific transient signature', () => {
  // for the adapter(s) with evidence: a provider-specific transient string
  //   → retryable:true, terminal_reason:'provider_exit_transient'
  // shared COMMON patterns still apply for all adapters
});
```

**Step 2: Implement (GREEN)**

Allow each adapter to extend `transient_exit_patterns` beyond
`COMMON_TRANSIENT_EXIT_PATTERNS`. Add provider-specific signatures **only where
real evidence exists** (each pattern cites its evidence in a comment). Where no
evidence exists for a provider, record that explicitly (comment) rather than
guessing.

Run: `pnpm exec vitest run tests/consensus/provider-cli/adapters.test.ts`

**Step 3: Refactor** — keep common vs per-adapter pattern sets clearly separated.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/adapters.test.ts && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/adapters.ts tests/consensus/provider-cli/adapters.test.ts
git commit -m "feat(p01-t05): add evidence-backed per-adapter transient signatures"
```

---

### Task p01-t06: Per-adapter contract matrix tests (FR11)

**Files:**

- Modify: `tests/consensus/provider-cli/adapters.test.ts`

**Step 1: Write test (RED→lock)**

```typescript
describe.each(['claude','codex','cursor'])('exit classification: %s', (id) => {
  it('transient → retry within budget', () => {/* COMMON pattern e.g. /429/ — applies to every adapter regardless of whether p01-t05 added a provider-specific signature */});
  it('terminal (auth/unsupported) → stop early', () => {/* … */});
  it('unknown → terminal (confirmed default)', () => {/* … */});
});
```

Run: `pnpm exec vitest run tests/consensus/provider-cli/adapters.test.ts`
Expected: GREEN across all three adapters.

**Step 2–3:** none (tests only).

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/adapters.test.ts`

**Step 5: Commit**

```bash
git add tests/consensus/provider-cli/adapters.test.ts
git commit -m "test(p01-t06): lock per-adapter transient/terminal/unknown matrix"
```

---

### Task p01-t07: Regenerate runtime + Phase 1 gates (NFR4)

**Files:**

- Modify: generated `.mjs` outputs under `plugins/`/`skills/` (via build only — never hand-edit)

**Step 1–3:** Regenerate and verify drift-free.

```bash
pnpm run build
pnpm run build:check
```

**Step 4: Verify**

Run: `pnpm run build:check && pnpm run type-check && pnpm exec vitest run tests/consensus/provider-cli`
Expected: no drift; all provider-cli tests green.

**Step 5: Commit**

```bash
git add -A
git commit -m "build(p01-t07): regenerate runtime for bl-3291 hardening"
```

---

## Phase 2: bl-3a88 — verdict-submission mechanism (submit-CLI build)

Builds the `consensus submit` seam with deterministic sidecar capture. Depends on Phase 1 only via shared files (`structured-output.ts`, `types.ts`).

### Task p02-t01: Extract shared schema-subset validator (FR2, refactor)

**Files:**

- Create: `src/consensus/provider-cli/schema-validate.ts`
- Modify: `src/consensus/provider-cli/structured-output.ts`
- Create: `tests/consensus/provider-cli/schema-validate.test.ts`

**Step 1: Write test (RED)**

```typescript
// parity: moved validator behaves identically to today's validateSchemaSubset
it('accepts a valid object and reports the specific failing field', () => {/* … */});
```

**Step 2: Implement (GREEN)**

Move `validateSchemaSubset` (+ `matchesJsonType`, `isRecord`) into
`schema-validate.ts`; re-export/import from `structured-output.ts` (no behavior
change). Shared by the submit handler so submit-time and capture-time validation
cannot diverge.

Run: `pnpm exec vitest run tests/consensus/provider-cli/{schema-validate,structured-output}.test.ts`

**Step 3: Refactor** — single source of truth for schema-subset validation.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/{schema-validate,structured-output}.ts tests/consensus/provider-cli/schema-validate.test.ts
git commit -m "refactor(p02-t01): extract shared schema-subset validator"
```

---

### Task p02-t02: Parse `consensus submit` arguments (FR1)

**Files:**

- Modify: `src/consensus/provider-cli/args.ts`
- Modify: `tests/consensus/provider-cli/args.test.ts`

**Step 1: Write test (RED)**

```typescript
it('parses submit with stdin verdict and env-defaulted schema/out', () => {/* … */});
it('rejects multiple verdict sources / missing --json', () => {/* … */});
```

**Step 2: Implement (GREEN)**

```typescript
export interface ParsedSubmitCommand {
  kind: 'submit'; json: true;
  verdictSource?: PromptSource;   // reuse: stdin | file
  schemaPath?: string;            // default CONSENSUS_SUBMIT_SCHEMA
  outPath?: string;               // default CONSENSUS_SUBMIT_FILE
}
// parseSubmitCommand(tokens) + dispatch from parseConsensusCliArgs('submit')
```

Run: `pnpm exec vitest run tests/consensus/provider-cli/args.test.ts`

**Step 3: Refactor** — reuse `parseOptionTokens` + single-source rule.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/args.test.ts && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/args.ts tests/consensus/provider-cli/args.test.ts
git commit -m "feat(p02-t02): parse consensus submit command"
```

---

### Task p02-t03: Implement `runSubmit` handler with one-line stdout contract (FR1, FR2, NFR1)

**Files:**

- Modify: `src/consensus/provider-cli/commands.ts`
- Modify: `tests/consensus/provider-cli/commands.test.ts`

**Step 1: Write test (RED)**

```typescript
it('writes exactly one SubmitResult JSON line on stdout (success)', async () => {/* ok:true, captured */});
it('on invalid verdict: ok:false JSON on stdout + error mirrored to stderr + exit 1', async () => {/* … */});
it('does not overwrite a prior valid capture with an invalid submission', async () => {/* … */});
```

**Step 2: Implement (GREEN)**

```typescript
// SubmitResult { schema_version:'v1'; ok; captured?; message }
export async function runSubmit(cmd: ParsedSubmitCommand, io: ConsensusCliIo): Promise<number>;
// validate via schema-validate; on ok → atomic write to outPath, writeJson(ok:true), return 0
// on bad → writeJson(ok:false,message), io.stderr.write(message), return 1; usage → 2
```

Run: `pnpm exec vitest run tests/consensus/provider-cli/commands.test.ts`

**Step 3: Refactor** — atomic write helper (temp + rename).

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/commands.test.ts && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/commands.ts tests/consensus/provider-cli/commands.test.ts
git commit -m "feat(p02-t03): implement consensus submit handler"
```

---

### Task p02-t04: Dispatch `submit` in the CLI + help text (FR1)

**Files:**

- Modify: `src/consensus/provider-cli/commands.ts`
- Modify: `tests/consensus/provider-cli/cli-process.test.ts`

**Step 1: Write test (RED)**

```typescript
it('routes `submit --json -` to runSubmit and exits with its code', async () => {/* … */});
it('lists submit in help text', () => {/* … */});
```

**Step 2: Implement (GREEN)** — add the `submit` branch in `runConsensusCli`; extend `helpText()`.

Run: `pnpm exec vitest run tests/consensus/provider-cli/cli-process.test.ts`

**Step 3–4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/{cli-process,commands}.test.ts && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/commands.ts tests/consensus/provider-cli/cli-process.test.ts
git commit -m "feat(p02-t04): dispatch consensus submit and document it in help"
```

---

### Task p02-t05: Run-bound capture path + child-env injection (FR3, NFR2)

**Files:**

- Modify: `src/consensus/provider-cli/structured-output.ts`
- Modify: `src/consensus/provider-cli/runtime-policy.ts`
- Modify: `tests/consensus/provider-cli/{structured-output,runtime-policy}.test.ts`

**Step 1: Write test (RED)**

```typescript
it('injects CONSENSUS_SUBMIT_FILE/SCHEMA into the provider child env', () => {/* via hostEnv */});
it('generates a unique run-bound sidecar path per turn', () => {/* randomUUID */});
```

**Step 2: Implement (GREEN)**

Generate a sidecar path (mirror `codexLastMessageFile()`), pass `CONSENSUS_SUBMIT_FILE`
+ `CONSENSUS_SUBMIT_SCHEMA` through `hostEnv` (merged last in
`buildChildEnvironment`) — not by widening user `env_allowlist`. **Merge into** the
existing `hostGuard.child_env`, don't replace it, so the recursion-guard env is
preserved: `hostEnv: { ...(hostGuard.child_env ?? {}), CONSENSUS_SUBMIT_FILE, CONSENSUS_SUBMIT_SCHEMA }`.

Run: `pnpm exec vitest run tests/consensus/provider-cli/{structured-output,runtime-policy}.test.ts`

**Step 3: Refactor** — keep capture-path helpers next to the existing last-message helper.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/{structured-output,runtime-policy}.ts tests/consensus/provider-cli/{structured-output,runtime-policy}.test.ts
git commit -m "feat(p02-t05): bind a run-scoped submit capture path into the child env"
```

---

### Task p02-t06: Prompt the peer to submit (FR2 adoption reliability)

**Files:**

- Modify: `src/consensus/provider-cli/structured-output.ts`
- Modify: `tests/consensus/provider-cli/structured-output.test.ts`

**Step 1: Write test (RED)**

```typescript
it('augments the prompt with submit instructions when capture is enabled', () => {
  // prompt includes how to call `consensus submit --json -` and the active mode/schema
});
```

**Step 2: Implement (GREEN)** — extend `promptForStrategy` (or the turn-runner prompt
assembly) with a concise submit instruction when the capture seam is active. Keep
the existing schema instructions as the fallback contract.

Run: `pnpm exec vitest run tests/consensus/provider-cli/structured-output.test.ts`

**Step 3–4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/structured-output.test.ts && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/structured-output.ts tests/consensus/provider-cli/structured-output.test.ts
git commit -m "feat(p02-t06): instruct peers to submit verdicts via consensus submit"
```

---

### Task p02-t07: Preferred-source capture resolution + `verdict_source` diagnostic (FR3, NFR2)

**Files:**

- Modify: `src/consensus/provider-cli/structured-output.ts`
- Modify: `src/consensus/provider-cli/types.ts`
- Modify: `tests/consensus/provider-cli/structured-output.test.ts`

**Step 1: Write test (RED)**

```typescript
it('uses a valid sidecar verdict as envelope.json with verdict_source:submit', async () => {/* … */});
it('cleans up the sidecar after the turn', async () => {/* … */});
```

**Step 2: Implement (GREEN)**

```typescript
// types.ts: verdict_source?: 'submit' | 'final_message';
// extractProviderOutput: read sidecar first; valid → {source:'submit'}, else current logic
// best-effort rm of the sidecar (like cleanupInvocationFiles)
```

Run: `pnpm exec vitest run tests/consensus/provider-cli/structured-output.test.ts`

**Step 3: Refactor** — single resolution function returns `{value, verdict_source}`.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/{structured-output,types}.ts tests/consensus/provider-cli/structured-output.test.ts
git commit -m "feat(p02-t07): capture submitted verdict as preferred source"
```

---

### Task p02-t08: No-submission behavior — prefer-submit → parse fallback → terminal (FR4)

**Files:**

- Modify: `src/consensus/provider-cli/structured-output.ts`
- Modify: `tests/consensus/provider-cli/structured-output.test.ts`

**Step 1: Write test (RED)**

```typescript
it('falls back to the parse path when no sidecar is present (default)', async () => {/* today’s behavior */});
it('terminates via existing missing_provider_output/schema_validation handling when neither submit nor parse yields usable output', async () => {/* default terminal path */});
```

**Step 2: Implement (GREEN)** — default `prefer-submit → parse fallback → existing
terminal handling` (the terminal case reuses the existing
`missing_provider_output`/`schema_validation` reasons). No bounded extra retry; no
backoff.

> **Deferred (future follow-up):** the strict `require_submission` request flag +
> distinct `missing_submission` terminal reason is **out of scope here** — the design
> (`design.md` DR-bl3a88; §Deployment Strategy) frames strict mode as future
> tightening gated on adoption evidence. Promoting it later requires request-contract
> edits (`args.ts` parsing + `parseRequestJson` validation, the request type, and
> tests), so it is tracked as a follow-up, not built in p02-t08.

Run: `pnpm exec vitest run tests/consensus/provider-cli/structured-output.test.ts`

**Step 3–4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/consensus/provider-cli/structured-output.ts tests/consensus/provider-cli/structured-output.test.ts
git commit -m "feat(p02-t08): define no-submission behavior (prefer-submit, parse fallback)"
```

---

### Task p02-t09: Envelope-contract invariance + core-loop integration (NFR2)

**Files:**

- Modify: `tests/consensus/provider-cli/structured-output.test.ts`
- Modify: `tests/consensus/core/provider-cli-invocation.test.ts`

**Step 1: Write test (RED→lock)**

```typescript
it('keeps the ConsensusCliRunEnvelope shape unchanged for the core loop', async () => {
  // submit path and parse path both yield the same envelope shape consumed by consensus-loop.ts
});
```

**Step 2–3:** none (integration lock); run existing core tests unchanged.

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/core tests/consensus/provider-cli && pnpm run type-check`
Expected: existing core-loop tests pass unmodified.

**Step 5: Commit**

```bash
git add tests/consensus/provider-cli/structured-output.test.ts tests/consensus/core/provider-cli-invocation.test.ts
git commit -m "test(p02-t09): lock envelope-contract invariance across submit/parse paths"
```

---

### Task p02-t10: Regenerate runtime + Phase 2 gates (NFR1, NFR4)

**Files:**

- Modify: generated `.mjs` outputs (via build only)

```bash
pnpm run build
pnpm run build:check
```

**Step 4: Verify**

Run: `pnpm run build:check && pnpm run type-check && pnpm run test && pnpm run smoke`
Expected: drift-free; full suite + smoke green; no runtime dependency added.

**Step 5: Commit**

```bash
git add -A
git commit -m "build(p02-t10): regenerate runtime for verdict-submission mechanism"
```

---

## Phase 3: Reliability evidence, live E2E, and decision-record promotion

Proves the bl-3a88 reliability improvement and records the durable decision. Depends on Phases 1–2.

### Task p03-t01: Fixture — "finished without a structured-output message" → self-corrected success (FR5)

**Files:**

- Create: `tests/consensus/provider-cli/evidence/no-structured-output.test.ts`

**Step 1: Write test (RED→evidence)**

```typescript
it('converts a no-final-JSON turn into a captured verdict via submit', async () => {
  // stub provider that emits NO final JSON but "runs consensus submit" (writes sidecar)
  //   → envelope.ok, verdict_source:'submit'
  // control: same stub without submit → today's failure (documents the improvement)
});
```

Run: `pnpm exec vitest run tests/consensus/provider-cli/evidence/no-structured-output.test.ts`

**Step 2–3:** none (uses Phase-2 mechanism).

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/evidence/no-structured-output.test.ts`

**Step 5: Commit**

```bash
git add tests/consensus/provider-cli/evidence/no-structured-output.test.ts
git commit -m "test(p03-t01): evidence — submit fixes the no-structured-output failure"
```

---

### Task p03-t02: Fixture — Codex/OpenAI strict-output rejection → self-corrected success (FR5)

**Files:**

- Create: `tests/consensus/provider-cli/evidence/strict-output-rejection.test.ts`

**Step 1: Write test (RED→evidence)**

```typescript
it('converts a strict-output rejection into a captured verdict via submit', async () => {
  // stub: provider strict-output path rejects; peer self-corrects + submits → envelope.ok
  // control documents prior failure
});
```

Run: `pnpm exec vitest run tests/consensus/provider-cli/evidence/strict-output-rejection.test.ts`

**Step 2–4: Verify** as above.

**Step 5: Commit**

```bash
git add tests/consensus/provider-cli/evidence/strict-output-rejection.test.ts
git commit -m "test(p03-t02): evidence — submit fixes strict-output rejection"
```

---

### Task p03-t03: Live-provider E2E (gated) + record sandbox/tmpdir posture (FR5)

**Files:**

- Create: `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts`
- Modify: `design.md` (record confirmed sandbox/tmpdir posture under Open Questions)

**Step 1: Write test (gated/skippable)**

```typescript
// skip unless a live provider is available (mirror existing live-e2e gating)
it.skipIf(!liveProvider)('a live peer submits a verdict via consensus submit', async () => {/* … */});
```

**Step 2: Implement** — run against ≥1 available provider; capture whether Codex
`read-only` can write the sidecar or the capture path must move under `cwd`.

**Step 3: Refactor** — fold the resolved posture into `design.md` (replace the
open question with the confirmed answer). This only resolves the **pre-approved**
"Sandbox tmpdir writes" open question with the E2E-confirmed answer — it introduces
no new design decision, so the `passed` design review still stands (not a re-review
trigger).

**Step 4: Verify**

Run: `pnpm exec vitest run tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts` (or documented skip)

**Step 5: Commit**

```bash
git add tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts .oat/projects/shared/provider-cli-hardening/design.md
git commit -m "test(p03-t03): live-provider submit E2E and recorded sandbox posture"
```

---

### Task p03-t04: Full gate sweep (NFR5, NFR4)

**Files:** none (verification only).

**Step 4: Verify**

Run: `pnpm run build:check && pnpm run type-check && pnpm run test && pnpm run validate && pnpm run smoke`
Expected: all green.

**Step 5: Commit** — only if regeneration was needed:

```bash
git add -A
git commit -m "build(p03-t04): final gate sweep for provider-cli-hardening"
```

---

### Task p03-t05: Promote DR-bl3a88 + flag the consensus-family track (FR12)

**Files:**

- Modify: `.oat/repo/reference/decision-record.md`
- Modify: `.oat/repo/reference/backlog/items/refine-provider-exit-retry-classification.md` (rewrite stale AC to confirmed contract)
- Modify: `.oat/repo/reference/backlog/items/tool-based-verdict-submission-for-consensus-peers.md` (status)

**Step 1–3: Implement**

- Promote **DR-bl3a88** (submit-CLI; MCP rejected; sidecar capture; no-submission
  default; evidence) to `decision-record.md` as the next `DR-NNN`.
- Rewrite the bl-3291 AC to the confirmed terminal-default contract (the drift note
  already flags this).
- **Flag the consensus-family track** that the verdict contract is decided
  (note in `tool-based-verdict-submission-for-consensus-peers.md` cross-link to
  the family items `bl-b9b9`/`bl-87ef`/`bl-0cb8`).
- `oat backlog regenerate-index` after item edits.

> Broader repo-reference updates (current-state, roadmap, completed, backlog
> statuses) are finalized in `oat-project-document` / completion — not duplicated here.

**Step 4: Verify**

Run: `oat backlog regenerate-index && pnpm run validate`

**Step 5: Commit**

```bash
git add .oat/repo/reference/
git commit -m "docs(p03-t05): promote DR-bl3a88 and flag consensus-family track"
```

---

## Reviews

| Scope  | Type     | Status   | Date       | Artifact                                              |
| ------ | -------- | -------- | ---------- | ----------------------------------------------------- |
| p01    | code     | passed   | 2026-06-21 | reviews/archived/p01-review-2026-06-21.md            |
| p02    | code     | pending  | -          | -                                                     |
| p03    | code     | pending  | -          | -                                                     |
| final  | code     | pending  | -          | -                                                     |
| spec   | artifact | pending  | -          | -                                                     |
| design | artifact | passed   | 2026-06-21 | reviews/archived/artifact-design-review-2026-06-21.md |
| plan   | artifact | passed   | 2026-06-21 | reviews/archived/artifact-plan-review-2026-06-21.md (manual; I1 resolved) |

**Status values:** `pending` → `received` → `fixes_added` → `fixes_completed` → `passed`

**Meaning:**

- `received`: review artifact exists (not yet converted into fix tasks)
- `fixes_added`: fix tasks were added to the plan (work queued)
- `fixes_completed`: fix tasks implemented, awaiting re-review
- `passed`: re-review run and recorded as passing (no Critical/Important)

---

## Implementation Complete

**Summary:**

- Phase 1: 7 tasks — bl-3291 retry-classification hardening (confirm terminal-default contract + fill gaps)
- Phase 2: 10 tasks — bl-3a88 verdict-submission mechanism (submit-CLI + deterministic capture)
- Phase 3: 5 tasks — reliability evidence, live E2E, DR promotion + family-track flag

**Total: 22 tasks**

Ready for code review and merge.

---

## References

- Design: `design.md`
- Spec: `spec.md`
- Discovery: `discovery.md`
- Backlog: `bl-3a88`, `bl-3291`; priority-alignment Phase 3
