# Shared session toolkit: Opus 5.5 High review

Date: 2026-10-28. Reviewer: `claude-opus-5-5`, effort `high`, through T3 Code.

Reviewed proposal commit: `fac5f11`. The proposal has since been revised; the review's line numbers refer to that original commit. The feedback below is preserved as returned. Root-agent dispositions follow in the [revised proposal](2026-10-28-shared-session-toolkit.md#review-outcome-and-open-choices). This review is advice, not an accepted decision.

## Reviewer feedback

**Overall judgment:** The direction holds up. One authored source in a child workspace package here, consumed by ORC as a semver dependency, removes the real cross-repo duplication. Four things need fixing before anyone accepts the proposal:

- It overstates how far ahead ORC's packaging is.
- It understates the Skills identity code.
- It never names the accepted decision it would overturn.
- It assumes every skill should require the CLI at runtime, without weighing the option of bundling the package at build time.

The first release is also too broad. Search and attention each have only one consumer today.

## Factual errors (corrections required)

**E1. ORC is ahead on structure, not on packaging or distribution (brainstorm L13, L53, L104).** You were half right.
- All five ORC packages are `private: true` at `0.0.1` (`orc/packages/*/package.json`).
- The only workflow is `.github/workflows/ci.yml`; nothing publishes.
- `orc` has no `--version` flag. You install it with `pnpm cli:link` from a checkout, and the docs say it has "no published release channel" (`orc/skills/orc-cli/references/cli-prerequisites.md`).
- Where ORC really is ahead:
  - typed packages that build `dist` and declare `exports`/`bin`;
  - a JSON envelope (`packages/cli/src/envelope.ts`) with `E_*` codes (`commands/session-log.ts:49-53`);
  - a built-binary smoke test (`packages/cli/src/binary-smoke.test.ts`).
- The proven npm publishing setup you already own is the `@open-agent-toolkit/*` release flow. A registry search for `maintainer:tkstang` returns those packages, and Foundations cites it in `git-ci-release.md:102-110`.
- The `self-identify` example shows a CLI prerequisite pointing at an unversioned binary linked from a checkout. It is not evidence that an npm-dependency model already works.

**E2. The identity row (L34) understates Skills.**
- Observer's `resolveSelfIdentity` (`src/skills/session-observer/src/lib/observe.ts:185`) reads the same exact harness IDs as ORC: `CLAUDE_CODE_SESSION_ID`/`CLAUDE_SESSION_ID`, `CODEX_THREAD_ID` and `CURSOR_SESSION_ID` (`observe.ts:103-118`, compare ORC `packages/session-log/src/identity.ts:44-48`).
- It reports ambiguity through `ExactSessionIdentityError`.
- It returns more lineage than ORC: root, parent, forked-from and subagent ordinal (`observe.ts:266-286`). ORC's `CurrentTranscriptIdentity` has only `parentSessionId` (`identity.ts:26-39`).
- ORC adds `CURSOR_CONVERSATION_ID`, revalidation by `dev`/`ino`/size (`identity.ts:50-53`), entry and metadata limits, and contract labels.
- Observer's real flaw is that one result type mixes exact sources with the heuristic `same-cwd-transcript` source (`observe.ts:293-318`).
- Corrected conclusion: merge ORC's fail-closed states and revalidation with observer's lineage fields and the union of env vars, and split exact identity from ranked selection. Following "take ORC's primitive as the basis" literally would drop the lineage that observer and fork rely on.

**E3. The proposal doesn't name the accepted decision it overturns.**
- `DR-260514-session-observer-is-standalone` (Accepted) says observer "must work on machines that never installed" its dependency, and that "porting beats coupling."
- The root `AGENTS.md` says shipped skills run with no install step.
- L103 and L137 only say the instructions should be "revised deliberately." The proposal should name DR-260514 to supersede, and check DR-260914 (plugin grouping) and DR-260616 (build-time import rewrites).

**Claims I verified as correct:**
- ORC has no content search.
- The exporter calls `main()` unconditionally (`session-export-transcript.ts:1743`).
- `runSearch` is at `pipeline.ts:215`.
- `@orc/session-log` is private and depends on `@orc/core`.
- The unscoped `agent-sessions` exists at `0.0.0`; `session-kit` and both `@tkstang/*` names return 404.

## Design findings, by priority

1. **High: missed coupling with ORC's own skill guidance.**
   - ORC's skills name `session-observer` as the source of truth for transcript discovery, offsets, catch-up and watch (`orc/skills/orc-cli/SKILL.md:232`, `orc/skills/README.md:70-73, 102-106`).
   - The sequence defers observer, watch and catch-up to step 5 (L83, L178), but migrates `orc session-log` code in step 4.
   - Result: the code ORC routes to stays on a bundled copy, and the ORC path its docs don't route to moves first.
   - The plan also leaves three export CLIs alive: `orc session-log export`, the package exporter and the skill exporter.
   - The plan needs to decide whether `orc session-log locate/read/catch-up/export` survive, and to update ORC's skill docs in the same migration.

2. **High: the options table is missing a hybrid.**
   - Most duplication inside Skills is generated: the runtime wrappers are `export * from '../../../../shared/transcript/runtimes.js'`.
   - The remaining authored coupling is cross-skill source roots:
     - in `src/distributions.ts`, search pulls in the exporter, and fork pulls in observer and the exporter;
     - outside that file, collab imports observer source.
   - A workspace package can be the single authored source and serve two roles:
     - an npm dependency for ORC, which removes the duplication L51 identifies;
     - code bundled at build time into skills that must not depend on the network.
   - Bundling matters most for the collab hooks (`hooks/codex-stop.mjs`, `cursor-stop.mjs`, `claude-monitor.mjs`), marketplace plugin installs and offline sandboxes. Hooks fetching through `npx`, or failing on a missing global CLI, would be a regression.
   - Option 1 at L101 conflates "keep bundled copies" with "bundle from one package source."

