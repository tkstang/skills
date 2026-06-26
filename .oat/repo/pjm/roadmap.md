# Skills Repo Roadmap

**Last updated:** 2026-06-22 (**consensus-family** is implementation-complete: **BL-260619-implement-independent-draft**, **BL-260612-add-consensus-create-skill**, **BL-260612-add-consensus-decide-skill**, and **BL-260612-add-consensus-plan-skill** are done; `independent_draft` is now a shared loop cold-start, and `consensus-create`, `consensus-decide`, and `consensus-plan` ship as generated TypeScript-backed wrappers documented in the Fumadocs site. **docs IA** (`BL-260620-stand-up-a-documentation-site`) is done: a Fumadocs docs site was stood up at `documentation/`; framework decision recorded as DR-025. **Provider-CLI hardening** is complete: **BL-260613-tool-based-verdict-submission** shipped the submit-CLI verdict path and **BL-260619-refine-provider-exit-retry** locked/audited conservative provider-exit retry classification (DR-024). `BL-260612-complete-v0-1-release` (v0.1 verification + tag) is done: **v0.1.0 released** — tag on `main`, `release.yml` green, GitHub Release published; skills.sh hosted indexing remains a non-claim until verified.)

## Planning Model

Work is planned as **lanes**, not linear milestones. Sources of truth:

- `.oat/repo/pjm/roadmap.md` — Now / Next / Later priorities and lane framing.
- `.oat/repo/pjm/backlog/items/*.md` — executable backlog records (dependencies encoded per item).
- `.oat/repo/pjm/current-state.md` — shipped snapshot.
- `.oat/repo/reference/decisions/` — durable decisions.
- `.oat/repo/reference/research/` — evidence inputs; nothing there is a commitment until promoted here or into the backlog.

## Lanes

### Consensus plugin

