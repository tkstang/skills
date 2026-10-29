# Session Toolkit: proposed CLI command and argument map

This is a design aid for the approved brief, requested by the user. **No commands below are implemented yet.** p01 settles the exact syntax, option support/defaults, mutual exclusions, units, capability identifiers, exit codes, and versioned JSON schemas against the donor inventory. A flag shown here is a proposed spelling; it is not an additional accepted feature or a compatibility alias. Existing capabilities remain the parity target even if p01 chooses a different spelling.

## Usage tree

```text
seshtk [--json] <command> [arguments] [options]
│
├── self-identify [--cwd <path>]
│   └── Exact current identity, lineage, ambiguity/unavailability
│
├── list [--runtime <provider|auto>] [--cwd <path>]
│        [--session <provider:id>] [--since <time>] [--until <time>]
│   └── Historical candidates; ranking does not establish current identity
│
├── read --session <provider:id> [read-options]
│   └── Explicit session records; optional explicit offset/cursor
│
├── parse <transcript-path> --runtime <provider> [read-options]
│   └── Parse a caller-selected file without discovery
│
├── search -p <pattern>... [search-options]
│   └── Ranked stateless search; repeat -p for multiple patterns
│   └── estimate -p <pattern>... [search-options]
│       └── Estimate the candidate scan before authorizing a large scan
│
├── export --session <provider:id> --out <path> [export-options]
│   └── Sanitized conversational Markdown; tool inclusion is explicit
│
├── activity --session <provider:id> [activity-options]
│   └── Structured evidence and coverage; sensitive, not publish-safe
│
├── capabilities --json
│   └── Versioned machine-readable supported operations/providers
│
├── --help       (also <command> --help)
└── --version
```

`provider` denotes Claude Code, Codex, or Cursor. Donor spellings are `claude-code`, `codex`, and `cursor`; p01 settles whether provider IDs and runtime IDs are identical. `<provider:id>` qualifies an exact identity without confusing sessions that share an unqualified ID. Angle brackets are value placeholders; brackets denote optional arguments. Ellipsis after `-p` denotes repetition, not shell syntax. These are one-shot operations; invoking them does not mark a session read or persist a selection.

## Option groups and behavior

| Command/group               | Proposed arguments and flags                                                                                                                                           | Contract to preserve / p01 decision                                                                                                                                                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Common boundary             | `--help`, `--version`, `--json`                                                                                                                                        | Help exposes usage, defaults, value types and exits. Machine operations emit one stable JSON envelope on stdout; diagnostics use stderr. p01 settles command/global flag placement and exact exit meanings. Respect `NO_COLOR`.                                                                        |
| Exact identity              | `self-identify [--cwd <path>] [--json]`                                                                                                                                | Harness evidence, ambiguity and lineage; cwd can scope/revalidate evidence but never promote a historical heuristic to exact identity. No host/git/live-probe enrichment in toolkit.                                                                                                                   |
| Discovery filters           | `list --runtime <provider                                                                                                                                              | auto> --cwd <path> --session <provider:id> --since <time> --until <time>` (each optional)                                                                                                                                                                                                              | Bounded historical enumeration and candidate provenance. p01 defines filter combination, timestamp interpretation, limits/pagination and empty-result semantics.                                                                                                         |
| Read/file input             | `read --session <provider:id>`; `parse <transcript-path> --runtime <provider>`                                                                                         | Explicit source, detailed records and source coordinates. p01 settles output projections, provider/path validation, sensitive fields/redaction and structured output; detailed provider evidence must remain available to search/activity through the library.                                         |
| Read bounds                 | `--from-offset <n>`, `--cursor <token>`, `--max-records <n>`, `--max-messages <n>`, `--max-bytes <n>`                                                                  | Explicit bounds/resume inputs, accounting, malformed/incomplete tails and coverage. Offset units and offset/cursor conflicts are deliberately unresolved. No hidden consumer read-state writes. Not every bound applies to every provider/projection.                                                  |
| Read projections            | `--include-tool-calls`, `--include-tool-results`, `--include-activity`                                                                                                 | Explicit opt-ins with bounded projections and declared coverage. p01 settles names, supported combinations and safe defaults from donor behavior. A digest cannot replace the detailed evidence model.                                                                                                 |
| Search query/scope          | repeatable `-p <pattern>`, `--literal`, repeatable `--cwd <path>`, `--runtime <provider                                                                                | auto>`, `--since <time>`, `--until <time>`                                                                                                                                                                                                                                                             | Preserve current regex/literal semantics and widening. Search cwd is a widening hint; do not silently make it an exact-only filter.                                                                                                                                      |
| Search stages               | `--tiers <history,meta,content>`, `--no-deep`, `--include-tools`                                                                                                       | Preserve stateless history → metadata → content → deep/tool search and source-attributed results. p01 documents tier interactions; no positional-query alias is implied.                                                                                                                               |
| Search cost/output          | `--allow-large-scan`, `--large-scan-bytes <n>`, `--max-line-bytes <n>`, `--limit <n>`, `--deadline-ms <n>`, `--json`                                                   | Preserve estimate/confirmation, redaction, bounded scan behavior and partial/deadline outcomes. CLI can report that explicit authorization is needed without prompting in machine mode.                                                                                                                |
| Safe export                 | `--session <provider:id>`, `--out <path>`, `--include-tool-calls`, `--include-tool-results`, `--include-activity`                                                      | Sanitized Markdown is the default artifact. Exact tool/projection flags and defaults settled in p01; activity summaries do not imply complete sensitive evidence is safe to publish.                                                                                                                   |
| Export historical selection | `--runtime <provider                                                                                                                                                   | auto>`, `--cwd <path>`, `--match <marker>`, `--all`                                                                                                                                                                                                                                                    | Preserve donor candidate/marker/batch workflows somewhere in the migrated workflow. p01 decides which selectors belong on export versus list + explicit selection and how batch output destinations work; do not require `--session` when using a validated alternative. |
| Activity/evidence           | `--session <provider:id>`, `--out <path>`, `--json`; proposed evidence controls `--evidence`, `--cutoff <token>`, `--expand <ref>`, `--related`, `--expand-offset <n>` | Preserve source attribution, usage, coverage and detailed expansion. Existing exact Codex evidence controls are provider-specific; p01 settles whether they live on read or activity, which providers support them, output destinations and invalid combinations. Complete activity remains sensitive. |
| Prerequisite discovery      | `capabilities --json` plus `--version`                                                                                                                                 | Skills check supported version and capabilities, not executable presence/help alone. Public capability/schema identifiers are fixed in p01.                                                                                                                                                            |
| Update notices              | No new flag spelling selected                                                                                                                                          | Interactive CLI only: cached best-effort registry checks and stderr notices; no auto-upgrade. No notices or automatic checks for `--json`, hook or other machine execution. p01/p03 settle detection, cache lifetime and any explicit opt-out/environment interface.                                   |

