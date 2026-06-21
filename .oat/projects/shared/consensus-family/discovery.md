---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-06-21
oat_generated: false
---

# Discovery: consensus-family

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details.

- Prefer outcomes and constraints over concrete deliverables (no specific scripts, file paths, or function names).
- If an implementation detail comes up, capture it as an **Open Question** for design (or a constraint), not as a deliverable list.

## Initial Request

Spec-driven OAT project delivering the **consensus skill family** (create / decide / plan), in one cohesive project, sequenced:

1. **bl-2ed7** — implement the `independent_draft` cold-start strategy in the consensus loop (the **gate**; no observable behavior without a consumer).
2. **bl-b9b9** — add the **consensus-create** skill (carries the design weight; co-designed with bl-2ed7).
3. **bl-87ef** — add the **consensus-decide** skill (thin wrapper).
4. **bl-0cb8** — add the **consensus-plan** skill (thin wrapper).

**Out of scope:** bl-645c (consensus-research) is a separate project — it uses `shared_input` (not gated on bl-2ed7) and carries an unrelated peer tool-access DR. Not pulled in here.

## Context Synthesis (canonical inputs)

Drawn from the four backlog items, `architecture-v3.md`, the priority-alignment review, the shipped `refine`/`evaluate` wrapper templates, and the canonical `src/consensus/core/consensus-loop.ts` + `src/consensus/provider-cli/`.

- **Cold-start is an independent axis from iteration mode**: 3 iteration modes (alternating / parallel_revision / parallel_synthesized) × 2 cold-start strategies (`shared_input`, `independent_draft`) = 6 configs.
  - `shared_input` (shipped v0.1): all peers see the same starting artifact in round 1. Natural where an artifact already exists (refine/evaluate).
  - `independent_draft` (this project): round 1 has each peer produce its own output from the **brief**, with no shared starting artifact. Natural for create/decide/plan.
- **Current code hard-rejects `independent_draft` at three layers**: the core `ColdStartMode` type is closed to `'shared_input'`; the loop arg parser throws; and both wrappers repeat the rejection. So bl-2ed7 is a primitive-level unlock (widen the type, replace rejection with validation, implement round-1 behavior), not a tweak.
- **The resolution-block data model already carries `cold_start`** end-to-end — it is currently pinned to `'shared_input'`. "Record the chosen cold-start" is largely satisfied once the value can legally be `independent_draft`.
- **bl-3a88 (provider-cli verdict submission) is DONE** (resolved via DR-024: owned submit-CLI seam + parse fallback; MCP rejected). It de-risks the synthesized-mode family wrappers — the historical structured-output fragility was the leading reliability risk for parallel/synthesized, and the verdict-capture contract is now decided. `src/consensus/provider-cli/` is confirmed **disjoint** from `src/consensus/core/` (one-way type-only import; no reverse dependency), so the hardening lane and this family lane do not churn each other.

## Solution Space

### Cold-start mechanics across the three iteration modes

- **Parallel modes (parallel_revision / parallel_synthesized):** independent_draft is natural — round 1, each peer drafts its own v1 from the brief (no shared seed). parallel_synthesized then merges the two independent drafts via the existing synthesis step; parallel_revision feeds both drafts forward. This is the clean, well-defined case.
- **Alternating mode:** independent_draft has a less obvious meaning (one call per round). The coherent reading is "peer A drafts from the brief in round 1, peer B then revises A's draft" — a degenerate but well-defined semantics. bl-2ed7's AC requires the strategy work across **all three** modes.

### Derived sectioning for consensus-create (the headline design decision)

`architecture-v3`'s sectioning model is **input-driven** (detect sections from an existing document's headings/markers). consensus-create has **no input artifact** — the artifact is produced from a brief — so structure must be **derived**, not detected. Two strategies:

- **Whole-artifact:** deliberate the entire artifact as one unit (the brief is the single "section"). Reuses the existing single-section loop; no new machinery; unblocks decide/plan fastest. Gives up per-section parallelism / bounded per-section convergence for large documents.
- **Outline-first:** peers first converge on an outline/section structure, then deliberate each derived section. Restores sectioning/parallelism, but needs a new "derive structure" pre-phase and couples sooner to whole-document harmonization (bl-e39a) and auto-chunking (bl-db5d).

### Chosen Direction

- **Cold-start mechanics:** parallel modes are the primary path (each peer drafts its own v1 from the brief); alternating supports the degenerate "A drafts, B revises" so the full mode matrix stays coherent. _User validated: Yes._
- **Sectioning:** whole-artifact for v1; outline-first deferred. _User validated: Yes._
- **decide/plan output:** prompt/template-framed structured markdown (required headings) + resolution block; no new machine schema in v1. _User validated: Yes._

## Key Decisions

_Locked in by the project kickoff (authoritative):_

1. **One cohesive project, sequenced:** land bl-2ed7 + bl-b9b9 first (design-heavy core), then bl-87ef + bl-0cb8 as thin wrappers (parallelizable). bl-645c stays a separate project.
2. **Per-skill v3 defaults:**
   - create = `independent_draft` / `parallel_synthesized` / **maximum** agency.
   - decide = `independent_draft` / `parallel_synthesized` / **minimal** agency (contested calls always surface to the user).
   - plan = `independent_draft` / `parallel_synthesized` / **moderate** agency.
3. **Expose `--cold-start shared_input | independent_draft`** on the loop; the chosen strategy is recorded in the resolution block.
4. **bl-2ed7 covered by consensus-loop-level tests** independent of any one skill.

_Validated with the user in this discovery (2026-06-21):_

