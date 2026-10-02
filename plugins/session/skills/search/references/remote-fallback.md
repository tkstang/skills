# Remote search recipe

Opt-in only. Run these steps only for an SSH host the user names, after they ask
to search another machine. Never assume or store hostnames. Every command below
is read-only. `<host>` is the user's SSH alias or `user@hostname`.

## 1. Check reachability without prompts

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 <host> true
```

A failure means key-based login is not set up (or the host is unreachable). Tell
the user; do not retry interactively or ask for a password.

## 2. Locate the installed skill

Non-interactive SSH shells often lack Homebrew and version-manager paths, so
prefix `PATH` on every remote command.

```bash
ssh -o BatchMode=yes <host> 'for d in ~/.agents/skills/session-search ~/.claude/skills/session-search ~/.cursor/skills/session-search ~/.codex/skills/session-search; do [ -f "$d/scripts/session-search.mjs" ] && { echo "$d/scripts/session-search.mjs"; exit 0; }; done; find ~/.claude/plugins/cache ~/.codex/plugins/cache -maxdepth 7 -path "*/skills/search/scripts/session-search.mjs" 2>/dev/null | sort | tail -n 1'
```

Empty output means the skill is not installed there; go to step 4.

## 3. Run the CLI remotely

```bash
ssh -o BatchMode=yes <host> 'PATH=/opt/homebrew/bin:/usr/local/bin:$PATH node <remote-cli> -p '\''pattern one'\'' -p '\''pattern-two'\'' --since 2w --json'
```

- Quote each pattern for the remote shell. Prefer patterns without single quotes;
  otherwise close, escape, and reopen the quote (`'\''`).
- `--cwd` hints are paths on the remote machine. `~` expands against the remote
  home.
- If `node` is still not found, ask the user for its path on that host (for
  example, the output of `command -v node` in their login shell there). Do not
  install anything.
- If `rg` or `sqlite3` live elsewhere, pass `SESSION_SEARCH_RG=<path>` or
  `SESSION_SEARCH_SQLITE3=<path>`. A slow host can need
  `SESSION_SEARCH_PROBE_TIMEOUT_MS=10000`.
- Exit codes and the JSON schema are the same as locally. `host.hostname` names
  the machine; label remote results with it. A large-scan confirmation applies to
  the remote store and needs the user's go-ahead like a local one.

## 4. Fallback when the skill is not installed remotely

These cover only the history and metadata tiers, without ranking or redaction.
Show only the matching prompt or title text, never whole lines with unrelated
fields. Mask credential-shaped strings (API keys, tokens, passwords) as
`[REDACTED]` before showing anything, and suggest installing the skill on that
host for full search.

Prompt history (Claude `display`, Codex `text`):

```bash
ssh -o BatchMode=yes <host> 'RG=$(command -v rg || ls /opt/homebrew/bin/rg /usr/local/bin/rg /usr/bin/rg 2>/dev/null | head -n 1); for f in ~/.claude/history.jsonl ~/.codex/history.jsonl; do [ -f "$f" ] || continue; if [ -n "$RG" ]; then "$RG" -i --no-config -e '\''pattern'\'' "$f"; else grep -i -E -e '\''pattern'\'' "$f"; fi | tail -n 20 | cut -c1-400; done'
```

Codex thread titles and first messages (`LIKE` is case-insensitive for ASCII):

```bash
ssh -o BatchMode=yes <host> 'S=$(command -v sqlite3 || ls /opt/homebrew/bin/sqlite3 /usr/local/bin/sqlite3 /usr/bin/sqlite3 2>/dev/null | head -n 1); [ -n "$S" ] && [ -f ~/.codex/state_5.sqlite ] && "$S" -readonly ~/.codex/state_5.sqlite "SELECT id, cwd, updated_at, substr(title, 1, 120) FROM threads WHERE title LIKE '\''%pattern%'\'' OR first_user_message LIKE '\''%pattern%'\'' ORDER BY updated_at DESC LIMIT 20"'
```

Map hits back to sessions: a Claude `sessionId` resumes with
`claude --resume <id>` in its `project` directory; a Codex `session_id` or thread
`id` resumes with `codex resume <id>` on that host.
