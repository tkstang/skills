# Changelog

## [Unreleased]

### Added

- `session-observer-collab` 1.0.45 completes the finite Claude Monitor's
  critical-path fixture proof across shared-cap exhaustion, lifecycle changes,
  identity and continuity failures, private no-op progress, concurrent runners,
  interrupted event/slot/output stages, real Claude transcript digestion, and
  Codex, Claude Code, and Cursor peers without public-offset mutation.

- `agent-messaging` 1.0.13 and `session-observer-collab` 1.0.37 add the
  fixture-tested finite Claude composed Monitor: exact activation and peer pins,
  inbox-first selection, shared message/observation slots, slot-before-private-
  cursor-CAS ordering, bounded range-only notifications, explicit re-arm without
  budget reset, and truthful non-retryable observation-attempt status. Live
  Claude receipt remains separately authorized and unverified.

- `agent-messaging` 1.0.9 and `session-observer-collab` 1.0.35 compose one
  fixture-tested, composition-capable Codex Stop owner with inbox-first
  selection, a shared finite continuation budget, observer-CAS loss containment,
  exact-ID dedup guidance, and fail-closed Claude/Cursor fallbacks. Exact expiry
  equality is now inactive, and output-attempt diagnostics are recorded only
  after the final veto check.

- `session-observer-collab` 1.0.34 opens and joins the shared collaboration
  container without enabling messaging delivery, bundles the immutable shared
  log runtime in both distributions, and replaces hand-edited Markdown logs
  with append/show/render commands while preserving separate observer offsets.

- `agent-messaging` 1.0.7 adds explicit bounded host-probe plans, sanitized
  receipt and owned-cleanup contracts, a fixture-tested 4,096-receipt validation
  benchmark, and an honest host acceptance matrix; live Codex, Claude Code, and
  Cursor rows remain unverified/manual, and no Cursor adapter is fabricated.

- `agent-messaging` 1.0.6 adds a finite foreground request-only watch with
  deterministic batch claims, shared continuation slots, ownership rechecks,
  a 30-minute/activation-expiry cap, explicit Claude Monitor reconfirmation,
  and no daemon, self-rearm, or automatic provider claim.

- `agent-messaging` 1.0.5 adds fail-closed Codex and Claude Code prompt/Stop
  adapters, exact-session observer ownership detection, scoped third-party hook
  fingerprints, Claude Monitor attestation, explicit registration generation,
  bounded untrusted envelopes, and separate fixture-versus-live capability
  labels; no live hook, trust, provider, or global configuration is changed.

- `agent-messaging` 1.0.4 adds immutable activation epochs, fixed or
  provenance-bound human-idle expiry, finite non-reusable continuation slots,
  retryable event/message claims, redacted bounded diagnostics, and honest
  attempt-versus-delivery status without enabling any live host integration.

- `agent-messaging` 1.0.0 adds a dependency-free manual mailbox and immutable
  collaboration log for three or more local coding-agent sessions, shipped as
  a standalone skill and Session plugin-local `messaging` with exact identity,
  explicit takeover, addressed messages, recipient acknowledgments, and
  retained closeout history.
