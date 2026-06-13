#!/usr/bin/env bash
set -euo pipefail

# Bootstrap a freshly created git worktree: copy local-only files that git does
# not carry (env, local OAT config, local/archived projects, MCP configs),
# sync OAT local paths, install dependencies, and refresh provider views.

current_root="$(git rev-parse --show-toplevel)"
common_git_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
main_root="$(cd "${common_git_dir}/.." && pwd -P)"

copy_file() {
  local src="$1"
  local dest="$2"

  if [[ ! -f "$src" ]]; then
    echo "skip (missing): ${src}"
    return 0
  fi

  if [[ "$src" == "$dest" ]]; then
    echo "skip (already present): ${dest}"
    return 0
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  echo "copied: ${dest#"${current_root}/"}"
}

copy_env_files() {
  while IFS= read -r -d '' src; do
    local rel_path="${src#"${main_root}/"}"
    local dest="${current_root}/${rel_path}"
    copy_file "$src" "$dest"
  done < <(
    find "$main_root" -type f \
      \( -name ".env" -o -name ".env.local" -o -name ".env.*.local" \) \
      -not -path "*/.git/*" \
      -not -path "*/node_modules/*" \
      -not -path "*/dist/*" \
      -not -path "*/build/*" \
      -not -path "*/.worktrees/*" \
      -print0
  )
}

copy_directory_tree() {
  local rel_path="$1"
  local src="${main_root}/${rel_path}"
  local dest="${current_root}/${rel_path}"

  if [[ ! -d "$src" ]]; then
    echo "skip (missing): ${rel_path}"
    return 0
  fi

  if [[ "$src" == "$dest" ]]; then
    echo "skip (already present): ${rel_path}"
    return 0
  fi

  mkdir -p "$dest"
  cp -R "${src}/." "${dest}/"
  echo "copied: ${rel_path}"
}

copy_matching_files() {
  local pattern_args=("$@")

  while IFS= read -r -d '' src; do
    local rel_path="${src#"${main_root}/"}"
    local dest="${current_root}/${rel_path}"
    copy_file "$src" "$dest"
  done < <(
    find "$main_root" \
      -path "*/.git" -prune -o \
      -path "*/node_modules" -prune -o \
      -path "*/dist" -prune -o \
      -path "*/build" -prune -o \
      -path "*/.worktrees" -prune -o \
      -type f \( "${pattern_args[@]}" \) \
      -print0
  )
}

echo "main worktree: ${main_root}"
echo "target worktree: ${current_root}"

echo "copying local environment files from main worktree"
copy_env_files

echo "copying local config files from main worktree"
copy_file "${main_root}/.oat/config.local.json" "${current_root}/.oat/config.local.json"
copy_matching_files \
  -name ".mcp.json" \
  -o -path "*/.claude/settings.local.json" \
  -o -path "*/.cursor/mcp.json"

echo "copying local and archived projects from main worktree"
copy_directory_tree ".oat/projects/local"
copy_directory_tree ".oat/projects/archived"

if [[ "${SKIP_S3_ARCHIVE_SYNC:-}" == "1" ]]; then
  echo "skip S3 archived-project sync: SKIP_S3_ARCHIVE_SYNC=1"
elif command -v oat >/dev/null 2>&1; then
  echo "syncing archived projects from S3 (cross-machine archives)"
  oat repo archive sync || echo "warn: S3 archived-project sync failed (continuing)"
else
  echo "skip S3 archived-project sync: oat not on PATH"
fi

if [[ "$current_root" != "$main_root" ]] && command -v oat >/dev/null 2>&1; then
  echo "syncing OAT local paths into worktree"
  oat local sync "$current_root"
else
  echo "skip local path sync: already in main worktree or oat not on PATH"
fi

echo "running worktree bootstrap commands"
pnpm install
if command -v oat >/dev/null 2>&1; then
  oat sync --scope all
fi

echo "worktree init complete"
