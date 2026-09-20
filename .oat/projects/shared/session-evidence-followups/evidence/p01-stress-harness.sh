#!/bin/bash
set -euo pipefail

load_pid=''
cleanup() {
  if [ -n "$load_pid" ] && kill -0 "$load_pid" 2>/dev/null; then
    kill "$load_pid" 2>/dev/null || true
    wait "$load_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

for iteration in $(seq 1 50); do
  if [ "$iteration" -eq 11 ]; then
    node -e 'while (true) {}' &
    load_pid=$!
    printf 'cpu-load start pid=%s iteration=%s\n' "$load_pid" "$iteration"
  fi
  if [ "$iteration" -eq 41 ]; then
    cleanup
    printf 'cpu-load stop pid=%s iteration=%s\n' "$load_pid" "$iteration"
    load_pid=''
  fi

  started_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  printf 'iteration=%02d status=start at=%s cpu_load=%s\n' \
    "$iteration" "$started_at" "${load_pid:-none}"
  pnpm run test:vitest src/skills/session-observer/src/watch.test.ts \
    -t 're-arms an exact Codex pin after clean SIGTERM shutdown'
  finished_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  printf 'iteration=%02d status=pass at=%s cpu_load=%s\n' \
    "$iteration" "$finished_at" "${load_pid:-none}"
done

printf 'summary iterations=50 passed=50 failed=0 loaded_iterations=30 cleanup=complete\n'
