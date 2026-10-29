# Session Toolkit package contract

Selected during p01 on 2026-10-29 against the approved brief, Foundations CLI
conventions and the [consumer inventory](consumer-inventory.md). This is the
implementation handoff for later phases, not a claim that their operations ship
in 0.1.0. The [command map](cli-command-map.md) separates present support from
reserved operations. Publication and consumer cutover remain p04/p05 work.

## Package and runtime

- One public ESM package: `@tkstang/session-toolkit`, with one bin, `seshtk`.
  The private root and `packages/session-toolkit` are the entire pnpm workspace;
  `documentation/` retains its own package manager context and lockfile.
- Node **22.0.0** is the declared consumer floor; Node 22 and 24 are supported.
  Current runtime APIs are plain ESM, process streams and pure object creation.
  Commander 14.0.3 requires Node >=20 and has no runtime dependencies of its own.
  esbuild targets `node22.0`; TypeScript checks ES2022 with Node 22 declarations.
  No newer `node:sqlite`, native TypeScript or JSON-import runtime support is
  required: the build embeds package metadata. The same packed bytes were
  exercised on actual v22.0.0 and v24.21.0.
- Commander is an intentional runtime dependency of the installed public CLI.
  Boundary guards are currently tiny (Commander validates options/arguments);
  add structured domain validation when operational inputs arrive. This does
  not alter the dependency-free, self-contained shipped hook contract.
- Toolkit SemVer is independent of skill and plugin versions. Tags use
  `session-toolkit-vX.Y.Z`; existing payload `vX.Y.Z`, `session-v*` and
  `consensus-v*` streams keep their meanings. No executable aliases are selected.

## Public library surface

0.1.0 exports only the package root. It exports the pure function
`getCapabilities(): Capabilities` and types `Capabilities`, `CapabilityId` and
`Envelope<T>`. `dist/*` subpaths, CLI factories and the bin are not exported.
Importing the API neither runs a CLI nor parses arguments, scans stores, performs
network access, writes state or exits the process. The bin alone sets exitCode.
Type declarations accompany the same ESM API checked by clean installs.

The capability object has `package`, `version`, `schema_version: 1`, `node`,
`capabilities` and `providers`. Current capability IDs are exactly
`toolkit.capabilities.v1`, `cli.help.v1`, `cli.version.v1`; providers is `[]`.
The function creates a fresh object/arrays, so caller mutation cannot change
later discovery results. Consumers check an acceptable package version **and**
required IDs. Absence means unsupported; help text is not capability evidence.

Later phases add deliberate public functions only when they have donor parity
proof. The selected operation boundaries are current identity, candidate listing,
bounded detailed transcript reads, explicit-file parsing, stateless search and
estimate, sanitized export and rich activity extraction. Do not export every
parser helper, search stage, matcher or ORC type through a wildcard barrel.
No consumer state store, watch loop, policy engine or ORC dependency enters this
package. Concrete operational types are added with their implementations;
placeholder functions and speculative type-only export inventories are absent.

Detailed evidence is the common substrate, not a conversation digest. Preserve
raw provider records/carriers, captured source size/time/generation, one-based
physical lines, decoded record coordinates, provider source/frame ordinals,
byte bounds, malformed/incomplete diagnostics, lineage, usage and coverage.
Retain independent source and decoded ordinals where malformed records make
them differ. A parent/root/grouping ID never substitutes for a native thread ID.
Conversation, safe export, search snippets, digest and activity are distinct
projections. Do not feed search or complete activity solely from a lossy digest.

Library reads receive explicit operation inputs and optional environment/store
context; imports never resolve stores. Domain results discriminate successful,
partial, ambiguous and unavailable evidence with machine-readable codes.
Provider-specific coordinates and generation-bound cursors remain explicit;
no universal integer silently replaces existing consumer offsets. Future hooks
bundle only the functions they need from this authored package source, without
pulling Commander or interactive version-check behavior into their closure.

## CLI envelope and outcomes

