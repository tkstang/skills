---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-06-19
oat_generated: false
oat_template: false
---

# Specification: consensus-peer-invocation

## Phase Guardrails (Specification)

Specification is for requirements and acceptance criteria, not design/implementation details.

- Avoid concrete deliverables that belong in the implementation plan.
- Keep the High-Level Design section to architecture shape and component boundaries only.
- If a design detail comes up, record it under Open Questions for `oat-project-design`.

## Problem Statement

The consensus plugin currently depends on Paseo for a narrow runtime capability:
invoke peer coding agents and return structured verdict records. Paseo brings
useful provider orchestration and schema validation ideas, but it is a larger
daemon/provider platform than the consensus plugin needs for its first peer
invocation boundary.

The project needs an owned `consensus` CLI boundary that can replace or reduce
the Paseo runtime dependency while preserving the consensus loop's existing
strengths: local verdict validation, byte caps, retry behavior, provider
diagnostics, audit records, and resume compatibility.

The first implementation must stay narrow. It should target the provider floor
of Claude, Codex, and Cursor, use Stoa and Paseo as source material, and design
for future provider adapters without rebuilding a broad provider platform. Stoa
compatibility is a contract pressure, not a required migration in this project.

## Goals

### Primary Goals

- Define an owned `consensus` CLI boundary for one-shot peer invocation with
  structured output and normalized diagnostics.
- Support the provider floor of Claude, Codex, and Cursor without requiring
  broad ACP provider catalog work.
- Preserve the consensus loop's validation, caps, retry, audit, and resume
  semantics during migration.
- Define how provider execution, schema delivery, preflight, and error taxonomy
  replace the current Paseo-backed path.
- Keep shipped runtime outputs dependency-free and generated from canonical
  TypeScript source.

### Secondary Goals

- Shape the CLI contract so Stoa can evaluate it later as a replacement for
  duplicated provider execution logic.
- Evaluate a Cursor SDK submit-tool path as a bounded proof, not a first-scope
  dependency.
- Leave clear adapter extension points for future providers such as Gemini,
  OpenCode, Kimi, Pi, GLM, OpenRouter, and local open-weight models.

## Non-Goals

- Implementing direct provider adapters during this design phase.
- Implementing a submit-tool or MCP verdict submission surface during this
  design phase.
- Migrating Stoa to the new CLI as part of the first implementation.
- Expanding first-scope provider support beyond Claude, Codex, and Cursor.
- Rebuilding Paseo's broad daemon, workspace, WebSocket, or provider catalog
  surface.
- Changing consensus prompt behavior, artifact format, or generated `.mjs`
  runtime files during planning.
- Reworking the canonical deliberation-engine architecture, skill-family shape,
  iteration modes, convergence semantics, or artifact-as-audit-trail model.
- Making public release, marketplace, or provider-support claims before live
  verification.

## Requirements

### Functional Requirements

**FR1: Owned Peer Invocation CLI Boundary**

- **Description:** Define a small `consensus` CLI boundary for provider
  inventory, preflight, one-shot peer invocation, structured output capture, and
  normalized errors.
- **Acceptance Criteria:**
  - The design specifies the CLI responsibilities and explicitly excludes
    daemon/workspace/provider-platform responsibilities.
  - The design identifies the first consumer as the consensus plugin while
    keeping the command contract reusable enough for later Stoa evaluation.
  - The design defines machine-readable success and failure output shapes.
- **Priority:** P0

**FR2: Provider Floor and Adapter Capabilities**

- **Description:** Define provider adapter capabilities for Claude, Codex, and
  Cursor, including provider IDs, command execution, readiness probing, schema
  delivery, output normalization, and diagnostic metadata.
- **Acceptance Criteria:**
  - The design covers Claude, Codex, and Cursor as first-scope providers.
  - The design treats broad ACP/custom-provider catalog work as out of scope.
  - The design records whether user-facing provider IDs are preserved or mapped
    through an internal adapter layer.
- **Priority:** P0

**FR3: Structured Output Strategy**

- **Description:** Define a per-provider structured-output strategy that can use
  genuinely constrained provider-native schema delivery where available,
  submit-tool verdict capture where proven, or prompt plus validation/retry as
  the universal fallback.
