# Skills Repo Roadmap

**Last updated:** 2026-06-19 (consensus peer invocation now defaults to the owned provider CLI for Refine/Evaluate, completing **bl-bb7e** and superseding the old external peer-run boundary (DR-023). consensus-rubric-guidance brought `refine` + `evaluate` to authoring-best-practice parity with a validator-backed top-level skill `version` (DR-022), plus guided rubric creation and four bundled example rubrics. Also 2026-06-19: v0.1 release verification refreshed automated gates, provider install evidence, release notes, version/tag checks, and release workflow parity; test-organization cleanup landed shared `tests/helpers/`, a domain-organized test tree, and two oversized suites split. Prior: PR4 retired the `node:test` runner and completed **bl-bfb4**.)

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
4. **Convergence quality follow-ons** — similarity heuristic for near-match convergence (bl-ef38), tool-based verdict submission so peers self-validate schema (bl-3a88), and Cursor authenticated end-to-end provider CLI verification (bl-f0b6). The owned provider CLI is now shipped; deterministic-only escalation shipped.

### Release / distribution

- v0.1 tag gated on `RELEASING.md` manual provider verification: automated gates and local Claude/Codex installs are current, but interactive permission prompts, Cursor locked-keychain/provider-error resolution, and post-tag Agent Skills / skills.sh discovery remain.
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

- **v0.1 release verification** — bl-d85f is in progress on the release-verification branch. Completed so far: current automated gates, README/CHANGELOG/version/tag checks, release workflow parity, and local Claude/Codex install evidence. Remaining before tag: interactive provider permission prompts and Cursor keychain/provider-error resolution or explicit unsupported-path release note.
- **Post-tag discovery verification** — after the tag/release, verify Agent Skills / skills.sh and any public provider directory discovery paths before making public listing claims.

## Next

- **Remaining family skills** — after `consensus-evaluate`, `-create`, `-decide`, `-plan`, `-research` as thin wrappers with v3 defaults. `-create` front-loads the `independent_draft` cold-start + derived-sectioning design the next two reuse.
- **Peer-invocation hardening** — tool-based verdict submission (bl-3a88) remains a later reliability design now that the provider CLI owns the claude/codex/cursor path. Cursor-as-peer verification (bl-f0b6) should rerun against the provider CLI once the local Cursor keychain/auth state is usable.

## Later

- Harmonization pass and deliberation metrics (after the family ships, per v3 Phase 4).
- Cursor-as-peer documentation/dogfooding (custom ACP provider path).
- Transcript-tooling deferrals (promote individually if needed).
- **Multi-agent collaboration substrate** — a proposed lane beneath the deliberation engine: how agents observe and message each other on one project, extending `session-observer`. Foundation is the become-observable daemon + merged shared session log (bl-4e2e), then addressable inter-agent messaging (bl-f59f); orchestration (work-claiming, message bus) stays a vault stub until messaging hits real limits. Source: `02 - Projects/Skills/Ideas/2026-06-19-*` (vault) with `cass` prior-art assessed. Explicitly sequenced **after** the TypeScript/test foundation hardening lands — promote off "Later" at that point.
- Additional plugin groups (`plugins/<name>/`) as new skill families mature — the DR-001 layout already supports this.
