---
oat_status: complete
oat_ready_for: oat-project-quick-start
oat_blockers: []
oat_last_updated: 2026-10-02
oat_generated: false
---

# Discovery: session-search

## Phase Guardrails (Discovery)

Discovery is for requirements and decisions, not implementation details.

- Prefer outcomes and constraints over concrete deliverables (no specific scripts, file paths, or function names).
- If an implementation detail comes up, capture it as an **Open Question** for design (or a constraint), not as a deliverable list.

## Initial Request

> "We need to have a repeatable skill in my skills repo `~/code/skills` for `/search-sessions` that provides guidance and tooling for any agent to find phrases/topics/key words/etc when I'm trying to find a session where we were working on something. … investigate the skills repo, it should have some existing useful docs around session structure and schemas that we can use, as well as guidance around where these sessions live, to help us optimize so these searches are as efficient as possible."

**Motivating incident (2026-09-29):** the user could not remember whether a "Perceive Now" vetting discussion happened in Claude Code, Codex, or Cursor, or on their laptop or Mac mini. An ad-hoc grep across stores eventually showed it was a **ChatGPT** thread. That was found only by luck: one Codex session had captured ChatGPT thread titles in tool output. The full-content grep on the larger machine ran more than 5 minutes without finishing.

**Origin:** the requirements below were converged in an `oat-brainstorm` session (Hard Activation) on 2026-09-29 to 2026-10-01. Each brainstorm question was answered explicitly by the user. The user then asked to run the result as an autonomous quick-mode OAT project with the `high` dispatch policy.

## Evidence Gathered (External-Integration Research)

Two read-only reconnaissance passes ran during the brainstorm, plus a design-input pass during this run.

**Repository evidence (tkstang/skills):**

- **Session-schema docs.** `documentation/docs/engineering/architecture/session-schemas/{claude-code,codex,cursor}.md` and `transcript-core.md` document storage paths, record shapes, and gotchas for all three providers. They were observed on one machine on 2026-09-18; "not observed" does not mean "does not exist".
  - **Claude Code:** stored at `~/.claude/projects/<cwd-slug>/<session-id>.jsonl`. `cwd`, `sessionId`, `gitBranch`, and `timestamp` repeat on every message. Titles appear in sparse `ai-title` / `custom-title` records.
    - Subagent transcripts live under `<sid>/subagents/` with `isSidechain: true`. Large Bash output is externalized to `tool-results/*.txt`. Compaction leaves markers.
  - **Codex:** stored at `~/.codex/sessions/YYYY/MM/DD/rollout-*-<uuid>.jsonl` with a `session_meta` header carrying `cwd`, `id`, `timestamp`, `git`, and `cli_version`. User text is in `event_msg.user_message` and `response_item` message records.
    - Child or subagent rollouts are where `payload.id != payload.session_id`. Tool output is silently truncated. Lines must be split on LF only, because U+2028/2029 can appear inside strings.
  - **Cursor:** stored at `~/.cursor/projects/<encoded>/agent-transcripts/<id>/<id>.jsonl`. These files carry no timestamps or identity, so mtime stands in for time. The SQLite chat store `~/.cursor/chats/*/store.db` is out of scope for the existing transcript tooling.
- **Reusable code.** `src/shared/transcript/runtimes.ts` already discovers, parses, and normalizes transcripts for the three runtimes: path discovery, cwd encoding, bounded metadata and tail reads, meta extraction, and user/assistant entry normalization.
  - `session-observer`'s `locate --snippet` does a raw, cwd-scoped, whole-file substring scan with no ranking or size cap.
  - All existing "which session" logic is cwd-scoped. No cross-project, cross-time, keyword-ranked search exists.
- **Packaging.** The canonical source is `src/skills/<name>/` plus `build.json`. `src/distributions.ts` declares the standalone and plugin outputs. Generated `skills/` and `plugins/*/skills/` must never be hand-edited.
  - Skills run bundled, dependency-free `node <skill-dir>/scripts/<name>.mjs` CLIs.
  - Tests use Vitest, colocated `*.test.ts` files, and synthetic JSONL fixtures. A drift guard fails on stale generated output.