- **Acceptance Criteria:**
  - The design requires local validation after provider output for every
    strategy.
  - The design distinguishes genuinely constrained native schema support from
    provider-side prompt/parse/retry or post-hoc validation behavior.
  - The design states the default strategy for Claude, Codex, and Cursor.
  - The design does not treat Claude or Cursor as constrained-native providers
    unless live evidence proves the guarantee exists.
  - The design documents when validation errors are returned to the peer for
    self-correction versus handled by consensus-side retry.
- **Priority:** P0

**FR4: Consensus Loop Integration**

- **Description:** Integrate the new provider boundary through the existing peer
  invocation seam without changing the deliberation algorithm or section control
  flow.
- **Acceptance Criteria:**
  - The design preserves current verdict validation, convergence handling,
    round retry behavior, and section-level audit semantics.
  - The design preserves the canonical skill-family architecture in which thin
    skill wrappers use a shared consensus-loop primitive.
  - The design defines how the current backend is selected during migration.
  - The design includes a rollback or fallback strategy for dogfooding.
- **Priority:** P0

**FR5: Preflight and Provider Inventory**

- **Description:** Replace Paseo-specific preflight with provider-specific
  availability, version/readiness, auth, and capability reporting.
- **Acceptance Criteria:**
  - The design defines a machine-readable provider inventory result.
  - The design distinguishes missing executable, unavailable provider,
    unsupported capability, and transient provider failure.
  - The design identifies what diagnostics should be shown to users without
    leaking sensitive command or environment details.
- **Priority:** P0

**FR6: Backend-Neutral Error Taxonomy**

- **Description:** Replace Paseo-shaped runtime errors with backend-neutral
  consensus errors while preserving useful compatibility aliases where needed.
- **Acceptance Criteria:**
  - The design maps old Paseo-related error families to new provider-neutral
    categories.
  - The design defines which errors retry and which fail immediately.
  - The design preserves actionable remediation messages.
- **Priority:** P0

**FR7: Audit and Resume Compatibility**

- **Description:** Preserve existing consensus artifact, audit, and resume
  semantics while changing the provider backend.
- **Acceptance Criteria:**
  - The design defines the raw provider response fields and any compatibility
    aliases for old run artifacts.
  - Existing resume flows remain readable or have an explicit migration path.
  - Tests are planned for audit record compatibility and resume behavior.
- **Priority:** P0

**FR8: Generated Runtime Packaging**

- **Description:** Define how canonical TypeScript source produces committed
  dependency-free runtime outputs for the shipped consensus plugin and any CLI
  entrypoints.
- **Acceptance Criteria:**
  - The design chooses the packaging relationship between package-level CLI,
    generated plugin entrypoint, or shared canonical source.
  - The design requires build drift checks and generated-entrypoint smoke tests.
  - The design forbids hand-editing generated `.mjs` outputs.
- **Priority:** P0

**FR9: Host-Native Self-Spawn Guard**

- **Description:** Prevent a consensus run from recursively or unsafely spawning
  the same host runtime as a peer when the requested provider matches the
  current host agent.
- **Acceptance Criteria:**
  - The design defines how host runtime identity is detected for Claude, Codex,
    and Cursor.
  - The design states whether same-host provider requests use a host-native
    dispatch path, are marked unavailable, or require an explicit opt-in.
  - The design accounts for host-specific subagent capability limits, including
    Codex full-history fork constraints and self-contained packet fallback.
  - The default behavior avoids unguarded recursive self-spawn or hangs.
- **Priority:** P0

**FR10: Cursor Submit-Tool Evaluation**

- **Description:** Define a bounded evaluation path for Cursor SDK custom tools
  as a possible submit-verdict transport.
- **Acceptance Criteria:**
  - The design treats Cursor as a soft-schema provider unless the evaluation
    proves a stronger path.
  - The design defines acceptance criteria for adopting Cursor SDK support,
    including reliability, audit capture, dependency posture, and local/cloud
    behavior.
  - The first migration remains viable if Cursor SDK support is deferred.
- **Priority:** P1

**FR11: Future Provider Extension Boundary**

- **Description:** Design adapter capabilities so future providers can be added
  deliberately without expanding the first implementation scope.
