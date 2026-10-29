# Public packages

The only workspace package is `session-toolkit/`. The root remains private;
`documentation/` keeps its separate lockfile and is outside the workspace.

- Session Toolkit is the intentional dependency-bearing public library/CLI
  exception to the shipped-skill no-install rule. Unattended hooks remain
  self-contained; changing interactive skill prerequisites belongs to their
  consumer migration, not to package establishment.
- Author ESM TypeScript under `session-toolkit/src/`; never edit `dist/`.
  The package root is its only public export. Internal files are not APIs.
- Keep library imports free of I/O, CLI execution, process exits and store scans.
  Command factories and the bin boundary are separate from the library root.
- Build: `pnpm run build:toolkit`. Type-check: `pnpm --filter
  @tkstang/session-toolkit type-check`. Root type-check includes this package.
- Package-boundary tests live in `tests/release/session-toolkit-*.test.ts`;
  read `tests/AGENTS.md` and use deliberate-testing before changing them.
- Node consumers support 22.0.0 and 24. Release tooling runs on 24 independently.
  Validate the exact archive in clean installations on both versions.
- Keep capability IDs truthful: advertise implemented operations only. New
  public exports, wire fields and capability meanings require intentional review.
- Toolkit versions and `session-toolkit-vX.Y.Z` tags are independent of skill,
  plugin and standalone payload release versions. Update the root changelog.