- **Stale doc found.** The export-transcript store-locations table says Codex files are `session-<id>.jsonl`. Code and schema docs say `rollout-*-<uuid>.jsonl`.

**On-disk measurements (2026-09-29, MacBook and Mac mini):**

| Store                             | MacBook                                                                                                | Mac mini                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Claude `~/.claude/projects`       | 570 MB, 259 jsonl (218 subagent)                                                                       | 1.9 GB, 1,784 jsonl (1,557 subagent) |
| Codex `~/.codex/sessions`         | 3.7 GB, 3,035 rollouts                                                                                 | 9.7 GB, 3,309 rollouts               |
| Codex `archived_sessions/`        | 424 MB                                                                                                 | 328 MB                               |
| Claude / Codex `history.jsonl`    | 5.3 MB / 3.8 MB                                                                                        | 1.1 MB / 1.8 MB                      |
| Codex `state_5.sqlite` `threads`  | 3,121 rows: title, first_user_message, cwd, rollout_path, git_origin_url, created/updated_at, archived | 8,128 rows                           |
| Cursor `agent-transcripts`        | 1,275 files, 103 MB                                                                                    | 1,355 files                          |
| Cursor `chats/*/store.db`         | 1,028 files, 9.0 GB                                                                                    | 6.9 GB                               |
| ChatGPT desktop `com.openai.chat` | 172 opaque/encrypted `.data` files                                                                     | not installed                        |

- **Speed (warm cache, MacBook).**
  - Both `history.jsonl` files: about 0.03 s.
  - Codex `state_5.sqlite` LIKE over title and first message: about 0.85 s.
  - `rg` over Claude and Codex transcripts (4.3 GB): 0.6–1.2 s, roughly 1.4× faster than `grep`.
  - Cursor agent-transcripts: 0.13 s.
- **Speed (Mac mini).** A full-content `rg` over roughly 12 GB did **not** finish within 120 s. History files took 0.01 s, and the `state_5.sqlite` metadata query returned hits quickly.
- **Bloat.** In large rollouts the top 5% of lines hold about 50% of the bytes. The largest line is about 345 KB, and some files are 50–104 MB. These are `function_call_output`, reasoning, and base64 blobs.
- **Tooling.** `rg`, `sqlite3`, and `jq` are present on both machines. `fd` and `duckdb` are absent on both. On the mini, `rg` is only at `/opt/homebrew/bin/rg`, which is not on the non-interactive ssh PATH.
- **History-file fields.**
  - Claude `history.jsonl`: `display`, `pastedContents`, `project`, `sessionId`, `timestamp`.
  - Codex `history.jsonl`: `session_id`, `text`, `ts`.
  - Codex `session_index.jsonl`: `id`, `thread_name`, `updated_at`. It covers only about 100 threads, so it is not a full index.

**Coverage limits.** The measurements are from two macOS machines owned by one user. Linux and Windows layouts were not observed. `state_5.sqlite` is an internal Codex store whose schema name (`_5`) suggests versioning, so the schema may drift.

## Clarifying Questions

### Question 1: What does a successful search return?

**Q:** A ranked candidate list, one best match auto-opened, a recalled answer across sessions, or find-plus-recall modes?
**A:** A ranked candidate list. The search should also narrow when the user gives guidance: a time window ("yesterday", "the past week") limits the search for speed, and a known or suspected repo is searched first.
**Decision:** The output is a ranked list. Each entry carries the provider, cwd/repo, date, title or first prompt, matching snippets, and how to resume or open the session. Time hints restrict the scan window. A repo hint is a **starting point that widens** when nothing is found; it is never a hard filter that returns "not found".

### Question 2: How should other machines be handled?

**Q:** Search other machines as a later widening rung, always in parallel, or local only with a host flag?
**A:** The skill must be agnostic to the user's specific machines. By default it always searches the machine the request is on. If the user works across multiple machines, the agent asks whether to expand the search to other machines.
**Decision:** Search the local machine only by default, with no hostnames baked in. On a miss, or when the user hints at another machine, the agent offers to search another SSH host the user names.

