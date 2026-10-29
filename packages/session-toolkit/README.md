# @tkstang/session-toolkit

A typed ESM library and the `seshtk` CLI for exact current identity, historical
session discovery, bounded transcript reads and sanitized Markdown export.
Supports Claude Code, Codex and Cursor. Exact cutoff/expansion evidence currently
supports Codex. Search, full activity commands and update notices are reserved
for the next phase and are absent from capabilities.

Requires Node **22.0.0 or later**; the same archive is checked on Node 22.0.0
and 24. Runtime dependencies are installed by npm. Existing Skills and ORC
consumers retain their engines until their migrations are verified.

## Install and inspect

This checkout is unpublished. After publication, select the approved version:

```sh
npm install --global @tkstang/session-toolkit@<approved-version>
seshtk --version
seshtk --help
seshtk capabilities --json
npx --package=@tkstang/session-toolkit@<approved-version> seshtk capabilities --json
```

Developers can install a validated tarball. Interactive consumers must check the
version and required capability IDs; unattended hooks remain self-contained.

## Library

```js
import {
  getCapabilities,
  identifyCurrentTranscript,
  listSessions,
  parseTranscript,
  readTranscript,
  readEvidence,
  exportMarkdown,
} from '@tkstang/session-toolkit';

const capabilities = getCapabilities(); // pure, no I/O
const identity = await identifyCurrentTranscript({ cwd: process.cwd() });
const historical = await listSessions({ cwd: process.cwd(), runtime: 'auto' });
const page = await parseTranscript({
  runtime: 'codex',
  path: '/explicit/transcript.jsonl',
  maxRecords: 100,
});
// Qualified native identity; historical selection never establishes "current".
const selected = await readTranscript({ session: 'codex:<native-id>' });
const evidence = await readEvidence({ session: 'codex:<native-id>' });
await exportMarkdown({
  session: 'codex:<native-id>',
  out: '/new/transcript.md',
});
```

The package root is the only export path. Additional value exports are
`revalidateCurrentTranscript(previous, options)`, `renderTranscriptMarkdown(page)`
(a pure projection), and `ToolkitError`. Public option/result types include
`CurrentTranscriptOptions`, `CurrentTranscriptIdentity`, `DiscoveryOptions`,
`DiscoveryResult`, `SessionCandidate`, `StoreContext`, `ReadOptions`,
`SessionReadOptions`, `TranscriptPage`, `SourceRecord`, `ReadDiagnostic`,
`EvidenceOptions`, `ExportOptions`, `ExportResult`, `Provider`, `ErrorCode`,
`Capabilities`, `CapabilityId`, and `Envelope<T>`. Declarations also describe the
inferred exact-evidence result. Internal parser/activity helpers are not APIs.

Library imports do not parse arguments, resolve stores, perform network access,
write state or exit. Calls accept explicit inputs; discovery/read/export accept
`homeDir` and optional per-provider `storeRoots` for isolated stores. Exact
identity accepts `homeDir` and `env`. Only `exportMarkdown` writes destinations.

## CLI

```sh
seshtk self-identify --cwd /repo --json
seshtk list --runtime auto --cwd /repo --limit 100 --json
seshtk read --session codex:<native-id> --max-records 100 --json
seshtk parse /explicit/transcript.jsonl --runtime cursor --max-bytes 4000000 --json
seshtk read --session codex:<native-id> --evidence --json
seshtk export --session claude-code:<native-id> --out /new/conversation.md --json
seshtk export --runtime auto --cwd /repo --match 'visible marker' --out /new/match.md
seshtk export --runtime auto --cwd /repo --all --out /new/batch --json
```

All commands accept `--json`; capabilities always emits JSON. Machine mode emits
exactly one newline-terminated envelope, including help/version:
`{ok:true,schema_version:1,data:...}` or
`{ok:false,schema_version:1,error:{code,message,hint,details?}}`. Diagnostics go to
stderr. Plain reads print conversation; other plain operations print structured
JSON. No arguments prints help. No prompts, color or automatic network checks.

Exit codes are 0 for an interpretable result (including partial coverage), 1 for
usage/selection action, and 2 for I/O/unexpected failure. Codes are `E_USAGE`,
`E_AMBIGUOUS`, `E_UNAVAILABLE`, `E_CURSOR_INVALID`, `E_SOURCE_CHANGED`, `E_IO`,
`E_INTERNAL`. Exact CLI identity refuses ambiguity/unavailability; its error
`details` retains structured evidence. Library identity returns that status.
No cwd/recency winner is relabeled exact identity. Parent/root/grouping IDs never
substitute for native identity; Codex parent env values alone are insufficient.

