---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-06-19
oat_generated: true
oat_summary_last_task: p05-t02
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Project Summary: consensus-peer-invocation

## Overview

This project replaced the consensus plugin's old external peer-invocation backend with an owned provider-neutral `consensus` CLI boundary. The first consumers are Consensus Refine and Consensus Evaluate; Stoa and Open Agent Toolkit shaped the CLI contract, but their migration stayed out of scope.

The implementation keeps shipped runtime code dependency-free and generated from canonical TypeScript. It targets the first provider floor of Claude, Codex, and Cursor while leaving future provider adapters and submit-tool verdict submission as explicit follow-ups.

## What Was Implemented

- Added canonical provider CLI source under `src/consensus/provider-cli/` and generated the shipped entrypoint at `plugins/consensus/scripts/consensus.mjs`.
- Defined provider-neutral request, envelope, capability, diagnostics, and error models for provider inventory, preflight, and one-shot runs.
- Implemented CLI argument/request normalization for prompt sources, request JSON, provider options, runtime policy, timeout, output caps, and host recursion depth.
- Added Claude, Codex, and Cursor adapter capabilities, readiness probes, child environment allowlisting, runtime policy validation, argv construction, bounded subprocess capture, and structured-output retry coordination.
- Integrated the provider CLI through the shared consensus-loop invocation seam for Refine and Evaluate, including provider-neutral audit fields such as `raw_provider_response`.
- Preserved the retry split: the provider CLI owns provider-tier failures, schema parsing/validation, output caps, and timeouts; the consensus loop owns verdict semantics, verdict caps, convergence, and resume.
- Switched Refine, Evaluate, and smoke flows to the provider CLI backend by default for new runs and removed temporary fallback switches.
- Updated maintained docs and release/operator QA references, removed old helper scripts/fixtures/test names, and added a provider-neutral cleanup scan.
- Added repo-reference updates after implementation: DR-023, bl-bb7e completion, and narrowed follow-ups for submit-tool hardening and authenticated Cursor verification.
- Resolved final-review v4 Minor artifact-alignment findings in `design.md` without changing runtime behavior.

## Key Decisions

- The provider CLI is a spawned executable contract, not a shared runtime import, so Refine, Evaluate, and future consumers can use the same local boundary without coupling to consensus internals.
- Claude uses inline JSON schema with redacted diagnostics, Codex uses file-path schema plus last-message extraction, and Cursor remains prompt-only with local validation/retry.
- Cursor submit-tool support remains reserved and deferred. `submit_tool_candidate` is not selected by default.
- Historical `.oat` artifacts and research remain untouched. Maintained source, runtime, tests, and docs were cleaned for the source-level cutover.
- Cross-cutover resume from old backend artifacts is a non-goal; new provider CLI-backed runs use provider-neutral fields.

## Design Deltas

- p02-t07 updated `tests/consensus/provider-cli/cli-process.test.ts` even though the task file list omitted it, because the generated CLI process contract needed to reflect implemented `run` behavior.
- p04-t06 expanded the cleanup scan to maintained root docs and instruction files, including `AGENTS.md` and `CHANGELOG.md`, after review found stale maintained-doc references.
- p04-t07 added a guarded Vitest timeout so exact `pnpm run premerge` passes reliably; focused reruns had already shown the behavior was correct.

## Notable Challenges

- p02 initially failed review because generated `provider ls` and `preflight` did not wire the default Node probe runner, so installed providers could appear missing. A new user-approved fix/review cycle resolved this and verified Claude/Codex ready plus Cursor `auth_required`.
- p03 review caught default generated `.mjs` execution and prepared parallel backend propagation issues. Fixes routed default generated provider CLI execution through Node and propagated backend selection through section packets.
- Final review found live provider CLI contract gaps around Claude/Codex flags, Codex last-message output, bounded probes, and request JSON validation. Follow-up fixes aligned the live provider contract and passed final re-review with no findings.

## Verification

- Focused provider CLI, Refine, Evaluate, wrapper, smoke, cleanup, and integration Vitest suites passed across phases.
- `pnpm run type-check`, `pnpm run build:check`, `npm run validate`, `npm run smoke`, and `pnpm run premerge` passed during the implementation/review cycle.
- Provider inventory/preflight checks covered Claude, Codex, and Cursor; Cursor currently reports `auth_required` due to local macOS keychain/auth state.
- Targeted stale-backend scans passed outside `.git` and historical `.oat` artifacts.
- Final review v4 passed after Minor artifact-alignment fixes in `design.md`.

## Follow-up Items

- bl-3a88: evaluate a future submit-tool or validated verdict-submission path as reliability hardening.
- bl-f0b6: verify Cursor as an authenticated peer end-to-end through the provider CLI once local auth/keychain state allows it.
- bl-e0e7: spike and, if viable, consolidate duplicated Refine/Evaluate generated loop output into a plugin-local shared runtime script.
- Future provider adapters such as Gemini, Kimi, OpenCode, OpenRouter, GLM, Pi, or local open-weight models remain extension work, not first-scope support.

## Associated Issues

- bl-bb7e: completed by this project.
- bl-3a88: left open and narrowed to future reliability hardening.
