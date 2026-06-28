---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-28
oat_generated: false
---

# Discovery: phone-a-friend

## Initial Request

Implement backlog item **BL-260620 — Add phone-a-friend advisory peer skill**.

Ship a lightweight, shipped consensus-family skill for **one-shot advisory peer
consultation**: the host agent asks a single other provider-backed peer for a
structured take on the current question / design / bug / review concern, using
the owned provider invocation CLI as the execution boundary. Critically — **no
deliberation loop and no refine/evaluate artifact**. The host infers the question
from context, compacts relevant context into a focused prompt, asks the user when
the topic is ambiguous or would include sensitive material, and remains
responsible for **dispositioning** the peer's take (agree / disagree / apply /
ignore / follow-up) rather than blindly applying it.

### Cross-project context

This skill is the **pathfinder** for a small "non-converging peer consultation"
sub-family, distinct from refine/evaluate (which converge on one artifact). A
sibling item, **BL-260626 — add consensus-panel skill** (a neutral-moderator
panel of 2+ peers), is a separate later project that will reuse this skill's:

- advisory structured-output schema,
- "prefer a provider different from the host" peer-selection convention,
- provider-CLI execution boundary and advisory-only / self-spawn safety boundary.

Divergence to preserve: **here the host owns the opinion** (dispositions the
take); in the panel the host is a neutral moderator. Design the schema and
peer-selection convention to be cleanly reusable, but **do not** build the panel
here and **do not** prematurely generalize the host role.

## Clarifying Questions

### Question 1: Skill name

**Q:** Ship as `phone-a-friend` or the shorter `phone-friend`?
**A:** `phone-a-friend`.
**Decision:** Use `phone-a-friend` consistently across skill metadata, the skill
directory, docs, examples, and manifests. It is idiomatic and matches the backlog
title, project name, and branch.

### Question 2: Design depth

**Q:** Straight to plan, lightweight design first, or promote to spec-driven?
**A:** Lightweight design first.
**Decision:** Produce a focused `design.md` covering the advisory schema, its
reuse location for the future panel, the peer-selection convention, and the
instruction-only / safety boundary, then generate the plan.

## Solution Space

The request is exploratory in its architecture (a new non-converging sub-family),
but repo exploration substantially de-risked it: the owned provider CLI already
exposes the one-shot primitive this skill needs.

### Approach 1: Instruction-only skill over `consensus run` _(Recommended, chosen)_

**Description:** A new `plugins/consensus/skills/phone-a-friend/` containing a
`SKILL.md` plus a single shipped JSON contract (`schemas/advisory.schema.json`).
The skill carries **no `src/` TypeScript, no generated `.mjs`, and no
`consensus-loop` copy**. It leans entirely on the already-shipped
`consensus run --provider <id> --schema <path> --json` command — a single
provider turn (`runProviderTurn`) that validates output against a JSON schema and
supports `--model`, `--effort`, and `--max-depth`. The SKILL.md drives the host
to infer/compact/ask/select/invoke/disposition.
**When this is the right choice:** When the platform already owns the single-call
primitive and the deterministic work is "one structured peer call." Maximizes
reuse, keeps the skill trivially dependency-free, and matches the "one-shot, no
loop" framing exactly.
**Tradeoffs:** The advisory behavior lives in instructions + schema rather than a
typed wrapper, so there is no per-skill wrapper unit surface; correctness is
validated through the schema, the existing `consensus run` tests, and skill
instruction reviews.

### Approach 2: Thin TS wrapper + generated `.mjs` (mirror refine/evaluate)

**Description:** Add `src/consensus/phone-a-friend/consensus-phone-a-friend.ts`
that orchestrates a single peer call (no loop), build it to a generated `.mjs`,
and ship it like the other skills.
**When this is the right choice:** When the skill needs bespoke orchestration the
CLI cannot express, or a dedicated CLI surface/flags.
**Tradeoffs:** Reintroduces a per-skill runtime artifact and the generated-output
build/drift burden for behavior the existing `consensus run` already provides —
contradicts the "no loop / lean" intent. Rejected.

### Chosen Direction

**Approach:** Approach 1 — instruction-only skill over `consensus run`.
**Rationale:** `consensus run` is already the sanctioned execution boundary and
performs exactly one schema-validated provider turn; `host-guard.ts` already
enforces self-spawn / recursion safety (different-host allowed; same-host only as
isolated subprocess up to `max_depth`, else `HOST_RECURSION_BLOCKED`). Building a
wrapper would duplicate shipped machinery and add a generated-runtime burden for
no behavioral gain.
**User validated:** Yes — chose `phone-a-friend` + lightweight design, with the
recommended instruction-only architecture presented in the same turn.

## Key Decisions

1. **Naming:** Ship as `phone-a-friend` everywhere (skill dir, frontmatter,
   docs, examples, manifests).
