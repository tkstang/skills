---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-10-02
oat_generated: true
oat_summary_last_task: prev1-t04
oat_summary_revision_count: 1
oat_summary_includes_revisions: [p-rev1]
---

# Summary: session-search

## Overview

Past coding-agent sessions were hard to find again. On 2026-09-29 the user could not tell whether a "Perceive Now" discussion had happened in Claude Code, Codex, or Cursor, or on which machine. An ad-hoc grep over about 12 GB ran for more than 5 minutes without finishing. The discussion turned out to be a ChatGPT thread, found only because one Codex session had captured ChatGPT thread titles in tool output. This quick-mode project, run autonomously with the `high` dispatch policy, added a repeatable `session-search` skill that any agent can use to find a past session from a fuzzy description.

## What Was Implemented

- **`session-search` skill**, shipped standalone (`skills/session-search`) and as `session:search` in the `session` plugin (plugin 0.4.0). The agent guidance in SKILL.md covers:
  - intake, including asking for remembered exact phrases
  - expanding the description into patterns
  - presenting ranked results
  - a widening ladder: broaden, include tool output, confirm a large scan, run the deep rung, ask about ChatGPT, then offer another machine
  - privacy rules
- **Bundled, dependency-free Node CLI** (`scripts/session-search.mjs`, subcommands `search` and `estimate`). It searches the local stores cheapest tier first:
  - history files (`~/.claude/history.jsonl`, `~/.codex/history.jsonl`)
  - metadata indexes: Codex `state_5.sqlite` threads through a read-only, schema-probed `sqlite3`; `session_index.jsonl`; Claude titles
  - a bounded scan of user and assistant content
  - a deep rung that adds tool output, including Codex MCP `item_completed` results
- **Ranked `session-search/v1` JSON.** Results are grouped by parent session, and subagent and Codex-child hits roll up to their parent. Ranking weighs:
  - how many distinct patterns matched
  - user-typed hits over assistant text
  - title and first-prompt hits
  - cwd matches
  - recency

  Snippets are bounded and redacted, and exit codes are 0, 1, 2, and 3.
- **Safety and speed controls:**
  - cwd-first scope that widens automatically
  - a large-scan guard (exit 3; override with `--allow-large-scan`)
  - `--deadline-ms`, which also bounds `rg`
  - a configurable tool-probe timeout
  - an injection-safe, opt-in remote recipe with no built-in hosts
- **Docs and fixes:**
  - a user-guide page, plugin, skill, and installation listings, and README and docs-home mentions
  - a session-schemas "Discovery indexes" section
  - a CHANGELOG entry
  - the stale Codex `session-<id>.jsonl` path corrected in the export-transcript and observer docs. This bumped four owner skills: session-export-transcript 2.0.39, session-observer 1.0.88, session-observer-collab 1.0.76, and session-fork-to-destination 0.2.56.
- **Delivery:** 68 of 68 tasks across five phases plus revision p-rev1. Phase 5 consisted entirely of final-review and exit-gate fixes; p-rev1 addressed CodeRabbit feedback on PR #115 (see Revision History).

  Verification:
  - `pnpm run premerge`: 2733 tests passed and 1 was skipped.
  - About 650 skill, repo, release, and tooling tests passed after p-rev1, including 274 skill tests.
  - Read-only checks against the real local stores found the motivating Codex rollout `01a053ba`, with identical results before and after p-rev1.

## Key Decisions