### Question 3: Which sources does v1 cover?

**Q:** Coding-agent transcripts plus side sources, transcripts only, or plus a pluggable adapter system?
**A:** Coding-agent transcripts plus side sources, written internally as adapters.
**Decision:** Claude Code, Codex, and Cursor transcripts, plus their history and index files. Each source is a small internal adapter, but no plugin system ships. ChatGPT turned out to be unsearchable locally because its storage is encrypted; see Key Decisions.

### Question 4: How smart is matching?

**Q:** Agent-expanded literal patterns, typo-tolerant matching, or semantic embeddings?
**A:** Agent-expanded literal patterns. The agent may also ask the user whether they remember specific phrases from the session.
**Decision:** The calling agent turns the user's description into several literal or regex patterns, covering spelling and spacing variants and related terms. The tool matches them case-insensitively. When the request is vague, the agent first asks for any exact phrases, names, or unusual terms the user remembers, which are the highest-precision patterns.

### Question 5: Persistent state?

**Q:** Stateless scan-on-demand, an optional metadata cache, or a full-text index?
**A:** Stateless scan-on-demand.
**Decision:** v1 keeps no index or cache. Efficiency comes from tiering, hint-scoped windows, and noise exclusion. An unbounded deep scan on a large store requires the user's go-ahead first.

### Question 6: How is the tooling built?

**Q:** A bundled Node CLI that uses system tools when present, pure Node only, or a guidance-only skill?
**A:** A bundled Node CLI that uses system tools when present.
**Decision:** A dependency-free bundled Node CLI, consistent with repository convention. It uses `rg` and `sqlite3` when available and falls back to Node streaming. It reuses the shared transcript library, emits deterministic ranked JSON, and is Vitest-tested.

## Solution Space

### Approach 1: Tiered stateless search CLI + agent guidance _(Recommended, chosen)_

**Description:** A skill whose SKILL.md runs the conversation (intake, pattern expansion, widening ladder, cross-machine offer, ChatGPT fallback question) and calls one bundled CLI. The CLI runs cheap tiers first, namely history files, then metadata indexes, then bounded full-content scans, and returns ranked JSON.
**When this is the right choice:** The corpus is a few GB to tens of GB per machine, hints usually exist, and portability across agents and machines matters more than sub-second deep search on very large stores.
**Tradeoffs:** Unhinted deep scans on very large stores stay slow. The tool mitigates this by asking first and by narrowing via the metadata tiers.

### Approach 2: Persistent full-text index (e.g., SQLite FTS)

**Description:** An incremental index over user and assistant text.
**When this is the right choice:** Frequent unhinted searches on very large stores.
**Tradeoffs:** Needs index maintenance and staleness handling, and creates a new secret-bearing artifact. A sqlite dependency is awkward for a dependency-free bundle. The user rejected this for v1.

### Approach 3: Guidance-only skill

**Description:** SKILL.md teaches the agent the tiers and the raw `rg`/`sqlite3`/`jq` commands.
**When this is the right choice:** Throwaway or one-off needs.
**Tradeoffs:** Agents rebuild ranking ad hoc, so results are inconsistent and untestable. The user rejected this approach.

### Chosen Direction

**Approach:** Approach 1, a tiered stateless search CLI plus agent guidance.
**Rationale:** It matches every brainstorm answer: a ranked list, hint-scoped narrowing, local-first with an offer to widen, adapters, literal agent-expanded matching, no state, and a bundled Node CLI. The measurements show tiers 1–2 answer most queries in about 1 s or less, even on the large machine.
**User validated:** Yes. Each element was chosen explicitly in the brainstorm (Questions 1–6), and the user directed autonomous execution.

## Key Decisions

