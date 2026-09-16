# Review: Astra's content pass (commit 25114667) and alpha sweep (0154b69f)

Reviewer: Fable (claude-code:db9c1e96). Date: 2026-09-16. Scope: `25114667 docs: expand engineering guides and streamline onboarding` (28 files, +663/−218) and `0154b69f docs: clarify alpha maturity and collaborative observer naming`.

## Method

- Read in full: `README.md`, `typescript-and-build-tooling.md`, `testing.md`, `consensus-runtime.md`, the "Why this strategy" section of `architecture/index.md`, and the added lines in `authoring.md`, `installation.md`, `getting-started/index.md`, `documentation/AGENTS.md`, `scripts/validate.ts`, `tests/repo/readme-scope.test.ts`.
- Spot-checked claims against source: `tsconfig.json` (ES2024, NodeNext ×2, noEmit, allowJs/checkJs false, isolatedModules, verbatimModuleSyntax) — all as stated; `package.json` scripts `premerge`, `test`, `test:vitest`, `type-check` — exist as described; `src/skills/create/build.json` — matches the example verbatim; `invocation.ts` sets `shell: false` on every provider invocation — as stated; the README's prompt-transport description ("Claude receives prompt/output flags") is consistent with the corrected trust diagram.
- Did not independently verify every claim in `consensus-runtime.md` (records writer rename/sync, guard recursion depth, submit-capture precedence); Astra's own independent review covered those. Flagged below where I would want a second look.
- Astra's alpha sweep was checked earlier: five stale wordings gone, `Collaborative Observer` consistent, canonical skill at 0.2.3, CLI status string untouched.

## Verdict

Accept. The commit does what the approved map asked: the README is now an entry point with a task table and a one-skill quick start; Getting Started is self-contained for the standalone path and now covers Cursor; the Engineering trunk gains three pages that were genuinely missing (TypeScript & build tooling, Testing, Consensus Runtime); the architecture overview explains the single-source tradeoffs rather than only the mechanics; the authoring rules now say how sidebar borrowing works, which closes finding 3 of my navigation review; the "in the sidebar" maintenance notes are gone (finding 4).

## Findings (none blocking)

1. **The README quick-start command is a live-provider path claim.** `npx skills add https://github.com/tkstang/skills/tree/main/skills/next-steps --agent codex` is asserted in the README, the installation page, and now a test. The repo's AGENTS.md says not to document provider support as complete until the release checklist verifies the live path. The prose hedges correctly ("review the installer confirmation", "does not by itself establish fresh-session discovery"), so this is acceptable, but add the command to the release checklist's live-verification list so the claim is re-proven at tag time. The pinned `install.sh` reference on the installation page (v0.1.2) is deliberate pre-release pinning, not rot.
2. **`validate.ts` gate moved, not weakened — confirm the test still fails on regression.** The install-matrix gate now reads `documentation/docs/user-guide/installation.md` for `## Install matrix` and the three provider commands, and the README test asserts the quick-start command and the matrix link. That preserves the tag-time gate. One gap: nothing asserts that the README still *links* to Getting Started or the docs root; if the README is the entry point, the link set is part of its contract. Suggest one assertion for the docs-root link.
3. **`consensus-runtime.md` two sentences to re-check.** "The writer rewrites that array through a same-directory temporary file, sync, and rename" and "the guard tracks the host, run id, and recursion depth… blocks same- or cross-provider spawning beyond the configured maximum depth" are precise implementation claims; cite the file on the page or keep them in the companion audit so a reader can verify. I could not find a `records*.ts` by that name in `src/plugins/consensus/core/`; the writer lives elsewhere. Not wrong, just uncited.
4. **Testing page: one command to double-check.** `pnpm run test:vitest tests/tooling/skill-packaging.test.ts` is given as an "installed payload boundaries" example; confirm that file exists under that exact name (the suite Astra referenced earlier was `tests/tooling/generated-output-sync.test.ts`).
5. **TypeScript page: the `.d.mts` exception paragraph is the best paragraph in the commit.** It says exactly what a passing type check does not prove. Keep it.
6. **Consistency after the diagram placements.** The consensus overview now has three diagrams and two new sections; its opening paragraph still says "the peers are invoked through the generated consensus CLI" in a long sentence that the peers-not-personas section now illustrates. Consider trimming the intro to point at the section rather than restating it. Cosmetic.

## Requests to Astra

- Add the `npx skills add …` quick-start command to `RELEASING.md`'s live-verification items (finding 1).
- One README link assertion (finding 2), and confirm the test file name in finding 4.
- Cite or relocate the two implementation claims in finding 3.
