---
oat_generated: true
oat_generated_at: 2026-06-20
oat_source_head_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_source_main_merge_base_sha: e4e9348cf8b809448c693ed7182c017048eb4acf
oat_warning: "GENERATED FILE - Do not edit manually. Regenerate with oat-repo-knowledge-index"
---

# Codebase Concerns

**Analysis Date:** 2026-06-20

> Context: this is a young (v0.1.0 pre-release) personal Agent Skills repo with a clean tree, zero `TODO`/`FIXME`/`HACK` markers in `src/`, and a strong invariant test suite. The concerns below are mostly structural fragility and release-readiness gaps rather than active bugs.

## Tech Debt

**Multi-file sync obligations for lint/format exclusions:**

- Issue: Format/lint exclusion lists must be kept identical across three places.
- Files: `.oxfmtrc.json`, `.oxlintrc.json`, `.lintstagedrc.mjs`, and the CI steps in `.github/workflows/validate.yml`.
- Impact: Drift means generated/synced files get formatted (fighting the generator) or CI diverges from local hooks.
- Fix approach: A single source of exclusion globs consumed by all three; until then, change them together.

**Generated `.mjs` outputs committed alongside canonical TS source:**

- Issue: Runtime `.mjs` is generated from `src/` but committed at the path users execute. Editing canonical TS without `pnpm run build` silently desyncs shipped output.
- Files: `src/**` → `plugins/consensus/skills/**/scripts/*.mjs`, `skills/*/scripts/**/*.mjs`.
- Impact: Shipped behavior can diverge from source if the build step is skipped.
- Fix approach: Guarded by `tests/tooling/generated-output-sync.test.ts` and `pnpm run build:check`; the discipline (build after editing `src/`) remains manual.

**Version triple-sync per skill:**

- Issue: A skill behavior change requires bumping the skill `version`, keeping top-level `version` + `metadata.version` in sync, and listing the skill in `SKILL_FILES` in `scripts/bump-version.mjs`.
- Files: each `SKILL.md`, `scripts/bump-version.mjs`, `scripts/validate.mjs`.
- Impact: Hand-editing one field leaves the validator failing or releases mislabeled.
- Fix approach: `scripts/bump-version.mjs` automates it when `SKILL_FILES` is complete; the risk is an unlisted skill.

## Known Bugs

- None currently identified. No open bug markers in source; tree is clean.

## Security Considerations

**Provider CLI subprocess boundary:**

- Risk: The only external execution surface is spawning local provider CLIs (`claude`, `codex`, `cursor-agent`) and passing prompts/artifacts.
- Files: `src/consensus/provider-cli/subprocess.ts`, `invocation.ts`, `host-guard.ts`, `runtime-policy.ts`.
- Current mitigation: Host guard + runtime policy gate invocation; subprocess enforces timeouts and output caps; failures classified into a closed error-code set. Auth is delegated to the CLIs (no secrets handled here).
- Recommendations: Keep argument construction injection-safe; continue treating provider stdout as untrusted when parsing structured output.

**Transcript sanitization for export:**

- Risk: Exported Markdown transcripts could leak hidden-payload content (system/developer instructions, skill bodies, subagent notifications) if sanitization misses a record shape.
- Files: `src/transcript/export-session/sanitize.ts`, `src/transcript/core/runtimes.ts`.
- Current mitigation: Two-layer sanitization (structural `normalizeEntries` + content `sanitizeEntries`) with dedicated `hidden-payloads.jsonl` fixtures per runtime.
- Recommendations: Add fixtures whenever a provider introduces a new record/payload shape.

## Performance Bottlenecks

- Not a meaningful concern for this workload. Operations are CLI-bound; latency is dominated by provider subprocess round-trips, not local code. No hot paths identified.

## Fragile Areas

**Provider runtime detection:**

- Files: env-var detection across `src/transcript/**` and `src/consensus/provider-cli/**` (`CLAUDECODE`, `CODEX_HOME`, `CURSOR_TRACE_ID`, etc.).
- Why fragile: Relies on host runtimes setting specific env vars and on per-provider transcript store layouts that vendors can change.
- Safe modification: Update `src/transcript/core/runtimes.ts` (single source) and rebuild; extend fixtures.
- Test coverage: Good — typical/malformed/partial-tail fixtures per runtime.

**Background-agent Write step (tooling, not shipped code):**

- Observation: During this very knowledge-index run, the parallel `oat-codebase-mapper` background agents completed exploration but stalled at the Write step; pending writes only flushed on stop. `stack.md` and `architecture.md` were agent-written; the remaining files were authored in the main thread as a fallback.
- Impact: The skill's parallel direct-write path is unreliable in this harness; the read-only fallback or main-thread authoring is more dependable.
- Note: This concerns the OAT tooling workflow, not the repository's shipped skills.

## Scaling Limits

- Not applicable. No service, no concurrency model beyond per-invocation subprocesses. The consensus parallel-section orchestration is bounded by host mediation and the configured iteration modes.

## Dependencies at Risk

**`typescript ^6.0.3`, `oxlint`/`oxfmt` (early-version dev tooling):**

- Risk: oxlint/oxfmt are fast-moving, pre-1.0-era tooling; TS 6 is recent. Breaking changes could affect dev workflow.
- Impact: Dev tooling only — shipped skills are unaffected (zero runtime deps).
- Migration plan: Pin versions (already done via lockfile); upgrade deliberately.

## Missing Critical Features

**Unverified live-provider / marketplace path:**

- Problem: Per `CLAUDE.md` and `RELEASING.md`, provider support, marketplace availability, and skills.sh discovery must not be documented as complete until the release checklist verifies the live provider path. The consensus plugin manifest still marks `permission_declaration: provisional` with a release-checklist item to verify Bash permission shape against the Claude runtime before v0.1 tagging.
- Blocks: Confident public release / marketplace publication.

## Test Coverage Gaps

**Live provider end-to-end:**

- What's not tested: Real provider CLI invocation (only stub binaries + mocked smoke flow run in the suite).
- Files: `src/consensus/provider-cli/**`.
- Risk: Real-CLI argument/permission/auth mismatches surface only at release verification.
- Priority: High (release-gating).

**Cross-platform (Windows):**

- What's not tested: Bash hooks, worktree scripts, and path handling on Windows.
- Risk: Developer-workflow breakage on non-Unix shells.
- Priority: Low (personal repo; macOS/Linux primary).

---

_Concerns audit: 2026-06-20_