- **Acceptance Criteria:**
  - The design documents capability flags for future native-schema,
    prompt-only, submit-tool, custom-command, or ACP-style adapters.
  - The design explicitly defers broad provider implementation beyond the
    provider floor.
  - The design avoids public support claims for future providers.
- **Priority:** P1

### Non-Functional Requirements

**NFR1: Dependency-Free Shipped Runtime**

- **Description:** Shipped plugin runtime code must remain dependency-free and
  use Node standard library APIs unless a future decision explicitly changes
  that contract.
- **Acceptance Criteria:**
  - Runtime paths do not require install-time npm dependencies.
  - Any experimental dependency path is isolated from the default shipped
    plugin runtime.
- **Priority:** P0

**NFR2: Reliability and Validation Discipline**

- **Description:** The replacement must maintain or improve the current
  reliability characteristics of local validation, byte caps, retries, and
  structured error handling.
- **Acceptance Criteria:**
  - The design preserves current verdict caps and subprocess output caps unless
    it records a deliberate migration.
  - Invalid JSON, invalid verdict shape, oversized verdict fields, and provider
    exits all have explicit handling.
- **Priority:** P0

**NFR3: Backward Compatibility**

- **Description:** Existing consensus behavior, artifacts, and user workflows
  should continue to work during migration unless the design records a specific
  compatibility break.
- **Acceptance Criteria:**
  - Existing Paseo-backed behavior has a fallback or dogfood switch during
    migration.
  - Existing artifacts remain readable by resume logic.
- **Priority:** P0

**NFR4: Testability**

- **Description:** The design must support focused unit and integration tests
  without requiring live provider calls for the core contract.
- **Acceptance Criteria:**
  - Provider adapters can be tested with stub executables or injected invokers.
  - Contract tests cover command construction, output normalization, preflight,
    error mapping, validation retries, audit records, and generated-output drift.
- **Priority:** P0

**NFR5: Security and Process Safety**

- **Description:** Provider subprocess execution must avoid unsafe argument
  construction, sensitive logging, runaway output, and uncontrolled file writes.
- **Acceptance Criteria:**
  - Subprocess calls use argument arrays rather than shell interpolation.
  - Diagnostics redact sensitive environment and command data.
  - Output, prompt, and artifact size limits remain enforced.
- **Priority:** P0

**NFR6: Scope Control**

- **Description:** The design must stay focused on replacing the narrow Paseo
  capability used by consensus rather than building a generic provider platform.
- **Acceptance Criteria:**
  - First implementation phases are limited to the provider floor.
  - Future orchestration ideas from local prior art are deferred unless required
    for the peer-invocation contract.
- **Priority:** P0

## Constraints

- Planning and design only in this phase; no peer-invocation implementation.
- Runtime plugin code must remain dependency-free unless a later decision
  changes the shipped-runtime contract.
- Node >=22 and pnpm are the development/runtime baseline in this repository.
- Canonical source for generated runtime outputs lives under TypeScript source;
  generated `.mjs` outputs must be produced through the build pipeline.
- Existing consensus validation, byte caps, resume/audit trail behavior, and
  structured record formats remain compatible unless explicitly migrated.
- Cursor remains a soft-schema provider until live evidence proves a stronger
  mechanism.
- Stoa compatibility informs the CLI contract but does not require Stoa
  migration in this project.

## Dependencies

- Existing consensus loop and wrapper runtime behavior.
- Existing generated-runtime build and drift-check infrastructure.
- Existing consensus test suite, smoke test, and validation scripts.
- Local provider CLIs for Claude, Codex, and Cursor.
- Current Paseo-backed behavior as the migration baseline.
- Stoa provider adapter and final JSON contract as design source material.
- Research artifacts under `research/`, especially the synthesized report.

## High-Level Design (Proposed)

Design a small owned `consensus` CLI boundary that performs provider discovery,
preflight, one-shot peer execution, structured output capture, validation
handoff, and normalized diagnostics. The consensus plugin is the first consumer
and migrates through its existing peer invocation seam. Stoa remains a future
consumer candidate, so the command contract should be clean and reusable, but
the first implementation must not require Stoa changes.

The provider boundary should be adapter-based. Each adapter reports
capabilities such as native schema delivery, prompt-only schema instruction,
submit-tool support, event-envelope normalization, readiness probing, and
diagnostic detail. Structured output should be treated as a capability ladder:
use genuinely constrained native schema delivery where it exists, submit-tool
verdict capture where proven, and prompt plus local validation as the universal
floor.

