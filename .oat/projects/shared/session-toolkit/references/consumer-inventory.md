# Session Toolkit consumer and state inventory

p01 read-only inventory, 2026-10-29. Skills baseline is phase base
`66b90a7d78f02fc0b5b73e9d24f70a2644743bdc`; ORC was inspected at
`/Users/tstang/Code/orc`, main `cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b`.
No transcripts were copied into this evidence. No production consumer changes in p01/p02/p03.
The [package contract](package-contract.md) and [command map](cli-command-map.md)
define the staged replacement boundary; the rows below identify actual owners,
not completed migrations.

## Authored Skills engine and consumers

All paths in this section are relative to the Skills repository. Generated
`skills/`, `plugins/*/skills/` and provider mirrors are outputs, not migration owners.

| Authored owner / entrypoint                                                                                             | Current responsibility                                                                                        | Toolkit destination and consumer work                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/transcript/runtimes.ts`                                                                                     | Provider discovery, metadata/tail/detailed reads, normalization, lineage and source carriers                  | p02 identity/discovery/read/parse primitives. Keep raw records, source generation, decoded and physical coordinates. Replaced source is removed only with verified consumers.       |
| `src/shared/transcript/cursor-frames.ts`, `cursor-analysis.ts`, `terminal-events.ts`, `activity/`                       | Cursor frame evidence, terminal events, activity extraction/correlation/usage/projections                     | p02 detailed substrate and p03 activity. Complete structured evidence must not inherit digest truncation. Terminal-attention/action policy remains consumer-owned.                  |
| `src/skills/session-observer/src/session-observer.ts` and `src/lib/{locate,rank,runtimes,observe,digest,evidence}.ts`   | Historical selection, review/digest, exact Codex evidence, provider reads                                     | Interactive calls use compatible `seshtk` operations in p04. Retain selection policy and state/control commands; bundle only required toolkit functions for unattended entrypoints. |
| `src/skills/session-search/src/` (`pipeline`, `adapters`, `options`, `redact`, `scan`)                                  | Stateless tiered search, widening, date/cwd scope, cost and redaction                                         | p03 search/estimate; p04 interactive prerequisite and command migration. Preserve regex/literal behavior, donor defaults and stdlib fallbacks.                                      |
| `src/skills/session-export-transcript/src/session-export-transcript.ts`, `sanitize.ts`                                  | Marker/cwd/runtime selection and sanitized Markdown with explicit tool opt-ins                                | p02 export primitives, p04 CLI migration. Preserve batch/marker workflows; sensitive activity is a separate projection.                                                             |
| `src/skills/session-fork-to-destination/src/{preview,guidance-discovery,guidance-cli}.ts`                               | Reads/shared provider facts for preview and guidance                                                          | p04 consume shared read primitives. `session-import.ts` native conversion/apply and destination writes remain consumer behavior.                                                    |
| `src/skills/session-observer-collab/src/lib/selected-prefix.mjs`                                                        | Observer digest, Cursor analysis and continuity for selected-prefix evidence                                  | p04 bundle the same authored toolkit functions. Leases, ownership, wake/control, continuity and delivery remain collaboration-owned.                                                |
| `src/skills/session-observer-collab/build.json` entrypoints                                                             | `codex-lifecycle`, `collab-control`, `claude-monitor`, Codex/Cursor stop hooks and supporting runtime modules | Offline self-contained bundles; no runtime CLI install, downloads or update checks. Verify every entrypoint's actual import closure.                                                |
| `src/skills/{session-handoff,session-retro,reorient,session-observer-collab,session-fork-to-destination}/` instructions | Route workflows to observer/export                                                                            | p04 update actual instructions and prerequisite checks, not only engine imports. Never silently fetch latest.                                                                       |

Detailed reads in `runtimes.ts` retain source byte size/capture time, raw
`sourceCarrier`, decoded `recordIndex`, one-based `physicalLine`, and generation
device/inode/prefix hash. Search and full activity need this substrate rather
than only rendered digest entries. Observer `maxTurns`/`maxBytes` bound rendered
tail output; its large-digest tail optimization is not a complete-evidence read.

Existing discovery limits are part of parity evidence: observer defaults include
50,000 entries, 512 MiB aggregate source, 256 KiB metadata and 30 seconds;
Cursor discovery independently bounds 20,000 entries, 2 seconds, 64 MiB and
5,000 retained candidates. p02 must expose coverage when these bounds stop work.

## State stays with consumers

| Owner / source                              | Existing persistence                                                                                                                               | Required preservation                                                                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Observer `src/lib/state.ts`                 | `$STATE_DIR` or `~/.local/state/session-observer`, `state.json`, locks/backups and mark-read/watcher state                                         | Keep formats, ownership and reset semantics; no toolkit shared state store.                                                                                                                  |
| Observer `src/lib/cursor-state.ts`          | Same root, `cursor-state.json` schema 2, continuity/delivery/recovery records and locks                                                            | Preserve frame coordinates, generation and per-session continuity. No silent offset conversion or destructive reset during migration.                                                        |
| Observer `src/lib/watch-state.ts`           | Same root, `watch.json`, lock, PID-targeted control files                                                                                          | Watch lifecycle, polling, wake/control and PID ownership remain observer behavior.                                                                                                           |
| Observer `src/lib/locate.ts`                | Same root, `codex-cwd-cache.json`                                                                                                                  | Ordinary discovery can currently cache cwd metadata; toolkit's stateless reads and exact identification do not inherit implicit cache writes. Keep any needed cache in the consumer adapter. |
| Collaboration `src/lib/lease-state.mjs`     | Absolute `$SESSION_OBSERVER_STATE_DIR`, otherwise `$XDG_STATE_HOME/session-observer/collab` or `~/.local/state/session-observer/collab`; `leases/` | Preserve leases and provider-specific continuity; no toolkit ownership/wake state.                                                                                                           |
| ORC `packages/cli/src/session-log-state.ts` | `$ORC_STATE_HOME` or `~/.orc`, `session-log/selection.json`, atomic temporary-file rename                                                          | Preserve provider/sessionId/externalId/transcriptPath/recordedCwd, offset nextRecordIndex/totalRecords/indexBase, selectedAt/updatedAt. Corrupt input is absent; real I/O errors propagate.  |

ORC's `packages/session-log/src/jsonl.ts` advances the source ordinal for a
nonblank malformed record. Skills detailed `recordIndex` counts successfully
decoded records, while `physicalLine` is separate. Cursor also has frame
coordinates. p02 exposes explicit independent coordinate kinds; p04/p05 adapt
existing saved positions without reinterpreting persisted integers. A material
state-contract redesign requires root realignment.

## ORC library, command and routed workflows

Paths here are relative to the inspected ORC checkout. These are p05 migrations;
p01 neither edits ORC nor changes its dependency/selection state.

| Current callsite                                                                                            | Current behavior                                                                                                                                                                                                           | Replacement / retained responsibility                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/session-log/src/index.ts` and `identity.ts`                                                       | Broad barrel; identify current transcript, locate by ID and revalidate exact evidence                                                                                                                                      | Intentional toolkit API imports for provider facts. Preserve message-free exact identification and post-probe revalidation. No ORC/private types exported from toolkit.   |
| `packages/session-log/src/{discovery,jsonl,providers,observe,sanitize}.ts`                                  | Candidate discovery, bounded JSONL/provider parsing, digest/cursor/projection/sanitization                                                                                                                                 | p02/p03 shared primitives with fixture parity; remove duplicated authored provider engine after consumers transition.                                                     |
| `packages/session-log/src/bridge.ts`, `terminal-attention.ts`                                               | ORC `RuntimeSessionObservation`, flags, unsafe-to-act and attention policy                                                                                                                                                 | Stay ORC, composing detailed toolkit results. Host adapters and core contracts also stay ORC.                                                                             |
| `packages/cli/src/commands/self-identify.ts`                                                                | Toolkit-like transcript facts plus Orca/T3 probes, git/host enrichment; revalidation after probes                                                                                                                          | Keep enriched `orc self-identify`; import shared exact evidence only.                                                                                                     |
| `packages/cli/src/commands/session-log.ts`: locate                                                          | Historical ranking                                                                                                                                                                                                         | `seshtk list`; never relabel ranked candidates as exact current identity.                                                                                                 |
| Same file: select                                                                                           | Selection persistence only with `--persist`                                                                                                                                                                                | Stateless CLI/API plus ORC-owned selection adapter. Concrete replacement interaction is p05 work; do not silently drop existing selection semantics.                      |
| Same file: read                                                                                             | Sanitized digest, default offset zero, page/record/message bounds and bridge                                                                                                                                               | `seshtk read`/library read plus ORC projection/bridge, with explicit coordinate adaptation.                                                                               |
| Same file: catch-up                                                                                         | Explicit from-offset (including zero) wins; otherwise saved offset only for matching provider/externalId; refuses persistence for record-bounded or remaining-page results                                                 | ORC adapter composes stateless reads and persists only at equivalent safe completion boundaries, retaining revalidation. No duplicate toolkit catch-up command.           |
| Same file: export                                                                                           | Sanitized explicit-file export                                                                                                                                                                                             | `seshtk export` or public library projection; preserve destination boundaries.                                                                                            |
| Same file: forget                                                                                           | Idempotently deletes only ORC selection state, including corrupt files                                                                                                                                                     | Consumer-owned selection removal; never transcripts. Resolve caller routing before removing generic namespace.                                                            |
| `src/skills/orc/references/reading-agent-sessions.md` and `skills/orc/references/reading-agent-sessions.md` | Historical/catch-up/watch routes use external session-observer. Native recent reads only for exact eligible targets; no mutation to resolve selection                                                                      | Update canonical Skills routing plus generated views. Replacing `orc session-log` alone does not migrate these workflows.                                                 |
| ORC `orc-cli`, `orca-orchestration`, `ghostex-orchestration`, `collaborative-project` instructions          | Observer-based session-reading guidance                                                                                                                                                                                    | Inventory exact active references during p05 and update them with the shared command/prerequisite contract.                                                               |
| `src/skills/orca-morning-triage/src/lib/config.ts` and `sessions.ts`                                        | Local/remote default `~/.agents/skills/session-observer/scripts/session-observer.mjs`; calls `review --json --runtime ... --cwd ... --max-turns 6`, optional qualified session, through local Node or remote SSH `zsh -ic` | Migrate actual automation argv, host prerequisite and timeout/snapshot contracts in p05. Generated `skills/orca-morning-triage/scripts/triage.mjs` is not authored owner. |

