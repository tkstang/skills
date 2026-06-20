# Skills Repo Decision Record

> Lightweight decision log for architecture and implementation decisions made in this repository. Each entry captures the decision, context, and rationale. Seeded retroactively on 2026-06-12 from the archived OAT project artifacts (machine-local under `.oat/projects/archived/`); new decisions append going forward.

## Format

```
### DR-NNN: Title (YYYY-MM-DD)
**Context:** Why did this come up?
**Decision:** What was decided?
**Rationale:** Why this choice over alternatives?
**Status:** Accepted | Superseded by DR-NNN
```

---

## Decisions

### DR-001: Skills-first repo with self-contained sub-plugins; OAT scaffolding invisible to plugin consumers (2026-05-01)

**Context:** The repo needed to ship the consensus plugin publicly while remaining the long-term home for all personal skills, and it is OAT-initialized (`.oat/`, `.agents/`) for private project management.
**Decision:** Plugins are self-contained packages under `plugins/<name>/` carrying their own provider manifests (`.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`); repo-root marketplace files declare them via `source.path`. Top-level `skills/` is reserved for standalone skills not part of any published plugin. Plugin manifests, skills, and published scripts never reference `.oat/` or `.agents/` paths; validation enforces the boundary.
**Rationale:** The sub-plugin pattern lets the repo grow additional plugin groups (e.g. `plugins/research/`) without restructuring, keeps each plugin independently installable, and lets internal process tooling evolve without affecting published deliverables. Consumers install plugins without OAT.
**Status:** Accepted.

### DR-002: Paseo invoked by shell-out, never embedded (2026-05-01)

**Context:** The consensus plugin needs peer-CLI orchestration (provider abstraction, structured-output validation with retry, subprocess lifecycle). Paseo provides all of it but is AGPL-3.0-or-later; the plugin is MIT.
**Decision:** Shell out to the `paseo` binary as an external prerequisite (like `git` or `node`). Never vendor or embed Paseo source. Users install Paseo themselves; `scripts/install-paseo.mjs` offers opt-in, confirm-first install assist. Preflight validates availability via `paseo provider ls --json` and warns outside the tested version range (0.1.0–0.9.0 at v0.1).
**Rationale:** Shelling out keeps the license boundary clean (no copyleft contamination), delegates the hard orchestration problems to a maintained tool, and keeps the plugin dependency-free Node stdlib. Subprocess overhead (~100–200 ms/turn) is negligible against LLM latency. Risk of Paseo CLI drift is mitigated by version-range checks.
**Status:** Superseded by DR-023.

### DR-003: Sequential sections by default; parallel orchestration is host-mediated, fail-closed (2026-05-02)

**Context:** Multi-section documents benefit from parallel per-section deliberation. The v2 brainstorm assumed the wrapper would spawn its own sub-agents via `paseo run --detach`; the design had to choose who owns parallel dispatch.
**Decision:** Sequential section processing is the default. Parallel mode is opt-in and host-mediated: the wrapper prepares section packets and a manifest (`--prepare-parallel`), emits JSONL dispatch instructions, the host runtime dispatches section-runner subagents using its native mechanism, and the wrapper assembles results in original order via `--fan-in <manifest>`. The wrapper never owns host subagent processes. On Codex, subagent authorization is fail-closed: denial fails the parallel run rather than silently degrading to sequential.
**Rationale:** Host-native dispatch (Claude Task tool, Cursor native, Codex spawn_agent) is more robust than wrapper-owned detached processes and matches per-host capability tiers. Fail-closed authorization preserves auditability — no surprise behavior change mid-run. Parallel reduces wall-clock only, not token cost, so sequential remains the stable default.
**Status:** Accepted.

### DR-004: Normalized-hash convergence with ACCEPT-twice-same-hash guard; versioned verdicts with post-receive byte caps (2026-05-02)

