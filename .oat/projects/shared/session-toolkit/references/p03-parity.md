# p03 search, activity and updater parity

Controlled synthetic fixtures only. Search donor is
`src/skills/session-search/src/lib/` at accepted dispatch
`9f46b0c6cf8ebabf0457a5a83a084cc5b7db9897`; activity uses the package's p02
extracted shared substrate. Donor source and existing consumers remain unchanged.

| Boundary                            | Evidence                                                                                                                                                     | Disposition                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search pipeline/options/window/rank | Extracted package search suites: canonical tiers, cwd widening, time windows, history/title metadata, no-match, subagent/agent-authored attribution, ranking | Donor algorithms retained as package-local search projections; provider normalizer and sanitizer reused, no second normalization engine.                                                                                                                                                    |
| Raw units and redaction             | Search adapter/scanner/matcher/redact suites and public long-output fixture                                                                                  | Full tool and ask-user answer fields remain searchable beyond conversation preview caps. Redact complete units before windows; never search only digest output.                                                                                                                             |
| Accelerators                        | Package search tools/scan/Codex suites                                                                                                                       | Optional rg prefilter is a safe superset with correct Node fallback; deep/double-decoded fields bypass rg. Optional readonly sqlite metadata failures degrade source while filesystem search continues.                                                                                     |
| Scan controls                       | Public API/built CLI threshold fixture plus pipeline deadlines/oversize fixtures                                                                             | Public E_SCAN_CONFIRMATION refuses with byte/file estimate and explicit allow-large-scan hint; no prompt. Internal donor cheap-tier restriction is retained, but cannot silently authorize a larger scan. Partial coverage additionally marks malformed/skipped lines and degraded sources. |
| Search options/schema               | Public query validation, CLI nesting, installed declarations                                                                                                 | Deliberate searchSessions/estimateSearch only. Estimate also validates regex/patterns. Donor payload schemas remain inside toolkit envelope. Clean new environment namespace `SESHTK_SEARCH_*`; no legacy aliases.                                                                          |
| Full Claude/Codex activity          | Public activity fixture plus retained extraction/correlation/usage suites                                                                                    | Raw correlated events, arguments/results, usage and raw source carriers survive; no projectActivity/digest preview budgets. Complete captured source and semantic data-class availability are separate.                                                                                     |
| Cursor full activity                | Public Cursor fixture plus retained frame/activity suites                                                                                                    | Same frame accumulator/extractor; source/terminal coordinates retained. Recorded calls/turn lifecycle only; results/per-call outcomes/usage explicitly absent. Raw captured records retained independently.                                                                                 |
| Activity source bounds              | Public malformed/paging and headerless-continuation fixtures, inherited reader tests and installed continuation proof                                        | Independent decoded/source/physical/byte/frame coordinates and generation-bound cursors. External output/child paths never followed. Suffix pages retain the validated selected identity, event keys and matching usage. They cannot reconstruct missing earlier correlation context.       |
| CLI updater                         | Built subprocess external-fetch and TTY boundary fixture                                                                                                     | New CLI-only feature; successful interactive operations only, both TTYs required. JSON/bare capabilities/help/version/CI/opt-out/non-TTY/library import perform zero lookup/cache writes/notice.24-hour cache, stable releases only,1-second abort, stderr-only, no upgrade.                |
| Packed ownership                    | Exact archive clean installs on Node22.0.0/24.21.0                                                                                                           | Only root API public; flat declarations ship all transitive types. CLI factory and updater are absent from library exports and library import has no I/O. No donor source enters archive.                                                                                                   |

Search adapters preserve donor-specific historical store/index knowledge; they
classify raw units using the package provider engine rather than defining a
second conversation parser. Package activity summaries and full capture share
one extraction function; summaries still use their accepted capped projection.
Full capture additionally includes all captured raw provider records and is
sensitive, including instruction carriers. No action/terminal-attention policy,
consumer state or live-provider certification is introduced.

Protects against: extraction losing search provider classification, redaction,
accelerator fallback or scope/ranking semantics; original donor tests do not
execute the package closure; covered by extracted search tests and fixture
builders under tests/helpers. This temporary overlap ends with p04 donor cutover.

Protects against: compiled archive missing transitive declarations or erasing raw
search/activity detail; source tests cannot prove a clean install of exact bytes;
covered by the extended archive fixture and strict NodeNext installed consumer.

Documentation uses authoring-docs' built-in information-architecture guidance
(no repo/user override configured): package README stays a flat npm-facing
Toolkit and CLI entry; internal validation matrices remain project evidence.
No website restructuring or governance instructions needed in p03. p04/p05
retain publish-ready canonical docs and consumer migration authority.
