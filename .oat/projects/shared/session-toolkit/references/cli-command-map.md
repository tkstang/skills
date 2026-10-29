# Session Toolkit command and argument contract

p01 selected this map against the donors. **0.1.0 currently implements only
version, help and capabilities.** The remaining rows are reserved implementation
contracts for p02/p03. Their presence in this file is not support evidence;
installed help and capabilities expose only implemented operations. See the
[package/API contract](package-contract.md) and [consumer inventory](consumer-inventory.md).

## Implemented in the package boundary

```text
seshtk [--json] --help
seshtk [--json] --version
seshtk [--json] capabilities [--json]
seshtk capabilities --help [--json]
```

No arguments prints help. `-h` and `-V` are the documented help/version short
forms. `capabilities` always returns JSON. Global `--json` is accepted before
or after the operation; machine help/version also use the v1 envelope. Plain
help/version use text. Unknown flags/commands and excess arguments exit 1 with
`E_USAGE`; internal system errors exit 2 with `E_INTERNAL`. There are no prompts,
colors, provider reads or automatic network checks in p01.

Current IDs: `toolkit.capabilities.v1`, `cli.help.v1`, `cli.version.v1`.
Current provider support is empty. The sole API value export is `getCapabilities`.

## Reserved operational usage

```text
seshtk [--json] self-identify [--cwd <path>]
seshtk [--json] list [discovery-options]
seshtk [--json] read --session <provider:id> [read-options]
seshtk [--json] parse <transcript-path> --runtime <provider> [read-options]
seshtk [--json] search -p <pattern>... [search-options]
seshtk [--json] search estimate -p <pattern>... [search-options]
seshtk [--json] export --out <path> [selection-options] [projection-options]
seshtk [--json] activity --session <provider:id> [--out <path>] [read-bounds]
```

Providers are `claude-code`, `codex`, `cursor`. `auto` is a discovery/search
selector. No toolkit `select`, `forget`, `state`, `watch`, `watch-ctl`,
`--persist`, old `--provider` alias or separate catch-up command is selected.
Consumers compose stateless reads with their own saved positions and controls.

| Group                      | Selected flags and defaults                                                                                                                                           | Rules                                                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Common                     | `--json`, `-h/--help`, `-V/--version`                                                                                                                                 | One envelope in machine mode; required actionable error hints; no interaction.                                                                                                                             |
| Discovery                  | `--runtime <provider-or-auto>` (auto), `--cwd <path>` (invocation cwd), `--session <provider:id>`, `--since <time>`, `--until <time>`, `--limit <positive-int>` (100) | Session/runtime must agree. Filters intersect; ranking remains historical. Finite scan budgets and omitted-candidate coverage are explicit.                                                                |
| Read identity              | `read --session <provider:id>`                                                                                                                                        | Explicit session is required; no implicit current selection or persisted cursor.                                                                                                                           |
| File parsing               | `parse <path> --runtime <provider>`                                                                                                                                   | Both explicit path and provider required; no discovery or auto runtime.                                                                                                                                    |
| Read bounds                | `--from-offset <nonnegative-int>` (0), `--cursor <token>`, `--max-records <positive-int>`, `--max-messages <positive-int>`, `--max-bytes <positive-int>` (4000000)    | Offset is a declared provider source ordinal. Cursor conflicts with offset and binds generation/projection. Bytes bound source reads; record/message limits may combine and surface continuation/coverage. |
| Projection                 | `--include-tool-calls`, `--include-tool-results`, `--include-activity` (all false)                                                                                    | Natural-language conversation by default. Tool/result opt-ins are independent; no debug alias that silently broadens data. Activity summary remains distinct from sensitive full activity.                 |
| Exact evidence (read only) | `--evidence`, `--cutoff <token>`, `--expand <ref>`, `--related`, `--expand-offset <nonnegative-byte-count>`                                                           | Codex/JSON only initially; not ordinary offset/cursor mode. Expansion requires cutoff; related requires expand (max16). Expand-offset requires one expand and conflicts with related.                      |
| Search query               | Repeat `-p/--pattern <pattern>`, `--literal` (false), repeat `--cwd <path>`, `--runtime <provider-or-auto>` (auto), `--since`, `--until`                              | Nonempty patterns required. Regex by default. Cwd is a widening hint.                                                                                                                                      |
| Search tiers               | `--tiers <comma-list>` (history,meta,content), `--no-deep`, `--include-tools` (false)                                                                                 | Deep is a separate fallback rung, not a selectable tier. Preserve donor widening/source attribution.                                                                                                       |
| Search cost                | `--allow-large-scan` (false), `--large-scan-bytes` (2147483648), `--max-line-bytes` (65536), `--limit` (15), `--deadline-ms` (omitted)                                | All numeric values positive safe integers. Large scans require explicit authorization, with a machine refusal/estimate instead of prompting. Partial and no-match are distinguishable.                     |
| Search estimate            | Same query/scope/cost flags                                                                                                                                           | Reports estimates and coverage without returning content hits.                                                                                                                                             |
| Export selection           | `--session <provider:id>` OR historical `--runtime <provider-or-auto>`, `--cwd <path>`, optional `--match <marker>`, `--all`                                          | Exact session conflicts with match/all. Historical ambiguity refuses unless disambiguated or all explicitly requested. Keep marker and batch workflows.                                                    |
| Export destination         | `--out <path>` required, plus projection opt-ins                                                                                                                      | One file normally; directory with all. Sanitized Markdown. No selection/read-state writes.                                                                                                                 |
| Activity                   | `--session <provider:id>`, optional `--out <path>`, read bounds                                                                                                       | Sensitive structured evidence with provenance, usage and explicit coverage; no sanitization/shareability claim.                                                                                            |

Time strings preserve the donor search semantics described in the package
contract; paths and conflicting selectors are validated at command boundaries.
Operational response schemas and provider-specific evidence are added alongside
their implementations and fixture proof, without widening the p01 export surface.

## Reserved capability identifiers

These IDs are **not returned by p01**. Each is advertised only after its operation
and declared provider behavior have passed their parity checks:

| Operation                       | Capability ID                  |
| ------------------------------- | ------------------------------ |
| Exact current identity          | `identity.current.v1`          |
| Historical listing              | `sessions.list.v1`             |
| Bounded stateless reads         | `transcript.read.v1`           |
| Explicit file parsing           | `transcript.parse.v1`          |
| Generation-bound Codex evidence | `transcript.evidence.codex.v1` |
| Stateless historical search     | `search.v1`                    |
| Search estimates                | `search.estimate.v1`           |
| Sanitized Markdown export       | `export.markdown.v1`           |
| Sensitive structured activity   | `activity.v1`                  |

The providers array lists providers with implemented operational support, not
all proposed providers. Provider-specific limitations belong in each operation's
documented payload/support contract; a listed provider never implies that the
Codex-specific evidence capability works for it. Version and required capability
checks are both necessary for interactive consumers.

## Documentation handoff

The package README documents current usage. This internal map supplies p02/p03
implementation choices; p04 supplies publish-ready package and Skills guidance;
p05 reconciles built help, argument/default/error schemas, examples, diagrams,
API exports and actual ORC routing against the full canonical documentation site.
Do not copy the reserved usage tree into a released capability list prematurely.