- **Stateless tiered session search.** The CLI keeps no index or cache. Speed comes from searching cheaper tiers first, from time windows and cwd hints, and from skipping noise: oversize lines, subagent primaries, and tool output by default. A persistent FTS index was rejected because it needs maintenance and would create a new store that can hold secrets.
- **Optional rg prefilter with Node verification.** `rg` and `sqlite3` are optional accelerators detected at runtime. `rg -l` only narrows the candidate files, and Node verifies and classifies every hit, so results are the same with or without `rg`. Since t08, the prefilter only runs on characters that the stores never JSON-escape.
- **Repo hints widen instead of filtering.** A `--cwd` hint is searched first. If it finds nothing, the search reruns over everything and reports `widened: true`; a hint never produces "not found".
- **Adapter-owned record classification.** Each runtime adapter extracts and classifies its own records. The shared transcript normalizers truncate or drop text: Cursor emits only at `turn_ended`, Codex drops tool output, and Claude truncates tool text. The shared library is still used to parse records.
- **Tool output only on the deep rung.** Tool output is searched only on the final deep rung, or when `--include-tools` is set. This keeps routine results to user and assistant text while still reaching cases like the motivating ChatGPT titles. The deep rung requires the content tier and always skips the `rg` prefilter.
- **Redact snippets at scan time.** Each hit keeps a bounded, already redacted snippet instead of full text. This dropped peak memory on broad deep queries from about 1.5 GB to about 0.4 GB, at a cost in wall time.
- **Local-only search with opt-in remote hosts.** The CLI searches only the local machine and ships no hostnames. To search another machine, the agent runs a documented, injection-safe ssh recipe on a host the user names. The recipe accounts for remote shells whose PATH lacks Homebrew.

## Design Deltas

- **Codex tool sources (p03 root verification).** The design listed function-call and CommandExecution sources. Real stores showed that MCP results exist only in `item_completed` `McpToolCall` items. Extraction now also covers MCP, Extension, and FileChange items, and excludes `CollabAgentToolCall` (p03-t04 and t10).
- **Deep-rung semantics (p02-t06).** The design ran the deep rung after zero results. As shipped, it runs only when the content tier is selected. `--include-tools` labels the content scan `deep`, and `tiersRun` lists only scans that actually ran.
- **Snippet path (p01 re-review).** The design composed `redact` and then `buildSnippet`. As shipped, a single `snippetFor` helper redacts and then windows the text, skipping matches inside `[REDACTED]` markers.
- **Redaction coverage.** The shipped redaction is broader than the design:
  - more token families: `ghu_`/`ghr_`, Google, GitLab, Stripe, Hugging Face, AWS ASIA, and npm
  - URL userinfo up to the last `@`
  - `Authorization` headers
  - multi-level escaped JSON
  - a Bearer length threshold, to avoid false positives in prose
- **Bounded per-hit memory (p05-t03).** Hits now keep a bounded snippet plus a sequence number, and ties break on file position. The design assumed full hit text until ranking.
- **New contracts.** `agentAuthored`, `fileClassifier`, `deadline`, and `scopeReads`, plus the in-phase helpers `lib/jsonl.ts` and `lib/window.ts`.
- **API details.** `parseTimeSpec` gained a `bound` argument, so an `--until` of `today` or a date-only value includes that whole day. `rg` runs with `--no-config -a` to protect the prefilter's guarantee that it never drops a matching file.
- Root aligned design.md with the implementation at each review. In every case the shipped implementation is the source of truth.

## Notable Challenges

- **Defects that only real stores showed.** Tests and reviews were green when read-only runs against the developer's real stores found three silent misses:
  - The motivating Codex session was unfindable because MCP text lives only in `item_completed`.
  - Stores JSON-escape `/` and HTML-sensitive characters, which broke the prefilter's guarantee that it never drops a matching file. The exit gate raised this, and root measured it in about 1,340 files.
  - p05-t06 blanked MCP entity ids.

  Each was fixed: p03-t04, p05-t08, and p05-t09.
- **Quadratic redaction regex.** The first credential regex took 4.2 s on a 64 KiB line. Anchoring it at the start of the identifier run brought that under 2 ms, and a 256 KiB regression test guards it.
- **Review volume.** Every phase review passed with 0 Critical and 0 High, except p02 cycle 1, which was blocked by one High: Codex non-text JSON tool output. p01 and p02 each took two review cycles. The final scope took five cycles (cycles 4 and 5 operator-authorized), and the cross-family implementation exit gate ran three generations: generation 1 raised the prefilter-escape finding, and generations 2 and 3 passed clean.
- **Tooling friction.** `scripts/bump-version.ts` wrote double-quoted versions, which needed one recovery commit in p04; `diagnostics.test.ts` timed out under host load until it was rerun; and super.engineering CLI shims made the gate's availability probe time out.

