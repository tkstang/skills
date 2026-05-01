---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-05-01
oat_generated: false
oat_template: false
---

# Specification: consensus-plugin

## Phase Guardrails (Specification)

Specification is for requirements and acceptance criteria, not design/implementation details.

- Avoid concrete deliverables (specific scripts, file paths, function names).
- Keep the "High-Level Design" section to architecture shape and component boundaries only.
- If a design detail comes up, record it under **Open Questions** for `oat-project-design`.

## Problem Statement

The user routinely refines drafts (emails, design docs, architecture documents, plans) by manually shuttling them between Claude Code and Codex CLI. Each round costs friction: paste output from one agent, ask the other for feedback, paste back, iterate. The shuttling kills velocity, and whichever session you start in becomes the de facto authority over the artifact — an asymmetry that contradicts the intent of soliciting two independent perspectives.

The user has already designed the solution: a family of consensus-deliberation skills, sharing a `consensus-loop` primitive, that drive Claude Code and Codex (and other Agent Skills clients) as **symmetric peers** through structured turns until the artifact converges. Hash-based convergence + structured ACCEPT/REVISE/IMPASSE verdicts replace soft "iterate until done" instructions. The deliberation log is a first-class artifact alongside the converged output.

This project sets up the user's long-term **personal skills repository** (this repo, `~/Code/skills`, public on GitHub as `<username>/skills`) and ships v0.1 of the consensus skill family — packaged as a portable `consensus` plugin distributable on Claude Code, Cursor, and Codex. v0.1 scope is intentionally small (one skill, one iteration mode, sequential only) per the v3 implementation plan's "smallest valuable shippable scope": core primitive + `consensus-refine` with alternating mode.

The repo doubles as a **growth platform** for additional personal skills and plugin groups; the sub-plugin pattern under `plugins/<name>/` keeps that path open without forcing future restructure.

## Goals

### Primary Goals

