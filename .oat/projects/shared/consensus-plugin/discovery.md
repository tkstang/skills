---
oat_status: complete
oat_ready_for: oat-project-design
oat_blockers: []
oat_last_updated: 2026-05-01
oat_generated: false
---

# Discovery: consensus-plugin

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details.

- Prefer outcomes and constraints over concrete deliverables (no specific scripts, file paths, or function names).
- If an implementation detail comes up, capture it as an **Open Question** for design (or a constraint), not as a deliverable list.

## Initial Request

Set up a personal skills repository (this repo, `~/Code/skills`) that hosts the user's collection of agent skills, with a specific group — the **consensus deliberation skill family** — packaged as a portable plugin (Claude Code first; cross-provider per recent research).

Originally considered as part of Open Agent Toolkit (OAT). The user has decided to start it as a personal project instead, with the option to lift to OAT later.

The user has done substantial prior brainstorming. The architecture for the consensus skill family is essentially designed at v3 (see `references/ideas/2026-05-01-consensus-deliberation-skill-family.md`). The packaging dimension (skills repo + plugin wrappers) has its own background research (see `references/research/`).

## Prior Context (from references/)

**Consensus skill family architecture (v3 — `ideas/2026-05-01-consensus-deliberation-skill-family.md`):**

- 6 skills sharing a `consensus-loop` core primitive: `consensus-refine`, `consensus-create`, `consensus-evaluate`, `consensus-decide`, `consensus-plan`, `consensus-research`.
- 3 iteration modes (alternating, parallel-revision, parallel-synthesized) × 2 cold-start strategies (shared_input, independent_draft) × 3 editorial agency levels (minimal, moderate, maximum).
- Paseo as primitive layer (shelled out, AGPL handled). Stateless-per-turn agents. Hash-based convergence + structured verdicts. Artifact-as-audit-trail.
- Phase 1 (smallest valuable shippable scope): core primitive + sequential `consensus-refine` with alternating mode.

**Plugin packaging research (`research/`):**

- Build a **skills-first repo**: `skills/` is canonical, provider manifests are thin adapters (`.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`, `.agents/plugins/marketplace.json`).
- Reference implementation: `obra/superpowers` (live multi-provider plugin repo).
- Skills are the only genuinely portable layer; hooks, agents, commands, rules diverge per provider.
- Claude and Cursor have public submission paths today; Codex public Plugin Directory is not yet self-serve (Git/local install works).
- Validating naming pattern: `mattpocock/skills` — `<username>/skills` is a recognized public repo convention.

## Clarifying Questions

### Question 1: Repo posture (public vs. private)

**Q:** Are we building this with public distribution in mind?
**A:** Public, multi-provider from MVP. Build like `obra/superpowers`.
**Decision:** Marketplace manifests for Claude/Cursor/Codex from day 1. README install matrix, CI validation, security/versioning docs are in scope.

### Question 2: GitHub repo name

**Q:** What name should the repo carry on GitHub?
**A:** `<username>/skills` — short, namespaced, matches the local directory. Validated by `mattpocock/skills` as a known public example.
**Decision:** GitHub remote will be `<username>/skills`. Local directory stays `~/Code/skills`.

### Question 3: Plugin shape

**Q:** Single repo-level plugin manifests, or sub-plugins under `plugins/<name>/`?
**A:** Sub-plugin under `plugins/consensus/` with `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` manifests selecting the consensus skills.
**Decision:** Adopt the sub-plugin pattern from the synthesis. This lets the repo grow additional plugin groups (e.g. `plugins/research`, `plugins/oat`) without restructuring.

### Question 4: OAT coexistence

**Q:** How does the plugin packaging coexist with this repo's existing OAT scaffolding (`.oat/`, `.agents/`, `AGENTS.md`)?
**A:** Keep OAT as the project-management layer; ignore from plugin.
**Decision:** OAT stays for the user's workflow (tracking projects, plans, reviews). Plugin manifests don't reference `.oat/` or `.agents/`. Skills under `skills/` stand on their own.

