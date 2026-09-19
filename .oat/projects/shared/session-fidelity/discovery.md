---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-09-19
oat_generated: false
---

# Discovery: session-fidelity

## Initial Request

Run `oat-project-quick-start session-fidelity` using **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter** as the brief. Produce discovery and an execution-ready plan; this invocation does not implement the feature.

The backlog calls for an opt-in rich activity view in `session-observer` and `session-export-transcript`, with correlated native tool calls/results, bounded previews, source provenance, source model/lifecycle/compaction metadata, and explicit coverage. Existing default output and export sanitization remain intact. The user subsequently added Codex native-session identity/safe cursor binding and native Claude conversation provenance corrections; these are explicit exceptions to preserving default behavior.

## Clarifying Questions

The supplied backlog and September 10 research packet provide substantive requirements. No additional project description is needed. No new user decisions have been inferred from the project name.

The request is well-understood at the product level. The user selected lightweight design on 2026-09-18. The shared activity contract, correlation/delivery boundary, and Cursor integration will be resolved in a current architectural sketch before executable tasks are finalized. The saved `workflow.designMode=selective` initially mapped to collaborative mode. The user subsequently requested a full draft, overriding section-by-section validation for this pass.

## Solution Space

The backlog selects a shared deterministic activity projection, separately opt-in at each existing consumer. Keep that direction. The historical research is design input, not evidence of shipped behavior or current client-format coverage.

## Options Considered

- **Shared extraction and bounded projection:** the backlog's intended approach; preserves native evidence and gives both consumers one activity vocabulary.
- **Expand existing conversation entries only:** insufficient for physical source locators, multiple results, coverage, and independent sanitization. Do not widen the legacy entry union merely to carry activity.
- **Build the shared-session-log substrate first:** outside this item. The activity contract is an input to that later project, not dependent on it.

## Key Decisions

These requirements combine the backlog, existing repository decisions, and the observed user direction recorded below:

1. Add one explicit `--include-activity` flag to both skills. Preserve no-flag behavior and existing `--include-tools`/`--debug` behavior on surfaces that already support those flags.
2. Retain the existing record reader's API and logical indices. Add detailed physical line/byte provenance and parse diagnostics without turning physical coordinates into observer checkpoints.
3. Support Claude/Codex activity first, then Cursor through frame analysis. Cover Codex function/custom calls and results plus web-search evidence; preserve exact names, independent call/message IDs, parsed arguments, raw carriers, and ask-user attribution caveats.
4. Correlate before selecting the delivered range so a late result can refer to an earlier call. Repeated commands and multiple result updates remain distinct; an absent result never implies success.
5. Keep a separate optional activity envelope and explicit coverage states: `available`, `not-recorded`, `not-found`, `not-read`, `unsupported`, `malformed`, and `truncated`. Distinguish content availability from lifecycle completion.
6. Preserve exporter-owned sanitization for default conversation exports. Label opt-in activity exports as activity/debug output; source content is data, and instruction bodies are not implicitly enabled.
7. Preserve exact-pin, review/mark-read, catch-up, watch, Cursor delivery/settlement, and collaboration ownership boundaries. Watch event logs remain metadata-only.
8. Follow declared distributions and canonical source ownership. Historical module paths and exporter naming in the research must be translated to the current repository.

9. The user explicitly added the Codex locator fix to this project (human-origin Claude record 309), then chose identity-rich source-local coverage and sanitized real-session fixtures and requested observed-schema documentation (record 457). Source reads and schema evidence gathering may proceed now; Fable coordinates the evidence lane.
10. Native parent/child identity must propagate through discovery/cache/pins/state. Ambiguous or changed source bindings fail closed; unsafe legacy offsets require explicit scoped recovery instead of silent migration. Valid legacy stored paths/native IDs retain their offsets without a new marker.

11. The user selected a three-layer `gh stack`: schema documentation (`c970c876`), identity/cursor fixes, then activity support. The documentation layer is already committed locally; branches/PRs have not been arranged or published.

## Constraints

