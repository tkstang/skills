---
oat_generated: true
oat_generated_at: 2026-06-21
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: manual
oat_project: .oat/projects/shared/provider-cli-hardening
---

# Artifact Review: design

**Reviewed:** 2026-06-21
**Scope:** Design artifact review for the spec-driven `provider-cli-hardening` project
**Files reviewed:** 6
**Commits:** artifact review, no code range

## Summary

The design is substantively strong: it resolves the major discovery decisions, aligns with the spec requirements, preserves the deterministic envelope contract, and gives implementation enough shape to proceed after review. Two issues should be fixed before design approval: project state still routes as if design has not happened, and the submit command's stdout/stderr contract is ambiguous in a way that conflicts with the CLI's existing JSON-output convention.

## Findings

### Critical

None

### Important

- **Project state still routes to discovery/design-start even though design is drafted** (`.oat/projects/shared/provider-cli-hardening/state.md:14`)
  - Issue: The committed project state still says `oat_phase: discovery`, `oat_phase_status: complete`, and the body says "Design: scaffolded template - not started" / "Ready for design". That contradicts the committed `spec.md` and `design.md`, and live `oat project status` still recommends `oat-project-design` instead of treating this as a design review/HiLL checkpoint. This can misroute follow-up skills or force manual overrides even after the design review artifact exists.
  - Fix: Align `state.md` with the actual lifecycle point before design approval. At minimum, the state body should say the spec/design have been drafted and that design review is pending/received; the frontmatter should no longer describe the project as merely discovery-complete/ready-for-design. Ensure `oat project status --project-path .oat/projects/shared/provider-cli-hardening --json` reports the intended next step after review receive.

- **`consensus submit --json` stdout contract mixes machine and human output** (`.oat/projects/shared/provider-cli-hardening/design.md:373`)
  - Issue: The design says stdout is "machine + human" and includes both a `SubmitResult` JSON line and a brief "verdict captured" confirmation. Existing provider CLI commands use `--json` as a machine-readable stdout contract (`writeJson` emits one JSON line), with human/error text on stderr for non-JSON paths. If `submit --json` emits free-form success text outside the JSON object, tests and future callers cannot safely parse stdout, and the contract differs from `provider ls`, `preflight`, and `run`.
  - Fix: Specify that `consensus submit --json` writes exactly one JSON object/line to stdout. Put the success text in `SubmitResult.message`; keep validation guidance on stderr for peer self-correction. If validation failures also emit a JSON result, say so explicitly and test both stdout/stderr behavior.

### Medium

None

### Minor

None

## Requirements/Design Alignment

**Evidence sources used:** `spec.md`, `design.md`, `discovery.md`, `plan.md`, `implementation.md`, `state.md`, and spot checks against `src/consensus/provider-cli/{commands.ts,runtime-policy.ts,invocation.ts,subprocess.ts,types.ts}` plus `src/consensus/core/consensus-loop.ts`.

### Requirements Coverage

| Requirement | Status | Notes |
| ----------- | ------ | ----- |
| FR1 | partial | Submit-CLI design covers the peer-facing command and provider posture; state drift remains outside the design content. |
| FR2 | covered | In-context validation and same-turn correction are described with stderr feedback and schema-subset validation. |
| FR3 | covered | Run-bound sidecar capture and unchanged envelope contract are specified. |
| FR4 | covered | No-submission behavior is decided as prefer-submit with parse fallback, with strict mode deferred. |
| FR5 | covered | Fixture and live-provider evidence gates are specified. |
| FR6 | covered | Unknown provider exits remain terminal and are test-locked. |
| FR7 | covered | Transient retry prompt contamination is explicitly addressed. |
| FR8 | covered | Per-adapter signatures are evidence-gated. |
| FR9 | covered | Signal/interruption classification is constrained to reliable evidence. |
| FR10 | covered | Classification basis is recorded through additive diagnostics without stderr content. |
| FR11 | covered | Contract-locking tests are mapped. |
| FR12 | covered | DR promotion and family-track flag are included. |
| NFR1 | covered | No runtime dependency and no MCP server are preserved. |
| NFR2 | covered | Engine determinism and envelope invariance are central to the design. |
| NFR3 | covered | Redaction/no-leak testing is included. |
| NFR4 | covered | Generated-output discipline is included. |
| NFR5 | covered | Required gates are included. |

### Extra Work (not in declared requirements)

None.

## Verification Commands

```bash
oat project status --project-path .oat/projects/shared/provider-cli-hardening --json
rg -n "SubmitResult|stdout|stderr|verdict captured|Current Phase|Ready for design|not started" .oat/projects/shared/provider-cli-hardening/{design.md,state.md}
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to process the findings and convert them into review-fix work before design approval.
