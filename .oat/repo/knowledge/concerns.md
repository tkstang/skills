---
oat_generated: true
oat_generated_at: 2026-08-31
oat_source_head_sha: ae313c5bb6e54d521b4b00d0f44993b8fdf72ecc
oat_source_main_merge_base_sha: 467efe57bcb5e40b2cfb09c77507aa50e4c1cc44
oat_warning: 'GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index'
---

# Codebase Concerns

**Analysis Date:** 2026-08-31

## Tech Debt

**Duplicated provider-CLI command runners:**

- Issue: `runProviderCliCommand` is maintained independently in the consensus loop and the panel wrapper. Both copies own subprocess spawning, timeout, SIGTERM/SIGKILL escalation, and forced settlement behavior. The source comments explicitly call out the twin implementation and deferred unification.
- Files: `src/consensus/core/loop-provider.ts`, `src/consensus/panel/consensus-panel.ts`, `.oat/repo/pjm/backlog/items/BL-260723-split-loop-free-cli-helpers.md`
- Impact: A hardening change to timeout, child-process, output, or error semantics can reach convergence workflows but not panels (or the reverse). The panel must remain decoupled from the loop, so importing the existing loop-coupled helpers would regress that boundary.
- Fix approach: The open backlog item `BL-260723-split-loop-free-cli-helpers` records extracting loop-free pure helpers while retaining the loop-only error and write helpers at their current boundary.

**Non-atomic consensus-loop write sites:**

- Issue: `writeSectionOutput` and `seedRecordsFile` write directly to their target paths, while `src/consensus/core/loop-records.ts` provides an atomic temp-and-rename writer for other loop records.
- Files: `src/consensus/core/consensus-loop.ts`, `src/consensus/core/loop-records.ts`, `.oat/repo/pjm/backlog/items/BL-260723-make-remaining-consensus-loop.md`
- Impact: An interrupted write can leave a section output or initial record file partially written. Resume and fan-in consume these artifacts, so an interrupted run can turn into a parse or recovery failure rather than preserving the prior complete file.
- Fix approach: `BL-260723-make-remaining-consensus-loop` tracks conversion of both direct writes to the existing atomic writer and specifies crash-survival tests.

## Known Bugs

**Live Codex verdict-source contract mismatch:**

- Symptoms: A documented real authenticated Codex run produced `verdict_source: 'final_message'`, while the live E2E test and stub fixtures require `verdict_source: 'submit'`.
- Files: `.oat/repo/pjm/backlog/items/BL-260723-investigate-live-submit.md`, `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts`, `src/consensus/provider-cli/structured-output.ts`
- Trigger: Run `pnpm run test:live-e2e` against an authenticated Codex provider. The test is opt-in because it consumes provider quota; when enabled it asserts sidecar submission, while runtime code intentionally falls back to parsing the provider's final message if no valid submission sidecar is found.
- Workaround: No reconciled workaround is recorded. `BL-260723-investigate-live-submit` remains open to establish whether the live sidecar path or the asserted fixture contract is wrong before changing the assertion or runtime.

## Security Considerations

**Provider-backed handling of sensitive context and untrusted content:**

- Risk: Consensus questions, briefs, artifacts, and rubrics are passed to external provider CLIs. Prompt framing and schema checks reduce instruction-following risk, but a provider can still return structurally valid, unsafe, or incorrect advice. Sensitive material may also leave the local process boundary when a user authorizes it for a provider-backed run.
- Files: `src/consensus/provider-cli/runtime-policy.ts`, `src/consensus/provider-cli/structured-output.ts`, `src/consensus/panel/consensus-panel.ts`, `documentation/docs/user-guide/consensus/index.md`, `documentation/docs/user-guide/consensus/panel.md`
- Current mitigation: Child environments start from a base and provider-specific allowlist rather than inheriting every parent environment; subprocesses use argument arrays with `shell: false`; panel prompts label the question as untrusted; documentation requires explicit approval before sending sensitive/private context and says to review audit trails before publishing.
- Residual boundary: `documentation/docs/user-guide/consensus/index.md` explicitly states that prompt-injection mitigation cannot prevent structurally valid bad advice. Semantic safety and context authorization remain operator responsibilities.

**Transcript exports rely on pattern-based sanitization:**

- Risk: `export-session-transcript` removes known structural records and known text prefixes, but ordinary text that does not match the anchored matcher set can remain in a shareable Markdown export.
- Files: `src/transcript/export-session/sanitize.ts`, `src/transcript/export-session/export-session-transcript.ts`, `documentation/docs/user-guide/skills/export-session-transcript.md`
- Current mitigation: The exporter runs structural normalization followed by `HIDDEN_PAYLOAD_MATCHERS`, drops automatic-control metadata, and documents that exported output must be reviewed before publication.
- Residual boundary: The sanitizer is intentionally matcher-based rather than a complete information-flow classifier; new runtime wrapper shapes or private information written as normal conversation text require human review.