- `session-observer` 1.0.66 delivers opt-in Cursor activity through the existing terminal checkpoint and atomic delivery state, including activity-only settlement deltas without replay; `session-export-transcript` 2.0.20 exports settled and pending-lifecycle Cursor calls with separate source and delivery coordinates, while `session-observer-collab` 1.0.55 and `session-fork-to-destination` 0.2.32 receive the required shared runtime closure update without changing their activity defaults.
- `session-observer` 1.0.65 and `session-export-transcript` 2.0.19 add the shared internal Cursor activity extractor with terminal-settled frame/block identity, snapshot-scoped pending calls, separate pending counts, explicit not-recorded result coverage, and distinct source/delivery frame coordinates; `session-observer-collab` 1.0.54 and `session-fork-to-destination` 0.2.31 receive the required shared runtime closure update without enabling Cursor activity delivery.
- `session-export-transcript` 2.0.16 adds opt-in bounded source-attributed Claude Code and Codex activity to sanitized Markdown exports, including explicit sensitive-data labels, preview and size limits, source locators, omission counts, and unread external-output and child-trajectory coverage while preserving default exports and filenames; `session-fork-to-destination` 0.2.28 receives the required exporter runtime closure update without enabling activity in fork previews.
- `session-observer` 1.0.61 delivers opt-in activity-only Claude Code and Codex watch updates without a separate activity cursor, retains activity and new coverage under `--quiet-empty`, marks activity-only deltas, and keeps event logs metadata-only; `session-observer-collab` 1.0.50 and `session-fork-to-destination` 0.2.26 receive the required shared observer runtime closure update without enabling collaboration activity.
- `session-observer` 1.0.59 exposes opt-in source-attributed activity in review and catch-up digests while preserving the outer digest schema, conversation budgets, ask-user context, and existing state advancement; `session-observer-collab` 1.0.48 and `session-fork-to-destination` 0.2.24 receive the required shared observer runtime closure update without enabling activity in collaboration flows.
- `session-observer` 1.0.56, `session-observer-collab` 1.0.45, `session-export-transcript` 2.0.13, and `session-fork-to-destination` 0.2.21 add the shared detailed-read-to-projection activity entrypoint, verified end to end against the obscured Claude Code and Codex captures.
- `session-observer` 1.0.54, `session-observer-collab` 1.0.43, `session-export-transcript` 2.0.11, and `session-fork-to-destination` 0.2.19 add pure mode-bounded activity projection with deterministic UTF-8 size guards, source-scoped counts and locators, late-call context, failure-first selection, and honest global omission counts.
- `session-observer` 1.0.52, `session-observer-collab` 1.0.41, `session-export-transcript` 2.0.9, and `session-fork-to-destination` 0.2.17 add internal exact-ID activity correlation, native tool categories, Codex inherited-history ownership, and separate response-stream and standalone-item evidence counts without inferred links.
- `session-observer` 1.0.50, `session-observer-collab` 1.0.39, `session-export-transcript` 2.0.7, and `session-fork-to-destination` 0.2.15 add internal schema-v1 Claude Code and Codex activity extraction with source attribution, stable physical and logical locators, and bounded diagnostics; extraction preserves native call arguments without reading sidecars or enabling a consumer.
- `session-observer` 1.0.49, `session-observer-collab` 1.0.38, `session-export-transcript` 2.0.6, and `session-fork-to-destination` 0.2.14 add shared detailed transcript reads with stable physical-line diagnostics and zero-based decoded-record positions while preserving legacy reader output and warnings; lightly obscured Claude Code, Codex, and Cursor activity fixtures record the observed native carriers without raw session content.
- `consensus-review` 0.1.7 completes the three-selector non-interactive CLI, deterministic OAT-compatible Markdown rendering, absolute artifact handoffs, explicit post-drift export, and host-facing scope-selection workflow; the `consensus` plugin 0.2.0 adds plugin-local `review` and is the first plugin release supporting strict `defaults.reviewers` configuration (older binaries reject that key).
- `consensus-review` 0.1.5 adds bounded branch, selected-file, and document scope capture; canonical external run state; ordered reviewer configuration and selection; bounded request prompts; one-shot deep result validation and host-owned JSON persistence; and selected-path drift evidence with explicit coverage limits.
- Review-default configuration propagation updates `create` 0.1.13, `decide` 0.1.13, `evaluate` 0.1.17, `panel` 0.1.10, `phone-a-friend` 0.1.9, `plan` 0.1.13, `refine` 0.1.16, `session-observer` 1.0.44, `session-observer-collab` 1.0.33, and `session-fork-to-destination` 0.2.9.
- `pnpm run validate:skill-versions` now also requires a new line under `## [Unreleased]` in `CHANGELOG.md` whenever a canonical skill `metadata.version` or a plugin release version changes, so a bump cannot ship without release notes.
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

- `agent-messaging` 1.0.15 and `session-observer-collab` 1.0.39 share Claude
  hook inventory and automatic-owner assessment from the canonical
  collaboration runtime instead of bundling those read-only primitives from a
  sibling skill.

