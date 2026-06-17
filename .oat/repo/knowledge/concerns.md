---
oat_generated: true
oat_generated_at: 2026-06-12
oat_source_head_sha: d008a7e571d90cc6c436c82e176129f62ab54ec4
oat_source_main_merge_base_sha: ed22b463dcdaa466476b0957fea64deb3f663391
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Codebase Concerns

**Analysis Date:** 2026-06-12

## Tech Debt

### v0.1 Pre-release Status

- **Issue:** Repository is pre-release (v0.1) with intentionally scoped feature set. Many planned features are deferred, documented as future work.
- **Files:** `README.md`, `plugins/consensus/README.md`
- **Impact:** Users may expect full consensus family skills and additional iteration modes that do not yet exist. Breaking changes expected before v1.0 release.
- **Fix approach:** Complete feature scope before v1.0 release, then ensure backward compatibility guarantees.

### Paseo Version Window Constraint

- **Issue:** Consensus plugin validates Paseo version against tested range (0.1.0 to 0.9.0) and emits warnings outside that range. Version validation is present but the tested range may quickly become outdated as Paseo evolves.
- **Files:** `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (lines 13-14, version validation at `compareVersions` calls), `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` (version warning generation)
- **Impact:** As Paseo versions advance past 0.9.0, users will see warnings even if compatibility is maintained. No automatic compatibility reset mechanism.
- **Fix approach:** Establish a process for testing against new Paseo versions and updating `MAX_TESTED_PASEO_VERSION` after verification. Consider a telemetry-optional feedback mechanism for users on newer versions.

### Generated Runtime Drift Risk

- **Issue:** Canonical TypeScript source under `src/` generates committed `.mjs` runtime output under `plugins/` and `skills/`. Consumer-facing files carry a banner stamp and must not be hand-edited. `tests/generated-output-sync.test.mjs`, `pnpm run build:check`, hook/CI generated-output filters, and config ignore lists enforce consistency, but manual edits to generated copies still create local drift.
- **Files:** `src/transcript/core/runtimes.ts`, `src/transcript/export-session/export-session-transcript.ts`, `src/transcript/export-session/sanitize.ts`, generated transcript outputs under `skills/*/scripts/`, generated consensus outputs under `plugins/consensus/skills/refine/scripts/`, `scripts/build-generated.mjs`, `tests/generated-output-sync.test.mjs`
- **Impact:** If a developer edits generated output instead of canonical TypeScript source, the test suite and build-check will catch it, but this creates a local blocker and requires re-running `pnpm run build`.
- **Fix approach:** Already mitigated by generated-output drift guards and AGENTS.md documentation. Keep README and repo reference docs explicit about editing canonical TypeScript source only.

## Known Limitations (Design-Phase, Not Bugs)

### Consensus Skill Family Incomplete

- **Issue:** Only `refine` skill is shipped in v0.1. Planned skills (`consensus-create`, `consensus-evaluate`, `consensus-decide`, `consensus-plan`, `consensus-research`) are deferred.
- **Files:** `README.md` (line 129), `plugins/consensus/README.md` (lines 100-101)
- **Impact:** Users cannot use consensus workflows for creation, evaluation, decision-making, planning, or research phases yet.
- **Scope:** Documented intentional limitation, not a bug.

### Consensus Iteration Mode Limitation

- **Issue:** Only alternating iteration mode is implemented. Parallel-revision and parallel-synthesized modes are future work.
- **Files:** `README.md` (line 130), `plugins/consensus/README.md` (line 102)
- **Impact:** Consensus workflows cannot use parallel iteration modes in v0.1.
- **Scope:** Documented intentional limitation.

### No Whole-Document Harmonization

- **Issue:** Consensus sections converge independently in v0.1. There is no whole-document harmonization pass to ensure consistency across sections.
- **Files:** `README.md` (line 131), `plugins/consensus/README.md` (line 103)
- **Impact:** After section-by-section refinement, document-level coherence is not guaranteed.
- **Scope:** Documented intentional limitation for v0.1.

### Cursor Provider Support Incomplete

- **Issue:** Cursor is supported as a host runtime for consensus plugin, but not as a default Paseo peer. Cursor-as-peer requires custom ACP provider configuration.
- **Files:** `README.md` (lines 120, 132), `plugins/consensus/README.md` (lines 96, 104)
- **Impact:** Users cannot easily use Cursor as a peer in consensus workflows without manual Paseo configuration.
- **Scope:** Documented intentional limitation due to Paseo v0.1 not including Cursor as built-in peer.

### Session Observer Cursor Chat History Unsupported

- **Issue:** Session observer supports Cursor agent transcript JSONL only. The SQLite chat history store (`~/.cursor/chats/*/store.db`) is explicitly out of scope.
- **Files:** `README.md` (line 133)
- **Impact:** Session observer cannot review or analyze Cursor chat history via the SQLite database.
- **Scope:** Documented intentional scope boundary for v0.1.

### Watch Mode Background Process Limitation

- **Issue:** Session observer watch mode only responds while the active agent invocation keeps the foreground watcher running and actively reads stdout or re-polls `watch-ctl status`. Starting `watch` in a backgrounded shell does not notify peer agents after the current invocation yields.
- **Files:** `README.md` (line 134), `skills/session-observer/SKILL.md`, `skills/session-observer/references/watch-design.md`
- **Impact:** Watch mode automation is limited to foreground execution. Provider-hook automation for future self-triggered turns is out of scope.
- **Scope:** Documented architectural constraint for v0.1.

## Security Considerations

### Prompt Injection in Consensus Artifacts

- **Issue:** Prompt injection inside input artifacts or transcripts is mitigated by prompt framing, filtering, and schema validation where applicable, but peer CLIs may still produce structurally valid bad advice.
- **Files:** `README.md` (line 137), `plugins/consensus/README.md` (line 107), consensus sanitization in `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (functions `sanitizeProse`, `sanitizeLogProse`, `containMarkdownHeadings`)
- **Current mitigation:** Schema validation, prompt framing, and content sanitization (script/HTML tag removal, heading escaping). Artifact output is reviewed before publication.
- **Recommendations:** Continue reviewing outputs before publishing. Document the sanitization boundaries in user-facing docs. Consider adding output validation warnings in the wrapper when unusual content patterns are detected.