**Context:** Convergence detection must tolerate whitespace/line-ending variation without false positives, and peer-emitted JSON verdicts must be forward-compatible and bounded.
**Decision:** Convergence requires normalized hash equality (strip trailing whitespace per line, normalize line endings to `\n`, collapse trailing newlines); ACCEPT-twice convergence additionally requires both ACCEPTs to be against the same normalized hash, not different states. Verdicts carry explicit `schema_version: "v0"`. After Paseo's structural validation, the wrapper enforces UTF-8 byte caps (reasoning ≤ 16 KB, proposed_artifact ≤ 256 KB, concerns ≤ 4 KB × 20, total ≤ 512 KB); oversized verdicts are recorded as metadata-only `OVERSIZE_REJECTED` and the section aborts as error.
**Rationale:** Normalization prevents whitespace-variant artifacts from blocking convergence; the same-hash guard prevents two agents "agreeing" on different versions. Explicit schema versioning lets resume detect incompatibility and fail closed. Byte caps defend against runaway or malicious peer output while preserving an auditable rejection record.
**Status:** Accepted.

### DR-005: Deliberation artifact is the canonical resume state; corruption fails closed (2026-05-05)

**Context:** Resume must recover from interruption, corruption, or new user direction mid-run. Loose run files (records, status JSON) and the assembled artifact both held state.
**Decision:** The deliberation artifact is the single canonical resume source. Resume parses artifact frontmatter and per-section HTML-commented canonical JSON blocks, recomputes hashes, and fails closed on mismatch: corrupt sections require explicit `--skip-corrupt-section <id>` (or `--skip-all-corrupt` / `--yes-skip-corrupt` with user approval). User direction on resume is recorded as a first-class `USER_INTERVENTION` round. Completed sections are never reconstructed from the current input file.
**Rationale:** The artifact is durable, human-readable, and already the accountability surface; making it canonical keeps resume single-file and makes tampering/corruption detectable. Silent recovery or silent restarts would falsify the audit trail.
**Status:** Accepted.

### DR-006: Editorial agency is a deterministic user-facing flag, shipped at v0.1 (2026-05-03)

**Context:** The v3 architecture planned agency (minimal/moderate/maximum) for a later phase, but convergence strictness and impasse handling needed the parameter anyway.
**Decision:** Expose `--agency minimal|moderate|maximum` at v0.1. Agency deterministically modulates (a) hash convergence strictness (minimal = bytewise; moderate = normalized; maximum = normalized + near-match acceptance on consecutive ACCEPTs) and (b) impasse handling at max-rounds/oscillation (minimal = always surface; moderate = surface meaningful disagreements; maximum = orchestrator may declare best-effort done, logging the decision). The setting is written to artifact frontmatter and preserved across resume.
**Rationale:** Deterministic-once-set beats heuristics for auditability; recording agency in the artifact makes runs reproducible and resumable under the original posture. Future iteration modes add more agency decision points to the same table.
**Status:** Accepted.

### DR-007: session-observer is standalone — peer-transcript adapters ported, not depended on (2026-05-14)

**Context:** Stoa already had transcript adapters and a proven lock/atomic-rename state pattern. session-observer needed the same per-runtime knowledge.
**Decision:** No runtime dependency on Stoa. Per-runtime transcript logic (Claude Code encoded-cwd dirs, Codex session-meta extraction, later Cursor agent transcripts) was ported into the skill's own `runtimes.mjs`; the state layer reuses the lock + temp + rename pattern by reimplementation. Transcript reads are strictly read-only; state writes confined to `~/.local/state/session-observer/`.
**Rationale:** The skill must work on machines that never installed Stoa. The adapters are small enough that porting beats coupling; drift is handled by owning the copies (later restructured by DR-014).
**Status:** Accepted.

### DR-008: Deterministic tier-based session ranking with explicit no-match widening (2026-05-14)

**Context:** Multiple candidate transcripts can match a project directory; selection must be predictable, not heuristic.
**Decision:** Rank candidates in lexicographic tiers: Tier A exact-cwd match (after realpath normalization), Tier B bidirectional ancestor/descendant path match, Tier C no match — which returns `noMatch` with widening options (sister worktrees, explicit cwd, global-most-recent) instead of silently falling through. Within a tier, newest mtime wins; near-ties (5 s window) surface as user choices; `--session <runtime:id>` pins past ranking entirely.
**Rationale:** Tiers are testable and explainable; weighted scores hide magic constants. Explicit no-match prevents silently digesting an unrelated session — the worst failure mode for a peer-review tool.
**Status:** Accepted.