- Runtime remains dependency-free, using Node standard library APIs; repository tooling requires Node >=22 and pnpm.
- Authored shared code belongs under `src/shared/transcript/`; consumer owners are `src/skills/session-observer/` and `src/skills/session-export-transcript/`.
- Build generated distributions from canonical sources; never hand-edit generated payloads. Account for transitive skill-version impact, bump affected `metadata.version` fields, and add matching Unreleased changelog entries during implementation.
- This increment adds no sidecar reads; recorded child IDs, agent paths, and nicknames remain actionable references after the locator fix. No arbitrary output-path following or same-directory predecessor guessing.
- Count scopes and preview omissions must be explicit. Tail previews come from the actual available tail; truncation cannot silently conceal later failures.
- Use recorded source evidence for status, exit codes, model/lifecycle/compaction metadata, and subagent/MCP activity. Keep native status separate from inferred convenience fields.
- Use deterministic sanitized fixtures derived from observed local sessions for implementation verification, supplemented with authored edge cases. Existing research examples are authored examples, not captures proving support for currently installed clients.
- Ship backlog close-out in the implementation PR only after all acceptance criteria pass. This planning run leaves the item open.

## Success Criteria

- Added scope: native Codex parent/child pins select one source regardless of recency, safe source-bound state refuses wrong-file reuse, and evidence-backed native schema documentation covers the supported runtimes.

1. Detailed reading returns decoded records with physical line/byte locations and parse diagnostics; legacy `readRecords()` and logical-index behavior remain compatible.
2. Shared typed extraction, classification, correlation, and pure bounded projection preserve source pointers and complete native content before presentation budgets apply.
3. Claude and Codex calls/results retain exact native names and call IDs, parsed and original arguments, multiple updates, file/shell/MCP/subagent evidence, and honest outcomes. Codex function/custom and web-search coverage gaps are closed in the activity path.
4. Both consumers accept the flag. Observer review, catch-up, and watch deliver activity with unchanged identity/checkpoint behavior; default digest/export output and sanitization remain unchanged.
5. Cursor identity comes from frame analysis; observer v2 and exporter are verified independently. V1 stateful activity is delivered only for settled turns; stateless review/export can show pending calls explicitly. Use positional call identity and no result payload claims. Revisions before settlement do not become duplicate invocations; ordinary conversation delivery is unchanged.
6. Fixtures cover late and unmatched results, repeated calls, malformed/interrupted JSONL, large/multiblock outputs, Unicode offsets, later failures, ask-user attribution, and Cursor lifecycle/revision cases. Counts identify delivered, displayed, or captured scope.
7. Activity exports clearly identify sensitive content and coverage limitations. Unsupported surfaces remain explicit; no claimed publish safety or hidden reasoning access.
8. Canonical skill instructions, user guides, generated distributions, version fan-out, and changelog agree with tested behavior. Relevant focused checks and repository build/type/test/validate/smoke gates pass before implementation completion.

## Out of Scope

- Daemon, cross-session warehouse, shared merged-log implementation, or MCP server.
- All 17 provider adapters from the research catalog.
- Automatic skill rewriting or provider continuation/fork operations.
- Exporter JSON format, a new `--activity-output` flag, or a new public tuning surface unless separately requested.
- Recursive child-session ingestion, arbitrary sidecar traversal, automatic instruction-body inclusion, and speculative reconstruction of missing evidence.
- Installation, release, marketplace/live-provider acceptance, and unrelated global skill updates.

## Deferred Ideas

- **BL-260619-shared-session-log-substrate — Stateless multi-session activity merge:** consume the established activity contract in a later project.
- Fuller activity artifacts and additional provider adapters remain future options, not requirements of this item.

- Default Claude provenance is now in scope: human record 1850 requests the fix now. Lightweight captured-fixture obscuring without a user approval stop is the latest direction at records 1850/1874.

- Complexity reductions: defer token accounting, inferred cross-stream associations, process linking, derived enrichments, grouped tool indexes and inventory-tool promotion. Keep native categories, exact-ID correlation, coverage, byte/line provenance and Cursor support required by the backlog.

## Current Repository Evidence

