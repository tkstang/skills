# Skills Repo Roadmap

**Last updated:** 2026-07-11 (**backlog alignment refresh**: the consensus-research boundary decision and the loop-quality batch are now; whole-document harmonization and the shared session-log substrate are next; direct messaging follows the substrate. The shared generated-runtime closeout remains complete: **BL-260620-share-consensus-generated** verified the plugin layout across Claude Code, Codex, Cursor Agent, Copilot, and standalone recovery, then collapsed duplicated per-skill `consensus-loop.mjs` output to one plugin-local generated runtime.)

## Planning Model

Work is planned as **lanes**, not linear milestones. Sources of truth:

- `.oat/repo/pjm/roadmap.md` — Now / Next / Later priorities and lane framing.
- `.oat/repo/pjm/backlog/items/*.md` — executable backlog records (dependencies encoded per item).
- `.oat/repo/pjm/current-state.md` — shipped snapshot.
- `.oat/repo/reference/decisions/` — durable decisions.
- `.oat/repo/reference/research/` — evidence inputs; nothing there is a commitment until promoted here or into the backlog.

## Lanes

### Consensus plugin

The v3 family architecture (`.oat/repo/reference/research/consensus/architecture-v3.md`) defines 6 skills × 3 iteration modes × 2 cold-start strategies × 3 agency levels over a shared `consensus-loop` primitive. v0.1 shipped Phase 1 **plus** most of Phase 3 (agency, impasse/user-direction flow, oscillation detection) and parts of Phases 4–5 (host-mediated parallel sections, resume). **Phase 2 — iteration modes — is now shipped and merged to `main` (PR #9)** (`parallel_revision`, `parallel_synthesized`, synthesizer selection, agency-gated escalation ladder), verified live with claude+codex. The synthesis-mediation design question resolved as a two-tier model: deterministic wrapper-driven per-round synthesis plus agency-gated host/user escalation for judgment calls (DR-018). The consensus-family project added `independent_draft` and the create/decide/plan wrappers. `phone-a-friend` is now also shipped as a non-converging advisory skill over the provider CLI, and `consensus-panel` + JSON-first `consensus config` defaults shipped 2026-07-03 (PR #40) as the neutral-moderator breadth surface and cross-skill default resolution. `consensus-research` is the only remaining unshipped named family skill. **BL-260701-add-multi-round-panel** is the low-priority post-v1 panel follow-up (optional discussion rounds; decision-first — multi-round must not silently become refine-style convergence).

What remains, in dependency order:

1. **Research boundary** — `consensus-research` begins with its peer tool-access and evidence-capture decision, then builds separately if the decision says go; it uses `shared_input`, not `independent_draft`.
2. **Loop-quality batch** — deliberation metrics, then the similarity heuristic, in one controlled shared-loop worktree.
3. **Harmonization pass** — whole-document coherence after independent section convergence, beginning with the assembled-document context decision.
4. **Multi-agent collaboration substrate** — shared session-log foundation, then addressable direct messaging.

### Release / distribution

- v0.1 release verification (**BL-260612-complete-v0-1-release**) is **done** (2026-06-20): all `RELEASING.md` gates green — automated suite re-run (72 files / 726 tests), CHANGELOG/version/`--check-tag` finalized, README install matrix re-confirmed, and interactive provider permission/runtime smokes passed (Claude Code + Cursor approved a `node` exec prompt; Codex sandboxed-exec does not prompt for read-only commands by design). **v0.1.0 is released:** tag on `main` (`e4e9348`), `release.yml` green, and the GitHub Release is published. Historical post-tag `npx skills add` source discovery covered the then-current release; the canonical in-repository public standalone set is now exactly `session-observer`, `export-session-transcript`, and `session-observer-collab`.
- **BL-260627-verify-skills-sh-hosted** (verify skills.sh hosted discovery surface and listing strategy) is **done** (2026-07-05; DR-260705-skills-sh-listing-is-telemetry): the hosted index is telemetry-only, internal-flag safety is client-side pre-telemetry, and hosted visibility was seeded with owner installs of the two standalone skills. **Re-check 2026-07-07:** the seeded installs propagated — the hosted repo page is live and lists exactly those two seeded skills with no OAT/consensus leakage (the safety property is verified live). `session-observer-collab` is not included in that evidence; CLI/hosted *search* discovery still lags, and full discoverability/installability for all three remains a non-claim pending release verification.
- Public marketplace submission (Claude/Cursor), Codex Plugin Directory, registry/hosted search, and provider-mirror propagation remain release-gated; no public claims for those external surfaces until verified.

### Transcript tooling (session-observer, export-session-transcript, session-observer-collab, transcript-core)

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
- **Public-discovery control (shipped on PR #38, BL-260621; DR-260627)** — the in-repo internal-flag tooling now hides `.agents/skills/**` from `npx skills` discovery (`apply-internal-flags.mjs` + `validate:internal-flags` CI/pre-push gate), the consensus skills recover from a standalone install via the `~/.consensus/` fallback + `install.sh`, and the canonical `skills/` tree exposes exactly three individually-installable public standalone entries: `session-observer`, `export-session-transcript`, and `session-observer-collab` (guarded by release discovery tests). The deferred hosted check, **BL-260627-verify-skills-sh-hosted** (verify skills.sh hosted discovery surface and listing strategy), is now **done** (2026-07-05) for the two seeded skills — telemetry-only indexing confirmed, hosted visibility seeded, strategy + guardrail in DR-260705-skills-sh-listing-is-telemetry. The 2026-07-07 re-check confirmed the hosted repo page lists exactly those two seeded skills (no leakage); `session-observer-collab`, CLI/hosted *search* discovery, marketplace/registry listing, and provider propagation remain unverified and non-claims.
- **Advisory peer (done 2026-06-28)** — **BL-260620-add-phone-a-friend-advisory** shipped `phone-a-friend` as a one-shot structured second opinion over the provider CLI (no deliberation loop), documented in the Fumadocs User Guide and plugin README.
- **Neutral panel + config defaults (done 2026-07-03, PR #40)** — **BL-260626-add-consensus-panel-skill** shipped `consensus-panel` (single-round neutral-moderator panel over 2+ provider-backed panelists, attributed responses, diagnostics/shortfalls in the artifact) and **BL-260626-configure-default-consensus** shipped JSON-first `consensus config get/list/set/clear` with documented precedence (invocation flag > project > user > built-in) consumed by create/decide/plan/refine/evaluate/panel.
- **Plugin packaging maintainability (done 2026-07-07)** — **BL-260620-share-consensus-generated** verified Claude Code, Codex, Cursor Agent, Copilot, and standalone-recovery plugin layout evidence, then collapsed duplicated per-skill `consensus-loop.mjs` output to one plugin-local generated runtime at `plugins/consensus/scripts/consensus-loop.mjs` imported from generated wrappers via `../../../scripts/consensus-loop.mjs`.
- **Consensus-research boundary (now)** — **BL-260612-add-consensus-research-skill** starts with a peer tool-access, permissions, and evidence-provenance DR. The wrapper build follows only if that decision gives a clear contract; it must not overlap a loop-core implementation change.
- **Loop-quality batch (now)** — **BL-260612-add-deliberation-metrics** then **BL-260612-add-similarity-heuristic** run as one sequential worktree. The metrics pass inventories real provider-CLI token/cost signals and retains explicit unavailable semantics; the similarity pass remains deterministic, agency-gated, and audit-disclosed.

## Next

- **Whole-document harmonization** — **BL-260612-add-whole-document**: record the assembled-document context boundary, then decide whether to build the optional sequential post-fan-in pass after the current loop-quality batch.
- **Shared session-log substrate** — **BL-260619-shared-session-log-substrate**: a design-first initiative for multi-session registration, merged observation, lifecycle, and project-scoped agent identity. It is next only with deliberate capacity for its operational surface.

## Later

- **Inter-agent direct messaging** — **BL-260619-inter-agent-direct-messaging** follows the shared session-log substrate; it must reuse the substrate's identity, state, and cursor primitives rather than introducing a second system.
- Cursor submit-tool / custom ACP provider path exploration. Reserved-seam seeds: host-native dispatch protocol (BL-260619-define-host-native-dispatch) and multi-peer 3+ extension (BL-260619-multi-peer-3-deliberation) — go/no-go first, likely defer.
- v3 "for discussion" decision seeds — resolved 2026-07-07 as `wont_do`: no first-class mid-loop `type=edit` intervention, and no LLM section auto-chunking fallback. The loop contract stays artifact-edit-then-resume plus deterministic markers/headings/whole-document fallback.
- **Multi-round panel discussion** — **BL-260701-add-multi-round-panel**: optional panel follow-up rounds where panelists see each other's responses. Product distinction is recorded: any future mode must remain opt-in, attributed, and non-converging, not refine/evaluate-style synthesis. The build stays deferred until real panel usage shows single-round breadth is insufficient.
- Transcript-tooling deferrals (promote individually if needed).
- **Multi-agent collaboration follow-ons** — work-claiming and a message bus stay as vault stubs until the shared session-log substrate and direct messaging demonstrate their real limits. Source: `02 - Projects/Skills/Ideas/2026-06-19-*` (vault) with `cass` prior-art assessed.
- **Session-observer collaboration v2 deferrals** — the shipped skill remains N=2. Per-observer offset namespaces and safe N>2 mesh (**BL-260713-per-observer-offsets-and-safe**), stronger Cursor wake surfaces (**BL-260713-stronger-cursor-collaboration**), Cursor transcript-store/dotted-slug coverage (**BL-260713-cursor-transcript-store**), and optional idle-session application integrations (**BL-260713-optional-idle-session**) are separate low-priority follow-ups. They must preserve the dependency-free core and honest validated-versus-unvalidated wake tiers; they do not supersede the shared-session-log or direct-messaging initiatives.
- Additional plugin groups (`plugins/<name>/`) as new skill families mature — the DR-001 layout already supports this.
