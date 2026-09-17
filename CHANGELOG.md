# Changelog

## [Unreleased]

### Added

- `next-steps` 1.0.0 standalone skill for contextual, justified recommendations
  that do not execute the proposed work.
- `must-we` 1.0.0 standalone skill for evidence-based necessity verdicts and
  smaller sufficient alternatives; “do we need to” remains a natural-language
  cue rather than an installed alias.
- `session-retro` 1.0.0 as a standalone skill and Session plugin member
  `retro`, with a bundled report template, optional observer integration, and
  read-only privacy boundaries.
- `session` plugin 0.2.0 adds `retro` without requiring the Consensus plugin.
- `complexity-review` 1.0.2 standalone instruction-only skill, promoted from its newer public-safe personal source with its evidence guide: restates the contract and minimum proof, establishes the simplest viable baseline, inventories complexity including process ceremony, applies the deletion test, and reports a keep/simplify/defer/delete ledger with graded evidence and reintroduction triggers.
- `consensus-create` skill for generating a new artifact from a brief with v3 defaults (`independent_draft`, `parallel_synthesized`, `maximum`), optional templates, generated runtime output, bundled brief examples, a deliberation log, and `consensus-resolution` metadata including peer and synthesis call counts.
- `consensus-decide` skill for choosing between documented options with v3 defaults (`independent_draft`, `parallel_synthesized`, `minimal`), required markdown headings including `## Dissent / Unresolved Disagreement`, generated runtime output, bundled options examples, a deliberation log, and `consensus-resolution` metadata.
- `consensus-plan` skill for turning a goal and inline constraints into a structured markdown plan with v3 defaults (`independent_draft`, `parallel_synthesized`, `moderate`), required `## Steps`, `## Dependencies`, and `## Risks` headings, generated runtime output, bundled goal examples, a deliberation log, and `consensus-resolution` metadata.
- `consensus-panel` skill for single-round neutral moderator panels with attributed provider-backed responses, `--panelists`, `--panel-size`, JSONL status events, generated runtime output, bundled question examples, and shortfall diagnostics.
- `phone-a-friend` skill for one-shot advisory peer consultation, with a reusable advisory JSON schema, schema contract test, operator reference, and example prompt/advisory payloads; the host keeps responsibility for context selection, peer choice, and dispositioning the take.
- `consensus config get/list/set/clear` for JSON-first user/project/effective panel and consensus defaults, with documented config paths and precedence integrated across the consensus-family wrappers and panel workflow.
- `session-observer-collab` standalone skill for a bounded N=2 collaboration protocol (one user, two mutually observing agent sessions) with exact peer pins, bounded lifecycle continuation, capability disclosure, versioned XDG lease state, and deterministic closeout; composes the base `session-observer` CLI for transcript discovery, normalization, and offsets.
- `install.sh` supports optional integrity verification: set `CONSENSUS_INSTALL_SHA256` to the expected checksum and the installer fails closed on mismatch before anything lands in the install target (checksum publication added to the release checklist).
- `session` plugin 0.1.0 with plugin-local `handoff`, `export-transcript`, and
  `fork-to-destination` skills, independently versioned from the consensus
  plugin and from its member skills.
- `session-handoff` 1.1.2 as an authored public skill with optional
  `session-observer` and `session-export-transcript` integrations and no
  implicit installation or active user-install replacement.
- Documentation site retheme (dark terminal-serif palette with a derived light mode, site-palette Mermaid, accessible horizontally scrollable diagrams, base-path-safe images) and a Markdown & Visuals catalog with copyable syntax and rendered examples.
- Twelve source-verified diagrams across the User Guide and Engineering pages, three with hand-authored SVG counterparts (source-to-distribution, peers-not-personas, provider process boundary).
- Engineering guides: TypeScript & Build Tooling, Testing, Consensus Runtime, CI & Quality Gates, Releases & Versioning; User Guide reorganized into Getting Started, Plugins (Consensus, Session), and capability-grouped Standalone Skills, with the README as a task-oriented entry point.
- `defaults.peers` model and effort now reach dispatch in Create, Decide, Plan, Refine, and Evaluate (`create`/`decide`/`plan` 0.1.10, `refine` 0.1.13, `evaluate` 0.1.14); peer agents travel to the standalone loop as JSON (`--peer-agents`) so model IDs may contain delimiters, and the configuration page's model/effort limitation is removed.
- Deterministic observer re-arm tests covering SIGTERM, control-stop, max-runtime expiry, filtered-only ranges, startup appends, and competing consumers (`session-observer` 1.0.41); the Claude Code collaboration reference now records live Monitor evidence, the 30-minute cap, the re-arm gap read, and an explicit worktree handback rule (`session-observer-collab` 1.0.30).

