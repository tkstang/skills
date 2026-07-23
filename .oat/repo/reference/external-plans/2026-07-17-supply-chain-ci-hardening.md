---
oat_generated: true
oat_external_plan: true
oat_external_plan_source: repo-audit
oat_external_plan_sources:
  - 'repo-audit: full repository (excl. .agents/, .claude/, .codex/, .cursor/)'
oat_external_plan_commit: '8309623'
oat_backlog_items:
  - BL-260718-harden-install-and-ci-supply
oat_issue_url: null
created: '2026-07-17T23:39:00Z'
---

# Harden install and CI supply-chain posture: checksum verification, SHA-pinned actions, CI concurrency

> [!NOTE]
> This is an external implementation plan, not a canonical OAT project
> `plan.md`. Execute it directly, or import it for tracked OAT execution with
> `oat-project-import-plan <this-file>`.
>
> Begin with the drift check. Follow the steps and verification gates in order.
> If a STOP condition occurs, stop and report instead of improvising.
>
> The three steps here are independent hardening measures bundled for one
> config-hardening pass; each step is separately shippable if a reviewer wants
> to split them.

## Outcome

Three defensive-maintenance gaps close: (1) `install.sh` can verify the fetched runtime against an operator-supplied SHA-256 checksum instead of trusting HTTPS+tag alone; (2) GitHub Actions in all three workflows are pinned to commit SHAs (with version comments and Dependabot keeping them current) instead of mutable major-version tags — the release workflow runs with `contents: write`, so a re-pointed third-party action tag is a real, if low-likelihood, exposure; (3) `validate.yml` gains a concurrency group so rapid successive pushes cancel stale runs instead of queueing duplicate six-job matrices.

## Source and live evidence

- Source artifact or scope: repo-audit reconnaissance (security + deps/DX lanes), full repository
- Planned at: commit `8309623` on `2026-07-17`
- Related backlog items: none
- Verified evidence (read live at planning time):
  - `install.sh:14-26` (`fetch_url` via curl/wget) and `install.sh:65-72` — remote fetch path writes the fetched file to the target after `chmod`, with no checksum/signature verification anywhere in the script.
  - `.github/workflows/{validate,release,deploy-docs}.yml` — all `uses:` entries are tag-pinned (`actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`, Pages actions) (security lane; enumerate exactly in step 2).
  - `.github/workflows/deploy-docs.yml:21-23` has a `concurrency` block; `validate.yml` and `release.yml` have none (deps/DX lane; confirm in step 3).
  - Workflow permissions are already least-privilege (security lane verified) — not in scope to change.

## Drift check

```bash
git diff --stat 8309623..HEAD -- install.sh .github/workflows/ .github/dependabot.yml RELEASING.md
```

Re-verify any changed file's specific gap before editing it.

## Repository conventions

- `install.sh` is POSIX-sh (verify shebang and existing style; keep to the same shell dialect and error-handling helpers like `fail`).
- CI style: see existing workflows; permissions blocks stay as-is.
- Release process doc: RELEASING.md must describe any new checksum-publication step, since the checksum only helps if a value is published per release.
- Commits: Conventional Commits (`ci: pin actions to commit SHAs`, `feat(install): optional checksum verification`). Do not push or open a PR unless instructed.

## Scope

### In scope