### Input Size Cap

- **Issue:** Consensus refine wrapper enforces an input size cap of 1 MB (`INPUT_SIZE_CAP_BYTES = 1024 * 1024`).
- **Files:** `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (line 15)
- **Current mitigation:** File size is checked before processing. Error is raised if exceeded.
- **Impact:** Large drafts (>1 MB) cannot be refined. This is a reasonable limit for peer deliberation but should be documented clearly in CLI help text.

### Subprocess Output Cap

- **Issue:** Paseo subprocess output is capped at 10 MB (`SUBPROCESS_OUTPUT_CAP_BYTES = 10 * 1024 * 1024`). If a peer produces more output, processing is aborted.
- **Files:** `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` (line 16), spawn handling (lines 461-530)
- **Current mitigation:** Output is streamed and capped in real-time. Error with cap-specific exit code is raised if exceeded.
- **Impact:** Peers that produce very verbose outputs (e.g., with large code blocks) may hit this cap and fail the consensus round.
- **Recommendations:** Document this cap in the README. Consider making it configurable for advanced users.

## Performance Bottlenecks

### Large File Line Count in Consensus-Refine

- **Issue:** `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` is 2211 lines, making it a large, monolithic script with complex state management for resume, parallel mode, and verdict handling.
- **Files:** `plugins/consensus/skills/refine/scripts/consensus-refine.mjs`
- **Cause:** Single-file implementation handles wrapper argument parsing, resume artifact parsing, parallel manifest validation, verdict processing, and output rendering. No modular separation.
- **Impact:** Difficult to test individual concerns in isolation. Harder to debug resume or parallel workflows without understanding the full file structure.
- **Improvement path:** Consider breaking into modules: parser.mjs (frontmatter/manifest parsing), validator.mjs (verdict/manifest validation), renderer.mjs (output formatting), state.mjs (resume logic). Defer refactoring until after v0.1 stabilization.

### Large Session-Observer Implementation

- **Issue:** `skills/session-observer/scripts/session-observer.mjs` is 1318 lines, implementing CLI parsing, session discovery, transcript normalization, watch mode state machine, and output rendering.
- **Files:** `skills/session-observer/scripts/session-observer.mjs`
- **Cause:** Monolithic structure handles multiple concerns (locate, observe, digest, watch, watch-ctl).
- **Impact:** Complex CLI state machine, difficult to reason about watch mode edge cases.
- **Improvement path:** Current structure is acceptable for v0.1. If watch mode expands or new commands are added, consider modularization.

## Fragile Areas

### Resume Artifact Parsing

- **Issue:** Resume artifacts use YAML frontmatter and custom JSON blocks embedded in Markdown comments (`<!-- consensus:label\nJSON\n-->`). Parsing is strict: unterminated frontmatter, corrupt JSON blocks, or missing section status markers cause labeled errors.
- **Files:** `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (lines 151-253), consensus block extraction and error recovery
- **Why fragile:** Hand-written artifacts or partially corrupted files can cause parsing failures. No auto-recovery or validation repair mode.
- **Safe modification:** Add unit tests for edge cases (truncated JSON blocks, nested comments, malformed YAML). Document artifact format in a separate schema reference. Consider a `--repair-resume` flag for best-effort recovery in future versions.
- **Test coverage:** Covered by `tests/resume-corruption.test.mjs`, `tests/resume-parse.test.mjs`. Good test depth already present.

