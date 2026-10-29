# p03 verification evidence

Scope: stateless raw-evidence search/estimate, full sensitive structured activity,
interactive-only cached update notices, installed archive proof and contract docs.
No production consumer cutover, publication, credential or live-transcript work.

## Candidate package and repository checks

- Toolkit build passes before built CLI tests.
- Root and package type-check pass.
- All package tests:28 files/623 tests pass.
- Scoped oxlint/oxfmt over authored package source/tests, helper, archive tooling,
  README and changelog pass. Lifecycle Markdown is formatted through stdin.
- Remaining repository suite, including unchanged donor search/activity tests:

  ```sh
  pnpm run test:vitest --exclude src/shared/collaboration/log.test.ts \
    --exclude src/shared/collaboration/messages.test.ts
  ```

  **210 files/3,465 tests pass**,2 files/3 tests skipped. Log:
  `/tmp/session-toolkit-p03-suite.log`. The same two unchanged baseline files
  have17 previously verified environmental failures caused by unrelated
  `/tmp/a` and `/tmp/b` regular-file collisions. Those paths were never read,
  moved or removed. No full-suite pass is claimed.

- `pnpm run build:check` passes after the broad suite, serialized with its
  generated-output mutation tests. `pnpm run validate` and `pnpm run smoke` pass.
- Public API/CLI fixtures retain long raw evidence absent from conversation
  previews, refuse unapproved scans, and preserve source bounds. Extracted donor
  cases protect regex/literal, widening/tiers, metadata/history, redaction,
  deadlines/oversize and optional accelerators/fallbacks. See p03-parity.md.
- Built updater subprocesses independently record external fetch requests. Cache,
  stable-version, current/newer/offline/malformed/expiry, stdout isolation and
  1-second abort cases pass. All suppressed contexts including bare capabilities
  and library import issue zero requests, no notices or cache writes.

## Initial exact archive candidate

Prepared with Node24.21.0 PATH using:

```sh
pnpm run release:toolkit:dry-run --out /tmp/session-toolkit-p03-proof-20261029
pnpm run toolkit:pack:check --archive /tmp/session-toolkit-p03-proof-20261029/tkstang-session-toolkit-0.1.0.tgz --node /Users/tstang/.npm/_npx/054abb958ec2ead1/node_modules/node/bin/node
```

- Archive SHA256:
  `50579cf159c725d50c621332e0523ddc5d8d8ea7823d41a92b8dbabe45957918`.
- 51 regular allowlisted files; no donor/source/test payload, unresolved local
  dependencies or installed lifecycle scripts. Bin executable and root-only
  export contract verified. Flat declarations avoid omitted nested type files.
- Same exact bytes clean-installed outside the checkout on actual **v22.0.0**
  and **v24.21.0**. Import safety, version/help/capabilities, all inherited
  operations, raw-tool search, scan estimate/refusal, full activity, CLI JSON
  artifact and strict installed TypeScript consumer pass.
- npm publication dry run passes; publication_authorized remains false.
  This archive includes the t04 pending README/proof diff and preparation
  HEAD 1d2bf2d5d81b40f336268b1c31cd8095097956a7. It is development proof,
  not a publication attestation. A later correction requires a fresh archive.

## Recovery capacity and remaining boundary

Effective limit10, prior durable usage0, remaining10, pendingnull. No recovery
attempt consumed at the t04 candidate boundary. A final continuation-provenance
transition assertion remains to confirm source identity on headerless suffix
pages; initial archive proof above does not claim that additional criterion.
