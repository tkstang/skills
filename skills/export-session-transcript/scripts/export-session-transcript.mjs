#!/usr/bin/env node
/**
 * export-session-transcript.mjs — CLI entrypoint for the export-session-transcript skill.
 *
 * Exports the CURRENT agent conversation to a sanitized Markdown transcript,
 * named after the current git branch, written by default to ~/Downloads.
 *
 * Usage:
 *   node export-session-transcript.mjs [output-path] [flags]
 *
 *   --runtime <claude-code|codex|cursor|auto>  default: auto (env hint → auto-detect)
 *   --match <marker>      grep cwd candidates for this marker (current session)
 *   --session <id>        export a specific session id (bypasses --match)
 *   --all                 export every session for the cwd (one file each)
 *   --cwd <path>          project dir to match against (default: process.cwd())
 *   --out <path>          output file or directory (also accepted positionally)
 *   --help
 *
 * Exit codes:
 *   0 — success
 *   1 — hard error
 *   2 — no candidates for cwd/runtime
 *   3 — ambiguous (multiple candidates, no --match/--session/--all)
 *
 * Pipeline: enumerate cwd candidates → select session → readRecords →
 * normalizeEntries (STRUCTURAL) → sanitizeEntries (CONTENT) → strip marker +
 * empties → render Markdown → write.
 *
 * Dependency-free: Node standard library only.
 *
 * Script resolution: invoked by absolute path; tests resolve it via
 * fileURLToPath(new URL('./export-session-transcript.mjs', import.meta.url)).
 */

import { execFile } from 'node:child_process';
import { readdir, stat, mkdir, writeFile, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = join(__dirname, 'lib');

const {
  discoverPaths,
  encodeCwdVariants,
  extractMeta,
  readRecords,
  normalizeEntries,
} = await import(join(LIB, 'runtimes.mjs'));
const { sanitizeEntries } = await import(join(LIB, 'sanitize.mjs'));

const VALID_RUNTIMES = ['claude-code', 'codex', 'cursor'];
const LOOKBACK_DAYS = 30;
const MARKER_LINE_RE = /EXPORT_SESSION_MARKER\s*=\s*\S+/;

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------

function parseCliArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      runtime: { type: 'string', default: 'auto' },
      match: { type: 'string', default: undefined },
      session: { type: 'string', default: undefined },
      all: { type: 'boolean', default: false },
      cwd: { type: 'string', default: process.cwd() },
      out: { type: 'string', default: undefined },
      help: { type: 'boolean', default: false },
    },
  });
  return {
    runtime: values.runtime,
    match: values.match,
    session: values.session,
    all: values.all,
    cwd: values.cwd,
    out: values.out ?? positionals[0],
    help: values.help,
  };
}

const HELP = `export-session-transcript — export the current conversation to sanitized Markdown

Usage:
  node export-session-transcript.mjs [output-path] [flags]

Flags:
  --runtime <claude-code|codex|cursor|auto>  default: auto
  --match <marker>      select the current session by an announced marker
  --session <id>        export a specific session id
  --all                 export every session for the cwd (one file each)
  --cwd <path>          project dir to match against (default: process.cwd())
  --out <path>          output file or directory (also accepted positionally)
  --help                this message

Exit codes: 0 ok · 1 hard error · 2 no candidates · 3 ambiguous`;

// ---------------------------------------------------------------------------
// runtime resolution
// ---------------------------------------------------------------------------

function resolveRuntime(requested) {
  if (requested && requested !== 'auto') {
    if (!VALID_RUNTIMES.includes(requested)) {
      throw new Error(
        `Unknown runtime: ${requested}. Expected one of ${VALID_RUNTIMES.join(', ')}.`,
      );
    }
    return requested;
  }
  // env hint (SESSION_OBSERVER_SELF-style), then best-effort auto-detect.
  const hint =
    process.env.EXPORT_SESSION_SELF ?? process.env.SESSION_OBSERVER_SELF;
  if (hint && VALID_RUNTIMES.includes(hint)) return hint;
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE) return 'claude-code';
  if (process.env.CODEX_SANDBOX || process.env.CODEX_HOME) return 'codex';
  if (process.env.CURSOR_TRACE_ID || process.env.CURSOR) return 'cursor';
  return null; // unresolved — caller decides
}

