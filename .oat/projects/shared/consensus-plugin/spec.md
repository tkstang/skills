---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-05-03
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

This project sets up the user's long-term **personal skills repository** (this repo, `~/Code/skills`, public on GitHub as `<username>/skills`) and ships v0.1 of the consensus skill family — packaged as a portable `consensus` plugin distributable on Claude Code, Cursor, and Codex. v0.1 scope is one skill (`consensus-refine`) using alternating iteration mode, with sequential section orchestration as default and opt-in parallel orchestration (host-mediated, two-phase wrapper). The user-facing `--agency` flag is exposed at v0.1.

The repo follows a self-contained plugin pattern: `plugins/consensus/` is a fully self-contained package (own skills, own manifests), while top-level `skills/` is reserved for standalone personal skills. This distinguishes plugin-bundled skills from standalone ones and lets additional plugin groups (`plugins/<other>/`) ship without restructure.

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
- Whole-doc harmonization pass after section convergence (deferred to v0.2).
- Cursor CLI as a deliberation **peer** (paseo does not implement a cursor provider as of 2026-05-01). Cursor is supported as a **host runtime**; in that case peers fall back to the `claude` + `codex` defaults.
- Codex public marketplace submission (Git/local install path until OpenAI's flow matures).
- Public skills.sh listing claims at launch.
- Lifting the consensus skills into OAT as published OAT skills.
- Re-deriving the consensus skill family architecture (settled at v3).

## Requirements

### Functional Requirements

**FR1: Repository scaffolded for multi-provider plugin distribution**

- **Description:** The repo distinguishes plugin-bundled skills from standalone personal skills. Plugins are self-contained packages under `plugins/<name>/` — each owns its skills, scripts, and manifests. Standalone personal skills live at top-level `skills/`. Repo-root marketplace files declare which plugins exist and where; skills.sh Phase 2 and the Codex/Claude marketplace runtimes both honor them.
- **Acceptance Criteria:**
  - Top-level `skills/` directory exists for standalone personal skills (may be empty at v0.1).
  - `plugins/consensus/` exists as a self-contained package with: `skills/consensus-refine/`, `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json`. All manifests parse as valid JSON.
  - Plugin manifest skill paths inside `plugins/consensus/.{provider}-plugin/plugin.json` use plugin-root-relative `./skills/...` references (plugin root = `plugins/consensus/`).
  - Repo-root marketplace files exist and parse as valid JSON: `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`, `.agents/plugins/marketplace.json`. Each declares `plugins/consensus` as an installable plugin via `source.path: "./plugins/consensus"`.
  - Each shipped skill includes `name`, `description`, `license`, and `compatibility` frontmatter.
  - Skill folder names match `name` frontmatter values.
  - `npx skills add <username>/skills` correctly discovers the consensus plugin's skills (via marketplace.json Phase 2, validated in CI as a smoke test).
- **Priority:** P0

**FR2: `consensus-refine` skill performs alternating-mode deliberation**

- **Description:** Invoking the skill on a markdown artifact runs alternating turns between two configured agents (Claude Code + Codex by default), each emitting a structured ACCEPT/REVISE/IMPASSE verdict per turn, with the artifact updated after each REVISE.
- **Acceptance Criteria:**
  - Skill accepts a markdown file path and an optional `--goal` text.
  - Each agent turn emits valid JSON conforming to the alternating-mode verdict schema.
  - Artifact state is updated after each REVISE; ACCEPT preserves prior state.
  - Default agent pair is Claude Code + Codex; configurable via `--peers` (see FR9).
- **Priority:** P0

**FR3: Hash-based convergence detection terminates the loop**

- **Description:** The loop terminates on the first of: two consecutive turns producing the same artifact hash, two consecutive ACCEPT verdicts on the same artifact, an explicit IMPASSE from either agent, or a per-section round budget exceeded.
- **Acceptance Criteria:**
  - Termination on hash-match between consecutive turns (different agents).
  - Termination on two consecutive ACCEPTs against the same artifact.
  - Termination + escalation on explicit IMPASSE.
  - Termination + escalation on round budget exceeded (default 12 rounds per section).
  - Oscillation detection: hash alternation between two states across 4+ rounds escalates as impasse.
- **Priority:** P0

**FR4: Section detection and per-section deliberation, sequential by default with optional parallel**

- **Description:** The skill parses the input markdown into sections (default: by markdown headings) and runs an independent consensus loop per section. Default execution is sequential; users can opt into parallel section orchestration via `--parallel`. Parallel mode dispatches one host-runtime subagent per section (each subagent runs its own consensus loop).
- **Acceptance Criteria:**
  - Default section detection by markdown headings.
  - Explicit `<!-- section: name -->` markers override heading-based detection.
  - Single-section docs (no headings) work as a single loop.
  - Section impasse marks that section but does not block subsequent sections (sequential) or peer sections (parallel).
  - `--parallel` flag enables parallel section orchestration; default is sequential.
  - Parallel mode follows OAT tier-detection + Codex fail-closed authorization pattern (see NFR6).
  - Ordered fan-in: parallel results are assembled in original section order in the deliberation artifact.
- **Priority:** P0

**FR10: Optional Paseo install assistance**

- **Description:** When the wrapper's preflight detects Paseo is missing, the skill clearly tells the user how to install it and offers an opt-in install script that runs `npm install -g @getpaseo/cli` after explicit confirmation. Users may decline and install another way, or stop entirely; the skill does not auto-install or repeatedly nag.
- **Acceptance Criteria:**
  - When `paseo` is missing on preflight, the wrapper outputs a clear error including: the official npm install command (`npm install -g @getpaseo/cli`), the source-build path (`https://github.com/getpaseo/paseo`), and the path to `scripts/install-paseo.mjs`.
  - `scripts/install-paseo.mjs` prompts the user (`About to run "npm install -g @getpaseo/cli". Continue? [y/N]`) before executing; the package name is hardcoded (no user input flows into subprocess args).
  - The script verifies `paseo --version` succeeds after install; reports success/failure plainly.
  - The script does not retry, escalate, or run any other commands if the install fails — it surfaces the npm error and exits.
  - The wrapper does not auto-install on first run; install assist is always opt-in via the explicit script invocation.
- **Priority:** P1 (nice-to-have; doesn't gate v0.1 release).

**FR9: Configurable deliberation peers (decoupled from host runtime)**

- **Description:** The deliberation peers (the CLIs paseo drives per turn) are configurable independently of the host runtime that invoked the skill. Defaults are sensible per host; users can override via a peers configuration.
- **Acceptance Criteria:**
  - Default peer pair when host is Claude Code: `claude` + `codex`.
  - Default peer pair when host is Codex: `codex` + `claude`.
  - Default peer pair when host is Cursor: `claude` + `codex` (cursor not a paseo built-in at v0.1; cursor-as-peer is opt-in only via custom ACP provider configured by the user and visible to paseo's provider inventory).
  - Users can override peers via `--peers <a>,<b>` flag, accepting any provider IDs paseo recognizes (including custom ACP providers when configured).
  - Skill verifies each configured peer is available via `paseo provider ls --json` before starting deliberation; fails clearly with a remediation message if missing or unavailable.
  - Peer preflight does NOT use OS-level executable probing (`command -v claude`); paseo's provider inventory is the source of truth (handles ACP-style and custom providers correctly).
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

- **Description:** A run against the **typical supported input profile** (one-pagers, tens of KB, 3–8 sections, average difficulty) completes in under 5 minutes wall-clock and under $1 in API cost using default settings. The budget is not a guarantee for inputs near the 1 MB hard cap, contentious docs requiring repeated user impasse intervention, or custom peer pairs with significantly higher per-token cost than Claude/Codex defaults.
- **Acceptance Criteria:**
  - Typical-profile run wall-clock < 5 min (measured during dogfooding).
  - Typical-profile run API cost < $1 (cost_source = paseo or estimated; unavailable counts as not-measurable, not a failure).
  - No metrics-gating in v0.1; tracked but not blocking.
- **Priority:** P1

**NFR3: Cross-provider portability — additive frontmatter, OAT-tested pattern**

- **Description:** Skills are written so they work across providers. Frontmatter follows the OAT-tested rule: it is OK for canonical `SKILL.md` to carry fields not recognized by all providers, as long as those fields are **additive** (unrecognized = ignored, not fatal). Fields with conflicting semantics across providers go into provider-specific manifests, not canonical skills.
- **Acceptance Criteria:**
  - Canonical `SKILL.md` includes Agent Skills baseline frontmatter (`name`, `description`, `license`, `compatibility`, `metadata`).
  - Additive provider-specific fields (e.g. Claude's `allowed-tools`, `disable-model-invocation`) MAY appear in canonical skills when their unrecognized form is gracefully ignored by other providers.
  - Fields whose semantics conflict across providers (e.g. competing model-invocation defaults) are isolated to per-provider manifests.
  - A documented contribution rule clarifies the additive-vs-conflicting distinction so future skills don't drift.
- **Priority:** P0

**NFR4: OAT scaffolding does not leak into the published plugin**

- **Description:** OAT files (`.oat/`, `.agents/`, the `AGENTS.md` OAT block) are project-management infrastructure for the user; the published plugin and skills do not depend on them.
- **Acceptance Criteria:**
  - Plugin manifests do not reference `.oat/` or `.agents/` paths.
  - Skills under `skills/` do not depend on OAT-installed skills (`.agents/skills/oat-*/`).
  - A user installing the consensus plugin does not need OAT installed.
- **Priority:** P0

**NFR5: Honest README about scope**

- **Description:** The repo's README accurately represents v0.1 scope (`consensus-refine` with alternating iteration mode, sequential default + opt-in parallel orchestration, `--agency` flag exposed), the deferred path, and provider asymmetry (Claude/Cursor public; Codex Git/local).
- **Acceptance Criteria:**
  - README has a "Status: v0.1" badge or section.
  - README clearly notes Codex install differs (Git/local) from Claude/Cursor (marketplace).
  - Deferred features (skills 2–6, parallel-revision/parallel-synthesized iteration modes, harmonization pass) are listed as "future" — not promised, not hidden.
- **Priority:** P1

**NFR6: Provider-runtime subagent permission handling follows OAT best practice**

- **Description:** The skill correctly handles cross-provider differences in how host runtimes treat subprocess execution and (in future phases) host-runtime subagent dispatch. Follows the battle-tested OAT pattern documented in `oat-project-implement` Step 0.5: tier detection at start, fail-closed authorization for Codex when explicit approval is required, tier locked for the run.
- **Acceptance Criteria:**
  - At v0.1, the skill documents required host-runtime permissions (Bash/exec to invoke `paseo`) per provider in its `SKILL.md` and the per-provider plugin manifests.
  - At v0.1, the skill verifies `paseo` availability before starting deliberation and fails clearly if missing or unauthorized.
  - The skill does not silently degrade behavior across providers; cross-provider differences are surfaced in user-facing messages.
  - v0.1 parallel section orchestration uses the full OAT tier-detection + Codex fail-closed authorization pattern (host LLM dispatches host-native subagents per SKILL.md; refuses silent fallback).
- **Priority:** P0

## Constraints

- **Architecture is fixed at v3** unless design surfaces a reason to revisit. The 6-skill family + 3 iteration modes + 2 cold-start strategies + 3 agency levels structure is committed.
- **Paseo is the agent-orchestration primitive.** AGPL is handled by shelling out to the binary. No code reuse from Paseo's source; plugin licensing stays MIT-friendly.
- **OAT scaffolding coexists.** The repo is OAT-initialized; plugin packaging must not interfere with OAT files.
- **Skills layer is the only portable thing.** Hooks, agents, commands, rules, settings diverge per provider — adapter surfaces only.
- **Codex public Plugin Directory submission is not yet self-serve** (as of 2026-05-01). v0.1 ships Codex via Git/local install only.
- **Agent Skills baseline frontmatter** is the canonical contract. Provider-specific top-level fields go into provider-specific manifests, not into canonical skill bodies.
- **Personal-time project.** v0.1 includes consensus-refine (alternating mode) + sequential & parallel section orchestration + `--agency` flag exposure. Skills 2–6, parallel-revision/parallel-synthesized iteration modes, and the harmonization pass remain deferred.
- **OAT subagent best practices govern host-runtime interactions.** Cross-provider subagent/subprocess dispatch follows the pattern from `oat-project-implement` Step 0.5: tier detection (Claude Task tool / Cursor native / Codex multi-agent / inline fallback); Codex requires explicit user authorization when `spawn_agent` is gated, fail-closed; tier is locked once selected for the run. v0.1 invokes paseo as a subprocess in all modes; parallel mode additionally uses host-runtime subagents via host-mediated dispatch (SKILL.md instructs the host LLM; wrapper does not directly spawn host subagents).

## Dependencies

- **Paseo CLI** — agent-orchestration primitive, shelled out from skill scripts. Users must install Paseo separately. License: AGPL-3.0-or-later (handled by shell-out).
- **Claude Code CLI** — default deliberation peer.
- **Codex CLI** — default deliberation peer.
- **(Optional) other paseo-supported peer CLIs** — `opencode`, `copilot-acp-agent`, `generic-acp-agent`. Selectable via `--peers`.
- **Provider plugin runtimes** — Claude Code, Cursor, and Codex plugin runtimes consume their respective `.{provider}-plugin/plugin.json` manifests. Cursor is supported only as a host runtime (not a peer) since paseo doesn't implement a cursor provider.
- **Agent Skills baseline** — `name`, `description`, `license`, `compatibility` frontmatter contract; `npx skills add` install path.
- **GitHub Actions** — CI validation pipeline.

## High-Level Design (Proposed)

The repository uses **self-contained plugins** under `plugins/<name>/` (Option C variant 1, validated against Codex sub-plugin docs and `npx skills 1.5.3` local probe). Each plugin owns its skills, scripts, and manifests entirely; top-level `skills/` is reserved for **standalone personal skills** that aren't part of any published plugin. Repo-root marketplace files (`.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`, `.agents/plugins/marketplace.json`) declare `plugins/consensus` as an installable plugin via `source.path: "./plugins/consensus"`.

The `consensus` plugin contains one user-facing skill at v0.1 (`consensus-refine`). Internally the skill has three layers: `SKILL.md` (instructions to host LLM), `consensus-refine.mjs` (deterministic wrapper script — argv parsing, host detection, peer resolution, sequential dispatch, parallel prepare/fan-in), and `consensus-loop.mjs` (per-turn loop engine — paseo invocation, verdict validation, hash-based convergence). The loop is **Node ESM (.mjs) using stdlib only** (no TypeScript build step at v0.1) and is **vendored inside the consensus-refine skill** for now (refactor target deferred per Open Questions).

Cross-provider portability follows the OAT-tested **additive frontmatter** rule: canonical `SKILL.md` carries fields like Claude's `allowed-tools` when current target providers tolerate them; conflicting fields go in provider-specific manifests. The OAT scaffolding in this repo (`.oat/`, `.agents/`, OAT block in `AGENTS.md`) coexists as project-management infrastructure but is not referenced by plugin manifests.

**Key Components:**

- **`consensus-refine` skill (3 layers)** — `plugins/consensus/skills/consensus-refine/SKILL.md` (instructions) + `scripts/consensus-refine.mjs` (wrapper) + `scripts/consensus-loop.mjs` (per-turn loop). The wrapper supplies sensible defaults (alternating mode, shared_input cold-start, `moderate` agency); `--agency` is exposed as a CLI flag.
- **`consensus` plugin manifests** — Per-provider `plugin.json` under `plugins/consensus/.{claude|cursor|codex}-plugin/`. Skill paths inside these manifests are plugin-root-relative (`./skills/consensus-refine`) where the plugin root is `plugins/consensus/`.
- **Repo-root marketplace files** — `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`, `.agents/plugins/marketplace.json`. Each declares `plugins/consensus` as an installable plugin. Plugin runtimes (Claude/Codex/skills.sh) honor these for discovery.
- **Repo-level scaffolding** — `README.md` with install matrix, CI workflow validating skills + manifests, `scripts/validate.mjs`, `scripts/install-paseo.mjs` (FR10), `LICENSE`, `AGENTS.md` ↔ `CLAUDE.md`. Coexists with OAT scaffolding.

**Alternatives Considered:**

- **Self-contained plugin under `plugins/consensus/` (Chosen).** Validated against Codex sub-plugin docs (paths must start with `./`, must stay inside marketplace root) and `npx skills 1.5.3` local probe (Phase 2 marketplace.json discovery picks up nested skills). Distinguishes plugin-bundled skills from standalone personal skills under top-level `skills/` — directly serves the user's stated requirement.
- **Repo-level plugin manifests** (`obra/superpowers` shape). Rejected because it conflates the repo with a single plugin and doesn't distinguish plugin-bundled skills from standalone personal skills. Migration path from this shape to sub-plugin requires either copy/sync mechanism or restructure when a second plugin group arrives.
- **Standalone CLI separate from Claude Code skill ecosystem.** Rejected during v3 design (`ideas/2026-05-01-two-agent-consensus-deliberation-as.md`) in favor of a skill, since Paseo's `--output-schema` handles the heavy lifting and skills give native invocation + filesystem access + sub-agent delegation for free.
- **Bundling Paseo into the plugin.** Rejected — Paseo's AGPL license requires shell-out, not embedding. Users install Paseo as a documented prerequisite (FR10 provides opt-in install assist).

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
| FR4 | Section parsing + per-section deliberation (sequential default, opt-in parallel via host-mediated dispatch) | P0 | unit: heading parser, marker override; integration: sequential multi-section run; integration: --prepare-parallel/--fan-in flow with simulated host dispatch | TBD - see plan.md |
| FR5 | Deliberation artifact format | P0 | manual: artifact passes readability spot-check; unit: round-record schema | TBD - see plan.md |
| FR6 | Impasse handling + user surfacing | P0 | manual: forced impasse run; integration: user-intervention round entry | TBD - see plan.md |
| FR7 | Cross-provider install paths | P0 | manual: fresh install smoke test on all 3 providers | TBD - see plan.md |
| FR8 | CI validation pipeline | P1 | integration: CI green on representative PR | TBD - see plan.md |
| FR9 | Configurable deliberation peers | P0 | unit: peer flag parsing + paseo-availability preflight; integration: non-default peer pair runs end-to-end | TBD - see plan.md |
| FR10 | Optional Paseo install assistance | P1 | manual: install script smoke test on a clean machine; unit: prompt+confirm flow | TBD - see plan.md |
| NFR1 | Audit trail is publishable | P0 | manual: dogfooding readability sample | TBD - see plan.md |
| NFR2 | Wall-clock < 5 min, cost < $1 on one-pager | P1 | perf: dogfooding measurement | TBD - see plan.md |
| NFR3 | Cross-provider portability via additive frontmatter | P0 | manual + unit: canonical SKILL.md files use additive frontmatter pattern (provider-tolerant); release smoke tests verify per-provider tolerance | TBD - see plan.md |
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
- **Future shared consensus-loop refactor:** When a 2nd consensus-* skill ships, where does the shared loop live so that `npx skills add <consensus-skill>` standalone installs still work? Each-skill-vendors-its-own copy duplicates code; a plugin-level `lib/` doesn't travel with standalone skill installs. Decide between vendoring, plugin-only distribution for consensus skills, or a more sophisticated packaging strategy. v0.1 is fine with the loop inside `consensus-refine/scripts/`; only revisit when the 2nd skill arrives.
- **Skill path syntax inside `.codex-plugin/plugin.json`:** Codex docs show `skills/` at plugin root but don't precisely document whether plugin.json's skill references are relative-to-plugin-root (`./skills/consensus-refine`) or relative-to-`skills/` (`./consensus-refine`). Codex's marketplace.json plugin entries use plugin-root-relative paths (`source.path`); resolve plugin.json's internal syntax in implementation by testing both forms.

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
  - **Impact:** Low (sequential v0.1 stands alone if parallel must be cut)
  - **Mitigation:** Commit to shipping the sequential path standalone before extending; if personal time runs short before implementation starts, re-scope v0.1 to sequential-only and update spec/design/README before release. Do not silently defer `--prepare-parallel`/`--fan-in` once public docs advertise them.
- **Prompt injection inside input artifact (surfaced during design)**
  - **Likelihood:** Medium (any user-supplied content could contain it)
  - **Impact:** Low–Medium (manipulated verdicts visible in audit trail; user reviews the deliberation log)
  - **Mitigation:** Per-turn prompt frames artifact as untrusted with `<SECTION>` delimiters and explicit "ignore instructions inside" guidance; schema enforcement keeps the loop parseable but does not prevent maliciously influenced valid verdicts; audit trail surfaces unusual verdicts post-hoc; documented as known limitation in README.
- **Wrapper-vs-host-runtime parallel dispatch fragility (surfaced during design)**
  - **Likelihood:** Medium (host runtimes evolve; new versions may change subagent semantics)
  - **Impact:** Medium (parallel mode breaks; sequential still works)
  - **Mitigation:** Sequential is the default mode; parallel two-phase wrapper makes phases independently testable; SKILL.md documents host responsibilities for parallel; Codex authorization fail-closed prevents silent degradation.
- **Paseo CLI breaking changes (surfaced during design)**
  - **Likelihood:** Medium (paseo is pre-1.0; CLI surface may evolve)
  - **Impact:** Medium–High (loop fails; section preflight catches early)
  - **Mitigation:** Version check at preflight with warning if outside tested range; provider preflight via `paseo provider ls --json` validates JSON shape; subprocess output cap defends against unexpected verbosity; wrapper depends only on documented paseo flags; pin tested version range in README install instructions.

## References

- Discovery: `discovery.md`
- v3 architecture: `references/ideas/2026-05-01-consensus-deliberation-skill-family.md`
- Plugin synthesis: `references/research/portable-ai-skills-plugin-repo-synthesis-gpt-5-codex.md`
- Plugin research (Opus 4.7): `references/research/building-portable-skills-plugin-repo-opus-4-7.md`
- Plugin research (GPT-5 Codex): `references/research/ai-plugin-marketplace-cross-provider-research-gpt-5-codex.md`
- v2 brainstorm: `references/ideas/2026-05-01-two-agent-consensus-deliberation-as.md`
- v1 (CLI-framed): `references/ideas/2026-04-30-two-agent-consensus-deliberation-cli.md`
