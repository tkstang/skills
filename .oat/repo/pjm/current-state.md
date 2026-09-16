# Skills Repo Current State

**Last updated:** 2026-09-16
**Verified baseline:** `origin/main` at `49b4baf3` (merged PR #83), plus four preserved backlog-only design commits. This is the repository operating picture, not a claim that every payload is installed or externally published.

## What is available on main

Canonical authored skills live under `src/skills/`, shared transcript code under `src/shared/transcript/`, and Consensus shared runtime under `src/plugins/consensus/`. `src/distributions.ts` declares the generated, self-contained installation units under `skills/` and `plugins/*/skills/`. Runtime remains Node >=22, standard-library only; TypeScript, Vitest, bundling, and pnpm are developer tooling.

| Distribution | Committed version / members | Boundary |
| --- | --- | --- |
| Consensus plugin | Manifest `0.1.1`; create, decide, plan, refine, evaluate, panel, phone-a-friend, observer, observer-collab | Deliberation, consultation, and cross-session observation. |
| Session plugin | Manifest `0.2.0`; handoff, export-transcript, fork-to-destination, retro | Transfer, export, fork guidance, and retrospective workflows. Retro does not require Consensus. |
| Standalone skills | complexity-review, must-we, next-steps, session-handoff, session-export-transcript, session-fork-to-destination, session-observer, session-observer-collab, session-retro | Nine declared standalone payloads; plugin and standalone forms share canonical owners. |

Plugin manifest versions are independent of each skill's sole authored `metadata.version`. Shared-source changes also require affected consumer version bumps; the transitive version guard is already implemented and archived, not new work.

### Consensus

- Create, Decide, Plan, Refine, and Evaluate use the two-peer convergence engine. Alternating, parallel-revision, and parallel-synthesized modes, agency-gated escalation, resume, and host-mediated parallel section orchestration are implemented.
- Panel gathers independent, attributed responses without forced convergence. Phone a Friend dispatches one advisory invocation and leaves disposition with the host.
- The provider CLI owns capability/preflight checks, model/effort forwarding where supported, subprocess policy, structured output, retry bounds, and submit-sidecar/final-message handling.
- Saved defaults use invocation > project > user > built-in precedence. **The five convergence wrappers currently discard configured peer model/effort; Panel forwards them.** Reserved roles are not automatically consumed; independent per-workflow default sections are not implemented. Phone a Friend supports explicit per-call controls, not automatic advisor-role defaults.
- The configuration guide now includes annotated JSONC, copyable strict JSON, field types/constraints, precedence, and a workflow support matrix. Documentation does not close the remaining runtime defect.

Exact behavior: [Consensus guide](../../../documentation/docs/user-guide/consensus/index.md), [configuration reference](../../../documentation/docs/user-guide/consensus/configuration.md), and [Consensus runtime architecture](../../../documentation/docs/engineering/architecture/index.md).

### Sessions and collaboration

- Observer discovers and reviews Claude Code, Codex, and supported Cursor transcript surfaces, with exact-pin catch-up, bounded foreground watch, filtered digests, and locked state.
- Collaborative Observer composes that observation into bounded **N=2** collaboration. Peer text does not acquire user authority. Wake/callback capabilities remain harness-specific; bounded continuation is not an indefinite idle-session wake guarantee.
- Export produces sanitized conversation Markdown by default. General correlated tool/result activity is not yet implemented; the optional `--include-activity` contract remains backlog work.
- Handoff captures portable continuation context; Retro reviews session evidence. Neither requires native provider-session forking.
- **Session Fork to Destination is available as an alpha**, canonical version `0.2.3`. It discovers, previews, and prepares instructions for user-controlled Claude Code or Codex destinations; it does not invoke a provider, create a session, or write provider stores. Cursor lacks exact cwd evidence and fails closed. Use explicit supported-provider selection while `--provider all` encounters that incomplete surface.
- The September 16 re-arm investigation is complete in PR #85. Deterministic fixtures found no lost renderable message across supported clean exact-pin `catch-up-then-watch` restarts, including SIGTERM, control-stop, max-runtime expiry, filtered-only ranges, startup appends, and competing-consumer interleavings. Raw-index gaps can reflect filtered activity. The legacy offset is persisted before stdout completion, so failed output can consume a range without replay; synthetic coverage verifies state and process stdout, not live harness delivery.

See the [standalone catalog](../../../documentation/docs/user-guide/skills/index.md) and [Session plugin guide](../../../documentation/docs/user-guide/plugins/session/index.md) for usage and supported boundaries.

### Documentation and distribution work merged

- PR #79 colocated canonical owners and generated distributions; PR #82 promoted Must We?, Next Steps, and Session Retro.
- PR #83 reorganized the site into User Guide (Getting Started, Plugins, Standalone Skills) and Engineering (Architecture, Development, Contributing, Operations), expanded TypeScript/build guidance, added diagrams and the Markdown/Visuals catalog, and completed the configuration reference.
- README is an entry point; the [documentation site source](../../../documentation/docs/index.md) is the detailed reference. Engineering owns the build/packaging/testing and CI/release explanations.
- The retained [session-fidelity research packet](../reference/research/session-fidelity-2026-09-10/README.md) is design input, not implemented functionality. Its original source paths/revisions predate colocation; native schemas are observational and examples synthetic.

## Release and verification posture

- Live GitHub inspection on September 16 confirmed PR #83 merged as `49b4baf3`. `gh release list` returned the published Consensus `v0.1.0` release from June 20; committed manifest versions above do not establish newer tagged releases.
- Historical provider/hosted-discovery evidence applies only to the versions and installation forms actually tested. No fresh marketplace listing, provider discovery, global install parity, hosted-search, or live invocation claim is made by this review.
- The current Session manifest explicitly labels live permission/discovery verification unverified. Follow [RELEASING.md](../../../RELEASING.md) per plugin; release verification need not wait for future Review or installer features.
- `install.sh` currently installs only the Consensus provider wrapper into `~/.consensus/` and defaults to `v0.1.2`; that default is not evidence of a published tag. Standalone docs currently use the third-party Skills CLI.
- Normal verification: `pnpm run type-check`, `pnpm run build:check`, `pnpm test`, `pnpm run validate`, and `pnpm run smoke`. Changed-file lint/format and skill-version gates apply. Paid live E2E is opt-in and separately authorized; no live providers were called in this planning pass.
- The live-submit source-contract investigation remains open; mocked tests do not resolve that historical live discrepancy.

## Active planning

All **18 active item files remain open and unassigned** after closing and archiving the completed observer re-arm investigation. The merged config docs satisfy only the documentation-now portion of **BL-260916-honor-configured-peer-models — Honor configured peer models and effort in convergence workflows**.

The confirmed kickoff now has two active independent lanes after the observer investigation completed: **BL-260916-add-consensus-review-cross — Consensus Review** (Astra leads, Fable reviews) and **BL-260916-add-a-first-party-install — First-party standalone installer** (parallel lane approved, owner/start not claimed). The refreshed alignment originally mapped 19 items to 16 candidate projects; later ordering remains proposed.

Messaging is now a provider-neutral inbox project, independent of the stateless merged-log implementation. Session fidelity precedes the merged activity projection. Neither delivers safe N>2 consumer ownership automatically.

- [Roadmap](roadmap.md) — Now / Next / Later direction.
- [Backlog index](backlog/index.md) — active item inventory.
- [Full review](backlog/reviews/backlog-and-roadmap-review.md) — ratings, dependencies, and evidence.
- [Priority alignment](backlog/reviews/priority-alignment.md) — confirmed three-lane kickoff, candidate project groupings and explicitly proposed later sequencing.
- [Completed history](backlog/completed.md) and [decision records](../reference/decisions/index.md) — durable history; do not repeat it as active work.