// ---------------------------------------------------------------------------
// candidate enumeration (via synced runtimes primitives)
// ---------------------------------------------------------------------------

async function collectJsonlFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectJsonlFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      results.push(full);
    }
  }
  return results;
}

async function statCandidate(transcriptPath) {
  try {
    const s = await stat(transcriptPath);
    return { mtime: Math.floor(s.mtime.getTime() / 1000), size: s.size };
  } catch {
    return null;
  }
}

async function enumerateClaudeCode(targetCwd) {
  const [root] = discoverPaths('claude-code');
  const variants = encodeCwdVariants('claude-code', targetCwd);
  const candidates = [];
  const seen = new Set();
  for (const encoded of variants) {
    const dir = join(root, encoded);
    let files;
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }
    for (const file of files) {
      const p = join(dir, file);
      if (seen.has(p)) continue;
      seen.add(p);
      const st = await statCandidate(p);
      if (!st) continue;
      let meta;
      try {
        meta = await extractMeta('claude-code', p);
      } catch {
        meta = null;
      }
      candidates.push({
        runtime: 'claude-code',
        transcriptPath: p,
        sessionId: meta?.sessionId ?? basename(p).replace(/\.jsonl$/u, ''),
        ...st,
      });
    }
  }
  return candidates;
}

async function enumerateCodex(targetCwd, { requireCwd = false } = {}) {
  const [root] = discoverPaths('codex');
  const now = Date.now() / 1000;
  const cutoff = now - LOOKBACK_DAYS * 86400;
  const files = await collectJsonlFiles(root);
  const candidates = [];
  for (const p of files) {
    const st = await statCandidate(p);
    if (!st) continue;
    if (st.mtime < cutoff) continue;
    let meta;
    try {
      meta = await extractMeta('codex', p);
    } catch {
      meta = null;
    }
    // A resolved recordedCwd that differs from the target is always a non-match.
    if (meta?.recordedCwd && meta.recordedCwd !== targetCwd) continue;
    // When enumerating without an authoritative selector (--all / no-selector),
    // an unresolved (null/empty) recordedCwd cannot be tied to this cwd, so it
    // is excluded. Marker/id selectors are authoritative and keep these.
    if (requireCwd && !meta?.recordedCwd) continue;
    candidates.push({
      runtime: 'codex',
      transcriptPath: p,
      sessionId: meta?.sessionId ?? basename(p).replace(/\.jsonl$/u, ''),
      ...st,
    });
  }
  return candidates;
}

