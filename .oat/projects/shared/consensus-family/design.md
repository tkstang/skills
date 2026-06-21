---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-21
oat_generated: false
oat_template: false
---

# Design: consensus-family

## Overview

Implement `independent_draft` once in the **loop core** as a cold-start strategy that changes only round-1 behavior — instead of seeding both peers from one shared artifact, round 1 frames the brief and asks each peer to draft its own output. Round 2+ is unchanged. The cold-start value is threaded into the round-1 prompt builders (which today don't receive it) and recorded in the already-present `cold_start` resolution field. On top of that primitive, add three thin wrapper skills — `consensus-create` (the co-designed first consumer), `consensus-decide`, `consensus-plan` — mirroring the shipped `refine`/`evaluate` anatomy. The new wrappers default to `independent_draft` + `parallel_synthesized`, whose reliability rides the settled DR-024 verdict-submission seam (reused, not reopened).

Key architectural decisions: (1) cold-start is a **round-1-only** change, keeping the primitive small and mode-agnostic; (2) the brief reuses the **existing artifact input channel** with framing selected by `coldStart` (no parallel data path, `shared_input` stays byte-identical); (3) the loop core accepts both cold-starts, but **`refine`/`evaluate` remain `shared_input`-only** by deliberate per-skill constraint while the new wrappers accept both; (4) decide/plan output is **structured markdown via prompt framing**, not a new machine schema.

## Architecture

### System Context

The consensus plugin splits a deterministic loop-core orchestrator (`src/consensus/core/`) from a host model layer, with thin wrapper skills as entrypoints that configure and invoke `runConsensusLoop`. This change adds a new cold-start strategy to the loop core and three new wrappers. It is disjoint from the verdict-submission seam in `src/consensus/provider-cli/` (one-way, type-only dependency), which is reused as-is.

**Key Components:**

- **Loop-core cold-start primitive:** round-1 seeding + prompt framing for `independent_draft`; cold-start threaded to the prompt builders; recorded in the resolution block. The single implementation point.
- **consensus-create / decide / plan wrappers:** thin entrypoints — input parsing + per-skill defaults + I/O framing over the shared core.
- **Test surface:** loop-level cold-start tests (skill-independent) + per-wrapper tests.

### Component Diagram

```
                 ┌────────────────────────────────────────────┐
 refine ───────▶ │  loop core (runConsensusLoop)              │
 evaluate ─────▶ │   • ColdStartMode: shared_input |          │
 (shared_input)  │       independent_draft                    │
                 │   • round-1 framing by coldStart           │ ──▶ artifact +
 create ───────▶ │   • round 2+ iteration (unchanged)         │     deliberation log +
 decide ───────▶ │   • resolution block (records cold_start)  │     resolution block
 plan  ────────▶ │                                            │
 (independent_   └───────────────┬────────────────────────────┘
  draft default)                 │ type-only import
                                 ▼
                    provider-cli/ verdict seam (DR-024, reused)
                    verdict-parallel + synthesis schemas
```

### Data Flow

```
brief/options (untrusted, ≤1 MiB, path-confined)
  → wrapper sets defaults (cold_start, iteration mode, agency)
  → runConsensusLoop
     → round 1: each peer drafts its own output from the brief (no shared seed)
                (alternating: A drafts, B revises A)
     → round 2+: active iteration mode
                (synthesized: orchestrator merges via `synthesis` schema;
                 per-turn verdicts captured via DR-024 submit seam; verdict_source recorded)
     → convergence
  → final artifact + deliberation log + resolution block (cold_start, iteration, agency)
```

## Component Design

### Component A — Loop-core cold-start primitive (FR1–FR3)

**Purpose:** Make `independent_draft` a first-class cold-start that changes only round-1 behavior.

**Responsibilities:**

- Widen the cold-start type to `'shared_input' | 'independent_draft'`; relax the **loop-core** parser to validate and accept both (replacing its current hard rejection).
- Thread the cold-start into the round-1 prompt builders — today the value lives in the loop options but is not passed to `buildParallelTurnPrompt` / `buildTurnPrompt`; their input types gain a `coldStart` field. This is the main new wiring.
- Round-1 framing branch: the brief content travels the existing artifact/section input channel; the round-1 branch selects framing by `coldStart` (`shared_input` → "revise this section"; `independent_draft` → "produce your own draft from this brief"). Round 1 already sets each peer's prior revision to `none`.
- Record the effective `cold_start` in the resolution block (field already modeled).

**Interfaces (representative):**

```typescript
type ColdStartMode = 'shared_input' | 'independent_draft';

// round-1 prompt-builder inputs gain coldStart (parallel + alternating builders)
interface TurnPromptInput {
  // ...existing fields...
  coldStart: ColdStartMode;
  round: number;
}
```

**Dependencies:** Loop core only; reuses the verdict seam + `verdict-parallel` / `synthesis` schemas unchanged.

**Design Decisions:**

- **Round-1-only:** round-2+ iteration logic untouched; only the round-1 seed/framing differs.
- **Per-mode round-1 semantics:** parallel_revision / parallel_synthesized → both peers draft independently from the brief (synthesized merges the two drafts via the existing `synthesis` step, no synthesis-prompt change); alternating (degenerate, non-default) → peer A drafts from the brief, peer B revises A's draft.
- **No separate brief channel** — reuse the artifact channel + frame-by-`coldStart`; keeps `shared_input` byte-identical.
- **`cold_start` recording = resolution block only** for v1 (already plumbed); per-section/terminal recording deferred (no consumer).

### Component B — create / decide / plan wrappers (FR4–FR6)

**Purpose:** Three entrypoints that configure the core and frame I/O; thin by construction.

**Responsibilities (shared shape; mirrors refine/evaluate):** parse the skill's input (create: `--brief`/`--brief-file` + optional `--template`; decide: `--options`; plan: `--goal` + `--constraints`); apply per-skill defaults; set output framing (create: free-form artifact; decide/plan: required-heading markdown); reuse the input cap, path-confinement helpers, and JSONL coordination protocol; assemble the resolution block.

**Design Decisions:**

- **decide at minimal agency surfaces, doesn't decide:** even though synthesized mode would let the orchestrator auto-resolve, minimal agency forces unresolved disagreements to the user — the wrapper renders the `synthesis` schema's `unresolved_disagreements[]` into the decision doc's "dissent / unresolved" heading rather than collapsing them.
- **Headings via prompt/template only** for decide/plan (no machine schema).
- **Family enforces the `verdict` enum** where correctness depends on it (the shared subset validator does not check enums).
- **`--cold-start` exposed on all new wrappers** as an optional override (default = the per-skill v3 default); `refine`/`evaluate` keep their `shared_input`-only guard.

**Dependencies:** Component A; the loop core; the settled verdict seam.

## Data Models

**Cold-start type (widened):** `ColdStartMode = 'shared_input' | 'independent_draft'`.

**Round-1 prompt-builder inputs:** gain a `coldStart: ColdStartMode` field (parallel and alternating builders).

**Resolution block (existing model, no new fields):** records the effective `cold_start` (now possibly `independent_draft`), iteration mode, and agency. End-to-end plumbing already exists; this work only lets the value be `independent_draft`.

**Reused schemas (unchanged):**
- `verdict-parallel` — peer verdict: `schema_version` (const `v1`), `verdict` (enum `REVISE|ACCEPT_PEER|CONVERGED|IMPASSE`), `reasoning`, `critique{own_previous, peer_previous}`, `proposed_artifact`, `concerns[]`.
- `synthesis` — synthesizer output: `schema_version`, `synthesized_artifact`, `synthesis_reasoning`, `unresolved_disagreements[]`.

No new persisted data model; the deliberation log + resolution block are produced as today.

## API Design

The "API" is the CLI invocation contract: subcommand + flags in, JSONL events + written artifact out. All three mirror the refine/evaluate surface; no network/auth surface of their own (provider auth stays with the provider CLI).

**`consensus-create`** — input `--brief <text>` or `--brief-file <path>` (one required), `--template <path>` (optional); optional overrides `--cold-start` / `--iteration` / `--agency` (defaults `independent_draft` / `parallel_synthesized` / maximum) plus shared output/run-dir flags; output: artifact → confined path, JSONL deliberation → stdout, resolution block.

**`consensus-decide`** — input `--options <text|path>`; defaults `independent_draft` / `parallel_synthesized` / minimal; output: markdown decision doc (recommendation / reasoning / alternatives / dissent) + resolution block.

**`consensus-plan`** — input `--goal <text>` + `--constraints <text|path>` (optional); defaults `independent_draft` / `parallel_synthesized` / moderate; output: markdown plan (steps / dependencies / risks) + resolution block.

**Error handling:** missing/empty required input and oversized input (>1 MiB) are usage errors that fail before any provider call; preflight checks provider availability; provider/turn failures use the existing terminal/retry classification.

**`--cold-start` decision:** exposed on all new wrappers (optional override, per-skill default), accepting both values — less special-casing than hardcoding (the loop parser accepts both; hardcoding would require active rejection), uniform family surface, preserves the 3×2 matrix. `refine`/`evaluate` keep `shared_input`-only.

## Security Considerations

**Untrusted input framing (NFR4):** brief / options / constraints / template are untrusted content. The brief travels the existing artifact channel and inherits its untrusted-data framing; the new round-1 prompt ("produce your own draft from this brief") must keep that discipline — the brief is delimited as untrusted **data**, never instructions (prompt-injection resistance), exactly as refine/evaluate frame artifact/rubric today.

**Input size cap:** the 1 MiB read cap applies to every new input.

**Path confinement:** output paths, run dirs, and file-form inputs (`--brief-file`, `--template`, `--options`/`--constraints` paths) go through the existing confinement helpers.

**Verdict capture:** reuses the DR-024 seam — run-bound sidecar (`randomUUID` temp file), byte-capped, schema-validated at submit and at capture. The family additionally enforces the `verdict` enum (subset validator doesn't).

**Provider sandbox posture:** synthesized mode defaults Codex to `workspace-write` (required for the peer to write the sidecar; read-only can't) — a deliberate, run-scoped posture, documented so it isn't a surprise.

**No new auth/secrets/network surface** beyond the provider CLI subprocesses (unchanged by this work).

## Performance Considerations

`parallel_synthesized` costs 2 peer calls + 1 synthesis call per round; `independent_draft` adds **no** cost over `shared_input` (identical call structure, only round-1 framing differs). Whole-artifact (v1) deliberates large briefs as a single unit (no per-section parallelism) — acceptable for v1; outline-first is the deferred scaling path. Convergence is bounded by the existing max-rounds / agency settings; no new perf-sensitive paths. Resource usage (memory/CPU/network) is dominated by the provider subprocesses, unchanged by this work.

## Error Handling

**Error Categories:**
- **User errors:** missing/empty required input, oversized input (>1 MiB) → usage error before any provider call.
- **System/provider errors:** reuse the bl-3291 classification — unknown exit → terminal; transient patterns → retry without prompt mutation.
- **Verdict/output errors:** peer doesn't submit → prefer-submit → final-message parse fallback → existing terminal reasons (`missing_provider_output` / `invalid_json` / `schema_validation`) within `max_attempts`; out-of-enum `verdict` → family enum check routes it through the schema-validation/terminal path (never silently corrupts convergence).

**Retry logic:** existing within-`max_attempts` retries; transient retries don't mutate the prompt; no backoff/jitter (deliberate, per bl-3291). No hard `require_submission` in v1.

**Logging:** the existing JSONL event stream on stdout is the audit trail; `verdict_source` records submit vs parse-fallback so degraded runs are visible.

## Testing Strategy

### Requirement-to-Test Mapping

| ID | Verification | Key Scenarios |
|---|---|---|
| FR1 | unit + integration | loop accepts `--cold-start independent_draft`; round-1 frames the brief, not a shared artifact; `shared_input` regression intact |
| FR2 | unit + integration | round-1 prompt shape per mode; round-1→convergence run per mode (parallel_revision / parallel_synthesized / alternating); alternating = A-drafts/B-revises |
| FR3 | unit | `--cold-start` parse/validate; resolution block records `cold_start`; per-skill defaults |
| FR4 | integration + manual | create brief→artifact (mock peers); whole-artifact; resolution block present |
| FR5 | integration | decide at minimal agency renders `unresolved_disagreements[]` into the dissent heading; does not editorially decide |
| FR6 | integration | plan goal+constraints→markdown plan with required headings |
| NFR2 | unit | `build:check`; skill-version validators |
| NFR3 | integration | `verdict_source` recorded; out-of-enum `verdict` handled |
| NFR4 | unit | input cap; path confinement; refine/evaluate reject `independent_draft` |
| NFR1 / NFR5 | manual + e2e | no runtime deps; full gate set green |

### Unit Tests

- **Scope:** cold-start arg parse; round-1 prompt builders (brief-framing vs revise-framing) per mode; verdict enum check; input cap / path confinement.
- **Key cases:** `--cold-start independent_draft` parses; round-1 parallel/alternating prompts frame the brief; refine/evaluate reject `independent_draft`.

### Integration Tests

- **Scope (loop-level, skill-independent — the bl-2ed7 AC core):** drive `runConsensusLoop` with injected mock peer/synthesizer invokers through round-1→convergence under `independent_draft` for each of the 3 modes; assert the resolution records `cold_start`.
- **Per-wrapper:** create/decide/plan happy paths with mock peers; a decide dissent-surfacing fixture (minimal agency surfaces, doesn't decide).
- **Environment:** Vitest with subprocess DI; temp-git tests scrub `GIT_DIR`/`GIT_*`.

### End-to-End Tests

- **Scope:** optional live run behind an env flag, mirroring the existing gated provider e2e (skipped unless explicitly enabled + preflight ready).

## Deployment Strategy

### Build Process

Edit canonical TypeScript under `src/consensus/`; run `pnpm run build` to regenerate committed `.mjs` under `plugins/` and the synced `skills/` mirrors; `pnpm run build:check` verifies no drift. Never hand-edit `// GENERATED` outputs.

### Deployment Steps

1. Land Component A (loop-core cold-start) + loop-level tests; build + gates.
2. Land consensus-create + tests; build + gates.
3. Land consensus-decide / consensus-plan (separate PRs) + tests; build + gates.

### Rollback Plan

Additive change — standard `git revert`; `shared_input` is byte-identical so reverting any phase leaves the prior phases functional.

### Configuration

- Each new skill: bump `version` and `metadata.version` (in sync); add to `SKILL_FILES` in `scripts/bump-version.mjs`; the skill-version-on-edit validator must pass.
- No new user-facing env config; the verdict-seam env is injected by the loop, not user-set.
- Refresh provider views via `oat sync` per the repo convention.

### Monitoring

Not applicable — local CLI skills; the JSONL deliberation stream is the per-run observability surface.

## Migration Plan

No data, schema, or config migrations. The change is purely additive: widening the cold-start type and adding three wrappers. `shared_input` behavior is byte-identical, so existing `refine`/`evaluate` invocations are unaffected (they remain `shared_input`-only). Committed `.mjs` is regenerated via `pnpm run build`. Rollback = standard revert.

## Open Questions

- **Required-headings enforcement (decide/plan):** prompt/template framing for v1; programmatic validation only if a real consumer needs machine-readable structure.
- **Hard `require_submission` contract:** deferred bl-3a88 follow-up; build only if synthesized-mode reliability budget demands it (the family rides prefer-submit + parse-fallback for v1).

## Implementation Phases

### Phase 1 — `independent_draft` in the loop core (P0; FR1–FR3)

**Goal:** the cold-start primitive lands, works across all three modes, and is covered by loop-level tests; `shared_input` regression-free.

**Tasks:** widen `ColdStartMode`; relax the loop-core parser; thread `coldStart` into round-1 prompt builders; implement round-1 framing per mode; record `cold_start`; loop-level tests (mock invokers) across the 3 modes.

**Verification:** `pnpm run build:check`, `type-check`, `test`, `validate`, `smoke`.

### Phase 2 — `consensus-create` (P0; FR4)

**Goal:** the co-designed first consumer ships (brief → artifact), maximum agency, whole-artifact, with full wrapper anatomy + tests.

**Tasks:** TS source under `src/consensus/create/`; SKILL.md (+ matching versions); reuse schemas; references/examples; manifest + README entries; tests; generated `.mjs`.

**Verification:** full gate set; create end-to-end with mock peers.

### Phase 3 — `consensus-decide` + `consensus-plan` (P1; FR5–FR6, parallelizable, separate PRs)

**Goal:** the two thin wrappers ship with their defaults and markdown output contracts.

**Tasks:** TS source + SKILL.md + references + manifest/README + tests for each; decide dissent-surfacing fixture; generated `.mjs`.

**Verification:** full gate set; decide/plan integration tests.

## Dependencies

### External Dependencies

- **Provider CLIs (Claude / Codex / Cursor)** via subprocess — the only external execution boundary.

### Internal Dependencies

- **Loop core** (`src/consensus/core/`) — the deliberation engine.
- **Verdict-submission seam (DR-024, bl-3a88, shipped/archived)** — reliable per-turn verdict capture + `verdict-parallel` / `synthesis` schemas + shared subset validator. Settled; not reopened.
- **Shipped wrapper templates** (`refine`, `evaluate`) — the anatomy each new wrapper replicates.

### Development Dependencies

- **Build tooling** (`pnpm run build` / `build:check`) and the **skill-version validators**.

## Risks and Mitigation

- **Alternating-mode semantics:** Probability: Medium · Impact: Medium — decided (degenerate A-drafts/B-revises) but awkward/non-default.
  - **Mitigation:** specify the degenerate flow precisely; per-mode loop tests; document as non-default.
  - **Contingency:** if it confuses users, gate alternating+independent_draft behind a warning.
- **Peer doesn't call submit:** Probability: Medium · Impact: Medium — synthesized falls back to fragile final-message parse (no hard contract in v1).
  - **Mitigation:** rely on the shipped prefer-submit default + strong prompt framing; record `verdict_source`.
  - **Contingency:** build the deferred opt-in `require_submission` mode (known, scoped).
- **Generated-output drift / version-bump misses:** Probability: Low · Impact: Medium.
  - **Mitigation:** edit TS only; run build + build:check; add new skills to version-bump tooling.
  - **Contingency:** the build:check / skill-version CI jobs catch drift before merge.

## References

- Specification: `spec.md`
- Discovery: `discovery.md`
- Architecture: `.oat/repo/reference/research/consensus/architecture-v3.md`
- Decision record: `.oat/repo/reference/decision-record.md` (DR-024)
- Knowledge Base: `.oat/repo/knowledge/project-index.md`
