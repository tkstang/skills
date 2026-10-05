# Acceptance evidence

## Provider scope

| Capability | Codex pilot | Claude Code | Cursor |
| --- | --- | --- | --- |
| Existing peer review/activity/catch-up/watch | Preserved; regression suite | Preserved; regression suite | Preserved; frame/settlement regression suite |
| Strict self/exact frozen evidence | Supported | New flags fail unsupported | New flags fail unsupported |
| Frozen cutoff/index | Device/inode + exact prefix SHA-256/bytes + exclusive decoded-record end | Unsupported new feature | Unsupported new feature; no unsettled-frame parity claimed |
| Original tool expansion | Function/custom calls/results and supported existing item carriers | Unsupported new feature | Unsupported new feature; existing absence of result carriers unchanged |
| Native call IDs, order, multiplicity | Existing unique-ID correlation; missing/ambiguous IDs stay unresolved | Existing activity behavior unchanged | Existing positional activity behavior unchanged |
| Recorded skill body/version | Historical structured read_file + uniquely correlated string result; read evidence only | New expansion unsupported; existing attribution unchanged | New expansion unsupported; existing structured Read attribution unchanged |
| Actual executed skill revision | Unknown; no shell/current-install inference | Unknown | Unknown |
| Non-text/nested/child/sidecar payloads | Explicit unavailable/unsupported/unknown; no crawl | Existing no-crawl behavior | Existing no-crawl behavior |

## Complete issue acceptance matrix

| #75 criterion | Status | Evidence |
| --- | --- | --- |
| Exact own identity; ambiguity/missing/wrong cwd/runtime/neighbor do not fall back | Pass (Codex) | installed CLI strict-own/no-fallback tests; native duplicate and filename casing/nonstandard carrier controls; oversized70KiB/malformed unknown neighbor headers explicitly block selection |
| No offsets/delivery/watch changes and absent state stays absent | Pass | installed CLI compares existing sentinel state/watch files and checks absent directory; evidence never calls state initialization |
| Reject self + stateful combinations | Pass | CLI table covers catch-up, watch, catch-up-then-watch, state, mark-read, watch alias, event-log before discovery |
| Fixed cutoff excludes appends/review recursion | Pass | append/repeat preserves cutoff, entries and references; later new read has different generation |
| Replacement/shrink/changed history detected | Pass | same-length rewrite, shrink and rename/recreate fixtures refuse cutoff |
| Cursor unsettled-frame rules | Unsupported new feature, explicit | CLI rejects Cursor evidence before source discovery; existing frame tests retained and run in full suite |
| Raw vs rendered ranges/filter/tail/truncation/redaction/unavailable fields | Pass | selectedRange, unchanged accounting, parse diagnostics, activity omissions/coverage and field privacy metadata; rendering-field sanitization before normalization/projected clipping, preserving original native correlation and absent fields; diagnostic and metadata repro regressions |
| Correct-generation stable refs and tool pairing/interleaving/multiple results | Pass | old refs fail another cutoff; native-ID group yields literal record order [2,4,6] with no interleaved b call |
| Unknown IDs/missing results/non-text payloads honest | Pass | orphan result unresolved, missing result recorded absent, image structured/serialized payload withheld |
| Selective original detail exceeds digest preview while remaining bounded/redacted | Pass | long 22 KiB source result shows 16 KiB window and targeted continuation; source-length > 22 KiB; secrets near end stay redacted |
| Provider truncation unrecoverable | Pass within recorded evidence | explicit truncation indicator plus existing cap diagnostics; unmarked truncation always unknown, never complete |
| Skill revision historical vs current vs uncertain | Pass | historical read bodyRef/revisionEvidence available; executedRevision unknown; shell read does not establish version |
| Success/failure/stderr/long/secret/instruction-like/append/provider fixtures | Pass | synthetic installed CLI and shared parser fixtures; no transcript replay or live private data |
| Existing peer/catch-up/watch/collab/sanitized export regressions | Pass | Full suite: 185 files passed, 2 skipped; 2858 tests passed, 3 skipped |
| Generated copies fresh and run outside checkout | Pass | generated build + copy installed observer tree into isolated temporary HOME, launch from project outside checkout |
| Exact commands, supported matrix, limits, fallback documented | Pass | canonical observer skill and user guide; unsupported provider commands explicit |
| No complete retrospective or causal claim | Pass | output is source evidence with coverage; interpretation belongs to caller |

