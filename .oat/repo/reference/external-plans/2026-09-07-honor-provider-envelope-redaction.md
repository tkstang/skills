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

# Honor provider-envelope redaction controls on success and failure

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project `plan.md`. Execute it directly, or import it with `oat-project-import-plan <this-file>`.

## Outcome

Explicit `redaction.include_args` and `redaction.include_stderr` request controls determine whether those fields appear in provider CLI envelopes. Requests that omit redaction preserve the current compatibility default, while explicit `false` reliably minimizes success and failure output.

The policy covers known copies as well as top-level keys: command arguments in `diagnostics.redacted_command`, and stderr copied into failure `message`. It is not a guarantee that arbitrary provider stdout/JSON is secret-free.

## Source and live evidence

- Planned at `f5395a35`; audit finding `RUNTIME-003`.
- `src/consensus/provider-cli/types.ts:103-119` exposes both controls.
- `src/consensus/provider-cli/args.ts:740-756` preserves the parsed request and `:814-829` validates the flags.
- `src/consensus/provider-cli/envelope.ts:33-76` receives no redaction policy and copies supplied args/stderr.
- Tests validate flag types but do not prove output behavior.
- `structured-output.ts:185-193,228-240,314-324` and `subprocess.ts:341-345` place the same redacted command into diagnostics; deleting `args` alone does not remove it.
- `src/consensus/provider-cli/adapters.ts:279-333` can select the first stderr line as the failure message. Raw classification inputs must remain internal when the request excludes stderr.

## Drift check

```bash
git diff --stat f5395a35..HEAD -- src/consensus/provider-cli tests/consensus/provider-cli documentation README.md
```

## Scope

### In scope

- Request-to-envelope redaction data flow, envelope types, focused tests, and public contract documentation.
- Exact source surfaces: `types.ts`, `envelope.ts`, `structured-output.ts`, and the smallest `adapters.ts` classification/display-message seam needed to avoid known stderr copies. All paths are under `src/consensus/provider-cli/`.
- Generated provider CLI output and affected skill versions.

### Out of scope

- Redacting arbitrary provider stdout/JSON fields or inventing content filters.
- Changing the compatibility default when `redaction` or a field is omitted.
- Persisting or testing with real credentials/provider output.

## Implementation steps

### 1. Define the compatibility-preserving field contract

Document omitted/true/false behavior for each field. Keep omission and true equivalent to current inclusion where the field already appears. Make success `args?: string[]` (absence, not an empty placeholder); failure must not acquire a new args field. Existing downstream `ProviderResult.args` is already optional. For explicit `include_args:false`, omit both `args` and `diagnostics.redacted_command` after all diagnostics have merged. Preserve numeric `diagnostics.output_bytes.stderr`: a count is not stderr content.

For explicit `include_stderr:false`, omit `stderr` and use a fixed safe message derived from the error code/classification for subprocess failures whose display text may contain stderr. Preserve classification, retryability, attempt counts and terminal reason computed from the original internal data. Never strip inputs before classification or echo the rejected first line as a replacement message. Omitted/true retain existing messages. Do not apply these controls to arbitrary provider stdout/JSON or pre-request parse errors where no valid policy exists.

**Verify:** `pnpm run type-check` passes with optional success args; existing callers retain omitted-policy behavior and no schema-version change is necessary. STOP if a consumer proves the optional field incompatible.

### 2. Apply redaction at the envelope boundary

Thread the normalized policy to success and failure construction or project the completed envelope through one typed redaction helper. Apply it after diagnostics merging but before return/serialization. Explicit false removes all specified aliases, including terminal failures and submit/final-message successes; it must not alter internal subprocess invocation or classification.

**Verify:** unit tests prove omitted/default, true, and false behavior without sensitive fixtures.

### 3. Cover every major terminal path

Add cases in `tests/consensus/provider-cli/structured-output.test.ts` and `cli-process.test.ts` for submit success, final-message success, provider failure with stderr, retry exhaustion, and valid-request usage/configuration paths where fields apply. Use synthetic command/stderr markers and assert absence across the **entire serialized envelope**, not just missing top-level keys. Include empty stdout + stderr-derived auth/terminal failure, transient retry exhaustion, omitted/true compatibility, and an output-byte count that remains available. Extend `tests/consensus/provider-cli/adapters.test.ts` only for the classification/display seam; use no real output or credentials.

**Verify:** `pnpm exec vitest run tests/consensus/provider-cli/args.test.ts tests/consensus/provider-cli/structured-output.test.ts tests/consensus/provider-cli/cli-process.test.ts` passes.

### 4. Regenerate and run gates

Regenerate the provider CLI, bump affected skill versions, and update `plugins/consensus/README.md` with a request-JSON field table covering defaults, aliases and the limits of redaction. No generic content-sanitization promise or new docs/navigation hierarchy is in scope.

**Verify:** `pnpm run premerge` and `pnpm run validate:skill-versions -- --base-ref origin/main` succeed. Run targeted `pnpm exec oxlint <changed-authored-ts>` and `pnpm exec oxfmt --check <changed-authored-ts-and-docs>` excluding generated/instruction files. Node >=22, pnpm 10.13.1, canonical TS/build rules and Conventional Commits apply; no global skill synchronization or publication follows automatically.

## Done criteria

- [ ] Explicit false omits args/stderr on every applicable success/failure path.
- [ ] Omitted controls preserve compatibility.
- [ ] Types and docs accurately describe optional fields.
- [ ] Tests inspect serialized envelopes, not just request parsing.
- [ ] Excluded command/stderr markers cannot survive through diagnostics/message aliases; internal classification and budgets remain unchanged.
- [ ] Generated output, versions, validation, and tests pass.

## STOP conditions

- Correct behavior requires silently changing the default for existing callers.
- Redaction would occur only after sensitive content is logged or persisted elsewhere; report that broader boundary separately.
- Type changes require an unplanned envelope schema version.

## Review focus

Review default compatibility, coverage of all terminal branches, absence-versus-empty semantics, and whether redaction happens before any durable/logging boundary.
