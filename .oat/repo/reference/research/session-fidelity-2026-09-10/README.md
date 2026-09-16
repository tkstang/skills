# Session fidelity and tooling: research and implementation packet

**Prepared for Thomas Stang | September 10, 2026**

## The decision

Extend the existing `session-observer` and `export-session-transcript` scripts with an **opt-in rich activity view**. Borrow `cli-continues`' deterministic tool classification, call/result correlation, category-specific summaries, and diff-display approach. Keep your session selection, observation state, human-decision handling, and Cursor lifecycle rules. Do not make a universal recorder or daemon a prerequisite.

The working CLI proposal is `--include-activity`. **It is a proposal, not a flag implemented by this packet.** Existing `--include-tools` and `--debug` behavior should remain compatible. A bounded activity report is not a lossless transcript; preserve source pointers and make omissions explicit.

An important correction to the earlier conversation: your current **Codex** normalizer does not emit general function-call results or custom patch calls. Its special handling of `function_call_output` is for ask-user answers. That is a concrete coverage gap to close, not merely a truncation setting. [S-CORE](https://github.com/tkstang/skills/blob/f5395a3568fd1b605501f550ea6ad78ee2f773ad/src/transcript/core/runtimes.ts)

## Start here

| Document | Purpose |
|---|---|
| [01 Executive findings](01-executive-findings.md) | Recommendation, corrections, and minimum useful scope. |
| [02 Repository comparison](02-repository-comparison.md) | What all four repositories do and where each fits. |
| [03 Handoff internals](03-cli-continues-handoff-internals.md) | Exactly how non-conversation data is extracted, summarized, and lost. |
| [04 Existing skills gap analysis](04-current-skills-gap-analysis.md) | Actual behavior of your observer/exporter, including provider-specific gaps. |
| [05 Reuse and porting map](05-reuse-porting-map.md) | Which functions to borrow, adapt, or avoid; dependency and attribution boundaries. |
| [06 Optional-flag design](06-optional-activity-flag-design.md) | Proposed flags, data contract, filtering, watch semantics, and privacy. |
| [07 Implementation and tests](07-implementation-plan-and-tests.md) | File-level changes, staged work, and regression fixtures. |
| [08 Retros and skill evaluation](08-retros-and-skill-evaluation.md) | How to use the richer data without overclaiming what it proves. |
| [09 Session resume comparison](09-session-resume-comparison.md) | Native resume versus cross-provider handoff; ccrider versus cxresume. |
| [10 Schema guide](10-schema-guide-and-coverage.md) | How to interpret the observed native schemas and evidence levels. |
| [11 Corrections and limitations](11-source-audit-corrections-and-limitations.md) | Source-backed corrections to earlier claims and stale repository documentation. |
| [Provider index](providers/00-index.md) | Seventeen provider guides with storage layouts, field dictionaries, examples, and gaps. |
| [Sources](sources/README.md) | Commit-pinned implementation references and reproducibility boundaries. |

## Supporting material

`schemas/native/` contains **partial observational JSON Schemas**, not vendor-certified specifications. They describe the inspected parser-supported surfaces, allow unknown properties, and are not safe ingestion filters. SQLite schemas describe exported rows or decoded JSON, not a SQLite file's bytes. Opaque stores receive an explicit gap rather than an invented schema.

`schemas/proposed/` and `design/` describe the proposed activity contract. `examples/` contains synthetic examples authored for this packet, not real user logs or captured provider sessions. [Validation notes](validation/REPORT.md) describe exactly which checks were performed.

## Scope and evidence

The four repository revisions are pinned in [the source manifest](sources/repositories.json). The coverage is the union of their implemented provider registries: the 16 `continues` providers plus Pi from `ccrider`. Different applications under the same brand, such as Antigravity CLI and IDE, are documented as different surfaces. [C-REGISTRY](https://github.com/yigitkonur/cli-continues/blob/e486cd22a592d89d890cff056624647fbe9cbe80/src/parsers/registry.ts) [R-PROVIDER](https://github.com/neilberkman/ccrider/blob/6f384a6343998cb6e8354ed9fffd6b1f6ecdc025/internal/core/session/provider.go)

This is a source-code and documentation audit. It does **not** certify compatibility with every provider version released by September 2026. No upstream repository test suite or live agent launch was run. No changes were made to your repositories. The packet's own examples, JSON Schemas, and links were checked separately.
