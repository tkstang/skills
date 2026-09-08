---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - .
  - .oat/repo/reference/reviews/2026-09-07-standard-repo-audit.md
  - .oat/repo/reference/evidence/skills-standard-audit-2026-09-07-run-01/raw/dossiers/runtime-gather-lane-01.json
oat_external_plan_commit: f5395a35
oat_backlog_items: []
oat_issue_url: null
created: '2026-09-08T00:16:29Z'
---

# Enforce every JSON-Schema constraint used by shipped consensus verdicts

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`. Execute it directly, or import it with `oat-project-import-plan <this-file>`.

## Outcome

The generic provider CLI accepts a verdict only when it satisfies the complete dependency-free JSON-Schema profile used by shipped consensus schemas. Final-message and submit-sidecar paths reject invalid enums/constants, extra properties, malformed nested objects, and invalid array items consistently.

## Source and live evidence

- Planned at `f5395a35` on 2026-09-07; audit finding `RUNTIME-001`.
- `src/consensus/provider-cli/schema-validate.ts:5-45` validates only object type, top-level required fields, and direct property types.
- `plugins/consensus/skills/decide/schemas/verdict-parallel.schema.json:4-47` uses `additionalProperties`, `const`, `enum`, nested `required`/`properties`, and array `items`.
- Both success paths call the same subset validator in `src/consensus/provider-cli/structured-output.ts`.

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
- Negative integration cases for final-message and submit-sidecar validation.
- Generated provider CLI output and affected skill versions.
- Documentation of the supported schema profile if no current surface names it.

### Out of scope

- A general Draft-07 implementation or new runtime dependency.
- Keywords not used by shipped schemas unless trivially necessary for correct recursion.
- Changing verdict schemas or provider prompts except to align error feedback.

## Implementation steps

### 1. Inventory the shipped schema keyword profile

Mechanically enumerate keywords in canonical shipped schemas and add a test that fails when a future schema introduces an unsupported validation keyword.

**Verify:** `pnpm exec vitest run tests/consensus/provider-cli/schema-validate.test.ts` passes and the keyword inventory is complete.

### 2. Implement recursive validation for the owned profile

Support root/nested object constraints, `required`, `properties`, `additionalProperties: false`, primitive types, `integer`, `const`, `enum`, arrays, and `items`. Emit bounded path-aware errors without copying full provider output.

**Verify:** focused unit tests reject one case per supported constraint and accept every shipped valid fixture.

### 3. Prove both terminal success paths use the full validation

Add final-message and submit-sidecar negative cases for enum, nested required, extra property, and array-item violations. Preserve retry classification and bounded feedback.

**Verify:** `pnpm exec vitest run tests/consensus/provider-cli/schema-validate.test.ts tests/consensus/provider-cli/structured-output.test.ts` passes.

### 4. Regenerate and run repository gates

Regenerate provider CLI output, bump affected skill versions, and run full verification.

**Verify:** `pnpm run build:check && pnpm run validate && pnpm run validate:skill-versions -- --base-ref origin/main && pnpm test` succeeds.

## Done criteria

- [ ] Every keyword used by shipped schemas is either enforced or rejected by the inventory gate.
- [ ] Nested and collection constraints are recursively validated.
- [ ] Both submit and final-message success paths have negative integration cases.
- [ ] Error output remains bounded and secret-safe.
- [ ] Generated output, versions, validation, and tests pass.

## STOP conditions

- A shipped schema requires an unsupported construct that cannot be implemented safely without redesign.
- The solution adds a runtime dependency.
- Validation semantics would reject previously documented valid verdicts without a migration decision.

## Review focus

Review recursion/path reporting, object-versus-array handling, additional-property semantics, keyword inventory completeness, and parity between terminal paths.
