# Contributing

This repo keeps authored skill ownership separate from generated installation
layouts and provider adapters.

## Rules

- Put every authored product skill in `src/skills/<canonical-name>/`, including
  its instructions, references, assets, runtime source, and skill-owned tests.
- Declare standalone and plugin membership in `src/distributions.ts`. A plugin
  may expose a short local name while the canonical/standalone name stays
  descriptive. For example, `src/skills/consensus-create` produces only the
  Consensus plugin-local `create` skill; `src/skills/phone-a-friend` produces
  both `phone-a-friend` forms.
- Treat `skills/` and `plugins/<plugin-name>/skills/` as generated installation
  units. Run `pnpm run build`; never hand-edit generated payloads.
- Keep plugin manifests plugin-root-relative; do not reference `.oat/` or generated local paths.
- Keep shipped skill/hook runtime code dependency-free. The public
  `packages/session-toolkit/` library/CLI may declare intentional npm runtime
  dependencies; this does not change existing skill prerequisites.
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

## Session Toolkit

The private root workspace includes only `packages/session-toolkit/`;
`documentation/` is separately locked and excluded. Build the public package
with `pnpm run build:toolkit`; root `build` and `type-check` include it. Root `test` builds its ignored
output before running the suite; build first for scoped CLI tests. Read
[package instructions](packages/AGENTS.md) and the
[package README](packages/session-toolkit/README.md) before editing it. Its
Node 22.0.0 consumer floor is separate from Node 24 release tooling.

The validation-only `Session Toolkit` workflow builds on Node 24 and installs
one validated archive on Node 22.0.0 and 24. To reproduce locally, run
`pnpm run release:toolkit:dry-run --out <new-directory>` on Node 24 and
`pnpm run toolkit:pack:check --archive <tarball> --node <node-executable>`.
These checks do not publish or change consumer dependencies.
