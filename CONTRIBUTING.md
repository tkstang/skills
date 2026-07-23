# Contributing

This repo keeps portable skill content separate from provider adapters.

## Rules

- Put standalone skills in `skills/`.
- Put plugin-bundled skills under `plugins/<plugin-name>/skills/`.
- Keep plugin manifests plugin-root-relative; do not reference `.oat/` or generated local paths.
- Keep runtime code dependency-free unless a later plan explicitly changes that.
- Use additive skill frontmatter for portable skills. Fields such as `allowed-tools` may appear when ignored fields are tolerated by other providers. Fields with conflicting provider semantics belong in provider-specific manifests.
- Treat cross-provider testing as a release requirement: validate Claude Code, Cursor, Codex Git/local, and `npx skills add` install paths before claiming support in docs or release notes.
- Update tests and `scripts/validate.mjs` when changing repository invariants.

## Verification

Run:

```bash
pnpm run build
pnpm run type-check
pnpm run build:check
pnpm run test
pnpm run validate
pnpm run smoke
```
