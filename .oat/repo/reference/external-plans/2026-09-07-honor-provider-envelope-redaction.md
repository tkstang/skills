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

# Honor provider-envelope redaction controls on success and failure

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`. Execute it directly, or import it with `oat-project-import-plan <this-file>`.

## Outcome

Explicit `redaction.include_args` and `redaction.include_stderr` request controls determine whether those fields appear in provider CLI envelopes. Requests that omit redaction preserve the current compatibility default, while explicit `false` reliably minimizes success and failure output.

## Source and live evidence

- Planned at `f5395a35`; audit finding `RUNTIME-003`.
- `src/consensus/provider-cli/types.ts:103-119` exposes both controls.
- `src/consensus/provider-cli/args.ts:740-756` preserves the parsed request and `:814-829` validates the flags.
- `src/consensus/provider-cli/envelope.ts:33-76` receives no redaction policy and copies supplied args/stderr.
- Tests validate flag types but do not prove output behavior.

## Drift check

```bash
git diff --stat f5395a35..HEAD -- src/consensus/provider-cli tests/consensus/provider-cli documentation README.md
```

## Scope

### In scope

- Request-to-envelope redaction data flow, envelope types, focused tests, and public contract documentation.
- Generated provider CLI output and affected skill versions.

### Out of scope

- Redacting arbitrary provider stdout/JSON fields or inventing content filters.
- Changing the compatibility default when `redaction` or a field is omitted.
- Persisting or testing with real credentials/provider output.

## Implementation steps

### 1. Define the compatibility-preserving field contract

Document omitted/true/false behavior for each field. Keep omission equivalent to current inclusion where the field already appears. Decide how optional `args` is represented in the success envelope without emitting placeholders.

**Verify:** type tests encode the chosen optional-field shape.

### 2. Apply redaction at the envelope boundary

Thread the normalized policy to success and failure construction or project the completed envelope through one typed redaction helper. Explicit false must prevent the field from entering the returned object, including terminal failures and submit/final-message successes.

**Verify:** unit tests prove omitted/default, true, and false behavior without sensitive fixtures.

### 3. Cover every major terminal path

Add cases for submit success, final-message success, provider failure with stderr, retry exhaustion, and usage/configuration paths where the field is applicable. Assert serialized JSON lacks the redacted keys.

**Verify:** `pnpm exec vitest run tests/consensus/provider-cli/args.test.ts tests/consensus/provider-cli/structured-output.test.ts tests/consensus/provider-cli/cli-process.test.ts` passes.

### 4. Regenerate and run gates

Regenerate the provider CLI, bump affected skill versions, and update API documentation with exact default semantics.

**Verify:** `pnpm run build:check && pnpm run validate:skill-versions -- --base-ref origin/main && pnpm run validate && pnpm test` succeeds.

## Done criteria

- [ ] Explicit false omits args/stderr on every applicable success/failure path.
- [ ] Omitted controls preserve compatibility.
- [ ] Types and docs accurately describe optional fields.
- [ ] Tests inspect serialized envelopes, not just request parsing.
- [ ] Generated output, versions, validation, and tests pass.

## STOP conditions

- Correct behavior requires silently changing the default for existing callers.
- Redaction would occur only after sensitive content is logged or persisted elsewhere; report that broader boundary separately.
- Type changes require an unplanned envelope schema version.

## Review focus

Review default compatibility, coverage of all terminal branches, absence-versus-empty semantics, and whether redaction happens before any durable/logging boundary.
