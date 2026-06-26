---
oat_generated: true
oat_generated_at: 2026-06-26
oat_review_scope: design
oat_review_type: artifact
oat_review_invocation: manual
oat_project: /Users/tstang/Code/feat-public-discovery/.oat/projects/shared/public-discovery
---

# Artifact Review: design

**Reviewed:** 2026-06-26
**Scope:** Design artifact readiness for quick-mode planning/implementation
**Files reviewed:** 2 scoped artifacts (`design.md`, `discovery.md`) plus referenced repo files for claim checks
**Commits:** N/A (artifact review)

## Summary

The design is generally aligned with the quick-mode discovery direction: it preserves the controlled CLI lever, keeps hosted skills.sh behavior as a verification task, treats standalone skills as verification-only, and correctly expands consensus coverage to the five skills that exist in the repo. However, it is not yet ready to drive planning because the Category 3 OAT-tooling outcome is reduced to a handoff-only deliverable, the consensus missing-CLI change is aimed at the wrong shared surface, and the `install.sh` recovery path leaves a central distribution decision unresolved.

## Findings

### Critical

- **Category 3 public-discovery outcome is downgraded to a handoff-only deliverable** (`.oat/projects/shared/public-discovery/design.md:185`)
  - Issue: Discovery requires `.agents/skills/**` to stop surfacing in normal `npx skills` discovery and for the `metadata.internal` flag to survive `oat sync` (`discovery.md:130`, `discovery.md:132`). The design instead makes the Category 3 deliverable an upstream handoff prompt (`design.md:185`-`198`) without stating that the upstream change must land, be synced into this repo, and pass the CLI verification before this project can close. As written, a plan could complete the prompt artifact while the central discovery requirement remains unfulfilled.
  - Fix: Revise the design to choose a concrete completion path for Category 3: either make the upstream `open-agent-toolkit` change a blocking dependency with tasks to apply/land it, run `oat sync`, and verify normal/internal CLI listings; or design an idempotent in-repo post-sync/validation step that survives `oat sync`. If a prompt-only handoff is intentionally the whole deliverable, update discovery success criteria and closeout gates to mark the actual OAT-tooling hiding outcome as deferred/out of scope.

### Important

- **Missing-CLI error handling is assigned to the wrong shared implementation surface** (`.oat/projects/shared/public-discovery/design.md:145`)
  - Issue: The design says to centralize the actionable `CONSENSUS_PROVIDER_CLI_MISSING` message at the refine-specific path and "equivalent surfaces" (`design.md:147`-`149`), while also claiming the change is added once and inherited by all five skills (`design.md:32`-`35`). In the current code, all five wrappers call the shared provider invocation path in `src/consensus/core/consensus-loop.ts:1357`, and spawn failures are rejected directly from `runProviderCliCommand` at `src/consensus/core/consensus-loop.ts:1339`; the named `CONSENSUS_PROVIDER_CLI_MISSING` helper exists only in the refine preflight path at `src/consensus/refine/consensus-refine.ts:2086`. Planning from the current design risks updating only refine or the wrong call site, leaving evaluate/create/decide/plan with non-actionable missing-CLI failures.
  - Fix: Update the design to place missing-CLI detection and error mapping in the shared core provider invocation/resolution surface, or explicitly define a shared helper imported by all five wrappers and refine preflight. Add test expectations that exercise the missing-CLI path for all five skill wrappers, not only refine.

- **The `install.sh` acquisition path is still open even though it is the standalone recovery mechanism** (`.oat/projects/shared/public-discovery/design.md:175`)
  - Issue: The design makes `install.sh` one of the two runtime recovery options (`design.md:151`-`155`) and says standalone-installed consensus skills depend on it to populate `~/.consensus/consensus.mjs` (`design.md:101`-`109`), but leaves the key acquisition decision unresolved for users who do not already have a full checkout (`design.md:175`-`178`, `design.md:246`-`247`). A standalone `npx skills ...@refine` install does not bring the repo-root `install.sh` along, so the exact command/source URL/version pin/integrity behavior is part of the user-facing design, not a minor implementation detail.
  - Fix: Decide the acquisition model in the design before planning. For example, require a repo clone and document that `install.sh` is checkout-only, or define a pinned release/raw URL fetch path with version and integrity behavior. Then make the runtime error, README section, `install.sh` tests, and resolver fallback all reference that exact contract.

