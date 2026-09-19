---
oat_generated: true
oat_generated_at: 2026-09-19T15:22:45Z
oat_review_scope: p01
oat_review_type: code
oat_review_invocation: subagent
oat_project: .oat/projects/shared/agent-messaging
oat_review_head_sha: 057cc67a527c18e81d1cd7aaba8b925df4d746c3
oat_review_range: 67b811def41104d75a05d6175229e6e5539ccc9d..057cc67a527c18e81d1cd7aaba8b925df4d746c3
oat_prior_review_artifact: .oat/projects/shared/agent-messaging/reviews/code-p01-rereview-2026-09-19T1445Z.md
oat_prior_review_head_sha: 67b811def41104d75a05d6175229e6e5539ccc9d
---

# Code Review: p01 Final Re-review Round 3

**Reviewed:** 2026-09-19T15:22:45Z
**Scope:** Phase p01, tasks p01-t01 through p01-t05; full implementation through the settled head, with explicit re-review of every round-2 finding and regression analysis
**Full phase range:** `91f5f2383883e6dd5f4506ebf6371d26099f59ad..057cc67a527c18e81d1cd7aaba8b925df4d746c3`
**Re-review range:** `67b811def41104d75a05d6175229e6e5539ccc9d..057cc67a527c18e81d1cd7aaba8b925df4d746c3`
**Files reviewed:** 40 changed files plus the quick-mode requirements, repository contracts, and both prior p01 review artifacts
**Commits:** 14 after the phase base; 4 after the round-2 reviewed head
**Verdict:** Blocking

## Summary

All six Important and the one Medium round-2 findings are resolved as written, including the stabilized real-process contention test, and every requested repository gate passes. Phase 1 is nevertheless not ready to advance: independent regression probes found three blocking correctness/safety gaps in the shared storage layer—authoritative reads follow intermediate symlinks while rejected writes mutate the escaped directory, path-shape validation depends on unrelated ancestor names in a legal configured root, and `open` cannot retry its own partial commit because it regenerates `createdAt`.

Findings: 0 critical, 3 important, 0 medium, 0 minor

## Review Scope and Dispatch Evidence

- Workflow mode: quick.
- Evidence sources used: `discovery.md`, approved `design.md`, `plan.md`, `implementation.md`, `state.md`, `src/AGENTS.md`, `documentation/docs/engineering/architecture/generated-runtime.md`, both prior p01 review artifacts, the full Phase 1 diff, and current code/tests.
- Tasks: p01-t01, p01-t02, p01-t03, p01-t04, p01-t05.
- Exact ancestry verified: phase base `91f5f2383883e6dd5f4506ebf6371d26099f59ad`, round-2 reviewed head `67b811def41104d75a05d6175229e6e5539ccc9d`, fix base `2cdc63630ed5e589d3161e4992dc7409beb2e775`, fix `66de3e5b1b52ad0c5147dd00305db0d33dd17fdd`, test recovery `5d94e390b341d82d2e92d00cf661808ac7e8704f`, and settled head `057cc67a527c18e81d1cd7aaba8b925df4d746c3` form the supplied ancestral chain.
- Dispatch policy / ceiling: `high` / `high`.
- Selected reviewer target: `oat-reviewer-gpt-5-6-sol-high`.
- Model / effort axes: `selected:gpt-5.6-sol` / `selected:high`.
- Dispatch stamp: `Dispatch: scope=p01-review-3 action=review role=reviewer producer=unknown provenance=unknown model_axis=selected:gpt-5.6-sol effort_axis=selected:high dispatch_policy=high dispatch_ceiling=high target=oat-reviewer-gpt-5-6-sol-high`.
- Reconnaissance was not delegated; all load-bearing source verification and adversarial probing were completed inline.

## Findings

### Critical

None.

### Important

- **Authoritative reads follow an intermediate symlink, and rejected writes mutate the escaped directory** (`src/shared/collaboration/records.ts:397`)
  - Issue: `readJsonRecord` validates only the final file with `lstat`; it receives no configured root and never checks the parent chain or canonical containment. `ensurePrivateDirectory` performs `mkdir` and `chmod` before its canonical containment check (`src/shared/collaboration/records.ts:459`). A direct probe opened a valid collaboration, moved `<root>/collaborations` outside the root, and replaced it with a symlink. `resolveMember` still returned the external member as current. A subsequent send rejected with `UNSAFE_PATH`, but only after creating the external recipient inbox directory and chmodding it to `0700`.
  - Reproduction: after moving the valid collaboration tree to an external temporary directory and symlinking `<root>/collaborations` to it, the probe returned `resolvedPin={runtime:"cursor",sessionId:"reviewer"}`, `sendError.code="UNSAFE_PATH"`, `externalInboxCreated=true`, and `externalInboxMode="700"`.
  - Impact: A configured collaboration root no longer confines authoritative reads or preflight mutations. Commands can trust identity/mail/log state outside the selected store and can create or change permissions on directories outside it even while reporting failure. This violates the explicit owner/type/canonical-containment and symlink-rejection contract.
  - Fix: Make authoritative reads, enumerations, and writes use one root-scoped path validator. Walk every existing component from the configured root with no-follow checks before reading or mutating; verify canonical containment before `mkdir`/`chmod`, recheck immediately before publication, and ensure rejection leaves the external tree untouched. Add ancestor-symlink controls for collaboration, member, binding, inbox, ack, log-entry, departure, and close paths, not only `collaboration.md`.
  - Requirement: p01-t01 private owner-checked paths, symlink/containment safety, and design lines 182-187.