### Parallel Mode Manifest Validation

- **Issue:** Parallel mode (`--prepare-parallel`, `--fan-in`) requires strict validation of the parallel manifest: schema version, field types, path escaping, directory matching, record structure.
- **Files:** `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (functions `validateManifestFieldString`, `validateManifestFieldNonNegativeInteger`, `validateParallelManifest`, lines 540-630)
- **Why fragile:** Many string and integer fields with specific validation rules. Path safety checks prevent directory traversal. Missing validation or incorrect type coercion could lead to silent failures.
- **Safe modification:** All validation already done strictly. Test with `tests/parallel-prepare.test.mjs`, `tests/parallel-fan-in.test.mjs`, `tests/parallel-integration.test.mjs`. Coverage appears complete.
- **Test coverage:** 3 dedicated test files with parallel mode scenarios. Good coverage.

### Paseo Invocation and Error Handling

- **Issue:** Consensus plugin shells out to Paseo via `spawn('paseo', args)`. Paseo must be installed and on PATH. Version validation happens at preflight, but runtime errors (missing executable, permission issues) occur during spawn.
- **Files:** `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` (lines 461-530, spawn and stream handling), `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (preflight validation at `preflightPaseo`)
- **Why fragile:** External dependency on Paseo. If Paseo crashes, is misconfigured, or changes output format, consensus processing fails. No fallback or retry logic.
- **Safe modification:** Preflight check validates version and provider list before spawning. StreamOutput cap prevents runaway output. Consider adding Paseo output parsing version to detect breaking changes early.
- **Test coverage:** `tests/paseo-invocation.test.mjs` covers missing executable and version validation. Good coverage for preflight.

### Verdict Schema Validation

- **Issue:** Verdicts must match one of three branches (ACCEPT, REVISE, IMPASSE) with strict field requirements and byte caps on reasoning, proposed_artifact, and concerns.
- **Files:** `plugins/consensus/skills/refine/scripts/consensus-loop.mjs` (VERDICT_BRANCHES, VERDICT_CAPS, validation functions), `plugins/consensus/skills/refine/scripts/consensus-refine.mjs` (verdict cap enforcement)
- **Why fragile:** Peer CLI output is validated against schema. If a peer produces unexpected JSON structure or oversized fields, the verdict is rejected and the round fails.
- **Safe modification:** Schema is well-defined with clear error messages. Byte limits are enforced strictly (`VERDICT_CAPS` constants). Test coverage is strong.
- **Test coverage:** `tests/verdict-validation.test.mjs`, `tests/loop-records.test.mjs`. Schema branch tests verify ACCEPT, REVISE, IMPASSE handling. Good coverage.

## Test Coverage

### Overall Coverage Status

- **Test suite:** Node plus Vitest suites cover consensus, session-observer, export-session-transcript, transcript-core modules, generated-output drift, manifests, validation, and smoke behavior.
- **Test execution:** All tests pass via `npm test`. Validation pass via `npm run validate`. Smoke tests pass via `npm run smoke`.
- **Coverage areas:** Consensus refine logic (resume, verdict, parallel), session observer (watch state, digest, locate), transcript parsing (Claude Code, Codex, Cursor), manifest validation, release versioning, error handling.
- **Risk level:** Low. Comprehensive test suite covers main paths and error conditions.

### Test Coverage Gaps

**Session-observer watch mode edge cases:**
- Files: `tests/session-observer/watch.test.mjs` (1139 lines)
- What's not fully tested: Complex state transitions in watch mode when transcript records arrive out-of-order or when watcher process receives SIGTERM during streaming.
- Risk: Low - watch mode is designed for benign process termination and handles JSONL parsing robustly.
- Priority: Medium. Add tests for SIGTERM handling and out-of-order record scenarios before future v0.2 watch mode enhancements.