### Question 5: Provider launch staging

**Q:** Should v0.1 go public on all three providers simultaneously, or stage them?
**A:** All three providers ready locally. Submit publicly to Claude marketplace and Cursor marketplace at v0.1. Codex stays Git/local-install with documented instructions until OpenAI's public Plugin Directory is self-serve.
**Decision:** Treat all three as production-supported at launch; the only difference is the install instruction in the README. Re-check OpenAI's Codex plugin docs immediately before public launch.

### Question 6: skills.sh listing posture

**Q:** What's the skills.sh story for v0.1?
**A:** Compatible (`npx skills add <user>/skills` works) but don't claim listing until verified post-launch.
**Decision:** Make sure repo structure satisfies the Agent Skills baseline so `npx skills add` works; verify skills.sh visibility after first installs before announcing.

### Question 7: Polish bar for v0.1

**Q:** What does "done" look like for v0.1?
**A:** Installable + working for refine; rough edges OK.
**Decision:** A stranger can install via documented path on Claude/Cursor/Codex, run `/consensus-refine` on a markdown file, and get a working result with deliberation log. README is honest about scope (Phase 1 only). Bugs and UX rough edges are acceptable; correctness on the happy path is not.

### Question 8: Success criteria for v0.1

**Q:** Beyond "consensus-refine works," what's the smoke test for v0.1?
**A:** (1) Refines a real artifact end-to-end with convergence in ≤10 rounds, output at-or-better than manual baseline. (2) Plugin installs cleanly on all 3 providers. (3) Deliberation log is publishable — readable enough to share externally.
**Decision:** These three are the explicit acceptance criteria. Cost/wall-clock are tracked but not gates for v0.1.

## Solution Space

The architecture for the consensus skill family is settled at v3 (see prior context). Discovery here did not re-explore that space.

The repo/plugin shape was a real branching point during discovery. Three patterns were considered (per the synthesis):

- Repo-level manifests at the root (single plugin per repo)
- Sub-plugins under `plugins/<name>/` (multiple plugin groups in one repo)
- Both (overlap)

The sub-plugin pattern was chosen for the reasons in Question 3.

## Options Considered

### Option A: Repo-level plugin manifests (single plugin per repo)

**Description:** `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` at repo root publishing all skills as one plugin.

**Pros:**

- Simpler shape today — fewer directories.
- Matches the most common single-purpose plugin repos.

**Cons:**

- Forces a restructure once a 2nd plugin group ships.
- Every new skill becomes part of the public plugin whether the user wants that or not.

**Chosen:** B

### Option B: Sub-plugins under `plugins/<name>/`

**Description:** Skills canonical at `skills/<skill-name>/`. Plugin grouping happens in `plugins/<plugin-name>/.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` — manifests select which skills to ship as that plugin.

**Pros:**

- Repo can grow multiple plugin groups (`plugins/consensus/`, `plugins/research/`, `plugins/oat/`) without restructuring.
- Skill bodies stay canonical in `skills/`; plugins are pure selection + provider metadata.
- Aligns with synthesis recommendation when "the repo grows into distinct product lines."

**Cons:**

- Slightly more upfront structure than Option A.
- Less common pattern (Option A is the obra/superpowers default).

**Chosen:** B

**Summary:** Sub-plugin pattern provides growth headroom for the user's stated goal of hosting all personal skills in one repo, with the consensus group being the first published plugin.

## Key Decisions

