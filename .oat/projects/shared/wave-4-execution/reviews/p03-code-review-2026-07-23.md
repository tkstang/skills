# Phase Review: wave-4/p03 (2026-07-23)

- Wave: wave-4-execution
- Phase: p03
- Branch: `wave-4/p03` (commit `9283916`)
- Base: `a9532b88f83741cf3ef2d32974ca456ced755570`
- Worktree: `/Users/tstang/Code/repo-improve-2/.worktrees/wave-4/p03`
- Contract: `.oat/repo/reference/external-plans/2026-07-17-live-provider-e2e-visibility.md`

## Verdict: PASS

## Justification

All Review-focus items and Done criteria are satisfied. The e2e test's gating helper was tightened so that `CONSENSUS_LIVE_SUBMIT_E2E` unset still short-circuits to a silent skip via `it.skipIf(!liveE2eRequested)` (no provider readiness check on that path), while `=1` with no usable provider now throws a clear, actionable error instead of skipping — verified live in both directions in the worktree. `live-e2e.yml` is `workflow_dispatch`-only (no other trigger keys), `permissions: contents: read`, documents required secret names in header comments, and wires them into job `env` only via `${{ secrets.NAME }}` references (no literal values anywhere in the file); its three action pins byte-match the SHAs used elsewhere in the repo's other workflows. RELEASING.md's new run-or-waive line sits directly after the pre-existing manual live-e2e-runbook bullet, and the pre-existing `consensus.mjs` SHA-256 checksum bullet (from p01) is untouched. AGENTS.md gained exactly one inserted line in its Verification section with no other diff. The `tests/repo/package-metadata.test.ts` change is exactly the new `test:live-e2e` entry added to the expected script list (alphabetically placed, no other edits). Scope is exactly the 6 named files, the commit message is Conventional Commits (`ci(p03-t01): ...`), and no `.oat/` files were touched by the phase commit. `pnpm test` (1170 passed, 1 skipped) and `npm run validate` both pass in the worktree, and `git status --short` is clean.

## Verification detail

1. **Skip-vs-fail semantics** — Diff of `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts`: `liveE2eRequested = process.env.CONSENSUS_LIVE_SUBMIT_E2E === '1'` is computed independently of provider readiness, and `it.skipIf(!liveE2eRequested)` gates on that boolean alone, so the skip path (env unset) never calls `resolveLiveConfig()`/preflight — `pnpm test` cannot regress into evaluating provider readiness by default. When `liveE2eRequested` is true but `resolveLiveConfig()` returns `undefined` (no ready provider), the test body throws a descriptive `Error` naming the provider, the exact preflight command to reproduce, and the remediation step, rather than skipping.
   - Ran `npx vitest run tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts` with `CONSENSUS_LIVE_SUBMIT_E2E` unset → **1 skipped**, as required.
   - Ran the same test with `CONSENSUS_LIVE_SUBMIT_E2E=1` and `PATH` restricted to exclude the `codex`/`claude`/`cursor` CLI directories (credential-less proof without touching real credentials) → **1 failed**, with the expected loud error message (`CONSENSUS_LIVE_SUBMIT_E2E=1 was set, but no usable "codex" provider was found...`).
   - Independently ran `node plugins/consensus/scripts/consensus.mjs preflight --json --provider codex` under the same restricted `PATH` → `status: "missing"`, `warnings: ["PROVIDER_MISSING: executable not found for codex (codex)"]`, confirming the failure is driven by genuine provider-CLI absence, not a stubbed/forced condition. PATH restriction (rather than credential removal) is a sound, non-destructive way to exercise this path in a review sandbox and it exercises the real preflight subprocess the test itself invokes.

2. **Workflow secret handling** — `.github/workflows/live-e2e.yml` header comment documents `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CURSOR_API_KEY` as illustrative secret names an operator must configure (workflow does not create them). The job `env` block references them only via GitHub Actions' `${{ secrets.NAME }}` context — this is the standard idiom for making a secret available to a step without ever writing its value into the file; no literal secret value appears anywhere in the diff. Trigger block is `on: workflow_dispatch:` only (`grep -nE "^\s*(on|workflow_dispatch|pull_request|push|schedule):"` shows exactly `on:` and `workflow_dispatch:`, no `pull_request`/`push`/`schedule` keys); `grep -c "workflow_dispatch"` → 1. `permissions: contents: read` present at workflow scope. All three `uses:` pins (`actions/checkout`, `pnpm/action-setup`, `actions/setup-node`) byte-match the same SHAs used in `validate.yml`, `release.yml`, and `deploy-docs.yml`.

3. **RELEASING.md** — New run-or-waive bullet (`Run \`pnpm run test:live-e2e\` (or record why it was waived...)`) is inserted immediately after the pre-existing "Run the live provider E2E release gate in `plugins/consensus/references/live-e2e.md`..." bullet, correctly framing itself as the automatable subset rather than a replacement. The p01-added checksum-publishing bullet (`Publish the consensus.mjs SHA-256 checksum...`) further down the checklist is byte-identical to base — untouched.

4. **AGENTS.md** — `git diff` shows exactly one added line (`Run \`pnpm run test:live-e2e\` as the opt-in live-provider gate...`) appended to the existing Verification bullet list, zero deletions, zero reformatting.

5. **tests/repo/package-metadata.test.ts** — Diff adds exactly one line, `'test:live-e2e',`, inserted alphabetically between `'test'` and `'test:vitest'` in the expected-scripts array; this is necessary collateral for the new `package.json` script and does not touch or weaken any other assertion in the file.

6. **Credential-less verification method (judgment)** — Sound. Restricting `PATH` to exclude the provider CLI directories forces the same `PROVIDER_MISSING` code path that a genuinely credential-less/uninstalled-CLI environment would hit (confirmed via the raw `preflight --json` output showing `status: "missing"`), without requiring destructive removal of the reviewer's actual installed/authenticated CLIs. This is a faithful proof of the loud-failure path.

7. **Scope and hygiene** — Diff touches exactly 6 files: `.github/workflows/live-e2e.yml`, `AGENTS.md`, `RELEASING.md`, `package.json`, `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts`, `tests/repo/package-metadata.test.ts`. Commit `9283916` is `ci(p03-t01): surface the live provider E2E gate` (Conventional Commits). `git status --short` in the worktree is clean. No `.oat/` paths appear in the commit's file list.

## Note on the flagged pre-existing live-contract mismatch (context, not in scope)

The orchestrator flagged that the implementer's earlier accidental live call surfaced a pre-existing mismatch: the live test asserts `envelope.diagnostics` `verdict_source: 'submit'` (line ~62), while some live runs apparently report `'final_message'`. Confirmed via `git show a9532b88...:tests/.../submit-live.e2e.test.ts` that this assertion is byte-identical to base — this phase's diff does not touch it, weaken it, or otherwise encode any assumption that would mask the mismatch. If the live gate is deliberately run against a provider that emits `final_message`, the test will still fail on this assertion exactly as it would have before this phase. No action needed from this phase; the orchestrator's planned follow-up to investigate the mismatch itself remains appropriate.

## Findings requiring action

None.