- **Record-kind detection is polluted by unrelated ancestor directory names** (`src/shared/collaboration/records.ts:212`)
  - Issue: `validateAuthoritativeRecord` selects schemas with global checks such as `segments.includes('members')` rather than classifying the path relative to `collaborations/<collaborationId>/`. A valid absolute override whose ancestor is named `members`, `bindings`, `departures`, `inbox`, `acks`, `log`, or `entries` can therefore cause a different record type to be applied. A direct probe used an absolute root ending in `/members`: `openCollaboration` reported success, but the immediately following `resolveMember` rejected its valid generation-zero binding as `MALFORMED_RECORD: member path identity does not match alias`.
  - Reproduction: set the collaboration root to a fresh absolute `<tmp>/members`, open alias `driver`, then call `resolveMember`; the first call succeeds and the second fails with the error above without any external corruption or unsupported input.
  - Impact: A supported root override can create a collaboration that becomes unreadable as soon as it is resolved, leaving successfully reported authoritative state stranded. The failure depends on ordinary host path names rather than record content and contradicts the absolute-override/store-separation contract.
  - Fix: Parse and validate the record path only relative to an already validated `collaborations/<uuid>/` root, or pass an explicit expected record kind from each caller. Reject malformed layouts, but never infer a record type from arbitrary ancestor segments. Add parameterized tests for every reserved layout word in the configured root.
  - Requirement: p01-t01 absolute root overrides, schema-v1 validation, and private path/layout correctness.

- **`open` cannot retry a partially committed collaboration** (`src/shared/collaboration/membership.ts:112`)
  - Issue: `openCollaboration` publishes `collaboration.json` with a fresh `createdAt`, then calls the multi-file join. If the process fails after the collaboration record (or alias) is published, the same-ID retry regenerates the timestamp and conflicts with its own existing collaboration before join recovery can run. A direct fault-hook probe failed after alias publication with `simulated crash`; retrying the identical input returned `RECORD_CONFLICT: record ID already has different content`.
  - Reproduction: call `openCollaboration` with `afterAliasPublish` throwing, wait for a new timestamp tick, then repeat the same root, collaboration ID, label, task, alias, pin, and worktree without the hook; the retry conflicts instead of completing generation zero.
  - Impact: The public `open` command cannot recover from an explicitly tested process-crash class. With an auto-generated collaboration UUID, the error envelope also withholds the generated ID and paths, so the operator cannot even issue the lower-level `join` recovery; durable orphan state remains with no v1 cleanup path.
  - Fix: Treat an existing validated `collaboration.json` with the same stable ID/label/task as an idempotent open attempt and reuse its committed `createdAt`, then invoke the existing exact initial-join recovery. Preserve conflict for changed stable fields. Ensure CLI failures after possible publication report the collaboration ID and resolved paths, and add actual child termination/retry tests around the open-to-initial-join boundary.
  - Requirement: p01-t01 identical retry/crash semantics, p01-t02 open plus recoverable generation-zero join, and the discovery crash/retry success criterion.

### Medium

None.

### Minor

None.

## Round-2 Finding Disposition

| Round-2 finding                                             | Disposition                    | Evidence                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Binding generation 64 published then member unreadable      | Resolved                       | `takeOverMembership` refuses once generation 63 is current; the boundary plus competing-winner test leaves generation 63 readable and rejects generation 64.                                                                                                                       |
| Stale initial join retry redirects to successor             | Resolved                       | Recovery now requires a non-departed current generation-zero exact pin; takeover and departure retry controls return `STALE_BINDING`.                                                                                                                                              |
| Preserved pre-takeover inbox mislabeled inert               | Resolved                       | List, exact read, and ack expose old-generation mail as non-inert `recipient-reassigned`; closure remains the only inert presentation state.                                                                                                                                       |
| Log render escapes root via intermediate symlink            | Resolved for the rendered view | `writeView` and `inspectRenderedView` validate the directory chain against the configured root before creation/replacement; focused ancestor-symlink tests pass. I1 is a separate shared authoritative-record containment gap.                                                     |
| Membership/lifecycle/ack hashes and cross-checks incomplete | Resolved                       | All modeled authoritative records carry verified canonical hashes; nested initial bindings are validated; current/inherited acks are checked against message hashes and binding identity.                                                                                          |
| Process-isolation/crash proof simulated                     | Resolved                       | `process-fixture.ts` runs the actual publisher at file-sync/link/directory-sync barriers and real source-runtime senders in distinct child processes. Recovery commit `5d94e390` pre-attaches exit promises, bounds waits, and guarantees cleanup; the target and full suite pass. |
| Current OAT tracking text stale                             | Resolved                       | `state.md` and `implementation.md` identify both fix rounds and recovery as complete, make final re-review the active boundary, and route p02 only after a pass.                                                                                                                   |

