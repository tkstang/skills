---
oat_generated: true
oat_generated_at: 2026-07-17
oat_source_head_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_source_main_merge_base_sha: 6c03afde1417fbe29f0e2c81009629f0e36ca945
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Codebase Concerns

**Analysis Date:** 2026-07-17

## Tech Debt

**Generated output configuration maintenance:**

- Issue: Lint/format config (`oxfmt`, `oxlint`, `lintstagedrc`) must manually maintain exact-path entries for every generated output. If the build moves to globbed ignore patterns, these entries will silently allow drift.
- Files: `tests/tooling/generated-output-sync.test.ts:274`, `.oxfmtrc.json`, `.oxlintrc.json`, `.lintstagedrc.mjs`
- Impact: Configuration could become stale after build refactoring, potentially allowing committed generated output drift that breaks shipped skills.
- Fix approach: Refactor configs to use glob patterns where possible, or add a validation script that automatically updates exclusions from `scripts/build-generated.mjs` mappings.

**Large monolithic modules:**

- Issue: Core consensus and session-observer files are large and complex (3961 lines in `consensus-loop.ts`, 3890 lines in `consensus-refine.ts`, 1749 lines in `session-observer.ts`), with high control-flow density (126 control-flow statements in refine alone).
- Files: `src/consensus/core/consensus-loop.ts`, `src/consensus/refine/consensus-refine.ts`, `src/transcript/session-observer/session-observer.ts`, `src/transcript/session-observer/lib/watch.ts` (1265 lines)
- Impact: Difficult to understand, test, and modify safely. Higher risk of introducing subtle bugs during maintenance or feature changes.
- Fix approach: Consider domain-driven refactoring to break these into smaller, focused modules with clear internal boundaries. Start with consensus-refine wrapper orchestration layers.

## Known Limitations

**Multi-observer (N>2) collaboration not yet safe:**

- Limitation: Session-observer-collab deliberately supports only one user plus two mutually observing agents (N=2). Scaling to N>2 requires per-observer offset namespacing and duplicate-watcher locking to prevent data loss or duplicate delivery.
- Files: `src/transcript/session-observer/lib/state.ts` (lock-protected, currently global per session), `skills/session-observer-collab/SKILL.md`
- Scope: Tracked in `.oat/repo/pjm/backlog/items/BL-260713-per-observer-offsets-and-safe.md` (status: open, priority: low, scope: v2)
- Workaround: Current implementation remains safe for documented N=2 topology only. Users attempting N>2 setups may experience race conditions, duplicate events, or lost records.
- Path to fix: Design per-observer offset namespaces, implement identity-aware locking, add N>2 integration tests with concurrent reader races and restart/recovery scenarios.

## Performance Bottlenecks

**Provider CLI subprocess timeout cascade:**

- Problem: Subprocess termination uses cascading signal escalation (SIGTERM → wait 250ms → SIGKILL → wait 1000ms) with hardcoded timeouts and multiple setTimeout/clearTimeout chains. Complex state tracking during escalation.
- Files: `src/consensus/provider-cli/subprocess.ts:122-136`, `runProviderSubprocess` function
- Cause: Handling edge cases where processes ignore SIGTERM, require SIGKILL, or hang after SIGKILL; multiple concurrent timers create state ordering complexity.
- Observation: The implementation appears correct and well-tested (`tests/consensus/provider-cli/subprocess.test.ts` covers signal termination), but the code is densely nested and would benefit from refactoring into explicit state machine or clearer synchronization primitives.
- Improvement path: Not urgent (verified behavior), but consider extracting into a reusable `ProcessTerminator` utility if similar patterns emerge elsewhere.

**Watch loop stat polling interval:**

- Problem: Session-observer watch uses a 2-second default poll interval with 2-second debounce coalescing. For high-frequency transcript updates, this introduces latency between agent action and digest emission.
- Files: `src/transcript/session-observer/lib/watch.ts:30-33` (`DEFAULT_POLL_SEC`, `DEFAULT_DEBOUNCE_SEC`), `DEFAULT_HEARTBEAT_SEC` (120s)
- Cause: Foreground polling watcher trade-off: lower intervals increase CPU/stat overhead, higher intervals increase catch-up latency.
- Observation: Documented configurable via environment variables. Current defaults are reasonable for typical interactive agent workflows.
- Improvement path: No action required unless telemetry shows missed updates; consider adding metrics/observability to measure actual update-to-digest latency in production.

