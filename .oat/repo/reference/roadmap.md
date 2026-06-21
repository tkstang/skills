# Skills Repo Roadmap

**Last updated:** 2026-06-21 (Provider-CLI hardening is complete: **bl-3a88** shipped the submit-CLI verdict path with sidecar capture, Codex strict-output avoidance, bounded submit capture, deterministic evidence, and gated live Codex workspace-write E2E; **bl-3291** locked/audited conservative provider-exit retry classification. The consensus-family track can now plan against the decided submit-CLI + parse-fallback contract. `bl-d85f` (v0.1 verification + tag) is also done: **v0.1.0 released** — tag on `main`, `release.yml` green, GitHub Release published; only skills.sh hosted indexing remains as a non-claim.)

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
4. **Convergence quality follow-ons** — similarity heuristic for near-match convergence (bl-ef38). Tool-based verdict submission (bl-3a88) is now shipped as the submit-CLI + sidecar contract; remaining verdict-path follow-ups are opt-in strict require-submission mode and Codex read-only capture-path relocation.

### Release / distribution

- v0.1 release verification (**bl-d85f**) is **done** (2026-06-20): all `RELEASING.md` gates green — automated suite re-run (72 files / 726 tests), CHANGELOG/version/`--check-tag` finalized, README install matrix re-confirmed, and interactive provider permission/runtime smokes passed (Claude Code + Cursor approved a `node` exec prompt; Codex sandboxed-exec does not prompt for read-only commands by design). **v0.1.0 is released:** tag on `main` (`e4e9348`), `release.yml` green, and the GitHub Release is published. Post-tag `npx skills add` source discovery passes; skills.sh hosted indexing is not yet live (async lag) and stays a non-claim.
- Post-tag Agent Skills / `npx skills add` / skills.sh discovery is the only remaining release gate and stays a non-claim until verified after publication.
- Public marketplace submission (Claude/Cursor), Codex Plugin Directory, and skills.sh verification follow the tag; no public claims until verified.

### Transcript tooling (session-observer, export-session-transcript, transcript-core)

Substantially shipped (see `current-state.md`). Deferred items recorded in the archived projects, promotable to backlog on demand: Cursor SQLite chat-history store, provider-hook push integration, Gemini CLI runtime adapter, opt-in notable-event memory capture, richer export rendering options.

### TypeScript / generated runtime tooling

bl-853a and bl-bfb4 are both delivered. TypeScript, Vitest, generated `.mjs`
output, drift guards, and CI/worktree validation are in place, with the
generated-runtime slices done across consensus refine, transcript-core,
export-session-transcript, and session-observer. PR4 completed the final
cleanup: every repo/tooling and session-observer suite now runs as Vitest
`.test.ts` using `expect`, the `node:test` compatibility runner is retired,
`pnpm test` is Vitest-only, and a guard (`tests/tooling/no-node-test-runner.test.ts`)
blocks any reintroduction of `node:test`/`node:assert`/`.test.mjs`. No remaining
runner-migration work; future typed-API tightening (e.g. removing `as any` test
shims) is optional long-tail polish, not a tracked migration item.

A follow-on **test-organization cleanup** (branch-implemented, pending its PR)
reorganized the now-Vitest suite for maintainability: shared setup helpers under
`tests/helpers/`, domain directories (`tests/consensus/{core,refine,evaluate}/`,
`tests/repo/`, `tests/release/`, `tests/tooling/`), and conservative splits of two
oversized suites — behavior-preserving, no runtime/generated `.mjs` changes.
Deferred from that cleanup and promotable on demand: a deeper typed-test-fixture
pass for residual `as any` shims, and per-domain Vitest projects / coverage
reporting if the suite grows enough to justify it.

## Now

