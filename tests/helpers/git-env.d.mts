/**
 * Build a process env with the GIT_* family scrubbed (GIT_DIR, GIT_WORK_TREE,
 * GIT_INDEX_FILE, GIT_COMMON_DIR, GIT_PREFIX, GIT_NAMESPACE,
 * GIT_OBJECT_DIRECTORY, GIT_ALTERNATE_OBJECT_DIRECTORIES). Required for any
 * test that spawns `git` against a scratch directory — see the prior-incident
 * note in git-env.mjs.
 */
export function gitEnv(overrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