1. **Repo identity:** This repo is the user's long-term personal skills home. GitHub remote = `<username>/skills`. Local directory = `~/Code/skills`. Public.
2. **Plugin packaging:** `plugins/consensus/` sub-plugin holds Claude/Cursor/Codex manifests. Skill bodies live under `skills/consensus-*/` (canonical).
3. **Provider posture:** Multi-provider (Claude + Cursor + Codex) at v0.1. Public submission to Claude and Cursor marketplaces; Codex via documented Git/local install pending OpenAI's public Plugin Directory maturing.
4. **OAT coexistence:** OAT scaffolding stays for project management; plugin manifests don't reference it. OAT and the published plugin are independent layers.
5. **MVP scope:** v3 Phase 1 only — core `consensus-loop` primitive + sequential `consensus-refine` skill in alternating iteration mode. Skills 2–6 and parallel modes are deferred.
6. **Polish bar:** "Installable + working with rough edges acceptable." Honest README about scope; correctness on the happy path required.
7. **skills.sh:** Compatible (Agent Skills baseline satisfied so `npx skills add` works); don't claim listing until verified post-launch.

## Constraints

- Skill family architecture is fixed at v3 unless design surfaces a reason to revisit.
- Paseo is the chosen agent-orchestration primitive (AGPL handled by shelling out to the binary).
- This repo is OAT-initialized (`.oat/`, `.agents/`, `AGENTS.md`); plugin packaging must coexist with OAT scaffolding without referencing it.
- Cross-provider portability: only the skills layer is genuinely portable. Hooks, agents, commands, rules diverge per provider and must live in provider-specific manifest directories, not in canonical skills.
- Codex public Plugin Directory submission flow is not yet self-serve as of 2026-05-01; install path at v0.1 is Git/local marketplace.

## Success Criteria

v0.1 is done when **all three** are true:

1. **End-to-end refine works:** `/consensus-refine` runs against a real markdown artifact (e.g., a meaty email or arch-doc section), converges in ≤10 rounds, produces output at-or-better than a manual baseline, and emits a structured deliberation log.
2. **Cross-provider install validated:** Plugin installs cleanly via the documented path on Claude Code, Cursor, and Codex (Git/local) without hand-fixing.
3. **Audit trail is publishable:** The deliberation artifact is readable enough that the user would share it externally as an example of how Claude and Codex argued about a draft.

## Out of Scope