### Changed

- Clean-break session names: `export-session-transcript` is now
  `session-export-transcript`, and `coding-session-handoff` is now
  `session-fork-to-destination`. No aliases, redirects, wrappers, or old-name
  payloads are generated.
- Authored skills now live under `src/skills/`; declared standalone and plugin
  installation units are generated under `skills/` and `plugins/`.
- Skill frontmatter now uses quoted stable `metadata.version` as its sole
  authored version. Generated forms share that skill version, while consensus
  and session plugin release versions remain independent.
- `session-fork-to-destination` is described as alpha with explicit limits rather than "experimental, not released" (0.2.5); its CLI status string is unchanged.
- "Collaborative Observer" is the navigation label for `session-observer-collab` site-wide.
- Loop-free helpers extracted to `src/plugins/consensus/shared/cli-helpers-core.ts`; Panel imports the core and drops nine duplicated helpers (`panel` 0.1.7, `phone-a-friend` 0.1.6); the loop-coupled layer re-exports the core.
- Repository validation moved the provider install-matrix gate from the README to the canonical Installation page; the README keeps a standalone quick start and links to the matrix.

### Removed

- The `legacySkillOwners` rename map in `src/distributions.ts`. Skill-version
  validation no longer carries a repository-wide pre-rename attribution table;
  both renames are on `main`, and a caller can still inject `legacyOwners` for
  an explicitly older base. The clean-break guard on the renamed-away output
  paths stays, now as an explicit `obsoleteDistributionOutputs` list.
- The paused, unverified `coding-session-handoff` executor: its CLI, handoff,
  provider, reconcile, and behavior-gate source and tests, the generated
  `tools/coding-session-handoff/coding-session-handoff.mjs`, its build
  declaration, and its README and capability matrix. The shipped
  `session-fork-to-destination` guidance skill is unaffected; its docs page and
  `SKILL.md` are now the only operator-facing entry-point reference
  (`session-fork-to-destination` 0.2.7).
- The `shared/transcript-core/` compatibility README and the
  `pnpm run sync:transcript-core` compatibility script. `pnpm run build` is the
  only generated-output command; the canonical source stays at
  `src/shared/transcript/runtimes.ts` (`session-export-transcript` 2.0.1,
  `session-fork-to-destination` 0.2.6).

### Fixed

- The consensus wrapper subprocess path now supports caller-supplied deadlines with SIGTERM→SIGKILL escalation, guards stdin against failed-spawn writes, and force-settles with stdio teardown when a descendant process holds the pipes open after kill (`refine` 0.1.7, `evaluate` 0.1.8, `panel` 0.1.2; shared-runtime consumers `create`/`decide`/`plan` 0.1.5). No default timeout is wired yet — deadlines apply where a caller passes one.
- The `session-observer` watch loop caches transcript classification and metadata by file signature (path, mtime, size), eliminating full re-reads of unchanged transcripts on every poll tick (`session-observer` 1.0.7, `session-export-transcript` 1.0.4).
- Consensus loop `records.json` and status writes are now atomic (same-directory temp file + fsync + rename), so a crash mid-write can no longer corrupt a resumable deliberation session (`refine` 0.1.6, `evaluate` 0.1.7).
- The provider CLI host-recursion guard now propagates depth and enforces `max_depth` across cross-provider peer chains; alternating-provider spawn chains can no longer bypass the recursion cap.
- `session-observer` state locks now record their owner PID and recover from stale locks left by crashed processes, using a race-hardened rename-based reclaim with post-claim re-verification (a narrow multi-contender window documented in the source remains, funneled through exclusive lock creation); the codex cwd cache is written atomically (`session-observer` 1.0.6).
- `writeSectionOutput` and `seedRecordsFile` in the consensus loop now use the atomic temp+fsync+rename writer, with no-residue and previous-file-survival tests.
- Refine's parallel worker path forwards configured peer model/effort through the standalone loop invoker (previously sent null).

