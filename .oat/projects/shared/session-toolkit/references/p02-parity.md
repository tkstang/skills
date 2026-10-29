# p02 donor parity and ownership

Controlled fixtures only; no live transcript copied or general provider
certification claimed. Skills donors were inspected at p02 dispatch base
`1a4974465ddb66b51a2b0db556fde61abc9c267b`; ORC exact identity donor at
`cc845945d0e50f3b60bcbc1ec5cb0a64c9c9e18b`. The package is unpublished 0.1.0.

## Parity matrix

| Boundary / donor                                          | Delivered proof                                                                                                                                             | Intentional difference and disposition                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ORC `packages/session-log/src/identity.ts` exact identity | `session-toolkit-identity.test.ts`: authoritative/ambiguous/unavailable, cwd, symlink/ownership, duplicates, saturation, revalidation                       | Exact status semantics retained; ORC git/host/T3/Orca enrichment and action policy stay ORC. Historical cwd/recency never selects current identity.                                                                                                                                                                                                                                                  |
| Skills runtime lineage and harness identity               | Identity/runtime tests: native/root/parent/fork/history boundaries and first metadata header                                                                | Combined explicit observer/native carriers intersect; `CODEX_THREAD_ID` is native, `CODEX_SESSION_ID`/`OPENAI_CODEX_SESSION_ID` are grouping only. Parent evidence never becomes native.                                                                                                                                                                                                             |
| Skills observer locate/rank                               | Discovery tests: cwd metadata/layout, exact pins, generic historical order, entry/byte/candidate limits and incomplete coverage                             | No cwd-cache writes or engagement-policy scoring. Generic metadata-quality/mtime ranking is historical; consumer policy remains outside toolkit. Provider-specific budgets retained.                                                                                                                                                                                                                 |
| Skills `src/shared/transcript/runtimes.ts`                | Runtime/read tests: provider normalization, raw carriers, malformed/partial tails, bounds, continuations, source mutation                                   | New stateless source pages preserve decoded/source/frame/physical/byte coordinates. Ordinary continuation invalidates on any append. Existing consumers retain their offsets/state until explicit migration.                                                                                                                                                                                         |
| Skills Cursor frame/terminal rules                        | Runtime/activity Cursor and read regression tests                                                                                                           | Closed frames only. Message delivery coordinates point to terminal; origin coordinates remain global decoded indices. Page activity delivery ranges use frame coordinates even across malformed frames. Conversation is a captured-page projection: split turns can omit earlier-page buffered messages. Raw records remain intact for consumer continuity. No new stateful buffering is introduced. |
| Skills observer `evidence.ts`                             | Evidence tests: cutoff/source replacement/prefix mutation, append freeze, expansion/redaction, invalid/unsupported controls; built CLI checks record bounds | Digest/state replaced by captured source projection. Cutoff freezes a source prefix across appends; generation identity and prefix hash bind it. Redact full fields before windows. Related expansion cap16 retained. Source budget default4m/max16MiB explicit; capture incomplete reasons visible.                                                                                                 |
| Skills activity extraction/correlation/usage/project      | Extracted activity suites and page-summary read fixture                                                                                                     | Staged closure supports evidence and independent captured-page summary; full activity command remains p03. No full-session completeness inferred from a digest or bounded page.                                                                                                                                                                                                                      |
| Skills export sanitizer                                   | 48 sanitizer cases retained plus export tests                                                                                                               | Hidden instruction/control filtering retained; visible secrets are not generally redacted. Review before sharing. Tools remain independent opt-ins with donor200/500 preview caps. Activity export is counts only.                                                                                                                                                                                   |
| Skills export marker/batch/destination                    | Export tests and built CLI integration                                                                                                                      | Marker miss refuses instead of donor newest fallback (p01-selected). Ambiguity refuses. Batch names provider-qualified/path-hashed/confined; exclusive creation refuses every existing file/symlink rather than overwrite. Discovery/source partials reported.                                                                                                                                       |
| Public library/CLI and packed runtime                     | CLI/package/operations suites, archive installed outside repository on actual Node22.0.0/24                                                                 | New deliberate root API and one JSON envelope; exact CLI identity refuses while library returns evidence status. No consumer selection/watch/delivery state or donor imports.                                                                                                                                                                                                                        |

## Staged extraction and test rationale

Package `provider-runtime.ts` is extracted from Skills shared `runtimes.ts`;
`activity-*.ts`, `cursor-analysis.ts`, `cursor-frames.ts`, `terminal-events.ts`
are the independent local closure. `sanitize.ts` retains export sanitizer rules.
`identity.ts` starts from ORC fail-closed resolution with Skills provider lineage
additions. Package `evidence.ts` adapts observer exact evidence, removing stateful
digest dependencies. All source imports are package-local/Node, with Commander
reachable only from the CLI boundary. Donors are unchanged and keep serving
current consumers until p04/p05 removes duplication.

Protects against: extraction losing provider normalization, terminal collapse,
redaction, correlation or usage rules; donor tests do not execute the new package
closure; covered by extracted runtime/activity/sanitizer tests and package-boundary
fixtures. Temporary overlapping donor protections stay until consumer cutover,
when coverage follows the single surviving authored engine.

Protects against: installed archive missing a runtime module or using an API
newer than Node22.0.0; source tests cannot execute packed bytes in isolated npm
installs; covered by `scripts/session-toolkit-package.ts` fixture API/CLI proof.

## Reserved work and acceptance limits

Search/estimate, full activity, update notices: p03. Production consumer cutover,
skill version/distribution changes and package publication: p04/p05. No live
provider certification, marketplace validation or npm publication is inferred.
Baseline full-suite failures in the two collaboration fixture files remain an
explicit environment limitation; the remaining-suite result is reported
separately in p02 verification evidence.

## Review H1–H3 corrections

Exact Codex discovery filters valid unrelated native sessions; conflicting carriers
claiming the selected ID, duplicate native matches and incomplete scans still refuse.
Claude exact identity and discovery share the current every-nonalphanumeric cwd
slug plus the selected slash/dot and slash-only variants. Cursor exact selection also accepts the three generic transcript carrier names
under the selected native-ID directory, preserving duplicate refusal. Exact Codex
evidence canonicalizes captured cwd metadata for comparison without changing raw
records; cutoffs remain bound to the canonical selected directory.

Ordinary reads normalize once. Message-limited reads count cached prefixes with
a logarithmic boundary search, then normalize the selected whole records once;
provider correlation and terminal context remain intact. Claude tool-ID reuse
with conflicting names and tool results opted out can reduce an earlier prefix's
message count. That detected exceptional input retains sequential-prefix counting
to preserve the donor's first boundary, and can still take quadratic CPU within
the existing byte/record bounds. Tests protect this concrete fallback, atomic
multi-block records, diagnostics/continuation positions and Cursor pending
questions before terminal collapse.