Packaging must preserve the repository's generated-runtime discipline. The
design should choose whether the stable CLI is a package-level binary, a
generated plugin entrypoint, or both sharing canonical TypeScript source, and
then plan drift checks and shipped-entrypoint tests around that choice.

**Key Components:**

- CLI boundary - provider inventory, preflight, one-shot run, and machine-readable
  result envelopes.
- Provider adapter registry - capability descriptions and per-provider execution
  normalization for Claude, Codex, and Cursor.
- Structured output coordinator - constrained native schema, submit-tool, and
  prompt-plus-validation strategy selection.
- Consensus integration layer - migration through the existing peer invocation
  seam with audit/resume compatibility.
- Packaging and verification layer - canonical source, generated runtime output,
  drift checks, and shipped-entrypoint tests.

**Alternatives Considered:**

- Plugin-local adapter only - rejected as the preferred direction because it
  would remove Paseo from consensus while leaving Stoa and future tools to
  repeat similar provider logic.
- Paseo as permanent backend - rejected as the preferred direction because it
  keeps a broad provider platform around one narrow runtime capability.
- Submit-tool backend first - deferred as a core design question because it may
  improve reliability, especially for Cursor, but increases first-migration
  surface area.

_Design-related open questions are tracked in the Open Questions section below._

## Success Metrics

- The design specifies a narrow CLI contract that can replace the current
  Paseo-backed invocation path for Claude, Codex, and Cursor.
- The design preserves consensus validation, caps, retry, audit, and resume
  behavior or documents an explicit compatibility migration.
- The design defines preflight, provider inventory, structured output strategy,
  and backend-neutral error taxonomy.
- The design includes a migration and fallback plan from current Paseo behavior.
- The design includes generated-runtime build, drift-check, and shipped-entrypoint
  verification requirements.
- The design keeps broad future provider support out of first implementation
  scope while leaving a coherent adapter extension path.

## Requirement Index

| ID | Description | Priority | Verification | Planned Tasks |
| --- | --- | --- | --- | --- |
| FR1 | Define owned peer invocation CLI boundary | P0 | integration: CLI result and error envelopes | See plan.md |
| FR2 | Define provider floor and adapter capabilities | P0 | unit + integration: adapter registry and provider inventory | See plan.md |
| FR3 | Define structured output strategy | P0 | unit + integration: schema strategy selection and validation retry | See plan.md |
| FR4 | Integrate through existing consensus peer seam | P0 | integration + e2e: consensus backend switch and wrapper flow | See plan.md |
| FR5 | Replace Paseo-specific preflight | P0 | unit + integration: executable readiness and capability diagnostics | See plan.md |
| FR6 | Define backend-neutral error taxonomy | P0 | unit: error mapping and retry classification | See plan.md |
| FR7 | Preserve audit and resume compatibility | P0 | integration: artifact record compatibility and resume | See plan.md |
| FR8 | Define generated runtime packaging | P0 | unit + integration: build drift and shipped-entrypoint smoke | See plan.md |
| FR9 | Prevent unsafe host-native self-spawn | P0 | unit + integration: host identity, provider status, and dispatch guard | See plan.md |
| FR10 | Bound Cursor submit-tool evaluation | P1 | manual + integration: Cursor SDK spike acceptance criteria | See plan.md |
| FR11 | Define future provider extension boundary | P1 | manual: design review of capability flags and deferred scope | See plan.md |
| NFR1 | Keep shipped runtime dependency-free | P0 | integration: dependency and generated-runtime checks | See plan.md |
| NFR2 | Preserve reliability and validation discipline | P0 | unit + integration: invalid output, caps, exits, retries | See plan.md |
| NFR3 | Preserve backward compatibility | P0 | integration: fallback path and old artifact readability | See plan.md |
| NFR4 | Keep provider boundary testable without live calls | P0 | unit + integration: stubs and injected invokers | See plan.md |
| NFR5 | Maintain subprocess and diagnostic safety | P0 | unit: argv construction, redaction, caps, file safety | See plan.md |
| NFR6 | Prevent provider-platform scope creep | P0 | manual: plan review against provider floor and non-goals | See plan.md |

