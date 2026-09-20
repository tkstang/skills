# Skills Repo Current State

**Last updated:** 2026-09-20
**Verified baseline:** `origin/main` at `6f896ae6`, including Session Fidelity from PR #96, merged into the completed agent-messaging implementation on `backlog-triage`. PR #98's published head `76d93a00` was clean and green before the reconciliation; newer local closeout commits require push and fresh CI. Branch-only delivery is labeled below; this is not a claim that every payload is merged, installed, released, or externally published.

## What is available in the verified source tree

Canonical authored skills live under `src/skills/`, shared transcript code under `src/shared/transcript/`, and Consensus shared runtime under `src/plugins/consensus/`. `src/distributions.ts` declares the generated, self-contained installation units under `skills/` and `plugins/*/skills/`. Runtime remains Node >=22, standard-library only; TypeScript, Vitest, bundling, and pnpm are developer tooling.

| Distribution      | Committed version / members                                                                                                                                                                                  | Boundary                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consensus plugin  | Manifest `0.2.0`; create, decide, plan, refine, evaluate, review, panel, phone-a-friend, observer, observer-collab                                                                                           | Deliberation, bounded review, consultation, and cross-session observation.                                                                           |
| Session plugin    | Manifest `0.3.2`; messaging, handoff, export-transcript, fork-to-destination, retro                                                                                                                          | Addressed local messaging plus transfer, activity-aware export, fork guidance, and retrospective workflows. Agent Messaging remains branch delivery. |
| Standalone skills | agent-messaging, complexity-review, consensus-review, must-we, next-steps, session-handoff, session-export-transcript, session-fork-to-destination, session-observer, session-observer-collab, session-retro | Eleven declared standalone payloads; plugin and standalone forms share canonical owners. Session Fidelity is merged; Agent Messaging is branch-only. |

Plugin manifest versions are independent of each skill's sole authored `metadata.version`. Shared-source changes also require affected consumer version bumps; the transitive version guard is already implemented and archived, not new work.

### Consensus

- Create, Decide, Plan, Refine, and Evaluate use the two-peer convergence engine. Alternating, parallel-revision, and parallel-synthesized modes, agency-gated escalation, resume, and host-mediated parallel section orchestration are implemented.
- Review dispatches exactly one read-only reviewer over exactly one branch-diff, selected-files, or document scope. It owns structured result validation and deterministic OAT-compatible Markdown rendering. Local receipt fixtures passed; live provider, external-install, and native-continuation acceptance remain unverified.
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
- Deterministic fixtures, generated-payload execution, and repository gates are green on the delivery branch. Live Codex/Claude host delivery, installation, release, and publication remain unverified and are tracked separately by BL-260919-verify-live-agent-messaging.
- Export produces sanitized conversation Markdown by default and opt-in bounded, source-attributed activity for supported Claude Code, Codex, and Cursor evidence. Default output remains unchanged, and unopened native stores or child transcripts remain explicitly outside the evidence claim.
- Handoff captures portable continuation context; Retro reviews session evidence. Neither requires native provider-session forking.
- **Session Fork to Destination is available as an alpha**, canonical version `0.2.3`. It discovers, previews, and prepares instructions for user-controlled Claude Code or Codex destinations; it does not invoke a provider, create a session, or write provider stores. Cursor lacks exact cwd evidence and fails closed. Use explicit supported-provider selection while `--provider all` encounters that incomplete surface.
- The September 16 re-arm investigation is complete in PR #85. Deterministic fixtures found no lost renderable message across supported clean exact-pin `catch-up-then-watch` restarts, including SIGTERM, control-stop, max-runtime expiry, filtered-only ranges, startup appends, and competing-consumer interleavings. Raw-index gaps can reflect filtered activity. The legacy offset is persisted before stdout completion, so failed output can consume a range without replay; synthetic coverage verifies state and process stdout, not live harness delivery.

