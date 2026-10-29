# p01 package-boundary verification

Evidence date: 2026-10-29. Request:
`session-toolkit-p01-implement-20261029`. Phase base:
`66b90a7d78f02fc0b5b73e9d24f70a2644743bdc`. The package is an unpublished
0.1.0 boundary with help/version/capabilities only. Provider operations remain
p02/p03 work; publication and consumer cutover remain p04/p05 work.

## Exact archive and runtime proof

Prepared from clean Skills HEAD
`2b0f41c8524d45cfa3ba0088b07b937009bfb16d` on actual Node **v24.21.0**:

```sh
PATH=/Users/tstang/.nvm/versions/node/v24.21.0/bin:$PATH \
  pnpm run release:toolkit:dry-run --out /tmp/session-toolkit-p01-clean-20261029

PATH=/Users/tstang/.nvm/versions/node/v24.21.0/bin:$PATH \
  pnpm run toolkit:pack:check \
  --archive /tmp/session-toolkit-p01-clean-20261029/tkstang-session-toolkit-0.1.0.tgz \
  --node /Users/tstang/.npm/_npx/054abb958ec2ead1/node_modules/node/bin/node
```

The second consumer runtime reports actual **v22.0.0**, the declared minimum;
it is not a newer Node 22 patch standing in for the floor. Node locations are
local evidence paths, not installation instructions. pnpm is pinned at 10.13.1.

| Property            | Observed result                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Archive             | `tkstang-session-toolkit-0.1.0.tgz`, 9 allowlisted files                                                                  |
| SHA256              | `dca9d5f548c52bf3a2ae41f0cf918665e434a3837e9dc8a79becdd4a9d2ada67`                                                        |
| npm integrity       | `sha512-UJA+old78SAOFkVC2UuLnrt8Q7hy0Ictz3iEehsG/DC8SsMK1eQbni8m7RFFn84Bj+vwZWBruKa93w/Vaoa/dA==`                         |
| Metadata            | Public ESM root API, declarations, `seshtk` bin, correct shebang/executable mode, Node >=22.0.0                           |
| Dependencies        | Commander ^14.0.3 only; no private workspace package names, unresolved local/workspace specs or install lifecycle scripts |
| Isolated install    | Same archive installed outside the repository on both actual runtimes                                                     |
| Import proof        | Public API import completed, remained silent, did not exit early or alter isolated state                                  |
| Installed CLI       | Version, text/JSON help and capabilities succeeded on both runtimes                                                       |
| Publication dry run | Node 24 `npm publish --dry-run` on the archive passed; no publish performed                                               |
| Receipt             | Local `release.json` and `SHA256SUMS`; `publication_authorized: false`                                                    |
| Tree                | Clean before preparation and after both archive verifications                                                             |

CI `.github/workflows/session-toolkit.yml` prepares on Node 24 and uploads that
archive; consumer jobs download/checksum/verify the same bytes on Node 22.0.0
and 24. It has read-only permissions and no publishing job. Local checks do not
claim that a GitHub workflow run or npm trusted publisher has succeeded.

## Contract and targeted proof

- Built help/capabilities were compared with the [command map](cli-command-map.md)
  and [package contract](package-contract.md). Only the three implemented IDs
  are returned and `providers` is empty. `getCapabilities` is the only API value
  export. Reserved operation/error IDs are clearly distinguished from 0.1.0.
- Seven focused CLI/import/package-guard/metadata tests passed before t02 commit.
  They cover machine framing and usage failure, import isolation, private/local
  dependency rejection and install-script rejection; installed archive checks
  separately exercise the actual consumer artifact.
- Root/package type-check, scoped oxlint/oxfmt, actionlint and diff whitespace
  checks passed before the t01/t02 commits. Generated payload freshness passed.
- [Consumer inventory](consumer-inventory.md) maps actual Skills and ORC owners,
  persistence and coordinate differences. Donor code was inspected read-only;
  no existing skill requires this unpublished package.

## Phase-wide checks

| Check                                              | Result                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run test`                                    | Failed: 184 files / 2,848 tests passed; 2 files / 17 tests failed; 2 files / 3 tests skipped. All failures are the baseline environment collision below.            |
| `pnpm run type-check`                              | Passed root and public package checks.                                                                                                                              |
| `pnpm run build:check`                             | Passed standalone after suite completion. The concurrent invocation observed the existing drift test's intentional temporary output mutation, not persistent drift. |
| `pnpm run validate`                                | Passed.                                                                                                                                                             |
| `pnpm run smoke`                                   | Passed.                                                                                                                                                             |
| Scoped oxlint / oxfmt                              | Passed applicable authored package/tooling/test/docs files. Lifecycle Markdown formatted through stdin; generated outputs, YAML and AGENTS excluded as instructed.  |
| `actionlint .github/workflows/session-toolkit.yml` | Passed.                                                                                                                                                             |
| Local Markdown references / `git diff --check`     | Passed.                                                                                                                                                             |

The unchanged `src/shared/collaboration/log.test.ts` and `messages.test.ts`
fixtures use `/tmp/a` and `/tmp/b` as worktree directories. `lstat` shows these
paths are existing regular files, 620 and 597 bytes respectively; their contents
and ownership provenance were not inspected and they were not moved/deleted.
Every failure is `TypeError: worktree must be a directory` at unchanged
`src/shared/collaboration/membership.ts:83`.

`git diff --exit-code 66b90a7d78f02fc0b5b73e9d24f70a2644743bdc --` on
those three files passed. A pristine `git archive` of that anchor, using only a
symlink to existing developer dependencies, reproduced all 17 identical failures
with `pnpm run test:vitest src/shared/collaboration/log.test.ts
src/shared/collaboration/messages.test.ts`. Baseline evidence directory:
`/var/folders/_v/ld1wc16d0sg2qxkqjxgm7dyc0000gn/T/session-toolkit-p01-baseline-4jvh9l3o`,
log `focused-baseline.log`. This establishes an existing host/fixture collision,
not a p01 regression; it does not make the full-suite result pass.

Root directed a remaining-suite run excluding exactly these two baseline files:

```sh
pnpm run test:vitest --exclude src/shared/collaboration/log.test.ts \
  --exclude src/shared/collaboration/messages.test.ts
```

Result: **passed**, 184 files / 2,848 tests passed, 2 files / 3 tests skipped.
No unrelated test or scratch file is changed and no recovery attempt is consumed
for this baseline validation. Independent review and root disposition retain the
full-suite environment limitation. Root directed a DONE_WITH_CONCERNS handoff: passing remaining-suite and p01-scoped
checks satisfy relevant phase verification, while the failed full suite remains
unresolved for independent review. The phase stays in_progress pending acceptance;
its Head marker records the implementation boundary without claiming a full-suite pass.

## Recovery and limits

One mechanically bounded t01 test-guard defect was repaired in immutable commit
`7d4056de6f0398b2e7ffa7994c35d8122c58d230`; the original implementation
commit remains unchanged. Focused metadata test, type-check, build:check and CLI
tests passed before and immediately after the recovery commit. Canonical event
`session-toolkit-p01-recovery-01` is recorded in the phase journal. Durable usage
is **1/10**, remaining **9**; the completed pending marker remains for root
validation and clearing. Remaining capacity does not authorize retry after a
failed attempt.

No live provider fixture parity, update notices, publication, npm account rights,
trusted-publisher configuration, consumer migration or release installation is
claimed in p01. Their designated phases retain those exit criteria. The npm
bootstrap/access findings and required review/branch strategy are recorded in
the inventory and `RELEASING.md`.
