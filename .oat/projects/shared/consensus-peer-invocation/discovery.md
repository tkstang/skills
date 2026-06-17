---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-06-17
oat_generated: false
---

# Discovery: consensus-peer-invocation

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details.

- Prefer outcomes and constraints over concrete deliverables (no specific scripts, file paths, or function names).
- If an implementation detail comes up, capture it as an **Open Question** for design (or a constraint), not as a deliverable list.

## Initial Request

Kick off an OAT planning project in `/Users/tstang/Code/skills` for replacing
or reducing the Paseo CLI dependency in the consensus plugin. The initiative
combines backlog items `bl-bb7e` (in-house peer-invocation CLI) and `bl-3a88`
(tool-based verdict submission), using the newly landed TypeScript/Vitest
generated-runtime substrate from PR #13 and PR #14 as the planning baseline.

The first pass is planning only. It must not implement peer-invocation code,
modify consensus runtime behavior, edit generated runtime files, or update
backlog statuses unless a concrete reference update becomes necessary.

The operator lean is to support the narrow provider floor `claude` + `codex` +
`cursor`, drawing from Stoa's direct provider adapter and final JSON contract
rather than depending on Paseo for one per-turn `run` capability.

## Clarifying Questions

No live clarification was needed in this pass because the request included the
core planning boundaries and operator preference. The discovery decision is
therefore based on the user's explicit instruction plus repository and Stoa
source review.

### Question 1: Workflow Depth

**Q:** Should this continue as quick lightweight design or full spec-driven
design?
**A:** The request explicitly prefers spec-driven mode unless discovery proves
quick mode sufficient, and calls out provider contracts, structured output,
cursor behavior, inventory/preflight, error taxonomy, audit compatibility,
generated-runtime constraints, and migration sequencing.
**Decision:** Promote from quick-start discovery to spec-driven design. The next
artifact should be produced by `oat-project-design`, which will confirm
requirements and produce formal `spec.md` + `design.md` in one pass.

## Solution Space

_Include this section only when the request is exploratory or multiple viable approaches exist. For well-understood requests with an obvious approach, omit or replace with a single sentence stating the chosen direction._

Discovery reviewed three materially different strategies. Recommendation:
continue as a spec-driven design/spike for an owned peer-invocation layer, with
a phased design that can preserve the current `invokePeer` seam while deciding
whether direct final-JSON invocation is sufficient or whether verdict submission
should become the primary contract.

### Approach 1: Direct Provider Adapter Behind `invokePeer` _(Recommended Baseline)_

**Description:** Replace the default Paseo-backed invoker with a dependency-free
TypeScript provider adapter that builds direct one-shot commands for the narrow
provider set. Stoa is the main source material: Claude supports inline native
schema delivery when the schema is constrained; Codex can use
`--output-schema` plus an output-last-message file; Cursor runs in print JSON
mode but still requires prompt-injected schema instructions and post-run
validation.
**When this is the right choice:** Best when the project goal is to remove
daemon/global-Paseo friction while preserving the existing consensus loop,
artifact records, retry semantics, schema files, and current peer-turn prompt
contract.
**Tradeoffs:** It still inherits the "model must emit valid final JSON" class of
failure for soft-schema providers, especially Cursor. It also requires owning
provider CLI drift for the supported floor.

### Approach 2: Verdict Submission Tool as the Primary Contract

**Description:** Give each deliberating peer an explicit CLI or MCP tool such as
`consensus submit` that validates the verdict against the mode-specific schema
and returns actionable errors in context. The orchestrator would collect a
submitted verdict rather than only parsing the final assistant message.
**When this is the right choice:** Best if reliability against structured-output
flakiness is more important than minimizing migration size. This normalizes
Claude, Codex, and Cursor because even providers with soft schema behavior can
self-correct through a tool call.
**Tradeoffs:** Larger design surface. The design must answer how stateless
per-turn peers receive tool access, whether CLI or MCP is available in each
provider sandbox, how the orchestrator captures submissions, and how audit
records map to the current artifact contract.

### Approach 3: Keep Paseo as the Runtime Backend

**Description:** Stay with `paseo run --provider ... --output-schema ... --json`
and invest only in wrappers, tests, and documentation around the current
dependency.
**When this is the right choice:** Best if broad ACP provider coverage becomes a
product goal, or if direct provider CLI drift is judged more expensive than the
current install/daemon/version friction.
**Tradeoffs:** Keeps the current prerequisite burden and leaves the consensus
plugin dependent on a much larger surface than it uses. It also does not solve
structured-output issues already observed with strict or soft schema paths.

### Chosen Direction