1. **Output contract:** A ranked candidate list with provider, cwd/repo, date (start and/or last activity), title or first prompt, two or three hit snippets, the patterns that matched, the tier that matched, and an open/resume hint. No auto-open, and no recall or summarization mode in v1.
2. **Hints narrow; repo hints widen:**
   - A time hint restricts the scan window by session time or mtime.
   - A repo or cwd hint is searched first. If it yields nothing, the search automatically continues to all locations, and the output says it widened.
3. **Tier order (cheapest first):**
   1. **History files:** Claude and Codex `history.jsonl`, which hold every user prompt.
   2. **Metadata indexes:**
      - Codex `state_5.sqlite` threads (title, first message, cwd, rollout path), used when the `sqlite3` CLI is present.
      - Claude title records.
      - Codex `session_index.jsonl`.
   3. **Full-content scan** of user and assistant text in transcripts, bounded to the time window and hint-scoped candidates when the store is large.
   4. **Final deep rung:** includes tool output. Tool output is excluded by default; the deep rung exists because the motivating ChatGPT title lived in tool output. It runs before the tool reports nothing found.
4. **Noise exclusion:**
   - Skip subagent and sidechain transcripts as primary results, but attribute their hits to the parent session where possible.
   - Skip Codex log and history databases.
   - Cap line length so huge tool-output and base64 lines are skipped.
   - Include Codex `archived_sessions/` (labeled archived).
5. **Large-store guard:** When an unbounded full-content scan is needed on a large store, the agent states the estimated size and asks before running it.
6. **Ranking signals:**
   - The number of distinct patterns matched.
   - Hits in **user-typed** text, which weigh more than assistant text.
   - Hits in titles or first prompts.
   - Recency.
   - A repo-hint match.
7. **Machines:** Search only the local machine by default. When asked, run the same search on a user-named SSH host and return compact JSON. No hostnames appear in the skill. Remote invocation must handle a non-interactive PATH that lacks Homebrew tools.
8. **ChatGPT:** ChatGPT desktop conversations are stored encrypted and are not locally searchable. When the coding-agent stores come up empty, the skill asks whether the conversation might have been in ChatGPT and points the user to ChatGPT's own search. There is no ChatGPT adapter in v1.
9. **Matching:** Literal or regex patterns supplied by the agent, matched case-insensitively. The tool does no fuzzy or semantic matching itself.
10. **No persistent state** (no index or cache) in v1.
11. **Packaging:** A new canonical skill in the repository's standard source layout. It ships both standalone and in the `session` plugin, alongside handoff, export-transcript, and retro. It reuses the shared transcript library rather than duplicating parsers.
12. **Naming:** The skill identity is `session-search`, following the repository's `session-*` naming such as `session-export-transcript` and `session-handoff`. The user-facing invocation in the session plugin reads naturally as `/search-sessions`; how it surfaces is a design detail.
13. **Opportunistic fix:** Correct the stale Codex `session-<id>.jsonl` path in the export-transcript store-locations documentation in the canonical source.
14. **Workflow depth (QS-04):** **Lightweight design first**, selected autonomously. Discovery surfaced real architecture choices: the adapter boundaries, the tier pipeline, reuse of the shared transcript library, the CLI interface and JSON schema, remote execution, and test fixtures. These warrant a short `design.md` before planning, but they do not warrant spec-driven promotion: there is one skill with a clear goal and no cross-repo integration.

## Constraints

- Machine-agnostic: no user-specific hostnames, paths, or usernames in the shipped skill.
- Dependency-free bundled Node CLI per repository convention. System tools (`rg`, `sqlite3`) are optional accelerators, and the tool must still work without them.
- Read-only: the tool never mutates session stores.
- Output privacy:
  - Snippets are short and bounded.
  - The tool never dumps whole records.
  - It applies the repository's existing redaction or sanitization conventions where available, because transcripts can contain secrets.
  - It never echoes environment-like or credential-shaped strings.
- Respect the repository's generated-output model: edit only canonical sources, then regenerate and pass the drift guard.
- Must tolerate schema drift in internal stores (Codex `state_5.sqlite`, history files). A missing table or column degrades that tier gracefully and never crashes the search.
- Works across Claude Code, Codex, and Cursor as invoking hosts, with provider-neutral guidance.

