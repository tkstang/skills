---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-surface-the-live-provider-e2e
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Make the live-provider E2E verification gap visible in the release process

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.

## Outcome

The one test that exercises a real provider CLI (`claude`/`codex`/`cursor`) stops being invisibly skipped. Today `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts` is gated on `CONSENSUS_LIVE_SUBMIT_E2E=1`, never set in CI, and shows up only as "1 skipped" in a 1091-test run — while AGENTS.md identifies provider CLI subprocesses as the repo's *only external execution boundary*. The entire automated suite validates against hand-maintained stub fixtures. After this plan: a named script alias makes the live test runnable in one command, RELEASING.md's checklist explicitly requires (or explicitly waives, per release) running it, and a manual-dispatch CI workflow exists for environments with provider credentials — so the gap is a visible, deliberate decision instead of a silent skip.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (tests lane, TEST-04), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Verified evidence (read live at planning time):
  - `tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts:21` — `it.skipIf(!liveConfig)(...)`; line 79: `if (process.env.CONSENSUS_LIVE_SUBMIT_E2E !== '1') return undefined;`.
  - `.github/workflows/validate.yml` / `release.yml` — never set that env var (grep-verified during audit).
  - Every other consensus test drives stub fixtures (`tests/fixtures/bin/consensus`, `consensus-provider-stub`).
  - RELEASING.md documents manual interactive provider verification as the release-time coverage for this boundary (tests lane; confirm exact wording in step 1).

## Drift check

```bash
git diff --stat 8309623..HEAD -- tests/consensus/provider-cli/e2e/ RELEASING.md package.json .github/workflows/
```

Reassess if the live test's gating or the release checklist already changed.

## Repository conventions

- Test runner: Vitest; scripts in root `package.json`.
- CI style: match existing workflows (checkout/pnpm/node steps, least-privilege permissions); the supply-chain plan may SHA-pin actions — match whatever style is current.
- Live provider runs consume real API quota and require authenticated CLIs — everything here must stay opt-in; nothing may make `pnpm test` or PR CI depend on provider credentials.
- Commits: Conventional Commits (`ci(e2e): surface the live provider gate`). Do not push or open a PR unless instructed.

## Scope

### In scope

- `package.json`: a `test:live-e2e` script (`CONSENSUS_LIVE_SUBMIT_E2E=1 vitest run tests/consensus/provider-cli/e2e/submit-live.e2e.test.ts` — adjust to the test's actual env expectations after reading it, including provider selection variables).
- RELEASING.md: a checklist item naming the exact command, what it proves, its prerequisites (authenticated provider CLI, expected cost scale), and an explicit "run it or record why it was waived" instruction.
- A `workflow_dispatch`-only workflow (`.github/workflows/live-e2e.yml`) running the script with inputs for provider choice; it must fail with a clear message when credentials are absent, and must never be wired to `pull_request`/`push`/tag triggers.
- A short note in AGENTS.md's Verification section listing `pnpm run test:live-e2e` as the opt-in live gate.

### Out of scope

- Automatically running live E2E in PR/release CI (credential and cost policy is an operator decision).
- Expanding live coverage beyond the existing submit test (a broader live matrix is future work).
- Changing the test itself beyond what the script alias requires.

## Current state

- The test self-configures from env (line 79's guard suggests a `liveConfig` builder reading provider/system settings — read the whole file first; the script and docs must name every required variable, e.g. provider selection and sandbox mode, per the test's header comment "default provider codex/workspace-write").
- Release history (v0.1.0) shows this boundary was verified manually via an interactive table in RELEASING.md — the checklist item should reference the live test as the automatable subset of that manual process, not replace the interactive checks.

## Implementation steps

### 1. Read the live test and enumerate its contract

Read `submit-live.e2e.test.ts` fully: required env vars, default provider, sandbox expectations, side effects, and approximate cost/time of a run.

**Verify:** written list of required env + prerequisites (goes into RELEASING.md verbatim).

### 2. Add the script alias

Add `test:live-e2e` to root `package.json` scripts (env inline via `cross-env`? No — no new deps; use the env-assignment form that works in the repo's supported shells, or have the script print guidance and require the caller to set env: choose the simplest dependency-free form that works on macOS/Linux `sh`).

**Verify:** with no provider available, `pnpm run test:live-e2e` runs Vitest and the test reports its skip/fail state with a comprehensible message (not a silent green).

Note: if `CONSENSUS_LIVE_SUBMIT_E2E=1` is set but no live provider is usable, confirm what the test does (fail loudly vs skip) — the alias must not convert "credentials missing" into a silent pass. If the test skips in that case, tighten the alias to fail when the env var is set but `liveConfig` is unset — smallest possible change inside the test's gating helper.

### 3. RELEASING.md checklist item + AGENTS.md note

Add the checklist line (command, purpose, prerequisites from step 1, waive-with-reason instruction) in the pre-tag verification section; add the one-line AGENTS.md Verification entry.

**Verify:** `grep -q "test:live-e2e" RELEASING.md AGENTS.md package.json` → all three hit.

### 4. Manual-dispatch workflow

Create `.github/workflows/live-e2e.yml`: `on: workflow_dispatch` with a `provider` input; standard checkout/pnpm/node steps; runs `pnpm install --frozen-lockfile` then the live script with the env assembled from workflow inputs/secrets (reference secret names without creating them; document in the workflow header which secrets an operator must configure). `permissions: contents: read`.

**Verify:** `grep -c "workflow_dispatch" .github/workflows/live-e2e.yml` → 1, and no other trigger keys present; `pnpm test && npm run validate` still pass.

## Test plan

- No new unit tests. The verification boundary: step-2's local behavior check, the three grep assertions, and the workflow-trigger assertion.
- If step 2's note required tightening the skip-to-fail behavior, add/adjust the e2e file's gating so `CONSENSUS_LIVE_SUBMIT_E2E=1` without a usable provider fails with an actionable message — covered by running the alias credential-less.

## Done criteria

- [ ] `pnpm run test:live-e2e` exists and cannot silently pass when explicitly requested without a usable provider.
- [ ] RELEASING.md requires run-or-waive with the exact command; AGENTS.md lists the gate.
- [ ] `live-e2e.yml` is dispatch-only, least-privilege, and documents its required secrets.
- [ ] `pnpm test && npm run validate` pass; `git status --short` clean of unexplained files.

## STOP conditions

- The live test's design makes a non-interactive run unsafe (e.g. it requires interactive provider approval flows) — report; the RELEASING.md item then documents the manual procedure instead of a script.
- Tightening skip-to-fail would change `pnpm test` default behavior (it must not — default remains skip when the env var is unset).
- Any verification gate fails twice after one bounded correction.

## Review focus

- The skip-vs-fail semantics: env var unset → skip (unchanged); env var set + no provider → loud failure.
- Workflow secret handling: names referenced, values never present.
- Deferred intentionally: scheduled live runs, broader live-provider matrix, wiring into release CI.
