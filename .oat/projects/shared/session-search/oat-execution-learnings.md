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