- `src/shared/transcript/runtimes.ts:971`: `readRecords()` skips blank/malformed lines and returns decoded objects, so its logical index is not a physical line number.
- `src/shared/transcript/runtimes.ts:1747`: ordinary Codex `function_call_output` is dropped unless correlated to ask-user questions; current normalizer does not expose general custom-tool activity.
- `src/skills/session-observer/src/lib/digest.ts:1079`: Cursor uses a dedicated digest path, while other runtimes use shared record normalization.
- `src/skills/session-export-transcript/src/session-export-transcript.ts:579`: exporter reads records and normalizes separately before sanitization.
- `src/distributions.ts:159` and `:229`: current observer/exporter canonical owners and generated standalone/plugin targets. Both already allow `src/shared/transcript`; imported activity modules should be included through the existing build import closure, without inventing a new registry architecture.
- The bounded code audit confirms the exporter has no existing include-tools/debug flags to preserve; compatibility applies only where flags exist today. Observer Cursor v2 and exporter terminal-only normalization require distinct integration tests.

## Open Questions

- **Design depth resolved:** user selected lightweight design. The user subsequently requested the whole design draft; the completed draft proceeds to planning without a design HiLL gate; revised peer read-back is pending.
- **Contract detail:** settle stable event identity, result updates, count/range scope, byte/source coordinates, and projection budgets in design without replacing legacy entry/checkpoint contracts.
- **Metadata and sidecars resolved:** no sidecar reads in v1; preserve identity-rich references and accurate unread/truncated coverage.
- **Fixture provenance approved:** audit observed local schemas, derive reviewed sanitized fixtures, and document observed versions/uncertainty. Fable committed the evidence snapshot and maintained schema pages in `c970c876`; the project references now point to those durable locations.

- **Native provenance resolved:** fix it in the identity layer, audit origin consumers, preserve absent-field behavior and existing wake-envelope semantics, and verify classification/ranking.
- **Fixture review resolved:** no user approval stop or mandatory independent fixture gate; use small captures with practical obscuring and ordinary verification.

## Assumptions

- The backlog's four required stages and documentation/security criteria define this project's scope. The research's optional fifth-stage expansion is not automatically authorized scope.
- The research's `export-session-transcript` references map to the current `session-export-transcript` owner; no compatibility alias is proposed.
- Exact numeric budgets and schema field details can be resolved in lightweight design within the agreed bounded behavior.

## Risks

- **State regression:** mixing source and delivery indices can replay or skip evidence. Preserve existing state transitions and test late results and grow-in-place frames.
- **False attribution:** mismatched call IDs, inferred success, or fabricated human answers can misstate activity. Retain native evidence, unmatched states, and the ask-user caveat.
- **Privacy regression:** widening the default sanitizer or content-bearing telemetry would violate existing boundaries. Activity remains explicitly selected and separate from default export filtering and watch logs.
- **Stale research paths:** September 10 packaging paths predate current source colocation. Use current owners and bundling declarations when generating tasks.

## Next Steps

Discovery is captured and lightweight design is selected. Use the completed design to generate stable tasks and verification commands, resolve dispatch and gate posture, review the plan, and commit a ready handoff. The 18-task plan and matching pending implementation ledger are drafted; formal reviews must pass before readiness.

## References

- `.oat/repo/pjm/backlog/items/BL-260916-session-fidelity-opt.md`
- `.oat/repo/reference/research/session-fidelity-2026-09-10/06-optional-activity-flag-design.md`
- `.oat/repo/reference/research/session-fidelity-2026-09-10/07-implementation-plan-and-tests.md`
- `.oat/repo/reference/research/session-fidelity-2026-09-10/11-source-audit-corrections-and-limitations.md`
- `.oat/repo/reference/research/session-fidelity-2026-09-10/design/activity-contract.ts`
- Existing decisions: DR-260724-stateful-work-requires-exact, DR-260724-separate-observation, DR-260724-content-availability-is-not, DR-260605-export-sanitization-is-two, DR-260603-watch-event-logs-are-metadata, and DR-260914-declared-skill-distributions.
