# Skills Repo Roadmap

**Last updated:** 2026-06-12 (initial backfill; consensus lane sequencing reflects the 2026-06-12 planning discussion — Phase 2 iteration modes before family skills. Now/Next placement is provisional until the next consensus project is scoped.)

## Planning Model

Work is planned as **lanes**, not linear milestones. Sources of truth:

- `roadmap.md` — Now / Next / Later priorities and lane framing.
- `backlog/items/*.md` — executable backlog records (dependencies encoded per item).
- `current-state.md` — shipped snapshot.
- `decision-record.md` — durable decisions (DR-NNN).
- `research/` — evidence inputs; nothing there is a commitment until promoted here or into the backlog.

## Lanes

### Consensus plugin

The v3 family architecture (`research/consensus/architecture-v3.md`) defines 6 skills × 3 iteration modes × 2 cold-start strategies × 3 agency levels over a shared `consensus-loop` primitive. v0.1 shipped Phase 1 **plus** most of Phase 3 (agency, impasse/user-direction flow, oscillation detection) and parts of Phases 4–5 (host-mediated parallel sections, resume). **Phase 2 — iteration modes — is now implemented** (`parallel_revision`, `parallel_synthesized`, synthesizer selection, agency-gated escalation ladder) on `feat/consensus-iteration-modes`, verified live with claude+codex, final review in progress (merge pending). The synthesis-mediation design question resolved as a two-tier model: deterministic wrapper-driven per-round synthesis plus agency-gated host/user escalation for judgment calls (DR-018).

What remains, in dependency order:

1. **Family skills** — `consensus-evaluate`, `-create`, `-decide`, `-plan`, `-research` as thin wrappers with v3 defaults now that their default iteration modes exist. `evaluate` only needs `parallel_revision` and can land earliest (bl-5174).
2. **Harmonization pass** — whole-document coherence after independent section convergence.
3. **Deliberation metrics** — tokens, wall-clock, rounds per section in the resolution block.
4. **Convergence quality follow-ons** — similarity heuristic for near-match convergence (bl-ef38), tool-based verdict submission CLI so peers self-validate schema (bl-3a88), and an in-house peer CLI (bl-bb7e). All deferred as nice-to-haves; deterministic-only escalation shipped.

### Release / distribution

- v0.1 tag gated on `RELEASING.md` manual provider verification (install + permission smoke checks on Claude Code, Cursor, Codex, Agent Skills baseline).
- Public marketplace submission (Claude/Cursor), Codex Plugin Directory, and skills.sh verification follow the tag; no public claims until verified.

### Transcript tooling (session-observer, export-session-transcript, transcript-core)

Substantially shipped (see `current-state.md`). Deferred items recorded in the archived projects, promotable to backlog on demand: Cursor SQLite chat-history store, provider-hook push integration, Gemini CLI runtime adapter, opt-in notable-event memory capture, richer export rendering options.

## Now

- **Land the consensus Phase 2 PR** — `feat/consensus-iteration-modes` (parallel modes + escalation ladder + v1 schema) is implemented and in final review; clear the final review and merge.
- **Scope the first family skill** — `consensus-evaluate` is the earliest fast-follow (needs only `parallel_revision`, now shipped; bl-5174).

## Next

- **Family skills** — `consensus-evaluate` first, then `-create`, `-decide`, `-plan`, `-research` as thin wrappers with v3 defaults.
- **v0.1 release verification** — can run in parallel with consensus work; it gates any public announcement, not development.

## Later

- Harmonization pass and deliberation metrics (after the family ships, per v3 Phase 4).
- Cursor-as-peer documentation/dogfooding (custom ACP provider path).
- Transcript-tooling deferrals (promote individually if needed).
- Additional plugin groups (`plugins/<name>/`) as new skill families mature — the DR-001 layout already supports this.
