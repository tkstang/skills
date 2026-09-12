---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: backlog-review
oat_external_plan_sources:
  - .oat/repo/pjm/backlog/reviews/backlog-and-roadmap-review.md
  - .oat/repo/pjm/backlog/items/BL-260723-investigate-live-submit.md
oat_external_plan_commit: f5395a35
oat_backlog_items:
  - BL-260723-investigate-live-submit
oat_issue_url: null
created: '2026-09-08T00:16:29Z'
updated: '2026-09-11T13:15:47.721Z'
oat_external_plan_reverified_commit: f5395a35
---

# Reconcile the live submit verdict-source contract with real provider behavior

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`. Execute it directly, or import it with `oat-project-import-plan <this-file>`.

## Outcome

The live-provider test, stub fixtures, runtime, and documentation express one evidence-backed contract for when `verdict_source` is `submit` versus `final_message`. A deliberate live run proves the chosen contract without weakening assertions merely to make the gate green.

## Source and live evidence

- Planned at `f5395a35` on 2026-09-07.
- `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts:18-28` requires explicit opt-in because the test spends provider quota.
- The test asserts `submit` at `:71-79`.
- `src/consensus/provider-cli/structured-output.ts:222-247` prefers a valid submit sidecar, then deliberately falls back to final-message extraction.
- The backlog records one live run returning `final_message`; this planning run did not repeat it.
- `2026-07-17-live-provider-e2e-visibility.md` established the gate but did not adjudicate this later mismatch.

## Drift check

```bash
git diff --stat f5395a35..HEAD -- src/consensus/provider-cli tests/consensus/provider-cli RELEASING.md package.json
```

## Scope

Repository contract: Node >=22, pnpm 10.13.1, dependency-free shipped runtime, canonical TypeScript, Conventional Commits. No live execution is authorized by plan creation or ordinary implementation approval.

### In scope

- Deterministic tracing/tests around submit-command injection, sidecar creation/read/cleanup, and final-message fallback.
- One separately authorized, budgeted diagnostic `pnpm run test:live-e2e` observation; if code or the assertion changes, a second separately authorized confirmation run against the final tree. Each grant specifies provider, runtime/sandbox policy, timeout and quota budget. Neither grant is supplied by this plan.
- The smallest runtime, fixture, assertion, and documentation change required by the resulting contract.
- Required generated outputs and skill version bumps if runtime behavior changes.
- Exact evidence/test surfaces: `src/consensus/provider-cli/structured-output.ts`, `commands.ts`, `submit-capture.ts`, their existing tests, and `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts`; update `RELEASING.md` and `plugins/consensus/README.md` only where the verified submit/fallback contract changes their wording.

### Out of scope

- Provider installation/authentication, credential changes, broader provider matrices, or repeated exploratory live runs.
- Removing useful fallback behavior without a compatibility decision.
- Treating a passing stub as evidence of live wiring.

## Implementation steps

### 1. Trace the submit path without a live provider

Use existing stub tests to prove the exact command/prompt presented to the child, submit capture environment, sidecar lifecycle, and fallback classification. Add temporary diagnostics only if they are secret-safe and removed or converted into durable assertions.

**Verify:** `pnpm exec vitest run tests/consensus/provider-cli/structured-output.test.ts tests/consensus/provider-cli/evidence` passes.

### 2. Obtain separate authorization and run one bounded live observation

Confirm an authenticated provider is already available via the documented preflight without printing credentials. Before any live run, inspect the test's failure reporting: it currently serializes the entire envelope at `submit-live.e2e.test.ts:71-74`. Replace that reporting with an allowlisted, synthetic-evidence summary and test it deterministically; do not copy prompts, args, stderr, credentials, or runtime output into artifacts. The live test defaults to a writable provider policy, so quota approval alone is insufficient: the grant must name the runtime policy and permitted writable boundary. With that explicit grant, run the named live script once, retaining only provider selector, exit state, sidecar-presence boolean, and verdict-source classification.

**Verify:** `pnpm run test:live-e2e` reaches a terminal result under the approved timeout.

### 3. Choose and encode the contract from evidence

- If submit is required and the provider failed to invoke it, repair prompt/command delivery and keep the strict assertion.
- If final-message fallback is an intentionally valid live success, document the distinction and test both acceptable paths without erasing submit coverage.
- If fixtures overstate capability, correct fixtures and add a contract decision explaining why.

Do not select among these branches before the live evidence exists.

**Verify:** `pnpm exec vitest run tests/consensus/provider-cli/structured-output.test.ts tests/consensus/provider-cli/evidence` proves the selected deterministic contract. If any runtime/fixture/assertion changes, request one separate bounded live confirmation against the final tree. Without that grant, stop with diagnosis complete but reconciliation/live verification pending; do not close the source item or claim the repair is proven. A further live failure returns to Thomas; it does not authorize an automatic retry.

### 4. Regenerate and run gates

When runtime changes, regenerate outputs and bump every affected skill version. Update release documentation only to reflect verified behavior.

**Verify:** `pnpm run premerge` and `pnpm run validate:skill-versions -- --base-ref origin/main` succeed. Check only changed authored TS/JS with `pnpm exec oxlint <changed-authored-files>` and `pnpm exec oxfmt --check <changed-authored-files>`, excluding generated and agent-instruction files.

## Done criteria

- [ ] Root cause is recorded with redacted live evidence.
- [ ] Runtime, fixtures, live assertion, and docs agree on one contract.
- [ ] Submit behavior remains directly tested even if fallback is accepted.
- [ ] If runtime, fixtures, or the live assertion changed, final-tree live confirmation passed under its own explicit grant; otherwise this item remains open with that gate pending.
- [ ] Required builds, tests, validation, and version gates pass.

## STOP conditions

- Explicit authorization for provider quota is absent.
- A usable provider is unavailable or would require setup/credential changes.
- One observation is inconclusive, or a required confirmation/retry lacks a fresh grant. A single observation does not establish repeatability.
- Resolution requires weakening the assertion without a documented contract decision.

## Review focus

Review the evidentiary basis for the chosen contract, separation of submit and fallback tests, credential-safe diagnostics, and complete generated/version fallout.
