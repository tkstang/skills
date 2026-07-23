// Strip inherited git env vars (set when tests run inside a git hook) so
// temp-repo git commands resolve the temp repo via cwd, not the ambient repo.
//
// Prior-incident rule: every test that spawns `git` against a scratch
// directory MUST use this (or an equivalent scrub) — omitting it let a
// previous test suite run "inside" a git hook corrupt the real repository's
// git config by inheriting GIT_DIR/GIT_WORK_TREE from the parent process.
export function gitEnv(overrides = {}) {
  const env = { ...process.env };
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_COMMON_DIR',
    'GIT_PREFIX',
    'GIT_NAMESPACE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  ]) {
    delete env[key];
  }
  return { ...env, ...overrides };
}