**Parallel mode edge cases:**
- Files: `tests/parallel-prepare.test.mjs`, `tests/parallel-fan-in.test.mjs`, `tests/parallel-integration.test.mjs`
- What's not fully tested: Failure scenarios where individual section runners fail mid-execution (e.g., one section runner crashes, another is still running). Current tests assume all runners complete or all fail together.
- Risk: Medium - if a section runner crashes, the fan-in logic may hang or produce inconsistent output.
- Priority: High. Add tests for partial failure scenarios and timeout handling before parallel mode is heavily used.

**Concurrency and timeout scenarios:**
- Files: Consensus loop, session observer watch
- What's not tested: Behavior under extreme load (10+ sections in parallel, 1000+ transcript records in watch mode). No stress tests present.
- Risk: Low for v0.1 (small-scale use cases). Could become relevant if consensus is used at scale.
- Priority: Low. Defer stress testing until usage patterns emerge.

## Scaling Limits

### Consensus Input Size

- **Current limit:** 1 MB input file size (`INPUT_SIZE_CAP_BYTES`)
- **Current tested scale:** Small to medium drafts (< 1 MB). No testing with multi-megabyte files.
- **Scaling path:** Increase `INPUT_SIZE_CAP_BYTES` and test with large documents. May require chunking or section-level filtering in future versions.

### Session Observer Transcript Size

- **Current capacity:** Handles transcript files up to a few GB (limited by available RAM for JSONL parsing). No explicit cap.
- **Tested at:** Medium-sized transcripts (< 100 MB). Not stress-tested at multi-GB scale.
- **Scaling path:** Consider streaming JSONL parser if transcripts grow beyond 1 GB.

### Parallel Mode Section Count

- **Current capacity:** Tested with up to ~20 sections in parallel mode. No explicit upper limit in code.
- **Tested at:** Small to medium section counts (< 10 sections). Parallel integration tests use ~3 sections.
- **Scaling path:** Test with 50+ sections and add concurrency limits if needed. Current design uses host-mediated dispatch, so scaling is bounded by host agent's subprocess management.

## Dependencies at Risk

### Paseo CLI (Required for Consensus)

- **Risk:** External CLI dependency, not vendored. Must be installed globally via `npm install -g @getpaseo/cli`.
- **Version constraint:** Tested against range 0.1.0 to 0.9.0. Warning emitted if version outside range.
- **Impact:** If Paseo is uninstalled or unavailable, consensus plugin cannot run. Version mismatches may cause silent failures.
- **Mitigation:** Preflight check via `preflightPaseo()` validates availability and version before spawning. Helper script `scripts/install-paseo.mjs` assists with installation.
- **Migration plan:** No alternative CLI library. Paseo is the only way to invoke multiple peer CLIs. If Paseo becomes unavailable, consensus workflows would need to be redesigned.

### Node.js Standard Library (No External Dependencies)

- **Risk:** Low. Repository uses only Node.js standard library (no npm dependencies in production code).
- **Impact:** Code is immune to npm ecosystem supply chain attacks and version conflicts.
- **Mitigation:** Excellent long-term sustainability. Keeps code portable and compatible across Node.js versions.

## Missing Critical Features

### Marketplace Integration

- **Issue:** Published Git and marketplace install flows are not yet v0.1 release claims. Consensus plugin and skills are not submitted to public marketplaces (e.g., Claude Code marketplace, Cursor marketplace, skills.sh).
- **Blocks:** Users cannot discover or install via standard marketplace mechanisms. Local Git checkout required.
- **Documentation:** `README.md` (lines 51-79) explains local repository install only. `skills.sh` listing is deferred until indexing is verified after publication.
- **Path to v0.1 release:** Verify live provider paths and submit to public marketplaces before tagging release.

### Provider Marketplace Submission Status

- **Codex:** Public marketplace submission is not assumed. Git/local install is the v0.1 path.
- **Claude Code:** Local marketplace registration required. CLI commands documented in README.
- **Cursor:** Local plugin directory loading only. No marketplace or plugin CLI support yet.
- **Impact:** Friction for users who expect standard install flows.

## Documentation Concerns

### Release Checklist Gap

- **Issue:** README and plugin README both state "Published Git and marketplace install flows are not release claims yet. Re-check provider CLIs and marketplace flows before tagging v0.1."
- **Files:** `README.md` (line 79), `plugins/consensus/README.md` (line 37)
- **Impact:** No formal checklist exists. Risk of tagging v0.1 without verifying all install paths.
- **Fix approach:** Create a formal release checklist in `RELEASING.md` that includes verification steps for each provider's marketplace and install mechanism.

---

_Concerns audit: 2026-06-12_