This layout does **not** select shared `select`, `forget`, `state`, `watch`, `watch-ctl`, or `--persist` operations. Observer keeps watch/control and read-offset state. ORC keeps its host/state responsibilities; p01/p05 must map existing select/catch-up/forget callers before generic command removal. Stateless `read` inputs can support those workflows without a new shared state store. Existing consumer behavior and state formats remain the acceptance baseline.

## Proposed invocation examples

These illustrate shape, not copy-ready release instructions. Replace `<approved-version>`, IDs and paths after p01; use controlled fixture files in verification.

```sh
npx --package=@tkstang/session-toolkit@<approved-version> seshtk --version
seshtk capabilities --json
seshtk self-identify --json
seshtk list --runtime codex --cwd /path/to/project --json
seshtk read --session codex:<id> --max-records 100 --json
seshtk parse /path/to/fixture.jsonl --runtime codex --json
seshtk search -p 'release contract' --literal --cwd /path/to/project --json
seshtk search estimate -p 'release contract' --literal --json
seshtk export --session codex:<id> --out /path/to/transcript.md
seshtk activity --session codex:<id> --out /path/to/sensitive-activity.json --json
```

## Evidence and final documentation handoff

The inventory was read-only; no live transcript contents were accessed. Evidence paths are donor locations, not public install prerequisites:

- Skills identity/discovery/read/watch/evidence entrypoint: `src/skills/session-observer/src/session-observer.ts` (identity near 534, discovery/read near 485–509, watch near 576–604, exact evidence near 2272). Persistent offsets: `src/skills/session-observer/src/lib/state.ts`.
- Skills search/estimate: `src/skills/session-search/src/session-search.ts:26` and `:192`.
- Skills export/activity: `src/skills/session-export-transcript/src/session-export-transcript.ts:260`, `:306`, `:1634`.
- ORC donor checkout: `/Users/tstang/Code/orc`; `packages/cli/src/commands/session-log.ts` (help near 731, read near 363, catch-up near 451, export near 585) and `packages/cli/src/session-log-state.ts` (selection/resume ownership). Enriched identity: `packages/cli/src/commands/self-identify.ts:24`.
- Foundations CLI boundary guidance: `conventions/archetype.md:55` and `conventions/code-style.md:33` in `/Users/tstang/Code/foundations`. Commander command factories/boundary validation may take intentional package dependencies; self-contained shipped hooks remain a separate distribution contract.

p01 replaces unresolved proposals with an intentional contract. p05 reconciles this map and the plan diagrams against built `--help`, capabilities and library exports, and maps the final coverage to published documentation. The canonical consumer reference belongs under `documentation/docs/user-guide/`, linked from existing Session pages; architecture/API/distribution/release guidance belongs in Engineering. Existing skill-specific pages retain workflow context and link the shared command reference. Package README and ORC docs describe their real entrypoints. No draft flag is documented as shipped merely because it appears here.