## Performance Bottlenecks

**Provider-call latency, quota use, and output capture in parallel deliberation:**

- Problem: A parallel-synthesized round performs two peer calls plus a synthesis call. The shared loop permits up to 100 rounds, and each provider subprocess defaults to a 300-second timeout and a 10 MiB combined stdout/stderr cap.
- Files: `src/consensus/core/loop-validation.ts`, `src/consensus/shared/cli-helpers.ts`, `src/consensus/provider-cli/subprocess.ts`, `documentation/docs/user-guide/consensus/index.md`
- Cause: Runtime work is dominated by external CLIs and provider responses rather than local computation. The current artifacts report calls/rounds, but token, wall-clock, and cost metrics/caps are not consistently available.
- Improvement path: `.oat/repo/pjm/backlog/items/BL-260612-add-deliberation-metrics.md` tracks normalized metrics and investigation of cost-cap feasibility; it is open and low priority.

**Large transcript scans and content processing:**

- Problem: The session skills read and parse provider-owned JSONL transcript stores, then normalize and sanitize entries before rendering digests or exports.
- Files: `src/transcript/core/runtimes.ts`, `src/transcript/core/cursor-analysis.ts`, `src/transcript/export-session/export-session-transcript.ts`, `src/transcript/session-observer/lib/observe.ts`
- Cause: The local stores are treated as append-only transcript data and the parser needs content/turn context to classify records; the exporter also enumerates candidates for a working directory.
- Improvement path: Current behavior is bounded by selected sessions and state checkpoints. No open current-source item identifies a further caching or indexing implementation for this path; performance at unusually large transcript sizes is not characterized in the repository.

## Fragile Areas

**Cursor continuity state and recovery:**

- Files: `src/transcript/session-observer/lib/cursor-state.ts`, `src/transcript/session-observer/lib/state.ts`, `tests/session-observer/cursor-state.test.ts`, `documentation/docs/user-guide/skills/session-observer.md`
- Why fragile: Continuity depends on a stable transcript path, device/inode identity, frame count, and a verified prefix hash. Shrinkage, replacement, rotation, prefix mismatch, corrupt state, or a schema mismatch fails closed. For corrupt/schema-invalid shared Cursor state, the supported recovery resets the whole Cursor store and cannot preserve sibling sessions.
- Safe modification: Preserve the fail-closed continuity checks, atomic-state/owner-lock protocol, and destructive-recovery diagnostics. Changes must retain the same recovery scope and sibling-session truthfulness.
- Test coverage: Extensive synthetic coverage exists for continuity and destructive recovery in `tests/session-observer/cursor-state.test.ts`; live Cursor transcript schema compatibility remains an external-runtime dependency rather than a default CI guarantee.

**Generated runtime fan-out:**

- Files: `src/transcript/`, `src/consensus/`, `scripts/build-generated.mjs`, `skills/session-observer/scripts/`, `skills/export-session-transcript/scripts/`, `plugins/consensus/scripts/`, `tests/tooling/generated-output-sync.test.ts`
- Why fragile: Canonical TypeScript is emitted into multiple shipped `.mjs` targets. A source edit requires regeneration and synchronized ignore/validation mappings; direct edits to generated outputs are overwritten or create source/output drift.
- Safe modification: Change canonical `src/` files and use `scripts/build-generated.mjs`; the generated-output-sync test is the repository check for mapping and output consistency.
- Test coverage: `tests/tooling/generated-output-sync.test.ts` checks generated drift, but source and generated output remain separate files with a broad build fan-out.

## Scaling Limits

**Section-parallel refine dispatch:**

- Current capacity: `parallelismFor` defaults to at most four concurrent sections. A caller-supplied `--parallelism` is only bounded by the number of parsed sections; argument parsing accepts positive safe integers.
- Limit: The refine CLI prepares a manifest and emits `parallel_dispatch_required`; it does not itself implement host-native section dispatch. A host must have an authorized dispatch surface, and provider-only first-scope adapters advertise `supports_host_native_dispatch: false`.
- Scaling path: `BL-260619-define-host-native-dispatch` is the open design gate for the safe packet, history boundary, audit fields, and authorization contract. There is no shipped N-way host-dispatch implementation.
- Files: `src/consensus/refine/refine-sections.ts`, `src/consensus/refine/refine-args.ts`, `src/consensus/refine/consensus-refine.ts`, `src/consensus/provider-cli/adapters.ts`, `.oat/repo/pjm/backlog/items/BL-260619-define-host-native-dispatch.md`

