# Phase Review: wave-4/p01 (2026-07-23)

- Wave: wave-4-execution
- Phase: p01
- Branch: `wave-4/p01` (commits `2351190`, `1289cfc`, `52f9e2f`, `601bbeb`)
- Base: `d72005dfce9e6b071657658221431a458cbc610c`
- Worktree: `/Users/tstang/Code/repo-improve-2/.worktrees/wave-4/p01`
- Contract: `.oat/repo/reference/external-plans/2026-07-17-supply-chain-ci-hardening.md`
- Prior disposition: Codex R1 test-coverage finding (Medium) — fixed in `601bbeb` (adds `tests/consensus/install-sh.test.ts`); Codex R2 — PASS.

## Verdict: PASS

## Justification

All three hardening measures in the contract are implemented correctly and match the plan's exact specifications: `install.sh` gained an optional `CONSENSUS_INSTALL_SHA256` checksum-verification path that runs `verify_checksum` immediately after the fetch/copy step and strictly before `chmod`/`mv` on both the local-checkout and remote-fetch code paths, with unset-var behavior unchanged and the header comment documenting the new variable; independent re-resolution via `gh api` of all 6 pinned actions (including annotated-tag dereferencing for `pnpm/action-setup`) matches the diff's SHAs and version comments exactly; `validate.yml` carries the exact specified `concurrency` block while `release.yml` deliberately has none and `deploy-docs.yml`'s existing concurrency block is untouched; the new `validate-script.test.ts` SHA-pin-invariant test correctly rejects tag-style `uses:` lines via its regex assertions; `dependabot.yml` is a valid `github-actions`/weekly entry; and the two named test files (19 tests total) run green in the worktree. The diff touches exactly the 8 files in scope, commits follow Conventional Commits, and `git status --short` is clean.

## Verification detail

1. **SHA↔version-comment accuracy** — Independently re-resolved via `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` (dereferencing the annotated tag object for `pnpm/action-setup`):
   - `actions/checkout@v4.4.0` → `11d5960a326750d5838078e36cf38b85af677262` ✓ matches
   - `pnpm/action-setup@v4.4.0` → tag object `a15d269c...` dereferenced to commit `fc06bc1257f339d1d5d8b3a19a8cae5388b55320` ✓ matches
   - `actions/deploy-pages@v4.0.5` → `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` ✓ matches
   - Also spot-checked (not required but cheap): `actions/setup-node@v4.4.0` → `49933ea5288caeca8642d1e84afbd3f7d6820020` ✓; `actions/configure-pages@v5.0.0` → `983d7736d9b0ae728b81ab479565c72886d7745b` ✓; `actions/upload-pages-artifact@v3.0.1` → `56afc609e74202658d3ffba0e8f6dda462b719fa` ✓.
   - All 6 pins are 40 hex characters; all carry accurate `# vX.Y.Z` comments.

2. **Checksum failure path ordering** — Read `install.sh`: `verify_checksum` (install.sh:108) is called after the copy/fetch step and before `chmod 0644` (install.sh:111) / `mv` into `$target_path` (install.sh:112), on both the local-checkout and remote-fetch branches. Ran `tests/consensus/install-sh.test.ts`: the "wrong hash" tests assert the final target path does not exist (local-checkout case) and that a pre-existing target file is left unchanged (remote-fetch case) — both pass. Note: `mktemp` (pre-existing, unmodified by this phase) creates the scratch file inside `target_dir` (`$HOME/.consensus`) before verification runs, but this is the script's existing temp-file pattern (with an existing `trap 'rm -f "$tmp_path"' EXIT` cleanup on failure) — this phase did not introduce it, and the tests confirm no artifact survives a checksum failure. Not a blocking finding.

3. **install.sh dialect/style** — `sha256_of`/`verify_checksum` follow the same dual-tool (`shasum -a 256` / `sha256sum` fallback) pattern as the existing `fetch_url` curl/wget dual-tool helper, and use the same `fail` helper and `local` variable style already present in the file (shebang is `#!/usr/bin/env bash`, unchanged from base — this predates the phase and is not a regression). `sh -n install.sh` and `bash -n install.sh` both pass. Header comment documents `CONSENSUS_INSTALL_SHA256` alongside the existing `CONSENSUS_INSTALL_*` vars.

4. **SHA-pin invariant test** — `tests/release/validate-script.test.ts` "every workflow action is SHA-pinned with a version comment" uses `shaPinPattern = /^[^@]+@[0-9a-f]{40}$/` and `versionCommentPattern = /^#\s*v\d+\.\d+\.\d+\s*$/`; a tag-style `uses: owner/action@v4` fails `shaPinPattern` (since `v4` is not 40 hex chars), so the test genuinely guards against regression. `dependabot.yml` shape is valid: `package-ecosystem: "github-actions"`, `directory: "/"`, `schedule.interval: "weekly"`.

5. **Concurrency blocks** — `validate.yml` has exactly `concurrency: { group: "${{ github.workflow }}-${{ github.ref }}", cancel-in-progress: true }` as specified. `release.yml` has no concurrency block (deliberate, per plan — tag-triggered release should not be cancelled mid-flight). `deploy-docs.yml`'s pre-existing concurrency block (`group: "pages"`, non-cancelling) is untouched; only its `uses:` lines were pinned.

6. **Test run** — `npx vitest run tests/consensus/install-sh.test.ts tests/release/validate-script.test.ts` in the worktree: **2 files, 19 tests, all passed.**

## Scope and hygiene

- Diff touches exactly the 8 named files: `.github/dependabot.yml`, `.github/workflows/deploy-docs.yml`, `.github/workflows/release.yml`, `.github/workflows/validate.yml`, `RELEASING.md`, `install.sh`, `tests/consensus/install-sh.test.ts`, `tests/release/validate-script.test.ts`.
- `git status --short` in the worktree is clean (no unexplained files); no `.oat/` writes made by the phase branch itself.
- Commits are Conventional Commits (`feat(install): ...`, `ci(...): ...`, `test(...): ...` scoped as `p01-t01`).
- `RELEASING.md` checklist line for publishing the `consensus.mjs` SHA-256 checksum is present and correctly worded.

## Findings requiring action

None.