## Open Questions

- **Provider IDs:** Should user-facing IDs remain `claude`, `codex`, and
  `cursor` with internal adapter mapping, or should the CLI expose normalized
  adapter IDs directly?
- **CLI Packaging:** Should the stable command be a package-level binary, a
  generated plugin entrypoint, or both sharing canonical TypeScript source?
- **Schema Delivery:** Which provider/schema combinations use native delivery
  by default, and which use prompt plus validation?
- **Submit Tool:** Should verdict submission be a CLI command, an MCP tool, a
  provider SDK custom tool, or a deferred capability?
- **Cursor SDK:** What reliability threshold and dependency posture would
  justify adopting Cursor SDK custom tools?
- **Extensibility Mechanism:** Should `design.md` use a `ProviderAdapter`
  registry with provider ID, command argv, capability flags, and base URL style
  collapse for OpenAI-compatible providers?
- **Migration Switch:** Should backend selection be controlled by config, an
  environment variable, a CLI flag, or a compile-time default?
- **Error Compatibility:** Which old Paseo-specific errors need compatibility
  aliases in artifact or user-facing output?
- **Submission Capture:** If submit-tool support is adopted, does the
  orchestrator read a sidecar file, stdout envelope, temp directory, or
  structured event stream?

## Assumptions

- The existing consensus peer invocation seam is stable enough to preserve the
  deliberation control flow during migration.
- The provider floor of Claude, Codex, and Cursor is sufficient for the first
  implementation.
- Stoa provider execution logic is useful source material but not copy-paste
  ready because it carries Stoa-specific workflow and server assumptions.
- Cursor should be treated as soft-schema until an SDK submit-tool proof shows a
  materially stronger path.
- Provider-native structured output should mean constrained decoding or an
  equivalent hard provider guarantee; prompt-injection, JSON extraction,
  provider-side retry, or post-hoc validation are not the same guarantee.
- The current skill-family design remains canonical: shared consensus-loop
  primitive, thin skill wrappers, symmetric peers, stateless per-turn agents,
  and artifact-as-audit-trail.
- Future provider extensibility can be represented as adapter capabilities
  without implementing broad provider support first.

## Risks

- **Provider CLI Drift:** Direct adapters may break when provider CLI flags or
  output envelopes change.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Keep adapters narrow, cover command construction and output
    envelopes with tests, and preserve a fallback during migration.
- **Structured Output Reliability:** Cursor or prompt-only providers may still
  emit invalid final JSON.
  - **Likelihood:** High
  - **Impact:** High
  - **Mitigation:** Preserve local validation/retry and evaluate submit-tool
    capture as a bounded reliability improvement.
- **Audit Regression:** Changing provider capture could break resume or
  provenance records.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Design around current audit fields and add compatibility
    tests before switching defaults.
- **Generated Runtime Drift:** New canonical source or CLI entrypoints could
  leave shipped `.mjs` outputs stale.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation:** Extend build mappings deliberately and require drift checks.
- **Scope Creep:** Future provider and ACP ideas could turn the narrow CLI into
  a broad provider platform.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Limit first implementation to the provider floor and defer
    future provider support to explicit follow-up work.

## References

- Discovery: `discovery.md`
- Research synthesis: `research/synthesized/consensus-peer-invocation-research-synthesis-gpt-5.md`
- Knowledge Base: `.oat/repo/knowledge/project-index.md`
- Shared vault: `/Users/Shared/Vault/02 - Projects/Skills/Ideas/2026-04-30-two-agent-consensus-deliberation-cli.md`
- Shared vault: `/Users/Shared/Vault/02 - Projects/Skills/Ideas/2026-05-01-two-agent-consensus-deliberation-as.md`
- Shared vault: `/Users/Shared/Vault/02 - Projects/Skills/Ideas/2026-05-01-consensus-deliberation-skill-family.md`
- Shared vault: `/Users/Shared/Vault/02 - Projects/Open Agent Toolkit/Ideas/2026-04-20-codex-subagent-dispatch-for.md`
- Shared vault: `/Users/Shared/Vault/02 - Projects/Open Agent Toolkit/Ideas/2026-05-15-raindrop-workshop-oat-skill-verification.md`
