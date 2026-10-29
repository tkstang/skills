# @tkstang/session-toolkit

A typed ESM library and the `seshtk` CLI. This initial package boundary provides
version/help and machine-readable capability discovery. Session identity,
discovery, transcript reads, search, export and activity operations are under
construction and are not advertised as supported capabilities.

Requires Node **22.0.0 or later**; Node 22 and 24 are supported and verified
separately. Runtime dependencies are installed by npm. Existing Skills and ORC
consumers retain their current engines until migration is verified.

## Install and inspect

After publication of your explicitly selected version:

```sh
npm install --global @tkstang/session-toolkit@<approved-version>
seshtk --version
seshtk --help
seshtk capabilities --json
```

For fetched execution, select the version explicitly:

```sh
npx --package=@tkstang/session-toolkit@<approved-version> seshtk capabilities --json
```

This checkout has not established a published release. Developers can build and
install its validated tarball without any donor checkout at runtime. Never
silently fetch `@latest` from an interactive skill or an unattended hook.

## Library

```js
import { getCapabilities } from '@tkstang/session-toolkit';

const { version, capabilities } = getCapabilities();
```

The sole public export path is the package root. `getCapabilities()` performs
no I/O, scans no stores, parses no arguments and writes no state. The exported
TypeScript types are `Capabilities`, `CapabilityId` and `Envelope<T>`. No
provider engine or consumer state store is exported in this initial boundary.

## CLI contract

`capabilities` always emits JSON. `--json` works before or after that command
and with `--help`/`--version`; each machine invocation writes exactly one
JSON object to stdout. Success is `{ok:true,schema_version:1,data:...}`; failure
is `{ok:false,schema_version:1,error:{code,message,hint}}`. Diagnostics belong
on stderr. Exit codes: `0` success, `1` invalid usage (`E_USAGE`), `2` unexpected
system failure (`E_INTERNAL`). Help/version without `--json` use plain text.
No command prompts, uses color, checks for updates or accesses provider stores.

Current capability IDs are `toolkit.capabilities.v1`, `cli.help.v1` and
`cli.version.v1`. The `providers` list is empty until provider operations ship.
Consumers must check capabilities in addition to version. Future operational
commands and schemas will be added deliberately; this package does not expose
placeholder commands that appear usable.

## Development

From the repository root: `pnpm run build:toolkit`, `pnpm run type-check`, and
`pnpm run test:vitest tests/release/session-toolkit-cli.test.ts`. The public
package has independent SemVer and `session-toolkit-vX.Y.Z` release tags.