async function enumerateCursor(targetCwd) {
  const [root] = discoverPaths('cursor');
  const variants = encodeCwdVariants('cursor', targetCwd);
  const candidates = [];
  const seen = new Set();
  for (const encoded of variants) {
    const transcriptsRoot = join(root, encoded, 'agent-transcripts');
    let sessionDirs;
    try {
      sessionDirs = await readdir(transcriptsRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const sd of sessionDirs) {
      if (!sd.isDirectory()) continue;
      const sessionPath = join(transcriptsRoot, sd.name);
      let files;
      try {
        files = (await readdir(sessionPath)).filter((f) =>
          f.endsWith('.jsonl'),
        );
      } catch {
        continue;
      }
      for (const file of files) {
        const p = join(sessionPath, file);
        if (seen.has(p)) continue;
        seen.add(p);
        const st = await statCandidate(p);
        if (!st) continue;
        let meta;
        try {
          meta = await extractMeta('cursor', p);
        } catch {
          meta = null;
        }
        candidates.push({
          runtime: 'cursor',
          transcriptPath: p,
          sessionId: meta?.sessionId ?? basename(p).replace(/\.jsonl$/u, ''),
          ...st,
        });
      }
    }
  }
  return candidates;
}

async function enumerateCandidates(
  runtime,
  targetCwd,
  { requireCwd = false } = {},
) {
  if (runtime === 'claude-code') return enumerateClaudeCode(targetCwd);
  if (runtime === 'codex') return enumerateCodex(targetCwd, { requireCwd });
  if (runtime === 'cursor') return enumerateCursor(targetCwd);
  throw new Error(`Unknown runtime: ${runtime}`);
}

// ---------------------------------------------------------------------------
// session selection
// ---------------------------------------------------------------------------

async function candidateContainsMarker(transcriptPath, marker) {
  try {
    const raw = await readFile(transcriptPath, 'utf8');
    return raw.includes(marker);
  } catch {
    return false;
  }
}

function newest(candidates) {
  return [...candidates].sort((a, b) => b.mtime - a.mtime)[0];
}

/**
 * Select the target candidate(s) per mode.
 * @returns {{ selected: object[], warnings: string[] } | { exit: number, message: string }}
 */
async function selectSessions(opts, candidates) {
  const warnings = [];

  if (opts.all) {
    return { selected: candidates, warnings };
  }

  if (opts.session) {
    const hit = candidates.find((c) => c.sessionId === opts.session);
    if (!hit) {
      return {
        exit: 2,
        message: `No transcript found for session id "${opts.session}" in this cwd.`,
      };
    }
    return { selected: [hit], warnings };
  }

  if (opts.match) {
    for (const c of candidates) {
      if (await candidateContainsMarker(c.transcriptPath, opts.match)) {
        return { selected: [c], warnings };
      }
    }
    // marker miss → newest-for-cwd fallback + warning (not fatal)
    const fallback = newest(candidates);
    warnings.push(
      `marker "${opts.match}" not found in any candidate; falling back to newest-for-cwd transcript (${fallback.sessionId}). Re-run with --session <id> if this is the wrong session.`,
    );
    return { selected: [fallback], warnings };
  }

  // No selector: only auto-pick if there is exactly one candidate.
  if (candidates.length === 1) {
    return { selected: [candidates[0]], warnings };
  }
  return {
    exit: 3,
    message:
      `Multiple candidate sessions for this cwd and no --match/--session/--all.\n` +
      candidates
        .map((c) => `  - ${c.sessionId} (${c.transcriptPath})`)
        .join('\n') +
      `\nRe-run with --match <marker>, --session <id>, or --all.`,
  };
}

// ---------------------------------------------------------------------------
// git branch / output-path resolution
// ---------------------------------------------------------------------------

async function gitBranch(cwd) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', cwd, 'symbolic-ref', '--short', 'HEAD'],
      {
        timeout: 5000,
      },
    );
    const branch = stdout.trim();
    return branch || null;
  } catch {
    return null; // not a git repo or detached HEAD
  }
}

function utcStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sanitizeBranchForFilename(branch) {
  return branch.replace(/\//g, '-');
}

async function isDirectory(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve the output file path for a single selected session.
 *
 * @param {object} opts
 * @param {string | null} branch
 * @param {object} session selected candidate
 * @param {boolean} multi true when --all (forces per-session naming)
 * @returns {Promise<string>}
 */
async function resolveOutputPath(opts, branch, session, multi) {
  const base = branch
    ? sanitizeBranchForFilename(branch)
    : `${basename(opts.cwd)}-${utcStamp()}`;

  const fileName = multi ? `${base}-${session.sessionId}.md` : `${base}.md`;

  if (opts.out) {
    // Directory (existing or trailing slash) → auto-name inside it.
    if (opts.out.endsWith('/') || (await isDirectory(opts.out))) {
      return join(opts.out, fileName);
    }
    // For --all an explicit file path is ambiguous; treat --out as a directory.
    if (multi) return join(opts.out, fileName);
    // Single mode: explicit file path → verbatim.
    return opts.out;
  }

  // Default: ~/Downloads/<name>.md
  return join(homedir(), 'Downloads', fileName);
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

const SANITIZE_NOTE =
  'Note: Only visible user/assistant messages. Tool calls, tool outputs, ' +
  'developer/system instructions, environment/AGENTS.md/skill payloads, and ' +
  'subagent notifications are excluded.';

function stripMarkerAndEmpty(entries) {
  const out = [];
  for (const entry of entries) {
    let text = entry.text ?? '';
    // Remove any marker line(s) from the message body.
    text = text
      .split(/\r?\n/)
      .filter((line) => !MARKER_LINE_RE.test(line))
      .join('\n')
      .trim();
    if (!text) continue;
    out.push({ ...entry, text });
  }
  return out;
}

function renderMarkdown({ branch, source, runtime, entries, branchFromGit }) {
  const lines = [];
  const title = branchFromGit ? branch : `${branch} (no git branch)`;
  lines.push(`# Conversation History: ${title}`);
  lines.push('');
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push(`Source: ${source}`);
  lines.push(`Runtime: ${runtime}`);
  lines.push(SANITIZE_NOTE);
  lines.push('');

  if (entries.length === 0) {
    lines.push('*No visible messages.*');
    lines.push('');
    return lines.join('\n');
  }

  // Group consecutive same-role entries under one header.
  let i = 0;
  while (i < entries.length) {
    const role = entries[i].role;
    const header = role === 'user' ? '## User' : '## Assistant';
    lines.push(header);
    lines.push('');
    while (i < entries.length && entries[i].role === role) {
      lines.push(entries[i].text);
      lines.push('');
      i++;
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// export one session → write file
// ---------------------------------------------------------------------------

async function exportSession(
  opts,
  runtime,
  branch,
  branchFromGit,
  session,
  multi,
) {
  const records = await readRecords(session.transcriptPath);
  const normalized = normalizeEntries(runtime, records, {});
  const sanitized = sanitizeEntries(normalized, { runtime });
  const entries = stripMarkerAndEmpty(sanitized);

  const md = renderMarkdown({
    branch: branch ?? basename(opts.cwd),
    branchFromGit,
    source: session.transcriptPath,
    runtime,
    entries,
  });

  const outPath = await resolveOutputPath(opts, branch, session, multi);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, md, 'utf8');
  return outPath;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(HELP);
    return 0;
  }

  let runtime;
  try {
    runtime = resolveRuntime(opts.runtime);
  } catch (err) {
    console.error(`[export-session-transcript] ${err.message}`);
    return 1;
  }
  if (!runtime) {
    console.error(
      '[export-session-transcript] Could not resolve runtime. Pass --runtime <claude-code|codex|cursor>.',
    );
    return 1;
  }

  // When no authoritative selector (--match/--session) is active, enumeration
  // must be able to tie each candidate to the cwd. In that mode (--all or the
  // no-selector "newest"/single path) a candidate with an unresolved cwd is
  // excluded. With --match/--session the marker/id is authoritative, so a
  // missing cwd meta must not drop the session.
  const requireCwd = !opts.match && !opts.session;

  let candidates;
  try {
    candidates = await enumerateCandidates(runtime, opts.cwd, { requireCwd });
  } catch (err) {
    console.error(`[export-session-transcript] ${err.message}`);
    return 1;
  }

  if (candidates.length === 0) {
    const [root] = discoverPaths(runtime);
    console.error(
      `[export-session-transcript] No ${runtime} transcripts found for cwd ${opts.cwd}.\n` +
        `Looked under: ${root}\nTry --cwd <path> or confirm ${runtime} has run in this project.`,
    );
    return 2;
  }

  const selection = await selectSessions(opts, candidates);
  if (selection.exit !== undefined) {
    console.error(`[export-session-transcript] ${selection.message}`);
    return selection.exit;
  }

  for (const warning of selection.warnings) {
    console.error(`[export-session-transcript] warning: ${warning}`);
  }

  const branch = await gitBranch(opts.cwd);
  const branchFromGit = branch !== null;
  const multi = opts.all;

  const written = [];
  try {
    for (const session of selection.selected) {
      written.push(
        await exportSession(
          opts,
          runtime,
          branch,
          branchFromGit,
          session,
          multi,
        ),
      );
    }
  } catch (err) {
    console.error(
      `[export-session-transcript] Failed to write output: ${err.message}`,
    );
    return 1;
  }

  for (const p of written) {
    console.log(`[export-session-transcript] wrote ${p}`);
  }
  return 0;
}

main()
  .then((code) => {
    process.exit(code ?? 0);
  })
  .catch((err) => {
    console.error(`[export-session-transcript] ${err.stack ?? err.message}`);
    process.exit(1);
  });
