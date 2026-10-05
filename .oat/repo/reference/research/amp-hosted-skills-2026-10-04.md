# Amp hosted Skills static compatibility audit

Source date: 2026-10-04. Upstream snapshot: `1f9f4e287bf3b85c3ed6589e31bc6c138042eaf9`.
Scope: generated `skills/*/` and `plugins/*/skills/*/` payloads; no raw source import,
real installation, account publication, authentication or live Amp execution.
Execution: `tstang-mini.local`, worktree `/Users/tstang/Code/worktrees/skills/amp-cloud-onboarding`,
branch `feat/amp-cloud-onboarding`, native child `/root/amp_installer_implementation`.
Standalone persisted session identity/sidebar visibility unavailable.

## Vendor contract

[Skills](https://ampcode.com/docs/customize/skills) and
[Global Plugins & Skills](https://ampcode.com/docs/customize/global-plugins-and-skills)
were read on the source date. Hosted skill roots are immediate children of the
personal/workspace repository; dirname equals frontmatter name. Documented limits
are 200 skills/repository, 200 files/skill, 10 MiB/file, 25 MiB/skill and
25 MiB/repository, with text files only. Hosted symlink support is not established.
Local recursive discovery does not prove hosted recursive discovery. Workspace
publication is admin-managed; machine `--global` is distinct from hosted scope.

## Measured payloads

17 standalone units: 102 regular files, 5,611,693 bytes. Maxima: 19 files/skill,
2,180,634 bytes/skill and 516,172 bytes/file. All are below the documented limits.
16 plugin forms: 141 regular files, 6,541,916 bytes.
Combined: 33 units, 243 files, 12,153,609 bytes; this sum is an audit inventory,
not a proposed hosted import. Plugin-root shared helpers are outside that sum.
Every audited regular file decoded as UTF-8 without NUL bytes; no symlinks or
frontmatter/directory name mismatches were present. This text heuristic is static
evidence, not proof of acceptance by Amp's server-side file classifier.

| Standalone | Version | Files | Bytes |
| --- | --- | --- | --- |
| `agent-messaging` | 1.0.25 | 10 | 501,384 |
| `align` | 1.0.1 | 1 | 6,008 |
| `author-skill` | 1.3.1 | 6 | 19,889 |
| `babysit-pr` | 1.0.2 | 2 | 20,543 |
| `complexity-review` | 1.0.3 | 2 | 22,937 |
| `consensus-review` | 0.1.23 | 3 | 189,997 |
| `land-pr` | 1.0.2 | 1 | 6,464 |
| `must-we` | 1.0.1 | 1 | 6,616 |
| `next-steps` | 1.0.1 | 1 | 4,164 |
| `phone-a-friend` | 0.3.0 | 8 | 179,273 |
| `session-export-transcript` | 2.0.41 | 7 | 280,433 |
| `session-fork-to-destination` | 0.3.3 | 4 | 193,496 |
| `session-handoff` | 1.1.3 | 2 | 12,082 |
| `session-observer` | 1.1.0 | 19 | 2,180,634 |
| `session-observer-collab` | 1.0.78 | 14 | 1,404,546 |
| `session-retro` | 1.0.4 | 2 | 16,117 |
| `session-search` | 0.1.2 | 19 | 567,110 |

## Functional and resource findings

- No concrete broken standalone Markdown resource link, static relative ESM
  import, or `new URL(..., import.meta.url)` resource was found. Scanning cannot
  prove every computed path or execution branch.
- Six plugin-only workflows (`create`, `decide`, `evaluate`, `panel`, `plan`,
  `refine`) require the existing plugin-root `scripts/consensus.mjs` outside the
  copied child. Example: `plugins/consensus/skills/create/scripts/consensus-create.mjs:1114`.
  This is an intentional complete-plugin boundary, not an upstream packaging defect.
  The sibling `./consensus.mjs` lookup in five bundles is one candidate before the
  present plugin-root candidate (`defaultConsensusCliPaths`); it is not a proven
  broken required resource. Do not flatten these units into hosted standalone skills.
- `skills/agent-messaging/scripts/agent-messaging.mjs:64` admits only Codex,
  Claude Code and Cursor runtime pins; Amp cannot be relabeled as one of them.
- `skills/consensus-review/scripts/review.mjs:5043` restricts actual `--host` to
  Claude, Codex or Cursor; installer selection does not add runtime support.
- `skills/session-export-transcript/SKILL.md:231` documents supported local
  provider transcript homes. Observer, search and fork consume related local
  stores; collaboration needs exact supported identities and host-specific wake
  evidence. Retro requires the exporter and frozen evidence (`skills/session-retro/SKILL.md:22`).
  None is an Amp conversation adapter.
- `skills/phone-a-friend/SKILL.md:32` requires Node 22+, the bundled helper and
  authenticated supported peer CLIs. Hosted storage supplies none of those.
- `next-steps`, `align`, `must-we` have no runtime. Author Skill and Complexity
  Review need file/repository access for file work; core Handoff can omit its
  optional observer/export integrations (`skills/session-handoff/SKILL.md:58`).
  Babysit PR needs authenticated GitHub, Git and repository validation; Land PR
  also needs Babysit PR and explicit merge authority.
- No mandatory Mac/Vault absolute path, native-subagent dependency, or missing
  resource was established for the starter candidates. Provider-specific tool
  names and example paths are context to inspect, not proof of a defect.

## Reproduction and validation

Inventory method: enumerate each generated immediate child with `SKILL.md`;
`lstat` symlinks separately; sum every regular payload file's `stat().st_size`;
decode UTF-8 and reject NUL; compare frontmatter name to directory. Scan Markdown
relative links, static relative ESM imports and literal `new URL` paths, then
inspect candidate misses/escapes in their actual resolution logic. No code is
executed by that inventory. Functional judgments above cite inspected instructions
and generated guards, rather than generic pattern hits.

Commands and results:

- `gh pr list --repo tkstang/skills --state open`: no overlapping open PRs.
- Bounded backlog search: existing standalone live acceptance remains in
  `BL-260916-add-a-first-party-install`; this audit does not satisfy its live gate.
- `GIT_HOOKS=0 pnpm install --frozen-lockfile`: developer dependencies only; passed.
- `pnpm run build:check` before edits: generated payloads in sync.
- Python inventory and relative-resource review: measurements/findings above.
- `pnpm --dir documentation build`: passed, 64 static pages; generated docs index updated.
- Python local-link/anchor and map/sidebar checks: 39 links/anchors passed.
- Changed authored docs/JSON `oxfmt --check` and `git diff --check`: passed.
- `pnpm run type-check` and post-edit `pnpm run build:check`: passed.
- First `pnpm run test`: 2,870 passed, 3 skipped, one pre-existing drift test hit
  its 30-second timeout. No generated changes remained. Cause not conclusively
  established; runtime contention is a possible explanation.
- `pnpm run test:vitest tests/tooling/generated-output-sync.test.ts`: all 25 passed.
- `pnpm run test:vitest --maxWorkers 4`: full suite passed, 2,871 tests and 3 skipped.
- `pnpm run validate`, `pnpm run smoke`,
  `pnpm run validate:skill-versions -- --base-ref origin/main`, and
  `pnpm run validate:internal-flags`: passed; zero changed canonical skills.

No source/payload fix or new validator is warranted by this snapshot. Documentation
adds selective onboarding with reviewed manual Git copies and source-SHA/version
provenance. Amp-native shared imports use the documented share origin and update
workflow; a manual Git copy has no inferred synchronization contract. Hosted copy,
fresh discovery and bounded live execution remain separate evidence stages.
