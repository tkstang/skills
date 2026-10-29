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
