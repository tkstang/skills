# Cursor kickoff — session-observer smoke test (third observer)

You are joining a live multi-agent collaboration experiment as the **third
agent** (Cursor). A Claude Code session and a Codex session in this worktree
are already observing each other via the `session-observer` CLI and
collaborating with the user. Your job is a bounded smoke test of Cursor's
participation — observe, verify, and report. Do not modify any source code.

## Context

- Worktree: `/Users/tstang/orca/workspaces/open-agent-toolkit/oat-repo-improve`
- The observer CLI: `node /Users/tstang/.claude/skills/session-observer/scripts/session-observer.mjs`
- Claude Code session to observe (pin exactly this):
  `claude-code:35331219-1cd2-4997-a032-68f5c33f701b`
- IMPORTANT CONSTRAINT: the Codex session already owns the stateful
  watcher/offsets for that Claude session. You must use **stateless reads
  only**: the `review` subcommand. Never run `catch-up`, `watch`,
  `catch-up-then-watch`, or `--mark-read` against the Claude session — you
  would corrupt the other agents' read offsets.

## Tasks (in order)

1. **Self-identification.** Report what you can determine about your own
   session: does a transcript for this session appear under
   `~/.cursor/projects/<encoded-project>/agent-transcripts/`? Report the
   exact path and session ID if so, or state clearly that you cannot find
   one and what you looked for. (The encoded project slug joins path
   segments split on `/` and `.` with `-`.)
2. **Observed-side check.** List which of your activities (this agent
   session) produce records in that transcript file — this tells the other
   agents whether Cursor sessions are observable at all.
3. **Read the Claude session** (stateless):
   ```bash
   node /Users/tstang/.claude/skills/session-observer/scripts/session-observer.mjs \
     review --runtime claude-code \
     --cwd "/Users/tstang/orca/workspaces/open-agent-toolkit/oat-repo-improve" \
     --session claude-code:35331219-1cd2-4997-a032-68f5c33f701b \
     --max-turns 6
   ```
   Summarize the last few turns in one short paragraph to prove the read
   worked.
4. **Locate diagnostics.** Run:
   ```bash
   node /Users/tstang/.claude/skills/session-observer/scripts/session-observer.mjs \
     locate --runtime cursor \
     --cwd "/Users/tstang/orca/workspaces/open-agent-toolkit/oat-repo-improve" --json
   ```
   Report whether your own session shows up as a candidate.
5. **Completed-turn marker.** If you found your own transcript in step 1,
   inspect a few of its JSONL records and report what record type/field marks
   the end of an assistant turn (the other harnesses use markers like
   `turn_duration`; wake filters need Cursor's equivalent).
6. **Write your findings** to
   `.session-observer/cursor-logs.md` in this shared append-only format:
   - Header: `# Session Observer Collaboration Log — cursor` plus session
     metadata (date, self runtime, worktree, task).
   - Entries: `### [HH:MM] <category> — <title>` with category ∈
     `mechanics | protocol | content | gotcha | idea`, and three bullets:
     **What happened**, **Assessment** (works-well | friction | gotcha |
     idea), **Skill implication**.
7. **Report back to the user** with a compact summary. The Claude and Codex
   agents will read your transcript and your log file; write your final
   message so it stands alone.

## Conventions while participating

- User messages in any of the three sessions are direction for all agents,
  but privileged/destructive actions need approval in your own session.
- If a message of yours is purely an acknowledgment with no new information,
  begin it with `[no-op]` — the other agents' wake filters skip such turns.
- Pause and wait for the user whenever a decision is theirs to make.
- You are read-only on source code and on the other agents' state; your only
  writes are `.session-observer/cursor-logs.md`.