### Recorded process deviations

- **Combined p05 and final review.** One narrowed final re-review over `79416011..3fb6dc1f`, exactly the p05 range, served as both the p05 phase review and final cycle 2. Separate reviews would have covered the same range.
- **Operator override for final review cycle 4.** The final scope reached the cap of 3 review cycles (REVIEWRECEIVE-02), and the autonomous run stopped rather than authorize another cycle itself. At 2026-10-02T17:22:14Z the operator replied "Proceed", which authorized cycle 4. It passed with 0C/0H/0M/1L.
- **Operator-authorized cycle 5, combined with the p-rev1 phase review.** At 2026-10-02T19:33:15Z the operator chose "Fix all, then complete", which included a phase review, a narrowed final review, and a new exit gate. One narrowed re-review over `336bfd80..34cc7fb5` served as both, as for p05.

## Tradeoffs Made

- **Redact at scan time, accept slower broad queries.** Broad deep queries went from 9.9 s to 11.9 s and from 10.5 s to 17.4 s in exchange for about 3× lower peak memory. Narrow queries were unchanged.
- **Don't mask bare 32-hex strings.** Masking them would hide hashes and ids that users search for, and keyed hex values are already covered (final M2).
- **Accept that lowercase-only url-safe secrets may go unmasked.** A secret made entirely of lowercase word segments would not be masked, which is very unlikely for random tokens. The identifier exemptions leak about 0.06 per 10k samples in a seeded test.
- **Allow a small deadline overshoot.** Final per-session reads don't check the deadline, so a run can overshoot slightly, and only when it has hits. Past the per-file cap, only hits for new patterns are kept.

## Integration Notes

- Only canonical sources under `src/skills/session-search/` should be edited. `skills/` and `plugins/*/skills/` are generated, and a drift guard enforces this. `src/distributions.ts` allows the source roots `src/shared/transcript` and `src/skills/session-export-transcript`.
- The Codex meta tier depends on `state_5.sqlite`, an internal, versioned schema. A missing table or column, a locked database, or a missing `sqlite3` marks that tier `degraded`, and the search continues.
- Test overrides: `SESSION_SEARCH_RG`, `SESSION_SEARCH_SQLITE3`, `SESSION_SEARCH_NO_RG=1`, and `SESSION_SEARCH_NO_SQLITE3=1`.

## Revision History