### Medium

- **Discovery still names only the legacy two consensus skills while the design correctly scopes all five** (`.oat/projects/shared/public-discovery/discovery.md:97`)
  - Issue: The current repo has five consensus skills (`refine`, `evaluate`, `decide`, `plan`, `create`), and the design treats all five as the Category 2 surface (`design.md:59`-`62`). That is a defensible design update, supported by the provider manifests, but discovery still describes the consensus decision and success criterion in terms of `refine`/`evaluate` only (`discovery.md:97`-`103`, `discovery.md:133`-`135`) and its version-bump note is also scoped to those two (`discovery.md:115`-`119`). This artifact drift can make the later plan/review path treat decide/plan/create as scope creep or miss their version/test requirements.
  - Fix: Align discovery with the design by naming all five consensus skills in the Category 2 decision, constraints, and success criteria, or explicitly mark the two-skill wording as legacy discovery context superseded by the current five-skill repo state.

### Minor

None

## Artifact Alignment

**Evidence sources used:**

- `.oat/projects/shared/public-discovery/discovery.md`
- `.oat/projects/shared/public-discovery/design.md`
- `.oat/projects/shared/public-discovery/plan.md` (scaffold context only)
- `.oat/projects/shared/public-discovery/implementation.md` (scaffold context only)
- `src/consensus/core/consensus-loop.ts`
- `src/consensus/refine/consensus-refine.ts`
- `plugins/consensus/skills/{refine,evaluate,decide,plan,create}/SKILL.md`
- `skills/session-observer/SKILL.md`
- `skills/export-session-transcript/SKILL.md`
- `plugins/consensus/.{codex,claude,cursor}-plugin/plugin.json`
- `.agents/plugins/marketplace.json`, `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`

### Discovery Coverage

| Discovery constraint / decision | Status | Notes |
| --- | --- | --- |
| Use the `metadata.internal` lever on the CLI path we control and treat skills.sh hosted behavior as verification-only | aligned | Design preserves the CLI-vs-hosted distinction and keeps skills.sh crawl/submission behavior as a verification task. |
| Standalone `skills/session-observer` and `skills/export-session-transcript` remain individually installable | aligned | Design makes Category 1 verification-only and does not propose changing these skills. |
| OAT tooling under `.agents/skills/**` must not be public installable and the flag must survive `oat sync` | not ready | Design chooses upstream handoff but does not gate project success on the upstream change landing and being synced/verified. See Critical finding. |
| Consensus skills stay discoverable and self-redirect/recover instead of being hidden | partial | Design expands this to all five current consensus skills, which is defensible, but the shared missing-CLI location and install path need correction. |
| Runtime changes go through canonical TypeScript and generated outputs are not hand-edited | aligned | Design names `src/consensus/core/consensus-loop.ts` and build parity checks. |
| No public skills.sh listing claim before live verification | aligned | Design keeps skills.sh as an explicit manual verification and does not claim hosted availability. |

### Extra Work / Scope Risk

The five-skill consensus treatment is not scope creep given the current repo state and provider manifests, but discovery should be aligned so the broader Category 2 scope is explicit. The `install.sh` shared-space recovery path is a scope expansion beyond the original "self-redirect" wording; it is potentially useful, but needs a complete acquisition/security/versioning design before planning.

## Verification Commands / Checks

Run these after artifact fixes to confirm alignment:

```bash
nl -ba .oat/projects/shared/public-discovery/design.md | sed -n '1,260p'
nl -ba .oat/projects/shared/public-discovery/discovery.md | sed -n '80,180p'
rg --files -g 'SKILL.md' skills plugins/consensus/skills .agents/skills | sort
rg -n "resolveConsensusCliPath|CONSENSUS_PROVIDER_CLI_MISSING|install\\.sh|metadata\\.internal" \
  src/consensus plugins/consensus/skills README.md .oat/projects/shared/public-discovery
```

For the eventual implementation plan, include live verification commands for:

```bash
npx skills add tkstang/skills --list
INSTALL_INTERNAL_SKILLS=1 npx skills add tkstang/skills --list
pnpm run build:check
pnpm run validate
```

## Recommended Next Step

Run the `oat-project-review-receive` skill to convert these findings into artifact-fix tasks before writing the implementation plan.