2. **Architecture:** Instruction-only skill — `SKILL.md` + a single shipped
   `advisory` JSON schema; no `src/` TS, no generated `.mjs`, no loop copy.
3. **Execution boundary:** Use the existing `consensus run` command as the
   single-peer advisory call boundary (with `consensus provider ls` /
   `preflight` for selection and readiness). No new CLI subcommand.
4. **Advisory schema (reusable):** Capture at least understood question, peer
   take, recommendation, risks / missed considerations, follow-up questions, and
   confidence. Shape it as the canonical contract the future consensus-panel
   skill reuses.
5. **Peer selection:** Prefer a provider **different** from the host; allow
   explicit user/provider override; fall back to same-provider only when no other
   is usable, relying on the `--max-depth` recursion guard.
6. **Host disposition:** The host owns the opinion. The workflow includes an
   explicit disposition step (agree / disagree / apply / ignore / follow-up) and
   the host explains how the take affected its next action. The peer output is
   advisory only.
7. **Docs placement:** Document inside the existing User Guide consensus section
   (`documentation/docs/user-guide/consensus/`), not the README and not a new
   top-level section — this is also the first validation that the docs IA absorbs
   a new skill cleanly.

## Constraints

- Shipped skill code must be dependency-free (Node stdlib only, no install step);
  the provider CLI subprocess is the only sanctioned external boundary.
- If any runtime `.mjs` is generated from canonical TS under `src/`, edit the
  source and run `pnpm run build` — never hand-edit generated `// GENERATED`
  output. (This skill intentionally ships no generated runtime.)
- Version bumps are enforced on edit: bump the skill's `SKILL.md` version and keep
  top-level `version` and `metadata.version` in sync. Add the new SKILL.md to
  `SKILL_FILES` in `scripts/bump-version.mjs`.
- Register the skill in the consensus plugin manifests
  (`.claude-plugin` / `.cursor-plugin` / `.codex-plugin`) and any marketplace
  manifests as the existing skills are.
- Documentation goes into the Fumadocs site under `documentation/docs/`
  (read `documentation/AGENTS.md` first), placed within the existing User Guide
  consensus structure; update the section `## Contents` and regenerate the index.
- Run `oat sync` to refresh provider views; verify with `npm test`,
  `pnpm run build:check`, `npm run validate` (and `npm run smoke`).

## Success Criteria

- A new shipped `phone-a-friend` skill exists for one-shot advisory peer
  consultation using the provider CLI and a documented structured-output schema.
- SKILL.md tells the host how to infer the advisory question from context,
  summarize only relevant context, and ask the user when the topic is unclear or
  the prompt would include sensitive material.
- Default peer selection prefers a provider different from the host, with explicit
  user/provider overrides available.
- The advisory response captures at least: understood question, peer take,
  recommendation, risks / missed considerations, follow-up questions, confidence.
- The host-facing workflow includes a disposition step (agree / disagree / apply /
  ignore / follow-up) with the host explaining how the take affected its next
  action.
- Recursion/safety is specified: guard against unnecessary same-provider
  self-spawn, and a clear boundary that the peer output is advisory only.
- Naming is `phone-a-friend` and consistent across metadata, docs, examples,
  scripts, and manifests.
- `npm test`, `pnpm run build:check`, and `npm run validate` pass; `oat sync`
  leaves provider mirrors consistent.

## Out of Scope

- The consensus-panel skill (BL-260626) — separate later project. Do not build a
  multi-peer panel or a neutral-moderator role here.
- Any deliberation loop, convergence, or refine/evaluate-style artifact output.
- A new `consensus` CLI subcommand — the existing `run` command is sufficient.
- Generalizing the host role beyond "host owns the opinion."

## Open Questions

- **Schema location:** Ship the advisory schema under the skill's own
  `schemas/advisory.schema.json` as the canonical reusable contract, vs. a shared
  schemas location. (Resolve in design; default is the per-skill location, with
  the panel referencing/copying it.)
- **Docs index framing:** The consensus User Guide index currently says "v0.1
  ships five skills." Decide whether to reframe as an "advisory" sub-family entry
  or a minimal additive note. (Resolve in design/plan; keep additive and scoped.)

## Assumptions

- `consensus run` enforces (or accepts `--max-depth` to enforce) the same
  host-guard recursion protection used elsewhere; the implementation will verify
  this against `host-guard.ts` / `runProviderTurn` wiring.
- The host agent knows its own provider identity (it is the running runtime), so
  "prefer a different provider" is resolvable from `consensus provider ls` plus
  the host's self-knowledge.

## Next Steps

Proceed to lightweight design (`design.md`): advisory schema shape + location,
peer-selection convention, instruction-only/safety boundary, and testing
strategy. Then generate `plan.md` for `oat-project-implement`.