### DR-009: Read offsets in XDG state, keyed by runtime:sessionId, with locked atomic persistence (2026-05-14)

**Context:** `catch-up` needs a durable high-water mark per observed session that survives crashes and concurrent writers.
**Decision:** State lives at `~/.local/state/session-observer/state.json`, keyed `${runtime}:${sessionId}` (not by cwd). All mutation happens under an exclusive-create lock with temp+rename atomic writes; corrupt files are backed up to unique timestamped names before reset; transcript shrinkage resets the offset with a warning.
**Rationale:** Session identity is stabler than cwd (sessions survive directory moves; re-ranking is cheap). XDG state semantics make it durable-but-not-precious. The lock scope covers reads too, because corruption backups write during load.
**Status:** Accepted.

### DR-010: Digests are natural-language-only by default; tool activity is opt-in (2026-05-14)

**Context:** Raw transcripts are dominated by tool calls/results that drown the conversational signal a reviewing peer needs.
**Decision:** Default digests exclude tool calls and results. `--include-tools` adds compact `[Name] args` markers (calls only, truncated); `--debug` adds results too. Every digest header states what was filtered.
**Rationale:** The digest's consumer is an agent (or human) reviewing what a peer *said and decided*, not a replay log. Always-visible filter lines prevent silent-omission surprises.
**Status:** Accepted.

### DR-011: Watch mode design-locked but deferred from session-observer v1 (2026-05-15)

**Context:** Continuous "watch and weigh in" was the eventual goal, but unproven ergonomics shouldn't block the high-value one-shot modes.
**Decision:** Ship `review`/`catch-up`/`locate`/`state` first; freeze the watcher design (poll-not-fs.watch, debounce, `watch-ctl` control surface, singleton enforcement, metadata-only event log) in `references/watch-design.md` so implementation could start later without re-litigating shape.
**Rationale:** Most value was in the simple modes; the locked design made the v2 build cheap and shape-stable.
**Status:** Superseded by DR-012 (watch shipped 2026-06-04).

### DR-012: Watch is a foreground polling watcher with a shared observe pipeline, not a daemon or provider hooks (2026-06-03)

