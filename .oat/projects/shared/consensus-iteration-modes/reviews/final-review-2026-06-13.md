---
oat_generated: true
oat_generated_at: 2026-06-13
oat_review_scope: final
oat_review_type: code
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-iteration-modes
---

# Code Review: final

**Reviewed:** 2026-06-13
**Scope:** Final code review for `consensus-iteration-modes`
**Range:** `970c8a6db293e85514a8a8e274169635cbac73b1..HEAD`
**Files reviewed:** 58 changed files, with focused source review of the consensus loop/wrapper, schemas, tests, docs, and project artifacts.
**Commits:** 74

## Review Scope

**Project:** `.oat/projects/shared/consensus-iteration-modes`
**Type:** code
**Scope:** final (`970c8a6db293e85514a8a8e274169635cbac73b1..HEAD`)
**Workflow mode:** spec-driven

**Artifact Paths:**

- Spec: `.oat/projects/shared/consensus-iteration-modes/spec.md`
- Design: `.oat/projects/shared/consensus-iteration-modes/design.md`
- Plan: `.oat/projects/shared/consensus-iteration-modes/plan.md`
- Implementation: `.oat/projects/shared/consensus-iteration-modes/implementation.md`
- Discovery: `.oat/projects/shared/consensus-iteration-modes/discovery.md`

**Files Changed:** 58 files across OAT project artifacts, consensus plugin docs, `consensus-loop.mjs`, `consensus-refine.mjs`, new verdict/synthesis schemas, smoke script, and the test matrix.

**Deferred Findings Ledger (final scope only):**

- Deferred Medium count: 0
- Deferred Minor count: 0
- Ledger: No unresolved prior review findings were found in `implementation.md` or prior review artifacts. Existing deviations are documented as accepted design/plan deltas.

## Summary

The implementation covers the major requirements: both parallel modes, v1 records, escalation routing, resume paths, provider preflight hardening, docs, smoke flow, and a large regression matrix are present and green. I found one Critical persistence bug in the host-decision audit trail: the in-memory record carries the metadata needed for FR5 promotion, but the artifact renderer drops it from the canonical `consensus-verdict` block, so a later resume cannot reliably recognize that the host already answered the same trigger.

## Findings

### Critical

- **HOST_DECISION canonical blocks drop the routing metadata required for restart-safe promotion** (`plugins/consensus/skills/refine/scripts/consensus-refine.mjs:1066`)
  - Issue: `appendIntervention` correctly writes host decisions with `decision_kind` and `escalation_trigger` (`plugins/consensus/skills/refine/scripts/consensus-loop.mjs:1245`), and `routeEscalation` depends on `record.escalation_trigger === trigger` plus `decision_kind === 'defer_to_user'` to perform genuinely-stuck promotion (`plugins/consensus/skills/refine/scripts/consensus-loop.mjs:2398`). But `renderRecord` only persists `schema_version`, `verdict`, `reasoning`, optional `critique`, `proposed_artifact`, and `concerns` into the canonical `consensus-verdict` block (`plugins/consensus/skills/refine/scripts/consensus-refine.mjs:1066`). A rendered `HOST_DECISION` artifact therefore loses `decision_kind` and `escalation_trigger`.
  - Impact: FR5 is not restart-safe. A run can escalate to the host, resume once, and keep the metadata in memory, but the persisted resumed artifact no longer contains the trigger/kind. If that artifact is resumed again and the same trigger re-fires, `priorHostDecisionForTrigger` cannot detect the previous host decision, so repeat-fire/defer-to-user promotion can fail and the loop may route back to host instead of escalating to the user as the design requires.
  - Evidence: A direct renderer check with a `HOST_DECISION` record produced this canonical block:

    ```json
    {
      "schema_version": "v1",
      "verdict": "HOST_DECISION",
      "reasoning": "blend them"
    }
    ```

  - Fix: Preserve intervention metadata in `renderRecord` for `HOST_DECISION`: at minimum `decision_kind` and `escalation_trigger`; preserving `agent`, `turn_index`, `round_index`, `artifact_hash`, and `iteration_mode` would make the canonical record less dependent on inference. Add a regression test that renders a host-decision artifact, parses it via `parseDeliberationArtifactForResume`, then confirms the parsed `HOST_DECISION` still has `decision_kind` and `escalation_trigger`, and that repeat-fire promotion after that parsed resume routes to `user`.
  - Requirement: FR5 / design escalation mechanics (`design.md` requires repeat-fire after a `HOST_DECISION` for the same trigger to promote to the user).

### Important

None.

### Medium

None.

### Minor

None.

## Requirements/Design Alignment

**Evidence sources used:** `spec.md`, `design.md`, `plan.md`, `implementation.md`, source diff, tests, smoke/validate/test output, and live Paseo provider preflight.

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| FR1 | implemented | Parallel-revision mode, convergence predicates, oscillation detection, and tests are present. |
| FR2 | implemented | Parallel-synthesized mode, synthesis records, validation/caps, reliability retry, and tests are present. |
| FR3 | implemented | `--iteration`, cost disclosure, and call counts are present. |
| FR4 | implemented | v1 schemas and fail-closed v0 resume are present. |
| FR5 | partial | Runtime routing exists, but host-decision routing metadata is not preserved in rendered artifacts, breaking restart-safe promotion. |
| FR6 | implemented | Synthesizer default/override validation is present. |
| FR7 | implemented | Resume matrix covers mid-peer, pending synthesis, post-synthesis, and pending escalation paths. |
| FR8 | implemented | Parallel section packet/fan-in metadata is threaded. |
| FR9 | implemented | Alternating regression tests and schema migration behavior are covered. |
| NFR1 | implemented | Deterministic mocked tests and fixed record ordering are present. |
| NFR2 | implemented | No new runtime dependencies; Node standard library remains the runtime surface. |
| NFR3 | implemented | Large unit/integration/smoke matrix is green. |
| NFR4 | partial | Artifact legibility is generally addressed, but the host-decision canonical block omits decision metadata needed to audit and resume FR5 correctly. |
| NFR5 | implemented | Routine event payload inventory tests pass; `escalation_required` is the content-bearing event. |

### Extra Work (not in declared requirements)

None requiring rollback. Phase 7 live-provider hardening is documented as an accepted scope adjustment because it fixed ship-blocking defects found during dogfooding.

## Verification Commands

Commands run during review:

```bash
npm test
npm run validate
npm run smoke
paseo --version
paseo provider ls --json
node --input-type=module # focused render check for HOST_DECISION canonical metadata
```

Observed results:

- `npm test`: 523 tests passed, 0 failed.
- `npm run validate`: passed.
- `npm run smoke`: passed.
- `paseo --version`: `0.1.96`.
- `paseo provider ls --json`: `claude` and `codex` available; `cursor` reports `error`, matching the docs' unverified cursor-as-peer caveat.

## Recommended Next Step

Run `oat-project-review-receive` and convert the Critical finding into a fix task before final PR/completion.
