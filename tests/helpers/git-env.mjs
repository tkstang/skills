// Strip every inherited GIT_* env var (set when tests run inside a git hook,
// or by anything upstream that injects git config via the environment) so
// temp-repo git commands resolve the temp repo via cwd, not the ambient repo
// or its config.
//
// Prior-incident rule: every test that spawns `git` against a scratch
// directory MUST use this (or an equivalent scrub) — omitting it let a
// previous test suite run "inside" a git hook corrupt the real repository's
// git config by inheriting GIT_DIR/GIT_WORK_TREE from the parent process.
//
// F1 regression (2026-07): scrubbing only a fixed named list (GIT_DIR,
// GIT_WORK_TREE, ...) missed GIT_CONFIG_COUNT/GIT_CONFIG_KEY_n/
// GIT_CONFIG_VALUE_n/GIT_CONFIG_PARAMETERS — git's environment-based config
// injection mechanism. An inherited `GIT_CONFIG_KEY_0=core.hooksPath` +
// `GIT_CONFIG_VALUE_0=<dir>` survives a named-list scrub and redirects
// `git rev-parse --git-path hooks` (and therefore manage-hooks.mjs's mutation
// target) to an arbitrary directory outside the scratch repo. Scrub the
// entire GIT_* prefix instead of enumerating known variables, so any current
// or future git env-config mechanism is covered. Callers that need a
// specific GIT_* value (e.g. GIT_AUTHOR_DATE for deterministic commits) pass
// it via `overrides`, applied *after* the scrub — that's deliberate caller
// intent, not inherited leakage.
export function gitEnv(overrides = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_')) {
      delete env[key];
    }
  }
  return { ...env, ...overrides };
}