## Fragile Areas

**Watch test suite timing sensitivity:**

- Files: `tests/session-observer/watch.test.ts` (2132 lines)
- Why fragile: Previous iteration had race conditions in signal handling and timer-based state transitions. Now uses injectable virtual clock driven by observable loop progress (lock/poll stamps, directive consumption), but remains complex.
- Safe modification: The de-flaking pass (BL-260621) moved from wall-clock timing to observable-progress-based wait loops. Any new watch tests must follow the same pattern — set up injectable clock and wait on specific loop milestones, not time deltas.
- Test coverage: De-flaked suite verified at 50 iterations under 50-proc CPU starvation with zero failures. Currently green on main; no known flakiness. If flakes reappear, compare timing math against the observable progress guards in existing tests.
- Known fix in place: SIGTERM/SIGINT handlers now installed before `watch.json.active` is announced, fixing a real startup race (session-observer 1.0.0→1.0.1 in BL-260621).

**State lock-based persistence in session-observer:**

- Files: `src/transcript/session-observer/lib/state.ts` (lock-protected read/write), `src/transcript/session-observer/lib/watch-state.ts`
- Why fragile: File-based locking with `open(..., 'wx')` for exclusive create, retry-up-to-N pattern. Assumes POSIX semantics; behavior on Windows or networked filesystems may differ. Stale PID cleanup required for robustness after process crash.
- Safe modification: Lock acquisition is well-tested but hidden behind the public `load()` / `mutate()` API surface. Do not call `readState()` directly without holding the lock. Stale PID detection (`watch-state.ts` cleanup) runs on every watch state load — verify this logic if changing PID handling or adding multiprocess scenarios.
- Test coverage: Lock contention and stale PID cleanup are covered. Filesystem-specific behavior (Windows/CIFS) is not validated.

**Consensus verdict JSON parsing:**

- Files: Multiple consensus skills parse verdict JSON from provider CLI output: `src/consensus/core/consensus-loop.ts:2040+`, `src/consensus/refine/consensus-refine.ts:600+`, verdict field normalization across skills
- Why fragile: Verdict schema varies slightly by iteration mode (alternating vs. parallel) and provider (Claude strict-output vs. Codex JSON vs. Cursor prompt-only). Each provider can return malformed or partially-compliant JSON; retry and validation paths must handle graceful degradation.
- Safe modification: All verdict parsing happens inside error-handling try-catch blocks with detailed error classification (see `exitCodeForError`). Do not add new verdict fields without updating all parsing sites — search for `verdict` field access patterns before adding support for new verdict types.
- Test coverage: Provider CLI-backed parsing is tested with real provider fixtures for all three providers (claude, codex, cursor). Schema compliance and error recovery are tested in `tests/consensus/core/` and `tests/consensus/refine/wrapper-options.test.ts`.

## Scaling Limits

**Provider subprocess output buffering:**

- Current capacity: Default 10MB max output capture (`DEFAULT_MAX_OUTPUT_BYTES` in `subprocess.ts`). Exceeding this cap terminates the subprocess with `PROVIDER_OUTPUT_CAP_EXCEEDED`.
- Limit: Large artifact deliberations (e.g., refinement of 5MB markdown documents) could hit this cap if either peer produces very verbose intermediate reasoning.
- Scaling path: Increase `maxOutputBytes` option (configurable per invocation) or implement streaming/chunked output capture if multi-megabyte artifacts become common. Current cap is enforced early (stream-level), so exceeding it is a hard stop, not a graceful degradation.

**Consensus loop in-memory record accumulation:**