All `--json` operations emit exactly one newline-terminated JSON object on stdout.
Diagnostics use stderr. Help/version are successful operations, including
`--help --json`, `<command> --help --json` and `--version --json`.
`capabilities` always emits the envelope even without `--json`. No arguments
prints help and succeeds. Unknown commands/options and excess arguments fail
with usage rather than silently selecting another operation. No prompts or color
are used; `NO_COLOR` is respected by construction.

```json
{ "ok": true, "schema_version": 1, "data": {} }
```

```json
{
  "ok": false,
  "schema_version": 1,
  "error": {
    "code": "E_USAGE",
    "message": "...",
    "hint": "Run seshtk --help for available commands and options."
  }
}
```

Exit `0` means the requested operation returned an interpretable result, `1`
means user action is needed, `2` means an unexpected system failure. Current
error codes are `E_USAGE` and `E_INTERNAL`. Later operational codes are reserved
as `E_AMBIGUOUS`, `E_UNAVAILABLE`, `E_SCAN_CONFIRMATION_REQUIRED`,
`E_CURSOR_INVALID`, `E_SOURCE_CHANGED` and `E_IO`; they are **not** current
0.1.0 `Envelope` members or advertised capabilities. Usage and domain selection
refusals exit 1; unexpected I/O/system failures exit 2. Successful empty lists
or no-match searches exit 0 with empty results. A bounded/deadline partial result
exits 0 and explicitly carries incomplete coverage and the reason; it cannot be
mistaken for exhaustive success. An exact identity operation must expose
ambiguity/unavailability, never choose a heuristic winner.

Envelope schema v1 fixes `ok`, `schema_version`, `data`/`error` and the required
error `code`, `message`, `hint`. An operation's schema/capability ID versions its
payload semantics; new operations and error codes arrive with their typed
implementations. Provider-native raw payloads retain their original keys.
Errors do not dump environment variables, provider content or credentials.

## Selected operational contract (not implemented in p01)

Provider IDs and runtime IDs are the same: `claude-code`, `codex`, `cursor`.
`auto` selects stores for discovery/search; it is not a provider or an exact
identity. Session selectors use `<provider>:<native-id>`, with the provider
validated and a nonempty native ID. No unqualified-ID alias is selected.
Relative paths resolve against invocation cwd; `~` expansion is explicit in
path options. Date/time bounds use the existing search contract: positive
`Nh`, `Nd`, `Nw`, `today`, `yesterday`, `YYYY-MM-DD` or ISO date-times; day-only
bounds use local midnight and until the next midnight, with an exclusive upper
bound. Zoned ISO instants are recommended for automation; reject inverted ranges.

- `self-identify` uses exact harness and filesystem evidence plus revalidation.
  It reports exact, ambiguous or unavailable, with provider/native ID, lineage
  and evidence provenance. It reads no transcript messages for enrichment.
  Cwd scopes/revalidates; unique cwd, recency or engagement are historical facts.
  ORC continues to compose git, host and live Orca/T3 evidence itself.
- `list` provides ranked historical candidates, provenance and explicit coverage.
  A limit bounds returned candidates; discovery budgets also bound scanning.
  Its results never establish current identity. Keep established finite donor
  discovery budgets (including provider-specific Cursor bounds), rather than
  hiding dropped candidates. The initial response limit is 100, with an explicit
  `--limit` to request more within scan budgets. Candidate metadata and warning
  schemas are implemented and checked in p02, with this contract as the boundary.
- `read` and `parse` are stateless. Default from-offset is zero; it is a
  **provider source ordinal**, not a byte position or decoded-message count.
  The response identifies its coordinate/index base. `--cursor` is opaque,
  versioned and bound to source identity/generation/projection; it conflicts
  with `--from-offset`. `--max-records` and `--max-messages` are optional positive
  limits and may combine; neither redefines the offset coordinate. `--max-bytes`
  limits **source bytes read per page**, default 4,000,000 (the existing ORC
  transcript-tail budget scale), rather than silently truncating rendered text.
  A record/page boundary, partial tail, next continuation and coverage account
  for work omitted by a bound. Library callers can request a larger explicit
  budget for complete export/activity; no digest cap becomes an evidence cap.
  Conversation output defaults to natural-language user/assistant content;
  tool calls/results and activity summaries are separate explicit opt-ins.
