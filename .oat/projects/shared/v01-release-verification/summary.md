---
oat_status: complete
oat_ready_for: oat-project-pr-final
oat_last_updated: 2026-06-19
oat_generated: false
---

# Summary: v01-release-verification

## PR Body Draft

### Summary

Verifies and packages the current v0.1 consensus feature set without pulling in test-organization cleanup. The branch refreshes `bl-d85f` evidence after the TypeScript/Vitest migration, updates release notes and provider QA for both shipped consensus skills (`refine`, `evaluate`), brings the tag release workflow up to the current validation substrate, and keeps public discovery claims gated.

### Verified Now

- `pnpm run build`
- `pnpm run type-check`
- `pnpm run build:check`
- `pnpm run test`
- `pnpm run validate`
- `pnpm run smoke`
- `node scripts/bump-version.mjs --check-tag v0.1.0`
- Focused release/docs tests: `pnpm exec vitest run tests/release-versioning.test.ts tests/readme-scope.test.ts`
- Claude Code local plugin install from this release-candidate checkout: passed; `consensus@skills` exposes `evaluate`, `refine`, and `consensus-section-runner`.
- Codex local plugin install: passed through the configured local `skills` marketplace.
- Agent Skills source discovery: `npx skills@latest add tkstang/skills --list --full-depth` cloned the GitHub source and listed source-discovered skills.

### Reused Evidence

- PR #9 remains reused evidence for live `consensus-refine` dogfood across `alternating`, `parallel_revision`, `parallel_synthesized`, host/user escalation, and genuinely-stuck promotion flows.
- That reused evidence does not replace the current automated gates, `consensus-evaluate` release QA, provider install checks, or public discovery gates.

### Remaining Before Tag

- Run interactive provider permission-prompt smokes for Claude Code and Codex (`node`/`paseo` execution and file read/write permissions).
- Resolve Cursor's locked macOS login keychain or explicitly release-note Cursor host/peer limitations; current verification could not run Cursor Agent and Paseo reports Cursor provider status `error`.
- If tagging from a separate worktree, ensure the provider-local `skills` marketplace points at the intended release-candidate checkout, or remove/update the existing marketplace source first.

### Remaining After Tag / Before Public Claims

- Verify skills.sh indexing/public discovery after publication before claiming skills.sh availability.
- Verify any public provider directory / marketplace discovery path before claiming it.

### Notes

- No new consensus family skills were added.
- No test-organization cleanup was included.
- Generated `.mjs` runtime files were not hand-edited; drift is guarded by `pnpm run build:check`.