- `agent-messaging` 1.0.10 documents the shipped bounded delivery
  and Codex observer-composition contract across the standalone and Session
  forms; Collaborative Observer documentation records its 1.0.35 shared-log and
  single-owner behavior. All live delivery rows remain unverified/manual, Cursor
  remains manual-only, and Claude composed Monitor remains pending.

- `session-observer` 1.0.69 and `session-export-transcript` 2.0.22 correct the documented activity-coverage boundary: schema v1 reports recorded Claude persisted-output references and recorded Claude/Codex child IDs, while Cursor `agent-tools/` and child-transcript surfaces remain unopened without dedicated per-reference coverage. The exporter checklist now describes its stable metadata version and separates default conversation sanitization from the opt-in bounded activity appendix.
- `session-observer` 1.0.67 and `session-export-transcript` 2.0.21 document and package the opt-in activity contract across canonical skill guidance, transcript references, and the documentation site: mode-specific budgets, one-read/stateless behavior, late-call context, explicit unread/unavailable evidence, Cursor settlement and retrospective pending-lifecycle review, and sensitive-data boundaries; `session-observer-collab` 1.0.56 and `session-fork-to-destination` 0.2.33 receive the required dependent-owner version closure without enabling activity in their flows.
- `consensus-review` 0.1.13 emits OAT's `Critical` / `High` / `Medium` / `Low` review tiers and matching `C` / `H` / `M` / `L` finding IDs; retired `important` and `minor` severities are rejected instead of producing artifacts that current OAT review receivers fail closed on.
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

- Installation docs correct the plugin update model. Claude Code and Codex do
  copy the plugin tree into a pinned per-provider cache, so a `git pull` alone
  does not refresh an install; `claude plugin update` is keyed on the plugin
  manifest version and reports `already at the latest version` when only skill
  versions changed. Cursor's git-URL marketplace re-indexes its existing clone
  instead of fetching, so it can silently under-report plugins until the
  marketplace is removed and re-added. Adds a standalone-skill update procedure
  and an installed-version audit snippet, and points `AGENTS.md` and the README
  at the per-provider refresh commands.

- `session-observer` 1.0.71, `session-observer-collab` 1.0.59, `session-export-transcript` 2.0.23, and `session-fork-to-destination` 0.2.36 reconcile the merged Session Fidelity runtime closure with Agent Messaging's portable Codex and Cursor Stop-hook stdin handling, preserving activity-aware observer/export behavior and Linux socket-backed hook execution.
- `session-observer-collab` 1.0.48 reads Codex and Cursor Stop-hook payloads
  directly from the stdin stream so socket-backed Linux hook invocations no
  longer fail while reopening `/dev/stdin`.

- `session-observer-collab` 1.0.47 decodes URL-derived repository paths in its
  generated shared-log integration test before filesystem access.

- `agent-messaging` 1.0.22 decodes URL-derived repository paths in its
  standalone and Session payload packaging test before filesystem access.

- `agent-messaging` 1.0.21 removes only owned entries from valid Codex hook
  arrays during uninstall, preserving primitive, array, absent-event, malformed,
  and unrelated configuration shapes.

- `agent-messaging` 1.0.20 times the first activity-receipt activation read as
  cold and the second as warm, tests their true invocation order, and honestly
  relabels the earlier primed-call measurements as historical warm evidence.

- `agent-messaging` 1.0.19 classifies malformed JSON in `--command` and
  `--installed-plugins` as invalid CLI input while retaining strict array and
  string-map shape validation.

- `session-observer-collab` 1.0.46 makes every lifecycle command honor a
  validated absolute `--root`, rejects command-specific unknown options, proves
  generated Codex/Cursor Stop hooks through symlinked bundles, and cleans
  Monitor packaging fixtures after execution.

- `session-observer-collab` 1.0.45 lets private no-op cursor progress advance
  from an armed lease; previously the composed Monitor stopped with `armed`
  instead of continuing its finite poll.

