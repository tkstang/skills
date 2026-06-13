#!/usr/bin/env bash
set -euo pipefail

# Full pre-merge validation for a worktree: assert a clean tree, run the
# verification suite (the same commands CI runs), and assert the tree is still
# clean afterward (catches generated-file drift, e.g. transcript-core sync).

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

run_step() {
  local label="$1"
  shift

  echo "==> ${label}"
  "$@"
}

assert_clean_worktree() {
  local phase="$1"
  local status

  status="$(git status --short)"
  if [[ -n "$status" ]]; then
    echo "worktree is not clean ${phase}:"
    echo "$status"
    exit 1
  fi
}

assert_clean_worktree "before validation"
run_step "test" pnpm run test
run_step "validate" pnpm run validate
run_step "smoke" pnpm run smoke

assert_clean_worktree "after validation"
echo "worktree validation passed"
