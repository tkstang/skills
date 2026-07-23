/**
 * Build a process env with every GIT_*-prefixed key removed (not a fixed
 * named list — this includes git's environment-based config injection
 * mechanism, GIT_CONFIG_COUNT/GIT_CONFIG_KEY_n/GIT_CONFIG_VALUE_n/
 * GIT_CONFIG_PARAMETERS, along with GIT_DIR, GIT_WORK_TREE, etc.), then
 * applies `overrides` on top. Required for any test that spawns `git`
 * against a scratch directory — see the prior-incident note in git-env.mjs.
 */
export function gitEnv(overrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
