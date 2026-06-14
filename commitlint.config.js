/**
 * Commitlint configuration — enforces Conventional Commits on commit-msg.
 * @see https://commitlint.js.org/#/
 *
 * Dev-only tooling. This does not affect shipped skills/plugins, which stay
 * Node-stdlib-only with no install step (see AGENTS.md "Repository Conventions").
 */
export default {
  extends: ['@commitlint/config-conventional'],
};
