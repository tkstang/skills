# Remote search recipe

Opt-in only. Run these steps only for an SSH host the user names, after they ask
to search another machine. Never assume or store hostnames. Every command below
is read-only. `<host>` is the user's SSH alias or `user@hostname`.

**Quoting rule.** Search text must never be parsed by a shell. Each recipe sends
one script through a quoted heredoc (`ssh … 'bash -s' <<'EOF'`), so the local
shell expands nothing and only the remote `bash` parses the script once. Inside
it, patterns and terms sit in their own quoted heredocs (`<<'PATTERNS'`,
`<<'TERMS'`), one per line, so `$(…)`, backticks, quotes, and backslashes stay
literal text. Never move search text onto the `ssh` command line or into a
double-quoted string. A line may not equal a heredoc delimiter (`EOF`,
`PATTERNS`, `TERMS`), and patterns cannot contain newlines.

## 1. Check reachability without prompts

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 <host> true
```

A failure means key-based login is not set up (or the host is unreachable). Tell
the user; do not retry interactively or ask for a password.

## 2. Run the CLI remotely

The script locates the installed skill itself (standard skill roots, then the
Claude and Codex plugin caches), so no remote path is substituted. Non-interactive
SSH shells often lack Homebrew and version-manager paths, so it prefixes `PATH`.

```bash
ssh -o BatchMode=yes <host> 'bash -s' <<'EOF'
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cli=""
for d in "$HOME/.agents/skills/session-search" "$HOME/.claude/skills/session-search" \
  "$HOME/.cursor/skills/session-search" "$HOME/.codex/skills/session-search"; do
  if [ -f "$d/scripts/session-search.mjs" ]; then cli="$d/scripts/session-search.mjs"; break; fi
done
if [ -z "$cli" ]; then
  cli=$(find "$HOME/.claude/plugins/cache" "$HOME/.codex/plugins/cache" -maxdepth 7 \
    -path '*/skills/search/scripts/session-search.mjs' 2>/dev/null | sort | tail -n 1)
fi
if [ -z "$cli" ]; then echo 'session-search: not installed on this host' >&2; exit 4; fi
args=()
while IFS= read -r pattern; do
  [ -n "$pattern" ] && args+=(-p "$pattern")
done <<'PATTERNS'
perceive.*now
vetting
PATTERNS
node "$cli" "${args[@]}" --since 2w --json
EOF
```

- Replace the lines between `<<'PATTERNS'` and `PATTERNS` with your patterns,
  one per line, exactly as you would pass them locally.
- Put other flags on the `node` line using only documented values (time specs,
  runtime and tier lists, numbers). A `--cwd` path is a path on the remote
  machine; quote it in single quotes and reject one containing `'`.
- Exit 4 with `not installed` means the skill is absent there; go to step 3.
- If `node` is not found, ask the user for its path on that host (for example,
  `command -v node` in their login shell there) and add its directory to the
  `PATH` line. Do not install anything.
- If `rg` or `sqlite3` live elsewhere, add `export SESSION_SEARCH_RG=<path>` or
  `export SESSION_SEARCH_SQLITE3=<path>` after the `PATH` line. A slow host can
  need `export SESSION_SEARCH_PROBE_TIMEOUT_MS=10000`.
- Exit codes and the JSON schema are the same as locally. `host.hostname` names
  the machine; label remote results with it. A large-scan confirmation applies to
  the remote store and needs the user's go-ahead like a local one.

## 3. Fallback when the skill is not installed remotely

These cover only the history and metadata tiers, without ranking or redaction.

**Terms are plain substrings, not regexes.** `grep -F` and SQL `LIKE` match text
literally (case-insensitively for ASCII), so reduce each pattern to a distinctive
literal fragment: `perceive.*now` becomes `perceive now`, and `a|b` becomes two
terms. Terms must not contain quotes, `$`, backticks, or backslashes; the script
skips any that do. In `LIKE`, `%` and `_` are wildcards, so avoid them too.

Show only the matching prompt or title text, never whole lines with unrelated
fields. Mask credential-shaped strings (API keys, tokens, passwords) as
`[REDACTED]` before showing anything, and suggest installing the skill on that
host for full search.

```bash
ssh -o BatchMode=yes <host> 'bash -s' <<'EOF'
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
sqlite=$(command -v sqlite3 || true)
db="$HOME/.codex/state_5.sqlite"
while IFS= read -r term; do
  [ -n "$term" ] || continue
  case "$term" in
    *[\'\"\$\`\\]*) echo "skipped unsafe term (use a plain fragment)" >&2; continue ;;
  esac
  echo "== term: $term"
  # Prompt history: Claude `display`, Codex `text`.
  for f in "$HOME/.claude/history.jsonl" "$HOME/.codex/history.jsonl"; do
    [ -f "$f" ] && grep -i -F -e "$term" -- "$f" | tail -n 20 | cut -c1-400
  done
  # Codex thread titles and first messages, with the term bound as a parameter.
  if [ -n "$sqlite" ] && [ -f "$db" ]; then
    "$sqlite" -readonly -cmd ".parameter set :q '%$term%'" "$db" \
      'SELECT id, cwd, updated_at, substr(title, 1, 120) FROM threads WHERE title LIKE :q OR first_user_message LIKE :q ORDER BY updated_at DESC LIMIT 20'
  fi
done <<'TERMS'
perceive now
vetting
TERMS
EOF
```

Replace the lines between `<<'TERMS'` and `TERMS` with your terms, one per line.
`.parameter` needs sqlite3 3.31 or newer; an older one reports an error, and the
history results still stand.

Map hits back to sessions: a Claude `sessionId` resumes with
`claude --resume <id>` in its `project` directory; a Codex `session_id` or thread
`id` resumes with `codex resume <id>` on that host.