## Verification results

- `SKIP_S3_ARCHIVE_SYNC=1 pnpm run worktree:init`: pass. Only bootstrap-managed `.oat/sync/manifest.json` oatVersion noise was excluded narrowly.
- `pnpm run type-check`: pass on final source.
- `pnpm run build`: pass; all payloads regenerated through canonical build.
- Focused installed-CLI/shared-parser suite: 159 tests passed, including 30 installed CLI cases and 129 shared parser cases.
- `pnpm run test`: 185 files passed, 2 skipped; 2858 tests passed, 3 skipped. No live providers executed.
- `pnpm run build:check`: pass on final regenerated source. An earlier full run correctly caught four stale observer payloads after a lint-only source adjustment; the source was rebuilt and the full suite passed.
- `pnpm run validate`: pass. `pnpm run smoke`: pass.
- `pnpm run validate:skill-versions -- --base-ref 8bf18b90`: five changed owners verified.
- Targeted authored `oxlint` and `oxfmt`: pass; generated/OAT/instruction mirrors excluded.
- `pnpm --dir documentation build`: pass, 63 static pages; generated docs inventory updated through its owner.
- `git diff --check`: pass.

## Review regressions and resolutions

Independent installed probes confirmed diagnostic native-ID leakage, metadata redaction after clipping, unsupported-self provider discovery, and an oversized unresolved neighbor header hiding a duplicate. Diagnostic and neighboring-header tests were run against pre-fix bundles and failed for the intended reason. Fixes sanitize complete rendering payloads before projection, keep original native extraction/correlation IDs, preserve string types and absent payload fields, carry truthful source redaction provenance, constrain self provider support before discovery, and refuse incomplete bounded identity inventory. A second review caught structural sanitation altering call identity/JSON text; literal native call-reference and JSON message tests now protect that distinction. Final input probes also found provided empty cutoff/ref flags silently ignored; explicit nonempty input validation and definedness checks now reject both before discovery, with pre-fix failures confirmed. The independent reviewer reran all combined synthetic probes successfully with no remaining confirmed findings.

## Load-bearing source pointers

- `src/skills/session-observer/src/session-observer.ts`: evidence dispatch precedes stateful subcommands and rejects prohibited flags before discovery.
- `src/skills/session-observer/src/lib/observe.ts`: optional strict exact-ID and requiredRuntime constraints before candidate lookup; ordinary resolver behavior unchanged.
- `src/skills/session-observer/src/lib/locate.ts`: exact evidence header-only discovery, forbidden cache persistence, incomplete-header refusal and existing exact candidate ambiguity checks.
- `src/shared/transcript/runtimes.ts`: optional bounded detailed reader; old default API unchanged, capped allocation plus streaming prefix verification.
- `src/skills/session-observer/src/lib/evidence.ts`: generation token/reference validation; native correlation before rendering sanitation; redaction before clipping; truthful metadata, skill and expansion coverage.
- `src/skills/session-observer/src/evidence.test.ts`: installed-artifact synthetic acceptance/regression matrix.

The final implementation is reviewed against 8bf18b90. A merge of concurrent #117 requires rebase/regeneration and updated version validation; no merge acceptance is inferred from this branch evidence.

No global installs, live-provider calls, private transcript inspection, push or PR publication performed by this worker. Native child of parent session; standalone sidebar visibility not asserted.