## Requirements and Design Alignment

### Requirements Coverage

| Requirement                          | Status      | Notes                                                                                                                                                                         |
| ------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| p01-t01 immutable storage primitives | Partial     | Publication, integrity hashes, bounds, and process-crash proof work, but I1 and I2 violate root confinement and legal override behavior.                                      |
| p01-t02 membership/takeover/closure  | Partial     | Binding caps, exact stale retry, takeover replay, departure, and close races work; I3 leaves public open crash recovery non-idempotent.                                       |
| p01-t03 messages/receipts            | Implemented | Addressed immutable mail, reply references, bounded presentation, ack inheritance/cross-checks, race reporting, restart persistence, and real process contention are covered. |
| p01-t04 authoritative log/view       | Implemented | Immutable entries, context, digest/staleness, deterministic rendering, concurrent-render detection, and rendered-view ancestor containment are covered.                       |
| p01-t05 CLI/distributions/docs       | Partial     | Both generated forms, inventories, version/changelog, docs, copied execution, and exit contracts pass; the CLI inherits I1-I3 from its shared storage/open path.              |

### Extra Work (not in declared requirements)

None. The fix, recovery, and bookkeeping commits stay within Phase 1 product, proof, packaging, and review-tracking surfaces.

## Verification Performed

```bash
git merge-base --is-ancestor 91f5f2383883e6dd5f4506ebf6371d26099f59ad 057cc67a527c18e81d1cd7aaba8b925df4d746c3
git merge-base --is-ancestor 67b811def41104d75a05d6175229e6e5539ccc9d 057cc67a527c18e81d1cd7aaba8b925df4d746c3
git merge-base --is-ancestor 2cdc63630ed5e589d3161e4992dc7409beb2e775 66de3e5b1b52ad0c5147dd00305db0d33dd17fdd
git merge-base --is-ancestor 66de3e5b1b52ad0c5147dd00305db0d33dd17fdd 5d94e390b341d82d2e92d00cf661808ac7e8704f
git merge-base --is-ancestor 5d94e390b341d82d2e92d00cf661808ac7e8704f 057cc67a527c18e81d1cd7aaba8b925df4d746c3
git diff --check 91f5f2383883e6dd5f4506ebf6371d26099f59ad..057cc67a527c18e81d1cd7aaba8b925df4d746c3
pnpm run test:vitest src/shared/collaboration/records.test.ts src/shared/collaboration/membership.test.ts src/shared/collaboration/messages.test.ts src/shared/collaboration/log.test.ts src/skills/agent-messaging/src/cli.test.ts src/skills/agent-messaging/src/packaging.test.ts tests/release/versioning.test.ts tests/repo/layout.test.ts tests/repo/plugin-manifests.test.ts
pnpm run test:vitest tests/tooling/generated-output-sync.test.ts
pnpm run build:check
pnpm run validate
pnpm run type-check
pnpm run validate:skill-versions -- --base-ref 91f5f2383883e6dd5f4506ebf6371d26099f59ad --json
pnpm exec oxfmt --check src/shared/collaboration src/skills/agent-messaging documentation/docs/user-guide/skills/agent-messaging.md CHANGELOG.md tests/repo/layout.test.ts tests/repo/plugin-manifests.test.ts
pnpm exec oxlint src/shared/collaboration src/skills/agent-messaging/src tests/repo/layout.test.ts tests/repo/plugin-manifests.test.ts
pnpm run test
pnpm run smoke
```

- Focused Phase 1/repository result: 9 files, 70 tests passed.
- Isolated generated-output result: 1 file, 25 tests passed. It was not run concurrently with another suite.
- Full result: 150 files passed, 1 skipped; 2,116 tests passed, 1 skipped.
- Build freshness, validation, type-check, direct skill-version/plugin-version validation, scoped formatting/lint, smoke, ancestry, and diff checks passed.
- Direct temporary-store probes reproduced all three Important findings without modifying repository source or tracked state.
- The documentation production build was not rerun because its prebuild writes generated inventory/build output and this reviewer was authorized to write only the declared review artifact. The committed docs were inspected, formatting passed, and repository validation passed.
- The worktree was clean after all tests and before writing this review artifact.

## Recommended Next Step

The configured two fix rounds are exhausted, so stop before p02 and escalate this blocking final-cycle result. If the user authorizes another bounded Phase 1 correction, fix I1-I3 together around one root-scoped path/record API, add the three direct regression controls, rerun the complete sequential gate set, and obtain a fresh independent review before advancing.
