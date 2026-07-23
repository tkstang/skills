#!/usr/bin/env bash
set -euo pipefail

# Env var overrides:
#   CONSENSUS_INSTALL_REF          - git ref/tag to fetch from when using the
#                                     remote path (default: v0.1.2).
#   CONSENSUS_INSTALL_RAW_BASE     - base URL for the remote fetch (default:
#                                     raw.githubusercontent.com at the ref above).
#   CONSENSUS_INSTALL_FORCE_REMOTE - set to "1" to always fetch remotely, even
#                                     when a local checkout copy is available.
#   CONSENSUS_INSTALL_SHA256       - optional. When set, the fetched/copied
#                                     file's SHA-256 is verified against this
#                                     value before it is installed (applies to
#                                     both the local-checkout copy path and the
#                                     remote fetch path). A mismatch fails
#                                     before anything is written to the install
#                                     target. Unset -> behavior unchanged.
CONSENSUS_INSTALL_REF="${CONSENSUS_INSTALL_REF:-v0.1.2}"
CONSENSUS_INSTALL_REMOTE_PATH="plugins/consensus/scripts/consensus.mjs"
CONSENSUS_INSTALL_RAW_BASE="${CONSENSUS_INSTALL_RAW_BASE:-https://raw.githubusercontent.com/tkstang/skills/${CONSENSUS_INSTALL_REF}}"
CONSENSUS_INSTALL_TARGET_RELATIVE=".consensus/consensus.mjs"

fail() {
  printf 'install.sh: %s\n' "$*" >&2
  exit 1
}

fetch_url() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO- "$1"
    return
  fi

  fail "curl or wget is required to fetch ${1}"
}

sha256_of() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
    return
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
    return
  fi

  fail "shasum or sha256sum is required to verify CONSENSUS_INSTALL_SHA256"
}

verify_checksum() {
  local expected="$1" file="$2" actual
  actual="$(sha256_of "$file")"
  if [ "$actual" != "$expected" ]; then
    fail "checksum mismatch for ${file}: expected ${expected}, got ${actual}"
  fi
}

require_node_22() {
  local major
  major="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || true)"
  if [ -z "$major" ] || [ "$major" -lt 22 ]; then
    fail "Node.js 22 or newer is required to run the consensus provider CLI"
  fi
}

script_dir() {
  local source_path
  source_path="${BASH_SOURCE[0]:-$0}"
  cd -- "$(dirname -- "$source_path")" >/dev/null 2>&1 && pwd -P
}

main() {
  [ -n "${HOME:-}" ] || fail "HOME is required"
  require_node_22

  local target_dir target_path tmp_path root_dir checkout_path remote_url
  target_path="${HOME}/${CONSENSUS_INSTALL_TARGET_RELATIVE}"
  target_dir="$(dirname -- "$target_path")"

  if ! mkdir -p "$target_dir"; then
    fail "failed to create ${target_dir}"
  fi

  tmp_path="$(mktemp "${target_dir}/.consensus.mjs.tmp.XXXXXX")" ||
    fail "failed to create a temporary file in ${target_dir}"
  trap 'rm -f "$tmp_path"' EXIT

  root_dir="$(script_dir)"
  checkout_path="${root_dir}/${CONSENSUS_INSTALL_REMOTE_PATH}"
  if [ "${CONSENSUS_INSTALL_FORCE_REMOTE:-}" != "1" ] && [ -f "$checkout_path" ]; then
    if ! cp "$checkout_path" "$tmp_path"; then
      fail "failed to copy ${checkout_path}"
    fi
  else
    remote_url="${CONSENSUS_INSTALL_RAW_BASE}/${CONSENSUS_INSTALL_REMOTE_PATH}"
    if ! fetch_url "$remote_url" >"$tmp_path"; then
      fail "failed to fetch ${remote_url}"
    fi
  fi

  if [ -n "${CONSENSUS_INSTALL_SHA256:-}" ]; then
    verify_checksum "$CONSENSUS_INSTALL_SHA256" "$tmp_path"
  fi

  chmod 0644 "$tmp_path" || fail "failed to set permissions on ${tmp_path}"
  if ! mv "$tmp_path" "$target_path"; then
    fail "failed to write ${target_path}"
  fi
  trap - EXIT

  printf 'Installed consensus provider CLI to %s\n' "$target_path"
}

main "$@"