- Exact Codex evidence controls belong to `read`: `--evidence`, `--cutoff`,
  `--expand`, `--related`, `--expand-offset`. They require JSON and Codex support;
  any exact-evidence control selects evidence mode. Cutoffs bind source
  generations; expansion requires its cutoff; related expansion requires expand
  and retains the donor cap of 16 events. Expand-offset is a nonnegative byte
  offset within one **redacted expansion field**, requires expand and conflicts
  with related expansion. Evidence mode conflicts with ordinary cursor/offset
  pagination. No state/watch/delivery controls are accepted. Unsupported provider
  evidence fails explicitly instead of inventing equivalent evidence.
- `search` preserves history → metadata → content → deep/tool-output widening.
  Repeat `-p/--pattern`; reject empty/no patterns and invalid regex. Default is
  regex; `--literal` selects literal matching. Cwd values are widening hints,
  not exact-only filters. `--tiers` selects history/meta/content in canonical
  order; deep is a separate fallback rung, disabled by `--no-deep`.
  `--include-tools` permits tool matches during applicable scans. Preserve donor
  defaults: limit 15, max-line-bytes 65,536, large-scan-bytes 2,147,483,648,
  no deadline unless supplied. `--allow-large-scan` authorizes a scan beyond the
  threshold; without it return an actionable refusal and estimate, never prompt
  or silently scan. `search estimate` uses the same query/scope/cost options and
  reports estimates/coverage, not content hits. Redact full units before snippet
  windowing. Keep optional rg/sqlite accelerators and correct stdlib fallbacks;
  do not introduce persistent indexes.
- `export` writes sanitized conversational Markdown. Exact session selection is
  preferred; historical cwd/runtime/marker selection remains available, refusing
  ambiguity. `--session` conflicts with marker/batch selection; `--all` exports
  the bounded candidate set to a directory and reports incomplete discovery.
  `--out` is required, a file for one selection or directory with `--all`.
  Tool calls/results and activity summaries require opt-in and pass through the
  sanitizer. Batch names are provider-qualified, confined to the selected output
  directory and do not overwrite unrelated artifacts. No toolkit selection state
  is written. Preserve donor marker filtering and report no-match explicitly.
- `activity` emits complete structured evidence with provenance/usage/coverage;
  it is sensitive and **not** described as sanitized/shareable. `--out` optionally
  writes that JSON artifact; otherwise it is returned through the CLI envelope.
  Bounds must surface incomplete coverage; full output must not inherit digest
  truncation. Detailed Codex expansion remains on `read`, avoiding two meanings
  for one expansion token.

The command map fixes spellings and capability IDs. p02/p03 must demonstrate
these contracts with controlled donor fixtures before advertising them; any
actual incompatibility needs an explicit disposition, not a misleading alias.

## Update notice and consumer ownership

p01 performs no update lookup. p03 adds cached, best-effort stable-release
notices for interactive CLI use only. Both stdin and stderr must be TTYs;
`--json`, capabilities, help/version, CI and non-TTY invocations are quiet and
perform no lookup. Library imports and bundled hooks cannot invoke update code.
An explicit `SESHTK_NO_UPDATE_CHECK=1` disables notices/checks. Cache TTL is
24 hours under `$XDG_CACHE_HOME/session-toolkit/` or
`~/.cache/session-toolkit/`; it is CLI-owned update metadata, not transcript or
selection state. Registry timeout is at most one second, failures never change
session command success, and notices go only to stderr. No automatic upgrade.

Existing consumer formats, offsets, watch/control state and selection policy
remain owned by Skills/ORC. The [inventory](consumer-inventory.md) records actual
callers, persistence boundaries and later parity gates. No consumer is cut over
in p01. Before interactive skill migration, p04 must amend dependency guidance
and revise the relevant standalone/shared-transcript decisions through their
own workflow; this project reference does not silently supersede them.