- `agent-messaging` 1.0.18 makes the Claude composed-ownership fixture use a
  real resolved settings source instead of relabeling an empty Codex inventory,
  preserving the fail-closed production inventory contract in the full suite.

- `session-observer-collab` 1.0.44 aligns composed Claude Monitor polling at
  1000 ms, rejects relative state roots, and documents that selected requests
  must be acknowledged before re-arm can yield to observation.

- `session-observer-collab` 1.0.43 gives the finite Claude Monitor an explicit
  redacted terminal status, nonzero refusal exits, detailed input diagnostics,
  message-attempt diagnostics, and complete consistent
  arm/enable/launch/re-arm invocation guidance.

- `session-observer-collab` 1.0.42 requires an armed or waiting lease when a
  composed Claude Monitor starts or iterates, and accepts the triggered state
  after cursor CAS only when no identity or continuity refusal is present.

- `agent-messaging` 1.0.17 and `session-observer-collab` 1.0.41 keep
  interrupted and outcome-unknown observation attempts out of message retry
  status, leaving pinned-range recovery as their only advertised path.

- `agent-messaging` 1.0.16 and `session-observer-collab` 1.0.40 resolve the
  standard bounded Claude settings inventory by default, persist its exact
  sources in each activation, and re-inspect the same sources at every delivery
  boundary; absent, unreadable, unresolved, or changed inventories stay manual.

- `agent-messaging` 1.0.14 and `session-observer-collab` 1.0.38 make shipped
  hook and Monitor entrypoints execute correctly through real or symlinked
  installation paths, including URL-escaped paths.

- `agent-messaging` 1.0.12 binds every standalone Stop and foreground-watch
  ownership recheck to the active epoch's immutable controller, so a newly
  composed observer owner makes an in-flight standalone boundary emit nothing
  while preserving its finite claims and activation state.

- `agent-messaging` 1.0.11 and `session-observer-collab` 1.0.36 require the
  versioned, content-bound Phase 3 observer composition capability, keep
  registration bound to the active activation's immutable controller across
  lease changes, and verify that inbox presentation and acknowledgment preserve
  both the real public observer offset and the private collaboration cursor.

- `agent-messaging` 1.0.8 closes Phase 2 fail-closed gaps: host output now
  revalidates activation and ownership after claims, Stop retries consume the
  newest explicit generation, human-idle renewal requires exact host evidence,
  observer leases and hook fingerprints validate their complete effective
  configuration, diagnostics remain confined to allowlisted records, live
  probes require quiescent abort and verified cleanup, and activation timestamps
  enforce the 24-hour cap on every read.

- `agent-messaging` 1.0.3 and `session` plugin 0.3.2 reject ancestor-symlink
  storage paths before reads or mutation, classify records relative to the
  configured root, and recover idempotently from interrupted collaboration
  creation while reporting generated recovery paths.
- `agent-messaging` 1.0.2 and `session` plugin 0.3.1 keep binding-cap winners
  readable, reject stale initial joins, replay takeover mail as actionable,
  contain rendered-log writes across ancestor symlinks, hash every
  authoritative record, and exercise real process-isolated publication and
  sender contention.
- `agent-messaging` 1.0.1 and `session` plugin 0.3.0 complete the maintained
  product inventories, validate every authoritative schema-v1 record, recover
  interrupted initial joins, enforce bounded writers and history output, add
  durable CLI reply references, report closure/takeover races and inactive exit
  states, harden rendered-log inspection, and expand adversarial/copied-runtime
  coverage.
