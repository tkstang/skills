# OAT Backlog Completed

> Summary archive for completed backlog work. Keep newest entries first. Use `backlog/archived/` for full file-per-item historical records when a completed item still needs rich context.

## Entry Format

- `YYYY-MM-DD — bl-XXXX — Title — one-line outcome summary`

## Completed Items

- 2026-06-19 — bl-bb7e — Investigate in-house peer-invocation CLI to reduce/replace the external peer-run dependency — completed by the `consensus-peer-invocation` project: shipped an owned `consensus` provider CLI with provider inventory/preflight/run envelopes, Claude/Codex/Cursor adapters, host recursion guard, runtime policy validation, bounded subprocesses/probes, provider-neutral diagnostics, generated runtime output, Refine/Evaluate default cutover, source cleanup, and final review pass. Cursor submit-tool remains deferred; Cursor live use was gated on local keychain/auth state until bl-f0b6, which has since verified authenticated Cursor peer E2E (Refine + Evaluate with `--peers cursor,codex`).
- 2026-06-18 — bl-bfb4 — Migrate consensus + tests to real TypeScript types — initiative completed by PR4 (`repo-tooling-vitest-final-cleanup`): converted the remaining 13 repo/tooling `.test.mjs` suites to Vitest `.test.ts`, harmonized the 9 session-observer suites from `node:assert/strict` to `expect` (whole repo on one convention), retired the `node:test` compatibility runner (`pnpm test` is Vitest-only), and added a guard (`tests/tooling/no-node-test-runner.test.ts`) that fails on any new `node:test`/`node:assert`/`.test.mjs`. Earlier slices under this initiative: consensus refine, transcript-core, export-session-transcript, and session-observer canonical TypeScript source + Vitest coverage. Behavior preserved 1:1; dev-tooling only (shipped skills unaffected).
- 2026-06-13 — bl-7af0 — Add parallel-synthesized iteration mode — shipped `parallel_synthesized` (parallel revision + wrapper-driven per-round synthesis merge, `--synthesizer` override) plus the agency-gated escalation ladder (deterministic triggers × host/user routing, `--host-direction`/`--host-decision-kind` re-entry, genuinely-stuck promotion). Two-tier synthesis-mediation design gate resolved (DR-018). Merged to `main` via PR #9.
- 2026-06-13 — bl-5d49 — Add parallel-revision iteration mode — shipped `parallel_revision` (both peers revise simultaneously each round with own/peer critique; emergent same-round convergence) on the refine wrapper; mode recorded in frontmatter/records/resolution, resume + host-mediated parallel dispatch compose. Verified live with claude+codex. Merged to `main` via PR #9.