Implemented IDs: `toolkit.capabilities.v1`, `cli.help.v1`, `cli.version.v1`,
`identity.current.v1`, `sessions.list.v1`, `transcript.read.v1`,
`transcript.parse.v1`, `transcript.evidence.codex.v1`, `export.markdown.v1`.
Providers are `claude-code`, `codex`, `cursor`; evidence capability is Codex only.

## Coordinates, bounds and evidence

`list` is historical, with metadata/layout provenance, finite scanning budgets,
omissions and coverage. CLI list defaults to invocation cwd; library callers can
omit cwd for global history. `--since`/`--until` accept relative `Nh`/`Nd`/`Nw`,
today/yesterday, calendar dates and ISO times. Upper calendar dates include the
whole local day. Prefer zoned ISO times in automation. Missing stores are empty;
inaccessible or bounded scans report incomplete coverage.

`read` resolves an explicit `<provider>:<native-id>`; `parse` accepts a file and
explicit provider without discovery. Raw records/carriers remain intact.
`physicalLine` is one-based; `recordIndex` counts decoded objects from zero.
Claude/Codex `sourceOrdinal` counts nonblank source records, including malformed
records; Cursor counts JSONL frames, including blank/malformed frames. Source
byte bounds and diagnostics remain separate. Cursor delivery `recordIndex`
points to the terminal record; `sourceRecordIndex` points to the message origin.

`--from-offset` defaults to zero in the declared provider source coordinate.
Opaque `--cursor` conflicts with offset and binds path, runtime, generation and
projection. Any append/replacement invalidates ordinary cursors. Reads check for
source changes and never persist offsets. `--max-bytes` defaults to 4,000,000
source bytes; optional positive `--max-records`/`--max-messages` combine. Whole
records are consumed, so one record can exceed a message limit. Inspect
`coverage`, `nextOffset`, `nextCursor`, `bytesRead` and diagnostics; a bound is
never evidence of complete history. Valid but unclosed Cursor frames wait for a
newline; malformed/unclosed tails retain resumable diagnostics.

Conversation messages are projections of each captured page. Cursor messages
require captured terminal events; a page starting mid-turn cannot reconstruct
prior-page buffered messages. Raw records remain available for consumer-owned
continuity. `--include-tool-calls` and `--include-tool-results` are independent;
previews retain donor caps (200/500 characters). `--include-activity` adds a
separate page summary and usage/coverage, not complete full-session activity.

Codex `read --evidence` requires JSON and conflicts with ordinary cursor/offset.
`--cutoff <token>` freezes a captured prefix across appends, bound to file
identity and prefix hash; replacement/prefix mutation refuses. `--expand <ref>`
requires cutoff; `--related` requires expand and includes at most 16 events.
`--expand-offset <n>` selects a byte offset within a redacted field and conflicts
with related. Redaction runs before windows; tool evidence is derived from
recorded data, not reconstructed missing output. Source capture bounds/coverage
are explicit; evidence has a 16 MiB capture ceiling. Unsupported providers refuse.

## Export safety

Exact session selection conflicts with marker/batch selection. Historical
selection refuses ambiguity and marker misses. `--all` writes the explicitly
bounded candidate set and reports discovery coverage. Outputs use exclusive new
file creation; existing files and symlinks are never overwritten. Batch names
are provider-qualified and confined to the chosen directory. Tool opt-ins remain
independent; activity is rendered as counts, without raw activity payloads.

Sanitization removes hidden instruction and control payloads. It is **not a
credential audit**: visible conversation/tool text may contain sensitive data.
Review Markdown before sharing. Raw records and structured evidence are sensitive
and have no general shareability guarantee. No selection, watch, delivery or
consumer state is owned by this package.

## Development

From the root: `pnpm run build:toolkit`, `pnpm run type-check`, and
`pnpm run test:vitest tests/release/session-toolkit-*.test.ts`.
Toolkit SemVer and `session-toolkit-vX.Y.Z` tags are independent of skill/plugin
releases. On Node 24, run `pnpm run release:toolkit:dry-run --out <new-directory>`.
The validator inspects packed paths/dependencies, installs outside the checkout,
proves import safety, and runs fixture API/CLI operations. Recheck those exact
bytes with `pnpm run toolkit:pack:check --archive <tarball> --node <node-path>`.
No publication occurs; see root `RELEASING.md` for publication prerequisites.

## Historical search