- `session-observer` 1.0.70 reports the effective legacy tool-call and tool-result filters when opt-in activity suppresses duplicate conversation markers, and accounts for those suppressed entries; `session-observer-collab` 1.0.58 and `session-fork-to-destination` 0.2.35 receive the required observer-runtime closure update.
- `session-observer` 1.0.69 documents the watcher stat-failure split: missing paths (`ENOENT`/`ENOTDIR`) emit `WATCH_TRANSCRIPT_PATH_UNAVAILABLE` with scoped reset and re-arm guidance, while other failures such as `EACCES` emit `WATCH_TRANSCRIPT_STAT_FAILED`, preserve state, and require filesystem repair without reset. Cursor schema guidance now distinguishes terminal-settled stateful delivery from snapshot-scoped `pending-lifecycle` evidence in stateless review and export.
- `session-observer` 1.0.68 preserves the original error code and message when a live Claude Code or Codex watcher cannot stat its transcript for a reason other than `ENOENT` or `ENOTDIR`, and reserves path-reset guidance for actual missing-path failures; `session-observer-collab` 1.0.57 and `session-fork-to-destination` 0.2.34 receive the required observer-runtime closure update without changing their workflows.
- `session-observer` 1.0.64 budgets the final escaped activity Markdown emitted by review and watch text paths while retaining an explicitly labelled compact-JSON budget for JSON output; `session-export-transcript` 2.0.18 retains its Markdown-specific 64 MiB activity guard, and `session-observer-collab` 1.0.53 plus `session-fork-to-destination` 0.2.30 receive the required shared-runtime closure update.
- `session-observer` 1.0.63 and `session-export-transcript` 2.0.17 render recorded activity Markdown punctuation as inert data, including links, emphasis, strikethrough, fences and HTML, with adversarial export coverage for hidden instructions, reasoning, synthetic secret-like strings, oversized previews and unread external tails; `session-observer-collab` 1.0.52 and `session-fork-to-destination` 0.2.29 receive the required shared-runtime closure update without enabling activity in collaboration or fork previews.
- `session-observer` 1.0.62 retains activity-only watch deltas when byte limits omit every displayed event but delivered-range counts or omission accounting still prove activity; `session-observer-collab` 1.0.51 and `session-fork-to-destination` 0.2.27 receive the required shared observer runtime closure update without enabling collaboration activity.
- `session-observer` 1.0.60 rejects `--include-activity` before state mutation for unsupported Cursor delivery paths; `session-observer-collab` 1.0.49 and `session-fork-to-destination` 0.2.25 receive the required shared observer runtime closure update.
- `session-observer` 1.0.58, `session-observer-collab` 1.0.47, `session-export-transcript` 2.0.15, and `session-fork-to-destination` 0.2.23 keep activity reports within their serialized byte and displayed-invocation envelopes while preserving explicit metadata and evidence-group omission counts.
- `session-observer` 1.0.57, `session-observer-collab` 1.0.46, `session-export-transcript` 2.0.14, and `session-fork-to-destination` 0.2.22 preserve exact source snapshot and native argument evidence while keeping parse diagnostics and projected output bounded and content-free.
- `session-observer` 1.0.55, `session-observer-collab` 1.0.44, `session-export-transcript` 2.0.12, and `session-fork-to-destination` 0.2.20 retain a linked failed item's sole output preview when its exact-ID-linked result has no output carrier.
- `session-observer` 1.0.53, `session-observer-collab` 1.0.42, `session-export-transcript` 2.0.10, and `session-fork-to-destination` 0.2.18 keep Codex activity ownership unknown when child lineage or history boundaries are incomplete or conflicting, and classify the observed current task and asynchronous ask native names without broadening unknown-name matching.
- `session-observer` 1.0.51, `session-observer-collab` 1.0.40, `session-export-transcript` 2.0.8, and `session-fork-to-destination` 0.2.16 keep extractor exceptions distinct from malformed source input, locate Claude's record-level `toolUseResult` carrier once at its top-level source path, and preserve explicit interruption as cancelled evidence.
- `session-observer` 1.0.49, `session-observer-collab` 1.0.38, `session-export-transcript` 2.0.6, and `session-fork-to-destination` 0.2.14 harden Codex identity boundaries by binding persistent observer cache hits to subsecond filesystem identity, rejecting malformed present lineage fields in the first native header, and preventing transcript export from selecting an invalid native identity through marker or fallback paths.
- `session-observer` 1.0.48, `session-observer-collab` 1.0.37, `session-export-transcript` 2.0.5, and `session-fork-to-destination` 0.2.13 reject ID-less first Codex headers that precede native inherited headers, reject exact-pin ambiguity across distinct canonical Claude/Codex/Cursor sources while deduplicating path aliases, prefer Codex roots for unpinned export marker matches and marker-miss fallback, and fail stateful catch-up before delivery when saved state cannot be read. The observer release notes also cover the existing fail-closed missing-path watcher exit, marked-review state-read error, and transcript-shrink hard stop.
- `session-observer` 1.0.47 and `session-observer-collab` 1.0.36 document the native Codex identity and lineage boundary, Claude human versus runtime-notification provenance, fail-closed saved-position binding, and exact scoped reset/re-arm procedure; `session-fork-to-destination` 0.2.12 aligns its discovery regression with the first physical Codex header contract.
- `session-observer` 1.0.46, `session-observer-collab` 1.0.35,
  `session-export-transcript` 2.0.4, and `session-fork-to-destination` 0.2.11
  distinguish native Claude human input from runtime task notifications across
  observer rendering and ranking, collaboration continuation, transcript
  export, and fork previews.
