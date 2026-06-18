# Skills Repo Roadmap

**Last updated:** 2026-06-18 (session-observer joined the TypeScript/Vitest generated-runtime substrate; bl-bfb4 remains open only for remaining non-migrated suites and eventual `node:test` runner retirement. Prior: 2026-06-17 consensus-evaluate delivered as the first post-refine family skill; 2026-06-15 toolchain and `consensus-loop` proof slice.)

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

1. **Remaining family skills** — `consensus-create`, `-decide`, `-plan`, `-research` as thin wrappers with v3 defaults now that `consensus-evaluate` has proved the post-TS wrapper pattern.
2. **Harmonization pass** — whole-document coherence after independent section convergence.
3. **Deliberation metrics** — tokens, wall-clock, rounds per section in the resolution block.
4. **Convergence quality follow-ons** — similarity heuristic for near-match convergence (bl-ef38), tool-based verdict submission CLI so peers self-validate schema (bl-3a88), and an in-house peer CLI (bl-bb7e). All deferred as nice-to-haves; deterministic-only escalation shipped.

### Release / distribution

- v0.1 tag gated on `RELEASING.md` manual provider verification (install + permission smoke checks on Claude Code, Cursor, Codex, Agent Skills baseline).
- Public marketplace submission (Claude/Cursor), Codex Plugin Directory, and skills.sh verification follow the tag; no public claims until verified.

### Transcript tooling (session-observer, export-session-transcript, transcript-core)

Substantially shipped (see `current-state.md`). Deferred items recorded in the archived projects, promotable to backlog on demand: Cursor SQLite chat-history store, provider-hook push integration, Gemini CLI runtime adapter, opt-in notable-event memory capture, richer export rendering options.

### TypeScript / generated runtime tooling

bl-853a is delivered: TypeScript, Vitest, generated `.mjs` output, drift guards,
and CI/worktree validation are in place, with `consensus-loop` converted as the
proof-point module. bl-bfb4 remains in progress rather than complete, but the
major generated-runtime slices are now done: consensus refine, transcript-core,
export-session-transcript, and session-observer all have canonical TypeScript
source and migrated Vitest coverage for their in-scope tests. Remaining work is
PR4/follow-up cleanup: final repo-wide `node:test` compatibility retirement,
remaining non-migrated suites, and any selected long-tail typed migration needed
before simplifying the mixed runner contract.

## Now

- **v0.1 release verification** — run bl-d85f after this TypeScript/vitest branch lands. Reuse PR #9 dogfood as prior evidence; focus reruns on stale/gap behavior and the true release gates: provider install/permission checks, README install matrix, CHANGELOG/version/tag checks, release workflow, and post-tag skills.sh discovery before public claims.
- **Package the current consensus feature set for release** — now that `consensus-evaluate` has landed, refresh release notes and provider QA around both shipped consensus skills before tagging.

## Next

- **Finish TypeScript migration cleanup** — bl-bfb4 should stay open until the remaining non-migrated suites leave `test:node` and the mixed `pnpm test` runner can be simplified. The generated-runtime migration pattern itself is now proven across consensus refine, transcript-core/export-session, and session-observer.
- **Remaining family skills** — after `consensus-evaluate`, `-create`, `-decide`, `-plan`, `-research` as thin wrappers with v3 defaults. `-create` front-loads the `independent_draft` cold-start + derived-sectioning design the next two reuse.
- **Peer-invocation ownership** — tool-based verdict submission (bl-3a88) and in-house peer CLI work (bl-bb7e) should be treated as one later design/spike around owning the narrow claude/codex/cursor path rather than depending on Paseo for one per-turn `run` capability.

## Later

- Harmonization pass and deliberation metrics (after the family ships, per v3 Phase 4).
- Cursor-as-peer documentation/dogfooding (custom ACP provider path).
- Transcript-tooling deferrals (promote individually if needed).
- Additional plugin groups (`plugins/<name>/`) as new skill families mature — the DR-001 layout already supports this.