Before removing generic `orc session-log`, verify replacements for all six
operations, actual skill routes and direct automation. Preserve ORC's 24-hour
`minimumReleaseAge` dependency hold; a local uncommitted tarball override is only
prepublication integration evidence, never a release dependency.

## Distribution and version-impact handoff

`src/distributions.ts` is authoritative. Observer outputs are standalone
and consensus-plugin observer.
Collaboration is standalone and consensus-plugin; export, search and fork are
standalone and session-plugin. Handoff, retro and reorient also have standalone
and session-plugin outputs. A changed import closure or instructions requires
the affected canonical skill's sole `metadata.version` bump, changelog and
regenerated payloads. Exact release versions are chosen with the p04 diff,
not guessed from this inventory. Both session and consensus plugin releases
must be evaluated against their actual changed payloads.

p04 must extend package-source version-impact detection to every bundled
consumer closure. Existing checks must not miss an unchanged skill directory
whose bundled package source changed. Amend the dependency/no-install governing
instructions before interactive cutover, and revise the relevant parts of
DR-260514-session-observer-is-standalone and DR-260604-shared-transcript-knowledge
through the decision workflow. Preserve plugin grouping and build-time rewrite
contracts. p01 adds no dependency to an existing production skill and changes no
canonical skill version.

## Release prerequisites and review anchors

