# Handoff: Add Similarity Heuristic for Near-Converged Deliberation States

**Backlog item:** `.oat/repo/pjm/backlog/items/BL-260612-add-similarity-heuristic.md`
(`BL-260612-add-similarity-heuristic` — Add similarity heuristic for
near-converged deliberation states)
**Mode:** bank into the **same `/oat-project-quick-start` project and
worktree** as `BL-260612-add-deliberation-metrics` (deliberation metrics) —
one loop-quality arc, one loop-core opening, one regeneration pass. Sequence
it second within that project. If run standalone for any reason, the same
sequencing gate applies: not before `BL-260620-share-consensus-generated`
(share consensus generated runtime output) lands or closes.

## Mission

Let the loop self-confirm almost-converged states — e.g. one extra
confirmation round or counting a near-match toward convergence — instead of
escalating through the agency ladder, when peers settle into
trivially-different phrasings on long documents. Constraints are fixed by
the item and non-negotiable: the measure must be **deterministic and
reproducible** (fixed algorithm + threshold recorded in the artifact),
**agency-gated** (likely moderate+ only; minimal agency stays
strict-hash-only), and **audit-disclosed** (turn records and the resolution
block show when similarity — not hash equality — drove a convergence call).

## Authoritative inputs (populate spec from these)

- The item file — design constraints and acceptance criteria are the spec
  skeleton.
- `.oat/repo/reference/decisions/DR-260502-normalized-hash-convergence.md` —
  the normalization the similarity measure builds on (e.g. normalized edit
  distance over that same normalization), and why convergence is
  deterministic in the first place. The heuristic extends this contract; it
  must not weaken it.
- `.oat/repo/reference/research/consensus/architecture-v3.md` — the origin
  note ("high-similarity-but-not-identical can trigger one more round to
  confirm").
- `src/consensus/core/consensus-loop.ts` — the convergence path: SHA-256
  hash equality plus verdict rules per iteration mode, the
  maximum-agency double-accept rule, and the A-B-A-B oscillation window.
  The heuristic slots beside these, gated so each iteration mode's
  convergence shape stays coherent.
- Escalation-ladder behavior (agency-gated host/user routing) — the thing
  this heuristic reduces the frequency of; its tests live under
  `tests/consensus/core/`.

## Repo conventions and gates

- Test surface the item requires: threshold boundary cases per iteration
  mode + audit-trail disclosure. Add under `tests/consensus/core/`.
- Canonical TS in `src/`, `pnpm run build` + `pnpm run build:check`; never
  hand-edit `// GENERATED` outputs; version bumps for every consensus skill
  whose generated output changes (`validate:skill-versions` enforces).
- Definition of done: `pnpm test`, `pnpm run build:check`, `npm run
  validate`, `npm run smoke`; document the threshold + disclosure semantics
  in the Fumadocs site via `oat-project-document`.

## Close-out (same PR — no exceptions)

Follow the **Backlog Lifecycle** in `.oat/repo/pjm/AGENTS.md`: set the item
`status: closed` + bump `updated`, append the `backlog/completed.md` entry,
`git mv` the item to `backlog/archived/`, run `oat backlog
regenerate-index`, refresh `current-state.md` and the curated overview.
**Then delete this handoff file
(`git rm .oat/repo/pjm/handoffs/BL-260612-add-similarity-heuristic.md`) in
the same PR** — it is consumed context, not documentation. If this item
ships in the same PR as `BL-260612-add-deliberation-metrics` (deliberation
metrics), delete both handoffs there.
