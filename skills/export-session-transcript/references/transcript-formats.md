# Transcript Formats Reference (export)

Condensed reference for the Claude Code, Codex, and Cursor JSONL record shapes that
`scripts/lib/runtimes.mjs` parses for export. The canonical parsing logic lives in
the shared `transcript-core` module (synced into `scripts/lib/runtimes.mjs`); these
formats may drift between runtime releases.

`runtimes.mjs` does **structural** filtering only (it drops tool calls/results and
Claude slash-command records). The export-owned `scripts/lib/sanitize.mjs` adds the
**content** layer that drops hidden injected payloads recorded as ordinary text.

---

## File location patterns

| Runtime     | Store root            | Pattern                                                                                  |
| ----------- | --------------------- | ---------------------------------------------------------------------------------------- |
| Claude Code | `~/.claude/projects/` | `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`                                    |
| Codex       | `~/.codex/sessions/`  | `~/.codex/sessions/<YYYY>/<MM>/<DD>/session-<id>.jsonl`                                  |
| Cursor      | `~/.cursor/projects/` | `~/.cursor/projects/<encoded-project>/agent-transcripts/<session-id>/<session-id>.jsonl` |

- **Claude Code** encodes the cwd as the parent directory name, replacing `/` and `.`
  with `-` (e.g. `/Users/alice/Code/app` → `-Users-alice-Code-app`).
- **Codex** has no cwd in the file name; the cwd is read from a `session_started`
  record's `cwd` (top-level or `payload.cwd`).
- **Cursor** derives the project slug by splitting cwd on `/` and `.` and joining
  non-empty segments with `-` (e.g. `/Users/alice/Code/app` → `Users-alice-Code-app`).

---

## Record shapes (visible messages only)

### Claude Code

```json
{ "type": "user", "sessionId": "cc-1",
  "message": { "role": "user", "content": "Hello" } }

{ "type": "assistant", "sessionId": "cc-1",
  "message": { "role": "assistant", "content": [ { "type": "text", "text": "Hi" } ] } }
```

`content` may be a string or an array of typed blocks; `normalizeEntries` extracts
`type: "text"` blocks and drops `tool_use` / `tool_result` blocks and
`<command-message>`-style slash-command records.

### Codex

```json
{
  "type": "response_item",
  "sessionId": "codex-1",
  "payload": { "type": "message", "role": "user", "content": "Hello" }
}
```

`payload.type === "message"` carries the role/content; `payload.content` may be a
string or array of blocks. `payload.type === "function_call"` records are tool calls
and are dropped structurally.

### Cursor

```json
{
  "role": "assistant",
  "message": { "content": [{ "type": "text", "text": "Hi" }] }
}
```

Top-level `role` plus a `message.content` array of `text` / `tool_use` blocks; only
`text` blocks survive structural filtering.

---

## Hidden payloads the content sanitizer drops

For **all three runtimes**, the following can arrive as ordinary user/assistant
**text** messages (especially on Codex/Cursor, where `normalizeEntries` passes text
through verbatim). `sanitize.mjs` drops them by leading-content match:

- `<environment_context>…</environment_context>` wrappers
- `# AGENTS.md instructions` / pasted AGENTS.md / SKILL.md skill-body payloads
- skill frontmatter / `<command-message>`-style blocks surviving as text
- system / developer instruction records (role `system`/`developer`, or so-tagged)
- `<subagent_notification>…` notifications
- `<turn_aborted>` markers

Negative rule: genuine messages that merely _mention_ one of these tokens
mid-sentence are NOT dropped — only leading-content matches are removed.

---

## Adding a new runtime

`runtimes.mjs` is the only file with structural knowledge of per-runtime formats. To
add a runtime, extend `discoverPaths`, `encodeCwd`/`encodeCwdVariants`, `extractMeta`,
and `normalizeEntries` in the canonical `shared/transcript-core/runtimes.mjs`, then
run `npm run sync:transcript-core`. The export CLI and sanitizer need no changes.