- `install.sh`: optional `CONSENSUS_INSTALL_SHA256` env var — when set, compute the fetched file's SHA-256 (`shasum -a 256` with `sha256sum` fallback, matching the script's existing curl/wget dual-tool pattern) and `fail` on mismatch before the `mv` into place. Unset → behavior unchanged (document the variable in the script's header comment block alongside the existing `CONSENSUS_INSTALL_*` vars).
- All three workflow files: replace each `uses: owner/action@vN` with `uses: owner/action@<full-commit-sha> # vN.x.y`, resolving each SHA from the action's GitHub releases for the latest release in the currently-used major line.
- `.github/dependabot.yml`: add (or create) a `github-actions` ecosystem entry so pins stay current.
- `validate.yml`: `concurrency: { group: "${{ github.workflow }}-${{ github.ref }}", cancel-in-progress: true }`. Leave `release.yml` without cancellation (tag-triggered; cancelling a release run mid-flight is worse than queueing) — add a non-cancelling group only if reviewers want dedupe.
- `RELEASING.md`: one checklist line — publish the `consensus.mjs` SHA-256 alongside the tag/release notes.

### Out of scope

- Signature-based verification (sigstore/GPG) — checksum pinning is the proportionate step for this repo's risk profile.
- Changing workflow permissions, triggers, or job structure.
- The docs PR gate — separate plan (`2026-07-17-docs-pr-ci-gate.md`); if both run, apply the same pinning style there.

## Current state

- `install.sh` supports a local-checkout copy path and a remote fetch path (`CONSENSUS_INSTALL_FORCE_REMOTE`, `CONSENSUS_INSTALL_RAW_BASE`, `CONSENSUS_INSTALL_REMOTE_PATH` overrides); checksum verification should apply to **both** paths when the env var is set (a copied local file can be stale too, and uniformity is simpler).
- Resolving action SHAs requires network access to github.com (read-only). If the execution environment cannot resolve them, that is a STOP (do not pin to guessed SHAs).

## Implementation steps

### 1. Checksum verification in `install.sh`

Add a `verify_checksum` helper (shasum/sha256sum dual-tool) invoked on `$tmp_path` when `CONSENSUS_INSTALL_SHA256` is set, before `chmod`/`mv`. Mismatch → `fail` with expected-vs-actual (values are hashes, safe to print). Update the header comment and RELEASING.md checklist line.

**Verify:**

```bash
sh -n install.sh                             # syntax
CONSENSUS_INSTALL_SHA256=$(shasum -a 256 plugins/consensus/scripts/consensus.mjs | cut -d' ' -f1) \
  CONSENSUS_INSTALL_DIR=$(mktemp -d) sh install.sh   # correct hash → succeeds
CONSENSUS_INSTALL_SHA256=deadbeef CONSENSUS_INSTALL_DIR=$(mktemp -d) sh install.sh; test $? -ne 0   # wrong hash → fails
```

(Adjust env-var names for the install dir to the script's actual overrides — read the script first; if no dir override exists, verify in a container-safe way rather than touching `~/.consensus`.)

### 2. SHA-pin all workflow actions

Enumerate every `uses:` line (`grep -rn "uses:" .github/workflows/`). For each action, resolve the commit SHA of the latest release in the used major line via `gh api repos/<owner>/<repo>/releases` + `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` (dereference annotated tags to the commit). Replace with the full SHA plus a `# vX.Y.Z` comment. Add the Dependabot `github-actions` entry (weekly).

**Verify:** `grep -rn "uses:" .github/workflows/ | grep -v "@[0-9a-f]\{40\}"` → empty (every use is SHA-pinned); each pin has a version comment.

### 3. Concurrency group in `validate.yml`

Add the group as scoped above.

**Verify:** YAML parses (`node -e "console.log(require('js-yaml')...)"` is unavailable without deps — instead re-run any repo YAML check, or rely on a careful read plus step-4's CI observation note).

### 4. Contract run

```bash
pnpm test && npm run validate
```

**Verify:** exit 0 (`tests/release/` contains workflow/script string assertions — if one pins tag-style `uses:` strings, update it with the change). Note for the operator: the first PR carrying this change is itself the live verification that pinned actions still resolve.

## Test plan

- `install.sh` behavioral checks in step 1 (right-hash pass, wrong-hash fail, unset-var unchanged).
- If `tests/release/validate-script.test.ts`-style suites assert workflow content, extend them to assert the SHA-pin invariant (`@<40-hex>` on every `uses:`) — cheap drift guard.
- Full: `pnpm test && npm run validate`.

## Done criteria

- [ ] `CONSENSUS_INSTALL_SHA256` verified on both install paths; unset behavior unchanged; RELEASING.md updated.
- [ ] Every `uses:` in all workflows is a 40-hex SHA with a version comment; Dependabot covers `github-actions`.
- [ ] `validate.yml` has the concurrency group; `release.yml` intentionally left non-cancelling.
- [ ] `pnpm test && npm run validate` pass; `git status --short` clean of unexplained files.

## STOP conditions

- Action SHAs cannot be resolved from authoritative sources in this environment (never guess a SHA).
- `install.sh`'s override surface doesn't allow safe scratch-directory testing (report rather than testing against the real `~/.consensus`).
- Any verification gate fails twice after one bounded correction.

## Review focus

- SHA↔version-comment accuracy (a wrong comment is worse than no comment).
- The checksum failure path must run before any file lands in the install target.
- Deferred intentionally: release-asset signatures; `release.yml` concurrency; applying pins to the (possibly not-yet-merged) docs CI workflow.
