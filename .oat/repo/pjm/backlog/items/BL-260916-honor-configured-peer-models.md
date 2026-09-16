---
id: BL-260916-honor-configured-peer-models
title: Honor configured peer models and effort in convergence workflows
status: open
priority: medium
scope: task
scope_estimate: M
labels:
  - consensus
  - configuration
  - bug
  - documentation
assignee: null
created: 2026-09-16T14:01:45.868Z
updated: 2026-09-16T18:06:09Z
associated_issues: []
external_plans: []
---

## Description

The config schema accepts provider, model, and effort on defaults.peers, but Create, Decide, Plan, Refine, and Evaluate reduce the resolved agent objects to provider IDs before dispatch. Saved model and effort selections are silently lost, unlike Panel, which forwards them. Preserve these settings through convergence execution and regression-test all five workflows. Document the current limitation and typed configuration contract now, then update the documentation alongside the runtime fix so support claims match shipped behavior. Per-skill defaults, activating reserved roles, and multiple peers from one provider are outside this fix.

## Acceptance Criteria

- Preserve each resolved peer's `provider`, optional `model`, and optional `effort` through Create, Decide, Plan, Refine, and Evaluate provider requests, rather than reducing configured agents to provider IDs.
- Define and test invocation > project > user > built-in precedence, including explicit provider-only overrides, omitted optional settings, and preservation of selected settings across subsequent turns and supported resume paths.
- Add regression tests for all five workflows that inspect outgoing provider requests, plus provider-capability handling (unsupported model/effort options must not be silently dropped). Use mocked providers; live paid calls are not a required test prerequisite.
- Preserve Panel's existing model/effort forwarding and default behavior when no model or effort is configured.
- Update `documentation/docs/user-guide/consensus/configuration.md` with an annotated example, strict-JSON copyable counterpart, field types and constraints, and an explicit current limitation: peer provider defaults work, but configured peer model/effort are not yet applied. Keep this warning accurate while the runtime fix remains open.
- When the runtime fix ships, update the configuration support matrix and examples in the same change, removing the peer model/effort limitation only after propagation is verified. Keep unrelated reserved-role and per-skill-default limitations explicit; this item does not implement those features.
- Follow the repository's canonical-source, affected skill version-bump, generated-output regeneration, and verification requirements when implementing the runtime fix.

## Implementation evidence

- Documentation portion completed in merged PR #83 (`49b4baf3`): annotated JSONC, strict JSON, schema types, support matrix, and the current model/effort limitation are present. The runtime criteria remain open; this is not a completed item.

- `src/plugins/consensus/config/consensus-config.ts`: `ConsensusAgentRef` and `resolveConvergenceComposition` retain model/effort.
- `src/skills/{create,decide,plan,refine,evaluate}/src/consensus-*.ts`: configured composition is reduced with `composition.agents.map((agent) => agent.provider)` before peer dispatch.
- `src/skills/panel/src/consensus-panel.ts`: selected panelist model/effort are copied into provider requests; use this as a working reference, not a reason to change Panel's contract.
- `src/plugins/consensus/provider-cli/{adapters,runtime-policy,invocation}.ts`: capability checks and provider-specific option forwarding.
