# Skills Repo Current State

**Last updated:** 2026-09-20
**Verified baseline:** `origin/main` at `4150cfe2` on 2026-09-20. PR #100 corrected and live-checked installation documentation, and PR #101 merged Consensus `0.2.1` with Draft-07 Review/Panel schemas plus Review's 900-second default and explicit CLI override. PR #99 is open for review whose six-ticket session-evidence implementation has completed acceptance on its branch; it is not yet merged. Merged source does not establish release, global installation, marketplace discovery, or general live-provider acceptance.

## What is available in the verified source tree

Canonical authored skills live under `src/skills/`, shared transcript code under `src/shared/transcript/`, and Consensus shared runtime under `src/plugins/consensus/`. `src/distributions.ts` declares the generated, self-contained installation units under `skills/` and `plugins/*/skills/`. Runtime remains Node >=22, standard-library only; TypeScript, Vitest, bundling, and pnpm are developer tooling.

| Distribution      | Committed version / members                                                                                                                                                                                  | Boundary                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consensus plugin | Manifest `0.2.1`; create, decide, plan, refine, evaluate, review, panel, phone-a-friend, observer, observer-collab | Deliberation, bounded review, consultation, and cross-session observation. |
| Session plugin    | Manifest `0.3.2`; messaging, handoff, export-transcript, fork-to-destination, retro                                                                                                                          | Addressed local messaging plus transfer, activity-aware export, fork guidance, and retrospective workflows. Agent Messaging is merged in PR #98. |
| Standalone skills | agent-messaging, complexity-review, consensus-review, must-we, next-steps, session-handoff, session-export-transcript, session-fork-to-destination, session-observer, session-observer-collab, session-retro | Eleven declared standalone payloads; plugin and standalone forms share canonical owners. Session Fidelity and Agent Messaging are merged. |

Plugin manifest versions are independent of each skill's sole authored `metadata.version`. Shared-source changes also require affected consumer version bumps; the transitive version guard is already implemented and archived, not new work.

### Consensus

- Create, Decide, Plan, Refine, and Evaluate use the two-peer convergence engine. Alternating, parallel-revision, and parallel-synthesized modes, agency-gated escalation, resume, and host-mediated parallel section orchestration are implemented.
- Review dispatches exactly one read-only reviewer over exactly one branch-diff, selected-files, or document scope. Main accepts the shipped Draft-07 response schema and exposes `--timeout-sec` from 1–3,600 seconds with a 900-second default. Accepted PR #99 reviews establish this bounded CLI route for their recorded packets; they do not certify every provider/model/effort combination, external installation, marketplace path, or native continuation.
- Panel gathers independent, attributed responses without forced convergence. Phone a Friend dispatches one advisory invocation and leaves disposition with the host.
- The provider CLI owns capability/preflight checks, model/effort forwarding where supported, subprocess policy, structured output, retry bounds, and submit-sidecar/final-message handling.
- Saved defaults use invocation > project > user > built-in precedence. The five convergence wrappers forward configured peer model/effort; Review uses its separate ordered `defaults.reviewers` list with whole-list replacement. Reserved roles are not automatically consumed; independent per-workflow default sections are not implemented. Phone a Friend supports explicit per-call controls, not automatic advisor-role defaults.
- The configuration guide includes annotated JSONC, copyable strict JSON, field types/constraints, precedence, and a workflow support matrix.

Exact behavior: [Consensus guide](../../../documentation/docs/user-guide/consensus/index.md), [configuration reference](../../../documentation/docs/user-guide/consensus/configuration.md), and [Consensus runtime architecture](../../../documentation/docs/engineering/architecture/index.md).

### Sessions and collaboration

- Observer discovers and reviews Claude Code, Codex, and supported Cursor transcript surfaces, with exact-pin catch-up, bounded foreground watch, filtered digests, locked state, and opt-in bounded activity evidence merged from Session Fidelity.
- Collaborative Observer composes that observation into bounded **N=2** collaboration. Peer text does not acquire user authority. Wake/callback capabilities remain harness-specific; bounded continuation is not an indefinite idle-session wake guarantee.
- Agent Messaging `1.0.22` adds provider-neutral immutable recipient inboxes, exact native identity plus explicit alias takeover, recipient-owned acknowledgments, and an append-only collaboration log for three or more local sessions without requiring transcript observation. State stays under one resolved local collaboration root and peer text never carries user authority.
- Codex and Claude Code adapters provide bounded prompt/Stop delivery when their exact-session ownership and installation inventories are proven. Claude can additionally compose inbox-first notification with optional observation through one finite Monitor. Cursor remains manual unless a separately proven host boundary is available.
- Deterministic fixtures, generated-payload execution, and repository gates are green for the merged delivery. Live Codex/Claude host delivery remains unverified and is tracked by **BL-260919-verify-live-agent-messaging — Verify live agent-messaging host acceptance**. Release and publication remain separate boundaries.
- Export produces sanitized conversation Markdown by default and opt-in bounded, source-attributed activity for supported Claude Code, Codex, and Cursor evidence. Default output remains unchanged, and unopened native stores or child transcripts remain explicitly outside the evidence claim.
- Handoff captures portable continuation context; Retro reviews session evidence. Neither requires native provider-session forking.
- **Session Fork to Destination is available as an alpha**, canonical version `0.2.36` on `origin/main`. It discovers, previews, and prepares instructions for user-controlled Claude Code or Codex destinations; it does not invoke a provider, create a session, or write provider stores. Cursor lacks exact cwd evidence and fails closed.
- The September 16 re-arm investigation is complete in PR #85. Deterministic fixtures found no lost renderable message across supported clean exact-pin `catch-up-then-watch` restarts, including SIGTERM, control-stop, max-runtime expiry, filtered-only ranges, startup appends, and competing-consumer interleavings. Raw-index gaps can reflect filtered activity. The legacy offset is persisted before stdout completion, so failed output can consume a range without replay; synthetic coverage verifies state and process stdout, not live harness delivery.

