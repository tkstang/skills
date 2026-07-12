# Handoff: Add Consensus-Research Skill

**Backlog item:** [`BL-260612-add-consensus-research-skill` — Add consensus-research skill (investigate question, synthesized findings)](../backlog/items/BL-260612-add-consensus-research-skill.md)
**Mode:** `/oat-project-new` — this is a spec-driven decision/build project. Pre-populate discovery, specification, and design from the authoritative inputs below; do not start implementation until the peer tool-access decision records a clear go.

## Mission

Decide and, only if justified, implement the last named consensus-family skill: a `shared_input` and `parallel_synthesized` research workflow that produces findings, evidence, dissent, and a deliberation log. The first deliverable is a durable decision on peer tool access, permissions, evidence provenance, and artifact trust boundaries.

## Authoritative inputs

- The backlog item and `.oat/repo/reference/research/consensus/architecture-v3.md` — intended defaults, inputs, and artifact shape.
- `.oat/repo/reference/project-summaries/20260622-consensus-family.md` — the shipped family pattern and why research was separated.
- `src/consensus/provider-cli/{types,adapters,runtime-policy,structured-output}.ts` — current provider capabilities, permission boundary, structured-output contract, and diagnostics. The owned `consensus` provider CLI is the execution boundary; do not revive historical Paseo assumptions.
- `src/consensus/{create,decide,plan}/` and `plugins/consensus/skills/{create,decide,plan}/` — existing wrapper, schema, generated-output, manifest, and documentation conventions.
- `scripts/build-generated.mjs`, `scripts/bump-version.mjs`, and `tests/consensus/` — registration, generation, versioning, and regression coverage requirements.

## Required project shape

1. **Discovery / DR:** establish the allowed peer tools, approved context and permission model, evidence-source and citation semantics, artifact trust boundaries, and graceful degradation when a provider cannot research. Record the decision before planning implementation.
2. **Spec / design:** if the DR says go, define CLI input (`--question`, `--scope`), evidence/dissent artifact schema, provider capabilities, retries/timeouts, and whether source attribution can be verified without overclaiming.
3. **Plan / build:** add the wrapper, skill, schemas, generated-output mapping, manifests, docs, tests, and version registrations. Build only when no other loop-changing project is in flight.

## Sequencing

- This project is **now** only through its boundary decision. It may run alongside the loop-quality project while it remains a DR/spec effort.
- Its implementation must not overlap [`BL-260612-add-deliberation-metrics` — Add deliberation metrics](../backlog/items/BL-260612-add-deliberation-metrics.md) or [`BL-260612-add-similarity-heuristic` — Add similarity heuristic](../backlog/items/BL-260612-add-similarity-heuristic.md) implementation because all touch shared consensus runtime and artifact contracts.
- [`BL-260612-add-whole-document` — Add whole-document harmonization pass](../backlog/items/BL-260612-add-whole-document.md) remains next; do not absorb it into this project.

## Repo conventions and gates

- Canonical TypeScript under `src/` generates committed runtime output. Run `pnpm run build` and `pnpm run build:check`; never hand-edit generated files.
- Changed canonical skills require version bumps, top-level/metadata version parity, and `scripts/bump-version.mjs` registration.
- Validate with `pnpm test`, `pnpm run build:check`, `pnpm run validate`, and `pnpm run smoke`. Documentation belongs in Fumadocs, not the README.

## Close-out — same shipping PR

Follow the **Backlog Lifecycle** in `.oat/repo/pjm/AGENTS.md`: close and archive [`BL-260612-add-consensus-research-skill` — Add consensus-research skill](../backlog/items/BL-260612-add-consensus-research-skill.md), update `backlog/completed.md`, regenerate `backlog/index.md`, and refresh `current-state.md` and the curated overview as needed. Delete this handoff with `git rm .oat/repo/pjm/handoffs/BL-260612-add-consensus-research-skill.md` in that same shipping PR.