The v3 family architecture (`research/consensus/architecture-v3.md`) defines 6 skills × 3 iteration modes × 2 cold-start strategies × 3 agency levels over a shared `consensus-loop` primitive. v0.1 shipped Phase 1 **plus** most of Phase 3 (agency, impasse/user-direction flow, oscillation detection) and parts of Phases 4–5 (host-mediated parallel sections, resume). **Phase 2 — iteration modes — is now shipped and merged to `main` (PR #9)** (`parallel_revision`, `parallel_synthesized`, synthesizer selection, agency-gated escalation ladder), verified live with claude+codex. The synthesis-mediation design question resolved as a two-tier model: deterministic wrapper-driven per-round synthesis plus agency-gated host/user escalation for judgment calls (DR-018). The consensus-family project adds `independent_draft` and the create/decide/plan wrappers; `consensus-research` is the only remaining unshipped family skill.

What remains, in dependency order:

1. **Remaining family skill** — `consensus-research` as a separate design/build project because peer tool access and evidence capture need their own durable decision; it uses `shared_input`, not `independent_draft`.
2. **Harmonization pass** — whole-document coherence after independent section convergence.
3. **Deliberation metrics** — tokens, wall-clock, rounds per section in the resolution block.
4. **Convergence quality follow-ons** — similarity heuristic for near-match convergence (BL-260612-add-similarity-heuristic). Tool-based verdict submission (BL-260613-tool-based-verdict-submission) is now shipped as the submit-CLI + sidecar contract; remaining verdict-path follow-ups are opt-in strict require-submission mode and Codex read-only capture-path relocation.

### Release / distribution

- v0.1 release verification (**BL-260612-complete-v0-1-release**) is **done** (2026-06-20): all `RELEASING.md` gates green — automated suite re-run (72 files / 726 tests), CHANGELOG/version/`--check-tag` finalized, README install matrix re-confirmed, and interactive provider permission/runtime smokes passed (Claude Code + Cursor approved a `node` exec prompt; Codex sandboxed-exec does not prompt for read-only commands by design). **v0.1.0 is released:** tag on `main` (`e4e9348`), `release.yml` green, and the GitHub Release is published. Post-tag `npx skills add` source discovery passes; skills.sh hosted indexing is not yet live (async lag) and stays a non-claim.
- Post-tag Agent Skills / `npx skills add` / skills.sh discovery is the only remaining release gate and stays a non-claim until verified after publication.
- Public marketplace submission (Claude/Cursor), Codex Plugin Directory, and skills.sh verification follow the tag; no public claims until verified.

### Transcript tooling (session-observer, export-session-transcript, transcript-core)

Substantially shipped (see `current-state.md`). Deferred items recorded in the archived projects, promotable to backlog on demand: Cursor SQLite chat-history store, provider-hook push integration, Gemini CLI runtime adapter, opt-in notable-event memory capture, richer export rendering options.

### TypeScript / generated runtime tooling

BL-260614-stand-up-typescript-vitest and BL-260614-migrate-consensus-tests are both delivered. TypeScript, Vitest, generated `.mjs`
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

- **v0.1 release verification (done 2026-06-20)** — BL-260612-complete-v0-1-release closed all gates: automated suite re-run green (72 files / 726 tests), CHANGELOG `[0.1.0]` dated + `bump-version.mjs 0.1.0` with `--check-tag v0.1.0` clean, README install-matrix re-confirmed against live CLIs, and interactive provider permission/runtime smokes passed (Claude Code + Cursor approved a `node` exec prompt; Codex sandboxed-exec, no prompt for read-only by design). Deliberation-behavior gates reused from PR #9 + suite-confirmed. **v0.1.0 is released** (2026-06-20): tag on `main` (`e4e9348`), `release.yml` green, GitHub Release published. Post-tag `npx skills add` source discovery passes; **skills.sh hosted indexing is not yet live** (async lag) and stays a non-claim until it appears. Authoritative status: the `RELEASING.md` v0.1 Readiness Snapshot.
- **Consensus family (done 2026-06-22)** — **BL-260619-implement-independent-draft** (`independent_draft` cold-start), **BL-260612-add-consensus-create-skill** (`consensus-create`), **BL-260612-add-consensus-decide-skill** (`consensus-decide`), and **BL-260612-add-consensus-plan-skill** (`consensus-plan`) are complete.
- **Post-tag discovery verification** — after the v0.1.0 tag/release, verify Agent Skills / skills.sh and any public provider directory discovery paths before making public listing claims.

## Next

- **Consensus research** — **BL-260612-add-consensus-research-skill**: the last family skill, kept as a separate project because peer tool access, evidence capture, and permissions need an explicit design/DR before build. It uses `shared_input`, so it is not gated on the completed `independent_draft` work.
- **Advisory peer (phone-a-friend)** — **BL-260620-add-phone-a-friend-advisory**: a one-shot structured second opinion over the provider CLI (no deliberation loop). Buildable any time; the "sequenced after docs IA" gate is now **satisfied** — docs IA has landed, so BL-260620-add-phone-a-friend-advisory documents into the live site and is the first validation that the IA absorbs a new skill cleanly.

## Later

- Harmonization pass (BL-260612-add-whole-document) and deliberation metrics (BL-260612-add-deliberation-metrics) — after create/decide/plan land, per v3 Phase 4. Similarity heuristic (BL-260612-add-similarity-heuristic) alongside.
- **Plugin packaging maintainability** — **BL-260620-share-consensus-generated**: collapse duplicated per-skill `consensus-loop.mjs` to one plugin-local shared script, gated by a 4-host install spike. **Not concurrent with the family project** (shared generated `consensus-loop` output) — land before it starts or after it merges; the spike is best informed by the BL-260612-complete-v0-1-release install work.
- Cursor submit-tool / custom ACP provider path exploration. Reserved-seam seeds: host-native dispatch protocol (BL-260619-define-host-native-dispatch) and multi-peer 3+ extension (BL-260619-multi-peer-3-deliberation) — go/no-go first, likely defer.
- v3 "for discussion" decision seeds — mid-loop `type=edit` (BL-260620-mid-loop-user-artifact-edits) and LLM section auto-chunking (BL-260620-llm-section-auto-chunking); decide before building, may `wont_do`.
- Transcript-tooling deferrals (promote individually if needed).
- **Multi-agent collaboration substrate** — a proposed lane beneath the deliberation engine: how agents observe and message each other on one project, extending `session-observer`. Foundation is the become-observable daemon + merged shared session log (BL-260619-shared-session-log-substrate), then addressable inter-agent messaging (BL-260619-inter-agent-direct-messaging); orchestration (work-claiming, message bus) stays a vault stub until messaging hits real limits. Source: `02 - Projects/Skills/Ideas/2026-06-19-*` (vault) with `cass` prior-art assessed. The TypeScript/test foundation hardening it was gated behind has landed — promotable when there is appetite after the family + docs land.
- Additional plugin groups (`plugins/<name>/`) as new skill families mature — the DR-001 layout already supports this.