- **v0.1 release verification (done 2026-06-20)** — bl-d85f closed all gates: automated suite re-run green (72 files / 726 tests), CHANGELOG `[0.1.0]` dated + `bump-version.mjs 0.1.0` with `--check-tag v0.1.0` clean, README install-matrix re-confirmed against live CLIs, and interactive provider permission/runtime smokes passed (Claude Code + Cursor approved a `node` exec prompt; Codex sandboxed-exec, no prompt for read-only by design). Deliberation-behavior gates reused from PR #9 + suite-confirmed. **v0.1.0 is released** (2026-06-20): tag on `main` (`e4e9348`), `release.yml` green, GitHub Release published. Post-tag `npx skills add` source discovery passes; **skills.sh hosted indexing is not yet live** (async lag) and stays a non-claim until it appears. Authoritative status: the `RELEASING.md` v0.1 Readiness Snapshot.
- **Consensus family (active track)** — one OAT project: **bl-2ed7** (`independent_draft` cold-start, the gate, co-designed with create) → **bl-b9b9** (`consensus-create`, carries the derived-sectioning design) → **bl-87ef** (`-decide`) + **bl-0cb8** (`-plan`) as thin wrappers. Runs in parallel with hardening (disjoint source surface). **bl-645c** (`-research`) is a **separate** project — it uses `shared_input` and carries an unresolved peer tool-access DR.
- **Provider-CLI hardening (done 2026-06-21)** — **bl-3a88** shipped the submit-CLI verdict contract and **bl-3291** shipped retry-classification hardening. The consensus-family track should use this decided provider-CLI contract rather than reopening MCP-vs-CLI or strict-output strategy questions.

## Next

- **Docs IA (immediate post-tag)** — **bl-ecaa**: stand up a docs site (`/oat-docs-bootstrap`; Fumadocs vs MkDocs) and slim the dense README to an entry point, migrating content via `oat-docs-analyze`/`oat-docs-apply`. Gated after the tag (the README install matrix is a tag-time gate) and should land before the family project finishes so the family documents itself into the site via `oat-project-document`. Documentation is part of each project's development — once the site exists, project docs target it, not the README.
- **Post-tag discovery verification** — after the tag/release, verify Agent Skills / skills.sh and any public provider directory discovery paths before making public listing claims.
- **Advisory peer (phone-a-friend)** — **bl-22d3**: a one-shot structured second opinion over the provider CLI (no deliberation loop). Buildable any time, but sequenced **after docs IA** so it documents into the new site and is the first validation that the IA absorbs a new skill cleanly.

## Later

- Harmonization pass (bl-e39a) and deliberation metrics (bl-9ed4) — after the family ships, per v3 Phase 4. Similarity heuristic (bl-ef38) alongside.
- **Plugin packaging maintainability** — **bl-e0e7**: collapse duplicated per-skill `consensus-loop.mjs` to one plugin-local shared script, gated by a 4-host install spike. **Not concurrent with the family project** (shared generated `consensus-loop` output) — land before it starts or after it merges; the spike is best informed by the bl-d85f install work.
- Cursor submit-tool / custom ACP provider path exploration. Reserved-seam seeds: host-native dispatch protocol (bl-3ca6) and multi-peer 3+ extension (bl-f8cb) — go/no-go first, likely defer.
- v3 "for discussion" decision seeds — mid-loop `type=edit` (bl-58b3) and LLM section auto-chunking (bl-db5d); decide before building, may `wont_do`.
- Transcript-tooling deferrals (promote individually if needed).
- **Multi-agent collaboration substrate** — a proposed lane beneath the deliberation engine: how agents observe and message each other on one project, extending `session-observer`. Foundation is the become-observable daemon + merged shared session log (bl-4e2e), then addressable inter-agent messaging (bl-f59f); orchestration (work-claiming, message bus) stays a vault stub until messaging hits real limits. Source: `02 - Projects/Skills/Ideas/2026-06-19-*` (vault) with `cass` prior-art assessed. The TypeScript/test foundation hardening it was gated behind has landed — promotable when there is appetite after the family + docs land.
- Additional plugin groups (`plugins/<name>/`) as new skill families mature — the DR-001 layout already supports this.