**Approach:** Spec-driven design for an owned peer-invocation layer, likely
phased around Approach 1 with Approach 2 evaluated as the reliability target.
**Rationale:** The repo already has typed seams (`invokePeer`, injected
preflight, provider inventory normalization, schema validation, generated output
drift guards) that make a staged design feasible, but the decision space is too
large for a quick plan. Cursor's soft schema behavior means "just use native
schemas" is not a complete strategy.
**User validated:** Yes. The user explicitly requested spec-driven preference
unless discovery proved quick design sufficient; discovery did not.

## Options Considered

Specific options that need to be resolved in `spec.md`/`design.md`:

### Option A: Direct Final-JSON Backend First

**Description:** Build a direct provider adapter that returns the same shape the
loop expects today (`json`, `stdout`, `stderr`, provider metadata), preserving
the existing final JSON validation and retry behavior around `invokePeer`.

**Pros:**

- Smallest migration from `invokePaseo` because it keeps the loop contract and
  artifact shape intact.
- Easy to A/B against the current Paseo backend through the existing injection
  seam.
- Can reuse Stoa command construction and output normalization patterns.

**Cons:**

- Does not fully eliminate final-message JSON fragility for Cursor and other
  soft-schema paths.
- Requires an in-house replacement for provider inventory, availability checks,
  and error taxonomy now handled by Paseo.

**Chosen:** Candidate baseline; design must validate before implementation.

**Summary:** This is likely the first migration slice if the design prioritizes
small, reversible changes.

### Option B: Submit-Tool Backend First

**Description:** Make a verdict submission tool the contract before or during
the provider-adapter migration.

**Pros:**

- Addresses the strongest reliability concern directly.
- Makes Cursor's soft-schema path less special.
- Gives peers schema validation feedback in-context instead of relying on
  blind external retry prompts.

**Cons:**

- Requires design around tool exposure, sandbox behavior, submission capture,
  and failure/audit semantics.
- Larger first migration and more risk of changing runtime behavior.

**Chosen:** Open for spec-driven design.

**Summary:** This may be the right target contract, but discovery is not enough
to declare it as the first implementation slice.

### Option C: Paseo Compatibility Bridge

**Description:** Keep Paseo as a fallback backend while the direct provider
adapter or submit-tool path proves itself.

**Pros:**

- Reduces migration risk and allows side-by-side dogfooding.
- Keeps broad ACP support available while the narrow provider floor is hardened.

**Cons:**

- Extends the period with two peer-invocation paths.
- Requires explicit configuration and tests to avoid ambiguous failures.

**Chosen:** Keep as a design option, not a default assumption.

**Summary:** Useful for migration sequencing, but the initiative's goal remains
owning the narrow provider path.

## Key Decisions

1. **Workflow Mode:** Promote to spec-driven design because quick lightweight
   design would skip too many contract decisions.
2. **Initiative Scope:** Treat `bl-bb7e` and `bl-3a88` as one peer-invocation
   initiative, not separate near-term implementation tasks.
3. **Provider Floor:** Design for `claude`, `codex`, and `cursor`; broad ACP
   provider coverage is explicitly not a floor.
4. **Source Material:** Use Stoa's `provider-adapter.ts` and
   `final-json-contract.ts` as proven source material, but narrow and adapt them
   to the consensus plugin's dependency-free generated-runtime constraints.
5. **Migration Boundary:** Preserve `runConsensusLoop` and wrapper runtime
   behavior during planning. Design against the existing `invokePeer` seam and
   current validation/audit records.
6. **Generated Runtime:** Implementation must edit canonical TypeScript under
   `src/`, then regenerate committed `.mjs` outputs through
   `scripts/build-generated.mjs`. Generated files must not be hand-edited.

## Constraints

- Planning only in this pass; no peer-invocation implementation.
- Do not edit generated runtime files or modify consensus runtime behavior.
- Do not update backlog statuses as part of this pass.
- Runtime plugin code must remain dependency-free and use Node standard library
  APIs unless a future decision changes the shipped-plugin contract.
- Node >=22 and pnpm are the expected development/runtime baseline.
- Provider-facing runtime output remains committed `.mjs` under the plugin tree;
  canonical TypeScript source lives under `src/`.
- Current schema validation, byte caps, resume/audit-trail behavior, and
  structured record formats must remain compatible unless design explicitly
  records a migration.
- Cursor must be treated as a soft-schema provider unless new live evidence
  proves a native schema flag exists.

## Success Criteria

- A spec/design pass defines the owned peer-invocation architecture for the
  narrow provider floor.
- The design chooses or phases direct final-JSON invocation vs. submit-tool
  verdict submission with explicit tradeoffs.