See the [standalone catalog](../../../documentation/docs/user-guide/skills/index.md) and [Session plugin guide](../../../documentation/docs/user-guide/plugins/session/index.md) for usage and supported boundaries.

### Implemented in PR #99, awaiting merge

PR #99 implements and has accepted the six selected session-evidence tickets on its branch: metadata-only terminal events, condition-based watcher re-arm testing, bounded skill evidence, native usage semantics, exact-session complete structured export, and different-session Retro over paired frozen captures with all seven coverage states.

Branch versions are `session-observer` 1.0.81, `session-observer-collab` 1.0.69, `session-export-transcript` 2.0.34, `session-retro` 1.0.2, `session-fork-to-destination` 0.2.48 and `consensus-review` 0.1.17; Session remains manifest 0.3.2. They remain branch state until PR #99 merges. Closing the six records means their acceptance criteria are satisfied in PR #99; it does not imply merge, release, installation, or live-provider acceptance.

### Documentation and distribution posture

- PR #100 archived **BL-260920-re-verify-install-matrix — Re-verify Install matrix Cursor claims against current cursor-agent** after checking the named Cursor documentation claims. It did not complete the separate six-cell standalone installer acceptance ticket.
- PR #101 merged Consensus `0.2.1`, including Draft-07 Review/Panel response schemas and Review timeout control. PR #99 carries only branch-local guidance/version closure around that merged runtime seam.
- PR #79 colocated canonical owners and generated distributions; PR #82 promoted Must We?, Next Steps, and Session Retro.
- PR #83 reorganized the site into User Guide (Getting Started, Plugins, Standalone Skills) and Engineering (Architecture, Development, Contributing, Operations), expanded TypeScript/build guidance, added diagrams and the Markdown/Visuals catalog, and completed the configuration reference.
- README is an entry point; the [documentation site source](../../../documentation/docs/index.md) is the detailed reference. Engineering owns the build/packaging/testing and CI/release explanations.
- PR #96 merged Session Fidelity's opt-in activity contract, native evidence extraction/correlation, documentation, and generated payloads. The retained [research packet](../reference/research/session-fidelity-2026-09-10/README.md) remains historical design evidence rather than a live-provider acceptance receipt.
- PR #98 merged the standalone Messaging guide, Session plugin install and usage forms, host-boundary references, generated standalone/plugin payloads, and production-built navigation. Its reconciled versions are `agent-messaging` 1.0.22, `session-observer-collab` 1.0.59, and Session plugin 0.3.2; none is claimed released or globally installed.

## Release and verification posture

- PRs #90, #93, #96, #98, #100 and #101 are merged. PR #99 remains open for review. Committed manifest versions do not establish a published release.
- PR #100 verified its named Cursor documentation claims; it did not prove the full standalone installer matrix. PR #99 establishes no fresh marketplace, global-install, hosted-search, live-messaging, or general provider acceptance.
- Follow [RELEASING.md](../../../RELEASING.md) per plugin. Normal deterministic gates remain required; paid or credentialed live E2E remains opt-in and separately authorized.
- **BL-260916-add-a-first-party-install — Add a first-party install command for standalone skills**, live-submit diagnosis, and live Agent Messaging host acceptance remain open.

## Active planning

There are **23 active item files** after closing the six PR #99 session-evidence tickets. PR #99 still awaits merge; archived records describe accepted branch delivery, not merged-main availability. Release, installation, live-host acceptance and provider support remain separate evidence boundaries.

Installer acceptance, live messaging acceptance and live-submit diagnosis remain authorization-gated work. No next product wave is selected. The [priority alignment](backlog/reviews/priority-alignment.md) records the completed batch, and the [roadmap](roadmap.md) preserves the relative order of all 23 unselected items.

- [Roadmap](roadmap.md)
- [Backlog index](backlog/index.md)
- [Full review](backlog/reviews/backlog-and-roadmap-review.md)
- [Priority alignment](backlog/reviews/priority-alignment.md)
- [Completed history](backlog/completed.md) and [decision records](../reference/decisions/index.md)