## [0.1.0] - 2026-06-20

### Added

- Initial `consensus` plugin package scaffold.
- `consensus-refine` skill instructions and section-runner contract.
- Multi-provider plugin manifests and repo-root marketplace entries.
- Baseline documentation, structural validation, and CI scaffolding.
- Alternating-mode deliberation loop with hash convergence, impasse handling, section parsing, and publishable deliberation artifacts.
- Sequential wrapper flow plus host-mediated parallel prepare/fan-in orchestration.
- Resume support for canonical artifact state, corrupt-section fail-closed handling, skip flags, and user intervention records.
- Provider CLI setup and verification guidance for local provider availability.
- Mocked smoke test coverage for dependency-free end-to-end validation.
- Node.js 22+ runtime and CI baseline.
- `consensus-evaluate` skill for judging an artifact against a rubric/spec with v3 defaults (`shared_input`, `parallel_revision`, `minimal`), unified findings, embedded per-peer `consensus-verdict` records, and dissent/unresolved-dissent surfacing.
- Generated TypeScript runtime outputs for `consensus-evaluate` and its shared consensus loop copy, with plugin manifests, skill docs, README status, and generated-output drift guards updated.

### Iteration modes

- Two parallel iteration modes selectable with `--iteration`: `parallel_revision` (both peers revise simultaneously each round, converging on emergent agreement; 2x peer calls) and `parallel_synthesized` (parallel revision plus a per-round wrapper-driven synthesis merge; 2x peer calls + 1 synthesis call). `alternating` remains the default and is regression-locked.
- Configurable synthesizer via `--synthesizer` (defaults to the first peer; validated against the provider inventory) so routine merging can run on a cheaper model; synthesizer identity is recorded in every synthesis record and the resolution block.
- Agency-gated escalation ladder: deterministic triggers (persistent disagreement, oscillation, budget exhaustion, near-done drift) emit a structured `escalation_required` event routed by `--agency` to the user or the host. Host decisions re-enter with `--resume --host-direction "<text>"` (and optional `--host-decision-kind`) as attributed orchestrator rounds; genuinely-stuck host escalations promote to the user.
- Unified v1 deliberation record schema across all three modes (mode-aware verdicts, synthesis records, attributed intervention rounds, extended byte caps); v0 artifacts are rejected fail-closed on resume with no migration.
- Cost disclosure: `run_started` carries `iteration_mode` and `calls_per_round`; `run_completed` and the resolution block report `peer_calls` and `synthesis_calls`. Routine events carry no deliberation content — `escalation_required` is the only content-bearing event.
- Resume and host-mediated parallel-section orchestration extended to the new modes and interruption points (mid-pair, pending-synthesis, pending-escalation).

### Release validation

- Local automated verification passed on 2026-06-20: `pnpm run build`, `pnpm run type-check`, `pnpm run build:check`, `pnpm run test` (72 files / 726 tests), `pnpm run validate`, and `pnpm run smoke`.
- Provider CLI local check passed; `consensus provider ls --json` reported `claude`, `codex`, and `cursor` ready.
- Claude Code local marketplace install from the release-candidate checkout passed and exposed both shipped consensus skills (`evaluate`, `refine`) plus the section runner; Codex local install passed from the configured local `skills` marketplace.
- Live provider E2E passed with Cursor as an authenticated peer: direct provider smoke, Refine, and Evaluate all converged with `--peers cursor,codex` (`strategy_used: "prompt_only"`, first-attempt schema success).
- Interactive provider permission/runtime smokes completed on 2026-06-20 against live runtimes: Claude Code and Cursor surfaced and approved a `node` exec prompt before running the wrapper, and Codex ran the wrapper under its sandboxed exec path (no prompt for the read-only command by design, even under `on-request`); all returned `ok: true`. See `RELEASING.md` for the per-provider snapshot.
