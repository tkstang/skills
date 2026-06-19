---
skill: analyze
schema: analysis
topic: "Session observer TypeScript migration research relevance"
model: gpt-5
generated_at: 2026-06-17
input_type: architecture / design doc
source_project: /Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration
---

# Session Observer TypeScript Migration Analysis

## Executive Summary

The `session-observer-ts-migration` OAT project is useful for the consensus CLI
work, but as implementation-substrate evidence rather than provider-selection
evidence.

It reinforces three points:

- A reusable CLI can still be authored in canonical TypeScript while shipping
  dependency-free committed `.mjs` runtime outputs.
- Generated output needs explicit drift checks, import rewrites, and shipped
  entrypoint tests; this should be planned up front for any consensus CLI that
  lives in the plugin/runtime surface.
- The first implementation should remain sequential around generated-runtime
  mappings because source, generated artifacts, tests, and docs share one
  fragile boundary.

It does not materially change the provider conclusion: replacing Paseo is still
worth considering because the provider contract is narrower than Paseo's broad
surface. This artifact only sharpens how to build and verify that replacement
inside this repo.

## Methodology

Read and analyzed:

- `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/discovery.md`
- `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/plan.md`
- `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/implementation.md`
- `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/reviews/archived/artifact-plan-review-2026-06-17.md`

## Per-Angle Findings

### Adversarial / Critical

- The session-observer plan is intentionally generated-runtime-heavy. Applying
  that pattern blindly to a reusable `consensus` CLI could over-constrain the
  design if the CLI is meant to be consumed by Stoa outside the shipped plugin
  tree.
- The strongest risk is dual identity: one CLI as generated plugin runtime and
  another as reusable repo/tooling CLI. Design should decide whether those are
  the same executable, a generated wrapper around shared core, or separate
  entrypoints with shared source.
- Generated import rewriting is fragile. The session-observer plan calls out
  exact rewrites from TypeScript `.js` specifiers to shipped `.mjs` paths; a
  consensus CLI with provider adapters will likely need the same explicitness.

### Gap Analysis

- The session-observer artifacts do not discuss provider execution, schemas,
  Cursor, Paseo, MCP, or ACP. They should not be treated as provider research.
- They do not answer packaging/distribution questions for a cross-repo CLI. They
  only prove a strong local repo pattern for shipped skill runtime generation.
- They imply a missing design question for consensus: where does the reusable CLI
  live relative to generated plugin outputs, and what is the stable invocation
  path for external consumers like Stoa?

### Opportunity Analysis

- Reuse the canonical TypeScript plus generated `.mjs` pattern for consensus CLI
  source and shipped plugin outputs.
- Reuse the session-observer parity gate pattern: first execute existing tests or
  behavior checks against generated outputs before changing runner/framework
  structure.
- Reuse the review lesson that artifact-level findings can be resolved directly
  in lifecycle docs before implementation starts.
- Reuse the verification bundle: `pnpm run build`, `type-check`, `build:check`,
  `test`, `validate`, and `smoke`.

### Structural / Organizational

- The session-observer project is well-bounded: discovery states the chosen
  source layout, generated output paths, key decisions, constraints, and success
  criteria before plan generation.
- It keeps generated-output ownership separate from behavior migration and test
  migration. That separation is directly applicable to consensus CLI work:
  provider-contract design should be separated from generated-output wiring.
- The plan rejects parallel groups because source, generated outputs, tests, and
  docs all touch the same fragile runtime boundary. That is likely true for the
  first consensus CLI slice too.

### Consistency / Coherence

- The artifacts consistently preserve the shipped dependency-free runtime
  contract while moving development to TypeScript/Vitest.
- The review confirmed the plan covered discovery goals and preserved mixed test
  runners until a later PR, which matches this repo's incremental-migration
  posture.
- This is coherent with the current consensus project constraints: edit
  canonical TypeScript, generate committed `.mjs`, do not hand-edit generated
  outputs, and keep shipped skills dependency-free.

### Audience / Clarity

- The artifact is clear enough to use as precedent during consensus design.
- The most reusable phrasing is "canonical TypeScript source is the only edited
  implementation surface; generated `.mjs` files are committed shipped artifacts."
- For consensus CLI docs, this clarity should be preserved but not exposed too
  heavily in user-facing skill docs unless users need to know the build surface.

## Cross-Angle Synthesis

The session-observer research strengthens the case that the repo can own a
small CLI without violating shipped runtime constraints. It also narrows the
implementation risk: the hard part is not just provider commands, but making the
owned boundary reproducible across canonical source, generated runtime output,
tests, docs, and external consumers.

For the consensus CLI, the design should explicitly separate:

- Shared CLI/core source under `src/`.
- Generated shipped plugin entrypoints under `plugins/`.
- Any developer-facing or cross-repo CLI wrapper intended for Stoa.
- Drift tests that prove generated outputs match canonical source.
- Shipped-entrypoint tests that prove the no-install paths still run.

## Prioritized Recommendations

1. **Add a packaging/boundary question to consensus design.** Decide whether the
   reusable CLI is the generated plugin entrypoint, a package-level bin, or both
   using shared canonical source. Impact: high. Effort: medium.
2. **Carry forward the generated-runtime contract.** Consensus CLI source should
   follow the same canonical TypeScript to committed `.mjs` discipline if it is
   shipped inside plugin/skill runtime paths. Impact: high. Effort: medium.
3. **Keep first implementation sequential.** Do not parallelize provider adapter,
   generated output, tests, and docs until the CLI boundary is proven. Impact:
   medium. Effort: low.
4. **Require generated-entrypoint smoke tests.** Tests should execute the
   generated shipped CLI path, not only canonical TypeScript helpers. Impact:
   high. Effort: medium.
5. **Keep this artifact out of provider comparisons.** It informs build and
   packaging, not whether Cursor SDK, MCP, ACP, or Paseo is the right provider
   path. Impact: medium. Effort: low.

## Sources & References

- Discovery source: `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/discovery.md:13-36`
- Discovery key decisions and constraints: `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/discovery.md:64-83`
- Discovery verification expectations: `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/discovery.md:85-113`
- Plan architecture and parallelism: `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/plan.md:22-43`
- Generated output mapping and verification: `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/plan.md:93-151`
- Final verification: `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/plan.md:441-499`
- Artifact review alignment: `/Users/tstang/Code/session-observer-ts/.oat/projects/shared/session-observer-ts-migration/reviews/archived/artifact-plan-review-2026-06-17.md:17-72`
