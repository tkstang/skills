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

The v3 family architecture (`research/consensus/architecture-v3.md`) defines 6 skills × 3 iteration modes × 2 cold-start strategies × 3 agency levels over a shared `consensus-loop` primitive. v0.1 shipped Phase 1 **plus** most of Phase 3 (agency, impasse/user-direction flow, oscillation detection) and parts of Phases 4–5 (host-mediated parallel sections, resume).

What remains, in dependency order:

1. **Phase 2 — iteration modes** (`parallel_revision`, `parallel_synthesized`). Gating insight: every unbuilt family skill defaults to one of these modes (evaluate → parallel_revision; create/decide/plan/research → parallel_synthesized). Building wrappers first would ship them off-spec in alternating mode. Headline design question: synthesis mediation — v3 assumed a model orchestrator, but v0.1's orchestrator is a deterministic script, so synthesized mode needs either host-mediated synthesis turns (consistent with DR-003's dispatch pattern) or a third peer call (loses the broader-context rationale). Needs a design pass before build.
2. **Family skills** — `consensus-evaluate`, `-create`, `-decide`, `-plan`, `-research` as thin wrappers with v3 defaults. `evaluate` only needs parallel_revision and can land earliest.
3. **Harmonization pass** — whole-document coherence after independent section convergence.
4. **Deliberation metrics** — tokens, wall-clock, rounds per section in the resolution block.

### Release / distribution

- v0.1 tag gated on `RELEASING.md` manual provider verification (install + permission smoke checks on Claude Code, Cursor, Codex, Agent Skills baseline).
- Public marketplace submission (Claude/Cursor), Codex Plugin Directory, and skills.sh verification follow the tag; no public claims until verified.

### Transcript tooling (session-observer, export-session-transcript, transcript-core)

Substantially shipped (see `current-state.md`). Deferred items recorded in the archived projects, promotable to backlog on demand: Cursor SQLite chat-history store, provider-hook push integration, Gemini CLI runtime adapter, opt-in notable-event memory capture, richer export rendering options.

## Now

- **Scope the next consensus project** — decide between: Phase 2 both modes (recommended); the smaller parallel-revision + `consensus-evaluate` increment; or one larger modes-plus-family project. The synthesis-mediation design question is the first artifact either way.

## Next

- **Consensus Phase 2 implementation** (per scoping above), then **family skills** as fast follow-ons.
- **v0.1 release verification** — can run in parallel with consensus work; it gates any public announcement, not development.

## Later

- Harmonization pass and deliberation metrics (after the family ships, per v3 Phase 4).
- Cursor-as-peer documentation/dogfooding (custom ACP provider path).
- Transcript-tooling deferrals (promote individually if needed).
- Additional plugin groups (`plugins/<name>/`) as new skill families mature — the DR-001 layout already supports this.
