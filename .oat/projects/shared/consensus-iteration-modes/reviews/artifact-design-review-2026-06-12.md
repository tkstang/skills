---
oat_generated: true
oat_generated_at: 2026-06-12
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/consensus-iteration-modes
---

# Artifact Review: design

**Reviewed:** 2026-06-12
**Scope:** Design artifact alignment and implementation readiness
**Files reviewed:** 5
**Commits:** N/A - artifact review

## Summary

The design is broadly implementation-ready: it maps the spec's core parallel-mode requirements into concrete engine, wrapper, record-schema, resume, and test slices, and it preserves the repository constraints around deterministic orchestration, Node stdlib, and Paseo shell-out. I found two design-level gaps that should be corrected before planning proceeds: maximum-agency routing never reaches the user for any genuinely-stuck state, and synthesized-round persistence is ambiguous across the atomic-round and resume-at-synthesis requirements.

## Findings

### Critical

None

### Important

- **Maximum agency has no user-routed genuinely-stuck path** (`.oat/projects/shared/consensus-iteration-modes/design.md:150`)
  - Issue: The spec requires maximum agency to route decisions to the host "unless genuinely stuck" and the success criteria say maximum agency reaches the user only on genuinely-stuck states. The design's routing table sends every maximum-agency escalation path to `host` or `auto`; none route to `user`, and the design does not define what makes a state genuinely stuck after host decision-making fails or cannot decide.
  - Fix: Add an explicit maximum-agency genuinely-stuck rule and routing path. For example, define the condition that promotes a host-routed escalation to user-routed (host declines/returns unable-to-decide, repeated host decisions fail to converge, invalid/unusable host direction, or exhausted extension budget) and include the corresponding JSONL/resume behavior and tests.
  - Requirement: FR5

### Medium

- **Synthesized-round commit semantics conflict with resume-at-synthesis** (`.oat/projects/shared/consensus-iteration-modes/design.md:94`)
  - Issue: The round executor says a failed peer or synthesizer call aborts the round atomically with no partial records committed. Later, the interruption design says an interruption between the peer round and synthesis resumes at the synthesis step because the records stream can contain two peer records with no synthesis record. Those two rules leave implementers without a clear transaction boundary for `parallel_synthesized`: should the two peer records be durable before synthesis, or should the entire peer+synthesis round be all-or-nothing?
  - Fix: Split the semantics explicitly. One workable contract is: peer-pair records are committed atomically as a peer subround; synthesis is a separate required record for the same round; resume recognizes a complete peer-pair with missing synthesis as "pending synthesis"; invalid or oversized synthesis records a metadata-only synthesis error and terminates the section. Then adjust the "atomic rounds" wording and add tests for interruption after peer records, synthesis process failure, invalid synthesis shape, and resume from pending synthesis.
  - Requirement: FR2, FR7, NFR1

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** `design.md`, `spec.md`, `discovery.md`, `plan.md`, `implementation.md`

### Requirements Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| FR1 | covered | Parallel-revision executor, prompt, convergence, oscillation, and tests are specified. |
| FR2 | partial | Synthesized mode is covered, but transaction semantics around failed/interrupted synthesis need clarification. |
| FR3 | covered | Mode flag, disclosure fields, call counts, and docs/host-surface work are specified. |
| FR4 | covered | v1 schema family, validation, caps, and v0 resume fail-closed behavior are specified. |
| FR5 | partial | Escalation triggers and routing are specified, but maximum agency lacks a user-routed genuinely-stuck state. |
| FR6 | covered | Synthesizer default, override, preflight, and identity recording are specified. |
| FR7 | partial | Resume matrix is specified, but pending-synthesis persistence needs a sharper contract. |
| FR8 | covered | Parallel-section packet metadata and fan-in escalation handling are specified. |
| FR9 | covered | Alternating regression lock is included in Phase 1 and test mapping. |
| NFR1 | partial | Deterministic predicate seams are covered; pending-synthesis state must be made deterministic. |
| NFR2 | covered | Node 22, ESM, stdlib-only, and Paseo shell-out constraints are preserved. |
| NFR3 | covered | Unit, integration, and smoke coverage are mapped. |
| NFR4 | covered | Dogfood artifact review and audit-trail legibility are included. |
| NFR5 | covered | Routine event/content boundary and escalation-only content exposure are specified. |

### Extra Work (not in declared requirements)

None

## Verification Commands

Run these after updating the design:

```bash
rg -n "genuinely stuck|maximum|pending synthesis|atomic" .oat/projects/shared/consensus-iteration-modes/design.md
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert findings into plan tasks.