- Establish `<username>/skills` as a public, multi-provider personal skills repository following the canonical "skills-first repo" pattern (per the user's plugin synthesis research).
- Ship v0.1 of the `consensus` plugin containing a working `consensus-refine` skill that drives Claude Code and Codex as symmetric peers through alternating-mode deliberation on a markdown artifact, terminating on hash-based convergence.
- Provide cross-provider install paths: Claude Code marketplace, Cursor marketplace, Codex Git/local install — all working at v0.1.
- Produce a publishable deliberation artifact (final output + full audit trail) for every refine run.

### Secondary Goals

- Make the repo structure ready to host additional plugin groups (`plugins/research/`, `plugins/oat/`, etc.) without restructure.
- Preserve OAT scaffolding for the user's own project-management workflow without leaking it into the published plugin.
- Be `npx skills add <username>/skills` compatible (Agent Skills baseline satisfied).

## Non-Goals

- Skills 2–6 in the consensus family (`consensus-create`, `-evaluate`, `-decide`, `-plan`, `-research`) at v0.1.
- Parallel-revision and parallel-synthesized iteration modes at v0.1 (alternating only).
- Parallel section orchestration via `paseo run --detach` (sequential per-section only).
- User-facing editorial-agency flag (hard-coded to moderate per v3's `consensus-refine` default).
- Codex public marketplace submission (Git/local install path until OpenAI's flow matures).
- Public skills.sh listing claims at launch.
- Lifting the consensus skills into OAT as published OAT skills.
- Re-deriving the consensus skill family architecture (settled at v3).

## Requirements

### Functional Requirements

**FR1: Repository scaffolded for multi-provider plugin distribution**

- **Description:** The repo has a canonical `skills/` directory containing skill bodies, a `plugins/consensus/` sub-plugin directory holding Claude/Cursor/Codex manifests selecting the consensus skills, and Agent Skills-baseline frontmatter on every shipped skill.
- **Acceptance Criteria:**
  - Top-level `skills/` directory exists with one folder per shipped skill.
  - `plugins/consensus/.claude-plugin/plugin.json`, `plugins/consensus/.cursor-plugin/plugin.json`, `plugins/consensus/.codex-plugin/plugin.json` exist and parse as valid JSON.
  - Each shipped skill includes `name`, `description`, `license`, and `compatibility` frontmatter.
  - Skill folder names match `name` frontmatter values.
- **Priority:** P0

**FR2: `consensus-refine` skill performs alternating-mode deliberation**

- **Description:** Invoking the skill on a markdown artifact runs alternating turns between two configured agents (Claude Code + Codex by default), each emitting a structured ACCEPT/REVISE/IMPASSE verdict per turn, with the artifact updated after each REVISE.
- **Acceptance Criteria:**
  - Skill accepts a markdown file path and an optional `--goal` text.
  - Each agent turn emits valid JSON conforming to the alternating-mode verdict schema.
  - Artifact state is updated after each REVISE; ACCEPT preserves prior state.
  - Default agent pair is Claude Code + Codex; configurable via `--providers`.
- **Priority:** P0

**FR3: Hash-based convergence detection terminates the loop**

- **Description:** The loop terminates on the first of: two consecutive turns producing the same artifact hash, two consecutive ACCEPT verdicts on the same artifact, an explicit IMPASSE from either agent, or a per-section round budget exceeded.
- **Acceptance Criteria:**
  - Termination on hash-match between consecutive turns (different agents).
  - Termination on two consecutive ACCEPTs against the same artifact.
  - Termination + escalation on explicit IMPASSE.
  - Termination + escalation on round budget exceeded (default 10–15 rounds per section).
  - Oscillation detection: hash alternation between two states across 4+ rounds escalates as impasse.
- **Priority:** P0

**FR4: Section detection and sequential per-section deliberation**

- **Description:** The skill parses the input markdown into sections (default: by markdown headings) and runs an independent consensus loop per section, sequentially.
- **Acceptance Criteria:**
  - Default section detection by markdown headings.
  - Explicit `<!-- section: name -->` markers override heading-based detection.
  - Single-section docs (no headings) work as a single loop.
  - Section impasse marks that section but does not block subsequent sections.
- **Priority:** P0

**FR5: Deliberation artifact captures final output + full audit trail**

- **Description:** The skill writes a markdown artifact containing the converged document at the top (grabbable), a Resolution block (status, mode, models, rounds, cost), the original Goal, and a per-section Deliberation Log with every round's reasoning and verdict.
- **Acceptance Criteria:**
  - Top-of-file Final Output section contains the converged document.
  - Resolution block includes: status, iteration mode, cold-start, agency, sections converged/impasse, total rounds, models, wall-clock, approximate cost.
  - Per-section log shows each round's agent, verdict, reasoning, and (for REVISE) proposed artifact.
  - User interventions (when budget exhausted) appear as `<user round=N>` entries.
- **Priority:** P0

**FR6: Impasse handling escalates to user with synthesized divergence summary**

- **Description:** When a section reaches impasse (explicit IMPASSE, max rounds, or oscillation), the skill surfaces the divergent state to the user with options to pick a revision, blend, give new direction, raise/lower the bar, raise budget, or accept impasse.
- **Acceptance Criteria:**
  - Skill pauses execution at impasse and presents divergent options.
  - User responses are recorded as `<user round=N>` entries in the artifact.
  - Resuming continues from artifact state (artifact-as-state authoritative).
  - In sequential mode, impasses on one section do not block others (recorded; presented at end).
- **Priority:** P0

**FR7: Plugin installable via documented path on all three providers**

- **Description:** A new user can install the `consensus` plugin on Claude Code, Cursor, and Codex via the documented install command in the README, and successfully run `consensus-refine` on a sample artifact.
- **Acceptance Criteria:**
  - README install matrix has copy-paste install commands for Claude Code, Cursor, Codex (Git/local), and `npx skills add` users.
  - Fresh install on each provider works end-to-end without hand-fixing.
  - Paseo prerequisite is documented prominently with install instructions.
- **Priority:** P0

**FR8: CI validation enforces repo invariants on every change**

- **Description:** A GitHub Actions workflow validates skill frontmatter, JSON manifest parsing, folder/name alignment, and referenced-path existence on every PR and main-branch push.
- **Acceptance Criteria:**
  - Each `skills/*/SKILL.md` validates against the Agent Skills baseline.
  - All provider manifests parse as valid JSON.
  - Skill folder names match frontmatter `name` values.
  - Paths referenced from skills (scripts, references) resolve under repo root.
  - Workflow runs on push to main and on PRs.
- **Priority:** P1

### Non-Functional Requirements

**NFR1: Audit trail is publishable**

- **Description:** A deliberation artifact produced by `consensus-refine` is readable enough that the user would share it externally as an example of how Claude and Codex argued about a draft.
- **Acceptance Criteria:**
  - Artifact reads as a coherent narrative when scrolled top-to-bottom (final output → resolution → goal → log).
  - Each round entry is self-contained: agent, verdict, reasoning, proposed artifact (if REVISE).
  - No JSON dumps or raw stack traces leak into the user-visible artifact.
- **Priority:** P0

**NFR2: Convergence within a reasonable wall-clock and cost budget**

- **Description:** A typical refine run on a one-pager (3–5 sections) completes in under 5 minutes wall-clock and under $1 in API cost using default settings.
- **Acceptance Criteria:**
  - Typical run wall-clock < 5 min on a one-pager (measured during dogfooding).
  - Typical run API cost < $1 on a one-pager.
  - No metrics-gating in v0.1; tracked but not blocking.
- **Priority:** P1

**NFR3: Cross-provider portability — skills layer is the only canonical thing**

- **Description:** Skills are written against the Agent Skills baseline; provider-specific behavior lives in provider manifests, never inside canonical `SKILL.md` files. This protects the multi-provider thesis from drift.
- **Acceptance Criteria:**
  - Canonical `SKILL.md` files contain only Agent Skills baseline frontmatter (`name`, `description`, `license`, `compatibility`, `metadata`).
  - Provider-specific fields (`disable-model-invocation`, `allowed-tools`) appear only in provider-specific manifests or generated provider-views, not in canonical skill bodies.
  - A documented contribution rule prevents future drift.
- **Priority:** P0

**NFR4: OAT scaffolding does not leak into the published plugin**

- **Description:** OAT files (`.oat/`, `.agents/`, the `AGENTS.md` OAT block) are project-management infrastructure for the user; the published plugin and skills do not depend on them.
- **Acceptance Criteria:**
  - Plugin manifests do not reference `.oat/` or `.agents/` paths.
  - Skills under `skills/` do not depend on OAT-installed skills (`.agents/skills/oat-*/`).
  - A user installing the consensus plugin does not need OAT installed.
- **Priority:** P0

**NFR5: Honest README about scope**

- **Description:** The repo's README accurately represents v0.1 scope (Phase 1 only: refine, alternating, sequential), the deferred path (Phases 2–4), and provider asymmetry (Claude/Cursor public; Codex Git/local).
- **Acceptance Criteria:**
  - README has a "Status: v0.1 / Phase 1" badge or section.
  - README clearly notes Codex install differs (Git/local) from Claude/Cursor (marketplace).
  - Deferred features (skills 2–6, parallel modes, agency flag) are listed as "future" — not promised, not hidden.
- **Priority:** P1

**NFR6: Provider-runtime subagent permission handling follows OAT best practice**

- **Description:** The skill correctly handles cross-provider differences in how host runtimes treat subprocess execution and (in future phases) host-runtime subagent dispatch. Follows the battle-tested OAT pattern documented in `oat-project-implement` Step 0.5: tier detection at start, fail-closed authorization for Codex when explicit approval is required, tier locked for the run.
- **Acceptance Criteria:**
  - At v0.1, the skill documents required host-runtime permissions (Bash/exec to invoke `paseo`) per provider in its `SKILL.md` and the per-provider plugin manifests.
  - At v0.1, the skill verifies `paseo` availability before starting deliberation and fails clearly if missing or unauthorized.
  - The skill does not silently degrade behavior across providers; cross-provider differences are surfaced in user-facing messages.
  - Phase 4 (parallel section orchestration) inherits the full OAT tier-detection + Codex fail-closed authorization pattern (deferred but documented in design).
- **Priority:** P0

## Constraints

- **Architecture is fixed at v3** unless design surfaces a reason to revisit. The 6-skill family + 3 iteration modes + 2 cold-start strategies + 3 agency levels structure is committed.
- **Paseo is the agent-orchestration primitive.** AGPL is handled by shelling out to the binary. No code reuse from Paseo's source; plugin licensing stays MIT-friendly.
- **OAT scaffolding coexists.** The repo is OAT-initialized; plugin packaging must not interfere with OAT files.
- **Skills layer is the only portable thing.** Hooks, agents, commands, rules, settings diverge per provider — adapter surfaces only.
- **Codex public Plugin Directory submission is not yet self-serve** (as of 2026-05-01). v0.1 ships Codex via Git/local install only.
- **Agent Skills baseline frontmatter** is the canonical contract. Provider-specific top-level fields go into provider-specific manifests, not into canonical skill bodies.
- **Personal-time project.** Scope is Phase 1 only at v0.1; all expansion is deferred and not committed in this project.
- **OAT subagent best practices govern host-runtime interactions.** Cross-provider subagent/subprocess dispatch follows the pattern from `oat-project-implement` Step 0.5: tier detection (Claude Task tool / Cursor native / Codex multi-agent / inline fallback); Codex requires explicit user authorization when `spawn_agent` is gated, fail-closed; tier is locked once selected for the run. v0.1 only invokes paseo as a subprocess (not a host-runtime subagent) but the pattern is committed for Phase 4 parallel section orchestration.

## Dependencies

- **Paseo CLI** — agent-orchestration primitive, shelled out from skill scripts. Users must install Paseo separately. License: AGPL-3.0-or-later (handled by shell-out).
- **Claude Code CLI** — one of two default deliberation agents.
- **Codex CLI** — one of two default deliberation agents.
- **Provider plugin runtimes** — Claude Code plugin runtime, Cursor plugin runtime, Codex plugin runtime. Each consumes its respective `.{provider}-plugin/plugin.json` manifest.
- **Agent Skills baseline** — `name`, `description`, `license`, `compatibility` frontmatter contract; `npx skills add` install path.
- **GitHub Actions** — CI validation pipeline.

## High-Level Design (Proposed)

The repository takes the **skills-first repo** shape recommended by the user's plugin synthesis research. `skills/` is canonical and holds skill bodies; provider plugin manifests live under `plugins/consensus/` (sub-plugin pattern, leaves room for future plugin groups). Optional discovery-view symlinks are out of scope for v0.1.

The `consensus` plugin contains one user-facing skill at v0.1 (`consensus-refine`), backed by a shared `consensus-loop` primitive. The primitive is a small TypeScript or shell wrapper around `paseo run --output-schema` that owns the per-turn loop, structured-verdict parsing, hash-based convergence detection, and deliberation-log assembly. The skill is a thin wrapper that supplies `consensus-refine`-specific defaults (alternating mode, shared_input cold-start, moderate agency).

Cross-provider portability is enforced by keeping the skill body provider-agnostic: only Agent Skills baseline frontmatter; provider-specific behavior (Claude `allowed-tools`, Cursor rules, Codex `interface` metadata) lives in the per-provider manifest. The OAT scaffolding in this repo (`.oat/`, `.agents/`, OAT block in `AGENTS.md`) coexists but is not referenced by plugin manifests.

**Key Components:**

- **`consensus-loop` primitive** — Shared engine for all consensus skills. Drives `paseo run` per turn, parses verdicts, detects convergence, assembles deliberation log. Parameterized by iteration mode, cold-start, agency, etc.
- **`consensus-refine` skill** — `SKILL.md` + supporting scripts. Reads input artifact, parses sections, runs the consensus loop sequentially per section, writes the deliberation artifact. Currently the only shipped consensus skill at v0.1.
- **`consensus` plugin manifests** — Per-provider `plugin.json` files under `plugins/consensus/.{claude|cursor|codex}-plugin/`, each selecting `consensus-refine` from `skills/`.
- **Repo-level scaffolding** — `README.md` with install matrix, CI workflow validating skills + manifests, `LICENSE`, `AGENTS.md`/`CLAUDE.md` symlink. Coexists with OAT scaffolding (`.oat/`, `.agents/`).

**Alternatives Considered:**

- **Repo-level plugin manifests at root** (single plugin per repo). Rejected because the user wants this repo to host additional plugin groups long-term; sub-plugin pattern is cleaner for that future. (See `discovery.md` Options Considered.)
- **Standalone CLI separate from Claude Code skill ecosystem.** Rejected during v3 design (`ideas/2026-05-01-two-agent-consensus-deliberation-as.md`) in favor of a skill, since Paseo's `--output-schema` already handles the heavy lifting and skills give native invocation + filesystem access + sub-agent delegation for free.
- **Bundling Paseo into the plugin.** Rejected — Paseo's AGPL license requires shell-out, not embedding. Users install Paseo as a documented prerequisite.

_Design-related open questions are tracked in the [Open Questions](#open-questions) section below._

## Success Metrics

- **Refine end-to-end success rate:** ≥ 80% of refine runs on a real artifact converge without user intervention (during dogfooding).
- **Cross-provider install success:** Fresh install completes successfully on Claude Code, Cursor, and Codex (Git/local) — measured as a manual smoke test before each release.
- **Audit trail readability:** User would publish ≥ 1 deliberation artifact externally as a representative example (qualitative judgment, sampled during dogfooding).
- **Wall-clock & cost:** Typical one-pager refine completes in < 5 min and < $1 (measured but not gated for v0.1).

## Requirement Index

| ID | Description | Priority | Verification | Planned Tasks |
|---|---|---|---|---|
| FR1 | Repo scaffolded with skills/ + plugins/consensus/ + Agent Skills frontmatter | P0 | manual + unit: directory structure, manifest JSON parse, frontmatter validation | TBD - see plan.md |
| FR2 | consensus-refine alternating-mode deliberation | P0 | integration: skill invocation produces valid alternating turns | TBD - see plan.md |
| FR3 | Hash-based convergence detection | P0 | unit: hash equality, oscillation detection, round budget; integration: end-to-end termination | TBD - see plan.md |
| FR4 | Section parsing + sequential per-section deliberation | P0 | unit: heading parser, marker override; integration: multi-section run | TBD - see plan.md |
| FR5 | Deliberation artifact format | P0 | manual: artifact passes readability spot-check; unit: round-record schema | TBD - see plan.md |
| FR6 | Impasse handling + user surfacing | P0 | manual: forced impasse run; integration: user-intervention round entry | TBD - see plan.md |
| FR7 | Cross-provider install paths | P0 | manual: fresh install smoke test on all 3 providers | TBD - see plan.md |
| FR8 | CI validation pipeline | P1 | integration: CI green on representative PR | TBD - see plan.md |
| NFR1 | Audit trail is publishable | P0 | manual: dogfooding readability sample | TBD - see plan.md |
| NFR2 | Wall-clock < 5 min, cost < $1 on one-pager | P1 | perf: dogfooding measurement | TBD - see plan.md |
| NFR3 | Cross-provider portability of skill bodies | P0 | manual + unit: canonical SKILL.md files contain only baseline frontmatter | TBD - see plan.md |
| NFR4 | OAT/plugin separation | P0 | manual: published plugin installs without OAT | TBD - see plan.md |
| NFR5 | Honest README about scope | P1 | manual: README review against v0.1 actual scope | TBD - see plan.md |
| NFR6 | OAT subagent best practices for cross-provider runtime | P0 | manual: cross-provider install + permission docs verification; integration: paseo-availability preflight | TBD - see plan.md |

**Notes:**

- All P0s gate v0.1 release.
- P1s are tracked but not gating.
- "Verification" pointers are seeds for `design.md` Testing Strategy section; final test scenarios come from design.

## Open Questions

Carried forward from `discovery.md`; resolved during design phase:

- **Paseo distribution UX:** End users installing the plugin must have Paseo on their PATH. Document as prerequisite, bundle (license-blocked), auto-install, or something else? **Biggest unknown.**
- **Repo restructure timing:** Introduce `skills/` and `plugins/consensus/` at the start of design, or once the first skill is being authored?
- **Provider discovery views:** Commit `.claude/skills`, `.cursor/skills`, `.agents/skills` symlinks, generate them, or skip entirely for v0.1?
- **Convergence detection details:** Hash algorithm choice, whitespace/line-ending normalization, markdown-aware behavior?
- **Verdict schema versioning:** Does the schema get a version field for forward compatibility?
- **`allowed-tools` portability:** Use it (per-provider manifest only) or rely on natural-language guidance in the skill body?
- **Skill invocation surface:** `/consensus-refine` (separate skills per family member) or `/consensus refine` (umbrella with subcommand)?
- **Paseo invocation permission profile per provider:** What permission scopes does each provider require to invoke `paseo` as a subprocess? Document per-provider `allowed-tools` / equivalent in plugin manifests. Decide whether the skill emits a preflight permission summary on first run.

## Assumptions

- This repository is the user's long-term personal skills home, not a one-off project.
- The user has Paseo installed locally (`paseo` on PATH); end users of the published plugin must install it themselves.
- `<username>/skills` is available as a public GitHub repo name.
- The user's chosen architecture (v3) is correct for the user's needs; v0.1 only ships a slice (Phase 1) but the architecture is committed.
- Paseo's `--output-schema` retry logic is reliable enough for production deliberation (validated by Paseo's own loop service).
- Cross-provider plugin runtimes (Claude/Cursor/Codex) honor the Agent Skills baseline; provider-specific divergence is contained in manifests.

## Risks

- **Paseo install friction**
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation:** Document Paseo prerequisite prominently in README; consider post-install verification script; explore Paseo brew/npm install path; lead with the simplest install instruction by provider.
- **Codex public publishing path stays immature through 2026**
  - **Likelihood:** Medium
  - **Impact:** Low (Git/local install works; only a discovery-channel issue)
  - **Mitigation:** README install matrix leads with Claude/Cursor; document Codex install path carefully; revisit before each release.
- **Convergence detection edge cases (whitespace/line-ending sensitivity)**
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation:** Normalize artifacts before hashing; rely on explicit ACCEPT verdict as second mechanism; cap rounds with hard limit.
- **Cross-provider drift toward Claude-only**
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation:** Enforce baseline-frontmatter canonical skills via CI; document the contribution rule; provider-specific fields only in provider manifests.
- **Personal-time scope drift**
  - **Likelihood:** Medium
  - **Impact:** Low (Phase 1 stands alone)
  - **Mitigation:** Commit to shipping Phase 1 standalone before starting Phase 2; the repo can sit at v0.1 indefinitely.

## References

- Discovery: `discovery.md`
- v3 architecture: `references/ideas/2026-05-01-consensus-deliberation-skill-family.md`
- Plugin synthesis: `references/research/portable-ai-skills-plugin-repo-synthesis-gpt-5-codex.md`
- Plugin research (Opus 4.7): `references/research/building-portable-skills-plugin-repo-opus-4-7.md`
- Plugin research (GPT-5 Codex): `references/research/ai-plugin-marketplace-cross-provider-research-gpt-5-codex.md`
- v2 brainstorm: `references/ideas/2026-05-01-two-agent-consensus-deliberation-as.md`
- v1 (CLI-framed): `references/ideas/2026-04-30-two-agent-consensus-deliberation-cli.md`