5. **Derived sectioning (create): whole-artifact for v1.** Deliberate the whole artifact as one unit (the brief is the single section), reusing the existing single-section loop. This proves `independent_draft` + `parallel_synthesized` end-to-end without dragging in outline derivation, harmonization, or auto-chunking. Outline-first is recorded as deferred. decide/plan inherit whole-artifact.
6. **Alternating + independent_draft: accept the degenerate semantics** — round 1, peer A drafts from the brief, peer B revises A's draft. Not the default path, but it keeps the 3×2 mode matrix coherent and satisfies the existing bl-2ed7 AC ("works across all three modes"). The two parallel modes remain the natural/primary path.
7. **decide output contract: structured markdown decision document** with required headings (recommendation, reasoning, alternatives, dissent / unresolved disagreement), plus the existing resolution block. Enforced via prompt/template framing — **no new machine schema in v1** unless a real consumer needs it. The same approach applies to plan (structured markdown: steps, dependencies, risks); decide/plan stay true thin wrappers (configuration + framing, reusing the loop core and mode-driven verdict/synthesis schemas).
8. **HiLL checkpoints: `discovery` + `design`.** Approve requirements at end of discovery and the co-designed architecture before plan/implement; once design is approved, implementation is allowed to move without further pauses.

## Constraints

- **Shipped skills stay dependency-free / install-free** — Node stdlib only; provider CLI subprocess is the only external execution boundary.
- **Build discipline:** edit canonical TypeScript under `src/consensus/`; run `pnpm run build` to regenerate committed `.mjs`; never hand-edit `// GENERATED` outputs.
- **Version discipline:** bump each new/changed shipped skill's `version` and keep `metadata.version` in sync; add new skills to `SKILL_FILES` in `scripts/bump-version.mjs`; the on-edit version-bump validator must pass.
- **Wrapper anatomy must be replicated** for each new skill: SKILL.md (+ matching versions), TS source under `src/consensus/<name>/`, schemas (likely reused — they are mode-driven, not skill-driven), references/examples, manifest + README entries, tests, and the generated build.
- **Cross-track coordination:** bl-e0e7 (shared generated runtime output) must NOT run while this project is live — it changes how `consensus-loop.mjs` is emitted and would fight these changes.

## Success Criteria

- `independent_draft` works across all three iteration modes, with the chosen cold-start recorded in the resolution block, covered by loop-level tests.
- consensus-create, consensus-decide, consensus-plan exist as shipped skills with their v3 defaults, manifests, SKILL.md, schemas, references, and tests.
- Gates pass: `pnpm run build:check`, `pnpm run type-check`, `pnpm run test`, `pnpm run validate`, `pnpm run smoke`.
- Durable decisions promoted to `decision-record.md` as DR(s) — cold-start strategy, whole-artifact sectioning, alternating-mode degenerate semantics, and the decide/plan structured-markdown output contract; the four backlog items, `completed.md`, `current-state.md`, and `roadmap.md` updated at completion.

## Out of Scope

- bl-645c (consensus-research) — separate project (shared_input, unrelated peer tool-access DR).
- bl-e0e7 (shared generated runtime output) — must not run concurrently.
- Whole-document harmonization (bl-e39a) and LLM section auto-chunking (bl-db5d) — deferred fill-ins, only relevant if outline-first is chosen for v1.

## Deferred Ideas

- **Outline-first derived sectioning** — deferred for v1; revisit when large-document creation demands per-section parallelism (would pull bl-e39a harmonization / bl-db5d auto-chunking forward).
- **Machine-readable decision/plan schema** — deferred; add only if a real consumer needs structured (non-markdown) output from decide/plan.
- Strict "require-submission" verdict mode and Codex read-only capture-path relocation — narrower bl-3a88 follow-ups; explicitly do not block this family.

## Open Questions

_Resolved in this discovery (see Key Decisions 5–8): derived sectioning → whole-artifact; alternating semantics → degenerate A-drafts/B-revises; decide contract → structured markdown + resolution block (no machine schema); HiLL gates → discovery + design._

Remaining for design:

- **cold_start recording scope (design detail):** resolution block only (already plumbed), or also recorded at the core per-section status/terminal-artifact level? _(defer to design unless a need emerges)_
- **Required-headings enforcement (decide/plan):** prompt/template framing only for v1; revisit programmatic validation only if a real consumer needs machine-readable structure.
- **Brief-as-untrusted-content:** the new round-1 prompts must frame brief/options/constraints as untrusted data with the same 1 MiB input cap as existing wrappers _(carry into design)_.

## Assumptions

- bl-3a88's submit-CLI + parse-fallback verdict contract is the stable basis for synthesized-mode reliability (it is marked done).
- Verdict/synthesis schemas are mode-driven and reusable across create/decide/plan without per-skill schema changes (to be confirmed in design).

## Risks

- **Alternating-mode semantics for independent_draft:** the semantics are decided (Key Decision 6: degenerate A-drafts/B-revises), but they are awkward and non-default — the residual risk is that the behavior satisfies the AC letter but surprises users.
  - **Likelihood:** Medium · **Impact:** Medium · **Mitigation:** specify the degenerate flow precisely in design; cover with loop-level tests per mode; document it as a non-default path.
- **Sectioning scope creep:** outline-first pulls in harmonization/auto-chunking machinery beyond v1.
  - **Likelihood:** Medium · **Impact:** Medium · **Mitigation:** prefer whole-artifact for v1, document outline-first as a deferred path.
- **Generated-output drift:** hand-editing `.mjs` or skipping `pnpm run build` breaks the build:check gate.
  - **Likelihood:** Low · **Impact:** Medium · **Mitigation:** edit TS only; run build + build:check before commits.

## Next Steps

Use this discovery artifact to drive the next workflow step:

- **Spec-driven mode:** continue to `oat-project-design` (which confirms requirements and produces both `spec.md` and `design.md`).
