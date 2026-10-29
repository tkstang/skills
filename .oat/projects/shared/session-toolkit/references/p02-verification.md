# p02 verification evidence

Scope: identity, historical discovery, bounded read/parse, exact Codex evidence,
sanitized Markdown projection and built CLI. No production consumer cutover,
publication, state/watch ownership, live transcripts, search or full activity
command. [Parity matrix](p02-parity.md) records donor differences and limitations.

## Package and repository checks

- `pnpm run build:toolkit`: pass.
- `pnpm run type-check`: pass (root and package declarations).
- `pnpm run test:vitest tests/release/session-toolkit-*.test.ts`: 15 files /
  333 tests pass, including built operational CLI fixtures across all providers.
- Scoped `pnpm exec oxlint` and `pnpm exec oxfmt --check` over authored package,
  package tests, archive tooling, README and changelog: pass. Project Markdown
  is formatted through oxfmt stdin because lifecycle files are normally ignored.
- Remaining suite, exactly these two baseline exclusions:

  ```sh
  pnpm run test:vitest --exclude src/shared/collaboration/log.test.ts \
    --exclude src/shared/collaboration/messages.test.ts
  ```

  **197 files / 3,174 tests passed**, 2 files / 3 tests skipped. Log:
  `/tmp/session-toolkit-p02-suite.log`. Baseline full-suite limitation remains
  explicit: the two unchanged files have17 previously established failures due
  to unrelated `/tmp/a` and `/tmp/b` regular-file collisions. Those paths were
  not inspected, moved or removed. No full-suite pass is claimed.

- `pnpm run build:check`: pass, run after the remaining suite (never concurrently
  with its generated-output mutation guards).
- `pnpm run validate` and `pnpm run smoke`: pass.

## Exact archive (superseded before review fixes)

The following archive predates H1–H3 and must be rebuilt and rechecked after
root-owned M1/M2 corrections. It is retained as historical evidence only.

Prepared on actual Node24.21.0 with:

```sh
pnpm run release:toolkit:dry-run --out /tmp/session-toolkit-p02-final-proof-20261029
pnpm run toolkit:pack:check --archive /tmp/session-toolkit-p02-final-proof-20261029/tkstang-session-toolkit-0.1.0.tgz --node /Users/tstang/.npm/_npx/054abb958ec2ead1/node_modules/node/bin/node
```

- Archive: `/tmp/session-toolkit-p02-final-proof-20261029/tkstang-session-toolkit-0.1.0.tgz`.
- SHA256: `1156ee8cbe1cc1f77856c4cc2de4ed8265d40fed3462cececeb0ec2bd5da70d0`.
- 34 regular files, allowlisted package/dist/license/readme only, executable bin;
  no source/test/donor checkout payload, local dependency, private workspace
  dependency, links or installed lifecycle scripts.
- Same bytes clean-installed outside the repository and executed on actual
  **v22.0.0** and **v24.21.0**. Both pass import silence/no state, public name
  resolution, version/help/capabilities, API parse for Claude/Codex/Cursor,
  historical listing, exact identity/revalidation, explicit session read,
  Codex evidence and Markdown export. Built installed CLI parses all three
  providers, lists/reads, reads exact evidence and exports. Installed declarations
  compile a strict NodeNext consumer against the packed public types.
- `release.json` and `SHA256SUMS` accompany the archive; npm publication dry run
  passed. Their commit field names the preparation HEAD before t05 commit,
  `4220f41eec502065328499fc6edb86781c42222f`; the tarball includes the verified
  pending t05 product diff. This is development proof, not a release attestation.
- Initial `/tmp/session-toolkit-p02-archive-20261029` is an unsuccessful fixture
  preparation and is not the validated artifact. Canonicalizing the synthetic
  home fixed the intended symlink refusal, then the evidence oracle was changed
  to find the recorded call after metadata. Product code was unchanged by these
  fixture corrections. No publication performed.

## Recovery capacity

Effective limit10, prior durable usage3, used4/10 after bounded Cursor origin
and page-summary frame corrections; remaining6. Recovery-volume warning is
disclosed. Completed attempt4 marker is retained for root validation; recovery03
was settled by root `ffea28a2a491f0819020ac7a2f36253ee22de9b5`. Canonical events and immutable task
commits are recorded in the phase journal. No failed attempt or route fallback.

The remaining-suite totals precede the narrow page-summary frame correction.
After that correction, its pre-fix-failing public regression, all333 package
tests and type/build/lint checks passed; the archive was rebuilt and both Node
runtime proofs repeated. The unrelated broad suite was not repeated. One t05
package run overlapped an archive rebuild of ignored dist and saw missing bin
files; it was rerun after that build completed, with no product change. Checks
that build and execute the same output must run serially.

## Review fix p02-t06 (H1–H3)

- Regression proof before correction: the focused discovery/identity/read run
  failed the three intended assertions (unrelated Codex completeness, current
  Claude cwd slug, and practical 5,000-row parsing). The old 5,000-row parse
  took 22,807ms; log `/tmp/session-toolkit-p02-fix-r1-red.log`.
- Focused corrected run: 3 files / 64 tests pass in 329ms (250ms tests), including
  independently expected 5,000-row text/counts and a 4,500-message page, each
  below 5,000ms; record atomicity, diagnostic boundaries, contradictory Claude
  tool-ID fallback and Cursor pending-question/terminal continuation are covered.
- Final fix checks: toolkit build pass before test execution; all 15 package
  files / 340 tests pass; root and package type-check pass; scoped oxlint/oxfmt
  pass; build:check after the suite pass; validate and smoke pass. Every command
  completed with exit0. The unrelated broad suite was not repeated; its
  historical exclusions above remain explicit.
- Recovery ledger is settled: used4/10, remaining6, pendingnull. Review fixes
  consume no recovery attempt. The earlier completed04 handoff text above is
  historical and has since been settled by root.
