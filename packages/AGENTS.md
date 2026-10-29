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
  @tkstang/session-toolkit type-check`. Root type-check includes this package. Root `test` builds the package before
  running Vitest; scoped package CLI tests require `build:toolkit` first.
- Package-boundary tests live in `tests/release/session-toolkit-*.test.ts`;
  read `tests/AGENTS.md` and use deliberate-testing before changing them.
- Node consumers support 22.0.0 and 24. Release tooling runs on 24 independently.
  Validate the exact archive in clean installations on both versions.
- Keep capability IDs truthful: advertise implemented operations only. New
  public exports, wire fields and capability meanings require intentional review.
- Toolkit versions and `session-toolkit-vX.Y.Z` tags are independent of skill,
  plugin and standalone payload release versions. Update the root changelog.

Archive checks: on Node 24, `pnpm run release:toolkit:dry-run --out
<new-directory>` builds, packs, inspects, installs and runs npm's publication dry
run on the exact archive. `pnpm run toolkit:pack:check --archive <tarball>
[--node <absolute-node-executable>]` rechecks the same bytes against a consumer
runtime. Release/bootstrap authority and prerequisites live in `RELEASING.md`.
`release:toolkit:prepare --out <new-directory-outside-repo>` requires clean
committed source and binds one built archive to HEAD/tree, version, intended tag
and curated package changelog notes. `release:toolkit:verify --directory
<candidate-directory> [--node <node-executable>]` revalidates that binding and
installed behavior; `--tag session-toolkit-vX.Y.Z` requires the actual tag at HEAD.
The Session Toolkit workflow checks the same downloaded bytes on 22.0.0/24.
Only its separately enabled protected `npm` publication job has OIDC write
permission. Root owns live bootstrap/publication and settings per RELEASING.md.
Keep `session-toolkit/CHANGELOG.md` current for the selected package version; a
local candidate is not a publication receipt.
