# Review: Astra's navigation pass (commit 8755cc62) and two uncommitted wording edits

Reviewer: Fable (claude-code:db9c1e96). Date: 2026-09-16. Scope: `8755cc62 docs: reorganize navigation and add operations guides` (25 files, +439/−62) plus the uncommitted edits to `user-guide/installation.md` and `user-guide/skills/session-fork-to-destination.md`.

## Method (what was actually checked)

- Read every `meta.json` change, every new page (`getting-started/index.md`, `plugins/index.md`, `plugins/session/index.md`, `operations/index.md`, `operations/ci.md`, `operations/releases-and-versioning.md`), and the diffs to `docs/index.md`, `user-guide/index.md`, `engineering/index.md`, `consensus/index.md`, `skills/index.md`, `architecture/index.md`.
- Confirmed the installed `fumadocs-core` schema supports the `pagesIndex` key and link entries used in `meta.json` (`node_modules/fumadocs-core/dist/source/schema.js`).
- Pulled the rendered sidebar from the running dev server (`/user-guide/consensus/refine/`): Home → User Guide → Getting Started / Plugins → Consensus (five separator groups render: Create, Plan & Decide · Improve & Assess · Consult Peers · Observe & Collaborate · Reference) with Observer and Collaborative Observer linking to `/user-guide/skills/...`; Session; Standalone Skills; Engineering. Matches the approved map.
- Resolved every relative link in the 12 changed/new Markdown files: none missing, none absolute.
- Fact-checked the two Operations pages against `.github/workflows/{validate,docs-ci,deploy-docs,live-e2e,release}.yml`, `scripts/bump-version.ts` (`--skill`, `--plugin`, `--check-tag` and the `--check-tag requires --plugin` rule), root `package.json` scripts (`build:check`, `type-check`, `validate`, `smoke`, `test:live-e2e`), `documentation/package.json` (`docs:format:check`), `submit-live.e2e.test.ts` (`CONSENSUS_LIVE_SUBMIT_PROVIDER`, default `codex`), and `tools/git-hooks/pre-push`. Every claim checked is accurate: PR-only jobs (skill-versions, internal-flags, commitlint, lint) are gated on `github.event_name == 'pull_request'`; Docs CI is PR-on-`documentation/**`; Deploy is dispatch or `main` push on `documentation/**` or the workflow file; Release runs `build:check` and `--check-tag` and creates no GitHub Release; Live E2E is dispatch-only and refuses Cursor.
- Did NOT rebuild the site myself for this commit (Astra reported a passing `/skills` export; my last base-path build predates the nav commit). Did NOT view the sidebar in a browser (extension unavailable).

## Findings, ranked

### 1. "Experimental / not released" wording now contradicts the alpha decision (must fix, one sweep)

The user decided in Astra's session (records 1439–1444) that fork-to-destination is **alpha**, shipped, with honest scope. The uncommitted edit to `session-fork-to-destination.md` applies that. The committed navigation pass still says the old thing in five places:

| File | Text |
|---|---|
| `user-guide/plugins/session/meta.json` | sidebar label `Fork to Destination (experimental)` |
| `user-guide/plugins/session/index.md` | table cell "Experimental, same-provider…"; paragraph "remains experimental and unreleased" |
| `user-guide/plugins/index.md` | "experimental destination-fork guidance" (table + Contents) |
| `engineering/operations/releases-and-versioning.md` | "remains experimental and not released until…" |
| `docs/index.md` | "Experimental capabilities are labeled in their guides." |

Recommend: one commit "docs: frame fork-to-destination as alpha" that includes the two uncommitted edits plus these five, using one phrase everywhere (e.g. sidebar `Fork to Destination (alpha)`, prose "alpha: provider coverage and end-to-end verification are incomplete"). Astra already noted the canonical `SKILL.md` needs a coordinated versioned update; that is a separate `feat`/`docs` commit under `src/skills/session-fork-to-destination/` with a `metadata.version` bump.

### 2. Label consistency for the collaboration skill