Toolkit uses independent SemVer and `session-toolkit-vX.Y.Z` tags. Validation CI
has no publisher/OIDC authority. p04 must prepare one reviewed archive and
publish exactly those bytes, recording integrity and installed acceptance.

Root's read-only prerequisite checks found GitHub ADMIN access to both repos;
Skills allows squash merges only, ORC squash/rebase. Retain the project branch
and merge main back after squash merges to preserve earlier phase heads; p04
records concrete branch/review anchors before release actions.

Host npm `whoami` returned `ENEEDAUTH`; anonymous package lookup returned E404.
Neither establishes scope publishing rights. No npm token environment variable
was present, Skills Actions secrets were empty, and only github-pages environment
was configured. First publication still needs maintainer authentication/2FA via
the host secret mechanism. Subsequent publication needs verified package-specific
trusted-publisher/workflow/environment configuration, Node 24/npm >=11.5.1 and a
protected publish job. Missing bootstrap auth is a p04 prerequisite, not p01
publication evidence. See `RELEASING.md` for the executable release checklist.

Independent explicit-range p04 release/migration reviews precede each merge or
publication. p05 independently reviews the ORC range in its own checkout and
records checkout/base/head/PR/artifact/dispositions for final integrated review.
No package publication, tag, consumer cutover or live-provider certification is
claimed by this inventory.

## p02 staged package ownership

`packages/session-toolkit/src/` now owns its independent runtime closure:
`provider-runtime.ts` (Skills transcript runtime), `identity.ts` (ORC exact
identity plus Skills lineage/env knowledge), bounded `reader.ts`/`discovery.ts`,
`evidence.ts` (observer evidence without digest/state), `sanitize.ts`/`export.ts`,
and the activity/cursor/terminal closure needed by evidence/page summaries.
All package imports resolve within the package or Node/Commander. Donors remain
read-only and continue serving their consumers until p04/p05; this is temporary
staged duplication, not completed consolidation or a consumer cutover.
[Parity and intentional dispositions](p02-parity.md) identify extraction tests
and preserved consumer-specific policies. Search/full activity remain p03.

## p03 staged ownership handoff

Package `search-*.ts` now owns the extracted search projections, adapters,
accelerator/fallback pipeline, options, classification and redaction, alongside
`search.ts` public query validation. They import package `provider-runtime.ts`
and `sanitize.ts`, not donor source. Full activity uses the existing package
extractors/correlation and source reader; page summaries share that extraction
function. There is one normalization/activity engine inside the package. Donor
search/shared source still serves current Skills consumers and remains unchanged
until verified p04 migration removes duplication.

Public replacements: `searchSessions`/`estimateSearch` and
`captureActivity`, or `seshtk search`, `search estimate`, `activity`. The raw
activity response is sensitive, not an ORC observation/action-policy type.
Search accelerator environment controls are `SESHTK_SEARCH_*`; p04 must update
real callers/instructions rather than install legacy aliases. Cursor's structured
activity supports recorded frame calls and turn lifecycle, with explicit gaps
for results/per-call outcomes/usage. No state formats or ORC consumers change.

Updater code is reachable from the package bin only. Interactive checks own
24-hour update metadata under the cache directory; this is not selection/watch
state. Library imports, future bundled engine functions and machine/hook
contexts perform no lookup. New package source remains staged and unpublished.