- Re-deriving the consensus skill family architecture (already at v3).
- Skills 2–6 in the family (`consensus-create`, `-evaluate`, `-decide`, `-plan`, `-research`) at v0.1.
- Parallel-revision and parallel-synthesized iteration modes at v0.1 (alternating only).
- Parallel section orchestration (`paseo run --detach`) at v0.1 — sequential only.
- Editorial agency setting at v0.1 — moderate (the per-skill default for `consensus-refine`) is hard-coded; no `--agency` flag yet.
- Lifting to OAT as a published OAT skill family.
- Public listing claims on skills.sh until indexing is verified.
- Codex public marketplace submission (use Git/local install path; revisit when OpenAI's flow matures).

## Deferred Ideas

- **Skills 2–6** (`consensus-create`, `-evaluate`, `-decide`, `-plan`, `-research`) — deferred to Phase 4 of the v3 plan.
- **Parallel iteration modes** (parallel-revision, parallel-synthesized) — deferred to Phase 2 of the v3 plan.
- ~~**Editorial agency setting** as a user-facing flag — deferred to Phase 3 of the v3 plan.~~ **Superseded by spec.md:** `--agency` flag is included in v0.1.
- ~~**Parallel section orchestration** via `paseo run --detach` + sub-agent delegation — deferred to Phase 4.~~ **Superseded by spec.md FR4:** parallel section orchestration with host-runtime subagent dispatch is included in v0.1 as an opt-in mode (`--parallel`); sequential remains the default.
- **Other plugin groups** in the repo (e.g., `plugins/research/`, `plugins/oat/`) — out of scope for this project; the sub-plugin shape leaves room.
- **Lifting to OAT** as a published OAT skill family — deferred per "personal-first, OAT later."
- **`consensus` umbrella command** vs. six discrete skills — open design question carried from v3, not blocking v0.1.

## Open Questions

Carried into design phase:

- **Paseo distribution:** End users installing the plugin will need Paseo on their PATH. Is Paseo a documented prerequisite (README install instruction), bundled, auto-installed via post-install script, or something else? This is the biggest unknown for cross-provider install UX.
- **Repo restructure timing:** This repo currently has only OAT scaffolding. When does the `skills/` and `plugins/consensus/` structure get introduced — at the start of design, or once the first skill is being authored?
- **Skill source-of-truth vs. provider discovery views:** Per the synthesis, optional `.claude/skills`, `.cursor/skills`, `.agents/skills` symlinks aid local discovery but aren't the source of truth. Decide whether to commit symlinks, generate them, or skip entirely.
- **Convergence detection in code:** v3 specifies hash-based convergence + structured verdicts as the contract. The exact hash algorithm, normalization (whitespace, line endings), and how it interacts with markdown is a design-phase question.
- **Verdict schema versioning:** The v3 verdict JSON shape is specified; does the schema get a version field for forward compatibility?
- **Synthesis prompt tuning** (carried from v3): irrelevant at v0.1 (alternating mode only) but relevant when parallel-synthesized lands.
- **`allowed-tools` portability:** The synthesis flagged this as a portability trap — tool names differ across providers. Decide whether to use it or rely on natural-language guidance.
- **Skill discoverability:** Should `consensus-refine` be invoked as `/consensus-refine` or `/consensus refine`? (open question from v3, design-phase decision).

## Assumptions

- This repository (`~/Code/skills`) is intended as the user's long-term personal skills home, not a one-off.
- The user has Paseo installed locally (`paseo` on PATH); end users of the plugin will need to install it themselves (validation needed in design).
- The user's GitHub username is unique enough that `<username>/skills` is available as the public repo name.
- The 6 skills in the v3 design are the right shape for the user's needs; only `consensus-refine` is built at v0.1, but the skill-family structure is committed.
- Stateless-per-turn agent invocation via Paseo is reliable enough for production use (validated by Paseo's own loop service per the v2 source review).

## Risks

- **Paseo install friction:** Plugin users must install Paseo separately. If Paseo install is non-trivial, this could be a serious adoption blocker.
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Document Paseo prerequisite prominently; consider post-install verification script; explore whether Paseo offers a brew/npm install path; potentially bundle Paseo binary if license permits (it doesn't, per AGPL — must shell out).
- **Codex public publishing path stays immature:** If OpenAI's Plugin Directory remains non-self-serve through 2026, Codex install UX stays clunkier than Claude/Cursor.
  - **Likelihood:** Medium
  - **Impact:** Low (Git/local install works fine for early adopters)
  - **Mitigation Ideas:** Lead the README install matrix with Claude/Cursor; document Codex install carefully; revisit before each release.
- **Convergence detection edge cases:** Hash-based convergence may not handle whitespace/line-ending variation well. Could cause infinite loops or premature convergence.
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Normalize artifacts before hashing; add an explicit `ACCEPT` second-mechanism; cap rounds with hard limit.
- **Cross-provider divergence creep:** Provider-specific frontmatter (`allowed-tools`, `disable-model-invocation`) tempting; the synthesis flagged this as a portability trap. Risk of drifting toward "just use Claude" if it's easier.
  - **Likelihood:** Medium
  - **Impact:** Medium (undermines the multi-provider thesis)
  - **Mitigation Ideas:** Use minimal Agent Skills baseline frontmatter as canonical; add provider-specific fields only via generated provider-views or provider-specific manifests, not in the canonical skill body.
- **Personal-time scope drift:** Six-skill family is a lot of work for a personal-time project. Phase 1 already constrains scope, but reality-check at v0.1.
  - **Likelihood:** Medium
  - **Impact:** Low (deferred is documented; can ship Phase 1 alone indefinitely if Phase 2+ never happens)
  - **Mitigation Ideas:** Commit to shipping Phase 1 standalone before starting Phase 2.

## Next Steps

Use this discovery artifact to drive the next workflow step:

- **Spec-driven mode:** continue to `oat-project-design` (which confirms requirements and produces both `spec.md` and `design.md`).
- The big design-phase questions: Paseo distribution UX, repo structure introduction timing, convergence detection details, skill invocation surface (`/consensus-refine` vs `/consensus refine`).