- **p-rev1 (PR #115 CodeRabbit feedback, 4 tasks).** CodeRabbit left 4 inline and 1 outside-diff comment; the user directed "Fix all, then complete" during `oat-project-complete`, before any completion write. Fixes: the `ghp_`-shaped test literal is built by concatenation (prev1-t01); Claude `tool_result` carriers are detected within an 8 KiB prefix instead of 512 B, hardening older key orders and long `cwd` values (prev1-t02); the export-transcript reference names the correct Codex cwd source record (prev1-t03); and the PJM current-state snapshot reflects the open PR (prev1-t04). Final review cycle 5 passed with 0C/0H/0M/2L; one Low was fixed in state.md and one deferred to BL-261002. Exit-gate generation 3 passed clean.

## Autonomous Execution Learnings

### Agent-instruction updates

- For search and parsing tools over provider-owned stores, add a read-only real-store smoke step after each phase that reports counts and titles only. Measure store facts, such as an escape census and an item-type census, before asserting writer behavior. Real stores caught three defects that green tests and reviews missed. ([oat-execution-learnings.md — 2026-10-02T12:40:00Z — worked-well — Real-store verification caught defects that synthetic fixtures and reviews missed](oat-execution-learnings.md))
- When an autonomous run starts from another repository's session, record that originating context in discovery so reviewers can trace decisions back to it. This run was driven from a vault session by absolute path. ([oat-execution-learnings.md — 2026-10-02T05:00:00Z — environment-limited — Autonomous run orchestrated from a sibling-repo session](oat-execution-learnings.md))

### Cloud-environment improvements

- For headless gate runs inside super.engineering sessions, remove `~/.super.engineering/bin` from PATH for the gate command only. The shims take about 5 s to start, which exceeds the gate's 5000 ms availability probe, while the real binaries start in about 0.3 s. Upstream: reduce shim startup time for `--version`. This was observed only in that environment. ([oat-execution-learnings.md — 2026-10-02T06:30:00Z — environment-limited — super.engineering CLI shims exceed the gate availability probe timeout](oat-execution-learnings.md))

### Code follow-ups

- Make `scripts/bump-version.ts` keep single-quoted skill versions, or run oxfmt on bumped SKILL.md files as part of the bump. It cost one recovery attempt in p04. ([oat-execution-learnings.md — 2026-10-02T12:40:00Z — gotcha — scripts/bump-version.ts writes double-quoted skill versions](oat-execution-learnings.md))
- Raise the timeout of `src/shared/collaboration/diagnostics.test.ts`, or reduce its 4097 sequential writes. It causes false premerge failures at a load of about 15 on 14 cores. ([oat-execution-learnings.md — 2026-10-02T12:40:00Z — environment-limited — Full-suite premerge flakes under host load](oat-execution-learnings.md))
- Upstream OAT: lengthen or cache the gate's availability check (`GATE_CHECK_TIMEOUT_MS = 5000`) so that slow-starting wrapper CLIs are not reported as unavailable. ([oat-execution-learnings.md — 2026-10-02T06:30:00Z — environment-limited — super.engineering CLI shims exceed the gate availability probe timeout](oat-execution-learnings.md))

### Workflow issues

- Keep the autonomous stop at the final-review cycle cap (REVIEWRECEIVE-02), with operator authorization as the only way past it. Changed-basis re-reviews after exit-gate fixes can use up the cap even when each cycle finds a real Medium. This was applied in this run; see Recorded process deviations and the boundary entry in Workflow Observations. ([oat-execution-learnings.md — 2026-10-02T12:40:00Z — decision — Stopped at the final-review cycle cap instead of self-authorizing a 4th cycle](oat-execution-learnings.md))

## Follow-up Items

**Known follow-ups deferred from review**, all five tracked in `BL-261002-resolve-deferred-session`. None of these are regressions; the affected sessions stay findable through other tiers or content.

- **Exit-gate L1:** a custom title in the bounded prefix loses to a generated title in the tail. This needs about 600K characters between the two titles and affects only title-tier ranking.
- **Exit-gate L2:** Codex orphans that exist only as metadata lose their archived, child, and title facts. This happens only when a rollout file was pruned but sqlite still has the thread. The session is found but unlabeled.
- **Exit-gate L3:** the remote history fallback excerpt can drop the match and the session id. This affects only the opt-in fallback for hosts without the skill installed.
- **Final cycle-4 L1:** Claude-only `slug` and `sessionId` keys are blanked on Codex lines, including inside MCP results. This predates p05-t06 and is narrow: 12 local lines, mostly Stoa memory slugs.
- **Final cycle-5 L1:** the deep raw fallback's envelope blanker caps values at 1024 characters, so a `cwd` over 1024 characters on an oversize old-key-order Claude tool line can yield a path-only deep hit. prev1-t02's wider prefix made this partly newly reachable; it affects only the deep tier or `--include-tools`.

**Tooling follow-ups (outside this feature's scope):** `bump-version.ts` quote style; the `diagnostics.test.ts` load flake; pre-existing `format:check` failures in 3 untouched test files.

**Deferred in discovery:** a Cursor `store.db` adapter; an optional metadata cache or FTS index; a recall or summarization mode; adapters for other agent stores.

## Explainer Outcome

- **project-recap:** built — [.oat/repo/reference/project-recaps/20261002-session-search.html](https://github.com/tkstang/skills/blob/feat/session-search/.oat/repo/reference/project-recaps/20261002-session-search.html) (recipe `project-recap` v2, run `d5d9765d`, host verify rung; regenerated after revision p-rev1)

## Workflow Observations

### 2026-10-02 · structural · oat gate review · plan

target=codex-6-sol-xhigh threshold=high findings=critical:0,high:3,medium:1,low:0 exit=1 status=blocked artifact=.oat/projects/shared/session-search/reviews/artifact-plan-review-2026-10-02T053829Z.md run=cd2b64af-97ab-437c-821a-d12b96d76e21

### 2026-10-02 · structural · oat gate review · plan

target=codex-6-sol-xhigh threshold=high findings=critical:0,high:0,medium:0,low:0 exit=0 status=ok artifact=.oat/projects/shared/session-search/reviews/artifact-plan-review-2026-10-02T055258Z.md run=fef3d880-81ff-47d9-8cb0-70670d0914b1

### 2026-10-02 · structural · oat-project-implement · p01

ss-p01-outcome-1 p01 pass; fix iterations 2; reviews reviews/archived/p01-review-2026-10-02T061433Z.md, reviews/archived/p01-review-2026-10-02T062929Z.md

### 2026-10-02 · structural · oat-project-implement · p02

ss-p02-outcome-1 p02 pass; blocking fix iterations 1; reviews reviews/archived/p02-review-2026-10-02T071003Z.md, reviews/archived/p02-review-2026-10-02T072802Z.md

### 2026-10-02 · structural · oat-project-implement · p03

ss-p03-outcome-1 p03 pass; fix iterations 1; review reviews/archived/p03-review-2026-10-02T080403Z.md

### 2026-10-02 · structural · oat-project-implement · p04

ss-p04-outcome-1 p04 pass; fix iterations 1; recovery 1/10; review reviews/archived/p04-review-2026-10-02T083046Z.md

### 2026-10-02 · structural · oat-project-implement · p05

ss-p05-outcome-1 p05 pass and final review passed; reviews reviews/archived/final-review-2026-10-02T084934Z.md, reviews/archived/final-review-2026-10-02T114035Z.md

### 2026-10-02 · structural · oat-project-review-provide · final

c5a7745f-9dcf-4f4f-b0e4-d153568e960b final code review used one completed intelligent-recon wave with three read-only lanes; root reconciled source and foreground probes; artifact .oat/projects/shared/session-search/reviews/final-review-2026-10-02T120208Z.md.

### 2026-10-02 · structural · oat gate review · final

target=codex-6-sol-xhigh threshold=high findings=critical:0,high:0,medium:1,low:3 exit=0 status=ok artifact=.oat/projects/shared/session-search/reviews/final-review-2026-10-02T120208Z.md run=c5a7745f-9dcf-4f4f-b0e4-d153568e960b

### 2026-10-02 · structural · oat-project-autonomous · final

ss-boundary-reviewcap-1 STOP: REVIEWRECEIVE-02 final review-cycle limit (3); fixes t09-t10 complete; operator override needed for re-review; resume /oat-project-autonomous session-search

### 2026-10-02 · structural · oat gate review · final

target=codex-6-sol-xhigh threshold=high findings=critical:0,high:0,medium:0,low:0 exit=0 status=ok artifact=.oat/projects/shared/session-search/reviews/final-review-2026-10-02T173611Z.md run=578d2977-81dc-42a4-bb93-a71adabbb844

### 2026-10-02 · structural · oat-project-autonomous · complete

ss-autonomous-complete-1 autonomous run complete; PR https://github.com/tkstang/skills/pull/115; final review cycle 4 passed; exit gate gen 2 passed

### 2026-10-02 · structural · oat gate review · final

target=codex-6-sol-xhigh threshold=high findings=critical:0,high:0,medium:0,low:0 exit=0 status=ok artifact=.oat/projects/shared/session-search/reviews/final-review-2026-10-02T194727Z.md run=63e85fdb-dba6-4845-877c-08216e4dc3a8
