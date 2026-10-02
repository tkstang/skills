---
oat_generated: false
oat_append_only: true
---

# Execution Learnings: session-search

Append-only log of reusable observations from the autonomous run.

## 2026-10-02T05:00:00Z - environment-limited - Autonomous run orchestrated from a sibling-repo session

**Observation:** The autonomous run was kicked off from a Claude Code session whose cwd is the user's Obsidian vault, operating on this worktree by absolute path. Discovery was seeded from a prior `oat-brainstorm` conversation in that session plus two read-only recon passes (repo session-schema docs/code; on-disk session-store measurements on a MacBook and a Mac mini).
**Impact:** Repository evidence for discovery came from those recon reports; every shell step must `cd` into the worktree explicitly.
**Recommendation:** When autonomy is launched cross-repo, record the originating context in discovery so reviewers can trace decisions.

## 2026-10-02T06:30:00Z - environment-limited - super.engineering CLI shims exceed the gate availability probe timeout

**Observation:** `oat gate review` reported "No eligible gate exec target found … --avoid same-family". Every exec target showed `available: false` even though `codex --version` and `claude --version` succeed. The `~/.super.engineering/bin/{codex,claude}` wrapper shims take about 5.0–5.3 s to start, and OAT's gate availability probe (`checkArgv`, `GATE_CHECK_TIMEOUT_MS = 5000`) times out. The real binaries behind the shims start in about 0.3 s.
**Impact:** The configured cross-family quick-start exit gate failed to launch (an operational failure, not a review result). No remediation attempt was spent.
**Recommendation:** For headless gate runs inside super.engineering sessions, drop `~/.super.engineering/bin` from PATH for the gate command only, so the same configured target resolves to the real CLI. Upstream (OAT): consider a longer availability timeout or a cached availability result. Upstream (super.engineering): reduce shim startup cost for `--version`.

## 2026-10-02T12:40:00Z - worked-well - Real-store verification caught defects that synthetic fixtures and reviews missed

**Observation:** Running the generated CLI read-only against the developer's real session stores exposed three defects. All tests and reviews were green at the time.
- Codex MCP results live only in `item_completed` items, so the motivating session was unfindable.
- Real stores JSON-escape `/` and HTML-sensitive characters, which broke the rg-prefilter superset invariant.
- t06's blanking dropped MCP entity ids.

**Impact:** each defect would have shipped silently.
**Recommendation:** for search/parsing tools over provider-owned stores, add a read-only real-store smoke step (counts and titles only) after each phase. Also measure store facts (escape census, item-type census) before asserting writer behavior.

## 2026-10-02T12:40:00Z - gotcha - scripts/bump-version.ts writes double-quoted skill versions

**Observation:** `bump-version.ts --skill` rewrote `metadata.version` with double quotes, so format:check failed. It needed a recovery commit.
**Impact:** one recovery attempt was consumed in p04.
**Recommendation:** fix the script to preserve single quotes, or run oxfmt on bumped SKILL.md files as part of the bump.

## 2026-10-02T12:40:00Z - decision - Stopped at the final-review cycle cap instead of self-authorizing a 4th cycle

**Observation:** final-scope review cycles reached 3: the initial review, re-review 1, and a changed-basis re-review after the exit-gate fix. Each found a real Medium.
**Impact:** the autonomous run stops at REVIEWRECEIVE-02. All 64 tasks are done; final re-review, exit gate, summary, docs, and PR are pending.
**Recommendation:** an operator authorizes one more final cycle, then resumes `/oat-project-autonomous session-search`.

## 2026-10-02T12:40:00Z - environment-limited - Full-suite premerge flakes under host load

**Observation:** `src/shared/collaboration/diagnostics.test.ts` (4097 sequential file writes, 30 s timeout) timed out twice under load about 15 on 14 cores. It passed on a root rerun.
**Impact:** false premerge failures during parallel agent work.
**Recommendation:** raise that test's timeout, or reduce its file count (repo follow-up).