The nav label is now "Collaborative Observer" (both sidebars, consensus Contents, skills Contents). Leftovers: `plugins/session/index.md:35` still says "Observer Collaboration"; the canonical page `session-observer-collab.md` is titled "Session Observer Collaboration" (title + H1), and `session-observer.md:119`, `decisions.md:33`, `transcript-core.md:41`, `cursor-collaboration-reliability.md:23,142` use that name. Decide once: either retitle the canonical page to "Collaborative Observer" and update the six references, or keep the page title and only use the short label in navigation (then say so in the page's first line: "Navigation label: Collaborative Observer; skill id `session-observer-collab`"). Retitling is cleaner.

### 3. Physical layout is now asymmetric (deliberate, but record the follow-up)

Consensus stays at `user-guide/consensus/` and is pulled into the Plugins folder with `"../consensus"`; Session lives at `user-guide/plugins/session/`. Getting Started is a folder with only `index.md`, pulling `"../installation"`. URLs are preserved, which is the right call for this pass. But the docs `AGENTS.md` rule that each `index.md`'s `## Contents` links its *immediate* children is now bent in three places (`getting-started/index.md` links `../installation.md`; `engineering/index.md` links `contributing/development/` and `contributing/documentation/`; `user-guide/index.md` lists Installation and Consensus with "also under X in the sidebar" notes). Options for the content pass: (a) move `consensus/` under `plugins/` and `installation.md` under `getting-started/` with redirects, or (b) amend the `AGENTS.md` navigation rule to say the sidebar may borrow pages across directories and the local map must still list physical children. Pick one and write it down; do not leave both conventions half-true.

### 4. The "in the sidebar" annotations read as maintenance notes

`engineering/index.md` and `user-guide/index.md` Contents bullets end with "grouped under Architecture in the sidebar", "both are directly accessible in the sidebar", "also under Getting Started in the sidebar". They explain the asymmetry in finding 3 to the maintainer, not to the reader. Suggest a plain one-line description per bullet and, if needed, a single sentence above the list: "Some pages appear under a different sidebar group than their directory."

### 5. Getting Started (good; two small gaps)

The page does the job the map asked for: choose a starting point, install one form, try a bounded request, recognise a useful response. Invocation forms `$next-steps` (Codex) and `/next-steps` (Claude Code) match the README. Gaps: Cursor is not mentioned (either give its form or say "see Installation for Cursor"); and the promised "copyable install procedure" for standalone form is still deferred to the content pass, so Getting Started is not yet self-contained. Astra already carries that follow-up.

### 6. Operations pages (accurate; two suggestions)

All fact-checked claims hold (see Method). Suggestions: in `ci.md`, state the pre-push hook's scope in one line (validate, build:check, type-check, skill-versions, internal-flags; no tests, no smoke) right where "PR-only policies are additional gates" appears, because the current hooks page misdescribes this and a reader will otherwise assume push == CI. In `releases-and-versioning.md`, the example versions `1.2.3` / `0.3.0` are flagged as examples, good; also link `bump-version.ts` once so the flags are discoverable.

### 7. `## Contents` with `###` sub-groups on `skills/index.md`

The standalone catalog now nests `###` capability headings inside `## Contents`. The navigation check passed, so the transform tolerates it. If this becomes the pattern for grouped catalogs, add one line to `authoring.md` saying sub-headings inside Contents are allowed and how they map (they do not create sidebar groups; `meta.json` separators do).

### 8. Uncommitted wording edits (good)

Removing the clean-break migration paragraph from `installation.md` and the old-name paragraph from the fork page is right: no users need the old names. The new fork description ("An alpha skill for discovering sessions, previewing their context, and preparing destination-safe fork instructions…") is honest and specific. Commit them with finding 1.

## What is good and should stay

- Home page task table ("I want to… / Start here") is the orientation the user asked for and reads well.
- One canonical page per skill, linked from both Plugins and Standalone Skills, with the install-name table on the Session overview.
- Capability separators inside Consensus and Standalone Skills; the `pagesIndex` overview entries remove the "Consensus → Consensus → Consensus" stack from the screenshot.
- Operations pages are honest about evidence boundaries (green build ≠ discovery ≠ release) and every command they show exists.
- Existing URLs preserved.

## Requests to Astra

1. Land finding 1 as one commit including the two uncommitted edits.
2. Decide finding 2 (retitle vs. label-only) and apply.
3. Record the finding 3 decision in `documentation/AGENTS.md` during the content pass.
4. Findings 4–7 are content-pass items; no blocker.
