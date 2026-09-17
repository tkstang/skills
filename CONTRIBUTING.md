# Contributing

This repo keeps authored skill ownership separate from generated installation
layouts and provider adapters.

## Rules

- Put every authored product skill in `src/skills/<canonical-name>/`, including
  its instructions, references, assets, runtime source, and skill-owned tests.
- Declare standalone and plugin membership in `src/distributions.ts`. A plugin
  may expose a short local name while the canonical/standalone name stays
  descriptive.
- Treat `skills/` and `plugins/<plugin-name>/skills/` as generated installation
  units. Run `pnpm run build`; never hand-edit generated payloads.
- Keep plugin manifests plugin-root-relative; do not reference `.oat/` or generated local paths.
- Keep runtime code dependency-free unless a later plan explicitly changes that.
- Bundle shared runtime closure into each installation unit that needs it. A
  declared workflow dependency on another skill is different: check it early,
  give the canonical install link when missing, and never auto-install it.
- Use additive skill frontmatter for portable skills. Fields such as `allowed-tools` may appear when ignored fields are tolerated by other providers. Fields with conflicting provider semantics belong in provider-specific manifests.
- Use quoted stable SemVer in `metadata.version` as the sole authored skill
  version field. Plugin release versions are independent from member skill
  versions.
- Treat cross-provider testing as a release requirement: validate Claude Code, Cursor, Codex Git/local, and `npx skills add` install paths before claiming support in docs or release notes.
- Update tests and `scripts/validate.ts` when changing repository invariants.
- Prefer clean breaks: do not add backward-compatibility machinery (aliases,
  wrapper commands, compatibility READMEs, legacy name maps, deprecated flags)
  without explicit user approval recorded in the same change.
- Add a `## [Unreleased]` entry to `CHANGELOG.md` in the same change whenever you
  bump a skill or plugin version or change user-facing behavior, naming the
  affected skills and their new versions.

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