**Context:** Implementing watch mode required choosing among foreground polling (streams into the active agent invocation), a detached daemon (cannot trigger future agent turns), and provider hooks (uneven host support).
**Decision:** Foreground stat-based polling with debounce coalescing, emitting catch-up digests to stdout for the active agent to respond to. One-shot `catch-up` and the watch loop share an extracted `observe.mjs` pipeline (selection → digest → offset update). Control via `watch-ctl status|pause|resume|flush|stop`; lock-protected watcher state with stale-PID cleanup; multi-watcher safety with duplicate-target rejection (hardened in PR #7, 2026-06-11).
**Rationale:** Foreground delivers the actual need — automatic responses during an active session — without over-promising post-session automation. Polling is OS-agnostic and deterministic for injected-time tests. The shared pipeline prevents one-shot and watch behavior from diverging.
**Status:** Accepted.

### DR-013: Watch event logs are metadata-only and path-hardened to the state directory (2026-06-03)

**Context:** `--event-log` writes operational telemetry to a user-supplied path; transcript text is sensitive and paths are attacker-influenced.
**Decision:** Event logs record metadata only (timestamps, counts, runtime markers) — never message content, which goes to stdout only. Event-log paths resolve inside `~/.local/state/session-observer/`; absolute paths, traversal escapes, symlink escapes (realpath-checked), and reserved internal filenames are rejected.
**Rationale:** Separating agent-consumable output from telemetry means logs can be archived or shipped without leaking transcript content; path hardening protects the watcher's own state files from being overwritten via a crafted flag.
**Status:** Accepted.

### DR-014: Shared transcript knowledge lives in `shared/transcript-core/` with build-time sync and a drift guard; share the minimum (2026-06-04)

**Context:** `export-session-transcript` needed the same per-provider store/parsing knowledge as session-observer. Options: vendor per-skill copies (drift), runtime cross-skill dependency (coupling, install-order), or canonical module + sync.
**Decision:** `shared/transcript-core/runtimes.mjs` is the single source of truth. `npm run sync:transcript-core` materializes banner-stamped (`// GENERATED`) committed copies into each consuming skill's `scripts/lib/`; a `--check` drift-guard test in `npm test` fails if any copy diverges. Only `runtimes.mjs` is shared — observe-specific modules (locate/rank/digest/state) stay in session-observer. Installed skills remain fully self-contained.
**Rationale:** Format knowledge is the drift-prone part and changes per provider release; one edit point plus a CI guard beats N hand-synced copies. Sharing more would entangle session-observer's ranking/offset logic in a contract export doesn't need.
**Status:** Superseded in implementation by DR-020/DR-021 on 2026-06-17. The durable decision is still "share only per-provider transcript knowledge and ship self-contained generated copies"; the canonical source moved to `src/transcript/core/runtimes.ts`, and `sync:transcript-core` is now a compatibility wrapper around `scripts/build-generated.mjs`.

### DR-015: Export identifies the live session by an announced content marker, with newest-for-cwd fallback (2026-06-04)

**Context:** Unlike session-observer (peer model), the export script runs *inside* the conversation it exports and must pick the current transcript unambiguously even with concurrent sessions.
**Decision:** The skill instructs the agent to generate and announce a random hex marker, then invoke the CLI with `--match <marker>`; the CLI greps candidates for it. Selection-mode precedence is `--all` > `--session` > `--match` > default newest-for-cwd; the fallback covers transcript flush lag with a warning.
**Rationale:** The announced marker lands in the transcript by definition, making self-identification exact. Documented precedence keeps multi-flag behavior predictable and testable.
**Status:** Accepted.

### DR-016: Export sanitization is two layers — structural filtering plus evidence-driven content detectors, drop-on-match (2026-06-05)

**Context:** Structural filtering (dropping tool calls/results) is insufficient on Codex/Cursor, where injected context (`<system-reminder>`, environment context, skill bodies) arrives as plain user/assistant text.
**Decision:** Layer 1: shared `normalizeEntries` drops structural records. Layer 2: export-owned `sanitize.mjs` drops entire entries matching hidden-payload detectors (system-reminder, task-notification, local-command wrappers, environment context, skill/AGENTS.md content, subagent notifications, etc.), with the detector table derived by grepping real provider stores. On match, drop the whole entry — prefer false positives over leaks.
**Rationale:** The privacy boundary is export-specific policy, so it lives in the export skill, not the shared core. Evidence-driven detectors validated against 41k+ real entries (0 survivors) beat speculative patterns.
**Status:** Accepted.

### DR-017: OAT tool packs install at user scope; the repo keeps only the workflow pack and project-local stubs (2026-06-12)

**Context:** Repo-committed `.agents/` skill packs (analyze, research, docs, utility, brainstorm, etc.) duplicated user-level installs and bloated the repo (~15k lines removed).
**Decision:** General-purpose OAT packs live at `~/.agents/skills/` (user scope). The repo keeps the project-lifecycle workflow pack, the project-management (`oat-pjm-*`) backlog structure under `.oat/repo/reference/backlog/`, and minimal repo-local agent stubs.
**Rationale:** User-scoped packs update once per machine instead of per-repo, and the repo's committed surface stays focused on what it ships.
**Status:** Accepted.

### DR-018: Synthesis mediation is two-tier — deterministic per-round merge plus agency-gated host/user escalation (2026-06-13)

**Context:** v3 assumed a model orchestrator could synthesize two parallel revisions each round. v0.1's orchestrator is a deterministic script, so `parallel_synthesized` needed a way to merge revisions without an in-loop reasoning model. The design gate (bl-7af0) weighed host-mediated synthesis turns vs. a third peer call vs. wrapper-only merging.
**Decision:** Split synthesis by the kind of judgment it requires. **Tier 1 (mechanical):** the wrapper drives a per-round synthesis peer call (the configured `--synthesizer`, defaulting to the first peer) that merges both revisions into the next round's shared input — deterministic, no host reasoning. **Tier 2 (judgment):** when a section is genuinely stuck (persistent disagreement, oscillation, budget exhaustion, near-done drift), the wrapper emits a structured `escalation_required` event routed by `--agency` to the host (re-entry via `--host-direction`, recorded as a `HOST_DECISION` round) or the user (`--user-direction`). A re-fired trigger after a prior host decision promotes to the user (genuinely-stuck).
**Rationale:** Most per-round merging is mechanical and belongs in the deterministic loop; only real disagreement resolution needs a model's broader-context judgment, and that judgment should respect the agency setting and stay auditable. Note: the Claude Agent SDK bills as metered API (not subscription), which informed keeping Tier 1 a single synthesizer call rather than multiplying host turns.
**Status:** Accepted (implemented and merged to `main` via PR #9).

### DR-019: Unified v1 verdict schema with no v0 migration; deterministic-only escalation triggers (2026-06-13)

**Context:** Parallel modes introduced new verdict vocabulary (`ACCEPT_PEER`, `CONVERGED`, critique fields) and a synthesis payload. Two questions: how to version records across modes, and whether escalation triggers should include a fuzzy "near-match" similarity heuristic.
**Decision:** Adopt a single **v1** verdict family across all modes (per-record `schema_version: "v1"` plus an artifact-level `consensus_schema_version: "v1"`), and **reject v0 artifacts on resume with no migration path** — the wrapper only resumes artifacts it currently emits. Escalation triggers are **deterministic only** (persistent disagreement, oscillation, budget exhaustion, near-done drift); a convergence similarity heuristic is deferred as a nice-to-have (bl-ef38). HOST_DECISION routing metadata (`decision_kind`, `escalation_trigger`) is persisted in the canonical artifact block so genuinely-stuck promotion survives a resume.
**Rationale:** A unified schema keeps the loop and validators simple and avoids per-mode branching at the record layer; no-migration is acceptable for a pre-release plugin with no external artifact corpus. Deterministic triggers are predictable and testable; similarity scoring adds model/heuristic surface area without a proven need yet.
**Status:** Accepted (implemented and merged to `main` via PR #9).

### DR-020: Canonical TypeScript sources build committed generated runtime outputs (2026-06-15)

**Context:** The repo is adding TypeScript and Vitest for developer feedback while shipped skills/plugins must remain dependency-free and runnable from committed `.mjs` paths.
**Decision:** Canonical TypeScript source lives under the repo-level `src/` tree (for example, `src/consensus/core/` and `src/transcript/`), while provider-facing runtime entry points remain committed generated `.mjs` files under the existing `plugins/*/skills/*/scripts/` and `skills/*/scripts/` distribution paths. Generated outputs carry a `// GENERATED` banner, are never hand-edited, and are checked by `node scripts/build-generated.mjs --check` through `tests/generated-output-sync.test.mjs`.
**Rationale:** Keeping committed `.mjs` output preserves existing manifests, docs, tests, install copies, and user execution paths with no install step. Keeping canonical TypeScript out of `plugins/` makes the plugin tree the distribution surface rather than the developer source tree. TypeScript, Vitest, and bundling stay dev-only, while the drift guard prevents source/output divergence.
**Status:** Accepted.

### DR-021: Build-time import rewrites reconcile canonical source paths with shipped runtime paths (2026-06-16)

**Context:** Canonical TypeScript entrypoints need to type-check against source modules under `src/`, but shipped runtimes must continue importing local committed `.mjs` files from distribution paths.
**Decision:** Extend DR-020's generated-output build with optional per-mapping `importRewrites`. `src/consensus/refine/consensus-refine.ts` imports the loop through the NodeNext-resolvable canonical specifier `'../core/consensus-loop.js'`; `scripts/build-generated.mjs` rewrites that emitted module specifier to `'./consensus-loop.mjs'` when producing `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`. `src/transcript/export-session/export-session-transcript.ts` imports transcript runtime and sanitizer source through `'../core/runtimes.js'` and `'./sanitize.js'`; the build rewrites those emitted specifiers to `./lib/runtimes.mjs` and `./lib/sanitize.mjs` for the shipped export CLI. Rewrites are constrained to parsed module specifier string literals (static imports, export-from declarations, and dynamic imports), so unrelated quoted strings are left untouched. A declared rewrite fails loudly if the `from` specifier is absent from module specifiers.
**Rationale:** This keeps TypeScript checking wired to real canonical source APIs while preserving the existing dependency-free shipped runtime layout. The transform is intentionally narrow, explicit in build config, compatible with esbuild `bundle:false`, and covered by drift, generated-import, and non-import-literal regression tests so a path regression cannot silently ship.
**Status:** Accepted.

### DR-022: Shipped skills carry a validator-backed top-level `version`, kept in sync with `metadata.version` (2026-06-19)

**Context:** Skill frontmatter previously stored the version only inside the nested `metadata.version` block. The `create-agnostic-skill` template and provider/host tooling expect a top-level `version`, but adding one risked dual-source drift and the repo validator only recognized `metadata.version`.
**Decision:** Promote `version` to a top-level frontmatter field on shipped skills while retaining `metadata.version` during the compatibility transition. `scripts/validate.mjs` resolves the effective version from the top-level field when present, else `metadata.version`, validates semver, and — when both are present — requires them to match (fail-closed). Release tooling (`scripts/bump-version.mjs`, `SKILL_FILES`) updates both fields for every listed skill, and contributors bump a skill's `version` when they ship a behavior/content change (recorded in `AGENTS.md` Repository Conventions). Chosen over (a) a cosmetic top-level field the validator ignores — dual source of truth — and (b) skipping promotion — leaves skills off the template/provider convention.
**Rationale:** Makes the top-level `version` real and machine-enforced without a flag-day removal of `metadata.version`, so other providers that still read the nested field keep working. The match requirement prevents the two fields from drifting, and routing the bump through `bump-version.mjs` keeps every skill's fields aligned mechanically. First applied to consensus `refine` + `evaluate` (consensus-rubric-guidance).
**Status:** Accepted.

### DR-023: Consensus peer invocation owned by provider CLI (2026-06-19)

**Context:** The consensus plugin only needs a narrow per-turn peer-run boundary: provider inventory, readiness checks, prompt delivery, structured verdict extraction, retry/cap/timeout behavior, and provider-neutral diagnostics. The prior external peer-run dependency added install drift and made the live Refine/Evaluate surface harder to reason about. The `consensus-peer-invocation` discovery, synthesized research, design, implementation, and final review confirmed that this repository can own the narrower Claude/Codex/Cursor path while keeping shipped plugin code dependency-free.
**Decision:** Consensus now ships a generated `consensus` provider CLI at `plugins/consensus/scripts/consensus.mjs`, backed by canonical TypeScript under `src/consensus/provider-cli/`. The CLI owns `provider ls`, `preflight`, and `run`; provider-neutral envelopes and errors; structured-output strategy selection; runtime policy validation; host recursion guard; bounded probes and subprocesses; schema delivery; redacted diagnostics; and provider-tier retry/cap/timeout behavior. Claude receives inline JSON schema, Codex uses output-schema plus last-message extraction, and Cursor remains prompt-only with local validation/retry. Refine and Evaluate default to this CLI for new runs. Historical `.oat` artifacts remain untouched, and maintained source/runtime/docs/tests do not keep old compatibility aliases.
**Rationale:** Owning the peer-invocation boundary removes a runtime prerequisite, aligns the implementation with the Stoa/provider-adapter evidence gathered during research, keeps the published plugin on Node standard library plus generated runtime outputs, and gives the consensus loop direct control over its failure taxonomy, security posture, and retry ownership. Cursor submit-tool support remains deferred as future hardening, and authenticated Cursor-as-peer verification remains open until local keychain/auth state allows a live run.
**Status:** Accepted.