- Codex transcript identity now uses the first physical `session_meta` header,
  corroborates recognized rollout filenames, and keeps root, direct-parent,
  fork, and inherited-history lineage separate (`session-observer` 1.0.45,
  `session-observer-collab` 1.0.34, `session-export-transcript` 2.0.3,
  `session-fork-to-destination` 0.2.10).
- `consensus-review` 0.1.12 rejects symlink and non-regular request files before opening them, and uses no-follow nonblocking open flags before bounded regular-file reads.
- `consensus-review` 0.1.11 binds the deterministic clean and all-severity receipt fixtures byte-for-byte to `renderReviewMarkdown`, so receiver evidence cannot drift from renderer output.
- Review host verification now treats a matching inherited parent as authoritative despite unrelated ambient markers, rejects explicit mismatches, and retains exact-single-marker verification when no parent is inherited (`consensus-review` 0.1.10, `create` 0.1.15, `decide` 0.1.15, `evaluate` 0.1.19, `panel` 0.1.12, `phone-a-friend` 0.1.11, `plan` 0.1.15, `refine` 0.1.18).
- Mixed host-marker shells now preserve explicit `CONSENSUS_PARENT_HOST` precedence and the established Claude → Codex → Cursor fallback priority, so recursion-depth child state remains enforced (`consensus-review` 0.1.9, `create` 0.1.14, `decide` 0.1.14, `evaluate` 0.1.18, `panel` 0.1.11, `phone-a-friend` 0.1.10, `plan` 0.1.14, `refine` 0.1.17).
- `consensus-review` 0.1.8 now publishes canonical and exported Markdown atomically without overwrite, reports diagnostic paths only after successful persistence, and bounds growing request-file reads to 256 KiB plus one detection byte.
- `consensus-review` 0.1.6 now rejects capture-to-baseline scope drift before dispatch, preserves bounded author provenance without presenting requested reviewer options as observed, supports file and document scopes without a first commit, records resolved Git and comparison identities, and writes one labeled diagnostic after final-result persistence failures.
- `consensus-review` 0.1.2 now fails closed when Codex capture paths resolve through symlinks, alias protected inputs, or reuse pre-existing targets, and when inherited consensus depth is malformed or out of range; source and copied-installed-bundle regressions cover both boundaries.
- The shared p06 provider-runtime hardening is propagated with explicit version impact to `create` 0.1.12, `decide` 0.1.12, `evaluate` 0.1.16, `panel` 0.1.9, `phone-a-friend` 0.1.8, `plan` 0.1.12, and `refine` 0.1.15.
- Generated-runtime and installation-owner reconciliation after the clean-break main merge updates `session-observer` 1.0.43, `session-observer-collab` 1.0.32, `session-export-transcript` 2.0.2, and `session-fork-to-destination` 0.2.8.
- Refine's peer-model forwarding tests no longer inherit the host markers of the process running the suite, so the built-in default peer order (`detectHost` puts the detected host first) is fixed rather than chosen by whether the runner is a Claude Code or Codex shell (`refine` 0.1.14).
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