- Current capacity: Each turn's peer invocations, verdicts, synthesis results, and escalation records accumulate in memory as a flat JSONL-like array within the `deliberation` artifact.
- Limit: Very deep deliberations (50+ rounds) or high-agency escalation scenarios with many unresolved disagreements could consume significant memory. No windowing or archival implemented.
- Scaling path: Records remain immutable and are written atomically, so large artifacts are safe but slow. If memory becomes an issue, consider: (1) lazy-loading historical records when resuming, or (2) writing completed deliberations to disk in phases rather than holding full state.

## Dependencies at Risk

**Provider CLI availability assumption:**

- Risk: Consensus skills require the `consensus` provider CLI (`plugins/consensus/scripts/consensus.mjs`). If the CLI path breaks or config changes incompatibly, all consensus skills fail immediately at preflight with `CONSENSUS_PROVIDER_CLI_MISSING` or `PROVIDER_NOT_FOUND`.
- Impact: Users installing only standalone skills (`session-observer`, `export-session-transcript`) are unaffected. Users trying to use consensus skills without the plugin installed or available will see an actionable error. Current mitigation: `install.sh` guides setup; `.consensus/` resolver fallback added; instructions in skill docs.
- Migration path: None currently needed. Consensus skills are bundled with the plugin and the CLI is part of the release package. Keep the plugin release-synchronized with standalone skills.

**Node >=22 requirement:**

- Risk: The shipped skills assume Node >=22 standard library APIs (e.g., `fs/promises`, `path`, `crypto`, `child_process`). Older versions will lack required APIs and fail at import time.
- Impact: CI and documentation emphasize Node >=22. Shipped `.mjs` files carry no version checks; runtime discovery of missing APIs will manifest as `require` or import-time errors.
- Mitigation: The dependency is explicit in `package.json` (`"engines": { "node": ">=22" }`) and documented in the README and skill manifests. No workaround for older Node versions.

## Test Coverage Gaps

**Provider CLI cross-platform behavior:**

- What's not tested: Cursor provider keychain/auth behavior on non-macOS systems. Provider subprocess signal handling on Windows. Output capture size limits and timeout escalation under resource-starved conditions.
- Files: `tests/consensus/provider-cli/subprocess.test.ts` (focuses on POSIX signals and timeouts)
- Risk: Cursor E2E is live-validated on macOS only. Windows and Linux Cursor behavior is documented but untested. Provider timeouts under memory/CPU starvation are mocked, not reproduced.
- Priority: Medium. The provider CLI is hardened and tested for the documented platforms (Claude Code, Codex, Cursor on macOS/Linux). Cursor on Windows is a gap. If non-macOS Cursor usage becomes common, add Windows-specific test fixtures or CI agents.

**Consensus refine resume edge cases:**

- What's not tested: Resume after corruption of specific resume fields (e.g., `resume_metadata` vs. `last_round` vs. section status blocks). Interaction between mid-loop user edits and subsequent resumes (current design rejects mid-loop edits; this should be explicit in tests).
- Files: `tests/consensus/refine/resume-parse.test.ts` (710 lines) covers parsing, but edge-case recovery scenarios are sparse.
- Risk: A corrupted resume artifact passed to `--resume` could cause silent misinterpretation of state or skipped sections. The current impl fails closed (rejects on parse error), but the test surface is narrow.
- Priority: Low to Medium. Resume is covered by smoke tests and focused unit tests, but a deeper integration suite for corruption recovery and mid-loop interactions would add confidence.

**Session-observer state migration and corruption recovery:**

- What's not tested: Transition from v0 to v1 state format, recovery from half-written corrupt `state.json` (due to SIGKILL or disk full), behavior when lock file is left behind after abnormal termination.
- Files: `src/transcript/session-observer/lib/state.ts` has backup-write and migration logic; tests cover normal happy path and lock contention.
- Risk: If a watcher crashes mid-write, the next watcher will need to handle a partial or corrupt state file. Current code has `readState()` with backup writes, but the test surface for actual corruption scenarios is thin.
- Priority: Low. The lock-based approach is sound, and stale PID cleanup runs automatically. If users report state corruption in the wild, add targeted corruption-recovery tests.

---

_Concerns audit: 2026-07-17_