**Two-peer consensus and N=2 observer collaboration:**

- Current capacity: Consensus convergence is modeled around two symmetric peers; the collaboration skill supports one user and two mutually observing agents.
- Limit: Three-or-more peer convergence has no implemented tie, aggregation, or cost model. Shared observer state does not provide independent consumer offsets or duplicate-watcher safety for an N>2 mesh.
- Scaling path: The deliberately deferred design items are `BL-260619-multi-peer-3-deliberation` and `BL-260713-per-observer-offsets-and-safe`.
- Files: `src/consensus/core/loop-validation.ts`, `.oat/repo/pjm/backlog/items/BL-260619-multi-peer-3-deliberation.md`, `.oat/repo/pjm/backlog/items/BL-260713-per-observer-offsets-and-safe.md`

## Dependencies at Risk

**Externally evolving provider CLIs:**

- Risk: Claude, Codex, and Cursor are executed as external CLIs. Adapter readiness and failure classification rely on their executable names, supported flags/capabilities, and output signatures; some provider-specific transient patterns are tied to observed installed CLI behavior.
- Impact: A provider CLI upgrade can change authentication, option, structured-output, or failure behavior without a TypeScript source change in this repository.
- Migration plan: The current implementation uses inventory/preflight diagnostics and conservative terminal defaults. The manual-only live E2E workflow pins Codex and Claude installs for that workflow, while Cursor requires a self-hosted authenticated runner because no reproducible GitHub-hosted install path is supplied.
- Files: `src/consensus/provider-cli/adapters.ts`, `src/consensus/provider-cli/probe.ts`, `.github/workflows/live-e2e.yml`, `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts`

## Missing Critical Features

**Consensus quality, cost, and strict-submission controls are deferred:**

- Problem: Section results are not harmonized across the final document; deliberation metrics and cost caps are unavailable; verdict submission is best-effort because final-message parsing is accepted when a valid sidecar is absent.
- Blocks: Large multi-section artifacts can retain cross-section terminology/flow drift, operators cannot impose a repository-provided cost budget, and consumers that require verified sidecar submission cannot demand it in the current contract.
- Files: `documentation/docs/user-guide/consensus/index.md`, `.oat/repo/pjm/backlog/items/BL-260612-add-whole-document.md`, `.oat/repo/pjm/backlog/items/BL-260612-add-deliberation-metrics.md`, `.oat/repo/pjm/backlog/items/BL-260723-investigate-live-submit.md`

**Session observer has no autonomous post-yield wake path:**

- Problem: Watch mode responds only while the active invocation keeps the foreground watcher alive and reads/re-polls it. Cursor SQLite chat history is also outside the supported transcript-store boundary.
- Blocks: A backgrounded watcher cannot autonomously notify a future Claude Code, Codex, or Cursor invocation after the current invocation yields; the collaboration layer uses buffered-manual catch-up when no proven wake surface exists.
- Files: `documentation/docs/user-guide/skills/session-observer.md`, `documentation/docs/user-guide/skills/session-observer-collab.md`, `skills/session-observer-collab/references/runtime-cursor.md`

## Test Coverage Gaps

**Default CI does not continuously validate real provider behavior:**

- What's not tested: The default Vitest suite uses fixtures/stubs for provider interactions. The sole real-provider submit test is skipped unless `CONSENSUS_LIVE_SUBMIT_E2E=1`, and the GitHub workflow is manual-dispatch-only to avoid spending provider quota. Cursor live E2E cannot run on a fresh GitHub-hosted runner.
- Files: `package.json`, `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts`, `.github/workflows/live-e2e.yml`
- Risk: Fixture behavior can diverge from changing provider CLIs; the open live submit verdict-source mismatch is concrete evidence of that category.
- Priority: High for provider-CLI release validation; intentionally opt-in for routine CI.

**No automated coverage threshold or coverage-report script is configured:**

- What's not tested: The repository runs Vitest, type checking, validation, build drift checks, and smoke tests, but `package.json` has no coverage script or threshold. The backlog explicitly records per-domain Vitest projects and coverage reporting as deferred work if the suite grows.
- Files: `package.json`, `.oat/repo/pjm/backlog/index.md`, `tests/`
- Risk: Broad test-file counts can obscure unexercised branches, especially at external CLI and runtime-parser boundaries.
- Priority: Medium.

---

_Concerns audit: 2026-08-31_
