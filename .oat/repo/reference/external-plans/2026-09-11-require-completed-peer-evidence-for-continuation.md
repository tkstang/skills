---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - .
  - .oat/repo/reference/reviews/2026-09-11-audit-astra-review.md
oat_external_plan_commit: 1ff91ed5
oat_backlog_items: []
oat_issue_url: null
created: '2026-09-11T13:29:20Z'
---

# Require completed peer evidence before Claude/Codex continuation

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`. Execute it directly, or import it with `oat-project-import-plan <this-file>`.

## Outcome

Automatic collaboration continuation for Claude/Codex peers requires positive provider completion evidence. Progress text, commentary, tool use, interruption, and unknown lifecycle state cannot spend continuation budget or advance the peer cursor past an unfinished turn. Ordinary observation still displays progress. Existing Cursor confirmed-completion semantics remain unchanged.

Value: high autonomous-workflow correctness. Effort: medium. Implementation risk: high because shared transcript normalization feeds an automatic wake boundary. Confidence in the defect: high; exact completion-field compatibility must be pinned before implementation.

## Source and live evidence

- Finding `PRODUCT-02`; source unchanged from `f5395a35` at review on 2026-09-11, plan branch `1ff91ed5`.
- `src/transcript/core/runtimes.ts:1146-1159,1339-1355` normalizes Claude/Codex assistant text without preserving the completion distinction. `src/transcript/session-observer/lib/digest.ts:1131-1140` consumes normalized entries.
- `skills/session-observer-collab/scripts/lib/completion-selection.mjs:283-324,408-411` classifies the last assistant message as a completed substantive turn. `scripts/hooks/codex-stop.mjs:274` within the same skill consumes that selection before cursor/budget updates.
- Synthetic Codex commentary followed by a function call and Claude assistant text with `stop_reason: tool_use` both produce `continuation: true` without final/terminal evidence. This demonstrates a selection defect, not a claim that a live hook was triggered.
- Existing `tests/session-observer-collab/completion.test.ts:143,623,637` uses fabricated normalized messages and checks trailing user input, missing these raw-record combinations. The archived collaboration plan promised completed substantive selection; Cursor-specific reliability work is not this non-Cursor outcome.

## Drift check

```bash
git diff --stat f5395a35..HEAD -- src/transcript/core/runtimes.ts src/transcript/session-observer/lib/digest.ts src/transcript/session-observer/lib/types.ts skills/session-observer-collab tests/transcript-core tests/session-observer tests/session-observer-collab
gh pr view 70 --json state,headRefOid,files
```

PR #70 changes shared transcript metadata/types. Its reviewed patch does not fix normalization/continuation eligibility, but execution must reconcile the current shared-file owner. No dependency on new N>2, idle-integration, messaging, or shared-log projects is intended.

## Scope

In scope: canonical transcript normalization/types in `src/transcript/core/runtimes.ts`; observer digest/types in `src/transcript/session-observer/lib/`; authored collaboration completion selection and paired `.d.ts`, plus bounded hook-consumer changes only if required to request/validate qualified evidence; synthetic normalization/digest/completion/hook tests; affected generated artifacts, skill versions, and existing observer/collaboration contract docs.

Out of scope: a provider-wide lifecycle redesign, lease schema migration, new wake transports, Cursor index/projection changes, N>2 offset design, new runtime storage, live hooks, live messages, provider setup, or machine-wide installation.

## Implementation steps

### 1. Pin the smallest completion-evidence contract

Add raw synthetic fixtures through normalization → digest → selection. Establish which existing supported Claude stop reasons and Codex final/terminal records positively prove completion; explicitly distinguish tool use, commentary, interruption/error, and missing/unknown evidence. Keep turn association and record indices traceable. Do not infer completion from assistant role, nonempty text, a quiet file, or file age.

Choose a minimal typed additive evidence/projection contract where compatible. Record how callers request it, how old digests lacking evidence fail closed for automatic continuation, and why ordinary observation/export stays compatible. If supported record variants cannot establish a reliable terminal boundary, STOP for a bounded contract decision rather than guessing or designing a general lifecycle engine.

**Verify:** current progress/tool-use fixtures reproduce premature selection; approved positive completion fixtures distinguish a completed earlier turn from a later unfinished turn. Document the chosen compatibility contract in the test and existing product reference.

### 2. Preserve completion evidence and gate selection

Retain the necessary provider evidence through shared normalization and observer digest accounting. Require positively qualified entries/turns for non-Cursor automatic continuation; keep progress visible in normal observation. Preserve exact contiguous review ranges and cursor semantics: pending records remain eligible when terminal evidence later arrives, completed prefixes are not replayed, and unknown evidence never spends budget.

Update the authored selection module and its declaration together. Only adjust hook consumers to request/validate the qualified contract; do not change lease ownership, limits, CAS rules, or trigger authority. Cursor's confirmed-completion/frame-index path must remain unchanged.

**Verify:** raw fixture tests cover progress → tool use → completion, completion followed by new progress, interruption/error, unknown/missing evidence, short genuine final replies, multiple completed turns, and automatic/no-op suppression. Assert continuation boolean, selected range, exact cursor, budget cost, and replay behavior across successive snapshots—not text classification alone.

### 3. Prove the automatic boundary and repository compatibility

Use dependency-injected hook tests to prove an unfinished peer does not invoke a wake/cursor update or charge budget, and a later qualified completion can trigger once within existing limits. No live hooks or provider calls. Extend the existing observer/transcript tests to prove ordinary progress rendering remains intact.

**Verify:** `pnpm exec vitest run tests/transcript-core tests/session-observer tests/session-observer-collab`; regenerate with `pnpm run build`, bump every affected shipped skill version (including the authored collaboration skill), run targeted authored-file lint/format, `pnpm run premerge`, and `pnpm run validate:skill-versions -- --base-ref origin/main`. Enumerate generated consumers even if Pass A's version-guard plan has not landed. Follow `documentation/AGENTS.md` and run docs checks if changing docs-app content.

## Done criteria

- [ ] Positive completion evidence is retained and required; progress/tool-use/unknown/failed turns cannot trigger continuation.
- [ ] Pending cursor state permits later completion without replay or skipped substantive input.
- [ ] Synthetic raw-record-to-hook tests pin budget and cursor behavior for both non-Cursor providers.
- [ ] Ordinary observation and existing Cursor completion semantics remain compatible.
- [ ] All affected generated outputs/versions, authored declarations, documentation, and full repository gates pass.

## STOP conditions

- Reliable completion cannot be established for a supported provider format without a new lifecycle design or lease migration; defer that inseparable design instead of expanding this plan.
- Shared ownership with PR #70 is unresolved, or another current change already fixes this outcome.
- Proposed behavior relies on timing heuristics, silently accepts legacy unqualified digests for automatic wakes, or changes Cursor cursor accounting.
- Validation would require enabling hooks, sending messages, reading private runtime stores, or spending provider quota.

## Review focus

Treat completion qualification as an authorization-adjacent boundary: scrutinize raw-record evidence, legacy fail-closed behavior, incomplete-turn cursor retention, duplicate suppression, and the mocked hook-level no-wake assertion.