## Success Criteria

- An agent in any of the three hosts can invoke the skill. Given a fuzzy description plus optional time or repo hints, it gets a ranked list in which the target session appears, on a test corpus covering all three providers.
- History and metadata tiers return in well under a few seconds on a typical store. Full-content scans honor time windows and line-length caps.
- A repo hint that misses widens automatically, and the output says so.
- Tool output is excluded by default and searched only on the final deep rung.
- Subagent transcripts don't flood results, and archived Codex sessions are found and labeled.
- When the empty-result path is reached, the skill asks about ChatGPT and about other machines.
- Vitest coverage for adapters, tiering, the time window, widening, ranking, and the missing-tool fallbacks, using synthetic fixtures. Repository build, drift, lint, and skill-validation checks pass.
- Documentation exists for the skill (user guide page), and the stale export-transcript path is corrected.

## Out of Scope

- A ChatGPT adapter. Local ChatGPT data is encrypted and unsearchable.
- Cursor's SQLite chat store (`~/.cursor/chats/*/store.db`) and `globalStorage/state.vscdb`.
- Persistent indexes or caches, semantic or embedding search, and typo-tolerant matching in the tool.
- Recall or summarization of session contents, and auto-opening or resuming a session.
- Other agent stores (Superconductor, Orca, Warp, Gemini, Pi, and others).
- Built-in host lists or automatic multi-machine fan-out.

## Deferred Ideas

- Cursor `store.db` adapter: a 9 GB SQLite store that needs its own reader. Deferred until agent-transcripts prove insufficient.
- Optional metadata cache or FTS index: revisit if deep scans on large stores are painful in practice.
- A "recall" mode that summarizes what was discussed across matched sessions, building on find.
- Adapters for other agent stores (Superconductor `codex-session-logs`, Orca, Gemini, Pi, Antigravity).

## Open Questions

- **Design: CLI surface.** Exact flags and the JSON result schema, including time-window syntax (relative such as `7d` or `yesterday` versus ISO dates) and how matched tiers and widening are reported.
- **Design: Shared-library reuse.** How much of the shared transcript library fits store-wide enumeration across all cwds versus cwd-scoped discovery. Whether a thin store-wide enumerator is needed.
- **Design: Remote execution.** How the SKILL.md tells the agent to run the CLI on another host: with the skill installed there, or by streaming the bundled script over ssh. Also how to deal with remote PATH.
- **Design: Subagent attribution.** How subagent hits roll up to parent sessions for each provider.
- **Design: Size estimate for the large-store guard.** A cheap size or count heuristic and its threshold.
- **Design: Invocation naming.** How `/search-sessions` surfaces given the plugin's short-name convention.

## Assumptions

- The skill is installed on any machine it searches. Remote search assumes the user can install the skill there, or the design provides a no-install fallback.
- `history.jsonl` and `state_5.sqlite` field names observed in 2026-09 are stable enough to use behind defensive parsing.
- Agents invoking the skill can expand a description into patterns well, so the tool need not do semantic matching.
- macOS and Linux paths follow the same home-relative layouts. Windows is best-effort.

## Risks

- **Internal-store schema drift** (Codex sqlite and history formats).
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Mitigation Ideas:** Probe the schema before querying, degrade per tier, and test against missing tables and columns.
- **Secret exposure via snippets.**
  - **Likelihood:** Medium
  - **Impact:** High
  - **Mitigation Ideas:** Bounded snippet windows, reuse of existing sanitization, user-text-first matching, and tool output excluded by default.
- **Slow deep scans on large stores.**
  - **Likelihood:** High
  - **Impact:** Low–Medium
  - **Mitigation Ideas:** Tiering, time windows, the size guard with user confirmation, and line-length caps.
- **Shared-library mismatch** (cwd-scoped APIs).
  - **Likelihood:** Medium
  - **Impact:** Low
  - **Mitigation Ideas:** A thin store-wide enumerator that reuses the parsers.

## Next Steps

Quick mode → **lightweight design first** (QS-04), then plan.