```sh
seshtk search -p 'deployment.*failed' --runtime codex --cwd ~/Code/project --json
seshtk search estimate -p 'deployment.*failed' --json
```

`searchSessions({ patterns: ['deployment.*failed'], runtime: 'codex' })` and
`estimateSearch` provide the same stateless operations to library callers.
Patterns are case-insensitive regexes by default; `--literal` matches text.
Repeat `-p` and `--cwd` as needed. Cwd hints widen to other sessions if they
find no matches. `--since`/`--until` use the time syntax described above.
History, metadata and content tiers run in canonical order; `--tiers` selects
those tiers. A final tool-output pass runs when earlier tiers find nothing;
`--no-deep` disables it and `--include-tools` includes tools immediately.

Defaults:15 returned sessions,65,536 bytes per decoded line,2,147,483,648
estimated bytes before explicit scan authorization, no deadline. Set
`--deadline-ms`, `--max-line-bytes`, `--limit` or `--large-scan-bytes` to change
these bounds. `E_SCAN_CONFIRMATION` (exit1) reports the estimate and requires
`--allow-large-scan`; it never prompts. No matches returns an empty result
(exit0). `incomplete`, source status and diagnostics expose deadlines, malformed
records and oversized lines. Results are ranked bounded evidence, not an
exhaustive index. Snippets redact complete units before windowing. Search reads
raw classified records, including full tool fields, rather than digest previews.

Optional `rg`/`sqlite3` accelerators are discovered from PATH and common system
locations. The Node fallback preserves transcript search; unavailable sqlite
metadata is reported when applicable. Use `SESHTK_SEARCH_NO_RG=1` or
`SESHTK_SEARCH_NO_SQLITE3=1` to disable them, `SESHTK_SEARCH_RG` and
`SESHTK_SEARCH_SQLITE3` for explicit executable paths, and
`SESHTK_SEARCH_PROBE_TIMEOUT_MS` for probe timeout (default3000,clamped500–60000).
These controls belong to Session Toolkit; no legacy search environment aliases
are installed. The library accepts explicit `home` and `env` for isolated stores.

## Sensitive activity

```sh
seshtk activity --session codex:<native-id> --json
seshtk activity --session claude-code:<native-id> --out ./activity.json --json
```

Library: `captureActivity({ session: 'codex:<native-id>' })`. The response is
sensitive structured evidence, **not sanitized or shareable Markdown**. It
retains full raw captured records (including instruction carriers), raw tool
arguments/results, correlations, usage when recorded, provenance and source
coordinates. The activity events select supported tool/item/metadata facts;
the raw records preserve other provider detail. No preview caps apply.

All three providers support captured activity. Cursor uses frame extraction:
recorded calls and turn lifecycle are available; individual call results,
per-call outcomes and usage are not recorded on this surface. `support` and
coverage state these gaps explicitly. Raw Cursor records remain available.
Claude/Codex correlate recorded calls/results and retain usage semantics without
inventing missing data. External persisted outputs and child trajectories are
reported as not read; payload paths are never followed.

Read bounds and generation-bound continuations work as for `read`; default source
budget is4,000,000 bytes. `sourceRead.coverage.fullSource` requires coverage from
byte zero to the captured end with no diagnostics. A bounded page or continuation
can omit earlier correlation context; its raw source coordinates remain intact.
`sourceRead.records` exposes source ordinals, decoded ordinals, physical lines,
byte ranges and Cursor frame indices independently. Cursor event locators retain
source and terminal delivery frame coordinates. `--out` creates a new JSON file
exclusively and refuses existing destinations; without it the capture is returned
in the CLI response. Consumers own offsets and watch/selection state.

## Update notices

Successful interactive operations check for newer stable releases, at most once
per24 hours, and print a notice on **stderr**. Both stdin and stderr must be
TTYs. `--json`, bare `capabilities`, help/version, CI and non-TTY invocations
perform **zero update network lookups** and print no notice. Set
`SESHTK_NO_UPDATE_CHECK=1` to disable checking explicitly. Library imports and
bundled library functions cannot invoke this CLI-only updater; unattended hooks
need no network access.

The cache is `$XDG_CACHE_HOME/session-toolkit/update.json` or
`~/.cache/session-toolkit/update.json`. Lookup failures are cached for24 hours
and never fail a session operation. Malformed/expired caches are refreshed.
The registry request has a1-second timeout; only stable SemVer releases newer
than the installed version trigger a notice. No automatic upgrade runs. The
notice gives an explicit-version installation command; stdout remains the
requested operation's output.
