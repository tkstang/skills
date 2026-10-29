# p03 verification evidence

Scope: stateless raw-evidence search/estimate, full sensitive structured activity,
interactive-only cached update notices, installed archive proof and contract docs.
No production consumer cutover, publication, credential or live-transcript work.

## Candidate package and repository checks

- Toolkit build passes before built CLI tests.
- Root and package type-check pass.
- All package tests:28 files/624 tests pass, included in the committed recovery rerun.
- Scoped oxlint/oxfmt over authored package source/tests, helper, archive tooling,
  README and changelog pass. Lifecycle Markdown is formatted through stdin.
- Remaining repository suite, including unchanged donor search/activity tests:

  ```sh
  pnpm run test:vitest --exclude src/shared/collaboration/log.test.ts \
    --exclude src/shared/collaboration/messages.test.ts
  ```

  **210 files/3,466 tests pass**,2 files/3 tests skipped. Authoritative committed-HEAD log:
  `/tmp/session-toolkit-p03-recovery-post-suite.log`. The pre-commit check
  `/tmp/session-toolkit-p03-recovery-pre-suite.log` passes the same set. The same two unchanged baseline files
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

## Final exact archive candidate

Prepared with Node24.21.0 PATH using:

```sh
pnpm run release:toolkit:dry-run --out /tmp/session-toolkit-p03-final-proof-20261029
pnpm run toolkit:pack:check --archive /tmp/session-toolkit-p03-final-proof-20261029/tkstang-session-toolkit-0.1.0.tgz --node /Users/tstang/.npm/_npx/054abb958ec2ead1/node_modules/node/bin/node
```

- Archive SHA256:
  `4490775e57a55e1b659226c60f29fc65e7546e5086a9303b91dc6c9970521c84`.
- 51 regular allowlisted files; no donor/source/test payload, unresolved local
  dependencies or installed lifecycle scripts. Bin executable and root-only
  export contract verified. Flat declarations avoid omitted nested type files.
- Same exact bytes clean-installed outside the checkout on actual **v22.0.0**
  and **v24.21.0**. Import safety, version/help/capabilities, all inherited
  operations, raw-tool search, scan estimate/refusal, full activity, CLI JSON
  artifact and strict installed TypeScript consumer pass.
- npm publication dry run passes; publication_authorized remains false.
  Preparation HEAD is the successful recovery commit
  `6b801bc74e205ee0491f36d0d65f9c583bc885be`. This replaces the initial t04
  archive; all final package bytes include the continuation correction.
  Subsequent changes are project evidence and journal only. This is development
  proof, not a publication attestation.
- Separate clean-installed continuation assertion on the same exact archive:

  ```sh
  /Users/tstang/.nvm/versions/node/v24.21.0/bin/node /tmp/session-toolkit-p03-installed-continuation.mjs /tmp/session-toolkit-p03-final-proof-20261029/tkstang-session-toolkit-0.1.0.tgz /Users/tstang/.npm/_npx/054abb958ec2ead1/node_modules/node/bin/node /Users/tstang/.nvm/versions/node/v24.21.0/bin/node
  ```

  Both actual runtimes retain the selected native Codex identity on a headerless
  suffix page. Release logs: `/tmp/session-toolkit-p03-final-pack24.log` and
  `/tmp/session-toolkit-p03-final-pack22.log`.

## Recovery and handoff

The final public transition assertion confirmed a Codex headerless-continuation
composition defect in original task p03-t02 (`29983c05b73353bd2c1826ef7db4c7f81bc6d626`).
The selected identity had already been validated by exact discovery, but activity
extraction inferred a rollout filename from page-local metadata. The bounded
correction passes the discovered source identity into activity and usage
extraction; existing summary/read behavior is unchanged. Public regression
checks source identity, event keys, matching usage samples and honest suffix
coverage. Original task history remains immutable.

- Reservation: `656db99e1757bfca9a17393e7a73b6a294d69955`, before correction edits.
- Successful append-only recovery: `6b801bc74e205ee0491f36d0d65f9c583bc885be`.
- Focused public API regression (5 tests), built public continuation assertion,
  root/package types, scoped lint/format and full applicable phase checks pass
  before the candidate commit. Focused assertion, 5-test public suite, types,
  broad suite, build:check, validate and smoke pass again on committed HEAD.
- Effective limit10, prior durable usage0, final usage1, remaining9. The matching
  pending attempt is committed as completed and intentionally retained for root
  validation. p01/p02 usage is unchanged. This is capacity disclosure, not
  authority for another attempt.
- No nested dispatch, live-provider certification, consumer migration,
  publication, push or credential operation occurred. Root owns independent
  review and phase acceptance.