3. **High: release deadlocks and latency.**
   - A change that touches both the package and a skill becomes: package PR, publish, then a second PR that bumps the skill's version (enforced by `validate-skill-versions`), with a possible plugin release on top.
   - A fix for a provider format change goes from one skill reinstall to publish plus a manual global upgrade, or edits to the pinned version in every skill.
   - ORC's `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` and excludes only pinned OAT versions. A freshly published toolkit version can't be installed in ORC for 24 hours unless you add it to the exclude list.
   - The ORC dev loop against unreleased package changes (link or overrides that are never committed) is not described.

4. **Medium: the first release is too broad (L57-65, L176).** Choose what to extract by which consumers overlap:
   - Shared by both repos: identity, store enumeration, detailed reads, sanitized export.
   - Search: only `session-search` uses it, and ORC has none.
   - Attention: only ORC's super.engineering adapter uses it.
   - Moving single-consumer code into a public API adds semver surface without removing any duplication. Move it later, if a second consumer appears or you choose the runtime-prerequisite model for that skill.

5. **Medium: install security (L154-164).**
   - Running `npx agent-sessions` without `--package=@tkstang/…` fetches the unrelated unscoped package (registry 200, last modified 2026-05-11).
   - Make this a requirement: the bin name must not match an existing unscoped package, or every instruction must use the `--package` form.
   - The package must ship `--version` plus a capabilities command for prerequisite checks (L145). ORC's `--help` probe is not sufficient.
   - This favours `session-kit` or another distinct bin name.

6. **Medium: workspace cost is understated (L9).**
   - Skills pins pnpm 10.13.1, Node >=22 and TypeScript ^6. The docs app has its own `documentation/pnpm-lock.yaml` and must stay outside the workspace.
   - These all need changes: `build-generated.ts` `allowedSourceRoots`, `run-vitest.mjs`, root type-check, lint-staged and CI exclusions, and the skill-version rule. If skills bundle from the package, a change under `packages/` must bump those skills' versions.
   - Rejecting Turborepo in favour of plain `pnpm -r` is correct (Foundations `structure.md`, §1).

7. **Low: ORC's coupling is unevenly spread.**
   - `identity.ts` and `terminal-attention.ts` import only `node:*` and local modules, so identity extraction is easy.
   - The `@orc/core` coupling sits in discovery, providers, `jsonl`, `sanitize`, `observe` and the bridge: 11 imports of the 252-line `session-log-types.ts`, which ORC's CLI and adapters also use.

8. **Low: Foundations.** Neither donor's CLI uses Commander; both parse arguments by hand. The Foundations-style CLI layer is therefore new code, not extraction. Independent versioning for one standalone library is allowed (`git-ci-release.md:98`). The rest of the alignment is accurate.

9. **Low: inventory gap.** Stoa has its own `apps/server/src/client/adapters/claude-code.ts` and `codex.ts`. Note them in the evidence boundary; don't expand scope.

## Material tradeoffs

- **Runtime prerequisite vs bundling at build time.**
  - Runtime prerequisite: smaller skills and one runtime version on the machine, at the cost of network/install friction, a prerequisite conversation, global-install drift and slower hotfixes.
  - Bundling: works offline and in hooks, and removes authored duplication, but shipped bytes are still copied.
- **Exact-identity merge:** ORC's strictness plus observer's lineage, versus picking one donor and losing capability.
- **Public API breadth:** each projection exported is a semver promise. Single-consumer code is cheaper left in its owner.

## Recommended changes

1. Rewrite L13 and the L34 identity row per E1 and E2.
2. Add a "decisions superseded" section: DR-260514, the `AGENTS.md` dependency rule, and check DR-260914 and DR-260616.
3. Add the hybrid option. Recommend bundling for observer, collab and hook paths at minimum, and treat requiring the CLI at runtime as a per-skill choice.
4. Limit the first release to identity, enumeration, detailed reads and sanitized export. Defer search and attention until a second consumer exists.
5. Add to the migration plan:
   - the fate of each `orc session-log` subcommand (clean break, per `AGENTS.md`);
   - updates to ORC's skill docs (`orc-cli`, `README`);
   - the ORC `minimumReleaseAge` exclusion;
   - the unreleased-package dev loop.
6. Require: a bin name that doesn't collide, `--version` plus a capabilities command, `npx` only in `--package` form, and the OAT release workflow as the template.
7. Change the scope evidence: npm search suggests account `tkstang` exists and maintains OAT. Still verify publish rights.

## Your decisions

1. For each skill: require the CLI at runtime, or bundle the package at build time? Hooks and marketplace plugins are the key cases.
2. First-release scope: shared code only, or the full list?
3. Package name and bin name. Avoid `agent-sessions` as the bin.
4. Node floor: 22 or 24.
5. Remove or keep the `orc session-log` commands after migration.
6. Supersede DR-260514 now, or only for the skills that migrate.
7. Release cadence, and whether to exempt this package from ORC's 24-hour `minimumReleaseAge` hold.

Everything was read-only: no files edited, nothing installed, no transcripts opened. The npm checks were anonymous public GETs.