- The design defines provider adapter contracts, provider inventory/preflight,
  schema delivery, validation/retry, and error taxonomy parity with current
  Paseo-backed behavior.
- The design preserves artifact/audit compatibility or documents the exact
  migration.
- The design includes a migration sequence from current Paseo-backed
  `invokePeer`, with clear verification and rollback/fallback strategy.
- The later implementation plan avoids generated-file hand edits and uses
  Vitest/build drift guards for canonical TypeScript changes.

## Out of Scope

- Implementing a direct provider adapter.
- Implementing a submit-tool or MCP verdict submission surface.
- Changing consensus runtime behavior, prompt behavior, artifact format, or
  generated `.mjs` files during this planning pass.
- Expanding provider support beyond `claude`, `codex`, and `cursor`.
- Public release/distribution claims about provider support.

## Deferred Ideas

- Broad ACP adapter catalog replacement - deferred because the provider floor is
  intentionally narrow.
- Cursor-as-peer Paseo-path verification - useful only if the project decides to
  keep Paseo or needs more Cursor behavior evidence.
- Consensus family skill implementation (`evaluate`, `create`, `decide`,
  `plan`, `research`) - separate roadmap lane.

## Open Questions

- **Provider IDs:** Should consensus keep user-facing IDs
  `claude`/`codex`/`cursor` and map them internally to Stoa-style
  `claude-cli`/`codex-exec`/`cursor-agent`, or introduce a new normalized
  adapter ID layer?
- **Schema Delivery:** Which schemas should use provider-native delivery, and
  which should use prompt-only delivery plus post-run validation?
- **Codex Native Mode:** Should Codex always use `--output-schema`, or only when
  the contract is constrained enough to avoid strict-output quirks?
- **Cursor Output:** What exact Cursor JSON envelope and success/failure fields
  should be accepted, and how should invalid Cursor output map to consensus
  errors?
- **Verdict Submission:** Should submit-tool be a CLI, MCP tool, or both? How is
  it made available to stateless per-turn peer invocations?
- **Submission Capture:** If a submit-tool exists, does the orchestrator read a
  sidecar file, stdout envelope, temp directory, or structured event stream?
- **Retry Semantics:** Which failures retry inside the provider adapter vs.
  inside the consensus loop? How do validation errors get returned to a peer for
  self-correction?
- **Preflight:** What replaces `paseo --version` and
  `paseo provider ls --json` for executable discovery, auth/readiness, and
  provider inventory?
- **Error Taxonomy:** What are the new equivalents for `PASEO_MISSING`,
  `PEER_UNAVAILABLE`, `PASEO_EXIT`, and `PASEO_INVALID_JSON`, and which old
  codes need compatibility aliases?
- **Migration Switch:** Is the new backend selected by config, env var, CLI
  flag, or compile-time default during A/B dogfooding?

## Assumptions

- PR #13 and PR #14 are present in `origin/main`; verified `HEAD` is
  `1095718 refactor(consensus): migrate refine wrapper to TypeScript (#14)`.
- The consensus loop's existing `invokePeer` seam is stable enough to preserve
  control flow during migration.
- Stoa's direct provider adapter and final JSON contract are portable as design
  source material, but not copy-paste ready for the consensus plugin because
  Stoa depends on workspace packages and server-specific logging/config types.
- The narrow provider floor is acceptable even though it gives up Paseo's broad
  ACP adapter catalog.

## Risks

- **Provider CLI Drift:** Direct adapters may break when Claude, Codex, or
  Cursor CLI flags change.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Keep adapters narrow, test command construction, add
    preflight diagnostics, and preserve Paseo fallback during migration if
    design chooses.
- **Structured Output Reliability:** Prompt-only final JSON remains fragile for
  Cursor.
  - **Likelihood:** High
  - **Impact:** High
  - **Mitigation Ideas:** Evaluate submit-tool verdict submission as a first
    class design option, and preserve validation/retry/cap logic.
- **Audit Trail Regression:** Changing where verdicts are captured could break
  resume or artifact provenance.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Design around current record formats and add
    compatibility tests before changing runtime behavior.
- **Generated Runtime Drift:** Adding new TS sources without proper build
  mappings could leave shipped `.mjs` stale.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Extend `scripts/build-generated.mjs` deliberately and
    require `pnpm run build:check` / generated-output tests.
- **Scope Creep:** Broad ACP replacement could turn a narrow peer-invocation
  project into a provider platform.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Keep `claude` + `codex` + `cursor` as the floor and
    document broad ACP support as explicitly out of scope unless product goals
    change.

## Next Steps

Continue with `oat-project-design`. That workflow should confirm requirements
and produce formal `spec.md` and `design.md` before any implementation plan is
written.
