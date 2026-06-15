# Skills Repo Roadmap

**Last updated:** 2026-06-15 (sequenced around active TypeScript/vitest work: pause new consensus implementation until TS lands, defer final v0.1 release/tag verification until post-TS, and reuse PR #9 live-mode evidence for later release checks. Prior: 2026-06-14 post-PR #9 refresh; 2026-06-12 initial backfill.)

## Planning Model

Work is planned as **lanes**, not linear milestones. Sources of truth:

- `roadmap.md` — Now / Next / Later priorities and lane framing.
- `backlog/items/*.md` — executable backlog records (dependencies encoded per item).
- `current-state.md` — shipped snapshot.
- `decision-record.md` — durable decisions (DR-NNN).
- `research/` — evidence inputs; nothing there is a commitment until promoted here or into the backlog.

## Lanes

### Consensus plugin

The v3 family architecture (`research/consensus/architecture-v3.md`) defines 6 skills × 3 iteration modes × 2 cold-start strategies × 3 agency levels over a shared `consensus-loop` primitive. v0.1 shipped Phase 1 **plus** most of Phase 3 (agency, impasse/user-direction flow, oscillation detection) and parts of Phases 4–5 (host-mediated parallel sections, resume). **Phase 2 — iteration modes — is now shipped and merged to `main` (PR #9)** (`parallel_revision`, `parallel_synthesized`, synthesizer selection, agency-gated escalation ladder), verified live with claude+codex. The synthesis-mediation design question resolved as a two-tier model: deterministic wrapper-driven per-round synthesis plus agency-gated host/user escalation for judgment calls (DR-018).

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

- **Let the TypeScript/vitest work land** — bl-853a/bl-bfb4 are active elsewhere and touch the consensus code/test substrate. Avoid new consensus implementation work until that branch lands.
- **Keep release evidence warm, but do not tag yet** — PR #9 already records substantial live claude+codex coverage across alternating, `parallel_revision`, `parallel_synthesized`, and escalation-ladder flows. Final bl-d85f release/tag verification should run after TS lands so tag-time checks match the source/test substrate that will ship.

## Next

- **v0.1 release verification** — run bl-d85f after TS/vitest lands. Reuse PR #9 dogfood as prior evidence; focus reruns on stale/gap behavior and the true release gates: provider install/permission checks, README install matrix, CHANGELOG/version/tag checks, release workflow, and post-tag skills.sh discovery before public claims.
- **First family skill** — resume `consensus-evaluate` (bl-5174) after TS/vitest. Quick-start discovery is already captured in `/Users/tstang/Code/concensus-evaluate`; adapt implementation to the post-TS layout.
- **Remaining family skills** — after `consensus-evaluate`, `-create`, `-decide`, `-plan`, `-research` as thin wrappers with v3 defaults. `-create` front-loads the `independent_draft` cold-start + derived-sectioning design the next two reuse.
- **Peer-invocation ownership** — tool-based verdict submission (bl-3a88) and in-house peer CLI work (bl-bb7e) should be treated as one later design/spike around owning the narrow claude/codex/cursor path rather than depending on Paseo for one per-turn `run` capability.

## Later

- Harmonization pass and deliberation metrics (after the family ships, per v3 Phase 4).
- Cursor-as-peer documentation/dogfooding (custom ACP provider path).
- Transcript-tooling deferrals (promote individually if needed).
- Additional plugin groups (`plugins/<name>/`) as new skill families mature — the DR-001 layout already supports this.
