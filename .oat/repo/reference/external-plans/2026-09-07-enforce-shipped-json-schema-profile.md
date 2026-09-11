---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - .
  - .oat/repo/reference/reviews/2026-09-07-standard-repo-audit.md
  - .oat/repo/reference/reviews/2026-09-11-audit-astra-review.md
  - .oat/repo/reference/evidence/skills-standard-audit-2026-09-07-run-01/raw/dossiers/runtime-gather-lane-01.json
oat_external_plan_commit: f5395a35
oat_backlog_items: []
oat_issue_url: null
created: '2026-09-08T00:16:29Z'
updated: '2026-09-11T13:29:20Z'
---

# Enforce every JSON-Schema constraint used by shipped consensus verdicts

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`. Execute it directly, or import it with `oat-project-import-plan <this-file>`.

## Outcome

The generic provider CLI accepts a verdict only when it satisfies the complete dependency-free JSON-Schema profile used by shipped consensus schemas. Final-message and submit-sidecar paths reject invalid enums/constants, extra properties, malformed nested objects, and invalid array items consistently.

This closes a provider-envelope/advisory contract gap, not universal acceptance of malformed verdicts: core and panel already perform domain validation downstream. Earlier rejection changes some recovery opportunities; the retry policy below makes that consequence explicit.

## Source and live evidence

- Planned at `f5395a35` on 2026-09-07; audit finding `RUNTIME-001`.
- `src/consensus/provider-cli/schema-validate.ts:5-45` validates only object type, top-level required fields, and direct property types.
- `plugins/consensus/skills/decide/schemas/verdict-parallel.schema.json:4-47` uses `additionalProperties`, `const`, `enum`, nested `required`/`properties`, and array `items`.
- Both success paths call the same subset validator in `src/consensus/provider-cli/structured-output.ts`.
- `src/consensus/provider-cli/commands.ts:292-295` also validates direct `runSubmit` before writing the capture file.
- `src/consensus/core/loop-provider.ts:316-329,365-379` sends no `max_attempts` and retries only domain shape/cap failures. Provider CLI defaults to one attempt at `structured-output.ts:134`; `tests/consensus/core/provider-retry-boundary.test.ts:115-139` forbids outer retries of provider schema errors.

## Drift check

```bash
git diff --stat f5395a35..HEAD -- src/consensus/provider-cli plugins/consensus/skills/*/schemas tests/consensus/provider-cli
```

## Repository conventions

- Shipped runtime stays dependency-free; use Node standard library APIs.
- Edit canonical TypeScript, run `pnpm run build`, and bump every affected skill version.
- Required gates: focused Vitest, `pnpm run build:check`, `pnpm run validate`, version validation, and full tests.

## Scope

### In scope

- `src/consensus/provider-cli/schema-validate.ts` and its focused tests.
- Negative integration cases for final-message, submit-sidecar consumption, and direct `runSubmit` validation; `tests/consensus/provider-cli/commands.test.ts` and `tests/consensus/core/provider-retry-boundary.test.ts`.
- Bounded retry-policy characterization at the provider CLI → core boundary; no new retry layer or budget increase.
- Generated provider CLI output and affected skill versions.
- Documentation of the supported schema profile if no current surface names it.

### Out of scope

- A general Draft-07 implementation or new runtime dependency.
- Keywords not used by shipped schemas unless trivially necessary for correct recursion.
- Changing verdict schemas or provider prompts except to align error feedback.

## Implementation steps

### 1. Inventory the shipped schema keyword profile

Mechanically enumerate the 17 tracked shipped consensus schemas and add a test that fails when a future schema introduces an unsupported validation keyword. The current validation-keyword profile is `type`, `required`, `properties`, `additionalProperties`, `const`, `enum`, `items`; current metadata is `$schema`, `$id`, `title`. Traverse schema-bearing nodes, not arbitrary object keys: property names and values inside `const`/`enum` are data, not keywords. Explicitly allow metadata without pretending it adds validation. Shipped types are object/string/array; retain any previously supported primitive-type behavior while avoiding a general Draft-07 implementation.

**Verify:** `pnpm exec vitest run tests/consensus/provider-cli/schema-validate.test.ts` passes and the keyword inventory is complete.

### 2. Implement recursive validation for the owned profile

Support root/nested object constraints, `required`, `properties`, `additionalProperties: false`, primitive types, `integer`, `const`, `enum`, arrays, and `items`. Emit bounded path-aware errors without copying full provider output.

**Verify:** focused unit tests reject one case per supported constraint and accept every shipped valid fixture.

### 3. Prove both terminal success paths use the full validation

Add final-message and submit-sidecar negative cases for enum, nested required, extra property, and array-item violations. Preserve retry classification and bounded feedback.

Test the direct submit command rejecting invalid verdicts without writing/replacing capture output. Preserve the existing fallback: invalid sidecar plus valid final message succeeds with `verdict_source: final_message`; invalid sidecar plus invalid final message reaches the existing failure path.

**Retry policy:** preserve provider CLI ownership, its requested `max_attempts` budget, and the outer wrapper's no-retry rule for `PROVIDER_SCHEMA_VALIDATION`. Under the current wrapper default of one provider attempt, a newly detected schema violation now fails immediately rather than reaching a later domain retry. Document that intentional earlier rejection; do not claim complete behavioral parity. Add malformed-first/valid-next fixtures proving explicit provider `max_attempts: 2` permits exactly two invocations, whereas the default wrapper invokes once and does not multiply budgets. If preserving the old three domain-attempt recovery is required, STOP for an approved retry-contract change; this plan does not silently widen either budget.

**Verify:** `pnpm exec vitest run tests/consensus/provider-cli/schema-validate.test.ts tests/consensus/provider-cli/structured-output.test.ts tests/consensus/provider-cli/commands.test.ts tests/consensus/core/provider-retry-boundary.test.ts` passes with exact invocation-count assertions.

### 4. Regenerate and run repository gates

Regenerate provider CLI output, bump affected skill versions, and run full verification.

Update `documentation/docs/user-guide/consensus/phone-a-friend.md` with the supported profile and limits, and `plugins/consensus/README.md` with the earlier-rejection/retry distinction. Do not claim complete Draft-07 support. Follow `documentation/AGENTS.md`; no new docs page or navigation change is needed.

**Verify:** `pnpm run premerge` and `pnpm run validate:skill-versions -- --base-ref origin/main` succeed. Run targeted `pnpm exec oxlint <changed-authored-ts>` and `pnpm exec oxfmt --check <changed-authored-ts-and-docs>`, excluding generated and instruction files; type-check and smoke must not be omitted.

## Done criteria

- [ ] Every keyword used by shipped schemas is either enforced or rejected by the inventory gate.
- [ ] Nested and collection constraints are recursively validated.
- [ ] Both submit and final-message success paths have negative integration cases.
- [ ] Direct submit does not persist an invalid verdict; fallback behavior and exact provider/outer attempt counts are pinned.
- [ ] Error output remains bounded and secret-safe.
- [ ] Generated output, versions, validation, and tests pass.

## STOP conditions

- A shipped schema requires an unsupported construct that cannot be implemented safely without redesign.
- The solution adds a runtime dependency.
- Validation semantics would reject previously documented valid verdicts without a migration decision.
- Required recovery semantics cannot tolerate the documented earlier failure under the default single attempt; obtain a retry-ownership decision rather than multiplying retries.

## Review focus

Review recursion/path reporting, object-versus-array handling, additional-property semantics, keyword inventory completeness, and parity between terminal paths.