See the [standalone catalog](../../../documentation/docs/user-guide/skills/index.md) and [Session plugin guide](../../../documentation/docs/user-guide/plugins/session/index.md) for usage and supported boundaries.

### Documentation and distribution posture

- PR #79 colocated canonical owners and generated distributions; PR #82 promoted Must We?, Next Steps, and Session Retro.
- PR #83 reorganized the site into User Guide (Getting Started, Plugins, Standalone Skills) and Engineering (Architecture, Development, Contributing, Operations), expanded TypeScript/build guidance, added diagrams and the Markdown/Visuals catalog, and completed the configuration reference.
- README is an entry point; the [documentation site source](../../../documentation/docs/index.md) is the detailed reference. Engineering owns the build/packaging/testing and CI/release explanations.
- PR #96 merged Session Fidelity's opt-in activity contract, native evidence extraction/correlation, documentation, and generated payloads. The retained [research packet](../reference/research/session-fidelity-2026-09-10/README.md) remains historical design evidence rather than a live-provider acceptance receipt.
- The agent-messaging branch adds the standalone Messaging guide, Session plugin install and usage forms, host-boundary references, generated standalone/plugin payloads, and production-built navigation. Its reconciled versions are `agent-messaging` 1.0.22, `session-observer-collab` 1.0.59, and Session plugin 0.3.2; none is claimed released or globally installed.

## Release and verification posture

- Live GitHub inspection on September 16 confirmed PR #83 merged as `49b4baf3`. `gh release list` returned the published Consensus `v0.1.0` release from June 20; committed manifest versions above do not establish newer tagged releases.
- Historical provider/hosted-discovery evidence applies only to the versions and installation forms actually tested. No fresh marketplace listing, provider discovery, global install parity, hosted-search, or live invocation claim is made by this review.
- The current Session manifest explicitly labels live permission/discovery verification unverified. Follow [RELEASING.md](../../../RELEASING.md) per plugin; merged Session Fidelity and deterministic messaging evidence do not satisfy separate installation or live-host acceptance.
- `install.sh` currently installs only the Consensus provider wrapper into `~/.consensus/` and defaults to `v0.1.2`; that default is not evidence of a published tag. Standalone docs currently use the third-party Skills CLI.
- Normal verification: `pnpm run type-check`, `pnpm run build:check`, `pnpm test`, `pnpm run validate`, and `pnpm run smoke`. Changed-file lint/format and skill-version gates apply. Paid live E2E is opt-in and separately authorized; no live providers were called in the agent-messaging delivery run.
- The live-submit source-contract investigation remains open; mocked tests do not resolve that historical live discrepancy. Review's deterministic receipt exercise likewise does not prove live provider behavior.

## Active planning

There are **29 active item files** after closing and archiving Session Fidelity and Agent Messaging. Their deterministic implementations remain in completed history; release, installation, and exact live-host acceptance retain separate evidence boundaries.

The confirmed immediate lane remains **BL-260916-add-a-first-party-install — First-party standalone installer** (approved, owner/start not claimed). Session Fidelity is merged; Agent Messaging is implemented on its delivery branch and archived from the active backlog. Merge, release, global installation, and live acceptance remain separate boundaries. The September 16 alignment originally mapped 19 items to 16 candidate projects; later ordering remains proposed.

Agent Messaging is a completed provider-neutral inbox implementation independent of transcript observation. The shared-session-log substrate may reuse Session Fidelity's merged activity contract; neither completed project delivers safe N>2 transcript-consumer ownership automatically.

- [Roadmap](roadmap.md) — Now / Next / Later direction.
- [Backlog index](backlog/index.md) — active item inventory.
- [Full review](backlog/reviews/backlog-and-roadmap-review.md) — ratings, dependencies, and evidence.
- [Priority alignment](backlog/reviews/priority-alignment.md) — confirmed three-lane kickoff, candidate project groupings and explicitly proposed later sequencing.
- [Completed history](backlog/completed.md) and [decision records](../reference/decisions/index.md) — durable history; do not repeat it as active work.
